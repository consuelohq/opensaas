import { createLogger } from '@consuelo/logger';

const logger = createLogger('chat-bot:auth');

const REDIS_KEY_PREFIX = 'consuelo:discord:user:';

export type DiscordAuth = {
  workspaceId: string;
  userId: string;
  apiKey: string;
  linkedAt: string;
};

// cached ioredis client — lazy init, reset on failure
let redisClient: import('ioredis').default | null = null;

async function getRedis(): Promise<import('ioredis').default> {
  try {
    if (!redisClient) {
      const { default: Redis } = await import('ioredis');
      redisClient = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379');
    }
    return redisClient;
  } catch (err: unknown) {
    redisClient = null;
    throw err;
  }
}

export async function getAuth(discordUserId: string): Promise<DiscordAuth | null> {
  try {
    const redis = await getRedis();
    const raw = await redis.get(`${REDIS_KEY_PREFIX}${discordUserId}`);
    if (!raw) return null;
    return JSON.parse(raw) as DiscordAuth;
  } catch (err: unknown) {
    logger.error('failed to get auth', {
      discordUserId,
      error: err instanceof Error ? err.message : 'unknown',
    });
    return null;
  }
}

export async function setAuth(discordUserId: string, auth: Omit<DiscordAuth, 'linkedAt'>): Promise<void> {
  try {
    const redis = await getRedis();
    const value: DiscordAuth = { ...auth, linkedAt: new Date().toISOString() };
    await redis.set(`${REDIS_KEY_PREFIX}${discordUserId}`, JSON.stringify(value));
  } catch (err: unknown) {
    logger.error('failed to set auth', {
      discordUserId,
      error: err instanceof Error ? err.message : 'unknown',
    });
    throw err;
  }
}

export async function removeAuth(discordUserId: string): Promise<boolean> {
  try {
    const redis = await getRedis();
    const removed = await redis.del(`${REDIS_KEY_PREFIX}${discordUserId}`);
    return removed > 0;
  } catch (err: unknown) {
    logger.error('failed to remove auth', {
      discordUserId,
      error: err instanceof Error ? err.message : 'unknown',
    });
    return false;
  }
}
