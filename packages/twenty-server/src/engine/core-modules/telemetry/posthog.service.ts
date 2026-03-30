import { Injectable, Logger } from '@nestjs/common';
import * as Sentry from '@sentry/node';

import { isNonEmptyString } from '@sniptt/guards';
import type { PostHog as PostHogClient } from 'posthog-node';

import { type TwentyConfigService } from 'src/engine/core-modules/twenty-config/twenty-config.service';

type PostHogCaptureInput = {
  distinctId: string;
  event: string;
  properties?: Record<string, unknown>;
};

@Injectable()
export class PostHogService {
  private readonly logger = new Logger(PostHogService.name);
  private client: PostHogClient | null = null;

  constructor(private readonly twentyConfigService: TwentyConfigService) {}

  private async getClient(): Promise<PostHogClient | null> {
    const apiKey = this.twentyConfigService.get('POSTHOG_API_KEY');

    if (!isNonEmptyString(apiKey)) {
      return null;
    }

    if (this.client) {
      return this.client;
    }

    try {
      const { PostHog } = await import('posthog-node');

      this.client = new PostHog(apiKey, {
        host: this.twentyConfigService.get('POSTHOG_HOST'),
        flushAt: 20,
        flushInterval: 10000,
      });

      return this.client;
    } catch (error: unknown) {
      this.client = null;

      const message = error instanceof Error ? error.message : 'Unknown error';

      Sentry.captureException(error, {
        extra: { source: 'PostHogService.getClient' },
      });
      this.logger.warn(`Failed to initialize PostHog client: ${message}`);

      return null;
    }
  }

  async capture({
    distinctId,
    event,
    properties = {},
  }: PostHogCaptureInput): Promise<void> {
    try {
      const client = await this.getClient();

      if (!client) {
        return;
      }

      client.capture({
        distinctId,
        event,
        properties,
      });
    } catch (error: unknown) {
      this.client = null;

      const message = error instanceof Error ? error.message : 'Unknown error';

      Sentry.captureException(error, {
        extra: { source: 'PostHogService.capture', event },
      });
      this.logger.warn(`Failed to capture PostHog event ${event}: ${message}`);
    }
  }
}
