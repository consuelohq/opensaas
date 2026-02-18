import {
  type BullMQDriverFactoryOptions,
  MessageQueueDriverType,
  type MessageQueueModuleOptions,
} from 'src/engine/core-modules/message-queue/interfaces';
import { type MetricsService } from 'src/engine/core-modules/metrics/metrics.service';
import { type RedisClientService } from 'src/engine/core-modules/redis-client/redis-client.service';
import { type TwentyConfigService } from 'src/engine/core-modules/twenty-config/twenty-config.service';

/**
 * MessageQueue Module factory
 * @returns MessageQueueModuleOptions
 * @param twentyConfigService
 * @param redisClientService
 * @param metricsService
 */
export const messageQueueModuleFactory = async (
  _twentyConfigService: TwentyConfigService,
  redisClientService: RedisClientService,
  metricsService: MetricsService,
): Promise<MessageQueueModuleOptions> => {
  const driverType = MessageQueueDriverType.BullMQ;

  switch (driverType) {
    case MessageQueueDriverType.BullMQ: {
      return {
        type: MessageQueueDriverType.BullMQ,
        options: {
          // HACK: ioredis Redis instance is structurally compatible with BullMQ's
          // connection type but has incompatible generic signatures. Using type
          // assertion to bridge the gap between ioredis v4 and BullMQ expectations.
          // TODO: DEV-XXX - investigate proper typing or version alignment
          connection: redisClientService.getQueueClient() as never,
        },
        metricsService,
      } satisfies BullMQDriverFactoryOptions;
    }
    default:
      throw new Error(
        `Invalid message queue driver type (${driverType}), check your .env file`,
      );
  }
};
