import type * as SentryNode from '@sentry/node';

import type { InstallTelemetryEvent } from './install-telemetry-contract';
import type { InstallerTelemetryErrorReporter } from './install-telemetry';

type SentryModule = typeof SentryNode;

type CreateInstallerSentryReporterInput = {
  dsn?: string;
  environment?: string;
  release?: string;
  loadSentry?: () => Promise<SentryModule>;
};

function eventData(event: InstallTelemetryEvent): Record<string, unknown> {
  return {
    install_id: event.installId,
    stage: event.stage,
    outcome: event.outcome,
    sequence: event.sequence,
    ...(event.error ? { error_code: event.error.code, error_impact: event.error.impact } : {}),
    ...(event.context ?? {}),
  };
}

export function createInstallerSentryErrorReporter(
  input: CreateInstallerSentryReporterInput,
): InstallerTelemetryErrorReporter | undefined {
  const dsn = input.dsn?.trim();
  if (!dsn) return undefined;

  const loadSentry = input.loadSentry ?? (() => import('@sentry/node'));
  let modulePromise: Promise<SentryModule> | undefined;
  const getSentry = (): Promise<SentryModule> => {
    if (!modulePromise) {
      modulePromise = loadSentry().then((sentry) => {
        sentry.init({
          dsn,
          environment: input.environment,
          release: input.release,
          sendDefaultPii: false,
          tracesSampleRate: 0,
        });
        return sentry;
      });
    }
    return modulePromise;
  };

  return {
    addBreadcrumb: (event) => getSentry().then((sentry) => {
      sentry.addBreadcrumb({
        category: 'consuelo.os.install',
        message: event.name,
        level: event.error ? 'error' : 'info',
        data: eventData(event),
      });
    }),
    captureException: (error, event) => getSentry().then((sentry) => {
      sentry.withScope((scope) => {
        scope.setTag('install_id', event.installId);
        scope.setTag('install_stage', event.stage);
        scope.setTag('install_outcome', event.outcome);
        if (event.error) {
          scope.setTag('install_error_code', event.error.code);
          scope.setTag('install_error_impact', event.error.impact);
        }
        for (const [key, value] of Object.entries(event.context ?? {})) {
          if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
            scope.setTag(`install_${key}`, String(value));
          }
        }
        scope.setContext('consuelo_install', eventData(event));
        sentry.captureException(error);
      });
    }),
  };
}
