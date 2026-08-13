import type {
  InstallDashboardDeviceSummary,
  InstallDashboardErrorGroup,
  InstallDashboardInstallDetail,
  InstallDashboardInstallSummary,
  InstallDashboardOverview,
  InstallDashboardPage,
  InstallDashboardTimelineEvent,
  InstallDashboardUserSummary,
  InstallEventId,
  InstallId,
  InstallStage,
} from './install-telemetry-contract';

export type InternalDashboardFixtures = {
  overview: InstallDashboardOverview;
  users: InstallDashboardPage<InstallDashboardUserSummary>;
  installs: InstallDashboardPage<InstallDashboardInstallSummary>;
  devices: InstallDashboardPage<InstallDashboardDeviceSummary>;
  errors: InstallDashboardPage<InstallDashboardErrorGroup>;
  installDetails: Record<string, InstallDashboardInstallDetail>;
};

const ids = {
  complete: 'ins_11111111-1111-4111-8111-111111111111' as InstallId,
  failedBackground: 'ins_22222222-2222-4222-8222-222222222222' as InstallId,
  inProgress: 'ins_33333333-3333-4333-8333-333333333333' as InstallId,
  degraded: 'ins_44444444-4444-4444-8444-444444444444' as InstallId,
} as const;

const eventId = (digit: string, sequence: number): InstallEventId => {
  const tail = String(sequence).padStart(12, digit);
  return `evt_${digit.repeat(8)}-${digit.repeat(4)}-4${digit.repeat(3)}-8${digit.repeat(3)}-${tail}` as InstallEventId;
};

const trendRows: InstallDashboardOverview['trend'] = [
  [15, 1, 1, 1, 0], [16, 0, 0, 0, 0], [17, 1, 1, 0, 0], [18, 0, 1, 1, 0],
  [19, 1, 1, 1, 0], [20, 1, 1, 1, 0], [21, 0, 0, 0, 0], [22, 1, 1, 1, 0],
  [23, 0, 0, 0, 0], [24, 2, 2, 1, 1], [25, 1, 1, 1, 0], [26, 0, 1, 1, 0],
  [27, 1, 1, 1, 0], [28, 1, 1, 1, 0], [29, 0, 0, 0, 0], [30, 2, 2, 2, 0],
  [31, 1, 1, 0, 1], [1, 1, 1, 1, 0], [2, 1, 1, 1, 0], [3, 2, 2, 1, 1],
  [4, 1, 1, 1, 0], [5, 1, 1, 1, 0], [6, 2, 2, 2, 0], [7, 1, 1, 1, 0],
  [8, 2, 2, 2, 0], [9, 2, 2, 1, 1], [10, 1, 1, 1, 0], [11, 2, 2, 2, 0],
  [12, 1, 1, 1, 0], [13, 3, 3, 2, 0],
].map(([day, registeredUsers, installStarts, completedInstalls, failedInstalls], index) => {
  const month = index < 17 ? '07' : '08';
  return {
    date: `2026-${month}-${String(day).padStart(2, '0')}`,
    registeredUsers,
    installStarts,
    completedInstalls,
    failedInstalls,
  };
});

const users: InstallDashboardUserSummary[] = [
  {
    userId: 'usr_fixture_01',
    displayName: 'Maya Chen',
    email: 'maya@example.test',
    createdAt: '2026-08-13T13:02:00.000Z',
    workspaceIds: ['ws_fixture_alpha'],
    activationState: 'active',
    installCount: 1,
    deviceCount: 1,
    lastSeenAt: '2026-08-13T17:49:00.000Z',
  },
  {
    userId: 'usr_fixture_02',
    displayName: 'Andre Lewis',
    email: 'andre@example.test',
    createdAt: '2026-08-13T12:31:00.000Z',
    workspaceIds: ['ws_fixture_beta'],
    activationState: 'authorized',
    installCount: 1,
    deviceCount: 0,
    lastSeenAt: '2026-08-13T12:42:00.000Z',
  },
  {
    userId: 'usr_fixture_03',
    displayName: 'Sarah Okafor',
    email: 'sarah@example.test',
    createdAt: '2026-08-12T21:18:00.000Z',
    workspaceIds: ['ws_fixture_gamma'],
    activationState: 'installed',
    installCount: 1,
    deviceCount: 1,
    lastSeenAt: '2026-08-13T14:18:00.000Z',
  },
  {
    userId: 'usr_fixture_04',
    displayName: 'Jordan Patel',
    email: 'jordan@example.test',
    createdAt: '2026-08-12T18:03:00.000Z',
    workspaceIds: ['ws_fixture_alpha'],
    activationState: 'registered',
    installCount: 0,
    deviceCount: 0,
  },
  {
    userId: 'usr_fixture_05',
    displayName: 'Noah Kim',
    email: 'noah@example.test',
    createdAt: '2026-08-11T19:10:00.000Z',
    workspaceIds: ['ws_fixture_delta'],
    activationState: 'active',
    installCount: 2,
    deviceCount: 2,
    lastSeenAt: '2026-08-13T17:36:00.000Z',
  },
  {
    userId: 'usr_fixture_06',
    displayName: 'Elena Ruiz',
    email: 'elena@example.test',
    createdAt: '2026-08-10T15:44:00.000Z',
    workspaceIds: ['ws_fixture_epsilon'],
    activationState: 'active',
    installCount: 1,
    deviceCount: 1,
    lastSeenAt: '2026-08-13T16:55:00.000Z',
  },
];

const installs: InstallDashboardInstallSummary[] = [
  {
    installId: ids.complete,
    userId: 'usr_fixture_01',
    workspaceId: 'ws_fixture_alpha',
    nodeId: 'node_fixture_maya_macbook',
    status: 'completed',
    currentStage: 'complete',
    startedAt: '2026-08-13T13:06:00.000Z',
    updatedAt: '2026-08-13T13:10:52.000Z',
    completedAt: '2026-08-13T13:10:52.000Z',
    durationMs: 292_000,
    platform: 'darwin',
    architecture: 'arm64',
    channel: 'canary',
    release: '2026.08.13-canary.4',
    diagnosticAvailable: false,
  },
  {
    installId: ids.failedBackground,
    userId: 'usr_fixture_02',
    workspaceId: 'ws_fixture_beta',
    nodeId: 'node_fixture_andre_macbook',
    status: 'failed',
    currentStage: 'background_service',
    startedAt: '2026-08-13T12:33:00.000Z',
    updatedAt: '2026-08-13T12:39:31.000Z',
    durationMs: 391_000,
    platform: 'darwin',
    architecture: 'arm64',
    channel: 'stable',
    release: '2026.08.12',
    lastErrorCode: 'BACKGROUND_SERVICE_START_FAILED',
    diagnosticAvailable: true,
  },
  {
    installId: ids.inProgress,
    startedAt: '2026-08-13T17:48:00.000Z',
    updatedAt: '2026-08-13T17:52:00.000Z',
    status: 'in_progress',
    currentStage: 'device_auth',
    platform: 'darwin',
    architecture: 'arm64',
    channel: 'stable',
    release: '2026.08.12',
    diagnosticAvailable: false,
  },
  {
    installId: ids.degraded,
    userId: 'usr_fixture_03',
    workspaceId: 'ws_fixture_gamma',
    nodeId: 'node_fixture_sarah_air',
    status: 'degraded',
    currentStage: 'agent_status_sync',
    startedAt: '2026-08-12T21:21:00.000Z',
    updatedAt: '2026-08-12T21:29:14.000Z',
    completedAt: '2026-08-12T21:29:14.000Z',
    durationMs: 494_000,
    platform: 'darwin',
    architecture: 'x64',
    channel: 'canary',
    release: '2026.08.12-canary.9',
    lastErrorCode: 'AGENT_STATUS_SYNC_FAILED',
    diagnosticAvailable: true,
  },
];

const devices: InstallDashboardDeviceSummary[] = [
  {
    nodeId: 'node_fixture_maya_macbook',
    userId: 'usr_fixture_01',
    workspaceId: 'ws_fixture_alpha',
    displayName: 'Maya’s MacBook Pro',
    state: 'active',
    connectorStatus: 'connected',
    platform: 'darwin',
    architecture: 'arm64',
    channel: 'canary',
    agents: ['ChatGPT', 'Claude Code'],
    lastSeenAt: '2026-08-13T17:49:00.000Z',
  },
  {
    nodeId: 'node_fixture_sarah_air',
    userId: 'usr_fixture_03',
    workspaceId: 'ws_fixture_gamma',
    displayName: 'Sarah’s MacBook Air',
    state: 'active',
    connectorStatus: 'connected',
    platform: 'darwin',
    architecture: 'x64',
    channel: 'canary',
    agents: ['ChatGPT'],
    lastSeenAt: '2026-08-13T14:18:00.000Z',
  },
  {
    nodeId: 'node_fixture_noah_mini',
    userId: 'usr_fixture_05',
    workspaceId: 'ws_fixture_delta',
    displayName: 'Noah’s Mac mini',
    state: 'active',
    connectorStatus: 'connected',
    platform: 'darwin',
    architecture: 'arm64',
    channel: 'stable',
    agents: ['ChatGPT', 'Codex'],
    lastSeenAt: '2026-08-13T17:36:00.000Z',
  },
  {
    nodeId: 'node_fixture_elena_imac',
    userId: 'usr_fixture_06',
    workspaceId: 'ws_fixture_epsilon',
    displayName: 'Elena’s iMac',
    state: 'offline',
    connectorStatus: 'disconnected',
    platform: 'darwin',
    architecture: 'arm64',
    channel: 'stable',
    agents: ['ChatGPT'],
    lastSeenAt: '2026-08-12T22:16:00.000Z',
  },
  {
    nodeId: 'node_fixture_retired',
    userId: 'usr_fixture_05',
    workspaceId: 'ws_fixture_delta',
    displayName: 'Noah’s old MacBook',
    state: 'revoked',
    connectorStatus: 'disconnected',
    platform: 'darwin',
    architecture: 'x64',
    channel: 'stable',
    agents: [],
    lastSeenAt: '2026-07-28T18:02:00.000Z',
  },
];

const errors: InstallDashboardErrorGroup[] = [
  {
    errorCode: 'BACKGROUND_SERVICE_START_FAILED',
    stage: 'background_service',
    impact: 'fatal',
    count: 7,
    affectedInstalls: 7,
    affectedUsers: 6,
    latestAt: '2026-08-13T12:39:31.000Z',
    platformBreakdown: { darwin: 7 },
    channelBreakdown: { stable: 5, canary: 2 },
  },
  {
    errorCode: 'DEVICE_AUTH_TIMEOUT',
    stage: 'device_auth',
    impact: 'recoverable',
    count: 4,
    affectedInstalls: 4,
    affectedUsers: 4,
    latestAt: '2026-08-13T17:52:00.000Z',
    platformBreakdown: { darwin: 4 },
    channelBreakdown: { stable: 3, canary: 1 },
  },
  {
    errorCode: 'CONNECTOR_PROVISION_FAILED',
    stage: 'connector_provisioning',
    impact: 'fatal',
    count: 2,
    affectedInstalls: 2,
    affectedUsers: 2,
    latestAt: '2026-08-11T20:18:00.000Z',
    platformBreakdown: { darwin: 2 },
    channelBreakdown: { stable: 2 },
  },
  {
    errorCode: 'AGENT_STATUS_SYNC_FAILED',
    stage: 'agent_status_sync',
    impact: 'recoverable',
    count: 2,
    affectedInstalls: 2,
    affectedUsers: 2,
    latestAt: '2026-08-12T21:29:14.000Z',
    platformBreakdown: { darwin: 2 },
    channelBreakdown: { canary: 2 },
  },
  {
    errorCode: 'HEALTH_CHECK_FAILED',
    stage: 'health',
    impact: 'fatal',
    count: 1,
    affectedInstalls: 1,
    affectedUsers: 1,
    latestAt: '2026-08-08T16:11:00.000Z',
    platformBreakdown: { darwin: 1 },
    channelBreakdown: { stable: 1 },
  },
];

function timelineEvent(input: {
  eventId: InstallEventId;
  installId: InstallId;
  sequence: number;
  at: string;
  name: InstallDashboardTimelineEvent['name'];
  stage: InstallStage;
  outcome: InstallDashboardTimelineEvent['outcome'];
  userId?: string;
  workspaceId?: string;
  nodeId?: string;
  error?: InstallDashboardTimelineEvent['error'];
}): InstallDashboardTimelineEvent {
  const identity = input.userId && input.workspaceId
    ? {
        state: 'canonical' as const,
        userId: input.userId,
        workspaceId: input.workspaceId,
        nodeId: input.nodeId,
      }
    : { state: 'anonymous' as const, nodeId: input.nodeId };

  return {
    schemaVersion: 1,
    eventId: input.eventId,
    installId: input.installId,
    producer: input.stage === 'device_auth' ? 'device_authority' : 'installer',
    name: input.name,
    stage: input.stage,
    outcome: input.outcome,
    occurredAt: input.at,
    ingestedAt: input.at,
    sequence: input.sequence,
    identity,
    context: {
      platform: 'darwin',
      architecture: 'arm64',
      channel: input.installId === ids.complete ? 'canary' : 'stable',
    },
    ...(input.error ? { error: input.error } : {}),
  };
}

const completeDetail: InstallDashboardInstallDetail = {
  install: installs[0]!,
  timeline: [
    timelineEvent({ eventId: eventId('1', 1), installId: ids.complete, sequence: 1, at: '2026-08-13T13:06:00.000Z', name: 'install.started', stage: 'bootstrap', outcome: 'started' }),
    timelineEvent({ eventId: eventId('1', 2), installId: ids.complete, sequence: 2, at: '2026-08-13T13:06:48.000Z', name: 'install.stage.completed', stage: 'dependencies', outcome: 'succeeded' }),
    timelineEvent({ eventId: eventId('1', 3), installId: ids.complete, sequence: 3, at: '2026-08-13T13:07:54.000Z', name: 'install.identity.bound', stage: 'device_auth', outcome: 'succeeded', userId: 'usr_fixture_01', workspaceId: 'ws_fixture_alpha' }),
    timelineEvent({ eventId: eventId('1', 4), installId: ids.complete, sequence: 4, at: '2026-08-13T13:09:41.000Z', name: 'install.stage.completed', stage: 'background_service', outcome: 'succeeded', userId: 'usr_fixture_01', workspaceId: 'ws_fixture_alpha', nodeId: 'node_fixture_maya_macbook' }),
    timelineEvent({ eventId: eventId('1', 5), installId: ids.complete, sequence: 5, at: '2026-08-13T13:10:52.000Z', name: 'install.completed', stage: 'complete', outcome: 'succeeded', userId: 'usr_fixture_01', workspaceId: 'ws_fixture_alpha', nodeId: 'node_fixture_maya_macbook' }),
  ],
  diagnosticBundle: { available: false },
  evidence: { sentryEventIds: [], cloudflareTraceIds: ['cf_fixture_complete_01'] },
};

const failedDetail: InstallDashboardInstallDetail = {
  install: installs[1]!,
  timeline: [
    timelineEvent({ eventId: eventId('2', 1), installId: ids.failedBackground, sequence: 1, at: '2026-08-13T12:33:00.000Z', name: 'install.started', stage: 'bootstrap', outcome: 'started' }),
    timelineEvent({ eventId: eventId('2', 2), installId: ids.failedBackground, sequence: 2, at: '2026-08-13T12:34:12.000Z', name: 'install.identity.bound', stage: 'device_auth', outcome: 'succeeded', userId: 'usr_fixture_02', workspaceId: 'ws_fixture_beta' }),
    timelineEvent({ eventId: eventId('2', 3), installId: ids.failedBackground, sequence: 3, at: '2026-08-13T12:37:18.000Z', name: 'install.stage.started', stage: 'background_service', outcome: 'started', userId: 'usr_fixture_02', workspaceId: 'ws_fixture_beta', nodeId: 'node_fixture_andre_macbook' }),
    timelineEvent({ eventId: eventId('2', 4), installId: ids.failedBackground, sequence: 4, at: '2026-08-13T12:39:31.000Z', name: 'install.stage.failed', stage: 'background_service', outcome: 'failed', userId: 'usr_fixture_02', workspaceId: 'ws_fixture_beta', nodeId: 'node_fixture_andre_macbook', error: { code: 'BACKGROUND_SERVICE_START_FAILED', impact: 'fatal' } }),
    timelineEvent({ eventId: eventId('2', 5), installId: ids.failedBackground, sequence: 5, at: '2026-08-13T12:39:31.000Z', name: 'install.failed', stage: 'background_service', outcome: 'failed', userId: 'usr_fixture_02', workspaceId: 'ws_fixture_beta', nodeId: 'node_fixture_andre_macbook', error: { code: 'BACKGROUND_SERVICE_START_FAILED', impact: 'fatal' } }),
  ],
  diagnosticBundle: {
    available: true,
    bundleId: 'diag_fixture_2222',
    outcome: 'failed',
    createdAt: '2026-08-13T12:40:04.000Z',
    expiresAt: '2026-09-12T12:40:04.000Z',
  },
  evidence: {
    sentryEventIds: ['sentry_fixture_4e91b8'],
    cloudflareTraceIds: ['cf_fixture_a72d19'],
  },
};

export const INTERNAL_DASHBOARD_FIXTURES: InternalDashboardFixtures = {
  overview: {
    generatedAt: '2026-08-13T17:53:00.000Z',
    window: '30d',
    users: { registered: 31, activated: 24, active7d: 21 },
    installs: { started: 31, completed: 24, failed: 4 },
    devices: { total: 8, online: 6 },
    activation: {
      registeredUsers: 31,
      authorizedDevices: 27,
      completedInstalls: 24,
      firstHeartbeats: 23,
      activeUsers: 21,
    },
    trend: trendRows,
  },
  users: { items: users },
  installs: { items: installs },
  devices: { items: devices },
  errors: { items: errors },
  installDetails: {
    [ids.complete]: completeDetail,
    [ids.failedBackground]: failedDetail,
  },
};

export const INTERNAL_DASHBOARD_FIXTURE_IDS = ids;
