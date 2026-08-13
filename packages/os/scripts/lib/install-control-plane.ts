import {
  INSTALL_TELEMETRY_RETENTION_DAYS,
  isInstallEventId,
  isInstallId,
  pickInstallTelemetrySafeContext,
  type InstallDashboardDeviceSummary,
  type InstallDashboardErrorGroup,
  type InstallDashboardInstallDetail,
  type InstallDashboardInstallSummary,
  type InstallDashboardOverview,
  type InstallDashboardPage,
  type InstallDashboardUserSummary,
  type InstallDashboardWindow,
  type InstallId,
  type InstallTelemetryEvent,
} from './install-telemetry-contract';
import type { WorkspaceNode } from '../../cloudflare/os-device-authority/src/types';

export type InstallControlPlaneTrust = 'installer' | 'trusted';

export type InstallControlPlaneIngestOptions = {
  trust: InstallControlPlaneTrust;
  ingestedAt: string;
};

export type InstallControlPlaneUserRecord = {
  userId: string;
  email?: string;
  displayName?: string;
  workspaceIds: string[];
  createdAt: string;
  updatedAt: string;
};

export type InstallControlPlaneDiagnosticRecord = {
  bundleId: string;
  installId: InstallId;
  objectKey: string;
  outcome: 'failed' | 'successful';
  createdAt: string;
  expiresAt: string;
};

export type InstallControlPlaneEvidenceRecord = {
  installId: InstallId;
  kind: 'sentry' | 'cloudflare';
  referenceId: string;
  createdAt: string;
};

export type InstallControlPlanePruneResult = {
  sessions: number;
  events: number;
  diagnostics: number;
  evidence: number;
};

export type InstallControlPlaneRepository = {
  ingestEvent(
    event: InstallTelemetryEvent,
    options: InstallControlPlaneIngestOptions,
  ): Promise<{ created: boolean; install: InstallDashboardInstallSummary }>;
  upsertUser(record: InstallControlPlaneUserRecord): Promise<void>;
  recordDiagnosticBundle(record: InstallControlPlaneDiagnosticRecord): Promise<void>;
  getDiagnosticBundleRecord(
    installId: InstallId,
    options: { nowMs: number },
  ): Promise<InstallControlPlaneDiagnosticRecord | undefined>;
  recordEvidence(record: InstallControlPlaneEvidenceRecord): Promise<void>;
  getInstallDetail(
    installId: InstallId,
    options: { nowMs: number },
  ): Promise<InstallDashboardInstallDetail | undefined>;
  listInstalls(options: {
    nowMs: number;
    sinceMs?: number;
    limit?: number;
    cursor?: string;
  }): Promise<InstallDashboardPage<InstallDashboardInstallSummary>>;
  listUsers(options: {
    nowMs: number;
    limit?: number;
    cursor?: string;
  }): Promise<InstallDashboardPage<InstallDashboardUserSummary>>;
  listErrors(options: {
    nowMs: number;
    sinceMs?: number;
    limit?: number;
    cursor?: string;
  }): Promise<InstallDashboardPage<InstallDashboardErrorGroup>>;
  prune(options: { nowMs: number }): Promise<InstallControlPlanePruneResult>;
};

export type InstallControlPlaneDeviceSource = {
  listDevices(options: { nowMs: number }): Promise<InstallDashboardDeviceSummary[]>;
};

type StoredEvent = InstallTelemetryEvent & { ingestedAt: string };
type StoredSession = InstallDashboardInstallSummary;

type MemoryState = {
  events: Map<string, StoredEvent>;
  sessions: Map<InstallId, StoredSession>;
  users: Map<string, InstallControlPlaneUserRecord>;
  diagnostics: Map<string, InstallControlPlaneDiagnosticRecord>;
  evidence: Map<string, InstallControlPlaneEvidenceRecord>;
};

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_PAGE_SIZE = 100;
const MAX_PAGE_SIZE = 500;
const DEFAULT_HEARTBEAT_TTL_MS = 60_000;

function isoMs(value: string, label: string): number {
  const ms = Date.parse(value);
  if (!Number.isFinite(ms)) throw new Error(`invalid ${label}`);
  return ms;
}

function cloneEvent(event: InstallTelemetryEvent): InstallTelemetryEvent {
  return {
    ...event,
    identity: { ...event.identity },
    ...(event.context ? { context: { ...event.context } } : {}),
    ...(event.error ? { error: { ...event.error } } : {}),
  };
}

function cloneInstall(
  install: InstallDashboardInstallSummary,
): InstallDashboardInstallSummary {
  return { ...install };
}

function safeLimit(limit?: number): number {
  if (!Number.isFinite(limit)) return DEFAULT_PAGE_SIZE;
  return Math.min(MAX_PAGE_SIZE, Math.max(1, Math.floor(limit ?? DEFAULT_PAGE_SIZE)));
}

function pageFrom<T>(
  items: T[],
  options: { limit?: number; cursor?: string },
): InstallDashboardPage<T> {
  const limit = safeLimit(options.limit);
  const offset = options.cursor ? Number.parseInt(options.cursor, 10) : 0;
  const start = Number.isFinite(offset) && offset >= 0 ? offset : 0;
  const page = items.slice(start, start + limit);
  const next = start + page.length;
  return {
    items: page,
    ...(next < items.length ? { nextCursor: String(next) } : {}),
  };
}

function validateEventEnvelope(event: InstallTelemetryEvent): void {
  if (event.schemaVersion !== 1) throw new Error('unsupported install telemetry schema');
  if (!isInstallEventId(event.eventId)) throw new Error('invalid install event id');
  if (!isInstallId(event.installId)) throw new Error('invalid install id');
  if (!Number.isInteger(event.sequence) || event.sequence < 0) {
    throw new Error('invalid install event sequence');
  }
  isoMs(event.occurredAt, 'install event occurredAt');
  if (event.identity.state === 'canonical') {
    if (
      !event.identity.userId.trim() ||
      !event.identity.workspaceId.trim() ||
      event.identity.userId.startsWith('google:')
    ) {
      throw new Error('invalid canonical identity');
    }
  }
}

function eventFingerprint(event: InstallTelemetryEvent): string {
  const { ingestedAt: _ingestedAt, ...clean } = event as InstallTelemetryEvent & {
    ingestedAt?: string;
  };
  return JSON.stringify(cloneEvent(clean));
}

function inferStatus(event: InstallTelemetryEvent): StoredSession['status'] | undefined {
  if (event.name === 'install.completed') {
    return event.outcome === 'degraded' ? 'degraded' : 'completed';
  }
  if (event.name === 'install.failed') return 'failed';
  return undefined;
}

function createSession(event: InstallTelemetryEvent): StoredSession {
  const context = pickInstallTelemetrySafeContext(event.context ?? {});
  return {
    installId: event.installId,
    ...(event.identity.state === 'canonical'
      ? {
          userId: event.identity.userId,
          workspaceId: event.identity.workspaceId,
          ...(event.identity.nodeId ? { nodeId: event.identity.nodeId } : {}),
        }
      : event.identity.nodeId
        ? { nodeId: event.identity.nodeId }
        : {}),
    status: inferStatus(event) ?? 'in_progress',
    currentStage: event.stage,
    startedAt: event.occurredAt,
    updatedAt: event.occurredAt,
    ...(event.name === 'install.completed' || event.name === 'install.failed'
      ? { completedAt: event.occurredAt }
      : {}),
    ...(context.durationMs !== undefined
      ? { durationMs: context.durationMs }
      : {}),
    ...(context.platform ? { platform: context.platform } : {}),
    ...(context.architecture ? { architecture: context.architecture } : {}),
    ...(context.channel ? { channel: context.channel } : {}),
    ...(context.release ? { release: context.release } : {}),
    ...(event.error ? { lastErrorCode: event.error.code } : {}),
    diagnosticAvailable: false,
  };
}

function bindCanonicalIdentity(
  session: StoredSession,
  event: InstallTelemetryEvent,
): void {
  if (event.identity.state !== 'canonical') return;
  const identity = event.identity;
  if (session.userId && session.userId !== identity.userId) {
    throw new Error('install canonical user identity cannot change');
  }
  if (session.workspaceId && session.workspaceId !== identity.workspaceId) {
    throw new Error('install canonical workspace identity cannot change');
  }
  if (session.nodeId && identity.nodeId && session.nodeId !== identity.nodeId) {
    throw new Error('install canonical node identity cannot change');
  }
  session.userId = identity.userId;
  session.workspaceId = identity.workspaceId;
  if (identity.nodeId) session.nodeId = identity.nodeId;
}

function projectSession(session: StoredSession, event: InstallTelemetryEvent): void {
  bindCanonicalIdentity(session, event);
  const context = pickInstallTelemetrySafeContext(event.context ?? {});
  const status = inferStatus(event);
  const terminal =
    session.status === 'completed' ||
    session.status === 'degraded' ||
    session.status === 'failed';
  if (!terminal || status) {
    session.currentStage = event.stage;
    session.updatedAt = event.occurredAt;
  }
  if (context.platform) session.platform = context.platform;
  if (context.architecture) session.architecture = context.architecture;
  if (context.channel) session.channel = context.channel;
  if (context.release) session.release = context.release;
  if (event.error) session.lastErrorCode = event.error.code;
  if (status) {
    session.status = status;
    session.completedAt = event.occurredAt;
    session.durationMs =
      context.durationMs ??
      Math.max(0, isoMs(event.occurredAt, 'occurredAt') - isoMs(session.startedAt, 'startedAt'));
  }
}

function compareInstallEvents(
  left: InstallTelemetryEvent,
  right: InstallTelemetryEvent,
): number {
  return (
    left.occurredAt.localeCompare(right.occurredAt) ||
    left.producer.localeCompare(right.producer) ||
    left.sequence - right.sequence ||
    left.eventId.localeCompare(right.eventId)
  );
}

function projectSessionFromEvents(events: InstallTelemetryEvent[]): StoredSession {
  if (events.length === 0) throw new Error('install session projection requires events');
  const ordered = [...events].sort(compareInstallEvents);
  const session = createSession(ordered[0]!);
  const started = ordered.find((event) => event.name === 'install.started');
  if (started) session.startedAt = started.occurredAt;
  for (const event of ordered.slice(1)) projectSession(session, event);
  return session;
}

function activationStateFor(input: {
  installs: InstallDashboardInstallSummary[];
  devices: InstallDashboardDeviceSummary[];
}): InstallDashboardUserSummary['activationState'] {
  if (input.devices.some((device) => Boolean(device.lastSeenAt))) return 'active';
  if (input.installs.some((install) => install.status === 'completed')) return 'installed';
  if (input.installs.some((install) => Boolean(install.nodeId))) return 'authorized';
  return 'registered';
}

function errorGroupsFromEvents(
  events: StoredEvent[],
  sessions: Map<InstallId, StoredSession>,
): InstallDashboardErrorGroup[] {
  const groups = new Map<string, {
    errorCode: InstallDashboardErrorGroup['errorCode'];
    stage: InstallDashboardErrorGroup['stage'];
    impact: InstallDashboardErrorGroup['impact'];
    events: StoredEvent[];
  }>();
  for (const event of events) {
    if (!event.error) continue;
    const key = `${event.error.code}:${event.stage}:${event.error.impact}`;
    const group = groups.get(key) ?? {
      errorCode: event.error.code,
      stage: event.stage,
      impact: event.error.impact,
      events: [],
    };
    group.events.push(event);
    groups.set(key, group);
  }
  return [...groups.values()]
    .map((group) => {
      const installIds = new Set(group.events.map((event) => event.installId));
      const userIds = new Set(
        [...installIds]
          .map((installId) => sessions.get(installId)?.userId)
          .filter((value): value is string => Boolean(value)),
      );
      const platformBreakdown: Record<string, number> = {};
      const channelBreakdown: Record<string, number> = {};
      for (const installId of installIds) {
        const install = sessions.get(installId);
        if (install?.platform) {
          platformBreakdown[install.platform] = (platformBreakdown[install.platform] ?? 0) + 1;
        }
        if (install?.channel) {
          channelBreakdown[install.channel] = (channelBreakdown[install.channel] ?? 0) + 1;
        }
      }
      return {
        errorCode: group.errorCode,
        stage: group.stage,
        impact: group.impact,
        count: group.events.length,
        affectedInstalls: installIds.size,
        affectedUsers: userIds.size,
        latestAt: group.events
          .map((event) => event.occurredAt)
          .sort((a, b) => b.localeCompare(a))[0]!,
        platformBreakdown,
        channelBreakdown,
      };
    })
    .sort((a, b) => b.count - a.count || b.latestAt.localeCompare(a.latestAt));
}

function windowMs(window: InstallDashboardWindow): number {
  switch (window) {
    case '24h':
      return DAY_MS;
    case '7d':
      return 7 * DAY_MS;
    case '30d':
      return 30 * DAY_MS;
    case '90d':
      return 90 * DAY_MS;
    case '400d':
      return 400 * DAY_MS;
  }
}

function dayKey(value: string): string {
  return value.slice(0, 10);
}

function inferredUserFromInstall(
  install: StoredSession,
): InstallControlPlaneUserRecord | undefined {
  if (!install.userId || !install.workspaceId) return undefined;
  return {
    userId: install.userId,
    workspaceIds: [install.workspaceId],
    createdAt: install.startedAt,
    updatedAt: install.updatedAt,
  };
}

export function createMemoryInstallControlPlaneRepository(): InstallControlPlaneRepository {
  const state: MemoryState = {
    events: new Map(),
    sessions: new Map(),
    users: new Map(),
    diagnostics: new Map(),
    evidence: new Map(),
  };

  const repository: InstallControlPlaneRepository = {
    async ingestEvent(event, options) {
      validateEventEnvelope(event);
      isoMs(options.ingestedAt, 'install event ingestedAt');
      if (options.trust === 'installer') {
        if (event.identity.state === 'canonical') {
          throw new Error('installer trust boundary cannot assert canonical identity');
        }
        if (event.producer !== 'installer') {
          throw new Error('installer trust boundary only accepts installer producer events');
        }
      }

      const existing = state.events.get(event.eventId);
      if (existing) {
        if (eventFingerprint(existing) !== eventFingerprint(event)) {
          throw new Error('install event id was reused with a different payload');
        }
        const existingInstall = projectSessionFromEvents(
          [...state.events.values()]
            .filter((stored) => stored.installId === existing.installId)
            .map((stored) => cloneEvent(stored)),
        );
        state.sessions.set(existing.installId, existingInstall);
        return { created: false, install: cloneInstall(existingInstall) };
      }

      const storedEvent: StoredEvent = {
        ...cloneEvent(event),
        ingestedAt: options.ingestedAt,
      };
      const session = projectSessionFromEvents([
        ...[...state.events.values()]
          .filter((stored) => stored.installId === event.installId)
          .map((stored) => cloneEvent(stored)),
        event,
      ]);
      if (session.userId && session.workspaceId) {
        const inferred = inferredUserFromInstall(session);
        if (inferred) {
          const current = state.users.get(inferred.userId);
          state.users.set(inferred.userId, {
            ...inferred,
            ...current,
            workspaceIds: [...new Set([...(current?.workspaceIds ?? []), ...inferred.workspaceIds])].sort(),
            updatedAt: [current?.updatedAt ?? inferred.updatedAt, inferred.updatedAt].sort().at(-1)!,
          });
        }
      }
      state.events.set(event.eventId, storedEvent);
      state.sessions.set(event.installId, session);
      return { created: true, install: cloneInstall(session) };
    },

    async upsertUser(record) {
      if (!record.userId.trim() || record.userId.startsWith('google:')) {
        throw new Error('user directory requires canonical Consuelo user id');
      }
      isoMs(record.createdAt, 'user createdAt');
      isoMs(record.updatedAt, 'user updatedAt');
      const current = state.users.get(record.userId);
      state.users.set(record.userId, {
        ...(current ?? record),
        ...record,
        workspaceIds: [...new Set([...(current?.workspaceIds ?? []), ...record.workspaceIds])].sort(),
        createdAt: [current?.createdAt, record.createdAt]
          .filter((value): value is string => Boolean(value))
          .sort()[0]!,
        updatedAt: [current?.updatedAt, record.updatedAt]
          .filter((value): value is string => Boolean(value))
          .sort()
          .at(-1)!,
      });
    },

    async recordDiagnosticBundle(record) {
      if (!isInstallId(record.installId)) throw new Error('invalid diagnostic install id');
      if (!record.bundleId.trim() || !record.objectKey.trim()) {
        throw new Error('diagnostic bundle metadata is incomplete');
      }
      if (!state.sessions.has(record.installId)) {
        throw new Error('diagnostic bundle requires an existing install session');
      }
      isoMs(record.createdAt, 'diagnostic createdAt');
      if (isoMs(record.expiresAt, 'diagnostic expiresAt') <= isoMs(record.createdAt, 'diagnostic createdAt')) {
        throw new Error('diagnostic expiry must be after creation');
      }
      state.diagnostics.set(record.bundleId, { ...record });
      const session = state.sessions.get(record.installId)!;
      session.diagnosticAvailable = true;
    },

    async getDiagnosticBundleRecord(installId, options) {
      return [...state.diagnostics.values()]
        .filter(
          (record) =>
            record.installId === installId &&
            isoMs(record.expiresAt, 'diagnostic expiresAt') > options.nowMs,
        )
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
    },

    async recordEvidence(record) {
      if (!state.sessions.has(record.installId)) {
        throw new Error('install evidence requires an existing install session');
      }
      if (!record.referenceId.trim()) throw new Error('install evidence reference is required');
      isoMs(record.createdAt, 'evidence createdAt');
      state.evidence.set(
        `${record.installId}:${record.kind}:${record.referenceId}`,
        { ...record },
      );
    },

    async getInstallDetail(installId, options) {
      const session = state.sessions.get(installId);
      if (!session) return undefined;
      const timeline = [...state.events.values()]
        .filter((event) => event.installId === installId)
        .sort(compareInstallEvents)
        .map((event) => ({ ...cloneEvent(event), ingestedAt: event.ingestedAt }));
      const diagnostic = [...state.diagnostics.values()]
        .filter(
          (record) =>
            record.installId === installId &&
            isoMs(record.expiresAt, 'diagnostic expiresAt') > options.nowMs,
        )
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
      const evidence = [...state.evidence.values()]
        .filter((record) => record.installId === installId)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      return {
        install: {
          ...cloneInstall(session),
          diagnosticAvailable: Boolean(diagnostic),
        },
        timeline,
        diagnosticBundle: diagnostic
          ? {
              available: true,
              bundleId: diagnostic.bundleId,
              outcome: diagnostic.outcome,
              createdAt: diagnostic.createdAt,
              expiresAt: diagnostic.expiresAt,
            }
          : { available: false },
        evidence: {
          sentryEventIds: evidence
            .filter((record) => record.kind === 'sentry')
            .map((record) => record.referenceId),
          cloudflareTraceIds: evidence
            .filter((record) => record.kind === 'cloudflare')
            .map((record) => record.referenceId),
        },
      };
    },

    async listInstalls(options) {
      const items = [...state.sessions.values()]
        .filter(
          (session) =>
            options.sinceMs === undefined ||
            isoMs(session.startedAt, 'install startedAt') >= options.sinceMs,
        )
        .sort(
          (a, b) =>
            b.startedAt.localeCompare(a.startedAt) ||
            b.installId.localeCompare(a.installId),
        )
        .map((session) => {
          const hasDiagnostic = [...state.diagnostics.values()].some(
            (record) =>
              record.installId === session.installId &&
              isoMs(record.expiresAt, 'diagnostic expiresAt') > options.nowMs,
          );
          return { ...cloneInstall(session), diagnosticAvailable: hasDiagnostic };
        });
      return pageFrom(items, options);
    },

    async listUsers(options) {
      const sessions = [...state.sessions.values()];
      const items = [...state.users.values()]
        .map((record): InstallDashboardUserSummary => {
          const installs = sessions.filter((install) => install.userId === record.userId);
          return {
            userId: record.userId,
            ...(record.email ? { email: record.email } : {}),
            ...(record.displayName ? { displayName: record.displayName } : {}),
            createdAt: record.createdAt,
            workspaceIds: [...record.workspaceIds],
            activationState: activationStateFor({ installs, devices: [] }),
            installCount: installs.length,
            deviceCount: 0,
          };
        })
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || a.userId.localeCompare(b.userId));
      return pageFrom(items, options);
    },

    async listErrors(options) {
      const events = [...state.events.values()].filter(
        (event) =>
          event.error &&
          (options.sinceMs === undefined ||
            isoMs(event.occurredAt, 'event occurredAt') >= options.sinceMs),
      );
      return pageFrom(errorGroupsFromEvents(events, state.sessions), options);
    },

    async prune(options) {
      const cutoff = options.nowMs - INSTALL_TELEMETRY_RETENTION_DAYS.events * DAY_MS;
      let events = 0;
      for (const [eventId, event] of state.events) {
        if (isoMs(event.occurredAt, 'event occurredAt') < cutoff) {
          state.events.delete(eventId);
          events += 1;
        }
      }
      let sessions = 0;
      for (const [installId, session] of state.sessions) {
        if (isoMs(session.startedAt, 'install startedAt') < cutoff) {
          state.sessions.delete(installId);
          sessions += 1;
        }
      }
      let diagnostics = 0;
      for (const [bundleId, bundle] of state.diagnostics) {
        if (isoMs(bundle.expiresAt, 'diagnostic expiresAt') <= options.nowMs) {
          state.diagnostics.delete(bundleId);
          diagnostics += 1;
        }
      }
      let evidence = 0;
      for (const [key, record] of state.evidence) {
        if (!state.sessions.has(record.installId)) {
          state.evidence.delete(key);
          evidence += 1;
        }
      }
      return { sessions, events, diagnostics, evidence };
    },
  };

  return repository;
}

async function allPages<T>(
  load: (cursor?: string) => Promise<InstallDashboardPage<T>>,
): Promise<T[]> {
  try {
    const items: T[] = [];
    let cursor: string | undefined;
    do {
      const page = await load(cursor);
      items.push(...page.items);
      cursor = page.nextCursor;
    } while (cursor);
    return items;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`install control-plane pagination failed: ${message}`);
  }
}

function serviceError(operation: string, error: unknown): Error {
  const message = error instanceof Error ? error.message : String(error);
  return new Error(`install control-plane ${operation} failed: ${message}`);
}

function enrichUsersWithDevices(
  users: InstallDashboardUserSummary[],
  installs: InstallDashboardInstallSummary[],
  devices: InstallDashboardDeviceSummary[],
): InstallDashboardUserSummary[] {
  return users.map((user) => {
    const userInstalls = installs.filter((install) => install.userId === user.userId);
    const userDevices = devices.filter((device) => device.userId === user.userId);
    const lastSeenAt = userDevices
      .map((device) => device.lastSeenAt)
      .filter((value): value is string => Boolean(value))
      .sort()
      .at(-1);
    return {
      ...user,
      activationState: activationStateFor({ installs: userInstalls, devices: userDevices }),
      installCount: userInstalls.length,
      deviceCount: userDevices.length,
      ...(lastSeenAt ? { lastSeenAt } : {}),
    };
  });
}

export type InstallControlPlaneService = ReturnType<typeof createInstallControlPlaneService>;

export function createInstallControlPlaneService(input: {
  repository: InstallControlPlaneRepository;
  devices?: InstallControlPlaneDeviceSource;
}) {
  const loadDevices = (nowMs: number) =>
    input.devices ? input.devices.listDevices({ nowMs }) : Promise.resolve([]);
  const loadInstalls = (nowMs: number, sinceMs?: number) =>
    allPages((cursor) =>
      input.repository.listInstalls({ nowMs, sinceMs, limit: MAX_PAGE_SIZE, cursor }),
    );
  const loadUsers = (nowMs: number) =>
    allPages((cursor) =>
      input.repository.listUsers({ nowMs, limit: MAX_PAGE_SIZE, cursor }),
    );

  return {
    async getOverview(options: {
      window: InstallDashboardWindow;
      nowMs: number;
    }): Promise<InstallDashboardOverview> {
      try {
        const sinceMs = options.nowMs - windowMs(options.window);
        const [users, installs, devices] = await Promise.all([
          loadUsers(options.nowMs),
          loadInstalls(options.nowMs, sinceMs),
          loadDevices(options.nowMs),
        ]);
        const allInstalls = await loadInstalls(options.nowMs);
        const enrichedUsers = enrichUsersWithDevices(users, allInstalls, devices);
        const activeCutoff = options.nowMs - 7 * DAY_MS;
        const activeUsers = enrichedUsers.filter((user) =>
          devices.some(
            (device) =>
              device.userId === user.userId &&
              Boolean(device.lastSeenAt) &&
              isoMs(device.lastSeenAt!, 'device lastSeenAt') >= activeCutoff,
          ),
        );
        const authorizedUsers = new Set(
          allInstalls
            .filter((install) => Boolean(install.nodeId && install.userId))
            .map((install) => install.userId!),
        );
        const completedUsers = new Set(
          allInstalls
            .filter((install) => install.status === 'completed' && install.userId)
            .map((install) => install.userId!),
        );
        const heartbeatUsers = new Set(
          devices
            .filter((device) => Boolean(device.lastSeenAt && device.userId))
            .map((device) => device.userId!),
        );
        const trendByDate = new Map<string, InstallDashboardOverview['trend'][number]>();
        const ensureDay = (date: string) => {
          let value = trendByDate.get(date);
          if (!value) {
            value = {
              date,
              registeredUsers: 0,
              installStarts: 0,
              completedInstalls: 0,
              failedInstalls: 0,
            };
            trendByDate.set(date, value);
          }
          return value;
        };
        for (const user of users) {
          if (isoMs(user.createdAt, 'user createdAt') >= sinceMs) {
            ensureDay(dayKey(user.createdAt)).registeredUsers += 1;
          }
        }
        for (const install of installs) {
          const day = ensureDay(dayKey(install.startedAt));
          day.installStarts += 1;
          if (install.status === 'completed') day.completedInstalls += 1;
          if (install.status === 'failed') day.failedInstalls += 1;
        }
        return {
          generatedAt: new Date(options.nowMs).toISOString(),
          window: options.window,
          users: {
            registered: users.filter((user) => isoMs(user.createdAt, 'user createdAt') >= sinceMs).length,
            activated: heartbeatUsers.size,
            active7d: activeUsers.length,
          },
          installs: {
            started: installs.length,
            completed: installs.filter((install) => install.status === 'completed').length,
            failed: installs.filter((install) => install.status === 'failed').length,
          },
          devices: {
            total: devices.length,
            online: devices.filter((device) => device.state === 'active').length,
          },
          activation: {
            registeredUsers: users.length,
            authorizedDevices: authorizedUsers.size,
            completedInstalls: completedUsers.size,
            firstHeartbeats: heartbeatUsers.size,
            activeUsers: activeUsers.length,
          },
          trend: [...trendByDate.values()].sort((a, b) => a.date.localeCompare(b.date)),
        };
      } catch (error: unknown) {
        throw serviceError('overview read', error);
      }
    },

    async listUsers(options: {
      nowMs: number;
      limit?: number;
      cursor?: string;
    }): Promise<InstallDashboardPage<InstallDashboardUserSummary>> {
      try {
        const [users, installs, devices] = await Promise.all([
          loadUsers(options.nowMs),
          loadInstalls(options.nowMs),
          loadDevices(options.nowMs),
        ]);
        return pageFrom(enrichUsersWithDevices(users, installs, devices), options);
      } catch (error: unknown) {
        throw serviceError('user list', error);
      }
    },

    listInstalls(options: {
      nowMs: number;
      limit?: number;
      cursor?: string;
    }) {
      return input.repository.listInstalls(options);
    },

    async listDevices(options: {
      nowMs: number;
      limit?: number;
      cursor?: string;
    }): Promise<InstallDashboardPage<InstallDashboardDeviceSummary>> {
      try {
        const devices = (await loadDevices(options.nowMs)).sort((a, b) => {
          const aSeen = a.lastSeenAt ?? '';
          const bSeen = b.lastSeenAt ?? '';
          return bSeen.localeCompare(aSeen) || a.nodeId.localeCompare(b.nodeId);
        });
        return pageFrom(devices, options);
      } catch (error: unknown) {
        throw serviceError('device list', error);
      }
    },

    async listErrors(options: {
      window: InstallDashboardWindow;
      nowMs: number;
      limit?: number;
      cursor?: string;
    }) {
      return input.repository.listErrors({
        nowMs: options.nowMs,
        sinceMs: options.nowMs - windowMs(options.window),
        limit: options.limit,
        cursor: options.cursor,
      });
    },

    async getInstallDetail(installId: InstallId, options: { nowMs: number }) {
      return input.repository.getInstallDetail(installId, options);
    },
  };
}

export function projectAuthorityWorkspaceNodeToDashboardDevice(
  node: WorkspaceNode,
  options: { nowMs: number; heartbeatTtlMs?: number },
): InstallDashboardDeviceSummary {
  const heartbeatTtlMs = Math.max(1, options.heartbeatTtlMs ?? DEFAULT_HEARTBEAT_TTL_MS);
  const revoked = (node.state ?? 'active') === 'revoked';
  const online =
    !revoked &&
    typeof node.lastSeenAt === 'number' &&
    options.nowMs - node.lastSeenAt <= heartbeatTtlMs;
  const canonicalUserId =
    node.accountId.trim() && !node.accountId.startsWith('google:')
      ? node.accountId
      : undefined;
  return {
    nodeId: node.nodeId,
    ...(canonicalUserId ? { userId: canonicalUserId } : {}),
    ...(node.workspaceId ? { workspaceId: node.workspaceId } : {}),
    ...(node.displayName || node.nodeName
      ? { displayName: node.displayName ?? node.nodeName }
      : {}),
    state: revoked ? 'revoked' : online ? 'active' : 'offline',
    ...(node.connectorStatus ? { connectorStatus: node.connectorStatus } : {}),
    ...(node.platform ? { platform: node.platform } : {}),
    ...(node.architecture ? { architecture: node.architecture } : {}),
    ...(node.channel ? { channel: node.channel } : {}),
    agents: [...(node.agents ?? [])],
    ...(typeof node.lastSeenAt === 'number'
      ? { lastSeenAt: new Date(node.lastSeenAt).toISOString() }
      : {}),
  };
}
