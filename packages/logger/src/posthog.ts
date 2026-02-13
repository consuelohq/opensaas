import type { PostHog as PostHogClient } from 'posthog-node';
import type { Transport, LogEntry } from './index.js';

export interface PostHogTransportConfig {
  apiKey: string;
  host?: string;
}

export class PostHogTransport implements Transport {
  private client: PostHogClient | null = null;
  private config: PostHogTransportConfig;

  constructor(config: PostHogTransportConfig) {
    this.config = config;
  }

  private async getClient(): Promise<PostHogClient> {
    if (!this.client) {
      const { PostHog } = await import('posthog-node');
      this.client = new PostHog(this.config.apiKey, {
        host: this.config.host ?? 'https://us.i.posthog.com',
        flushAt: 20,
        flushInterval: 10000,
      });
    }
    return this.client;
  }

  send(entry: LogEntry): void {
    const distinctId = (entry.attributes?.userId as string) ?? 'system';

    this.getClient().then(client => {
      client.capture({
        distinctId,
        event: `log:${entry.level}`,
        properties: {
          message: entry.message,
          component: entry.component,
          timestamp: entry.timestamp,
          level: entry.level,
          ...entry.attributes,
        },
      });
    }).catch(() => { /* posthog transport errors should not crash the app */ });
  }

  async shutdown(): Promise<void> {
    await this.client?.shutdown();
  }
}
