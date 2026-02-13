import { loadConfig } from './config.js';

let Sentry: typeof import('@sentry/node') | null = null;
let initialized = false;

export async function initSentry(): Promise<void> {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn || process.argv.includes('--no-telemetry')) return;

  try {
    Sentry = await import('@sentry/node');
  } catch {
    return;
  }

  Sentry.init({
    dsn,
    release: process.env.npm_package_version ?? '0.0.1',
    environment: process.env.NODE_ENV ?? 'production',
    beforeSend(event) {
      const sensitiveKeys = ['twilioAuthToken', 'llmApiKey', 'twilioAccountSid', 'apiKey', 'token', 'password'];
      // scrub sensitive data from extras
      if (event.extra) {
        for (const key of sensitiveKeys) delete event.extra[key];
      }
      // scrub breadcrumb data
      if (event.breadcrumbs) {
        for (const bc of event.breadcrumbs) {
          if (bc.data) {
            for (const key of sensitiveKeys) delete bc.data[key];
          }
        }
      }
      return event;
    },
  });

  const config = loadConfig();
  Sentry.setTag('managed', String(config.managed ?? false));
  initialized = true;
}

export function captureError(err: unknown, context?: { command?: string; category?: string }): void {
  if (!initialized || !Sentry) return;
  Sentry.captureException(err, {
    tags: {
      command: context?.command ?? 'unknown',
      category: context?.category ?? categorize(err),
    },
  });
}

function categorize(err: unknown): string {
  if (!(err instanceof Error)) return 'unknown';
  const msg = err.message.toLowerCase();
  if (msg.includes('not configured') || msg.includes('missing') || msg.includes('invalid')) return 'config';
  if (msg.includes('timeout') || msg.includes('econnrefused') || msg.includes('fetch')) return 'network';
  if (msg.includes('validation') || msg.includes('format') || msg.includes('phone')) return 'validation';
  return 'unknown';
}
