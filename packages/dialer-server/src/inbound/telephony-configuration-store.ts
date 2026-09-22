import { createHash } from 'node:crypto';
import type { Pool } from 'pg';
import type { InboundNumber, InboundEndpoint } from './telephony-contracts';
import { withInboundTransaction } from './postgres-journal';

// Changing an address/account/policy while an effect is in flight would reinterpret its identity.
export const protectTelephonyConfiguration = async (
  pool: Pool,
  config: {
    numbers: readonly InboundNumber[];
    endpoints: readonly InboundEndpoint[];
  },
) => {
  try {
    const existing = (
      await pool.query<{ workspace_id: string }>(
        'SELECT workspace_id FROM dialer_telephony_configuration',
      )
    ).rows;
    const workspaces = new Set([
      ...existing.map((row) => row.workspace_id),
      ...config.numbers.map((number) => number.workspaceId),
    ]);
    for (const workspaceId of workspaces)
      await withInboundTransaction(pool, workspaceId, async (client) => {
        try {
          const numbers = config.numbers
            .filter((number) => number.workspaceId === workspaceId)
            .map(({ enabled, ...identity }) => identity)
            .sort((a, b) => a.numberId.localeCompare(b.numberId));
          const endpoints = config.endpoints
            .filter((endpoint) => endpoint.workspaceId === workspaceId)
            .slice()
            .sort((a, b) =>
              (a.repId + ':' + a.endpointId).localeCompare(
                b.repId + ':' + b.endpointId,
              ),
            );
          const digest = createHash('sha256')
            .update(JSON.stringify({ numbers, endpoints }))
            .digest('hex');
          const previous = (
            await client.query<{ digest: string }>(
              'SELECT digest FROM dialer_telephony_configuration WHERE workspace_id=$1',
              [workspaceId],
            )
          ).rows[0];
          if (previous?.digest === digest) return;
          const active = await client.query(
            `SELECT 1 WHERE EXISTS(SELECT 1 FROM dialer_telephony_sessions WHERE workspace_id=$1 AND mode<>'ended')
   OR EXISTS(SELECT 1 FROM dialer_telephony_voicemail WHERE workspace_id=$1 AND deleted_at IS NULL)
   OR EXISTS(SELECT 1 FROM dialer_rep_capacity WHERE workspace_id=$1 AND snapshot->'owner'<>'null'::jsonb)`,
            [workspaceId],
          );
          if (previous && active.rowCount)
            throw new Error(
              'Drain media, capacity and retained voicemail before changing telephony identity configuration',
            );
          if (!numbers.length) {
            await client.query(
              'DELETE FROM dialer_telephony_configuration WHERE workspace_id=$1',
              [workspaceId],
            );
            return;
          }
          await client.query(
            'INSERT INTO dialer_telephony_configuration(workspace_id,digest) VALUES($1,$2) ON CONFLICT(workspace_id) DO UPDATE SET digest=EXCLUDED.digest',
            [workspaceId, digest],
          );
        } catch (cause: unknown) {
          if (cause instanceof Error) throw cause;
          throw new Error('Async operation rejected with a non-Error cause', {
            cause,
          });
        }
      });
  } catch (cause: unknown) {
    if (cause instanceof Error) throw cause;
    throw new Error('Async operation rejected with a non-Error cause', {
      cause,
    });
  }
};
