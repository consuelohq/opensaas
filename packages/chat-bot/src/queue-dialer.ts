/** @jsxImportSource chat */
import { createLogger } from '@consuelo/logger';
import type { DiscordAuth } from './auth.js';
import { createApiClient } from './api-client.js';

const logger = createLogger('chat-bot:queue-dialer');

type QueueMode = 'power' | 'preview';

type ActiveQueueState = {
  queueId: string;
  queueName: string;
  mode: QueueMode;
  repPhone: string;
  auth: DiscordAuth;
  consueloUserId: string;
};

export type CallEvent = {
  type: string;
  callId: string;
  conferenceName?: string;
  contactId?: string;
  userId?: string;
  duration?: number;
  reason?: string;
  timestamp: string;
};

type QueueItem = {
  id: string;
  contact_id: string;
  position: number;
  status: string;
};

type QueueAnalytics = {
  totalCalls: number;
  answeredCount: number;
  answerRatePercentage: number;
  avgCallDurationSeconds: number;
  callsPerHour: number;
  outcomeBreakdown: Record<string, number>;
};

type Contact = {
  id: string;
  name: string;
  phone: string;
  company?: string;
};

type QueueRecord = {
  id: string;
  name: string;
  status: string;
  total_contacts: number;
  completed_contacts: number;
  skipped_contacts: number;
};

type ReplyFn = (content: unknown) => Promise<void>;
type CallEndedFn = (callId: string, discordUserId: string, auth: DiscordAuth) => Promise<void>;

export type QueueDialerConfig = {
  apiUrl: string;
  redisUrl?: string;
};

export class QueueDialer {
  // keyed by discordUserId
  private activeQueues = new Map<string, ActiveQueueState>();
  private redisSubscriber: unknown = null;
  private replyCallbacks = new Map<string, ReplyFn>();
  private callEndedCallbacks = new Map<string, CallEndedFn>();
  private callEventCallbacks: Array<(event: CallEvent) => void> = [];

  constructor(private config: QueueDialerConfig) {}

  setReplyCallback(discordUserId: string, replyFn: ReplyFn): void {
    this.replyCallbacks.set(discordUserId, replyFn);
  }

  setCallEndedCallback(discordUserId: string, fn: CallEndedFn): void {
    this.callEndedCallbacks.set(discordUserId, fn);
  }

  onCallEvent(callback: (event: CallEvent) => void): void {
    this.callEventCallbacks.push(callback);
  }

  getReplyCallback(discordUserId: string): ReplyFn | undefined {
    return this.replyCallbacks.get(discordUserId);
  }

  private userClient(auth: DiscordAuth) {
    return createApiClient({ baseUrl: this.config.apiUrl, apiKey: auth.apiKey });
  }

  async startQueue(
    auth: DiscordAuth,
    discordUserId: string,
    queueId: string,
    mode: QueueMode,
    repPhone: string,
  ): Promise<{ queue: QueueRecord; currentItem: QueueItem | null; error?: string }> {
    try {
      const client = this.userClient(auth);

      // get the consuelo userId from the API (the one call events will reference)
      type MeResponse = { userId?: string; id?: string };
      let consueloUserId = '';
      try {
        const me = await client.get<MeResponse>('/v1/users/me');
        consueloUserId = me?.userId ?? me?.id ?? '';
      } catch {
        // non-fatal: auto-dial matching may not work
      }

      const result = await client.post<{ currentItem: QueueItem | null } & QueueRecord>(
        `/v1/queues/${queueId}/start`,
      );

      this.activeQueues.set(discordUserId, {
        queueId,
        queueName: result.name ?? queueId,
        mode,
        repPhone,
        auth,
        consueloUserId,
      });

      if (result.currentItem) {
        await this.dialQueueItem(auth, queueId, result.currentItem, repPhone);
      }

      return { queue: result, currentItem: result.currentItem };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'unknown error';
      logger.error('failed to start queue', { queueId, error: message });
      return { queue: {} as QueueRecord, currentItem: null, error: message };
    }
  }

  async pauseQueue(auth: DiscordAuth, queueId: string): Promise<QueueRecord | null> {
    try {
      const client = this.userClient(auth);
      return await client.post<QueueRecord>(`/v1/queues/${queueId}/pause`);
    } catch (err: unknown) {
      logger.error('failed to pause queue', { error: err instanceof Error ? err.message : 'unknown' });
      return null;
    }
  }

  async resumeQueue(
    auth: DiscordAuth,
    discordUserId: string,
    queueId: string,
  ): Promise<{ queue: QueueRecord; currentItem: QueueItem | null } | null> {
    try {
      const client = this.userClient(auth);
      const result = await client.post<{ currentItem: QueueItem | null } & QueueRecord>(
        `/v1/queues/${queueId}/resume`,
      );

      const state = this.activeQueues.get(discordUserId);
      if (state && result.currentItem) {
        await this.dialQueueItem(auth, queueId, result.currentItem, state.repPhone);
      }

      return { queue: result, currentItem: result.currentItem };
    } catch (err: unknown) {
      logger.error('failed to resume queue', { error: err instanceof Error ? err.message : 'unknown' });
      return null;
    }
  }

  async stopQueue(auth: DiscordAuth, discordUserId: string, queueId: string): Promise<QueueRecord | null> {
    try {
      const client = this.userClient(auth);
      const result = await client.post<QueueRecord>(`/v1/queues/${queueId}/pause`);
      this.activeQueues.delete(discordUserId);
      return result;
    } catch (err: unknown) {
      logger.error('failed to stop queue', { error: err instanceof Error ? err.message : 'unknown' });
      return null;
    }
  }

  async getAnalytics(auth: DiscordAuth, queueId: string): Promise<QueueAnalytics | null> {
    try {
      const client = this.userClient(auth);
      return await client.get<QueueAnalytics>(`/v1/queues/${queueId}/analytics`);
    } catch (err: unknown) {
      logger.error('failed to get analytics', { error: err instanceof Error ? err.message : 'unknown' });
      return null;
    }
  }

  async getQueueWithItems(auth: DiscordAuth, queueId: string): Promise<(QueueRecord & { items: QueueItem[] }) | null> {
    try {
      const client = this.userClient(auth);
      return await client.get<QueueRecord & { items: QueueItem[] }>(`/v1/queues/${queueId}`);
    } catch (err: unknown) {
      logger.error('failed to get queue', { error: err instanceof Error ? err.message : 'unknown' });
      return null;
    }
  }

  async listQueues(auth: DiscordAuth): Promise<QueueRecord[]> {
    try {
      const client = this.userClient(auth);
      return await client.get<QueueRecord[]>('/v1/queues');
    } catch (err: unknown) {
      logger.error('failed to list queues', { error: err instanceof Error ? err.message : 'unknown' });
      return [];
    }
  }

  async advanceAndDial(
    auth: DiscordAuth,
    discordUserId: string,
    queueId: string,
  ): Promise<{ nextItem: QueueItem | null; queueCompleted?: boolean }> {
    try {
      const client = this.userClient(auth);
      const result = await client.post<{ nextItem: QueueItem | null; queueCompleted?: boolean }>(
        `/v1/queues/${queueId}/next`,
      );

      const state = this.activeQueues.get(discordUserId);
      if (result.nextItem && state?.mode === 'power') {
        await this.dialQueueItem(auth, queueId, result.nextItem, state.repPhone);
      }

      if (result.queueCompleted) {
        this.activeQueues.delete(discordUserId);
      }

      return result;
    } catch (err: unknown) {
      logger.error('failed to advance queue', { error: err instanceof Error ? err.message : 'unknown' });
      return { nextItem: null };
    }
  }

  private async dialQueueItem(
    auth: DiscordAuth,
    queueId: string,
    item: QueueItem,
    repPhone: string,
  ): Promise<void> {
    try {
      const client = this.userClient(auth);
      const contact = await client.get<Contact>(`/v1/contacts/${item.contact_id}`);
      if (!contact?.phone) {
        logger.warn('contact has no phone, skipping', { contactId: item.contact_id });
        return;
      }

      await client.post('/v1/calls/initiate-phone', {
        repPhone,
        leadPhone: contact.phone,
        localPresence: true,
        queueId,
        contactId: item.contact_id,
      });
    } catch (err: unknown) {
      logger.error('failed to dial queue item', {
        contactId: item.contact_id,
        error: err instanceof Error ? err.message : 'unknown',
      });
    }
  }

  async dialCurrentItem(auth: DiscordAuth, discordUserId: string): Promise<boolean> {
    const state = this.activeQueues.get(discordUserId);
    if (!state) return false;

    try {
      const client = this.userClient(auth);
      const queue = await client.get<QueueRecord & { items: QueueItem[] }>(`/v1/queues/${state.queueId}`);
      const currentItem = queue?.items?.find((i: QueueItem) => i.status === 'calling');
      if (!currentItem) return false;

      await this.dialQueueItem(auth, state.queueId, currentItem, state.repPhone);
      return true;
    } catch (err: unknown) {
      logger.error('failed to dial current item', { error: err instanceof Error ? err.message : 'unknown' });
      return false;
    }
  }

  getActiveQueueId(discordUserId: string): string | undefined {
    return this.activeQueues.get(discordUserId)?.queueId;
  }

  getActiveMode(discordUserId: string): QueueMode | undefined {
    return this.activeQueues.get(discordUserId)?.mode;
  }

  // subscribe to redis call events for auto-dial loop
  async startCallEventListener(): Promise<void> {
    try {
      const { default: IORedis } = await import('ioredis');
      const redisUrl = this.config.redisUrl ?? process.env.REDIS_URL;
      if (!redisUrl) {
        logger.warn('REDIS_URL not set, auto-dial loop disabled');
        return;
      }

      const subscriber = new IORedis(redisUrl);
      this.redisSubscriber = subscriber;

      await subscriber.subscribe('consuelo:call-events');
      logger.info('subscribed to call events for auto-dial loop');

      subscriber.on('message', (_channel: string, message: string) => {
        this.handleCallEvent(message).catch((err: unknown) => {
          logger.error('call event handler failed', {
            error: err instanceof Error ? err.message : 'unknown',
          });
        });
      });
    } catch (err: unknown) {
      logger.error('failed to start call event listener', {
        error: err instanceof Error ? err.message : 'unknown',
      });
    }
  }

  private async handleCallEvent(message: string): Promise<void> {
    let event: CallEvent;
    try {
      event = JSON.parse(message) as CallEvent;
    } catch {
      return;
    }

    // broadcast to external listeners (transfer manager, etc.)
    for (const callback of this.callEventCallbacks) {
      try {
        callback(event);
      } catch {
        // non-fatal
      }
    }

    if (event.type !== 'call.ended' && event.type !== 'call.failed') return;
    if (!event.callId || !event.userId) return;

    // find the discord user for this consuelo userId
    let discordUserId: string | undefined;
    let activeState: ActiveQueueState | undefined;
    for (const [key, state] of this.activeQueues) {
      if (state.consueloUserId === event.userId) {
        discordUserId = key;
        activeState = state;
        break;
      }
    }

    if (!discordUserId || !activeState) return;

    // post the post-call card — disposition buttons trigger queue advance
    const callEndedFn = this.callEndedCallbacks.get(discordUserId);
    if (callEndedFn) {
      try {
        await callEndedFn(event.callId, discordUserId, activeState.auth);
      } catch (err: unknown) {
        logger.error('post-call card callback failed', {
          error: err instanceof Error ? err.message : 'unknown',
        });
      }
    }
  }

  // called after disposition to advance queue
  async advanceAfterDisposition(
    discordUserId: string,
  ): Promise<{ nextItem: QueueItem | null; queueCompleted?: boolean } | null> {
    const activeState = this.activeQueues.get(discordUserId);
    if (!activeState) return null;

    const result = await this.advanceAndDial(activeState.auth, discordUserId, activeState.queueId);
    const replyFn = this.replyCallbacks.get(discordUserId);

    if (result.queueCompleted && replyFn) {
      try {
        const analytics = await this.getAnalytics(activeState.auth, activeState.queueId);
        if (analytics) {
          await replyFn(formatSummaryText(activeState.queueName, analytics));
        }
      } catch (err: unknown) {
        logger.error('failed to post queue summary', {
          error: err instanceof Error ? err.message : 'unknown',
        });
      }
    } else if (result.nextItem && activeState.mode === 'preview' && replyFn) {
      try {
        const client = this.userClient(activeState.auth);
        const contact = await client.get<Contact>(`/v1/contacts/${result.nextItem.contact_id}`);
        const name = contact?.name ?? 'Unknown';
        const phone = contact?.phone ?? 'N/A';
        const company = contact?.company ? ` \u2022 ${contact.company}` : '';
        await replyFn(
          `\uD83D\uDC64 Next: **${name}** \u2014 ${phone}${company}\nRun \`/consuelo queue call\` to dial.`,
        );
      } catch (err: unknown) {
        logger.error('failed to post preview card', {
          error: err instanceof Error ? err.message : 'unknown',
        });
      }
    }

    return result;
  }

  async stop(): Promise<void> {
    if (this.redisSubscriber) {
      const sub = this.redisSubscriber as { disconnect: () => void };
      sub.disconnect();
      this.redisSubscriber = null;
    }
  }
}

export function formatSummaryText(queueName: string, analytics: QueueAnalytics): string {
  const outcomes = analytics.outcomeBreakdown;
  const outcomeLines = Object.entries(outcomes)
    .map(([outcome, count]) => `  ${outcome}: ${count}`)
    .join('\n');

  return [
    `\u2705 Queue Complete: ${queueName}`,
    '',
    `Total Calls: ${analytics.totalCalls}`,
    `Connect Rate: ${analytics.answerRatePercentage}%`,
    `Avg Duration: ${formatDuration(analytics.avgCallDurationSeconds)}`,
    `Calls/Hour: ${analytics.callsPerHour}`,
    '',
    'Outcomes:',
    outcomeLines || '  (none)',
  ].join('\n');
}

export function formatProgressText(
  queue: QueueRecord,
  analytics: QueueAnalytics | null,
  mode: string,
): string {
  const total = queue.total_contacts ?? 0;
  const completed = queue.completed_contacts ?? 0;
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
  const barFilled = Math.round(pct / 10);
  const bar = '\u2588'.repeat(barFilled) + '\u2591'.repeat(10 - barFilled);

  const lines = [
    `\uD83D\uDCCA Queue: ${queue.name}`,
    `Progress: ${bar} ${completed}/${total} (${pct}%)`,
    `Mode: ${mode} | Status: ${queue.status}`,
  ];

  if (analytics) {
    lines.push('', 'Stats:', `  \u2705 Connected: ${analytics.answeredCount}`);
    for (const [outcome, count] of Object.entries(analytics.outcomeBreakdown)) {
      if (outcome !== 'connected') {
        lines.push(`  ${outcome}: ${count}`);
      }
    }
  }

  return lines.join('\n');
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}
