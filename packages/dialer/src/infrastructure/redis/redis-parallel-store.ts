import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';

import type {
  ParallelCall,
  ParallelGroup,
  ParallelStore,
} from '../../types.js';

export type RedisParallelClient = {
  set: (
    key: string,
    value: string,
    ...args: unknown[]
  ) => Promise<string | null>;
  get: (key: string) => Promise<string | null>;
  del: (...keys: string[]) => Promise<number>;
  eval: (
    script: string,
    numberOfKeys: number,
    ...args: unknown[]
  ) => Promise<number>;
};

const REGISTER_CALL_SCRIPT = `
-- register-call
local groupKey = KEYS[1]
local mappingKey = KEYS[2]
local call = cjson.decode(ARGV[1])
local groupId = ARGV[2]
local ttl = tonumber(ARGV[3])
if #KEYS > 2 and redis.call('GET', KEYS[3]) ~= ARGV[4] then return -1 end
local raw = redis.call('GET', groupKey)
if not raw then return 0 end
local group = cjson.decode(raw)
local found = false
for _, candidate in ipairs(group.calls) do
  if candidate.callSid == call.callSid then found = true break end
end
if not found then table.insert(group.calls, call) end
redis.call('SET', groupKey, cjson.encode(group), 'EX', ttl)
redis.call('SET', mappingKey, groupId, 'EX', ttl)
return 1
`;

const CLAIM_TELEMETRY_SCRIPT = `
-- claim-telemetry
local groupKey = KEYS[1]
local emittedAt = ARGV[1]
local ttl = tonumber(ARGV[2])
if #KEYS > 1 and redis.call('GET', KEYS[2]) ~= ARGV[3] then return -1 end
local raw = redis.call('GET', groupKey)
if not raw then return 0 end
local group = cjson.decode(raw)
if group.telemetryEmittedAt then return 0 end
group.telemetryEmittedAt = emittedAt
redis.call('SET', groupKey, cjson.encode(group), 'EX', ttl)
return 1
`;

const RELEASE_LOCK_SCRIPT = `
-- release-lock
local key = KEYS[1]
local token = ARGV[1]
if redis.call('GET', key) ~= token then return 0 end
return redis.call('DEL', key)
`;

const RENEW_LOCK_SCRIPT = `
-- renew-lock
local key = KEYS[1]
local token = ARGV[1]
local ttl = tonumber(ARGV[2])
if redis.call('GET', key) ~= token then return 0 end
return redis.call('PEXPIRE', key, ttl)
`;

// The lock-key check and protected write must execute in a single Redis script;
// checking GET before a separate SET would still allow a stale owner to commit.
const FENCED_SET_GROUP_SCRIPT = `
-- fenced-set-group
if redis.call('GET', KEYS[1]) ~= ARGV[1] then return -1 end
redis.call('SET', KEYS[2], ARGV[2], 'EX', tonumber(ARGV[3]))
return 1
`;

const FENCED_CLAIM_WINNER_SCRIPT = `
-- fenced-claim-winner
if redis.call('GET', KEYS[1]) ~= ARGV[1] then return -1 end
local won = redis.call('SET', KEYS[2], ARGV[2], 'EX', tonumber(ARGV[3]), 'NX')
return won and 1 or 0
`;

const FENCED_SET_MAPPING_SCRIPT = `
-- fenced-set-mapping
if redis.call('GET', KEYS[1]) ~= ARGV[1] then return -1 end
redis.call('SET', KEYS[2], ARGV[2], 'EX', tonumber(ARGV[3]))
return 1
`;

const FENCED_DELETE_GROUP_SCRIPT = `
-- fenced-delete-group
if redis.call('GET', KEYS[1]) ~= ARGV[1] then return -1 end
for index = 2, #KEYS do redis.call('DEL', KEYS[index]) end
return 1
`;

type GroupLease = { groupId: string; token: string };

export class RedisParallelStore implements ParallelStore {
  private readonly prefix: string;
  private readonly lockTtlMs: number;
  private readonly lockRetryMs: number;
  private readonly lockTimeoutMs: number;
  private readonly lockContext = new AsyncLocalStorage<GroupLease>();

  constructor(
    private readonly redis: RedisParallelClient,
    options: {
      keyPrefix?: string;
      lockTtlMs?: number;
      lockRetryMs?: number;
      lockTimeoutMs?: number;
    } = {},
  ) {
    this.prefix = options.keyPrefix ?? 'consuelo:dialer:parallel';
    this.lockTtlMs = options.lockTtlMs ?? 15_000;
    this.lockRetryMs = options.lockRetryMs ?? 20;
    this.lockTimeoutMs = options.lockTimeoutMs ?? 5_000;
  }

  private groupKey(groupId: string): string {
    return `${this.prefix}:group:${groupId}`;
  }

  private callKey(callSid: string): string {
    return `${this.prefix}:call:${callSid}`;
  }

  private winnerKey(groupId: string): string {
    return `${this.prefix}:winner:${groupId}`;
  }

  private lockKey(groupId: string): string {
    return `${this.prefix}:lock:${groupId}`;
  }

  private currentLease(groupId: string): GroupLease | undefined {
    const lease = this.lockContext.getStore();
    return lease?.groupId === groupId ? lease : undefined;
  }

  private assertFencedWrite(result: number): void {
    if (result === -1) throw new Error('Lost ownership of parallel group lock');
  }

  assertLockOwnership(groupId: string): Promise<void> {
    const lease = this.currentLease(groupId);
    if (!lease) return Promise.reject(new Error('Lost ownership of parallel group lock'));
    return this.redis.get(this.lockKey(groupId)).then((current) => {
      if (current !== lease.token) throw new Error('Lost ownership of parallel group lock');
    });
  }

  setGroup(groupId: string, data: string, ttlSeconds: number): Promise<void> {
    const lease = this.currentLease(groupId);
    if (lease) {
      return this.redis.eval(
        FENCED_SET_GROUP_SCRIPT, 2,
        this.lockKey(groupId), this.groupKey(groupId),
        lease.token, data, String(ttlSeconds),
      ).then((result) => { this.assertFencedWrite(result); });
    }
    return this.redis.set(this.groupKey(groupId), data, 'EX', ttlSeconds)
      .then(() => undefined);
  }

  getGroup(groupId: string): Promise<string | null> {
    return this.redis.get(this.groupKey(groupId));
  }

  registerCall(
    groupId: string,
    call: ParallelCall,
    ttlSeconds: number,
  ): Promise<void> {
    const lease = this.currentLease(groupId);
    const keys = [this.groupKey(groupId), this.callKey(call.callSid)];
    if (lease) keys.push(this.lockKey(groupId));
    return this.redis.eval(
      REGISTER_CALL_SCRIPT, keys.length, ...keys,
      JSON.stringify(call), groupId, String(ttlSeconds),
      ...(lease ? [lease.token] : []),
    ).then((result) => {
      this.assertFencedWrite(result);
      if (result !== 1) throw new Error('Parallel group not found while registering call');
    });
  }

  setCallMapping(
    callSid: string,
    groupId: string,
    ttlSeconds: number,
  ): Promise<void> {
    const lease = this.currentLease(groupId);
    if (lease) {
      return this.redis.eval(
        FENCED_SET_MAPPING_SCRIPT, 2,
        this.lockKey(groupId), this.callKey(callSid),
        lease.token, groupId, String(ttlSeconds),
      ).then((result) => { this.assertFencedWrite(result); });
    }
    return this.redis.set(this.callKey(callSid), groupId, 'EX', ttlSeconds)
      .then(() => undefined);
  }

  getCallMapping(callSid: string): Promise<string | null> {
    return this.redis.get(this.callKey(callSid));
  }

  setWinnerIfAbsent(
    groupId: string,
    callSid: string,
    ttlSeconds: number,
  ): Promise<boolean> {
    const lease = this.currentLease(groupId);
    if (lease) {
      return this.redis.eval(
        FENCED_CLAIM_WINNER_SCRIPT, 2,
        this.lockKey(groupId), this.winnerKey(groupId),
        lease.token, callSid, String(ttlSeconds),
      ).then((result) => {
        this.assertFencedWrite(result);
        return result === 1;
      });
    }
    return this.redis.set(this.winnerKey(groupId), callSid, 'EX', ttlSeconds, 'NX')
      .then((result) => result === 'OK');
  }

  getWinner(groupId: string): Promise<string | null> {
    return this.redis.get(this.winnerKey(groupId));
  }

  claimTelemetryEmission(
    groupId: string,
    emittedAt: string,
    ttlSeconds: number,
  ): Promise<boolean> {
    const lease = this.currentLease(groupId);
    const keys = [this.groupKey(groupId)];
    if (lease) keys.push(this.lockKey(groupId));
    return this.redis.eval(
      CLAIM_TELEMETRY_SCRIPT, keys.length, ...keys,
      emittedAt, String(ttlSeconds), ...(lease ? [lease.token] : []),
    ).then((result) => {
      this.assertFencedWrite(result);
      return result === 1;
    });
  }

  private assertLockOwnershipForToken(key: string, token: string): Promise<void> {
    return this.redis.get(key).then((current) => {
      if (current !== token) throw new Error('Lost ownership of parallel group lock');
    });
  }

  async withGroupLock<T>(
    groupId: string,
    operation: () => Promise<T>,
  ): Promise<T> {
    const key = this.lockKey(groupId);
    const token = randomUUID();
    const deadline = Date.now() + this.lockTimeoutMs;
    while (
      (await this.redis.set(key, token, 'PX', this.lockTtlMs, 'NX')) !== 'OK'
    ) {
      if (Date.now() >= deadline) {
        throw new Error('Timed out waiting for parallel group lock');
      }
      await new Promise((resolve) => setTimeout(resolve, this.lockRetryMs));
    }
    let renewalError: unknown;
    let activeRenewal: Promise<void> | undefined;
    const renewalIntervalMs = Math.max(1, Math.floor(this.lockTtlMs / 3));
    const renewalTimer = setInterval(() => {
      if (activeRenewal || renewalError) return;
      activeRenewal = this.redis
        .eval(RENEW_LOCK_SCRIPT, 1, key, token, String(this.lockTtlMs))
        .then((renewed) => {
          if (renewed !== 1) {
            renewalError = new Error('Lost ownership of parallel group lock');
          }
        })
        .catch((err: unknown) => {
          renewalError = err;
        })
        .finally(() => {
          activeRenewal = undefined;
        });
    }, renewalIntervalMs);
    try {
      const result = await this.lockContext.run(
        { groupId, token }, operation,
      );
      clearInterval(renewalTimer);
      await activeRenewal;
      if (renewalError) throw renewalError;
      await this.assertLockOwnershipForToken(key, token);
      return result;
    } finally {
      clearInterval(renewalTimer);
      await activeRenewal;
      await this.redis.eval(RELEASE_LOCK_SCRIPT, 1, key, token);
    }
  }

  async deleteGroup(groupId: string): Promise<void> {
    const raw = await this.getGroup(groupId);
    {
      let calls: string[] = [];
      if (raw) {
        try {
          const parsed = JSON.parse(raw) as Partial<ParallelGroup>;
          calls = Array.isArray(parsed.calls)
            ? parsed.calls.flatMap((call) =>
                typeof call?.callSid === 'string'
                  ? [this.callKey(call.callSid)]
                  : [],
              )
            : [];
        } catch {
          calls = [];
        }
      }
      const lease = this.currentLease(groupId);
      if (lease) {
        const keys = [this.lockKey(groupId), this.groupKey(groupId), this.winnerKey(groupId), ...calls];
        const result = await this.redis.eval(FENCED_DELETE_GROUP_SCRIPT, keys.length, ...keys, lease.token);
        this.assertFencedWrite(result);
        return;
      }
      await this.redis.del(this.groupKey(groupId), this.winnerKey(groupId), ...calls);
    }
  }
}
