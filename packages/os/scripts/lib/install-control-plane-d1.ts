import {
  INSTALL_TELEMETRY_RETENTION_DAYS,
  type InstallDashboardErrorGroup,
  type InstallDashboardInstallDetail,
  type InstallDashboardInstallSummary,
  type InstallDashboardPage,
  type InstallDashboardUserSummary,
  type InstallId,
  type InstallTelemetryEvent,
} from './install-telemetry-contract';
import {
  createMemoryInstallControlPlaneRepository,
  type InstallControlPlaneDiagnosticRecord,
  type InstallControlPlaneEvidenceRecord,
  type InstallControlPlaneIngestOptions,
  type InstallControlPlanePruneResult,
  type InstallControlPlaneRepository,
  type InstallControlPlaneUserRecord,
} from './install-control-plane';

export type InstallControlPlaneD1RunResult = {
  success?: boolean;
  meta?: { changes?: number };
};

export type InstallControlPlaneD1PreparedStatement = {
  bind: (...values: unknown[]) => InstallControlPlaneD1PreparedStatement;
  first: <T = unknown>(columnName?: string) => Promise<T | null>;
  all: <T = unknown>() => Promise<{ results?: T[] }>;
  run: () => Promise<InstallControlPlaneD1RunResult | unknown>;
};

export type InstallControlPlaneD1Database = {
  prepare: (sql: string) => InstallControlPlaneD1PreparedStatement;
};

type InstallSessionRow = {
  install_id: string;
  user_id?: string | null;
  workspace_id?: string | null;
  node_id?: string | null;
  status: InstallDashboardInstallSummary['status'];
  current_stage: InstallDashboardInstallSummary['currentStage'];
  started_at: string;
  updated_at: string;
  completed_at?: string | null;
  duration_ms?: number | null;
  platform?: string | null;
  architecture?: string | null;
  channel?: string | null;
  release?: string | null;
  last_error_code?: InstallDashboardInstallSummary['lastErrorCode'] | null;
  diagnostic_available?: number | boolean | null;
  diagnostic_current?: number | boolean | null;
};

type InstallEventRow = {
  event_id?: string;
  event_json: string;
  ingested_at: string;
};

type InstallUserRow = {
  user_id: string;
  email?: string | null;
  display_name?: string | null;
  created_at: string;
  updated_at: string;
};

type InstallWorkspaceRow = { workspace_id: string };
type InstallDiagnosticRow = {
  bundle_id: string;
  install_id: string;
  object_key: string;
  outcome: 'failed' | 'successful';
  created_at: string;
  expires_at: string;
};
type InstallEvidenceRow = {
  install_id: string;
  kind: 'sentry' | 'cloudflare';
  reference_id: string;
  created_at: string;
};

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_PAGE_SIZE = 100;
const MAX_PAGE_SIZE = 500;

function safeLimit(limit?: number): number {
  if (!Number.isFinite(limit)) return DEFAULT_PAGE_SIZE;
  return Math.min(MAX_PAGE_SIZE, Math.max(1, Math.floor(limit ?? DEFAULT_PAGE_SIZE)));
}

function offsetFromCursor(cursor?: string): number {
  if (!cursor) return 0;
  const parsed = Number.parseInt(cursor, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function pageFromRows<T>(rows: T[], limit: number, offset: number): InstallDashboardPage<T> {
  const items = rows.slice(0, limit);
  return {
    items,
    ...(rows.length > limit ? { nextCursor: String(offset + limit) } : {}),
  };
}

function changes(result: unknown): number | undefined {
  if (!result || typeof result !== 'object') return undefined;
  const meta = (result as { meta?: unknown }).meta;
  if (!meta || typeof meta !== 'object') return undefined;
  const value = (meta as { changes?: unknown }).changes;
  return typeof value === 'number' ? value : undefined;
}

function d1Error(operation: string, error: unknown): Error {
  const message = error instanceof Error ? error.message : String(error);
  return new Error(`install control-plane D1 ${operation} failed: ${message}`);
}

function installSummaryFromRow(row: InstallSessionRow): InstallDashboardInstallSummary {
  return {
    installId: row.install_id as InstallId,
    ...(row.user_id ? { userId: row.user_id } : {}),
    ...(row.workspace_id ? { workspaceId: row.workspace_id } : {}),
    ...(row.node_id ? { nodeId: row.node_id } : {}),
    status: row.status,
    currentStage: row.current_stage,
    startedAt: row.started_at,
    updatedAt: row.updated_at,
    ...(row.completed_at ? { completedAt: row.completed_at } : {}),
    ...(typeof row.duration_ms === 'number' ? { durationMs: row.duration_ms } : {}),
    ...(row.platform ? { platform: row.platform } : {}),
    ...(row.architecture ? { architecture: row.architecture } : {}),
    ...(row.channel ? { channel: row.channel } : {}),
    ...(row.release ? { release: row.release } : {}),
    ...(row.last_error_code ? { lastErrorCode: row.last_error_code } : {}),
    diagnosticAvailable: Boolean(row.diagnostic_current ?? row.diagnostic_available),
  };
}

function eventFromRow(row: InstallEventRow): InstallTelemetryEvent {
  const event = JSON.parse(row.event_json) as InstallTelemetryEvent;
  return event;
}

async function rows<T>(
  db: InstallControlPlaneD1Database,
  sql: string,
  values: unknown[] = [],
): Promise<T[]> {
  try {
    const result = await db.prepare(sql).bind(...values).all<T>();
    return result.results ?? [];
  } catch (error: unknown) {
    throw d1Error('query', error);
  }
}

async function first<T>(
  db: InstallControlPlaneD1Database,
  sql: string,
  values: unknown[] = [],
): Promise<T | null> {
  try {
    return await db.prepare(sql).bind(...values).first<T>();
  } catch (error: unknown) {
    throw d1Error('single-row query', error);
  }
}

async function replayInstall(
  db: InstallControlPlaneD1Database,
  installId: InstallId,
): Promise<ReturnType<typeof createMemoryInstallControlPlaneRepository>> {
  try {
    const memory = createMemoryInstallControlPlaneRepository();
    const existing = await rows<InstallEventRow>(
      db,
      'SELECT event_json, ingested_at FROM os_install_events WHERE install_id = ? ORDER BY occurred_at ASC, producer ASC, sequence ASC, event_id ASC',
      [installId],
    );
    for (const row of existing) {
      const event = eventFromRow(row);
      await memory.ingestEvent(event, {
        trust:
          event.producer === 'installer' && event.identity.state === 'anonymous'
            ? 'installer'
            : 'trusted',
        ingestedAt: row.ingested_at,
      });
    }
    return memory;
  } catch (error: unknown) {
    throw d1Error('event replay', error);
  }
}

async function projectedInstallFromMemory(
  memory: ReturnType<typeof createMemoryInstallControlPlaneRepository>,
  installId: InstallId,
  nowMs: number,
): Promise<InstallDashboardInstallSummary> {
  try {
    const detail = await memory.getInstallDetail(installId, { nowMs });
    if (!detail) throw new Error('install session projection is missing');
    return detail.install;
  } catch (error: unknown) {
    throw d1Error('session projection', error);
  }
}

async function repairSessionFromPersistedEvents(
  db: InstallControlPlaneD1Database,
  repository: InstallControlPlaneRepository,
  installId: InstallId,
  nowMs: number,
): Promise<InstallDashboardInstallSummary> {
  try {
    const memory = await replayInstall(db, installId);
    const install = await projectedInstallFromMemory(memory, installId, nowMs);
    await writeSession(db, install);
    await upsertCanonicalUserFromInstall(repository, install);
    return install;
  } catch (error: unknown) {
    throw d1Error('session repair', error);
  }
}

async function writeSession(
  db: InstallControlPlaneD1Database,
  install: InstallDashboardInstallSummary,
): Promise<void> {
  try {
    await db
      .prepare(
        [
          'INSERT INTO os_install_sessions',
          '(install_id, user_id, workspace_id, node_id, status, current_stage, started_at, updated_at, completed_at, duration_ms, platform, architecture, channel, release, last_error_code, diagnostic_available)',
          'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          'ON CONFLICT(install_id) DO UPDATE SET',
          'user_id = excluded.user_id, workspace_id = excluded.workspace_id, node_id = excluded.node_id,',
          'status = excluded.status, current_stage = excluded.current_stage, started_at = excluded.started_at, updated_at = excluded.updated_at,',
          'completed_at = excluded.completed_at, duration_ms = excluded.duration_ms, platform = excluded.platform, architecture = excluded.architecture,',
          'channel = excluded.channel, release = excluded.release, last_error_code = excluded.last_error_code,',
          'diagnostic_available = MAX(os_install_sessions.diagnostic_available, excluded.diagnostic_available)',
        ].join(' '),
      )
      .bind(
        install.installId,
        install.userId ?? null,
        install.workspaceId ?? null,
        install.nodeId ?? null,
        install.status,
        install.currentStage,
        install.startedAt,
        install.updatedAt,
        install.completedAt ?? null,
        install.durationMs ?? null,
        install.platform ?? null,
        install.architecture ?? null,
        install.channel ?? null,
        install.release ?? null,
        install.lastErrorCode ?? null,
        install.diagnosticAvailable ? 1 : 0,
      )
      .run();
  } catch (error: unknown) {
    throw d1Error('session write', error);
  }
}

async function upsertCanonicalUserFromInstall(
  repository: InstallControlPlaneRepository,
  install: InstallDashboardInstallSummary,
): Promise<void> {
  try {
    if (!install.userId || !install.workspaceId) return;
    await repository.upsertUser({
      userId: install.userId,
      workspaceIds: [install.workspaceId],
      createdAt: install.startedAt,
      updatedAt: install.updatedAt,
    });
  } catch (error: unknown) {
    throw d1Error('canonical user projection', error);
  }
}

async function listAllUserInstalls(
  db: InstallControlPlaneD1Database,
  userId: string,
  nowMs: number,
): Promise<InstallDashboardInstallSummary[]> {
  try {
    const installRows = await rows<InstallSessionRow>(
      db,
      [
        'SELECT s.*, EXISTS(',
        'SELECT 1 FROM os_install_diagnostic_bundles d WHERE d.install_id = s.install_id AND d.expires_at > ?',
        ') AS diagnostic_current FROM os_install_sessions s WHERE s.user_id = ? ORDER BY s.started_at DESC',
      ].join(' '),
      [new Date(nowMs).toISOString(), userId],
    );
    return installRows.map(installSummaryFromRow);
  } catch (error: unknown) {
    throw d1Error('user install list', error);
  }
}

function userActivation(installs: InstallDashboardInstallSummary[]): InstallDashboardUserSummary['activationState'] {
  if (installs.some((install) => install.status === 'completed')) return 'installed';
  if (installs.some((install) => Boolean(install.nodeId))) return 'authorized';
  return 'registered';
}

export function createCloudflareD1InstallControlPlaneRepository(
  db: InstallControlPlaneD1Database,
): InstallControlPlaneRepository {
  const repository: InstallControlPlaneRepository = {
    async ingestEvent(event: InstallTelemetryEvent, options: InstallControlPlaneIngestOptions) {
      try {
        const existingRow = await first<InstallEventRow>(
          db,
          'SELECT event_json, ingested_at FROM os_install_events WHERE event_id = ? LIMIT 1',
          [event.eventId],
        );
        if (existingRow) {
          const existingEvent = eventFromRow(existingRow);
          if (JSON.stringify(existingEvent) !== JSON.stringify(event)) {
            throw new Error('install event id was reused with a different payload');
          }
          const install = await repairSessionFromPersistedEvents(
            db,
            repository,
            event.installId,
            Date.parse(options.ingestedAt),
          );
          return { created: false, install };
        }

        const memory = await replayInstall(db, event.installId);
        await memory.ingestEvent(event, options);
        const inserted = await db
          .prepare(
            [
              'INSERT OR IGNORE INTO os_install_events',
              '(event_id, install_id, schema_version, producer, name, stage, outcome, occurred_at, sequence, identity_state, user_id, workspace_id, node_id, context_json, error_code, error_impact, event_json, ingested_at)',
              'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            ].join(' '),
          )
          .bind(
            event.eventId,
            event.installId,
            event.schemaVersion,
            event.producer,
            event.name,
            event.stage,
            event.outcome,
            event.occurredAt,
            event.sequence,
            event.identity.state,
            event.identity.state === 'canonical' ? event.identity.userId : null,
            event.identity.state === 'canonical' ? event.identity.workspaceId : null,
            event.identity.nodeId ?? null,
            event.context ? JSON.stringify(event.context) : null,
            event.error?.code ?? null,
            event.error?.impact ?? null,
            JSON.stringify(event),
            options.ingestedAt,
          )
          .run();
        if (changes(inserted) === 0) {
          const raced = await first<InstallEventRow>(
            db,
            'SELECT event_json, ingested_at FROM os_install_events WHERE event_id = ? LIMIT 1',
            [event.eventId],
          );
          if (!raced || JSON.stringify(eventFromRow(raced)) !== JSON.stringify(event)) {
            throw new Error('install event id collision detected');
          }
          const install = await repairSessionFromPersistedEvents(
            db,
            repository,
            event.installId,
            Date.parse(options.ingestedAt),
          );
          return { created: false, install };
        }

        const persistedInstall = await projectedInstallFromMemory(
          memory,
          event.installId,
          Date.parse(options.ingestedAt),
        );
        await writeSession(db, persistedInstall);
        await upsertCanonicalUserFromInstall(repository, persistedInstall);
        return { created: true, install: persistedInstall };
      } catch (error: unknown) {
        throw d1Error('event ingest', error);
      }
    },

    async upsertUser(record: InstallControlPlaneUserRecord) {
      try {
        if (!record.userId.trim() || record.userId.startsWith('google:')) {
          throw new Error('user directory requires canonical Consuelo user id');
        }
        await db
          .prepare(
            [
              'INSERT INTO os_install_users (user_id, email, display_name, created_at, updated_at)',
              'VALUES (?, ?, ?, ?, ?)',
              'ON CONFLICT(user_id) DO UPDATE SET',
              'email = COALESCE(excluded.email, os_install_users.email),',
              'display_name = COALESCE(excluded.display_name, os_install_users.display_name),',
              'created_at = MIN(os_install_users.created_at, excluded.created_at),',
              'updated_at = MAX(os_install_users.updated_at, excluded.updated_at)',
            ].join(' '),
          )
          .bind(
            record.userId,
            record.email ?? null,
            record.displayName ?? null,
            record.createdAt,
            record.updatedAt,
          )
          .run();
        for (const workspaceId of [...new Set(record.workspaceIds)].filter(Boolean)) {
          await db
            .prepare(
              [
                'INSERT INTO os_install_user_workspaces (user_id, workspace_id, created_at, updated_at)',
                'VALUES (?, ?, ?, ?)',
                'ON CONFLICT(user_id, workspace_id) DO UPDATE SET updated_at = MAX(os_install_user_workspaces.updated_at, excluded.updated_at)',
              ].join(' '),
            )
            .bind(record.userId, workspaceId, record.createdAt, record.updatedAt)
            .run();
        }
      } catch (error: unknown) {
        throw d1Error('user upsert', error);
      }
    },

    async recordDiagnosticBundle(record: InstallControlPlaneDiagnosticRecord) {
      try {
        const session = await first<InstallSessionRow>(
          db,
          'SELECT * FROM os_install_sessions WHERE install_id = ? LIMIT 1',
          [record.installId],
        );
        if (!session) throw new Error('diagnostic bundle requires an existing install session');
        await db
          .prepare(
            [
              'INSERT INTO os_install_diagnostic_bundles',
              '(bundle_id, install_id, object_key, outcome, created_at, expires_at)',
              'VALUES (?, ?, ?, ?, ?, ?)',
              'ON CONFLICT(bundle_id) DO UPDATE SET install_id = excluded.install_id, object_key = excluded.object_key, outcome = excluded.outcome, created_at = excluded.created_at, expires_at = excluded.expires_at',
            ].join(' '),
          )
          .bind(
            record.bundleId,
            record.installId,
            record.objectKey,
            record.outcome,
            record.createdAt,
            record.expiresAt,
          )
          .run();
        await db
          .prepare('UPDATE os_install_sessions SET diagnostic_available = 1 WHERE install_id = ?')
          .bind(record.installId)
          .run();
      } catch (error: unknown) {
        throw d1Error('diagnostic metadata write', error);
      }
    },

    async getDiagnosticBundleRecord(installId, options) {
      try {
        const diagnostic = await first<InstallDiagnosticRow>(
          db,
          'SELECT bundle_id, install_id, object_key, outcome, created_at, expires_at FROM os_install_diagnostic_bundles WHERE install_id = ? AND expires_at > ? ORDER BY created_at DESC LIMIT 1',
          [installId, new Date(options.nowMs).toISOString()],
        );
        return diagnostic
          ? {
              bundleId: diagnostic.bundle_id,
              installId: diagnostic.install_id as InstallId,
              objectKey: diagnostic.object_key,
              outcome: diagnostic.outcome,
              createdAt: diagnostic.created_at,
              expiresAt: diagnostic.expires_at,
            }
          : undefined;
      } catch (error: unknown) {
        throw d1Error('diagnostic metadata read', error);
      }
    },

    async recordEvidence(record: InstallControlPlaneEvidenceRecord) {
      try {
        const session = await first<InstallSessionRow>(
          db,
          'SELECT * FROM os_install_sessions WHERE install_id = ? LIMIT 1',
          [record.installId],
        );
        if (!session) throw new Error('install evidence requires an existing install session');
        await db
          .prepare(
            'INSERT OR IGNORE INTO os_install_evidence (install_id, kind, reference_id, created_at) VALUES (?, ?, ?, ?)',
          )
          .bind(record.installId, record.kind, record.referenceId, record.createdAt)
          .run();
      } catch (error: unknown) {
        throw d1Error('evidence write', error);
      }
    },

    async getInstallDetail(installId: InstallId, options: { nowMs: number }): Promise<InstallDashboardInstallDetail | undefined> {
      try {
        const sessionRow = await first<InstallSessionRow>(
          db,
          [
            'SELECT s.*, EXISTS(',
            'SELECT 1 FROM os_install_diagnostic_bundles d WHERE d.install_id = s.install_id AND d.expires_at > ?',
            ') AS diagnostic_current FROM os_install_sessions s WHERE s.install_id = ? LIMIT 1',
          ].join(' '),
          [new Date(options.nowMs).toISOString(), installId],
        );
        if (!sessionRow) return undefined;
        const timelineRows = await rows<InstallEventRow>(
          db,
          'SELECT event_json, ingested_at FROM os_install_events WHERE install_id = ? ORDER BY occurred_at ASC, producer ASC, sequence ASC, event_id ASC',
          [installId],
        );
        const diagnostic = await first<InstallDiagnosticRow>(
          db,
          'SELECT bundle_id, install_id, object_key, outcome, created_at, expires_at FROM os_install_diagnostic_bundles WHERE install_id = ? AND expires_at > ? ORDER BY created_at DESC LIMIT 1',
          [installId, new Date(options.nowMs).toISOString()],
        );
        const evidence = await rows<InstallEvidenceRow>(
          db,
          'SELECT install_id, kind, reference_id, created_at FROM os_install_evidence WHERE install_id = ? ORDER BY created_at ASC',
          [installId],
        );
        return {
          install: installSummaryFromRow(sessionRow),
          timeline: timelineRows.map((row) => ({ ...eventFromRow(row), ingestedAt: row.ingested_at })),
          diagnosticBundle: diagnostic
            ? {
                available: true,
                bundleId: diagnostic.bundle_id,
                outcome: diagnostic.outcome,
                createdAt: diagnostic.created_at,
                expiresAt: diagnostic.expires_at,
              }
            : { available: false },
          evidence: {
            sentryEventIds: evidence
              .filter((item) => item.kind === 'sentry')
              .map((item) => item.reference_id),
            cloudflareTraceIds: evidence
              .filter((item) => item.kind === 'cloudflare')
              .map((item) => item.reference_id),
          },
        };
      } catch (error: unknown) {
        throw d1Error('install detail read', error);
      }
    },

    async listInstalls(options) {
      try {
        const limit = safeLimit(options.limit);
        const offset = offsetFromCursor(options.cursor);
        const nowIso = new Date(options.nowMs).toISOString();
        const where = options.sinceMs === undefined ? '' : 'WHERE s.started_at >= ?';
        const values = options.sinceMs === undefined
          ? [nowIso, limit + 1, offset]
          : [nowIso, new Date(options.sinceMs).toISOString(), limit + 1, offset];
        const installRows = await rows<InstallSessionRow>(
          db,
          [
            'SELECT s.*, EXISTS(',
            'SELECT 1 FROM os_install_diagnostic_bundles d WHERE d.install_id = s.install_id AND d.expires_at > ?',
            `) AS diagnostic_current FROM os_install_sessions s ${where}`,
            'ORDER BY s.started_at DESC, s.install_id DESC LIMIT ? OFFSET ?',
          ].join(' '),
          values,
        );
        return pageFromRows(installRows.map(installSummaryFromRow), limit, offset);
      } catch (error: unknown) {
        throw d1Error('install list', error);
      }
    },

    async listUsers(options) {
      try {
        const limit = safeLimit(options.limit);
        const offset = offsetFromCursor(options.cursor);
        const userRows = await rows<InstallUserRow>(
          db,
          'SELECT user_id, email, display_name, created_at, updated_at FROM os_install_users ORDER BY created_at DESC, user_id ASC LIMIT ? OFFSET ?',
          [limit + 1, offset],
        );
        const items: InstallDashboardUserSummary[] = [];
        for (const user of userRows.slice(0, limit)) {
          const [workspaceRows, installs] = await Promise.all([
            rows<InstallWorkspaceRow>(
              db,
              'SELECT workspace_id FROM os_install_user_workspaces WHERE user_id = ? ORDER BY workspace_id ASC',
              [user.user_id],
            ),
            listAllUserInstalls(db, user.user_id, options.nowMs),
          ]);
          items.push({
            userId: user.user_id,
            ...(user.email ? { email: user.email } : {}),
            ...(user.display_name ? { displayName: user.display_name } : {}),
            createdAt: user.created_at,
            workspaceIds: workspaceRows.map((row) => row.workspace_id),
            activationState: userActivation(installs),
            installCount: installs.length,
            deviceCount: 0,
          });
        }
        return {
          items,
          ...(userRows.length > limit ? { nextCursor: String(offset + limit) } : {}),
        };
      } catch (error: unknown) {
        throw d1Error('user list', error);
      }
    },

    async listErrors(options) {
      try {
        const where = options.sinceMs === undefined
          ? 'WHERE error_code IS NOT NULL'
          : 'WHERE error_code IS NOT NULL AND occurred_at >= ?';
        const values = options.sinceMs === undefined
          ? []
          : [new Date(options.sinceMs).toISOString()];
        const eventRows = await rows<InstallEventRow>(
          db,
          `SELECT event_json, ingested_at FROM os_install_events ${where} ORDER BY occurred_at DESC LIMIT 10000`,
          values,
        );
        const events = eventRows.map((row) => ({ ...eventFromRow(row), ingestedAt: row.ingested_at }));
        const installIds = [...new Set(events.map((event) => event.installId))];
        const sessions = new Map<InstallId, InstallDashboardInstallSummary>();
        for (const installId of installIds) {
          const row = await first<InstallSessionRow>(
            db,
            'SELECT * FROM os_install_sessions WHERE install_id = ? LIMIT 1',
            [installId],
          );
          if (row) sessions.set(installId, installSummaryFromRow(row));
        }
        const groups = new Map<string, {
          errorCode: InstallDashboardErrorGroup['errorCode'];
          stage: InstallDashboardErrorGroup['stage'];
          impact: InstallDashboardErrorGroup['impact'];
          items: typeof events;
        }>();
        for (const event of events) {
          if (!event.error) continue;
          const key = `${event.error.code}:${event.stage}:${event.error.impact}`;
          const group = groups.get(key) ?? {
            errorCode: event.error.code,
            stage: event.stage,
            impact: event.error.impact,
            items: [],
          };
          group.items.push(event);
          groups.set(key, group);
        }
        const output: InstallDashboardErrorGroup[] = [...groups.values()].map((group) => {
          const affectedInstalls = new Set(group.items.map((item) => item.installId));
          const affectedUsers = new Set<string>();
          const platformBreakdown: Record<string, number> = {};
          const channelBreakdown: Record<string, number> = {};
          for (const installId of affectedInstalls) {
            const session = sessions.get(installId);
            if (session?.userId) affectedUsers.add(session.userId);
            if (session?.platform) {
              platformBreakdown[session.platform] = (platformBreakdown[session.platform] ?? 0) + 1;
            }
            if (session?.channel) {
              channelBreakdown[session.channel] = (channelBreakdown[session.channel] ?? 0) + 1;
            }
          }
          return {
            errorCode: group.errorCode,
            stage: group.stage,
            impact: group.impact,
            count: group.items.length,
            affectedInstalls: affectedInstalls.size,
            affectedUsers: affectedUsers.size,
            latestAt: group.items.map((item) => item.occurredAt).sort().at(-1)!,
            platformBreakdown,
            channelBreakdown,
          };
        });
        output.sort((a, b) => b.count - a.count || b.latestAt.localeCompare(a.latestAt));
        const limit = safeLimit(options.limit);
        const offset = offsetFromCursor(options.cursor);
        return pageFromRows(output.slice(offset), limit, offset);
      } catch (error: unknown) {
        throw d1Error('error aggregate list', error);
      }
    },

    async prune(options): Promise<InstallControlPlanePruneResult> {
      try {
        const cutoff = new Date(
          options.nowMs - INSTALL_TELEMETRY_RETENTION_DAYS.events * DAY_MS,
        ).toISOString();
        const nowIso = new Date(options.nowMs).toISOString();
        const evidenceResult = await db
          .prepare(
            'DELETE FROM os_install_evidence WHERE install_id IN (SELECT install_id FROM os_install_sessions WHERE started_at < ?)',
          )
          .bind(cutoff)
          .run();
        const diagnosticResult = await db
          .prepare('DELETE FROM os_install_diagnostic_bundles WHERE expires_at <= ?')
          .bind(nowIso)
          .run();
        const eventResult = await db
          .prepare('DELETE FROM os_install_events WHERE occurred_at < ?')
          .bind(cutoff)
          .run();
        const sessionResult = await db
          .prepare('DELETE FROM os_install_sessions WHERE started_at < ?')
          .bind(cutoff)
          .run();
        return {
          sessions: changes(sessionResult) ?? 0,
          events: changes(eventResult) ?? 0,
          diagnostics: changes(diagnosticResult) ?? 0,
          evidence: changes(evidenceResult) ?? 0,
        };
      } catch (error: unknown) {
        throw d1Error('retention prune', error);
      }
    },
  };

  return repository;
}
