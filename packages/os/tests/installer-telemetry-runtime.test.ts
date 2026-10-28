import { describe, expect, it, vi } from 'vitest';

import {
  INSTALL_TELEMETRY_SCHEMA_VERSION,
  isInstallId,
  type InstallTelemetryEvent,
} from '../scripts/lib/install-telemetry-contract';
import {
  createInstallerTelemetry,
  type InstallerDiagnosticUploader,
  type InstallerTelemetryErrorReporter,
} from '../scripts/lib/install-telemetry';

const UUIDS = [
  '11111111-1111-4111-8111-111111111111',
  '22222222-2222-4222-8222-222222222222',
  '33333333-3333-4333-8333-333333333333',
  '44444444-4444-4444-8444-444444444444',
  '55555555-5555-4555-8555-555555555555',
] as const;

function uuidFactory(): () => string {
  let index = 0;
  return () => UUIDS[index++] ?? '66666666-6666-4666-8666-666666666666';
}

describe('installer telemetry runtime', () => {
  it('creates one install id and emits versioned monotonic safe events', async () => {
    const events: InstallTelemetryEvent[] = [];
    const randomUuid = uuidFactory();
    const telemetry = createInstallerTelemetry({
      randomUuid,
      now: () => '2026-08-13T16:00:00.000Z',
      baseContext: {
        platform: 'darwin',
        architecture: 'arm64',
        channel: 'canary',
        home: '/Users/private/.consuelo',
        email: 'private@example.com',
      },
      eventSink: async (event) => {
        events.push(event);
      },
    });

    expect(isInstallId(telemetry.installId)).toBe(true);
    const installId = telemetry.installId;

    await telemetry.record({
      name: 'install.started',
      stage: 'bootstrap',
      outcome: 'started',
      context: { dryRun: false, requestBody: 'secret-body' },
    });
    await telemetry.record({
      name: 'install.stage.completed',
      stage: 'dependencies',
      outcome: 'succeeded',
      context: { durationMs: 42, url: 'https://secret.example/path' },
    });

    expect(telemetry.installId).toBe(installId);
    expect(events).toHaveLength(2);
    expect(events.map((event) => event.sequence)).toEqual([1, 2]);
    expect(events.every((event) => event.installId === installId)).toBe(true);
    expect(events.every((event) => event.schemaVersion === INSTALL_TELEMETRY_SCHEMA_VERSION)).toBe(true);
    expect(events[0].context).toEqual({
      platform: 'darwin',
      architecture: 'arm64',
      channel: 'canary',
      dryRun: false,
    });
    expect(events[1].context).toEqual({
      platform: 'darwin',
      architecture: 'arm64',
      channel: 'canary',
      durationMs: 42,
    });
    expect(JSON.stringify(events)).not.toContain('private@example.com');
    expect(JSON.stringify(events)).not.toContain('/Users/private');
    expect(JSON.stringify(events)).not.toContain('secret-body');
    expect(JSON.stringify(events)).not.toContain('secret.example');
  });

  it('binds only canonical Consuelo identity and rejects provider-shaped ids', async () => {
    const events: InstallTelemetryEvent[] = [];
    const telemetry = createInstallerTelemetry({
      eventSink: async (event) => events.push(event),
    });

    await expect(
      telemetry.bindIdentity({
        userId: 'google:123456789',
        workspaceId: 'workspace_123',
        nodeId: 'node_123',
      }),
    ).rejects.toThrow(/canonical Consuelo user id/i);

    await telemetry.bindIdentity({
      userId: 'user_123',
      workspaceId: 'workspace_123',
      nodeId: 'node_123',
    });

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      name: 'install.identity.bound',
      stage: 'device_auth',
      outcome: 'succeeded',
      identity: {
        state: 'canonical',
        userId: 'user_123',
        workspaceId: 'workspace_123',
        nodeId: 'node_123',
      },
    });
  });

  it('reports failures to Sentry-shaped infrastructure without leaking forbidden structured metadata', async () => {
    const captured: Array<{ error: unknown; event: InstallTelemetryEvent }> = [];
    const breadcrumbs: InstallTelemetryEvent[] = [];
    const reporter: InstallerTelemetryErrorReporter = {
      addBreadcrumb: async (event) => breadcrumbs.push(event),
      captureException: async (error, event) => captured.push({ error, event }),
    };
    const rawError = new Error('request failed for https://secret.example?token=abc');
    const telemetry = createInstallerTelemetry({ errorReporter: reporter });

    await telemetry.recordFailure({
      stage: 'device_auth',
      errorCode: 'DEVICE_AUTH_UNAVAILABLE',
      impact: 'recoverable',
      error: rawError,
      context: {
        httpStatus: 503,
        requestBody: 'oauth-secret',
        authorization: 'Bearer secret',
        path: '/Users/private/.consuelo',
      },
    });

    expect(captured).toHaveLength(1);
    expect(captured[0].error).toBe(rawError);
    expect(captured[0].event.context).toEqual({ httpStatus: 503 });
    expect(captured[0].event.error).toEqual({
      code: 'DEVICE_AUTH_UNAVAILABLE',
      impact: 'recoverable',
    });
    expect(breadcrumbs).toHaveLength(1);
    expect(JSON.stringify(captured[0].event)).not.toMatch(
      /oauth-secret|Bearer secret|Users\/private|secret\.example/i,
    );
  });

  it('never lets event, Sentry, or diagnostic upload failures change installer control flow', async () => {
    const eventSink = vi.fn(async () => {
      throw new Error('event store offline');
    });
    const reporter: InstallerTelemetryErrorReporter = {
      addBreadcrumb: vi.fn(async () => {
        throw new Error('breadcrumb offline');
      }),
      captureException: vi.fn(async () => {
        throw new Error('sentry offline');
      }),
    };
    const diagnosticUploader: InstallerDiagnosticUploader = vi.fn(async () => {
      throw new Error('r2 offline');
    });
    const telemetry = createInstallerTelemetry({
      eventSink,
      errorReporter: reporter,
      diagnosticUploader,
    });

    await expect(
      telemetry.recordFailure({
        stage: 'local_provisioning',
        errorCode: 'LOCAL_PROVISION_FAILED',
        impact: 'fatal',
        error: new Error('real installer failure'),
      }),
    ).resolves.toMatchObject({
      error: { code: 'LOCAL_PROVISION_FAILED', impact: 'fatal' },
    });

    await expect(
      telemetry.uploadDiagnostic({
        reportDir: '/Users/private/.consuelo-dev-reports/install-1',
        outcome: 'failed',
      }),
    ).resolves.toBeUndefined();

    expect(eventSink).toHaveBeenCalled();
    expect(reporter.captureException).toHaveBeenCalled();
    expect(diagnosticUploader).toHaveBeenCalledWith(
      expect.objectContaining({
        installId: telemetry.installId,
        outcome: 'failed',
      }),
    );
  });
});
