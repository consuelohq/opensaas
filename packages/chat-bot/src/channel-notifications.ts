import { createLogger } from '@consuelo/logger';
import { getDiscordUserId } from './auth.js';

const logger = createLogger('chat-bot:notifications');

const CHANNEL_KEY_PREFIX = 'consuelo:workspace:';
const CHANNEL_KEY_SUFFIX = ':channel';
const CALL_EVENTS_CHANNEL = 'consuelo:call-events';
const RATE_LIMIT_WINDOW_MS = 10_000;
const RATE_LIMIT_THRESHOLD = 5;

type CallNotificationEvent = {
  type: string;
  callId?: string;
  userId?: string;
  workspaceId?: string;
  contactName?: string;
  contactPhone?: string;
  contactCompany?: string;
  userName?: string;
  duration?: number;
  reason?: string;
  disposition?: string;
  coachingScore?: number;
  coachingSummary?: string;
  queueName?: string;
  queueSize?: number;
  totalCalls?: number;
  connectRate?: number;
  interestedCount?: number;
  timestamp?: string;
};

type PendingBatch = {
  events: CallNotificationEvent[];
  timer: ReturnType<typeof setTimeout>;
};

export type ChannelNotifierConfig = {
  redisUrl?: string;
  discordBotToken?: string;
};

export class ChannelNotifier {
  private redisSubscriber: unknown = null;
  private redisClient: import('ioredis').default | null = null;
  private pendingBatches = new Map<string, PendingBatch>();
  private config: ChannelNotifierConfig;

  constructor(config: ChannelNotifierConfig) {
    this.config = config;
  }

  private async getRedis(): Promise<import('ioredis').default> {
    try {
      if (!this.redisClient) {
        const { default: IORedis } = await import('ioredis');
        this.redisClient = new IORedis(this.config.redisUrl ?? process.env.REDIS_URL ?? 'redis://localhost:6379');
      }
      return this.redisClient;
    } catch (err: unknown) {
      this.redisClient = null;
      throw err;
    }
  }

  async setChannel(workspaceId: string, channelId: string): Promise<void> {
    const redis = await this.getRedis();
    await redis.set(`${CHANNEL_KEY_PREFIX}${workspaceId}${CHANNEL_KEY_SUFFIX}`, channelId);
  }

  async getChannel(workspaceId: string): Promise<string | null> {
    const redis = await this.getRedis();
    return await redis.get(`${CHANNEL_KEY_PREFIX}${workspaceId}${CHANNEL_KEY_SUFFIX}`);
  }

  async start(): Promise<void> {
    try {
      const { default: IORedis } = await import('ioredis');
      const redisUrl = this.config.redisUrl ?? process.env.REDIS_URL;
      if (!redisUrl) {
        logger.warn('REDIS_URL not set, channel notifications disabled');
        return;
      }

      const subscriber = new IORedis(redisUrl);
      this.redisSubscriber = subscriber;

      await subscriber.subscribe(CALL_EVENTS_CHANNEL);
      logger.info('subscribed to call events for channel notifications');

      subscriber.on('message', (_channel: string, message: string) => {
        this.handleEvent(message).catch((err: unknown) => {
          logger.error('notification event handler failed', {
            error: err instanceof Error ? err.message : 'unknown',
          });
        });
      });
    } catch (err: unknown) {
      logger.error('failed to start channel notifier', {
        error: err instanceof Error ? err.message : 'unknown',
      });
    }
  }

  async stop(): Promise<void> {
    for (const [, batch] of this.pendingBatches) {
      clearTimeout(batch.timer);
    }
    this.pendingBatches.clear();

    if (this.redisSubscriber) {
      const sub = this.redisSubscriber as { disconnect: () => void };
      sub.disconnect();
      this.redisSubscriber = null;
    }

    if (this.redisClient) {
      this.redisClient.disconnect();
      this.redisClient = null;
    }
  }

  private async handleEvent(message: string): Promise<void> {
    let event: CallNotificationEvent;
    try {
      event = JSON.parse(message) as CallNotificationEvent;
    } catch {
      return;
    }

    const workspaceId = event.workspaceId;
    if (!workspaceId) return;

    const channelId = await this.getChannel(workspaceId);
    if (!channelId) return;

    // rate limiting: batch events per workspace
    const batch = this.pendingBatches.get(workspaceId);
    if (batch) {
      batch.events.push(event);
      if (batch.events.length >= RATE_LIMIT_THRESHOLD) {
        clearTimeout(batch.timer);
        this.pendingBatches.delete(workspaceId);
        await this.flushBatch(channelId, workspaceId, batch.events);
      }
      return;
    }

    // first event in window — set timer to flush after window
    const newBatch: PendingBatch = {
      events: [event],
      timer: setTimeout(() => {
        this.pendingBatches.delete(workspaceId);
        const events = newBatch.events;
        if (events.length === 1) {
          this.postNotification(channelId, workspaceId, events[0]).catch((err: unknown) => {
            logger.error('failed to post notification', {
              error: err instanceof Error ? err.message : 'unknown',
            });
          });
        } else {
          this.flushBatch(channelId, workspaceId, events).catch((err: unknown) => {
            logger.error('failed to flush batch', {
              error: err instanceof Error ? err.message : 'unknown',
            });
          });
        }
      }, RATE_LIMIT_WINDOW_MS),
    };
    this.pendingBatches.set(workspaceId, newBatch);
  }

  private async flushBatch(
    channelId: string,
    workspaceId: string,
    events: CallNotificationEvent[],
  ): Promise<void> {
    const lines: string[] = [];
    for (const event of events) {
      const line = await this.formatEvent(event, workspaceId);
      if (line) lines.push(line);
    }
    if (lines.length > 0) {
      await this.sendToChannel(channelId, lines.join('\n'));
    }
  }

  private async postNotification(
    channelId: string,
    workspaceId: string,
    event: CallNotificationEvent,
  ): Promise<void> {
    const message = await this.formatEvent(event, workspaceId);
    if (message) {
      await this.sendToChannel(channelId, message);
    }
  }

  private async formatEvent(
    event: CallNotificationEvent,
    workspaceId: string,
  ): Promise<string | null> {
    const mention = await this.resolveMention(workspaceId, event.userId);
    const contact = event.contactCompany ?? event.contactName ?? event.contactPhone ?? 'Unknown';
    const phone = event.contactPhone ? ` (${event.contactPhone})` : '';

    switch (event.type) {
      case 'call.started':
        return `\u{1F7E2} ${mention} calling ${contact}${phone}`;

      case 'call.connected':
        return `\u{1F4DE} ${mention} connected with ${contact}`;

      case 'call.ended': {
        const dur = event.duration ? ` (${formatDuration(event.duration)})` : '';
        return `\u2705 ${mention} completed call with ${contact}${dur}`;
      }

      case 'call.failed': {
        const reason = event.reason ? ` (${event.reason})` : '';
        return `\u274C ${mention} \u2014 call to ${contact} failed${reason}`;
      }

      case 'disposition.set': {
        const label = event.disposition ?? 'unknown';

        // win celebration for good outcomes with high coaching score
        if (
          (label === 'connected' || label === 'follow-up') &&
          event.coachingScore != null &&
          event.coachingScore >= 70
        ) {
          const summary = event.coachingSummary ? `\n${event.coachingSummary}` : '';
          return `\u{1F389} ${mention} just had a great call with ${contact}! Score: ${event.coachingScore}/100${summary}`;
        }
        return `\u{1F3AF} ${mention} marked ${contact} as "${label}"`;
      }

      case 'queue.started': {
        const name = event.queueName ?? 'Queue';
        const size = event.queueSize ?? 0;
        return `\u{1F4CB} ${mention} started queue: ${name} (${size} contacts)`;
      }

      case 'queue.completed': {
        const name = event.queueName ?? 'Queue';
        const total = event.totalCalls ?? 0;
        const rate = event.connectRate != null ? `, ${Math.round(event.connectRate)}% connect rate` : '';
        const interested = event.interestedCount != null ? `, ${event.interestedCount} interested` : '';
        return `\u{1F3C1} ${mention} finished queue: ${total} calls${rate}${interested}`;
      }

      default:
        return null;
    }
  }

  private async resolveMention(workspaceId: string, userId?: string): Promise<string> {
    if (!userId) return 'Someone';
    const discordId = await getDiscordUserId(workspaceId, userId);
    return discordId ? `<@${discordId}>` : 'A rep';
  }

  private async sendToChannel(channelId: string, content: string): Promise<void> {
    const token = this.config.discordBotToken ?? process.env.DISCORD_BOT_TOKEN;
    if (!token) {
      logger.warn('DISCORD_BOT_TOKEN not set, cannot send channel notification');
      return;
    }

    try {
      const response = await fetch(
        `https://discord.com/api/v10/channels/${channelId}/messages`,
        {
          method: 'POST',
          headers: {
            authorization: `Bot ${token}`,
            'content-type': 'application/json',
          },
          body: JSON.stringify({ content }),
        },
      );

      if (!response.ok) {
        const text = await response.text().catch(() => '');
        logger.error('discord api error', {
          status: response.status,
          channelId,
          body: text.slice(0, 200),
        });
      }
    } catch (err: unknown) {
      logger.error('failed to send discord message', {
        channelId,
        error: err instanceof Error ? err.message : 'unknown',
      });
    }
  }
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}
