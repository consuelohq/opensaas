import { Logger } from '@nestjs/common';

import { createHash } from 'crypto';

import RedisStore from 'connect-redis';
import { createClient, type RedisClientType } from 'redis';

import type session from 'express-session';

import { CacheStorageType } from 'src/engine/core-modules/cache-storage/types/cache-storage-type.enum';
import { type TwentyConfigService } from 'src/engine/core-modules/twenty-config/twenty-config.service';

const sessionStorageLogger = new Logger('SessionStorage');
const SESSION_REDIS_CONNECT_TIMEOUT_MS = 2000;
const SESSION_REDIS_KEEP_ALIVE_MS = 5000;
const SESSION_REDIS_MAX_RECONNECT_DELAY_MS = 2000;
const SESSION_REDIS_PING_INTERVAL_MS = 10000;

export const SESSION_REDIS_OPERATION_TIMEOUT_MS = 1000;

type RedisSessionCommand =
  | 'connect'
  | 'destroy'
  | 'expire'
  | 'get'
  | 'mGet'
  | 'scanIterator'
  | 'set';

type RedisSessionSetOptions = {
  EX?: number;
};

type RedisSessionScanIteratorOptions = {
  COUNT?: number;
  MATCH?: string;
};

type RedisSessionStoreClient = {
  del: (key: string | string[]) => Promise<number>;
  expire: (key: string, ttl: number) => Promise<number | boolean>;
  get: (key: string) => Promise<string | null>;
  mGet: (keys: string[]) => Promise<(string | null)[]>;
  scanIterator: (
    options: RedisSessionScanIteratorOptions,
  ) => AsyncIterable<string>;
  set: (
    key: string,
    value: string,
    options?: RedisSessionSetOptions,
  ) => Promise<string | null>;
};

class RedisSessionOperationTimeoutError extends Error {
  constructor(command: RedisSessionCommand, timeoutMs: number) {
    super(
      `[SessionStorage] redis session ${command} timed out after ${timeoutMs}ms`,
    );
  }
}

let redisSessionClient: RedisClientType | null = null;
let redisSessionClientUrl: string | null = null;
let redisSessionConnectPromise: Promise<void> | null = null;
let hasLoggedRedisSessionDisconnect = false;

const getErrorMessage = (err: unknown): string =>
  err instanceof Error ? err.message : 'unknown error';

const resetRedisSessionClient = (client?: RedisClientType) => {
  if (client !== undefined && client !== redisSessionClient) {
    return;
  }

  redisSessionClient = null;
  redisSessionClientUrl = null;
  redisSessionConnectPromise = null;
};

const runWithRedisSessionTimeout = async <T>(
  command: RedisSessionCommand,
  timeoutMs: number,
  operation: () => Promise<T> | T,
): Promise<T> => {
  let timeout: ReturnType<typeof setTimeout> | undefined;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeout = setTimeout(() => {
      reject(new RedisSessionOperationTimeoutError(command, timeoutMs));
    }, timeoutMs);
  });

  try {
    return await Promise.race([
      Promise.resolve().then(operation),
      timeoutPromise,
    ]);
  } finally {
    if (timeout !== undefined) {
      clearTimeout(timeout);
    }
  }
};

const attachRedisSessionClientHandlers = (
  client: RedisClientType,
): RedisClientType => {
  client.on('error', (err) => {
    if (hasLoggedRedisSessionDisconnect) {
      return;
    }

    hasLoggedRedisSessionDisconnect = true;

    sessionStorageLogger.error(
      `[SessionStorage] redis session client error: ${err.message}`,
    );
  });

  client.on('end', () => {
    resetRedisSessionClient(client);
    sessionStorageLogger.warn('[SessionStorage] redis session client ended');
  });

  client.on('ready', () => {
    if (hasLoggedRedisSessionDisconnect) {
      sessionStorageLogger.log(
        '[SessionStorage] redis session client reconnected',
      );
    }

    hasLoggedRedisSessionDisconnect = false;
  });

  return client;
};

const getRedisSessionClient = (connectionString: string): RedisClientType => {
  try {
    if (
      redisSessionClient === null ||
      redisSessionClientUrl !== connectionString
    ) {
      redisSessionClient = attachRedisSessionClientHandlers(
        createClient({
          url: connectionString,
          pingInterval: SESSION_REDIS_PING_INTERVAL_MS,
          socket: {
            connectTimeout: SESSION_REDIS_CONNECT_TIMEOUT_MS,
            keepAlive: SESSION_REDIS_KEEP_ALIVE_MS,
            reconnectStrategy: (retries) =>
              Math.min(retries * 50, SESSION_REDIS_MAX_RECONNECT_DELAY_MS),
          },
        }),
      );
      redisSessionClientUrl = connectionString;
      redisSessionConnectPromise = null;
    }

    return redisSessionClient;
  } catch (err: unknown) {
    resetRedisSessionClient();
    throw err;
  }
};

const connectRedisSessionClient = async (
  connectionString: string,
  client: RedisClientType,
): Promise<void> => {
  if (client.isReady) {
    return;
  }

  if (!client.isOpen && redisSessionConnectPromise === null) {
    redisSessionConnectPromise = runWithRedisSessionTimeout(
      'connect',
      SESSION_REDIS_CONNECT_TIMEOUT_MS,
      async () => {
        await client.connect();
      },
    )
      .catch((err: unknown) => {
        const message = getErrorMessage(err);

        resetRedisSessionClient(client);
        sessionStorageLogger.error(
          `[SessionStorage] redis session connection failed: ${message}`,
        );
        throw err;
      })
      .finally(() => {
        if (
          redisSessionClient === client &&
          redisSessionClientUrl === connectionString
        ) {
          redisSessionConnectPromise = null;
        }
      });
  }

  if (redisSessionConnectPromise !== null) {
    await redisSessionConnectPromise;
  }

  if (!client.isReady) {
    throw new Error('[SessionStorage] redis session client is not ready');
  }
};

const runRedisSessionCommand = async <T>(
  connectionString: string,
  command: RedisSessionCommand,
  operation: (client: RedisClientType) => Promise<T> | T,
): Promise<T> => {
  const client = getRedisSessionClient(connectionString);

  try {
    await connectRedisSessionClient(connectionString, client);

    return await runWithRedisSessionTimeout(
      command,
      SESSION_REDIS_OPERATION_TIMEOUT_MS,
      () => operation(client),
    );
  } catch (err: unknown) {
    const message = getErrorMessage(err);

    if (err instanceof RedisSessionOperationTimeoutError || !client.isOpen) {
      resetRedisSessionClient(client);
    }

    sessionStorageLogger.error(
      `[SessionStorage] redis session ${command} failed: ${message}`,
    );

    throw err;
  }
};

const buildBoundedRedisSessionClient = (
  connectionString: string,
): RedisSessionStoreClient => ({
  del: (key) =>
    runRedisSessionCommand(connectionString, 'destroy', (client) =>
      client.del(key),
    ),
  expire: (key, ttl) =>
    runRedisSessionCommand(connectionString, 'expire', (client) =>
      client.expire(key, ttl),
    ),
  get: (key) =>
    runRedisSessionCommand(connectionString, 'get', (client) =>
      client.get(key),
    ),
  mGet: (keys) =>
    runRedisSessionCommand(connectionString, 'mGet', (client) =>
      client.mGet(keys),
    ),
  scanIterator: async function* (options) {
    const client = getRedisSessionClient(connectionString);

    try {
      await connectRedisSessionClient(connectionString, client);

      for await (const key of client.scanIterator(options)) {
        yield key;
      }
    } catch (err: unknown) {
      sessionStorageLogger.error(
        `[SessionStorage] redis session scanIterator failed: ${getErrorMessage(err)}`,
      );
      throw err;
    }
  },
  set: (key, value, options) =>
    runRedisSessionCommand(connectionString, 'set', (client) =>
      client.set(key, value, options),
    ),
});

export const getSessionStorageOptions = (
  twentyConfigService: TwentyConfigService,
): session.SessionOptions => {
  const cacheStorageType = CacheStorageType.Redis;

  const SERVER_URL = twentyConfigService.get('SERVER_URL');

  const appSecret = twentyConfigService.get('APP_SECRET');

  if (!appSecret) {
    throw new Error('APP_SECRET is not set');
  }

  const sessionSecret = createHash('sha256')
    .update(`${appSecret}SESSION_STORE_SECRET`)
    .digest('hex');

  const sessionStorage: session.SessionOptions = {
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    proxy: true,
    cookie: {
      secure: !!(SERVER_URL && SERVER_URL.startsWith('https')),
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 1000 * 60 * 30, // 30 minutes
    },
  };

  switch (cacheStorageType) {
    /* case CacheStorageType.Memory: {
      Logger.warn(
        'Memory session storage is not recommended for production. Prefer Redis.',
      );

      return sessionStorage;
    }*/
    case CacheStorageType.Redis: {
      const connectionString = twentyConfigService.get('REDIS_URL');

      if (!connectionString) {
        throw new Error(
          `${CacheStorageType.Redis} session storage requires REDIS_URL to be defined, check your .env file`,
        );
      }

      return {
        ...sessionStorage,
        store: new RedisStore({
          client: buildBoundedRedisSessionClient(connectionString),
          prefix: 'engine:session:',
        }),
      };
    }
    default:
      throw new Error(
        `Invalid session-storage (${cacheStorageType}), check your .env file`,
      );
  }
};
