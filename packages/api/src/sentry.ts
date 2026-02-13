import * as Sentry from '@sentry/node';
import type { Transport, LogEntry } from '@consuelo/logger';

export interface SentryConfig {
  dsn: string;
  environment?: string;
  release?: string;
}

export function initSentry(config: SentryConfig): void {
  Sentry.init({
    dsn: config.dsn,
    environment: config.environment ?? process.env.NODE_ENV ?? 'development',
    release: config.release,
  });
}

export class SentryTransport implements Transport {
  send(entry: LogEntry): void {
    if (entry.level !== 'error') return;

    Sentry.withScope((scope) => {
      scope.setTag('component', entry.component);
      if (entry.attributes) {
        for (const [k, v] of Object.entries(entry.attributes)) {
          scope.setExtra(k, v);
        }
      }
      Sentry.captureMessage(entry.message, 'error');
    });
  }
}

export { Sentry };
