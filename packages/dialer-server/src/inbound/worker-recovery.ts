import type { Pool } from 'pg';

/**
 * One bounded keyset page per worker cycle. All cursors are scoped to the
 * worker instance, so a restart replays safely from the beginning instead
 * of skipping rows that may still need recovery.
 */
export const createCyclicRecoveryPager = (pageSize = 64) => {
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 1000)
    throw new Error('Recovery page size must be between 1 and 1000');
  const cursors = new Map<string, string>();
  return async <T>(
    key: string,
    load: (afterId: string, limit: number) => Promise<readonly T[]>,
    id: (row: T) => string,
  ): Promise<readonly T[]> => {
    const after = cursors.get(key) ?? '';
    let page = await load(after, pageSize);
    const wrapped = page.length === 0 && Boolean(after);
    if (wrapped) page = await load('', pageSize);
    if (page.length > pageSize)
      throw new Error('Recovery query exceeded the bounded page size');
    const last = page[page.length - 1];
    if (page.length === pageSize && last) {
      const next = id(last);
      if (!next || (after && !wrapped && next <= after))
        throw new Error('Recovery page cursor did not advance');
      cursors.set(key, next);
    } else {
      cursors.delete(key);
    }
    return page;
  };
};

export type RecoveryBacklog = {
  kind: 'inbound_effect' | 'callback_effect' | 'outbound_session';
  status: string;
  count: number;
  oldestSeconds: number;
};
export type RecoveryLagAlert = RecoveryBacklog & { thresholdSeconds: number };

/** Conservative thresholds: warn on stuck commands, never infer failure. */
export const recoveryLagAlerts = (
  rows: readonly RecoveryBacklog[],
): RecoveryLagAlert[] =>
  rows.flatMap((row) => {
    const thresholdSeconds =
      row.status === 'unknown' || row.status === 'creating' ? 600 : 300;
    return row.count > 0 && row.oldestSeconds >= thresholdSeconds
      ? [{ ...row, thresholdSeconds }]
      : [];
  });

/** Aggregate only: no tenant IDs, call SIDs, phone numbers or payloads. */
export const readRecoveryBacklog = async (
  pool: Pool,
  workspaceIds: readonly string[],
): Promise<RecoveryBacklog[]> => {
  if (workspaceIds.length === 0) return [];
  try {
    const result = await pool.query<{
      kind: RecoveryBacklog['kind'];
      status: string;
      count: number;
      oldest_seconds: number;
    }>(
      `SELECT kind,status,count(*)::integer AS count,
            greatest(0,extract(epoch FROM clock_timestamp() - min(since))::integer) AS oldest_seconds
     FROM (
       SELECT 'inbound_effect'::text AS kind,status,updated_at AS since
       FROM dialer_telephony_effects
       WHERE workspace_id=ANY($1::text[]) AND status IN ('pending','dispatched','unknown')
       UNION ALL
       SELECT 'callback_effect'::text AS kind,status,updated_at AS since
       FROM dialer_callback_effects
       WHERE workspace_id=ANY($1::text[]) AND status IN ('pending','dispatched','unknown')
       UNION ALL
       SELECT 'outbound_session'::text AS kind,status,created_at AS since
       FROM dialer_telephony_outbound
       WHERE workspace_id=ANY($1::text[]) AND status IN ('creating','unknown')
     ) backlog
     GROUP BY kind,status ORDER BY kind,status`,
      [[...workspaceIds]],
    );
    return result.rows.map((row) => ({
      kind: row.kind,
      status: row.status,
      count: Number(row.count),
      oldestSeconds: Number(row.oldest_seconds),
    }));
  } catch (cause: unknown) {
    throw new Error('Recovery backlog query failed', { cause });
  }
};
