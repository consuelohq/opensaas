import { describe, expect, it } from 'bun:test';

import { RedisParallelStore } from './redis-parallel-store';
import type { ParallelGroup } from '../../types';

class FakeRedis {
  readonly values = new Map<string, string>();

  async set(
    key: string,
    value: string,
    ...args: unknown[]
  ): Promise<string | null> {
    const nx = args.includes('NX');
    if (nx && this.values.has(key)) return null;
    this.values.set(key, value);
    return 'OK';
  }

  async get(key: string): Promise<string | null> {
    return this.values.get(key) ?? null;
  }

  async del(...keys: string[]): Promise<number> {
    let removed = 0;
    for (const key of keys) removed += this.values.delete(key) ? 1 : 0;
    return removed;
  }

  async eval(
    script: string,
    numberOfKeys: number,
    ...args: unknown[]
  ): Promise<number> {
    const keys = args.slice(0, numberOfKeys).map(String);
    const values = args.slice(numberOfKeys).map(String);
    if (script.includes('register-call')) {
      const raw = this.values.get(keys[0]);
      if (!raw) return 0;
      const group = JSON.parse(raw) as ParallelGroup;
      const call = JSON.parse(values[0]) as ParallelGroup['calls'][number];
      if (
        !group.calls.some((candidate) => candidate.callSid === call.callSid)
      ) {
        group.calls.push(call);
      }
      this.values.set(keys[0], JSON.stringify(group));
      this.values.set(keys[1], values[1]);
      return 1;
    }
    if (script.includes('claim-telemetry')) {
      const raw = this.values.get(keys[0]);
      if (!raw) return 0;
      const group = JSON.parse(raw) as ParallelGroup;
      if (group.telemetryEmittedAt) return 0;
      group.telemetryEmittedAt = values[0];
      this.values.set(keys[0], JSON.stringify(group));
      return 1;
    }
    if (script.includes('release-lock')) {
      if (this.values.get(keys[0]) !== values[0]) return 0;
      this.values.delete(keys[0]);
      return 1;
    }
    return 0;
  }
}

const group: ParallelGroup = {
  groupId: 'group-1',
  conferenceName: 'conference-1',
  status: 'dialing',
  winnerSid: null,
  calls: [],
  workspaceId: 'workspace-1',
  queueId: 'queue-1',
  userId: 'user-1',
  createdAt: '2026-07-24T00:00:00.000Z',
  profile: {
    id: 'balanced',
    fanout: 1,
    staggerMs: 0,
    amdPolicy: 'human-or-unknown',
    terminationPolicy: 'winner-take-all',
  },
  resolverReason: 'test',
  cleanupFailures: [],
};

describe('RedisParallelStore', () => {
  it('registers calls and reverse mappings atomically and cleans the full group', async () => {
    const redis = new FakeRedis();
    const store = new RedisParallelStore(redis);
    await store.setGroup(group.groupId, JSON.stringify(group), 60);
    await store.registerCall(
      group.groupId,
      {
        callSid: 'call-1',
        customerNumber: '+15550100000',
        fromNumber: '+15550200000',
        position: 1,
        status: 'dialing',
        dialStartedAt: '2026-07-24T00:00:00.000Z',
      },
      60,
    );
    expect(await store.getCallMapping('call-1')).toBe(group.groupId);
    expect(
      JSON.parse((await store.getGroup(group.groupId)) ?? '{}').calls,
    ).toHaveLength(1);
    await store.deleteGroup(group.groupId);
    expect(await store.getGroup(group.groupId)).toBeNull();
    expect(await store.getCallMapping('call-1')).toBeNull();
  });

  it('claims one winner and one telemetry emission and serializes group operations', async () => {
    const redis = new FakeRedis();
    const store = new RedisParallelStore(redis, { lockRetryMs: 1 });
    await store.setGroup(group.groupId, JSON.stringify(group), 60);
    expect(await store.setWinnerIfAbsent(group.groupId, 'call-1', 60)).toBe(
      true,
    );
    expect(await store.setWinnerIfAbsent(group.groupId, 'call-2', 60)).toBe(
      false,
    );
    expect(await store.getWinner(group.groupId)).toBe('call-1');
    expect(
      await store.claimTelemetryEmission(
        group.groupId,
        '2026-07-24T00:01:00.000Z',
        60,
      ),
    ).toBe(true);
    expect(
      await store.claimTelemetryEmission(
        group.groupId,
        '2026-07-24T00:02:00.000Z',
        60,
      ),
    ).toBe(false);

    let active = 0;
    let maximum = 0;
    await Promise.all([
      store.withGroupLock(group.groupId, async () => {
        active += 1;
        maximum = Math.max(maximum, active);
        await Bun.sleep(4);
        active -= 1;
      }),
      store.withGroupLock(group.groupId, async () => {
        active += 1;
        maximum = Math.max(maximum, active);
        active -= 1;
      }),
    ]);
    expect(maximum).toBe(1);
  });
});
