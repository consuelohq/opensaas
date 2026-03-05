// Mock ioredis for unit tests
// Covers: get, set, del, setnx, expire, pipeline, pub/sub basics

type MockFn = jest.Mock;

export interface MockPipeline {
  set: MockFn;
  get: MockFn;
  del: MockFn;
  expire: MockFn;
  setnx: MockFn;
  exec: MockFn;
}

export interface MockRedisClient {
  get: MockFn;
  set: MockFn;
  del: MockFn;
  setnx: MockFn;
  expire: MockFn;
  ttl: MockFn;
  keys: MockFn;
  exists: MockFn;
  incr: MockFn;
  decr: MockFn;
  pipeline: MockFn;
  multi: MockFn;
  subscribe: MockFn;
  unsubscribe: MockFn;
  publish: MockFn;
  on: MockFn;
  quit: MockFn;
  disconnect: MockFn;
}

const createMockPipeline = (): MockPipeline => {
  const pipeline: MockPipeline = {
    set: jest.fn().mockReturnThis(),
    get: jest.fn().mockReturnThis(),
    del: jest.fn().mockReturnThis(),
    expire: jest.fn().mockReturnThis(),
    setnx: jest.fn().mockReturnThis(),
    exec: jest.fn().mockResolvedValue([]),
  };
  return pipeline;
};

export const createMockRedisClient = (): MockRedisClient => {
  const store = new Map<string, string>();

  return {
    get: jest.fn().mockImplementation((key: string) =>
      Promise.resolve(store.get(key) ?? null),
    ),
    set: jest.fn().mockImplementation((key: string, value: string) => {
      store.set(key, value);
      return Promise.resolve('OK');
    }),
    del: jest.fn().mockImplementation((...keys: string[]) => {
      let count = 0;
      for (const key of keys) {
        if (store.delete(key)) count++;
      }
      return Promise.resolve(count);
    }),
    setnx: jest.fn().mockImplementation((key: string, value: string) => {
      if (store.has(key)) return Promise.resolve(0);
      store.set(key, value);
      return Promise.resolve(1);
    }),
    expire: jest.fn().mockResolvedValue(1),
    ttl: jest.fn().mockResolvedValue(-1),
    keys: jest.fn().mockImplementation((pattern: string) => {
      const prefix = pattern.replace('*', '');
      const matched = [...store.keys()].filter((k) => k.startsWith(prefix));
      return Promise.resolve(matched);
    }),
    exists: jest.fn().mockImplementation((key: string) =>
      Promise.resolve(store.has(key) ? 1 : 0),
    ),
    incr: jest.fn().mockImplementation((key: string) => {
      const val = parseInt(store.get(key) ?? '0', 10) + 1;
      store.set(key, String(val));
      return Promise.resolve(val);
    }),
    decr: jest.fn().mockImplementation((key: string) => {
      const val = parseInt(store.get(key) ?? '0', 10) - 1;
      store.set(key, String(val));
      return Promise.resolve(val);
    }),
    pipeline: jest.fn().mockReturnValue(createMockPipeline()),
    multi: jest.fn().mockReturnValue(createMockPipeline()),
    subscribe: jest.fn().mockResolvedValue(undefined),
    unsubscribe: jest.fn().mockResolvedValue(undefined),
    publish: jest.fn().mockResolvedValue(0),
    on: jest.fn().mockReturnThis(),
    quit: jest.fn().mockResolvedValue('OK'),
    disconnect: jest.fn(),
  };
};

// Default export mimics `import Redis from 'ioredis'`
const MockRedis = jest.fn().mockImplementation(() => createMockRedisClient());

export default MockRedis;
export { MockRedis as Redis };
