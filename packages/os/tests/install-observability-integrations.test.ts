import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import {
  INSTALL_CONTROL_PLANE_EVIDENCE_INGEST_PATH,
  INSTALL_CONTROL_PLANE_EVENT_INGEST_PATH,
  INSTALL_CONTROL_PLANE_OBSERVABILITY_CONFIG_PATH,
  createInstallEvidenceIngestHandler,
  createInstallObservabilityConfigHandler,
} from '../scripts/lib/install-control-plane-http';
import {
  createMemoryInstallControlPlaneRepository,
} from '../scripts/lib/install-control-plane';
import {
  createDeviceAuthorityInstallObservability,
} from '../scripts/lib/install-observability';
import {
  createInstallerDiagnosticHttpUploader,
  createInstallerSentryEvidenceHttpSink,
  createInstallerTelemetryHttpEventSink,
  fetchInstallerObservabilityConfig,
} from '../scripts/lib/install-telemetry-http';
import { createInstallerSentryErrorReporter } from '../scripts/lib/install-telemetry-sentry';
import type { InstallTelemetryEvent } from '../scripts/lib/install-telemetry-contract';

const INSTALL_ID = 'ins_11111111-1111-4111-8111-111111111111' as const;
const START_EVENT_ID = 'evt_11111111-1111-4111-8111-111111111111' as const;
const IDENTITY_EVENT_ID = 'evt_22222222-2222-4222-8222-222222222222' as const;
const SENTRY_EVENT_ID = '0123456789abcdef0123456789abcdef';

function installStarted(): InstallTelemetryEvent {
  return {
    schemaVersion: 1,
    eventId: START_EVENT_ID,
    installId: INSTALL_ID,
    producer: 'installer',
    name: 'install.started',
    stage: 'bootstrap',
    outcome: 'started',
    occurredAt: '2026-08-13T16:00:00.000Z',
    sequence: 1,
    identity: { state: 'anonymous' },
    context: {
      platform: 'darwin',
      architecture: 'arm64',
      channel: 'canary',
      release: '2026.08.13-canary.1',
    },
  };
}

function canonicalIdentityBound(): InstallTelemetryEvent {
  return {
    schemaVersion: 1,
    eventId: IDENTITY_EVENT_ID,
    installId: INSTALL_ID,
    producer: 'device_authority',
    name: 'install.identity.bound',
    stage: 'node_registration',
    outcome: 'succeeded',
    occurredAt: '2026-08-13T16:01:00.000Z',
    sequence: 1,
    identity: {
      state: 'canonical',
      userId: 'user_123',
      workspaceId: 'workspace_123',
      nodeId: 'node_123',
    },
    context: { nodeRole: 'home', nodeStatus: 'created' },
  };
}

describe('installer observability HTTP transports', () => {
  it('posts only an anonymous public event projection while preserving install correlation', async () => {
    const requests: Request[] = [];
    const sink = createInstallerTelemetryHttpEventSink({
      authorityOrigin: 'https://os.consuelohq.com',
      fetchImpl: async (input, init) => {
        const request = input instanceof Request ? input : new Request(input, init);
        requests.push(request);
        return Response.json({ accepted: true, duplicate: false }, { status: 202 });
      },
    });

    await sink(canonicalIdentityBound());

    expect(requests).toHaveLength(1);
    expect(new URL(requests[0]!.url).pathname).toBe(INSTALL_CONTROL_PLANE_EVENT_INGEST_PATH);
    expect(requests[0]!.headers.get('x-consuelo-install-id')).toBe(INSTALL_ID);
    const body = (await requests[0]!.json()) as InstallTelemetryEvent;
    expect(body.installId).toBe(INSTALL_ID);
    expect(body.identity).toEqual({ state: 'anonymous', nodeId: 'node_123' });
    expect(JSON.stringify(body)).not.toMatch(/user_123|workspace_123|google:/i);
  });

  it('uploads the redacted report and records Sentry evidence through bounded public endpoints', async () => {
    const reportDir = fs.mkdtempSync(path.join(os.tmpdir(), 'consuelo-observability-test-'));
    fs.writeFileSync(
      path.join(reportDir, 'install-report.json'),
      `${JSON.stringify({ status: 'error', message: 'background service failed', events: [] })}\n`,
    );
    const requests: Request[] = [];
    const fetchImpl: typeof fetch = async (input, init) => {
      const request = input instanceof Request ? input : new Request(input, init);
      requests.push(request);
      return Response.json({ accepted: true }, { status: 202 });
    };
    const diagnosticUploader = createInstallerDiagnosticHttpUploader({
      authorityOrigin: 'https://os.consuelohq.com',
      fetchImpl,
    });
    const evidenceSink = createInstallerSentryEvidenceHttpSink({
      authorityOrigin: 'https://os.consuelohq.com',
      fetchImpl,
    });

    try {
      await diagnosticUploader({ installId: INSTALL_ID, outcome: 'failed', reportDir });
      await evidenceSink({
        installId: INSTALL_ID,
        kind: 'sentry',
        referenceId: SENTRY_EVENT_ID,
      });
    } finally {
      fs.rmSync(reportDir, { recursive: true, force: true });
    }

    expect(requests).toHaveLength(2);
    expect(new URL(requests[0]!.url).pathname).toBe('/api/os/v1/install-diagnostics');
    expect(await requests[0]!.json()).toMatchObject({
      installId: INSTALL_ID,
      outcome: 'failed',
      diagnostic: { status: 'error', message: 'background service failed' },
    });
    expect(new URL(requests[1]!.url).pathname).toBe(INSTALL_CONTROL_PLANE_EVIDENCE_INGEST_PATH);
    expect(await requests[1]!.json()).toEqual({
      installId: INSTALL_ID,
      kind: 'sentry',
      referenceId: SENTRY_EVENT_ID,
    });
  });
});

describe('public Sentry evidence boundary', () => {
  it('accepts only a Sentry event id for an existing install and stores it as support evidence', async () => {
    const repository = createMemoryInstallControlPlaneRepository();
    await repository.ingestEvent(installStarted(), {
      trust: 'installer',
      ingestedAt: '2026-08-13T16:00:01.000Z',
    });
    const handler = createInstallEvidenceIngestHandler({
      repository,
      now: () => Date.parse('2026-08-13T16:02:00.000Z'),
    });
    const response = await handler(
      new Request(`https://os.consuelohq.com${INSTALL_CONTROL_PLANE_EVIDENCE_INGEST_PATH}`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-consuelo-install-id': INSTALL_ID,
        },
        body: JSON.stringify({
          installId: INSTALL_ID,
          kind: 'sentry',
          referenceId: SENTRY_EVENT_ID,
        }),
      }),
    );

    expect(response.status).toBe(202);
    const detail = await repository.getInstallDetail(INSTALL_ID, {
      nowMs: Date.parse('2026-08-13T16:03:00.000Z'),
    });
    expect(detail?.evidence.sentryEventIds).toEqual([SENTRY_EVENT_ID]);

    const rejected = await handler(
      new Request(`https://os.consuelohq.com${INSTALL_CONTROL_PLANE_EVIDENCE_INGEST_PATH}`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-consuelo-install-id': INSTALL_ID,
        },
        body: JSON.stringify({
          installId: INSTALL_ID,
          kind: 'cloudflare',
          referenceId: 'forged-cloudflare-ref',
        }),
      }),
    );
    expect(rejected.status).toBe(400);
  });
});

describe('Device Authority install vendor projections', () => {
  it('logs safe Cloudflare correlation, records the Ray id, and sends idempotent PostHog milestones', async () => {
    const repository = createMemoryInstallControlPlaneRepository();
    await repository.ingestEvent(installStarted(), {
      trust: 'installer',
      ingestedAt: '2026-08-13T16:00:01.000Z',
    });
    const logs: Array<Record<string, unknown>> = [];
    const posthogRequests: Request[] = [];
    const observer = createDeviceAuthorityInstallObservability({
      repository,
      posthogApiKey: 'phc_test_project_key',
      posthogHost: 'https://us.i.posthog.com',
      fetchImpl: async (input, init) => {
        posthogRequests.push(input instanceof Request ? input : new Request(input, init));
        return Response.json({ status: 1 });
      },
      log: (record) => logs.push(record),
      now: () => Date.parse('2026-08-13T16:02:00.000Z'),
    });

    await observer.observe(installStarted(), { cloudflareRayId: 'ray-install-started' });
    await repository.ingestEvent(canonicalIdentityBound(), {
      trust: 'trusted',
      ingestedAt: '2026-08-13T16:01:01.000Z',
    });
    await observer.observe(canonicalIdentityBound());

    expect(logs).toHaveLength(2);
    expect(logs[0]).toMatchObject({
      event: 'consuelo.os.install',
      install_id: INSTALL_ID,
      event_id: START_EVENT_ID,
      event_name: 'install.started',
      channel: 'canary',
      release: '2026.08.13-canary.1',
      cf_ray: 'ray-install-started',
    });
    expect(JSON.stringify(logs)).not.toMatch(/email|display_name|workspace_host|google:/i);

    const detail = await repository.getInstallDetail(INSTALL_ID, {
      nowMs: Date.parse('2026-08-13T16:03:00.000Z'),
    });
    expect(detail?.evidence.cloudflareTraceIds).toEqual(['ray-install-started']);

    expect(posthogRequests).toHaveLength(2);
    const startedPosthog = (await posthogRequests[0]!.json()) as Record<string, unknown>;
    expect(startedPosthog).toMatchObject({
      api_key: 'phc_test_project_key',
      batch: [
        expect.objectContaining({
          event: 'consuelo_os_install_started',
          distinct_id: INSTALL_ID,
          properties: expect.objectContaining({
            install_id: INSTALL_ID,
            event_id: START_EVENT_ID,
            $insert_id: START_EVENT_ID,
            channel: 'canary',
            release: '2026.08.13-canary.1',
          }),
        }),
      ],
    });
    const identityPosthog = (await posthogRequests[1]!.json()) as Record<string, unknown>;
    expect(identityPosthog).toMatchObject({
      batch: [
        expect.objectContaining({
          event: 'consuelo_os_device_authorized',
          distinct_id: INSTALL_ID,
          properties: expect.objectContaining({
            install_id: INSTALL_ID,
            canonical_user_id: 'user_123',
            workspace_id: 'workspace_123',
            node_id: 'node_123',
          }),
        }),
      ],
    });
  });

  it('does not persist an unbounded or malformed Cloudflare request reference', async () => {
    const repository = createMemoryInstallControlPlaneRepository();
    await repository.ingestEvent(installStarted(), {
      trust: 'installer',
      ingestedAt: '2026-08-13T16:00:01.000Z',
    });
    const observer = createDeviceAuthorityInstallObservability({
      repository,
      log: () => undefined,
      now: () => Date.parse('2026-08-13T16:02:00.000Z'),
    });

    await observer.observe(installStarted(), {
      cloudflareRayId: `bad ray ${'x'.repeat(300)}`,
    });

    const detail = await repository.getInstallDetail(INSTALL_ID, {
      nowMs: Date.parse('2026-08-13T16:03:00.000Z'),
    });
    expect(detail?.evidence.cloudflareTraceIds).toEqual([]);
  });

});

describe('Sentry install correlation', () => {
  it('returns the Sentry event id and attaches trusted canonical ids only when present', async () => {
    const init = vi.fn();
    const setTag = vi.fn();
    const setContext = vi.fn();
    const setUser = vi.fn();
    const fakeSentry = {
      init,
      addBreadcrumb: vi.fn(),
      withScope: (callback: (scope: unknown) => void) =>
        callback({ setTag, setContext, setUser }),
      captureException: vi.fn(() => SENTRY_EVENT_ID),
    } as unknown as typeof import('@sentry/node');
    const reporter = createInstallerSentryErrorReporter({
      dsn: 'https://public@example.ingest.sentry.io/123',
      environment: 'canary',
      release: '2026.08.13-canary.1',
      loadSentry: async () => fakeSentry,
    });

    expect(reporter).toBeDefined();
    const eventId = await reporter!.captureException(
      new Error('background service failed'),
      {
        ...canonicalIdentityBound(),
        name: 'install.failed',
        stage: 'background_service',
        outcome: 'failed',
        error: { code: 'BACKGROUND_SERVICE_START_FAILED', impact: 'fatal' },
        context: { channel: 'canary', release: '2026.08.13-canary.1' },
      },
    );

    expect(eventId).toBe(SENTRY_EVENT_ID);
    expect(setUser).toHaveBeenCalledWith({ id: 'user_123' });
    expect(setTag).toHaveBeenCalledWith('install_id', INSTALL_ID);
    expect(setTag).toHaveBeenCalledWith('workspace_id', 'workspace_123');
    expect(setTag).toHaveBeenCalledWith('node_id', 'node_123');
    expect(setTag).toHaveBeenCalledWith('install_release', '2026.08.13-canary.1');
    expect(setContext).toHaveBeenCalledWith(
      'consuelo_install',
      expect.not.objectContaining({ email: expect.anything() }),
    );

    const options = init.mock.calls[0]![0] as {
      beforeSend?: (event: Record<string, unknown>) => Record<string, unknown> | null;
    };
    expect(options.beforeSend).toBeTypeOf('function');
    const scrubbed = options.beforeSend!({
      exception: {
        values: [
          {
            value: 'failed under /Users/ko/.consuelo with Bearer dev_supersecret',
            stacktrace: { frames: [{ filename: '/Users/ko/.consuelo/runtime/install.ts' }] },
          },
        ],
      },
      extra: { authorization: 'Bearer dev_supersecret' },
    });
    expect(JSON.stringify(scrubbed)).not.toContain('/Users/ko');
    expect(JSON.stringify(scrubbed)).not.toContain('dev_supersecret');
  });
});

describe('Cloudflare observability deployment config', () => {
  it('explicitly enables Device Authority logs and traces', () => {
    const wrangler = fs.readFileSync(
      new URL('../cloudflare/os-device-authority/wrangler.toml', import.meta.url),
      'utf8',
    );
    expect(wrangler).toContain('[observability.logs]');
    expect(wrangler).toMatch(/\[observability\.logs\][\s\S]*enabled\s*=\s*true/);
    expect(wrangler).toContain('[observability.traces]');
    expect(wrangler).toMatch(/\[observability\.traces\][\s\S]*enabled\s*=\s*true/);
  });

  it('publishes only the installer Sentry DSN through a no-store observability config endpoint', async () => {
    const handler = createInstallObservabilityConfigHandler({
      sentryDsn: 'https://public@example.ingest.sentry.io/123',
    });
    const response = await handler(
      new Request(`https://os.consuelohq.com${INSTALL_CONTROL_PLANE_OBSERVABILITY_CONFIG_PATH}`),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.json()).toEqual({
      sentryDsn: 'https://public@example.ingest.sentry.io/123',
    });
  });

  it('discovers installer Sentry configuration best effort without exposing other worker configuration', async () => {
    const requests: Request[] = [];
    const config = await fetchInstallerObservabilityConfig({
      authorityOrigin: 'https://os.consuelohq.com',
      fetchImpl: async (input, init) => {
        const request = input instanceof Request ? input : new Request(input, init);
        requests.push(request);
        return Response.json({ sentryDsn: 'https://public@example.ingest.sentry.io/123' });
      },
    });
    expect(requests).toHaveLength(1);
    expect(new URL(requests[0]!.url).pathname).toBe(
      INSTALL_CONTROL_PLANE_OBSERVABILITY_CONFIG_PATH,
    );
    expect(config).toEqual({ sentryDsn: 'https://public@example.ingest.sentry.io/123' });

    const unavailable = await fetchInstallerObservabilityConfig({
      fetchImpl: async () => new Response('unavailable', { status: 503 }),
    });
    expect(unavailable).toEqual({});
  });
});

describe('production installer transport wiring', () => {
  it('wires event, evidence, and diagnostic HTTP projections into the installer runtime', () => {
    const source = fs.readFileSync(
      new URL('../scripts/install.ts', import.meta.url),
      'utf8',
    );
    expect(source).toContain('createInstallerTelemetryHttpEventSink');
    expect(source).toContain('createInstallerSentryEvidenceHttpSink');
    expect(source).toContain('createInstallerDiagnosticHttpUploader');
    expect(source).toContain('fetchInstallerObservabilityConfig');
    expect(source).toContain('eventSink:');
    expect(source).toContain('evidenceSink:');
    expect(source).toContain('diagnosticUploader:');
    expect(source).toContain('captureSupport: true');
    expect(source).toContain('observabilityConfig.sentryDsn');
  });
});
