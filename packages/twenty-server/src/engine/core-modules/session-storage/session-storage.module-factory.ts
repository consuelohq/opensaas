import { Logger } from '@nestjs/common';

import { createHash } from 'crypto';

import RedisStore from 'connect-redis';
import { createClient, type RedisClientType } from 'redis';

import type session from 'express-session';

import { CacheStorageType } from 'src/engine/core-modules/cache-storage/types/cache-storage-type.enum';
import { type TwentyConfigService } from 'src/engine/core-modules/twenty-config/twenty-config.service';

const sessionStorageLogger = new Logger('SessionStorage');
const SESSION_REDIS_CONNECT_TIMEOUT_MS = 10000;
const SESSION_REDIS_KEEP_ALIVE_MS = 5000;
const SESSION_REDIS_MAX_RECONNECT_DELAY_MS = 2000;
const SESSION_REDIS_PING_INTERVAL_MS = 10000;

let redisSessionClient: RedisClientType | null = null;
let redisSessionClientUrl: string | null = null;
let isRedisSessionClientConnecting = false;
let hasLoggedRedisSessionDisconnect = false;

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
    }

    if (!redisSessionClient.isOpen && !isRedisSessionClientConnecting) {
      isRedisSessionClientConnecting = true;

      void redisSessionClient
        .connect()
        .catch((err: unknown) => {
          const message = err instanceof Error ? err.message : 'unknown error';

          sessionStorageLogger.error(
            `[SessionStorage] redis session connection failed: ${message}`,
          );
        })
        .finally(() => {
          isRedisSessionClientConnecting = false;
        });
    }

    return redisSessionClient;
  } catch (err: unknown) {
    redisSessionClient = null;
    redisSessionClientUrl = null;
    isRedisSessionClientConnecting = false;
    throw err;
  }
};

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

      const redisClient = getRedisSessionClient(connectionString);

      return {
        ...sessionStorage,
        store: new RedisStore({
          client: redisClient,
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
