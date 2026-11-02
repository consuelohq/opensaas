import { describe, expect, test } from 'bun:test';
import type { Pool } from 'pg';
import {
  createCyclicRecoveryPager,
  readRecoveryBacklog,
  recoveryLagAlerts,
} from './worker-recovery';

type Row = { id: string };
const fixture = (n: number) =>
  Array.from({ length: n }, (_, i) => ({ id: String(i).padStart(5, '0') }));

describe('bounded recovery pages', () => {
  test('visits more than 1000 persistent items without exceeding each page bound', async () => {
    const pager = createCyclicRecoveryPager(64);
    const items = fixture(1205);
    const visited = new Set<string>();
    const limits: number[] = [];
    for (let tick = 0; tick < 23; tick++) {
      const page = await pager(
        'workspace-a:pending',
        async (after, limit) => {
          limits.push(limit);
          return items.filter((item) => item.id > after).slice(0, limit);
        },
        (item: Row) => item.id,
      );
      expect(page.length).toBeLessThanOrEqual(64);
      for (const item of page) visited.add(item.id);
    }
    expect(visited.size).toBe(1205);
    expect(limits.every((value) => value === 64)).toBe(true);
  });

  test('cycles past permanently failing first items; resumes from the start after a restart', async () => {
    const items = fixture(7);
    const makePage = (after: string, limit: number) =>
      Promise.resolve(items.filter((item) => item.id > after).slice(0, limit));
    const pager = createCyclicRecoveryPager(3);
    const ids: string[] = [];
    for (let tick = 0; tick < 4; tick++)
      for (const item of await pager(
        'workspace-a',
        makePage,
        (row: Row) => row.id,
      ))
        ids.push(item.id);
    expect(new Set(ids).size).toBe(7);
    expect(ids.filter((id) => id === '00000').length).toBeGreaterThan(1);
    const restart = createCyclicRecoveryPager(3);
    expect(
      (await restart('workspace-a', makePage, (row: Row) => row.id)).map(
        (row) => row.id,
      ),
    ).toEqual(['00000', '00001', '00002']);
  });

  test('keeps workspace and outbox-status positions independent', async () => {
    const pager = createCyclicRecoveryPager(2);
    const items = fixture(5);
    const read = (after: string, limit: number) =>
      Promise.resolve(items.filter((item) => item.id > after).slice(0, limit));
    const ids = async (key: string) =>
      (await pager(key, read, (row: Row) => row.id)).map((row) => row.id);
    expect(await ids('workspace-1:pending')).toEqual(['00000', '00001']);
    expect(await ids('workspace-1:pending')).toEqual(['00002', '00003']);
    expect(await ids('workspace-2:pending')).toEqual(['00000', '00001']);
    expect(await ids('workspace-1:unknown')).toEqual(['00000', '00001']);
  });

  test('wraps after an exact multiple of the page size', async () => {
    const pager = createCyclicRecoveryPager(3);
    const items = fixture(6);
    const load = async (after: string, limit: number) =>
      items.filter((item) => item.id > after).slice(0, limit);
    const read = async () =>
      (await pager('workspace', load, (row: Row) => row.id)).map(
        (row) => row.id,
      );
    expect(await read()).toEqual(['00000', '00001', '00002']);
    expect(await read()).toEqual(['00003', '00004', '00005']);
    expect(await read()).toEqual(['00000', '00001', '00002']);
  });
});

describe('privacy-safe recovery lag signals', () => {
  test('alerts when pending or uncertain provider effects exceed configured thresholds', () => {
    const alerts = recoveryLagAlerts([
      {
        kind: 'inbound_effect',
        status: 'pending',
        count: 20,
        oldestSeconds: 301,
      },
      {
        kind: 'callback_effect',
        status: 'unknown',
        count: 2,
        oldestSeconds: 601,
      },
      {
        kind: 'outbound_session',
        status: 'unknown',
        count: 1,
        oldestSeconds: 599,
      },
      {
        kind: 'inbound_effect',
        status: 'dispatched',
        count: 0,
        oldestSeconds: 1000,
      },
    ]);
    expect(alerts).toEqual([
      {
        kind: 'inbound_effect',
        status: 'pending',
        count: 20,
        oldestSeconds: 301,
        thresholdSeconds: 300,
      },
      {
        kind: 'callback_effect',
        status: 'unknown',
        count: 2,
        oldestSeconds: 601,
        thresholdSeconds: 600,
      },
    ]);
    expect(JSON.stringify(alerts)).not.toMatch(/workspaceId|callSid|number/);
  });

  test('queries all unresolved provider effects by bound workspace and returns aggregates only', async () => {
    const inputs: unknown[][] = [];
    const sql: string[] = [];
    const pool = {
      query: async (query: string, params: unknown[]) => {
        sql.push(query);
        inputs.push(params);
        return {
          rows: [
            {
              kind: 'inbound_effect',
              status: 'unknown',
              count: '2',
              oldest_seconds: '720',
            },
          ],
        };
      },
    } as unknown as Pool;
    expect(await readRecoveryBacklog(pool, [])).toEqual([]);
    expect(inputs).toHaveLength(0);
    expect(await readRecoveryBacklog(pool, ['private-workspace'])).toEqual([
      {
        kind: 'inbound_effect',
        status: 'unknown',
        count: 2,
        oldestSeconds: 720,
      },
    ]);
    expect(inputs).toEqual([[['private-workspace']]]);
    expect(sql[0]).toContain('workspace_id=ANY($1::text[])');
    expect(sql[0]).toContain('GROUP BY kind,status');
  });
});
