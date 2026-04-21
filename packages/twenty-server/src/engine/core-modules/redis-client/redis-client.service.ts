import { Inject, Injectable, Logger, type OnModuleDestroy } from '@nestjs/common';

import IORedis, { type RedisOptions } from 'ioredis';
import { RedisPubSub } from 'graphql-redis-subscriptions';
import { isDefined } from 'twenty-shared/utils';

import { TwentyConfigService } from 'src/engine/core-modules/twenty-config/twenty-config.service';

type RedisClientLabel =
  | 'request'
  | 'queue'
  | 'pubsub-base'
  | 'pubsub-publisher'
  | 'pubsub-subscriber';

type RedisClientRole = 'request' | 'queue' | 'pubsub';

type RedisConnectionOptions = RedisOptions & {
  url: string;
};

const REDIS_LIFECYCLE_LOG_COOLDOWN_MS = 30000;

@Injectable()
export class RedisClientService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisClientService.name);
  private readonly lastLifecycleLogAt = new Map<string, number>();

  private redisClient: IORedis | null = null;
  private redisQueueClient: IORedis | null = null;
  private redisPubSubBaseClient: IORedis | null = null;
  private redisPubSubClient: RedisPubSub | null = null;

  constructor(
    @Inject(TwentyConfigService)
    private readonly twentyConfigService: TwentyConfigService,
  ) {}

  private shouldLogLifecycleEvent(key: string): boolean {
    const now = Date.now();
    const lastLoggedAt = this.lastLifecycleLogAt.get(key) ?? 0;

    if (now - lastLoggedAt < REDIS_LIFECYCLE_LOG_COOLDOWN_MS) {
      return false;
    }

    this.lastLifecycleLogAt.set(key, now);

    return true;
  }

  private logLifecycleEvent(
    level: 'log' | 'warn' | 'error',
    label: RedisClientLabel,
    event: string,
    details?: Record<string, unknown>,
  ) {
    const detailsSuffix = isDefined(details)
      ? ` ${JSON.stringify(details)}`
      : '';
    const message = `redis ${label} ${event}${detailsSuffix}`;
    const dedupeKey = `${label}:${event}:${details?.['message'] ?? ''}:${details?.['delayMs'] ?? ''}`;

    if (!this.shouldLogLifecycleEvent(dedupeKey)) {
      return;
    }

    switch (level) {
      case 'error':
        this.logger.error(message);
        break;
      case 'warn':
        this.logger.warn(message);
        break;
      default:
        this.logger.log(message);
        break;
    }
  }

  private getRedisUrl(role: RedisClientRole): string {
    if (role === 'queue') {
      const redisQueueUrl =
        this.twentyConfigService.get('REDIS_QUEUE_URL') ??
        this.twentyConfigService.get('REDIS_URL');

      if (!redisQueueUrl) {
        throw new Error('REDIS_QUEUE_URL or REDIS_URL must be defined');
      }

      return redisQueueUrl;
    }

    const redisUrl = this.twentyConfigService.get('REDIS_URL');

    if (!redisUrl) {
      throw new Error('REDIS_URL must be defined');
    }

    return redisUrl;
  }

  private buildRedisOptions(role: RedisClientRole): RedisOptions {
    return {
      connectTimeout: 10000,
      enableReadyCheck: true,
      keepAlive: 10000,
      maxRetriesPerRequest: role === 'request' ? 1 : null,
      retryStrategy: (times) => Math.min(times * 250, 5000),
    };
  }

  private createRedisClient(
    label: RedisClientLabel,
    role: RedisClientRole,
    onEnd: () => void,
  ): IORedis {
    const client = new IORedis(
      this.getRedisUrl(role),
      this.buildRedisOptions(role),
    );

    this.attachLifecycleHandlers(client, label, onEnd);

    return client;
  }

  private attachLifecycleHandlers(
    client: IORedis,
    label: RedisClientLabel,
    onEnd: () => void,
  ) {
    client.on('connect', () => {
      this.logLifecycleEvent('log', label, 'connect');
    });

    client.on('ready', () => {
      this.logLifecycleEvent('log', label, 'ready');
    });

    client.on('reconnecting', (delay: number) => {
      this.logLifecycleEvent('warn', label, 'reconnecting', { delayMs: delay });
    });

    client.on('close', () => {
      this.logLifecycleEvent('warn', label, 'close', { status: client.status });
    });

    client.on('end', () => {
      onEnd();
      this.logLifecycleEvent('warn', label, 'end');
    });

    client.on('error', (err) => {
      const redisError = err as NodeJS.ErrnoException;

      this.logLifecycleEvent('error', label, 'error', {
        code: redisError.code ?? null,
        message: redisError.message,
        status: client.status,
      });
    });
  }

  private getPubSubBaseClient(): IORedis {
    if (!this.redisPubSubBaseClient) {
      this.redisPubSubBaseClient = this.createRedisClient(
        'pubsub-base',
        'pubsub',
        () => {
          this.redisPubSubBaseClient = null;
          this.redisPubSubClient = null;
        },
      );
    }

    return this.redisPubSubBaseClient;
  }

  getQueueConnectionOptions(): RedisConnectionOptions {
    return {
      ...this.buildRedisOptions('queue'),
      url: this.getRedisUrl('queue'),
    };
  }

  getQueueClient(): IORedis {
    if (!this.redisQueueClient) {
      this.redisQueueClient = this.createRedisClient('queue', 'queue', () => {
        this.redisQueueClient = null;
      });
    }

    return this.redisQueueClient;
  }

  getClient(): IORedis {
    if (!this.redisClient) {
      this.redisClient = this.createRedisClient('request', 'request', () => {
        this.redisClient = null;
      });
    }

    return this.redisClient;
  }

  getPubSubClient(): RedisPubSub {
    if (!this.redisPubSubClient) {
      const redisClient = this.getPubSubBaseClient();

      const publisher = redisClient.duplicate(this.buildRedisOptions('pubsub'));
      const subscriber = redisClient.duplicate(this.buildRedisOptions('pubsub'));

      this.attachLifecycleHandlers(publisher, 'pubsub-publisher', () => {
        this.redisPubSubClient = null;
      });
      this.attachLifecycleHandlers(subscriber, 'pubsub-subscriber', () => {
        this.redisPubSubClient = null;
      });

      this.redisPubSubClient = new RedisPubSub({
        publisher: publisher as never,
        subscriber: subscriber as never,
      });
    }

    return this.redisPubSubClient;
  }

  async onModuleDestroy() {
    if (isDefined(this.redisPubSubClient)) {
      await this.redisPubSubClient.close();
      this.redisPubSubClient = null;
    }

    if (isDefined(this.redisPubSubBaseClient)) {
      await this.redisPubSubBaseClient.quit();
      this.redisPubSubBaseClient = null;
    }

    if (isDefined(this.redisQueueClient)) {
      await this.redisQueueClient.quit();
      this.redisQueueClient = null;
    }

    if (isDefined(this.redisClient)) {
      await this.redisClient.quit();
      this.redisClient = null;
    }
  }
}
