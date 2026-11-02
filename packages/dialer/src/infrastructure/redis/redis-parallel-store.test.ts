import { describe, expect, it } from 'bun:test';
import { Effect } from 'effect';

import { RedisParallelStore } from './redis-parallel-store';
import { createParallelStateStoreLayer } from '../memory/parallel-state-store';
import { ParallelStateStore } from '../../ports/parallel-state-store';
import type { ParallelGroup } from '../../types';

class FakeRedis {
  readonly values = new Map<string, string>();
  readonly expirations = new Map<string, number>();

  private expireIfNeeded(key: string): void {
    const expiresAt = this.expirations.get(key);
    if (expiresAt !== undefined && expiresAt <= Date.now()) {
      this.values.delete(key);
      this.expirations.delete(key);
    }
  }

  async set(
    key: string,
    value: string,
    ...args: unknown[]
  ): Promise<string | null> {
    this.expireIfNeeded(key);
    const nx = args.includes('NX');
    if (nx && this.values.has(key)) return null;
    this.values.set(key, value);
    const pxIndex = args.indexOf('PX');
    const exIndex = args.indexOf('EX');
    if (pxIndex >= 0) {
      this.expirations.set(key, Date.now() + Number(args[pxIndex + 1]));
    } else if (exIndex >= 0) {
      this.expirations.set(key, Date.now() + Number(args[exIndex + 1]) * 1_000);
    } else {
      this.expirations.delete(key);
    }
    return 'OK';
  }

  async get(key: string): Promise<string | null> {
    this.expireIfNeeded(key);
    return this.values.get(key) ?? null;
  }

  async del(...keys: string[]): Promise<number> {
    let removed = 0;
    for (const key of keys) {
      this.expireIfNeeded(key);
      removed += this.values.delete(key) ? 1 : 0;
      this.expirations.delete(key);
    }
    return removed;
  }

  async eval(
    script: string,
    numberOfKeys: number,
    ...args: unknown[]
  ): Promise<number> {
    const keys = args.slice(0, numberOfKeys).map(String);
    const values = args.slice(numberOfKeys).map(String);
    if (script.includes('fenced-set-group')) {
      if ((await this.get(keys[0]!)) !== values[0]) return -1;
      await this.set(keys[1]!, values[1]!, 'EX', Number(values[2]));
      return 1;
    }
    if (script.includes('fenced-claim-winner')) {
      if ((await this.get(keys[0]!)) !== values[0]) return -1;
      return (await this.set(keys[1]!, values[1]!, 'EX', Number(values[2]), 'NX')) === 'OK' ? 1 : 0;
    }
    if (script.includes('fenced-set-mapping')) {
      if ((await this.get(keys[0]!)) !== values[0]) return -1;
      await this.set(keys[1]!, values[1]!, 'EX', Number(values[2]));
      return 1;
    }
    if (script.includes('fenced-delete-group')) {
      if ((await this.get(keys[0]!)) !== values[0]) return -1;
      await this.del(...keys.slice(1));
      return 1;
    }
    if (script.includes('register-call')) {
      if (keys.length > 2 && (await this.get(keys[2]!)) !== values[3]) return -1;
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
      if (keys.length > 1 && (await this.get(keys[1]!)) !== values[2]) return -1;
      const raw = this.values.get(keys[0]);
      if (!raw) return 0;
      const group = JSON.parse(raw) as ParallelGroup;
      if (group.telemetryEmittedAt) return 0;
      group.telemetryEmittedAt = values[0];
      this.values.set(keys[0], JSON.stringify(group));
      return 1;
    }
    if (script.includes('release-lock')) {
      if ((await this.get(keys[0])) !== values[0]) return 0;
      this.values.delete(keys[0]);
      this.expirations.delete(keys[0]);
      return 1;
    }
    if (script.includes('renew-lock')) {
      if ((await this.get(keys[0])) !== values[0]) return 0;
      this.expirations.set(keys[0], Date.now() + Number(values[1]));
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

  it('renews an owned group lock while a long operation is running', async () => {
    const redis = new FakeRedis();
    const store = new RedisParallelStore(redis, {
      lockRetryMs: 1,
      lockTimeoutMs: 500,
      lockTtlMs: 50,
    });
    let active = 0;
    let maximum = 0;

    await Promise.all([
      store.withGroupLock(group.groupId, async () => {
        active += 1;
        maximum = Math.max(maximum, active);
        await Bun.sleep(180);
        active -= 1;
      }),
      (async () => {
        await Bun.sleep(80);
        await store.withGroupLock(group.groupId, async () => {
          active += 1;
          maximum = Math.max(maximum, active);
          active -= 1;
        });
      })(),
    ]);

    expect(maximum).toBe(1);
  });

  it('deletes known group keys when the persisted group JSON is malformed', async () => {
    const redis = new FakeRedis();
    const store = new RedisParallelStore(redis);
    await store.setGroup(group.groupId, '{malformed', 60);
    await store.setWinnerIfAbsent(group.groupId, 'call-1', 60);

    await expect(store.deleteGroup(group.groupId)).resolves.toBeUndefined();
    expect(await store.getGroup(group.groupId)).toBeNull();
    expect(await store.getWinner(group.groupId)).toBeNull();
  });
});

describe('RedisParallelStore lock fencing', () => {
  const lockKey = 'consuelo:dialer:parallel:lock:group-1';

  it('refuses stale group writes after another worker takes the lock', async () => {
    const redis = new FakeRedis();
    const store = new RedisParallelStore(redis);
    await store.setGroup(group.groupId, JSON.stringify(group), 60);
    await expect(store.withGroupLock(group.groupId, async () => {
      redis.values.set(lockKey, 'replacement-worker-token');
      await store.setGroup(group.groupId, '{"status":"stale-worker"}', 60);
    })).rejects.toThrow(/lock|ownership|lease/i);
    expect(JSON.parse((await store.getGroup(group.groupId))!).status).toBe('dialing');
  });

  it('does not allow a stale worker to claim a winner', async () => {
    const redis = new FakeRedis();
    const store = new RedisParallelStore(redis);
    await expect(store.withGroupLock(group.groupId, async () => {
      redis.values.set(lockKey, 'replacement-worker-token');
      await store.setWinnerIfAbsent(group.groupId, 'stale-call', 60);
    })).rejects.toThrow(/lock|ownership|lease/i);
    expect(await store.getWinner(group.groupId)).toBeNull();
  });
});

describe('RedisParallelStore multiple-worker fencing', () => {
  const lockKey = 'consuelo:dialer:parallel:lock:group-1';
  it('preserves a newer worker commit when an earlier lease is lost', async () => {
    const redis = new FakeRedis();
    const first = new RedisParallelStore(redis);
    const second = new RedisParallelStore(redis);
    await first.setGroup(group.groupId, JSON.stringify(group), 60);
    await expect(first.withGroupLock(group.groupId, async () => {
      // Simulate Redis lease expiry and a second owner acquiring the same key.
      redis.values.delete(lockKey);
      await second.withGroupLock(group.groupId, async () => {
        await second.setGroup(group.groupId, JSON.stringify({ ...group, status: 'connected' }), 60);
      });
      await first.setGroup(group.groupId, JSON.stringify({ ...group, status: 'failed' }), 60);
    })).rejects.toThrow(/ownership/);
    expect(JSON.parse((await first.getGroup(group.groupId))!).status).toBe('connected');
  });

  it('fences registration, mapping, telemetry, and deletion after lease loss', async () => {
    const redis = new FakeRedis();
    const store = new RedisParallelStore(redis);
    await store.setGroup(group.groupId, JSON.stringify(group), 60);
    await expect(store.withGroupLock(group.groupId, async () => {
      redis.values.set(lockKey, 'replacement-worker-token');
      await expect(store.registerCall(group.groupId, {
        callSid: 'late-leg', customerNumber: 'redacted', fromNumber: 'redacted',
        position: 1, status: 'dialing', dialStartedAt: group.createdAt,
      }, 60)).rejects.toThrow(/ownership/);
      await expect(store.setCallMapping('late-leg', group.groupId, 60)).rejects.toThrow(/ownership/);
      await expect(store.claimTelemetryEmission(group.groupId, group.createdAt, 60)).rejects.toThrow(/ownership/);
      await expect(store.deleteGroup(group.groupId)).rejects.toThrow(/ownership/);
    })).rejects.toThrow(/ownership/);
    expect(await store.getGroup(group.groupId)).not.toBeNull();
    expect(await store.getCallMapping('late-leg')).toBeNull();
  });
});

describe('Redis lease context across Effect application boundaries', () => {
  it('fails the Effect and preserves the group when an owner loses the lease', async () => {
    const redis = new FakeRedis();
    const store = new RedisParallelStore(redis);
    const layer = createParallelStateStoreLayer(store);
    const program = Effect.gen(function* () {
      const state = yield* ParallelStateStore;
      yield* state.setGroup(group, 60);
      return yield* state.withGroupLock(group.groupId, Effect.gen(function* () {
        yield* Effect.sync(() => {
          redis.values.set('consuelo:dialer:parallel:lock:group-1', 'different-owner');
        });
        yield* state.setGroup({ ...group, status: 'failed' }, 60);
      }));
    }).pipe(Effect.provide(layer));
    await expect(Effect.runPromise(program)).rejects.toThrow(/ownership/i);
    expect(JSON.parse((await store.getGroup(group.groupId))!).status).toBe('dialing');
  });
});
