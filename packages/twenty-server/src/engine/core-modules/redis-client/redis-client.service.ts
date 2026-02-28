import { Injectable, Logger, type OnModuleDestroy } from '@nestjs/common';

import IORedis from 'ioredis';
import { isDefined } from 'twenty-shared/utils';
import { RedisPubSub } from 'graphql-redis-subscriptions';

import { TwentyConfigService } from 'src/engine/core-modules/twenty-config/twenty-config.service';

@Injectable()
export class RedisClientService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisClientService.name);
  private redisClient: IORedis | null = null;
  private redisQueueClient: IORedis | null = null;
  private redisPubSubClient: RedisPubSub | null = null;

  constructor(private readonly twentyConfigService: TwentyConfigService) {}

  private attachErrorHandler(client: IORedis, label: string) {
    client.on('error', (err) => {
      this.logger.error(`Redis ${label} error: ${err.message}`);
    });
  }

  getQueueClient() {
    if (!this.redisQueueClient) {
      const redisQueueUrl =
        this.twentyConfigService.get('REDIS_QUEUE_URL') ??
        this.twentyConfigService.get('REDIS_URL');

      if (!redisQueueUrl) {
        throw new Error('REDIS_QUEUE_URL or REDIS_URL must be defined');
      }

      this.redisQueueClient = new IORedis(redisQueueUrl, {
        maxRetriesPerRequest: null,
      });
      this.attachErrorHandler(this.redisQueueClient, 'queue');
    }

    return this.redisQueueClient;
  }

  getClient() {
    if (!this.redisClient) {
      const redisUrl = this.twentyConfigService.get('REDIS_URL');

      if (!redisUrl) {
        throw new Error('REDIS_URL must be defined');
      }

      this.redisClient = new IORedis(redisUrl, {
        maxRetriesPerRequest: null,
      });
      this.attachErrorHandler(this.redisClient, 'main');
    }

    return this.redisClient;
  }

  getPubSubClient() {
    if (!this.redisPubSubClient) {
      const redisClient = this.getClient();

      // HACK: ioredis duplicate() returns a different Redis type than graphql-redis-subscriptions expects
      // Type assertion needed to bridge version mismatch between ioredis and graphql-redis-subscriptions
      const publisher = redisClient.duplicate();
      const subscriber = redisClient.duplicate();

      this.attachErrorHandler(publisher, 'pubsub-publisher');
      this.attachErrorHandler(subscriber, 'pubsub-subscriber');

      this.redisPubSubClient = new RedisPubSub({
        publisher: publisher as never,
        subscriber: subscriber as never,
      });
    }

    return this.redisPubSubClient;
  }

  async onModuleDestroy() {
    if (isDefined(this.redisQueueClient)) {
      await this.redisQueueClient.quit();
      this.redisQueueClient = null;
    }
    if (isDefined(this.redisClient)) {
      await this.redisClient.quit();
      this.redisClient = null;
    }
    if (isDefined(this.redisPubSubClient)) {
      await this.redisPubSubClient.close();
      this.redisPubSubClient = null;
    }
  }
}
