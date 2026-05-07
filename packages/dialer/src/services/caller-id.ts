import type { CallerIdLock } from '../types.js';

/**
 * Caller ID lock service — prevents concurrent use of the same
 * outbound number across multiple active calls.
 *
 * This is a storage-agnostic interface. Provide your own store
 * implementation (e.g. MongoDB, Redis, in-memory for testing).
 */
export interface LockStore {
  acquire(lock: CallerIdLock): Promise<boolean>;
  transfer(
    phoneNumber: string,
    expectedCallSid: string,
    nextCallSid: string,
  ): Promise<boolean>;
  release(callSid: string): Promise<boolean>;
  releaseByNumber(phoneNumber: string): Promise<boolean>;
  isAvailable(phoneNumber: string): Promise<boolean>;
  getByCallSid(callSid: string): Promise<CallerIdLock | null>;
  getByUser(userId: string): Promise<CallerIdLock[]>;
}

const DEFAULT_TTL_MS = 5 * 60 * 1000; // 5 minutes
const LOCK_KEY_PREFIX = 'caller-id-lock:';

type RedisClientLike = {
  connect(): Promise<void>;
  set(...args: unknown[]): Promise<string | null>;
  eval(...args: unknown[]): Promise<number>;
  keys(pattern: string): Promise<string[]>;
  get(key: string): Promise<string | null>;
  del(...keys: string[]): Promise<number>;
};

export class CallerIdLockService {
  private store: LockStore;
  private ttlMs: number;

  constructor(store: LockStore, ttlMs?: number) {
    this.store = store;
    this.ttlMs = ttlMs ?? DEFAULT_TTL_MS;
  }

  async acquireLock(
    phoneNumber: string,
    userId: string,
    callSid: string,
  ): Promise<boolean> {
    const now = new Date();
    return this.store.acquire({
      phoneNumber,
      userId,
      callSid,
      acquiredAt: now,
      expiresAt: new Date(now.getTime() + this.ttlMs),
    });
  }

  async transferLock(
    phoneNumber: string,
    expectedCallSid: string,
    nextCallSid: string,
  ): Promise<boolean> {
    return this.store.transfer(phoneNumber, expectedCallSid, nextCallSid);
  }

  async releaseLock(callSid: string): Promise<boolean> {
    return this.store.release(callSid);
  }

  async releaseLockByNumber(phoneNumber: string): Promise<boolean> {
    return this.store.releaseByNumber(phoneNumber);
  }

  async isNumberAvailable(phoneNumber: string): Promise<boolean> {
    return this.store.isAvailable(phoneNumber);
  }

  async getUserLocks(userId: string): Promise<CallerIdLock[]> {
    return this.store.getByUser(userId);
  }
}

/**
 * Simple in-memory lock store for testing / single-process use.
 */
export class InMemoryLockStore implements LockStore {
  private locks = new Map<string, CallerIdLock>();

  async acquire(lock: CallerIdLock): Promise<boolean> {
    // clean expired
    this.cleanExpired();
    const existing = this.locks.get(lock.phoneNumber);
    if (existing && existing.callSid !== lock.callSid) return false;
    this.locks.set(lock.phoneNumber, lock);
    return true;
  }

  async transfer(
    phoneNumber: string,
    expectedCallSid: string,
    nextCallSid: string,
  ): Promise<boolean> {
    this.cleanExpired();
    const existing = this.locks.get(phoneNumber);

    if (!existing || existing.callSid !== expectedCallSid) {
      return false;
    }

    this.locks.set(phoneNumber, {
      ...existing,
      callSid: nextCallSid,
    });

    return true;
  }

  async release(callSid: string): Promise<boolean> {
    for (const [key, lock] of this.locks) {
      if (lock.callSid === callSid) {
        this.locks.delete(key);
        return true;
      }
    }
    return false;
  }

  async releaseByNumber(phoneNumber: string): Promise<boolean> {
    return this.locks.delete(phoneNumber);
  }

  async isAvailable(phoneNumber: string): Promise<boolean> {
    this.cleanExpired();
    return !this.locks.has(phoneNumber);
  }

  async getByCallSid(callSid: string): Promise<CallerIdLock | null> {
    this.cleanExpired();
    for (const lock of this.locks.values()) {
      if (lock.callSid === callSid) return lock;
    }
    return null;
  }

  async getByUser(userId: string): Promise<CallerIdLock[]> {
    this.cleanExpired();
    return [...this.locks.values()].filter((l) => l.userId === userId);
  }

  private cleanExpired(): void {
    const now = Date.now();
    for (const [key, lock] of this.locks) {
      if (lock.expiresAt.getTime() < now) this.locks.delete(key);
    }
  }
}

/**
 * Redis-backed lock store for production multi-instance deployments.
 * Uses SETNX with TTL for atomic lock acquisition.
 */
export class RedisLockStore implements LockStore {
  private redis: RedisClientLike | null = null;
  private redisUrl: string;
  private ttlSeconds: number;
  private initPromise: Promise<void> | null = null;

  constructor(redisUrl: string, ttlMs?: number) {
    this.redisUrl = redisUrl;
    this.ttlSeconds = Math.ceil((ttlMs ?? DEFAULT_TTL_MS) / 1000);
  }

  private async init(): Promise<void> {
    if (this.redis) return;
    if (this.initPromise) {
      await this.initPromise;
      return;
    }

    this.initPromise = (async () => {
      try {
        const { default: Redis } = await import('ioredis');
        this.redis = new Redis(this.redisUrl, {
          maxRetriesPerRequest: 1,
          lazyConnect: true,
        }) as RedisClientLike;
        await this.redis.connect();
      } catch (err: unknown) {
        this.redis = null;
        this.initPromise = null;
        throw err;
      }
    })();

    await this.initPromise;
  }

  private async getRedis(): Promise<RedisClientLike> {
    // HACK: ioredis peer dep — no static type
    if (!this.redis) {
      await this.init();
    }
    return this.redis!;
  }

  async acquire(lock: CallerIdLock): Promise<boolean> {
    try {
      const redis = await this.getRedis();
      const key = `${LOCK_KEY_PREFIX}${lock.phoneNumber}`;
      const value = JSON.stringify({
        phoneNumber: lock.phoneNumber,
        userId: lock.userId,
        callSid: lock.callSid,
        acquiredAt: lock.acquiredAt.toISOString(),
        expiresAt: lock.expiresAt.toISOString(),
      });

      const result = await redis.set(key, value, 'EX', this.ttlSeconds, 'NX');
      return result === 'OK';
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : 'Redis lock acquire failed';
      try {
        const { createLogger } = await import('@consuelo/logger');
        createLogger('dialer:CallerIdLock').error(
          '[RedisLockStore] acquire failed',
          {
            phoneSuffix: lock.phoneNumber.slice(-4),
            callSid: lock.callSid,
            error: msg,
          },
        );
      } catch {
        /* logger optional */
      }
      throw err;
    }
  }

  async transfer(
    phoneNumber: string,
    expectedCallSid: string,
    nextCallSid: string,
  ): Promise<boolean> {
    try {
      const redis = await this.getRedis();
      const key = `${LOCK_KEY_PREFIX}${phoneNumber}`;
      const script = `
        local key = KEYS[1]
        local expected = ARGV[1]
        local next = ARGV[2]
        local value = redis.call('GET', key)
        if not value then
          return 0
        end
        local lock = cjson.decode(value)
        if lock.callSid ~= expected then
          return 0
        end
        local pttl = redis.call('PTTL', key)
        if pttl < 0 then
          pttl = tonumber(ARGV[3]) * 1000
        end
        lock.callSid = next
        redis.call('SET', key, cjson.encode(lock), 'PX', pttl)
        return 1
      `;
      const result = await redis.eval(
        script,
        1,
        key,
        expectedCallSid,
        nextCallSid,
        String(this.ttlSeconds),
      );

      return result === 1;
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : 'Redis lock transfer failed';
      try {
        const { createLogger } = await import('@consuelo/logger');
        createLogger('dialer:CallerIdLock').error(
          '[RedisLockStore] transfer failed',
          {
            phoneSuffix: phoneNumber.slice(-4),
            expectedCallSid,
            nextCallSid,
            error: msg,
          },
        );
      } catch {
        /* logger optional */
      }
      throw err;
    }
  }

  async release(callSid: string): Promise<boolean> {
    try {
      const redis = await this.getRedis();
      const keys = await redis.keys(`${LOCK_KEY_PREFIX}*`);
      if (keys.length === 0) return false;

      let released = false;
      for (const key of keys) {
        const value = await redis.get(key);
        if (value) {
          const lock = JSON.parse(value) as CallerIdLock;
          if (lock.callSid === callSid) {
            await redis.del(key);
            released = true;
          }
        }
      }
      return released;
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : 'Redis lock release failed';
      try {
        const { createLogger } = await import('@consuelo/logger');
        createLogger('dialer:CallerIdLock').error(
          '[RedisLockStore] release failed',
          {
            callSid,
            error: msg,
          },
        );
      } catch {
        /* logger optional */
      }
      throw err;
    }
  }

  async releaseByNumber(phoneNumber: string): Promise<boolean> {
    try {
      const redis = await this.getRedis();
      const key = `${LOCK_KEY_PREFIX}${phoneNumber}`;
      const result = await redis.del(key);
      return result > 0;
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : 'Redis lock release failed';
      try {
        const { createLogger } = await import('@consuelo/logger');
        createLogger('dialer:CallerIdLock').error(
          '[RedisLockStore] releaseByNumber failed',
          {
            phoneSuffix: phoneNumber.slice(-4),
            error: msg,
          },
        );
      } catch {
        /* logger optional */
      }
      throw err;
    }
  }

  async isAvailable(phoneNumber: string): Promise<boolean> {
    try {
      const redis = await this.getRedis();
      const key = `${LOCK_KEY_PREFIX}${phoneNumber}`;
      const value = await redis.get(key);
      if (!value) return true;

      const lock = JSON.parse(value) as CallerIdLock;
      if (new Date(lock.expiresAt).getTime() < Date.now()) {
        await redis.del(key);
        return true;
      }
      return false;
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : 'Redis lock check failed';
      try {
        const { createLogger } = await import('@consuelo/logger');
        createLogger('dialer:CallerIdLock').error(
          '[RedisLockStore] isAvailable failed',
          {
            phoneSuffix: phoneNumber.slice(-4),
            error: msg,
          },
        );
      } catch {
        /* logger optional */
      }
      throw err;
    }
  }

  async getByCallSid(callSid: string): Promise<CallerIdLock | null> {
    try {
      const redis = await this.getRedis();
      const keys = await redis.keys(`${LOCK_KEY_PREFIX}*`);
      for (const key of keys) {
        const value = await redis.get(key);
        if (value) {
          const lock = JSON.parse(value) as CallerIdLock;
          if (lock.callSid === callSid) return lock;
        }
      }
      return null;
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : 'Redis getByCallSid failed';
      try {
        const { createLogger } = await import('@consuelo/logger');
        createLogger('dialer:CallerIdLock').error(
          '[RedisLockStore] getByCallSid failed',
          {
            callSid,
            error: msg,
          },
        );
      } catch {
        /* logger optional */
      }
      throw err;
    }
  }

  async getByUser(userId: string): Promise<CallerIdLock[]> {
    try {
      const redis = await this.getRedis();
      const keys = await redis.keys(`${LOCK_KEY_PREFIX}*`);
      const locks: CallerIdLock[] = [];
      for (const key of keys) {
        const value = await redis.get(key);
        if (value) {
          const lock = JSON.parse(value) as CallerIdLock;
          if (lock.userId === userId) locks.push(lock);
        }
      }
      return locks;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Redis getByUser failed';
      try {
        const { createLogger } = await import('@consuelo/logger');
        createLogger('dialer:CallerIdLock').error(
          '[RedisLockStore] getByUser failed',
          {
            userId,
            error: msg,
          },
        );
      } catch {
        /* logger optional */
      }
      throw err;
    }
  }
}
