import {
  INSTALL_TELEMETRY_SCHEMA_VERSION,
  createInstallEventId,
  createInstallId,
  isInstallId,
  pickInstallTelemetrySafeContext,
  type InstallBoundIdentity,
  type InstallCanonicalIdentity,
  type InstallErrorCode,
  type InstallErrorImpact,
  type InstallId,
  type InstallOutcome,
  type InstallStage,
  type InstallTelemetryEvent,
  type InstallTelemetryEventName,
  type InstallTelemetrySafeContext,
} from './install-telemetry-contract';

type MaybePromise<T> = T | Promise<T>;

export type InstallerTelemetryEventSink = (
  event: InstallTelemetryEvent,
) => MaybePromise<void>;

export type InstallerTelemetryErrorReporter = {
  addBreadcrumb: (event: InstallTelemetryEvent) => MaybePromise<void>;
  captureException: (
    error: unknown,
    event: InstallTelemetryEvent,
  ) => MaybePromise<void>;
};

export type InstallerDiagnosticUploadRequest = {
  installId: InstallId;
  outcome: 'failed' | 'successful';
  reportDir: string;
};

export type InstallerDiagnosticUploader = (
  request: InstallerDiagnosticUploadRequest,
) => MaybePromise<void>;

export type InstallerTelemetryRecordInput = {
  name: InstallTelemetryEventName;
  stage: InstallStage;
  outcome: InstallOutcome;
  context?: Readonly<Record<string, unknown>>;
  error?: {
    code: InstallErrorCode;
    impact: InstallErrorImpact;
  };
};

export type InstallerTelemetryFailureInput = {
  stage: InstallStage;
  errorCode: InstallErrorCode;
  impact: InstallErrorImpact;
  error: unknown;
  context?: Readonly<Record<string, unknown>>;
  name?: Extract<InstallTelemetryEventName, 'install.stage.failed' | 'install.failed'>;
};

export type InstallerTelemetry = {
  readonly installId: InstallId;
  readonly identity: InstallCanonicalIdentity;
  record: (input: InstallerTelemetryRecordInput) => Promise<InstallTelemetryEvent>;
  recordFailure: (
    input: InstallerTelemetryFailureInput,
  ) => Promise<InstallTelemetryEvent>;
  bindIdentity: (identity: InstallBoundIdentity) => Promise<InstallTelemetryEvent>;
  uploadDiagnostic: (input: {
    reportDir: string;
    outcome: 'failed' | 'successful';
  }) => Promise<void>;
};

export type CreateInstallerTelemetryOptions = {
  installId?: InstallId;
  baseContext?: Readonly<Record<string, unknown>>;
  eventSink?: InstallerTelemetryEventSink;
  errorReporter?: InstallerTelemetryErrorReporter;
  diagnosticUploader?: InstallerDiagnosticUploader;
  now?: () => string;
  randomUuid?: () => string;
};

function nonEmpty(value: string): boolean {
  return value.trim().length > 0;
}

function assertCanonicalIdentity(identity: InstallBoundIdentity): void {
  if (!nonEmpty(identity.userId) || identity.userId.startsWith('google:')) {
    throw new Error('canonical Consuelo user id is required for install identity binding');
  }
  if (!nonEmpty(identity.workspaceId)) {
    throw new Error('canonical Consuelo workspace id is required for install identity binding');
  }
  if (identity.nodeId !== undefined && !nonEmpty(identity.nodeId)) {
    throw new Error('install identity node id must be non-empty when provided');
  }
}

async function ignoreInfrastructureFailure(operation: () => MaybePromise<void>): Promise<void> {
  try {
    await operation();
  } catch {
    // Telemetry infrastructure must never change installer control flow.
  }
}

function mergeSafeContext(
  baseContext: Readonly<Record<string, unknown>> | undefined,
  eventContext: Readonly<Record<string, unknown>> | undefined,
): InstallTelemetrySafeContext | undefined {
  const context = pickInstallTelemetrySafeContext({
    ...(baseContext ?? {}),
    ...(eventContext ?? {}),
  });
  return Object.keys(context).length > 0 ? context : undefined;
}

export function resolveInstallerInstallId(
  env: Readonly<Record<string, string | undefined>> = process.env,
  randomUuid: () => string = () => globalThis.crypto.randomUUID(),
): InstallId {
  const inherited = env.CONSUELO_INSTALL_ID?.trim();
  return inherited && isInstallId(inherited)
    ? inherited
    : createInstallId(randomUuid);
}

export function createInstallerTelemetry(
  options: CreateInstallerTelemetryOptions = {},
): InstallerTelemetry {
  const randomUuid = options.randomUuid ?? (() => globalThis.crypto.randomUUID());
  const installId = options.installId ?? createInstallId(randomUuid);
  if (!isInstallId(installId)) {
    throw new Error('installer telemetry requires a valid install id');
  }

  let sequence = 0;
  let identity: InstallCanonicalIdentity = { state: 'anonymous' };
  const now = options.now ?? (() => new Date().toISOString());

  const record = async (
    input: InstallerTelemetryRecordInput,
  ): Promise<InstallTelemetryEvent> => {
    sequence += 1;
    const context = mergeSafeContext(options.baseContext, input.context);
    const event: InstallTelemetryEvent = {
      schemaVersion: INSTALL_TELEMETRY_SCHEMA_VERSION,
      eventId: createInstallEventId(randomUuid),
      installId,
      producer: 'installer',
      name: input.name,
      stage: input.stage,
      outcome: input.outcome,
      occurredAt: now(),
      sequence,
      identity,
      ...(context ? { context } : {}),
      ...(input.error ? { error: input.error } : {}),
    };

    try {
      if (options.errorReporter) {
        await ignoreInfrastructureFailure(() => options.errorReporter!.addBreadcrumb(event));
      }
      if (options.eventSink) {
        await ignoreInfrastructureFailure(() => options.eventSink!(event));
      }
    } catch {
      // The guarded helpers should already absorb infrastructure errors. Keep this boundary
      // defensive so future sink implementations cannot make telemetry fatal to installation.
    }
    return event;
  };

  const recordFailure = async (
    input: InstallerTelemetryFailureInput,
  ): Promise<InstallTelemetryEvent> => {
    const event = await record({
      name: input.name ?? 'install.stage.failed',
      stage: input.stage,
      outcome: 'failed',
      context: input.context,
      error: {
        code: input.errorCode,
        impact: input.impact,
      },
    });
    try {
      if (options.errorReporter) {
        await ignoreInfrastructureFailure(() =>
          options.errorReporter!.captureException(input.error, event),
        );
      }
    } catch {
      // Error reporting is intentionally best effort and never controls installer success.
    }
    return event;
  };

  const bindIdentity = async (
    nextIdentity: InstallBoundIdentity,
  ): Promise<InstallTelemetryEvent> => {
    assertCanonicalIdentity(nextIdentity);
    identity = { state: 'canonical', ...nextIdentity };
    return record({
      name: 'install.identity.bound',
      stage: 'device_auth',
      outcome: 'succeeded',
    });
  };

  const uploadDiagnostic = async (input: {
    reportDir: string;
    outcome: 'failed' | 'successful';
  }): Promise<void> => {
    if (!options.diagnosticUploader || !input.reportDir.trim()) return;
    try {
      await options.diagnosticUploader({
        installId,
        outcome: input.outcome,
        reportDir: input.reportDir,
      });
      await record({
        name: 'install.diagnostic.uploaded',
        stage: 'complete',
        outcome: 'succeeded',
        context: { diagnosticKind: input.outcome },
      });
    } catch (error: unknown) {
      await recordFailure({
        stage: 'complete',
        errorCode: 'DIAGNOSTIC_UPLOAD_FAILED',
        impact: 'recoverable',
        error,
        context: { diagnosticKind: input.outcome },
      });
    }
  };

  return {
    installId,
    get identity() {
      return identity;
    },
    record,
    recordFailure,
    bindIdentity,
    uploadDiagnostic,
  };
}
