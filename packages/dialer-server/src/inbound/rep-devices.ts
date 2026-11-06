import { normalizePhone } from '@consuelo/contacts';
import type { Pool, PoolClient } from 'pg';
import { randomUUID } from 'node:crypto';
import type { DialerIdentity } from '../contracts';
import type { RepCapacityState } from '@consuelo/dialer';
import type { CallbackRecipientCipher } from './callback-recipient-cipher';
import type { InboundEndpoint } from './telephony-contracts';
import { withInboundTransaction } from './postgres-journal';
import { executeRepCapacityOnClient } from './rep-capacity';

export const REP_DEVICES_MIGRATION_ID = '20261106_017_rep_answering_devices';
export const CREATE_REP_DEVICES_SQL = `CREATE TABLE IF NOT EXISTS dialer_rep_devices (
 workspace_id text NOT NULL, rep_id text NOT NULL, revision integer NOT NULL CHECK(revision>0),
 phone_ciphertext text, updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(workspace_id,rep_id))`;
export type RepDeviceDirectory = {
  read: (
    client: Pick<PoolClient, 'query'>,
    workspaceId: string,
    repId: string,
  ) => Promise<{ revision: number; endpoints: InboundEndpoint[] }>;
  update: (identity: DialerIdentity, raw: unknown) => Promise<void>;
};
export const createRepDeviceDirectory = (options: {
  pool: Pool;
  endpoints: readonly InboundEndpoint[];
  cipher?: CallbackRecipientCipher;
  clock?: () => string;
}): RepDeviceDirectory => {
  const read: RepDeviceDirectory['read'] = async (
    client,
    workspaceId,
    repId,
  ) => {
    try {
      const row = (
        await client.query<{
          revision: number;
          phone_ciphertext: string | null;
        }>(
          'SELECT revision,phone_ciphertext FROM dialer_rep_devices WHERE workspace_id=$1 AND rep_id=$2',
          [workspaceId, repId],
        )
      ).rows[0];
      const seeded = options.endpoints.filter(
        (e) => e.workspaceId === workspaceId && e.repId === repId,
      );
      const browser = seeded.filter((e) => e.kind === 'browser');
      const endpoints: InboundEndpoint[] = browser.length
        ? [...browser]
        : [
            {
              workspaceId,
              repId,
              endpointId: 'web:' + repId,
              kind: 'browser',
              address: repId,
            },
          ];
      if (!row) endpoints.push(...seeded.filter((e) => e.kind === 'phone'));
      else if (row.phone_ciphertext) {
        if (!options.cipher)
          throw new Error('Answering phone encryption is unavailable');
        endpoints.push({
          workspaceId,
          repId,
          endpointId: 'personal-phone:' + repId,
          kind: 'phone',
          address: options.cipher.decrypt(
            JSON.stringify(['rep-device', workspaceId, repId]),
            row.phone_ciphertext,
          ),
          configurationSource: 'self',
        });
      }
      return { revision: row?.revision ?? 0, endpoints };
    } catch (cause: unknown) {
      throw new Error('Could not read answering devices', { cause });
    }
  };
  const update: RepDeviceDirectory['update'] = async (identity, raw) => {
    try {
      if (!raw || typeof raw !== 'object' || Array.isArray(raw))
        throw new Error('Invalid device settings');
      const input = raw as Record<string, unknown>;
      const destination = input.phone;
      const normalized =
        typeof destination === 'string' ? normalizePhone(destination) : null;
      if (
        Object.keys(input).some((k) => !['revision', 'phone'].includes(k)) ||
        !Number.isSafeInteger(input.revision) ||
        Number(input.revision) < 0 ||
        Number(input.revision) >= 2147483647 ||
        (destination !== null && !normalized)
      )
        throw new Error(
          'Use an international phone number and current settings revision',
        );
      if (normalized && !options.cipher)
        throw new Error('Answering phone encryption is unavailable');
      await withInboundTransaction(
        options.pool,
        identity.workspaceId,
        async (client) => {
          try {
            const rep = (
              await client.query<{ snapshot: RepCapacityState }>(
                'SELECT snapshot FROM dialer_rep_capacity WHERE workspace_id=$1 AND rep_id=$2 FOR UPDATE',
                [identity.workspaceId, identity.userId],
              )
            ).rows[0]?.snapshot;
            if (!rep)
              throw new Error('Rep is not provisioned for this workspace');
            if (rep.owner)
              throw new Error(
                'Finish the call and wrap-up before editing answering devices',
              );
            const current = await read(
              client,
              identity.workspaceId,
              identity.userId,
            );
            if (current.revision !== input.revision)
              throw new Error('Device settings changed. Refresh before saving');
            const encrypted = normalized
              ? options.cipher!.encrypt(
                  JSON.stringify([
                    'rep-device',
                    identity.workspaceId,
                    identity.userId,
                  ]),
                  normalized,
                )
              : null;
            await client.query(
              `INSERT INTO dialer_rep_devices(workspace_id,rep_id,revision,phone_ciphertext) VALUES($1,$2,$3,$4) ON CONFLICT(workspace_id,rep_id) DO UPDATE SET revision=EXCLUDED.revision,phone_ciphertext=EXCLUDED.phone_ciphertext,updated_at=clock_timestamp()`,
              [
                identity.workspaceId,
                identity.userId,
                current.revision + 1,
                encrypted,
              ],
            );
            await executeRepCapacityOnClient(
              client,
              {
                workspaceId: identity.workspaceId,
                capacityId: rep.capacityId,
                expectedVersion: rep.version,
                operationId: 'device-change:' + randomUUID(),
                action: { type: 'readiness', ready: false, endpoints: [] },
              },
              { clock: options.clock },
            );
          } catch (cause: unknown) {
            throw new Error('Answering device change rejected', { cause });
          }
        },
      );
    } catch (cause: unknown) {
      throw new Error('Could not save answering devices', { cause });
    }
  };
  return { read, update };
};
