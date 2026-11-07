import { createHash, randomUUID } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import type {
  LeadConnectorTeamMember,
  DialerTeamView,
  DialerTeamChange,
} from '@consuelo/lead-connector';
import {
  decodeInboundQueuePolicy,
  type InboundQueuePolicy,
  type RepCapacityState,
} from '@consuelo/dialer';
import type { DialerIdentity } from '../contracts';
import { resolveBillingAccess } from '../billing/application';
import { executeRepCapacityOnClient } from '../inbound/rep-capacity';
import { DEFAULT_REP_POLICY } from '../inbound/default-rep-policy';

export type TeamAccessService = {
  read: (identity: DialerIdentity) => Promise<DialerTeamView>;
  update: (identity: DialerIdentity, raw: unknown) => Promise<DialerTeamView>;
  assertCanCall: (identity: DialerIdentity) => Promise<void>;
};
const hash = (value: unknown) =>
  createHash('sha256').update(JSON.stringify(value)).digest('hex');
const codes = new Set([
  'ADMIN_REQUIRED',
  'TEAM_DIRECTORY_UNAVAILABLE',
  'TEAM_DIRECTORY_CHANGED',
  'TEAM_INSTALLATION_CHANGED',
  'TEAM_VIEW_CHANGED',
  'INVALID_TEAM_CHANGE',
  'TEAM_MEMBER_INELIGIBLE',
  'TEAM_SEAT_LIMIT',
  'TEAM_PAID_ACCESS_REQUIRED',
  'TEAM_QUEUE_NOT_FOUND',
  'TEAM_ACCESS_REVOKED',
  'TEAM_ACCESS_UNAVAILABLE',
]);
const safeError = (cause: unknown): Error =>
  cause instanceof Error && codes.has(cause.message)
    ? cause
    : new Error('TEAM_ACCESS_UNAVAILABLE', { cause });
export const createTeamAccessService = (input: {
  pool: Pool;
  directory: (identity: DialerIdentity) => Promise<LeadConnectorTeamMember[]>;
  paymentGraceDays: number;
  now?: () => Date;
}): TeamAccessService => {
  const directory = async (identity: DialerIdentity, admin: boolean) => {
    try {
      if (!identity.locationId || !identity.installationId)
        throw new Error('TEAM_INSTALLATION_CHANGED');
      let members: LeadConnectorTeamMember[];
      const started = Date.now();
      try {
        members = await input.directory(identity);
      } catch (cause: unknown) {
        throw new Error('TEAM_DIRECTORY_UNAVAILABLE', { cause });
      }
      if (Date.now() - started > 10000 || members.length > 1000)
        throw new Error('TEAM_DIRECTORY_UNAVAILABLE');
      const actor = members.find((m) => m.id === identity.userId);
      if (admin && (!actor || actor.role !== 'admin'))
        throw new Error('ADMIN_REQUIRED');
      if (!admin && (!actor || !actor.canCall))
        throw new Error('TEAM_MEMBER_INELIGIBLE');
      return members;
    } catch (cause: unknown) {
      throw safeError(cause);
    }
  };
  const transaction = async <T>(
    identity: DialerIdentity,
    operation: (client: PoolClient) => Promise<T>,
  ) => {
    try {
      const client = await input.pool.connect();
      let discard = false;
      try {
        await client.query('BEGIN');
        await client.query("SET LOCAL lock_timeout='5s'");
        // Match checkout claim's lock order; paid projections lock the same purchase row.
        await client.query(
          'SELECT pg_advisory_xact_lock(hashtextextended($1,0))',
          [identity.workspaceId],
        );
        const installation = (
          await client.query(
            'SELECT installation_id,location_id FROM consuelo_lead_connector_installations WHERE workspace_id=$1 FOR SHARE',
            [identity.workspaceId],
          )
        ).rows[0];
        if (
          !installation ||
          installation.installation_id !== identity.installationId ||
          installation.location_id !== identity.locationId
        )
          throw new Error('TEAM_INSTALLATION_CHANGED');
        await client.query(
          'SELECT id FROM dialer_public_purchases WHERE claimed_workspace_id=$1 FOR UPDATE',
          [identity.workspaceId],
        );
        await client.query(
          'SELECT pg_advisory_xact_lock(hashtextextended($1,0))',
          ['inbound:' + identity.workspaceId],
        );
        const result = await operation(client);
        await client.query('COMMIT');
        return result;
      } catch (cause: unknown) {
        try {
          await client.query('ROLLBACK');
        } catch {
          discard = true;
        }
        throw safeError(cause);
      } finally {
        client.release(discard);
      }
    } catch (cause: unknown) {
      throw safeError(cause);
    }
  };
  const commercialAuthority = async (client: PoolClient, workspace: string) => {
    try {
      const purchase = (
        await client.query<{
          entitlement_selection: { seats?: number; plan?: string } | null;
          generation: string;
          provider_status: string | null;
          provider_subscription_id: string | null;
          paid_at: Date | null;
        }>(
          `SELECT entitlement_selection,generation,provider_status,provider_subscription_id,paid_at
         FROM dialer_public_purchases WHERE claimed_workspace_id=$1`,
          [workspace],
        )
      ).rows[0];
      const subscription = (
        await client.query<{
          provider_subscription_id: string | null;
          status: string;
          payment_failed_at: Date | null;
        }>(
          'SELECT provider_subscription_id,status,payment_failed_at FROM dialer_workspace_subscriptions WHERE workspace_id=$1',
          [workspace],
        )
      ).rows[0];
      // Stripe's signed subscription is the current billing authority. A
      // previously confirmed purchase may have a lagging status when public
      // checkout webhooks are disabled; require its original subscription
      // binding and paid proof, not exact agreement between status snapshots.
      const billable = Boolean(
        subscription?.provider_subscription_id &&
        resolveBillingAccess({
          status: subscription.status,
          paymentFailedAt: subscription.payment_failed_at,
          now: input.now?.() ?? new Date(),
          graceDays: input.paymentGraceDays,
        }).canStartCalls,
      );
      const confirmed = Boolean(
        billable &&
        purchase?.paid_at &&
        purchase.provider_subscription_id &&
        purchase.provider_subscription_id ===
          subscription?.provider_subscription_id &&
        ['active', 'trialing', 'past_due'].includes(
          purchase.provider_status ?? '',
        ),
      );
      const selection = purchase?.entitlement_selection;
      let paidSeats =
        confirmed &&
        Number.isSafeInteger(selection?.seats) &&
        selection!.seats! > 0 &&
        selection!.seats! <= 1000 &&
        ['professional', 'agency', 'enterprise'].includes(selection?.plan ?? '')
          ? selection!.seats!
          : 0;
      let plan: string | null = paidSeats ? selection!.plan! : null;
      let legacyPlanCodes: string[] = [];
      if (!purchase && billable) {
        // Legacy commercial checkout has no public purchase. Its verified
        // Stripe webhook persists the authoritative subscription item codes.
        const items = (
          await client.query<{ item_code: string; quantity: number }>(
            'SELECT item_code,quantity FROM dialer_workspace_subscription_items WHERE workspace_id=$1',
            [workspace],
          )
        ).rows;
        const permitted = items.filter(
          (item) =>
            ['single', 'standard', 'power'].includes(item.item_code) &&
            Number.isSafeInteger(item.quantity) &&
            item.quantity > 0 &&
            item.quantity <= 1000,
        );
        const total = permitted.reduce((sum, item) => sum + item.quantity, 0);
        if (total > 0 && total <= 1000) {
          paidSeats = total;
          legacyPlanCodes = permitted.map((item) => item.item_code);
          if (legacyPlanCodes.length === 1) {
            plan =
              legacyPlanCodes[0] === 'single'
                ? 'professional'
                : legacyPlanCodes[0] === 'standard'
                  ? 'agency'
                  : 'enterprise';
          }
        }
      }
      return { purchase, subscription, paidSeats, plan, legacyPlanCodes };
    } catch (cause: unknown) {
      throw safeError(cause);
    }
  };
  const view = async (
    client: PoolClient,
    identity: DialerIdentity,
    members: LeadConnectorTeamMember[],
  ): Promise<DialerTeamView> => {
    try {
      const workspace = identity.workspaceId;
      const config = (
        await client.query(
          'SELECT revision FROM dialer_team_configuration WHERE workspace_id=$1',
          [workspace],
        )
      ).rows[0];
      const { purchase, subscription, paidSeats, plan } =
        await commercialAuthority(client, workspace);
      const seats = (
        await client.query(
          'SELECT user_id,status,plan_code FROM dialer_team_seats WHERE workspace_id=$1 ORDER BY user_id LIMIT 1001',
          [workspace],
        )
      ).rows;
      const access = (
        await client.query(
          'SELECT user_id,enabled FROM dialer_team_access WHERE workspace_id=$1 ORDER BY user_id LIMIT 1001',
          [workspace],
        )
      ).rows;
      if (seats.length > 1000 || access.length > 1000)
        throw new Error('TEAM_ACCESS_UNAVAILABLE');
      const queues = (
        await client.query<{
          queue_id: string;
          version: number;
          policy: InboundQueuePolicy;
        }>(
          'SELECT queue_id,version,policy FROM dialer_routing_queues WHERE workspace_id=$1 ORDER BY queue_id LIMIT 1001',
          [workspace],
        )
      ).rows;
      if (queues.length > 1000) throw new Error('TEAM_ACCESS_UNAVAILABLE');
      const capacity = (
        await client.query<{ rep_id: string; snapshot: RepCapacityState }>(
          'SELECT rep_id,snapshot FROM dialer_rep_capacity WHERE workspace_id=$1 ORDER BY rep_id LIMIT 1001',
          [workspace],
        )
      ).rows;
      if (capacity.length > 1000) throw new Error('TEAM_ACCESS_UNAVAILABLE');
      const positiveGrants = access.filter((entry) => entry.enabled);
      const starterOwner =
        !subscription && !purchase?.paid_at && positiveGrants.length === 1
          ? positiveGrants[0].user_id
          : !purchase &&
              !subscription &&
              positiveGrants.length === 0 &&
              members.some(
                (member) =>
                  member.id === identity.userId &&
                  member.role === 'admin' &&
                  member.canCall,
              )
            ? identity.userId
            : null;
      const revision = Number(config?.revision ?? 0);
      const directoryVersion = hash([
        identity.workspaceId,
        identity.locationId,
        identity.installationId,
        members,
        revision,
        purchase ?? null,
        subscription ?? null,
        seats,
        access,
        queues.map((q) => [q.queue_id, q.version]),
      ]);
      const roster = [...members];
      for (const seat of seats)
        if (
          seat.status === 'active' &&
          !roster.some((m) => m.id === seat.user_id)
        )
          roster.push({
            id: seat.user_id,
            name: 'Unavailable CRM member',
            role: 'user',
            canCall: false,
          });
      for (const grant of positiveGrants)
        if (!roster.some((member) => member.id === grant.user_id))
          roster.push({
            id: grant.user_id,
            name: 'Unavailable CRM member',
            role: 'user',
            canCall: false,
          });
      return {
        revision,
        directoryVersion,
        paidSeats,
        assignedSeats: seats.filter((s) => s.status === 'active').length,
        plan,
        queues: queues.map((q) => ({ id: q.queue_id, name: q.queue_id })),
        members: roster.map((m) => {
          const current = capacity.find((c) => c.rep_id === m.id)?.snapshot;
          return {
            ...m,
            assigned: seats.some(
              (s) => s.user_id === m.id && s.status === 'active',
            ),
            starter:
              m.id === starterOwner &&
              !access.some((a) => a.user_id === m.id && !a.enabled),
            queueIds: queues
              .filter((q) => q.policy.profiles.some((p) => p.repId === m.id))
              .map((q) => q.queue_id),
            capacityState:
              current?.owner?.phase ?? (current?.ready ? 'ready' : 'away'),
          };
        }),
      };
    } catch (cause: unknown) {
      throw safeError(cause);
    }
  };
  const read: TeamAccessService['read'] = async (identity) => {
    try {
      const members = await directory(identity, true);
      return transaction(identity, (c) => view(c, identity, members));
    } catch (cause: unknown) {
      throw safeError(cause);
    }
  };
  const update: TeamAccessService['update'] = async (identity, raw) => {
    try {
      if (!raw || typeof raw !== 'object' || Array.isArray(raw))
        throw new Error('INVALID_TEAM_CHANGE');
      const value = raw as Record<string, unknown>;
      if (
        Object.keys(value).some(
          (k) =>
            ![
              'revision',
              'directoryVersion',
              'userId',
              'enabled',
              'queueIds',
            ].includes(k),
        ) ||
        !Number.isSafeInteger(value.revision) ||
        Number(value.revision) < 0 ||
        Number(value.revision) >= 2147483647 ||
        typeof value.directoryVersion !== 'string' ||
        !/^[a-f0-9]{64}$/.test(value.directoryVersion) ||
        typeof value.userId !== 'string' ||
        !/^[A-Za-z0-9_.:-]{1,160}$/.test(value.userId) ||
        typeof value.enabled !== 'boolean' ||
        !Array.isArray(value.queueIds) ||
        value.queueIds.length > 100 ||
        value.queueIds.some((q) => typeof q !== 'string') ||
        new Set(value.queueIds).size !== value.queueIds.length ||
        (!value.enabled && value.queueIds.length)
      )
        throw new Error('INVALID_TEAM_CHANGE');
      const change = value as DialerTeamChange;
      const members = await directory(identity, true);
      return transaction(identity, async (client) => {
        try {
          const before = await view(client, identity, members);
          if (
            before.revision !== change.revision ||
            before.directoryVersion !== change.directoryVersion
          )
            throw new Error('TEAM_VIEW_CHANGED');
          const member = members.find((m) => m.id === change.userId);
          if (change.enabled && (!member || !member.canCall))
            throw new Error('TEAM_MEMBER_INELIGIBLE');
          const prior = before.members.find((m) => m.id === change.userId);
          if (!member && !prior) throw new Error('TEAM_MEMBER_INELIGIBLE');
          if (
            prior?.starter &&
            !change.enabled &&
            members.some(
              (known) =>
                known.id === change.userId &&
                known.role === 'admin' &&
                known.canCall,
            )
          )
            throw new Error('INVALID_TEAM_CHANGE');
          if (
            change.enabled &&
            !before.paidSeats &&
            !(prior?.starter && change.userId === identity.userId)
          )
            throw new Error('TEAM_PAID_ACCESS_REQUIRED');
          if (
            change.enabled &&
            !prior?.assigned &&
            before.paidSeats &&
            before.assignedSeats >= before.paidSeats
          )
            throw new Error('TEAM_SEAT_LIMIT');
          if (
            change.queueIds.some(
              (q) => !before.queues.some((known) => known.id === q),
            )
          )
            throw new Error('TEAM_QUEUE_NOT_FOUND');
          const legacyPlan =
            before.plan === 'professional'
              ? 'single'
              : before.plan === 'agency'
                ? 'standard'
                : before.plan === 'enterprise'
                  ? 'power'
                  : null;
          if (change.enabled && before.paidSeats && !legacyPlan)
            throw new Error('TEAM_PAID_ACCESS_REQUIRED');
          if (change.enabled && legacyPlan)
            await client.query(
              `INSERT INTO dialer_team_seats(workspace_id,user_id,plan_code,status) VALUES($1,$2,$3,'active') ON CONFLICT(workspace_id,user_id) DO UPDATE SET status='active',plan_code=EXCLUDED.plan_code,updated_at=clock_timestamp()`,
              [identity.workspaceId, change.userId, legacyPlan],
            );
          else if (!change.enabled)
            await client.query(
              "UPDATE dialer_team_seats SET status='disabled',updated_at=clock_timestamp() WHERE workspace_id=$1 AND user_id=$2",
              [identity.workspaceId, change.userId],
            );
          await client.query(
            'INSERT INTO dialer_team_access(workspace_id,user_id,enabled) VALUES($1,$2,$3) ON CONFLICT(workspace_id,user_id) DO UPDATE SET enabled=EXCLUDED.enabled,updated_at=clock_timestamp()',
            [identity.workspaceId, change.userId, change.enabled],
          );
          const queues = (
            await client.query<{
              queue_id: string;
              version: number;
              policy: InboundQueuePolicy;
            }>(
              'SELECT queue_id,version,policy FROM dialer_routing_queues WHERE workspace_id=$1 ORDER BY queue_id',
              [identity.workspaceId],
            )
          ).rows;
          for (const queue of queues) {
            const included = queue.policy.profiles.find(
              (p) => p.repId === change.userId,
            );
            const selected =
              change.enabled && change.queueIds.includes(queue.queue_id);
            if (Boolean(included) === selected) continue;
            const profiles = queue.policy.profiles.filter(
              (p) => p.repId !== change.userId,
            );
            if (selected)
              profiles.push({
                repId: change.userId,
                skills: included?.skills ?? [],
              });
            const policy = decodeInboundQueuePolicy({
              ...queue.policy,
              policyVersion: 'team-' + randomUUID(),
              profiles,
            });
            await client.query(
              'UPDATE dialer_routing_queues SET version=version+1,policy=$3 WHERE workspace_id=$1 AND queue_id=$2',
              [identity.workspaceId, queue.queue_id, JSON.stringify(policy)],
            );
          }
          let rep = (
            await client.query<{ snapshot: RepCapacityState }>(
              'SELECT snapshot FROM dialer_rep_capacity WHERE workspace_id=$1 AND rep_id=$2',
              [identity.workspaceId, change.userId],
            )
          ).rows[0]?.snapshot;
          if (!rep && change.enabled && change.queueIds.length) {
            rep = (
              await executeRepCapacityOnClient(client, {
                workspaceId: identity.workspaceId,
                capacityId: 'rep:' + hash(change.userId).slice(0, 40),
                operationId: 'team-register:' + randomUUID(),
                expectedVersion: 0,
                action: {
                  type: 'register',
                  repId: change.userId,
                  policy: DEFAULT_REP_POLICY,
                },
              })
            ).state;
          }
          // Never release or rewrite an offering/connecting/unknown/connected owner. Existing work drains safely.
          if (rep)
            await executeRepCapacityOnClient(client, {
              workspaceId: identity.workspaceId,
              capacityId: rep.capacityId,
              operationId: 'team-away:' + randomUUID(),
              expectedVersion: rep.version,
              action: { type: 'readiness', ready: false, endpoints: [] },
            });
          await client.query(
            'INSERT INTO dialer_team_configuration(workspace_id,revision,location_id) VALUES($1,$2,$3) ON CONFLICT(workspace_id) DO UPDATE SET revision=EXCLUDED.revision,location_id=EXCLUDED.location_id,updated_at=clock_timestamp()',
            [identity.workspaceId, before.revision + 1, identity.locationId],
          );
          await client.query(
            'INSERT INTO dialer_team_access_events(workspace_id,revision,actor_id,user_id,enabled,queue_ids) VALUES($1,$2,$3,$4,$5,$6)',
            [
              identity.workspaceId,
              before.revision + 1,
              identity.userId,
              change.userId,
              change.enabled,
              JSON.stringify(change.queueIds),
            ],
          );
          return view(client, identity, members);
        } catch (cause: unknown) {
          throw safeError(cause);
        }
      });
    } catch (cause: unknown) {
      throw safeError(cause);
    }
  };
  const assertCanCall: TeamAccessService['assertCanCall'] = async (
    identity,
  ) => {
    try {
      const members = await directory(identity, false);
      await transaction(identity, async (client) => {
        try {
          const denied = (
            await client.query(
              'SELECT 1 FROM dialer_team_access WHERE workspace_id=$1 AND user_id=$2 AND enabled=false',
              [identity.workspaceId, identity.userId],
            )
          ).rows.length;
          if (denied) throw new Error('TEAM_ACCESS_REVOKED');
          const authority = await commercialAuthority(
            client,
            identity.workspaceId,
          );
          if (authority.subscription) {
            if (
              !authority.subscription.provider_subscription_id ||
              !resolveBillingAccess({
                status: authority.subscription.status,
                paymentFailedAt: authority.subscription.payment_failed_at,
                now: input.now?.() ?? new Date(),
                graceDays: input.paymentGraceDays,
              }).canStartCalls ||
              !authority.paidSeats
            )
              throw new Error('TEAM_PAID_ACCESS_REQUIRED');
            const assigned = (
              await client.query<{ plan_code: string }>(
                "SELECT plan_code FROM dialer_team_seats WHERE workspace_id=$1 AND user_id=$2 AND status='active'",
                [identity.workspaceId, identity.userId],
              )
            ).rows[0];
            if (
              !assigned ||
              (!authority.purchase &&
                !authority.legacyPlanCodes.includes(assigned.plan_code))
            )
              throw new Error('TEAM_PAID_ACCESS_REQUIRED');
            return;
          }
          const grants = (
            await client.query<{ user_id: string }>(
              'SELECT user_id FROM dialer_team_access WHERE workspace_id=$1 AND enabled=true ORDER BY user_id LIMIT 2',
              [identity.workspaceId],
            )
          ).rows;
          if (
            grants.length === 1 &&
            grants[0].user_id === identity.userId &&
            !authority.purchase?.paid_at &&
            members.some(
              (member) =>
                member.id === identity.userId && member.role === 'admin',
            )
          )
            return;
          // An unactivated purchase cannot create a new Starter authority.
          if (
            authority.purchase ||
            grants.length ||
            !members.some(
              (member) =>
                member.id === identity.userId && member.role === 'admin',
            )
          )
            throw new Error('TEAM_PAID_ACCESS_REQUIRED');
          // The first live-directory-verified CRM administrator gets a durable
          // Starter grant. Workspace transaction locking makes this exclusive.
          await client.query(
            'INSERT INTO dialer_team_access(workspace_id,user_id,enabled) VALUES($1,$2,true) ON CONFLICT(workspace_id,user_id) DO UPDATE SET enabled=true,updated_at=clock_timestamp()',
            [identity.workspaceId, identity.userId],
          );
          const revision = (
            await client.query<{ revision: number }>(
              `INSERT INTO dialer_team_configuration(workspace_id,revision,location_id)
               VALUES($1,1,$2)
               ON CONFLICT(workspace_id) DO UPDATE SET revision=dialer_team_configuration.revision+1,
                 location_id=EXCLUDED.location_id,updated_at=clock_timestamp()
               RETURNING revision`,
              [identity.workspaceId, identity.locationId],
            )
          ).rows[0].revision;
          await client.query(
            'INSERT INTO dialer_team_access_events(workspace_id,revision,actor_id,user_id,enabled,queue_ids) VALUES($1,$2,$3,$3,true,$4)',
            [identity.workspaceId, revision, identity.userId, '[]'],
          );
        } catch (cause: unknown) {
          throw safeError(cause);
        }
      });
    } catch (cause: unknown) {
      throw safeError(cause);
    }
  };
  return { read, update, assertCanCall };
};
