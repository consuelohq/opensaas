import assert from 'node:assert/strict';
import { Cause, Runtime } from 'effect';
import { createHmac, randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
import type Redis from 'ioredis';
import { Hono } from 'hono';
import type { RepCapacityState } from '@consuelo/dialer';
import { createLeadConnectorInboundOperatorApi } from '@consuelo/lead-connector/embed';
import {
  createAuthenticationMiddleware,
  type DialerVariables,
} from '../middleware/auth';
import { createInboundRoutes } from '../routes/inbound';
import { createInboundOperatorRoutes } from '../routes/inbound-operator';
import { createInboundOperator } from '../inbound/operator';
import { createInboundTelephony } from '../inbound/telephony';
import { createPostgresRepCapacity } from '../inbound/rep-capacity';
import { createPostgresInboundRouting } from '../inbound/routing';
import type {
  CarrierCall,
  InboundCarrier,
  InboundEndpoint,
  InboundNumber,
} from '../inbound/telephony-contracts';
import {
  createRepCampaignPlan,
  inspectCapacityInvariants,
} from './rep-campaign-plan';

// Imported only by the disposable lab. No provider client, deployment URL or credentials.
export const runRepCampaign = async ({
  pool,
  redis,
  seed,
}: {
  pool: Pool;
  redis: Redis;
  seed: number;
}) => {
  const stages = [];
  for (const reps of [1, 2, 5, 20]) {
    const plan = createRepCampaignPlan(seed, reps);
    const workspaceId = 'qa-' + randomUUID(),
      foreignWorkspace = workspaceId + '-foreign';
    let time = Date.UTC(2026, 10, 6, 12),
      offers = 0,
      redirects = 0;
    const clock = () => new Date(time).toISOString();
    const calls = new Map<string, CarrierCall>();
    const conferences = new Map<string, Set<string>>();
    const adapterJournal: { operation: string; actor: string }[] = [];
    const carrier: InboundCarrier = {
      offer: async (input) => {
        const call = {
          sid: workspaceId + '-rep-call-' + ++offers,
          accountSid: 'qa-account',
          status: 'in-progress',
        };
        calls.set(call.sid, call);
        adapterJournal.push({ operation: 'offer', actor: input.to });
        return call;
      },
      redirect: async (sid, twiml) => {
        redirects++;
        const name = twiml.match(/<Conference[^>]*>([^<]+)<\/Conference>/)?.[1];
        assert.ok(name, 'Bridge must name a conference');
        const participants = conferences.get(name) ?? new Set<string>();
        participants.add(sid);
        conferences.set(name, participants);
        adapterJournal.push({ operation: 'redirect', actor: sid });
      },
      end: async (sid) => {
        const call = calls.get(sid);
        assert.ok(call, 'Cannot end an unknown synthetic leg');
        call.status = 'completed';
        adapterJournal.push({ operation: 'end', actor: sid });
      },
      call: async (sid) => {
        const call = calls.get(sid);
        assert.ok(call, 'Synthetic provider has no such call');
        return call;
      },
      participants: async (name) =>
        [...(conferences.get(name) ?? [])]
          .filter((sid) => calls.get(sid)?.status === 'in-progress')
          .map((callSid) => ({ callSid, muted: false, hold: false })),
      recording: async () => {
        throw new Error('Recording is forbidden in QA0');
      },
      deleteRecording: async () => {
        throw new Error('Recording deletion is forbidden in QA0');
      },
    };
    const numbers: InboundNumber[] = [workspaceId, foreignWorkspace].map(
      (id, i) => ({
        numberId: id + '-number',
        workspaceId: id,
        queueId: 'sales',
        accountSid: 'qa-account',
        did: 'fixture-did-' + i,
        enabled: true,
        maxActiveRequests: 100,
        voicemail: null,
      }),
    );
    const endpoints: InboundEndpoint[] = [
      ...plan.actors.map((repId) => ({ workspaceId, repId })),
      { workspaceId: foreignWorkspace, repId: 'foreign-rep' },
    ].map((identity) => ({
      ...identity,
      endpointId: 'browser',
      kind: 'browser',
      address: identity.repId,
    }));
    const options = {
      pool,
      numbers,
      endpoints,
      carrier,
      publicUrl: 'https://voice.invalid',
      authToken: 'local-only-signing-fixture',
      clock,
    };
    let service = createInboundTelephony(options);
    const operator = createInboundOperator(options, service);
    const capacity = createPostgresRepCapacity(pool, { clock });
    const routing = createPostgresInboundRouting(pool, { clock });
    const actors = endpoints.map((e) => ({
      workspaceId: e.workspaceId,
      userId: e.repId,
    }));
    for (const identity of actors)
      await capacity.execute({
        workspaceId: identity.workspaceId,
        capacityId: identity.userId,
        operationId: 'register-' + identity.userId,
        expectedVersion: 0,
        action: {
          type: 'register',
          repId: identity.userId,
          policy: {
            offerMilliseconds: 12000,
            presenceMilliseconds: 120000,
            wrapUpMilliseconds: 500,
            cooldownMilliseconds: 1000,
            escalationMilliseconds: 30000,
          },
        },
      });
    for (const id of [workspaceId, foreignWorkspace])
      await routing.configureQueue(
        {
          schemaVersion: 1,
          policyVersion: 'qa-fifo',
          workspaceId: id,
          queueId: 'sales',
          timezone: 'UTC',
          weekly: Array.from({ length: 7 }, (_, day) => ({
            day: day as 0 | 1 | 2 | 3 | 4 | 5 | 6,
            startMinute: 0,
            endMinute: 1440,
          })),
          closedDates: [],
          emergencyClosed: false,
          maxWaitMilliseconds: 120000,
          maxOffers: 2,
          reofferMilliseconds: 1000,
          profiles: actors
            .filter((a) => a.workspaceId === id)
            .map((a) => ({ repId: a.userId, skills: [] })),
        },
        0,
      );
    // Actual middleware, explicit local fixture authenticator; not a production OAuth proof.
    const tokens = new Map<string, { workspaceId: string; userId: string }>(
      actors.map((a) => [randomUUID(), a]),
    );
    const app = new Hono<{ Variables: DialerVariables }>();
    let transportFailure: unknown;
    app.route(
      '/',
      createInboundRoutes({
        ...service,
        handle: async (...args: Parameters<typeof service.handle>) => {
          try {
            return await service.handle(...args);
          } catch (cause: unknown) {
            transportFailure = cause;
            throw cause;
          }
        },
      }),
    );
    app.use(
      '/v1/*',
      createAuthenticationMiddleware({
        authenticate: async (request) =>
          tokens.get(
            request.headers.get('authorization')?.replace(/^Bearer /, '') ?? '',
          ) ?? null,
      }),
    );
    app.route('/', createInboundOperatorRoutes(operator));
    const http = Bun.serve({
      hostname: '127.0.0.1',
      port: 0,
      fetch: app.fetch,
    });
    const baseUrl = 'http://127.0.0.1:' + http.port;
    try {
      const clients = [...tokens].map(([token, identity]) => {
        const api = createLeadConnectorInboundOperatorApi({
          baseUrl: 'https://voice.invalid',
          fetch: (input, init) =>
            fetch(baseUrl + new URL(String(input)).pathname, init),
        });
        api.setSessionToken(token);
        return { identity, api };
      });
      assert.equal(
        (await fetch(baseUrl + '/v1/inbound/operator/snapshot')).status,
        401,
      );
      for (const client of clients)
        await client.api.setReadiness({
          ready: true,
          endpoints: [{ endpointId: 'browser', kind: 'browser' }],
        });
      const local = clients.filter(
          (c) => c.identity.workspaceId === workspaceId,
        ),
        foreign = clients.find(
          (c) => c.identity.workspaceId === foreignWorkspace,
        )!;
      assert.equal((await foreign.api.getSnapshot()).offers.length, 0);
      const redisKey = 'qa:actors:' + workspaceId;
      await redis.set(redisKey, JSON.stringify(plan.actors));
      const scheduled = [];
      for (const arrival of plan.arrivals) {
        time = Date.UTC(2026, 10, 6, 12) + arrival.at;
        const facts = {
          AccountSid: 'qa-account',
          CallSid: workspaceId + '-' + arrival.caller,
          Direction: 'inbound',
          To: numbers[0]!.did,
        };
        calls.set(facts.CallSid, {
          sid: facts.CallSid,
          accountSid: 'qa-account',
          status: 'in-progress',
        });
        const path = '/webhooks/twilio/inbound/' + numbers[0]!.numberId;
        const signature = createHmac('sha1', options.authToken)
          .update(
            options.publicUrl +
              path +
              Object.keys(facts)
                .sort()
                .map((k) => k + facts[k as keyof typeof facts])
                .join(''),
          )
          .digest('base64');
        const response = await fetch(baseUrl + path, {
          method: 'POST',
          body: new URLSearchParams(facts),
          headers: { 'x-twilio-signature': signature },
        });
        assert.equal(response.status, 200, describeFailure(transportFailure));
        scheduled.push({ caller: arrival.caller, at: arrival.at });
      }
      const tick = async () => {
        try {
          const result = await service.tick();
          assert.equal(
            result.failures,
            0,
            'Telephony worker must report zero failures',
          );
        } catch (cause: unknown) {
          throw new Error('Campaign worker tick failed', { cause });
        }
      };
      for (let i = 0; i < reps + 2; i++) await tick();
      const readCapacity = async () => {
        try {
          return (
            await pool.query<{ snapshot: RepCapacityState }>(
              'SELECT snapshot FROM dialer_rep_capacity WHERE workspace_id=$1 ORDER BY capacity_id',
              [workspaceId],
            )
          ).rows.map((r) => r.snapshot);
        } catch (cause: unknown) {
          throw new Error('Campaign capacity oracle read failed', { cause });
        }
      };
      const offered = await readCapacity();
      assert.equal(offered.filter((s) => s.owner).length, reps);
      assert.ok(inspectCapacityInvariants(offered).valid);
      let duplicateAcceptsRejected = 0;
      const beforeAccept = performance.now();
      for (const { api, identity } of local) {
        const snapshot = await api.getSnapshot();
        assert.equal(snapshot.rep.repId, identity.userId);
        assert.equal(snapshot.offers.length, 1);
        const offer = snapshot.offers[0]!;
        const input = {
          assignmentId: offer.assignmentId,
          generation: offer.generation,
          endpointId: 'browser',
        };
        const results = await Promise.all([
          api.acceptOffer({ ...input, attemptId: 'first-' + identity.userId }),
          api.acceptOffer({ ...input, attemptId: 'second-' + identity.userId }),
        ]);
        assert.equal(results.filter((r) => r.accepted).length, 1);
        assert.equal(results.filter((r) => r.status === 'stale').length, 1);
        duplicateAcceptsRejected++;
        const foreignAttempt = await foreign.api.acceptOffer({
          ...input,
          attemptId: 'foreign-' + identity.userId,
        });
        assert.equal(foreignAttempt.accepted, false);
      }
      for (let i = 0; i < 3; i++) await tick();
      const connected = await readCapacity();
      assert.equal(
        connected.filter((s) => s.owner?.phase === 'connected').length,
        reps,
      );
      assert.ok(inspectCapacityInvariants(connected).valid);
      assert.equal(offers, reps);
      assert.equal(redirects, reps * 2);
      const acceptToConfirmedMilliseconds = performance.now() - beforeAccept;
      // Losing an ephemeral index must not erase committed owners or create new effects.
      await redis.del(redisKey);
      assert.equal(await redis.get(redisKey), null);
      service = createInboundTelephony(options);
      await tick();
      assert.equal(offers, reps);
      assert.equal(redirects, reps * 2);
      const recovered = createPostgresRepCapacity(pool, { clock });
      for (const state of await readCapacity())
        assert.deepEqual(
          await recovered.replay(workspaceId, state.capacityId),
          state,
        );
      for (const client of local)
        await client.api.setReadiness({ ready: false, endpoints: [] });
      // Synthetic provider fact: both legs end; no real carrier API exists in this adapter.
      for (const call of calls.values()) call.status = 'completed';
      for (let i = 0; i < 3; i++) await tick();
      time += 1000;
      for (let i = 0; i < 3; i++) await tick();
      const final = await readCapacity();
      assert.ok(final.every((s) => s.owner === null));
      const effects = (
        await pool.query<{ status: string }>(
          'SELECT status FROM dialer_telephony_effects WHERE workspace_id=$1',
          [workspaceId],
        )
      ).rows;
      assert.ok(
        effects.every((e) => ['succeeded', 'failed'].includes(e.status)),
        'Every owned carrier command must reconcile',
      );
      const requests = (
        await pool.query<{ state: string }>(
          "SELECT snapshot->>'state' AS state FROM dialer_inbound_entities WHERE workspace_id=$1 AND kind='request'",
          [workspaceId],
        )
      ).rows;
      assert.equal(requests.length, reps + 1);
      assert.ok(
        requests.every((r) =>
          ['completed', 'abandoned', 'provider_failure'].includes(r.state),
        ),
      );
      assert.ok([...calls.values()].every((c) => c.status === 'completed'));
      assert.equal((await foreign.api.getSnapshot()).rep.assignment, null);
      stages.push({
        reps,
        callers: plan.arrivals.length,
        authenticatedActors: local.length,
        connected: reps,
        duplicateAcceptsRejected,
        seed,
        schedule: scheduled,
        scheduleDigest: plan.digest,
        level: 'local-http-postgres-redis',
        transport: 'loopback-http',
        authentication:
          'explicit-fixture-authenticator-with-production-middleware',
        provider: 'injected-no-network-adapter',
        effects: { offers, redirects, operations: adapterJournal.length },
        acceptToConfirmedMilliseconds,
        clean: true,
      });
    } finally {
      http.stop(true);
    }
  }
  return {
    level: 'local-http-postgres-redis',
    stages,
    limitations: [
      'No production OAuth, browser media, PSTN audio, notification or 20-seat throughput claim.',
      'Input schedule is seeded; database race winners follow committed authority and may vary.',
      'QA0 is a fixture/oracle smoke; stress, fault combinations and bounded soak are separate execution lanes.',
    ],
  };
};

const describeFailure = (error: unknown): string => {
  if (Runtime.isFiberFailure(error))
    return describeFailure(Cause.squash(error[Runtime.FiberFailureCauseId]));
  return error instanceof Error
    ? (error.stack ?? error.message) +
        (error.cause ? '\n' + describeFailure(error.cause) : '')
    : String(error);
};
