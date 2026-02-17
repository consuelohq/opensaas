import * as Sentry from '@sentry/node';

// PostHog configuration from environment
const POSTHOG_API_KEY = process.env.POSTHOG_API_KEY;
const POSTHOG_HOST = process.env.POSTHOG_HOST ?? 'https://app.posthog.com';

// Lazy logger init — same pattern as coaching.ts
let loggerInstance: {
  error: (msg: string, meta?: Record<string, unknown>) => void;
  warn: (msg: string, meta?: Record<string, unknown>) => void;
  debug: (msg: string, meta?: Record<string, unknown>) => void;
} | null = null;
const getLogger = async () => {
  if (!loggerInstance) {
    try {
      // eslint-disable-next-line @nx/enforce-module-boundaries
      const { createLogger } = await import('@consuelo/logger');
      loggerInstance = createLogger('posthog');
    } catch {
      // fallback if logger package unavailable
      loggerInstance = {
        error: () => {},
        warn: () => {},
        debug: () => {},
      };
    }
  }
  return loggerInstance;
};

// LLM usage event interface
export interface LLMUsageEvent {
  userId: string;
  model: string;
  provider: string;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
  endpoint: string;
}

/**
 * Track LLM usage in PostHog for analytics and billing.
 * Falls back gracefully if PostHog is not configured.
 */
export async function trackLLMUsage(event: LLMUsageEvent): Promise<void> {
  const logger = await getLogger();

  // Skip if PostHog not configured
  if (!POSTHOG_API_KEY) {
    logger.debug('[PostHog] skipping LLM tracking — POSTHOG_API_KEY not set', {
      endpoint: event.endpoint,
    });
    return;
  }

  try {
    // Lazy import PostHog — it's an optional peer dependency
    const { PostHog } = await import('posthog-node');
    const client = new PostHog(POSTHOG_API_KEY, { host: POSTHOG_HOST });

    // Track the LLM usage event
    client.capture({
      distinctId: event.userId,
      event: 'llm_usage',
      properties: {
        model: event.model,
        provider: event.provider,
        input_tokens: event.inputTokens,
        output_tokens: event.outputTokens,
        latency_ms: event.latencyMs,
        endpoint: event.endpoint,
        total_tokens: event.inputTokens + event.outputTokens,
      },
    });

    // Flush immediately for serverless environments
    await client.shutdown();

    logger.debug('[PostHog] tracked LLM usage', {
      userId: event.userId,
      endpoint: event.endpoint,
      model: event.model,
    });
  } catch (err: unknown) {
    // Log but don't fail the request — tracking is non-critical
    const message = err instanceof Error ? err.message : 'Unknown error';
    logger.warn('[PostHog] failed to track LLM usage', {
      userId: event.userId,
      endpoint: event.endpoint,
      error: message,
    });
    Sentry.captureException(err, {
      level: 'warning',
      tags: { component: 'PostHogTracking' },
      extra: { event },
    });
  }
}
