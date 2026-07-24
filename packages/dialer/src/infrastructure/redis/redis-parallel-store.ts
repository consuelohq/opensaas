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

export class RedisParallelStore implements ParallelStore {
  private readonly prefix: string;
  private readonly lockTtlMs: number;
  private readonly lockRetryMs: number;
  private readonly lockTimeoutMs: number;

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

  setGroup(groupId: string, data: string, ttlSeconds: number): Promise<void> {
    return this.redis
      .set(this.groupKey(groupId), data, 'EX', ttlSeconds)
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
    return this.redis
      .eval(
        REGISTER_CALL_SCRIPT,
        2,
        this.groupKey(groupId),
        this.callKey(call.callSid),
        JSON.stringify(call),
        groupId,
        String(ttlSeconds),
      )
      .then((result) => {
        if (result !== 1) {
          throw new Error('Parallel group not found while registering call');
        }
      });
  }

  setCallMapping(
    callSid: string,
    groupId: string,
    ttlSeconds: number,
  ): Promise<void> {
    return this.redis
      .set(this.callKey(callSid), groupId, 'EX', ttlSeconds)
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
    return this.redis
      .set(this.winnerKey(groupId), callSid, 'EX', ttlSeconds, 'NX')
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
    return this.redis
      .eval(
        CLAIM_TELEMETRY_SCRIPT,
        1,
        this.groupKey(groupId),
        emittedAt,
        String(ttlSeconds),
      )
      .then((result) => result === 1);
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
    try {
      return await operation();
    } finally {
      await this.redis.eval(RELEASE_LOCK_SCRIPT, 1, key, token);
    }
  }

  deleteGroup(groupId: string): Promise<void> {
    return this.getGroup(groupId).then((raw) => {
      const calls = raw
        ? (JSON.parse(raw) as ParallelGroup).calls.map((call) =>
            this.callKey(call.callSid),
          )
        : [];
      return this.redis
        .del(this.groupKey(groupId), this.winnerKey(groupId), ...calls)
        .then(() => undefined);
    });
  }
}
