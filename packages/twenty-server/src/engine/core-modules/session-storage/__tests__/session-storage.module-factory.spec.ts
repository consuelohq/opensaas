import { createClient } from 'redis';

import type session from 'express-session';

import {
  getSessionStorageOptions,
  SESSION_REDIS_OPERATION_TIMEOUT_MS,
} from 'src/engine/core-modules/session-storage/session-storage.module-factory';
import { type TwentyConfigService } from 'src/engine/core-modules/twenty-config/twenty-config.service';

jest.mock(
  '@nestjs/common',
  () => ({
    Logger: jest.fn().mockImplementation(() => ({
      error: jest.fn(),
      log: jest.fn(),
      warn: jest.fn(),
    })),
  }),
  { virtual: true },
);

jest.mock('redis', () => ({
  createClient: jest.fn(),
}));

type MockRedisClient = {
  connect: jest.Mock<Promise<void>, []>;
  del: jest.Mock<Promise<number>, [string | string[]]>;
  expire: jest.Mock<Promise<number>, [string, number]>;
  get: jest.Mock<Promise<string | null>, [string]>;
  isOpen: boolean;
  isReady: boolean;
  mGet: jest.Mock<Promise<(string | null)[]>, [string[]]>;
  on: jest.Mock<MockRedisClient, [string, (...args: never[]) => void]>;
  scanIterator: jest.Mock<AsyncIterable<string>, [unknown]>;
  set: jest.Mock<Promise<string | null>, [string, string, unknown?]>;
};

const mockedCreateClient = jest.mocked(createClient);

const buildConfigService = (redisUrl: string): TwentyConfigService =>
  ({
    get: jest.fn((key: string) => {
      if (key === 'APP_SECRET') {
        return 'test-app-secret';
      }

      if (key === 'REDIS_URL') {
        return redisUrl;
      }

      if (key === 'SERVER_URL') {
        return 'https://app.example.com';
      }

      return undefined;
    }),
  }) as unknown as TwentyConfigService;

const buildRedisClient = ({
  isOpen = true,
  isReady = true,
}: {
  isOpen?: boolean;
  isReady?: boolean;
} = {}): MockRedisClient => {
  const client: MockRedisClient = {
    connect: jest.fn(async () => undefined),
    del: jest.fn(async (_key: string | string[]) => 1),
    expire: jest.fn(async (_key: string, _ttl: number) => 1),
    get: jest.fn(async (_key: string) => null),
    isOpen,
    isReady,
    mGet: jest.fn(async (_keys: string[]) => []),
    on: jest.fn(
      (_event: string, _listener: (...args: never[]) => void) => client,
    ),
    scanIterator: jest.fn(async function* (_options: unknown) {
      yield 'engine:session:test';
    }),
    set: jest.fn(
      async (_key: string, _value: string, _options?: unknown) => 'OK',
    ),
  };

  return client;
};

const getStore = (redisUrl: string): session.Store => {
  const store = getSessionStorageOptions(buildConfigService(redisUrl)).store;

  if (store === undefined) {
    throw new Error('Expected Redis session store to be defined');
  }

  return store;
};

const getSessionFromStore = (
  store: session.Store,
  sessionId: string,
): Promise<session.SessionData | null | undefined> =>
  new Promise((resolve, reject) => {
    store.get(sessionId, (err, data) => {
      if (err) {
        reject(err);

        return;
      }

      resolve(data);
    });
  });

describe('getSessionStorageOptions', () => {
  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  it('uses a Redis-backed session store without falling back to memory sessions', () => {
    const redisClient = buildRedisClient();

    mockedCreateClient.mockReturnValue(
      redisClient as unknown as ReturnType<typeof createClient>,
    );

    const sessionOptions = getSessionStorageOptions(
      buildConfigService('redis://session-store-test'),
    );

    expect(sessionOptions.store).toBeDefined();
    expect(mockedCreateClient).not.toHaveBeenCalled();
  });

  it('connects lazily and returns a session when Redis becomes ready', async () => {
    const redisClient = buildRedisClient({ isOpen: false, isReady: false });
    const sessionData = {
      cookie: { originalMaxAge: 1000 },
      userId: 'user-id',
    };

    redisClient.connect.mockImplementation(async () => {
      redisClient.isOpen = true;
      redisClient.isReady = true;
    });
    redisClient.get.mockResolvedValue(JSON.stringify(sessionData));
    mockedCreateClient.mockReturnValue(
      redisClient as unknown as ReturnType<typeof createClient>,
    );

    const store = getStore('redis://session-store-lazy-connect');

    await expect(getSessionFromStore(store, 'session-id')).resolves.toEqual(
      sessionData,
    );
    expect(redisClient.connect).toHaveBeenCalledTimes(1);
    expect(redisClient.get).toHaveBeenCalledWith('engine:session:session-id');
  });

  it('fails fast when Redis connection never resolves', async () => {
    jest.useFakeTimers();

    const redisClient = buildRedisClient({ isOpen: false, isReady: false });

    redisClient.connect.mockReturnValue(new Promise<void>(() => undefined));
    mockedCreateClient.mockReturnValue(
      redisClient as unknown as ReturnType<typeof createClient>,
    );

    const store = getStore('redis://session-store-connect-timeout');
    const sessionPromise = getSessionFromStore(store, 'session-id');
    const expectation = expect(sessionPromise).rejects.toThrow(
      'redis session connect timed out',
    );

    await jest.advanceTimersByTimeAsync(2001);
    await expectation;
    expect(redisClient.get).not.toHaveBeenCalled();
  });

  it('fails fast when a Redis session command hangs', async () => {
    jest.useFakeTimers();

    const redisClient = buildRedisClient();

    redisClient.get.mockReturnValue(
      new Promise<string | null>(() => undefined),
    );
    mockedCreateClient.mockReturnValue(
      redisClient as unknown as ReturnType<typeof createClient>,
    );

    const store = getStore('redis://session-store-command-timeout');
    const sessionPromise = getSessionFromStore(store, 'session-id');
    const expectation = expect(sessionPromise).rejects.toThrow(
      'redis session get timed out',
    );

    await jest.advanceTimersByTimeAsync(SESSION_REDIS_OPERATION_TIMEOUT_MS + 1);
    await expectation;
  });

  it('resets the cached Redis session client after a timed-out command', async () => {
    jest.useFakeTimers();

    const firstRedisClient = buildRedisClient();
    const secondRedisClient = buildRedisClient();
    const sessionData = {
      cookie: { originalMaxAge: 1000 },
      userId: 'user-id',
    };

    firstRedisClient.get.mockReturnValue(
      new Promise<string | null>(() => undefined),
    );
    secondRedisClient.get.mockResolvedValue(JSON.stringify(sessionData));
    mockedCreateClient
      .mockReturnValueOnce(
        firstRedisClient as unknown as ReturnType<typeof createClient>,
      )
      .mockReturnValueOnce(
        secondRedisClient as unknown as ReturnType<typeof createClient>,
      );

    const store = getStore('redis://session-store-reset-after-timeout');
    const firstSessionPromise = getSessionFromStore(store, 'first-session-id');
    const firstExpectation = expect(firstSessionPromise).rejects.toThrow(
      'redis session get timed out',
    );

    await jest.advanceTimersByTimeAsync(SESSION_REDIS_OPERATION_TIMEOUT_MS + 1);
    await firstExpectation;

    await expect(
      getSessionFromStore(store, 'second-session-id'),
    ).resolves.toEqual(sessionData);
    expect(mockedCreateClient).toHaveBeenCalledTimes(2);
    expect(secondRedisClient.get).toHaveBeenCalledWith(
      'engine:session:second-session-id',
    );
  });
});
