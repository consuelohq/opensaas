import { describe, expect, it } from 'vitest';

import {
  INSTALL_TELEMETRY_RETENTION_DAYS,
  type InstallTelemetryEvent,
} from '../scripts/lib/install-telemetry-contract';
import {
  createMemoryInstallControlPlaneRepository,
  createInstallControlPlaneService,
  projectAuthorityWorkspaceNodeToDashboardDevice,
  type InstallControlPlaneDeviceSource,
} from '../scripts/lib/install-control-plane';

const INSTALL_ID = 'ins_11111111-1111-4111-8111-111111111111' as const;
const SECOND_INSTALL_ID = 'ins_22222222-2222-4222-8222-222222222222' as const;
const EVENT_IDS = {
  started: 'evt_11111111-1111-4111-8111-111111111111',
  device: 'evt_22222222-2222-4222-8222-222222222222',
  bound: 'evt_33333333-3333-4333-8333-333333333333',
  failed: 'evt_44444444-4444-4444-8444-444444444444',
  completed: 'evt_55555555-5555-4555-8555-555555555555',
  late: 'evt_66666666-6666-4666-8666-666666666666',
  crossProducer: 'evt_77777777-7777-4777-8777-777777777777',
  secondBound: 'evt_88888888-8888-4888-8888-888888888888',
  secondCompleted: 'evt_99999999-9999-4999-8999-999999999999',
} as const;

function event(
  overrides: Partial<InstallTelemetryEvent> & Pick<InstallTelemetryEvent, 'eventId'>,
): InstallTelemetryEvent {
  return {
    schemaVersion: 1,
    eventId: overrides.eventId,
    installId: INSTALL_ID,
    producer: 'installer',
    name: 'install.stage.started',
    stage: 'bootstrap',
    outcome: 'started',
    occurredAt: '2026-08-13T16:00:00.000Z',
    sequence: 1,
    identity: { state: 'anonymous' },
    ...overrides,
  } as InstallTelemetryEvent;
}

describe('install control plane repository', () => {
  it('accepts anonymous installer events idempotently and refuses canonical identity from the public installer trust boundary', async () => {
    const repository = createMemoryInstallControlPlaneRepository();
    const started = event({
      eventId: EVENT_IDS.started,
      name: 'install.started',
      stage: 'bootstrap',
      context: {
        platform: 'darwin',
        architecture: 'arm64',
        channel: 'canary',
        release: '2026.08.13-canary.1',
      },
    });

    await expect(
      repository.ingestEvent(started, {
        trust: 'installer',
        ingestedAt: '2026-08-13T16:00:01.000Z',
      }),
    ).resolves.toMatchObject({ created: true });
    await expect(
      repository.ingestEvent(started, {
        trust: 'installer',
        ingestedAt: '2026-08-13T16:00:02.000Z',
      }),
    ).resolves.toMatchObject({ created: false });

    const canonical = event({
      eventId: EVENT_IDS.bound,
      producer: 'app',
      name: 'install.identity.bound',
      stage: 'device_auth',
      outcome: 'succeeded',
      sequence: 2,
      identity: {
        state: 'canonical',
        userId: 'user_123',
        workspaceId: 'workspace_123',
        nodeId: 'node_123',
      },
    });
    await expect(
      repository.ingestEvent(canonical, {
        trust: 'installer',
        ingestedAt: '2026-08-13T16:00:03.000Z',
      }),
    ).rejects.toThrow(/canonical identity/i);

    const detail = await repository.getInstallDetail(INSTALL_ID, {
      nowMs: Date.parse('2026-08-13T16:01:00.000Z'),
    });
    expect(detail?.timeline).toHaveLength(1);
    expect(detail?.install).toMatchObject({
      installId: INSTALL_ID,
      status: 'in_progress',
      currentStage: 'bootstrap',
      platform: 'darwin',
      architecture: 'arm64',
      channel: 'canary',
      release: '2026.08.13-canary.1',
    });
  });

  it('binds canonical identity only through a trusted producer and does not let late events regress projected session state', async () => {
    const repository = createMemoryInstallControlPlaneRepository();
    await repository.ingestEvent(
      event({ eventId: EVENT_IDS.started, name: 'install.started', sequence: 1 }),
      { trust: 'installer', ingestedAt: '2026-08-13T16:00:01.000Z' },
    );
    await repository.ingestEvent(
      event({
        eventId: EVENT_IDS.bound,
        producer: 'app',
        name: 'install.identity.bound',
        stage: 'device_auth',
        outcome: 'succeeded',
        sequence: 2,
        occurredAt: '2026-08-13T16:02:00.000Z',
        identity: {
          state: 'canonical',
          userId: 'user_123',
          workspaceId: 'workspace_123',
          nodeId: 'node_123',
        },
      }),
      { trust: 'trusted', ingestedAt: '2026-08-13T16:02:01.000Z' },
    );
    await repository.ingestEvent(
      event({
        eventId: EVENT_IDS.completed,
        name: 'install.completed',
        stage: 'complete',
        outcome: 'succeeded',
        sequence: 10,
        occurredAt: '2026-08-13T16:10:00.000Z',
        context: { durationMs: 600_000 },
      }),
      { trust: 'installer', ingestedAt: '2026-08-13T16:10:01.000Z' },
    );
    await repository.ingestEvent(
      event({
        eventId: EVENT_IDS.late,
        name: 'install.stage.started',
        stage: 'dependencies',
        outcome: 'started',
        sequence: 3,
        occurredAt: '2026-08-13T16:03:00.000Z',
      }),
      { trust: 'installer', ingestedAt: '2026-08-13T16:11:00.000Z' },
    );

    const detail = await repository.getInstallDetail(INSTALL_ID, {
      nowMs: Date.parse('2026-08-13T16:11:00.000Z'),
    });
    expect(detail?.install).toMatchObject({
      status: 'completed',
      currentStage: 'complete',
      userId: 'user_123',
      workspaceId: 'workspace_123',
      nodeId: 'node_123',
      durationMs: 600_000,
    });
    expect(detail?.timeline.map((entry) => entry.sequence)).toEqual([1, 2, 3, 10]);
  });

  it('orders distributed producers by occurredAt instead of comparing producer-local sequence values globally', async () => {
    const repository = createMemoryInstallControlPlaneRepository();
    await repository.ingestEvent(
      event({
        eventId: EVENT_IDS.started,
        name: 'install.started',
        sequence: 50,
        occurredAt: '2026-08-13T16:00:00.000Z',
      }),
      { trust: 'installer', ingestedAt: '2026-08-13T16:00:01.000Z' },
    );
    await repository.ingestEvent(
      event({
        eventId: EVENT_IDS.bound,
        producer: 'app',
        name: 'install.identity.bound',
        stage: 'node_registration',
        outcome: 'succeeded',
        sequence: 1,
        occurredAt: '2026-08-13T16:01:00.000Z',
        identity: {
          state: 'canonical',
          userId: 'user_123',
          workspaceId: 'workspace_123',
          nodeId: 'node_123',
        },
      }),
      { trust: 'trusted', ingestedAt: '2026-08-13T16:01:01.000Z' },
    );
    await repository.ingestEvent(
      event({
        eventId: EVENT_IDS.crossProducer,
        producer: 'control_plane',
        name: 'install.stage.completed',
        stage: 'dependencies',
        outcome: 'succeeded',
        sequence: 99,
        occurredAt: '2026-08-13T15:59:00.000Z',
      }),
      { trust: 'trusted', ingestedAt: '2026-08-13T16:02:00.000Z' },
    );

    const detail = await repository.getInstallDetail(INSTALL_ID, {
      nowMs: Date.parse('2026-08-13T16:03:00.000Z'),
    });
    expect(detail?.install).toMatchObject({
      currentStage: 'node_registration',
      updatedAt: '2026-08-13T16:01:00.000Z',
      userId: 'user_123',
      workspaceId: 'workspace_123',
      nodeId: 'node_123',
    });
    expect(detail?.timeline.map((entry) => entry.occurredAt)).toEqual([
      '2026-08-13T15:59:00.000Z',
      '2026-08-13T16:00:00.000Z',
      '2026-08-13T16:01:00.000Z',
    ]);
  });

  it('groups failures without storing forbidden diagnostic payloads and exposes only safe bundle metadata/evidence', async () => {
    const repository = createMemoryInstallControlPlaneRepository();
    await repository.ingestEvent(
      event({
        eventId: EVENT_IDS.started,
        name: 'install.started',
        context: { platform: 'darwin', channel: 'canary' },
      }),
      { trust: 'installer', ingestedAt: '2026-08-13T16:00:01.000Z' },
    );
    await repository.ingestEvent(
      event({
        eventId: EVENT_IDS.bound,
        producer: 'app',
        name: 'install.identity.bound',
        stage: 'device_auth',
        outcome: 'succeeded',
        sequence: 2,
        identity: {
          state: 'canonical',
          userId: 'user_123',
          workspaceId: 'workspace_123',
        },
      }),
      { trust: 'trusted', ingestedAt: '2026-08-13T16:00:02.000Z' },
    );
    await repository.ingestEvent(
      event({
        eventId: EVENT_IDS.failed,
        name: 'install.failed',
        stage: 'background_service',
        outcome: 'failed',
        sequence: 3,
        occurredAt: '2026-08-13T16:03:00.000Z',
        error: {
          code: 'BACKGROUND_SERVICE_START_FAILED',
          impact: 'fatal',
        },
      }),
      { trust: 'installer', ingestedAt: '2026-08-13T16:03:01.000Z' },
    );
    await repository.recordDiagnosticBundle({
      bundleId: 'diag_123',
      installId: INSTALL_ID,
      objectKey: `install-diagnostics/${INSTALL_ID}/diag_123.json`,
      outcome: 'failed',
      createdAt: '2026-08-13T16:04:00.000Z',
      expiresAt: '2026-09-12T16:04:00.000Z',
    });
    await repository.recordEvidence({
      installId: INSTALL_ID,
      kind: 'sentry',
      referenceId: 'sentry_event_123',
      createdAt: '2026-08-13T16:04:01.000Z',
    });
    await repository.recordEvidence({
      installId: INSTALL_ID,
      kind: 'cloudflare',
      referenceId: 'cf_trace_123',
      createdAt: '2026-08-13T16:04:02.000Z',
    });

    const service = createInstallControlPlaneService({ repository });
    const errors = await service.listErrors({
      window: '30d',
      nowMs: Date.parse('2026-08-13T17:00:00.000Z'),
    });
    expect(errors.items).toEqual([
      expect.objectContaining({
        errorCode: 'BACKGROUND_SERVICE_START_FAILED',
        stage: 'background_service',
        impact: 'fatal',
        count: 1,
        affectedInstalls: 1,
        affectedUsers: 1,
        platformBreakdown: { darwin: 1 },
        channelBreakdown: { canary: 1 },
      }),
    ]);

    const detail = await service.getInstallDetail(INSTALL_ID, {
      nowMs: Date.parse('2026-08-13T17:00:00.000Z'),
    });
    expect(detail?.diagnosticBundle).toEqual({
      available: true,
      bundleId: 'diag_123',
      outcome: 'failed',
      createdAt: '2026-08-13T16:04:00.000Z',
      expiresAt: '2026-09-12T16:04:00.000Z',
    });
    expect(JSON.stringify(detail)).not.toContain('install-diagnostics/');
    expect(detail?.evidence).toEqual({
      sentryEventIds: ['sentry_event_123'],
      cloudflareTraceIds: ['cf_trace_123'],
    });
  });

  it('derives overview and user activation from canonical installs plus authoritative device presence', async () => {
    const repository = createMemoryInstallControlPlaneRepository();
    await repository.upsertUser({
      userId: 'user_123',
      email: 'owner@example.test',
      displayName: 'Owner',
      workspaceIds: ['workspace_123'],
      createdAt: '2026-08-10T12:00:00.000Z',
      updatedAt: '2026-08-10T12:00:00.000Z',
    });
    await repository.upsertUser({
      userId: 'user_completed_only',
      workspaceIds: ['workspace_completed_only'],
      createdAt: '2026-08-11T12:00:00.000Z',
      updatedAt: '2026-08-11T12:00:00.000Z',
    });
    await repository.ingestEvent(
      event({ eventId: EVENT_IDS.started, name: 'install.started' }),
      { trust: 'installer', ingestedAt: '2026-08-13T16:00:01.000Z' },
    );
    await repository.ingestEvent(
      event({
        eventId: EVENT_IDS.bound,
        producer: 'app',
        name: 'install.identity.bound',
        stage: 'node_registration',
        outcome: 'succeeded',
        sequence: 2,
        identity: {
          state: 'canonical',
          userId: 'user_123',
          workspaceId: 'workspace_123',
          nodeId: 'node_123',
        },
      }),
      { trust: 'trusted', ingestedAt: '2026-08-13T16:01:01.000Z' },
    );
    await repository.ingestEvent(
      event({
        eventId: EVENT_IDS.completed,
        name: 'install.completed',
        stage: 'complete',
        outcome: 'succeeded',
        sequence: 3,
        occurredAt: '2026-08-13T16:05:00.000Z',
      }),
      { trust: 'installer', ingestedAt: '2026-08-13T16:05:01.000Z' },
    );
    await repository.ingestEvent(
      event({
        eventId: EVENT_IDS.device,
        installId: SECOND_INSTALL_ID,
        name: 'install.started',
        occurredAt: '2026-08-13T15:00:00.000Z',
      }),
      { trust: 'installer', ingestedAt: '2026-08-13T15:00:01.000Z' },
    );
    await repository.ingestEvent(
      event({
        eventId: EVENT_IDS.secondBound,
        installId: SECOND_INSTALL_ID,
        producer: 'app',
        name: 'install.identity.bound',
        stage: 'node_registration',
        outcome: 'succeeded',
        sequence: 1,
        occurredAt: '2026-08-13T15:01:00.000Z',
        identity: {
          state: 'canonical',
          userId: 'user_completed_only',
          workspaceId: 'workspace_completed_only',
          nodeId: 'node_completed_only',
        },
      }),
      { trust: 'trusted', ingestedAt: '2026-08-13T15:01:01.000Z' },
    );
    await repository.ingestEvent(
      event({
        eventId: EVENT_IDS.secondCompleted,
        installId: SECOND_INSTALL_ID,
        name: 'install.completed',
        stage: 'complete',
        outcome: 'succeeded',
        sequence: 2,
        occurredAt: '2026-08-13T15:05:00.000Z',
      }),
      { trust: 'installer', ingestedAt: '2026-08-13T15:05:01.000Z' },
    );

    const devices: InstallControlPlaneDeviceSource = {
      async listDevices() {
        return [
          {
            nodeId: 'node_123',
            userId: 'user_123',
            workspaceId: 'workspace_123',
            displayName: 'MacBook Pro',
            state: 'offline',
            connectorStatus: 'connected',
            platform: 'darwin',
            architecture: 'arm64',
            channel: 'canary',
            agents: ['codex'],
            lastSeenAt: '2026-08-11T16:59:00.000Z',
          },
        ];
      },
    };
    const service = createInstallControlPlaneService({ repository, devices });
    const overview = await service.getOverview({
      window: '30d',
      nowMs: Date.parse('2026-08-13T17:00:00.000Z'),
    });
    expect(overview).toMatchObject({
      users: { registered: 2, activated: 1, active7d: 1 },
      installs: { started: 2, completed: 2, failed: 0 },
      devices: { total: 1, online: 0 },
      activation: {
        registeredUsers: 2,
        authorizedDevices: 2,
        completedInstalls: 2,
        firstHeartbeats: 1,
        activeUsers: 1,
      },
    });
    const users = await service.listUsers({
      nowMs: Date.parse('2026-08-13T17:00:00.000Z'),
    });
    expect(users.items).toEqual(expect.arrayContaining([
      expect.objectContaining({
        userId: 'user_123',
        activationState: 'active',
        installCount: 1,
        deviceCount: 1,
        lastSeenAt: '2026-08-11T16:59:00.000Z',
      }),
      expect.objectContaining({
        userId: 'user_completed_only',
        activationState: 'installed',
        installCount: 1,
        deviceCount: 0,
      }),
    ]));
  });

  it('prunes canonical session/event telemetry at the 400-day boundary without deleting the user directory', async () => {
    const repository = createMemoryInstallControlPlaneRepository();
    await repository.upsertUser({
      userId: 'user_old',
      workspaceIds: [],
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
    });
    await repository.ingestEvent(
      event({
        eventId: EVENT_IDS.started,
        name: 'install.started',
        occurredAt: '2025-01-01T00:00:00.000Z',
      }),
      { trust: 'installer', ingestedAt: '2025-01-01T00:00:01.000Z' },
    );
    await repository.ingestEvent(
      event({
        eventId: EVENT_IDS.device,
        installId: SECOND_INSTALL_ID,
        name: 'install.started',
        occurredAt: '2026-08-13T00:00:00.000Z',
      }),
      { trust: 'installer', ingestedAt: '2026-08-13T00:00:01.000Z' },
    );

    const nowMs = Date.parse('2026-08-13T17:00:00.000Z');
    expect(INSTALL_TELEMETRY_RETENTION_DAYS.events).toBe(400);
    const pruned = await repository.prune({ nowMs });
    expect(pruned).toMatchObject({ sessions: 1, events: 1 });
    await expect(repository.getInstallDetail(INSTALL_ID, { nowMs })).resolves.toBeUndefined();
    await expect(repository.getInstallDetail(SECOND_INSTALL_ID, { nowMs })).resolves.toBeDefined();
    const users = await repository.listUsers({ nowMs });
    expect(users.items.map((user) => user.userId)).toContain('user_old');
  });
});

describe('device authority projection', () => {
  it('preserves authoritative online/offline/revoked semantics and never treats google:<sub> as a canonical dashboard user id', () => {
    const nowMs = Date.parse('2026-08-13T17:00:00.000Z');
    const base = {
      accountId: 'user_123',
      workspaceId: 'workspace_123',
      workspaceSlug: 'workspace',
      workspaceHost: 'workspace.consuelohq.com',
      nodeId: 'node_123',
      nodeName: 'MacBook Pro',
      displayName: 'MacBook Pro',
      role: 'home' as const,
      platform: 'darwin',
      architecture: 'arm64',
      channel: 'canary',
      connectorId: 'connector_node_123',
      connectorStatus: 'connected' as const,
      capabilities: [],
      agents: ['codex'],
      state: 'active' as const,
      createdAt: nowMs - 60_000,
      updatedAt: nowMs - 60_000,
      lastSeenAt: nowMs - 60_000,
      devicePublicKeyJwk: '{}',
      devicePublicKeyThumbprint: 'thumbprint',
    };

    expect(
      projectAuthorityWorkspaceNodeToDashboardDevice(base, { nowMs }),
    ).toMatchObject({ state: 'active', userId: 'user_123' });
    expect(
      projectAuthorityWorkspaceNodeToDashboardDevice(
        { ...base, lastSeenAt: nowMs - 10 * 60_000 },
        { nowMs },
      ),
    ).toMatchObject({ state: 'offline' });
    expect(
      projectAuthorityWorkspaceNodeToDashboardDevice(
        { ...base, state: 'revoked', connectorStatus: 'disconnected' },
        { nowMs },
      ),
    ).toMatchObject({ state: 'revoked' });
    expect(
      projectAuthorityWorkspaceNodeToDashboardDevice(
        { ...base, accountId: 'google:google-sub-123' },
        { nowMs },
      ),
    ).not.toHaveProperty('userId');
  });
});
