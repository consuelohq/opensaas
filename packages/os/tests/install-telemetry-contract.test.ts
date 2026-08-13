import { describe, expect, it } from 'vitest';

import {
  INSTALL_DASHBOARD_API_PREFIX,
  INSTALL_DASHBOARD_API_ROUTES,
  INSTALL_ERROR_CODES,
  INSTALL_EVENT_NAMES,
  INSTALL_ID_HEADER,
  INSTALL_OUTCOMES,
  INSTALL_STAGES,
  INSTALL_TELEMETRY_FORBIDDEN_FIELDS,
  INSTALL_TELEMETRY_PRODUCERS,
  INSTALL_TELEMETRY_RETENTION_DAYS,
  INSTALL_TELEMETRY_SCHEMA_VERSION,
  INSTALL_TELEMETRY_STORAGE_OWNERS,
  createInstallEventId,
  createInstallId,
  installDashboardDetailRoute,
  isInstallEventId,
  isInstallId,
  pickInstallTelemetrySafeContext,
  type InstallCanonicalIdentity,
  type InstallDashboardDeviceSummary,
  type InstallDashboardErrorGroup,
  type InstallDashboardInstallDetail,
  type InstallDashboardInstallSummary,
  type InstallDashboardOverview,
  type InstallDashboardUserSummary,
  type InstallTelemetryEvent,
} from '../scripts/lib/install-telemetry-contract';

function expectUnique(values: readonly string[]): void {
  expect(new Set(values).size).toBe(values.length);
}

describe('install telemetry foundation contract', () => {
  it('defines opaque stable correlation IDs and a versioned event vocabulary', () => {
    const installId = createInstallId(() => '550e8400-e29b-41d4-a716-446655440000');
    const eventId = createInstallEventId(() => '123e4567-e89b-42d3-a456-426614174000');

    expect(INSTALL_TELEMETRY_SCHEMA_VERSION).toBe(1);
    expect(INSTALL_ID_HEADER).toBe('x-consuelo-install-id');
    expect(installId).toBe('ins_550e8400-e29b-41d4-a716-446655440000');
    expect(eventId).toBe('evt_123e4567-e89b-42d3-a456-426614174000');
    expect(isInstallId(installId)).toBe(true);
    expect(isInstallId('google:123')).toBe(false);
    expect(isInstallId('ins_not-a-uuid')).toBe(false);
    expect(isInstallEventId(eventId)).toBe(true);

    expectUnique(INSTALL_EVENT_NAMES);
    expectUnique(INSTALL_TELEMETRY_PRODUCERS);
    expectUnique(INSTALL_STAGES);
    expectUnique(INSTALL_OUTCOMES);
    expectUnique(INSTALL_ERROR_CODES);

    expect(INSTALL_EVENT_NAMES).toEqual(
      expect.arrayContaining([
        'install.started',
        'install.stage.started',
        'install.stage.completed',
        'install.stage.failed',
        'install.identity.bound',
        'install.diagnostic.uploaded',
        'install.completed',
        'install.failed',
      ]),
    );
    expect(INSTALL_STAGES).toEqual(
      expect.arrayContaining([
        'device_auth',
        'node_registration',
        'connector_provisioning',
        'background_service',
        'health',
      ]),
    );
    expect(INSTALL_ERROR_CODES).toEqual(
      expect.arrayContaining([
        'DEVICE_AUTH_UNAVAILABLE',
        'DEVICE_AUTH_DENIED',
        'DEVICE_AUTH_EXPIRED',
        'DEVICE_AUTH_TIMEOUT',
        'DEVICE_AUTH_POLL_FAILED',
        'BACKGROUND_SERVICE_INSTALL_FAILED',
        'BACKGROUND_SERVICE_START_FAILED',
        'BACKGROUND_SERVICE_HEALTHCHECK_FAILED',
      ]),
    );
  });

  it('keeps canonical identity separate from provider identity and human PII', () => {
    const identity: InstallCanonicalIdentity = {
      state: 'canonical',
      userId: '4ca84647-274b-4f90-8f15-8f33eb268bbb',
      workspaceId: '7d4a6f8d-370c-42b2-ae9a-4d81e5f54ac0',
      nodeId: 'node_member',
    };
    const anonymousIdentity: InstallCanonicalIdentity = {
      state: 'anonymous',
      nodeId: 'node_pending',
    };

    expect(identity).not.toHaveProperty('accountId');
    expect(identity).not.toHaveProperty('googleSub');
    expect(identity).not.toHaveProperty('email');
    expect(anonymousIdentity).not.toHaveProperty('userId');
    expect(anonymousIdentity).not.toHaveProperty('workspaceId');
  });

  it('allow-lists telemetry context instead of accepting arbitrary diagnostic payloads', () => {
    const safe = pickInstallTelemetrySafeContext({
      platform: 'darwin',
      architecture: 'arm64',
      channel: 'canary',
      release: '2026.08.13-canary.1',
      httpStatus: 502,
      durationMs: 1234,
      detectedAgentCount: 3,
      installDaemons: true,
      deviceLoginStatus: 'fallback',
      email: 'person@example.com',
      userCode: 'ABCD-EFGH',
      connectorBootstrapToken: 'secret',
      home: '/Users/person/.consuelo',
      requestBody: 'secret body',
      nested: { token: 'secret' },
    });

    expect(safe).toEqual({
      platform: 'darwin',
      architecture: 'arm64',
      channel: 'canary',
      release: '2026.08.13-canary.1',
      httpStatus: 502,
      durationMs: 1234,
      detectedAgentCount: 3,
      installDaemons: true,
      deviceLoginStatus: 'fallback',
    });
    expect(INSTALL_TELEMETRY_FORBIDDEN_FIELDS).toEqual(
      expect.arrayContaining([
        'email',
        'userCode',
        'deviceCode',
        'authorization',
        'cookie',
        'connectorBootstrapToken',
        'cloudflareTunnelToken',
        'signingKeyJwk',
        'home',
        'argv',
        'requestBody',
        'responseBody',
      ]),
    );
  });

  it('assigns canonical storage ownership and bounded retention', () => {
    expect(INSTALL_TELEMETRY_STORAGE_OWNERS).toEqual({
      sessionsAndEvents: 'consuelo-control-plane',
      diagnosticBundles: 'cloudflare-r2',
      exceptionsAndTraces: 'sentry',
      edgeLogsAndTraces: 'cloudflare-observability',
      productAnalytics: 'posthog',
    });
    expect(INSTALL_TELEMETRY_RETENTION_DAYS).toEqual({
      sessions: 400,
      events: 400,
      failedDiagnosticBundles: 30,
      successfulDiagnosticBundlesDefault: 0,
      successfulDiagnosticBundlesOptInMax: 7,
    });
  });

  it('freezes a read-only internal dashboard API and vendor-independent read models', () => {
    expect(INSTALL_DASHBOARD_API_PREFIX).toBe('/api/internal/os/v1');
    expect(INSTALL_DASHBOARD_API_ROUTES).toEqual({
      overview: '/api/internal/os/v1/overview',
      users: '/api/internal/os/v1/users',
      installs: '/api/internal/os/v1/installs',
      devices: '/api/internal/os/v1/devices',
      errors: '/api/internal/os/v1/errors',
    });
    expect(installDashboardDetailRoute('ins_550e8400-e29b-41d4-a716-446655440000')).toBe(
      '/api/internal/os/v1/installs/ins_550e8400-e29b-41d4-a716-446655440000',
    );

    const overview: InstallDashboardOverview = {
      generatedAt: '2026-08-13T16:00:00.000Z',
      window: '30d',
      users: { registered: 31, activated: 24, active7d: 21 },
      installs: { started: 28, completed: 24, failed: 4 },
      devices: { total: 24, online: 21 },
      activation: {
        registeredUsers: 31,
        authorizedDevices: 27,
        completedInstalls: 24,
        firstHeartbeats: 23,
        activeUsers: 21,
      },
      trend: [],
    };
    const user: InstallDashboardUserSummary = {
      userId: 'user_1',
      createdAt: '2026-08-13T15:00:00.000Z',
      workspaceIds: ['workspace_1'],
      activationState: 'active',
      installCount: 1,
      deviceCount: 1,
    };
    const install: InstallDashboardInstallSummary = {
      installId: 'ins_550e8400-e29b-41d4-a716-446655440000',
      status: 'completed',
      currentStage: 'complete',
      startedAt: '2026-08-13T15:00:00.000Z',
      updatedAt: '2026-08-13T15:04:00.000Z',
      platform: 'darwin',
      architecture: 'arm64',
      channel: 'canary',
      diagnosticAvailable: false,
    };
    const device: InstallDashboardDeviceSummary = {
      nodeId: 'node_1',
      state: 'active',
      platform: 'darwin',
      architecture: 'arm64',
      channel: 'canary',
      agents: ['codex'],
    };
    const errorGroup: InstallDashboardErrorGroup = {
      errorCode: 'DEVICE_AUTH_TIMEOUT',
      stage: 'device_auth',
      impact: 'recoverable',
      count: 4,
      affectedInstalls: 4,
      affectedUsers: 3,
      latestAt: '2026-08-13T15:30:00.000Z',
      platformBreakdown: { darwin: 4 },
      channelBreakdown: { canary: 4 },
    };
    const event: InstallTelemetryEvent = {
      schemaVersion: 1,
      eventId: 'evt_123e4567-e89b-42d3-a456-426614174000',
      installId: install.installId,
      producer: 'installer',
      name: 'install.completed',
      stage: 'complete',
      outcome: 'succeeded',
      occurredAt: '2026-08-13T15:04:00.000Z',
      sequence: 8,
      identity: { state: 'anonymous' },
      context: { platform: 'darwin', architecture: 'arm64', channel: 'canary' },
    };
    const detail: InstallDashboardInstallDetail = {
      install,
      timeline: [{ ...event, ingestedAt: '2026-08-13T15:04:01.000Z' }],
      diagnosticBundle: { available: false },
      evidence: { sentryEventIds: [], cloudflareTraceIds: [] },
    };

    expect(overview.users.registered).toBe(31);
    expect(user.activationState).toBe('active');
    expect(install.status).toBe('completed');
    expect(device.nodeId).toBe('node_1');
    expect(errorGroup.errorCode).toBe('DEVICE_AUTH_TIMEOUT');
    expect(detail.timeline).toHaveLength(1);
    expect(Object.values(INSTALL_DASHBOARD_API_ROUTES).some((route) => /create|delete|revoke|retry/.test(route))).toBe(false);
  });
});
