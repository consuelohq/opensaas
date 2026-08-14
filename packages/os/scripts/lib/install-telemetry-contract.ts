export const INSTALL_TELEMETRY_SCHEMA_VERSION = 1 as const;
export const INSTALL_ID_HEADER = 'x-consuelo-install-id' as const;

export const INSTALL_EVENT_NAMES = [
  'install.started',
  'install.stage.started',
  'install.stage.completed',
  'install.stage.failed',
  'install.identity.bound',
  'install.diagnostic.uploaded',
  'install.completed',
  'install.failed',
] as const;

export const INSTALL_TELEMETRY_PRODUCERS = [
  'installer',
  'app',
  'device_authority',
  'workspace_node',
  'control_plane',
] as const;

export const INSTALL_STAGES = [
  'bootstrap',
  'dependencies',
  'workspace',
  'device_auth',
  'workspace_selection',
  'workspace_route',
  'node_registration',
  'connector_provisioning',
  'skills',
  'agents',
  'local_provisioning',
  'background_service',
  'agent_status_sync',
  'health',
  'complete',
] as const;

export const INSTALL_OUTCOMES = [
  'started',
  'succeeded',
  'failed',
  'degraded',
  'skipped',
] as const;

export const INSTALL_ERROR_IMPACTS = ['recoverable', 'fatal'] as const;

export const INSTALL_ERROR_CODES = [
  'INSTALLER_UNEXPECTED_FAILURE',
  'DEPENDENCY_CHECK_FAILED',
  'DEVICE_CODE_REQUEST_FAILED',
  'DEVICE_AUTH_UNAVAILABLE',
  'DEVICE_AUTH_DENIED',
  'DEVICE_AUTH_EXPIRED',
  'DEVICE_AUTH_TIMEOUT',
  'DEVICE_AUTH_POLL_FAILED',
  'DEVICE_AUTH_PROOF_FAILED',
  'WORKSPACE_SELECTION_FAILED',
  'WORKSPACE_ROUTE_SETUP_FAILED',
  'NODE_REGISTRATION_FAILED',
  'CONNECTOR_PROVISION_FAILED',
  'LOCAL_PROVISION_FAILED',
  'BACKGROUND_SERVICE_INSTALL_FAILED',
  'BACKGROUND_SERVICE_START_FAILED',
  'BACKGROUND_SERVICE_HEALTHCHECK_FAILED',
  'AGENT_CONNECTIVITY_FAILED',
  'AGENT_STATUS_SYNC_FAILED',
  'HEALTH_CHECK_FAILED',
  'DIAGNOSTIC_UPLOAD_FAILED',
] as const;

export const INSTALL_TELEMETRY_FORBIDDEN_FIELDS = [
  'email',
  'firstName',
  'lastName',
  'displayName',
  'picture',
  'ip',
  'accountId',
  'googleSub',
  'workspaceSlug',
  'workspaceHost',
  'nodeName',
  'userCode',
  'deviceCode',
  'state',
  'nonce',
  'authorization',
  'cookie',
  'accessToken',
  'refreshToken',
  'bootstrapToken',
  'connectorBootstrapToken',
  'cloudflareTunnelToken',
  'edgeRequestSigningSecret',
  'privateKey',
  'signingKeyJwk',
  'home',
  'path',
  'argv',
  'url',
  'requestBody',
  'responseBody',
] as const;

export const INSTALL_TELEMETRY_STORAGE_OWNERS = {
  sessionsAndEvents: 'consuelo-control-plane',
  diagnosticBundles: 'cloudflare-r2',
  exceptionsAndTraces: 'sentry',
  edgeLogsAndTraces: 'cloudflare-observability',
  productAnalytics: 'posthog',
} as const;

export const INSTALL_TELEMETRY_RETENTION_DAYS = {
  sessions: 400,
  events: 400,
  failedDiagnosticBundles: 30,
  successfulDiagnosticBundlesDefault: 0,
  successfulDiagnosticBundlesOptInMax: 7,
} as const;

export const INSTALL_DASHBOARD_API_PREFIX = '/api/internal/os/v1' as const;
export const INSTALL_DASHBOARD_API_ROUTES = {
  overview: `${INSTALL_DASHBOARD_API_PREFIX}/overview`,
  users: `${INSTALL_DASHBOARD_API_PREFIX}/users`,
  installs: `${INSTALL_DASHBOARD_API_PREFIX}/installs`,
  devices: `${INSTALL_DASHBOARD_API_PREFIX}/devices`,
  errors: `${INSTALL_DASHBOARD_API_PREFIX}/errors`,
} as const;

export type InstallId = `ins_${string}`;
export type InstallEventId = `evt_${string}`;
export type InstallTelemetryEventName = (typeof INSTALL_EVENT_NAMES)[number];
export type InstallTelemetryProducer =
  (typeof INSTALL_TELEMETRY_PRODUCERS)[number];
export type InstallStage = (typeof INSTALL_STAGES)[number];
export type InstallOutcome = (typeof INSTALL_OUTCOMES)[number];
export type InstallErrorImpact = (typeof INSTALL_ERROR_IMPACTS)[number];
export type InstallErrorCode = (typeof INSTALL_ERROR_CODES)[number];

const UUID_V4_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

function createPrefixedUuid<T extends InstallId | InstallEventId>(
  prefix: 'ins_' | 'evt_',
  randomUuid: () => string,
): T {
  const uuid = randomUuid().trim().toLowerCase();
  if (!UUID_V4_PATTERN.test(uuid)) {
    throw new Error(`invalid UUID v4 supplied for ${prefix.slice(0, -1)} id`);
  }
  return `${prefix}${uuid}` as T;
}

export function createInstallId(
  randomUuid: () => string = () => globalThis.crypto.randomUUID(),
): InstallId {
  return createPrefixedUuid<InstallId>('ins_', randomUuid);
}

export function createInstallEventId(
  randomUuid: () => string = () => globalThis.crypto.randomUUID(),
): InstallEventId {
  return createPrefixedUuid<InstallEventId>('evt_', randomUuid);
}

export function isInstallId(value: string): value is InstallId {
  return value.startsWith('ins_') && UUID_V4_PATTERN.test(value.slice(4));
}

export function isInstallEventId(value: string): value is InstallEventId {
  return value.startsWith('evt_') && UUID_V4_PATTERN.test(value.slice(4));
}

export type InstallAnonymousIdentity = {
  state: 'anonymous';
  nodeId?: string;
  userId?: never;
  workspaceId?: never;
};

export type InstallBoundIdentity = {
  state: 'canonical';
  userId: string;
  workspaceId: string;
  nodeId?: string;
};

export type InstallCanonicalIdentity =
  | InstallAnonymousIdentity
  | InstallBoundIdentity;

export type InstallTelemetrySafeContext = {
  platform?: string;
  architecture?: string;
  channel?: string;
  release?: string;
  installerVersion?: string;
  osMode?: string;
  nodeRole?: string;
  nodeStatus?: string;
  deviceLoginStatus?: string;
  diagnosticKind?: string;
  httpStatus?: number;
  durationMs?: number;
  attempt?: number;
  selectedSkillCount?: number;
  detectedAgentCount?: number;
  selectedAgentCount?: number;
  verifiedAgentCount?: number;
  connectedAgentCount?: number;
  installDaemons?: boolean;
  dryRun?: boolean;
};

const SAFE_STRING_CONTEXT_FIELDS = [
  'platform',
  'architecture',
  'channel',
  'release',
  'installerVersion',
  'osMode',
  'nodeRole',
  'nodeStatus',
  'deviceLoginStatus',
  'diagnosticKind',
] as const satisfies readonly (keyof InstallTelemetrySafeContext)[];

const SAFE_NUMBER_CONTEXT_FIELDS = [
  'httpStatus',
  'durationMs',
  'attempt',
  'selectedSkillCount',
  'detectedAgentCount',
  'selectedAgentCount',
  'verifiedAgentCount',
  'connectedAgentCount',
] as const satisfies readonly (keyof InstallTelemetrySafeContext)[];

const SAFE_BOOLEAN_CONTEXT_FIELDS = [
  'installDaemons',
  'dryRun',
] as const satisfies readonly (keyof InstallTelemetrySafeContext)[];

const MAX_SAFE_CONTEXT_STRING_LENGTH = 128;

export function pickInstallTelemetrySafeContext(
  input: Readonly<Record<string, unknown>>,
): InstallTelemetrySafeContext {
  const output: InstallTelemetrySafeContext = {};

  for (const key of SAFE_STRING_CONTEXT_FIELDS) {
    const value = input[key];
    if (
      typeof value === 'string' &&
      value.length > 0 &&
      value.length <= MAX_SAFE_CONTEXT_STRING_LENGTH
    ) {
      output[key] = value;
    }
  }

  for (const key of SAFE_NUMBER_CONTEXT_FIELDS) {
    const value = input[key];
    if (typeof value === 'number' && Number.isFinite(value) && value >= 0) {
      output[key] = value;
    }
  }

  for (const key of SAFE_BOOLEAN_CONTEXT_FIELDS) {
    const value = input[key];
    if (typeof value === 'boolean') {
      output[key] = value;
    }
  }

  return output;
}

export type InstallTelemetryError = {
  code: InstallErrorCode;
  impact: InstallErrorImpact;
};

export type InstallTelemetryEvent = {
  schemaVersion: typeof INSTALL_TELEMETRY_SCHEMA_VERSION;
  eventId: InstallEventId;
  installId: InstallId;
  producer: InstallTelemetryProducer;
  name: InstallTelemetryEventName;
  stage: InstallStage;
  outcome: InstallOutcome;
  occurredAt: string;
  sequence: number;
  identity: InstallCanonicalIdentity;
  context?: InstallTelemetrySafeContext;
  error?: InstallTelemetryError;
};

export type InstallSessionStatus =
  | 'in_progress'
  | 'completed'
  | 'failed'
  | 'degraded'
  | 'abandoned';

export type InstallDashboardWindow = '24h' | '7d' | '30d' | '90d' | '400d';

export type InstallDashboardOverview = {
  generatedAt: string;
  window: InstallDashboardWindow;
  users: {
    registered: number;
    activated: number;
    active7d: number;
  };
  installs: {
    started: number;
    completed: number;
    failed: number;
  };
  devices: {
    total: number;
    online: number;
  };
  activation: {
    registeredUsers: number;
    authorizedDevices: number;
    completedInstalls: number;
    firstHeartbeats: number;
    activeUsers: number;
  };
  trend: Array<{
    date: string;
    registeredUsers: number;
    installStarts: number;
    completedInstalls: number;
    failedInstalls: number;
  }>;
};

export type InstallDashboardActivationState =
  | 'registered'
  | 'authorized'
  | 'installed'
  | 'active';

export type InstallDashboardUserSummary = {
  userId: string;
  email?: string;
  displayName?: string;
  createdAt: string;
  workspaceIds: string[];
  activationState: InstallDashboardActivationState;
  installCount: number;
  deviceCount: number;
  lastSeenAt?: string;
};

export type InstallDashboardInstallSummary = {
  installId: InstallId;
  userId?: string;
  workspaceId?: string;
  nodeId?: string;
  status: InstallSessionStatus;
  currentStage: InstallStage;
  startedAt: string;
  updatedAt: string;
  completedAt?: string;
  durationMs?: number;
  platform?: string;
  architecture?: string;
  channel?: string;
  release?: string;
  lastErrorCode?: InstallErrorCode;
  diagnosticAvailable: boolean;
};

export type InstallDashboardDeviceSummary = {
  nodeId: string;
  userId?: string;
  workspaceId?: string;
  displayName?: string;
  state: 'active' | 'offline' | 'revoked';
  connectorStatus?: 'connected' | 'disconnected';
  platform?: string;
  architecture?: string;
  channel?: string;
  agents: string[];
  lastSeenAt?: string;
};

export type InstallDashboardErrorGroup = {
  errorCode: InstallErrorCode;
  stage: InstallStage;
  impact: InstallErrorImpact;
  count: number;
  affectedInstalls: number;
  affectedUsers: number;
  latestAt: string;
  platformBreakdown: Record<string, number>;
  channelBreakdown: Record<string, number>;
};

export type InstallDashboardTimelineEvent = InstallTelemetryEvent & {
  ingestedAt: string;
};

export type InstallDashboardDiagnosticBundle =
  | { available: false }
  | {
      available: true;
      bundleId: string;
      outcome: 'failed' | 'successful';
      createdAt: string;
      expiresAt: string;
    };

export type InstallDashboardEvidence = {
  sentryEventIds: string[];
  cloudflareTraceIds: string[];
};

export type InstallDashboardInstallDetail = {
  install: InstallDashboardInstallSummary;
  timeline: InstallDashboardTimelineEvent[];
  diagnosticBundle: InstallDashboardDiagnosticBundle;
  evidence: InstallDashboardEvidence;
};

export type InstallDashboardPage<T> = {
  items: T[];
  nextCursor?: string;
};

export function installDashboardDetailRoute(installId: InstallId): string {
  if (!isInstallId(installId)) {
    throw new Error('install dashboard detail route requires a valid install id');
  }
  return `${INSTALL_DASHBOARD_API_ROUTES.installs}/${encodeURIComponent(installId)}`;
}

export function installDashboardDiagnosticRoute(installId: InstallId): string {
  return `${installDashboardDetailRoute(installId)}/diagnostic`;
}
