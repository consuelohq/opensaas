import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import type { InstallTelemetryEvent } from '../scripts/lib/install-telemetry-contract';
import {
  createCloudflareD1InstallControlPlaneRepository,
  type InstallControlPlaneD1Database,
} from '../scripts/lib/install-control-plane-d1';

const INSTALL_ID = 'ins_11111111-1111-4111-8111-111111111111' as const;
const EVENT_ID = 'evt_11111111-1111-4111-8111-111111111111' as const;
const CONTROL_PLANE_EVENT_ID = 'evt_22222222-2222-4222-8222-222222222222' as const;

function startedEvent(): InstallTelemetryEvent {
  return {
    schemaVersion: 1,
    eventId: EVENT_ID,
    installId: INSTALL_ID,
    producer: 'installer',
    name: 'install.started',
    stage: 'bootstrap',
    outcome: 'started',
    occurredAt: '2026-08-13T16:00:00.000Z',
    sequence: 1,
    identity: { state: 'anonymous' },
    context: { platform: 'darwin', architecture: 'arm64', channel: 'canary' },
  };
}

function createCapturedD1(): {
  db: InstallControlPlaneD1Database;
  statements: Array<{ sql: string; values: unknown[] }>;
} {
  const statements: Array<{ sql: string; values: unknown[] }> = [];
  const db: InstallControlPlaneD1Database = {
    prepare(sql) {
      let values: unknown[] = [];
      const statement = {
        bind(...nextValues: unknown[]) {
          values = nextValues;
          return statement;
        },
        async first<T>() {
          statements.push({ sql, values: [...values] });
          return null as T | null;
        },
        async all<T>() {
          statements.push({ sql, values: [...values] });
          return { results: [] as T[] };
        },
        async run() {
          statements.push({ sql, values: [...values] });
          return { success: true, meta: { changes: 1 } };
        },
      };
      return statement;
    },
  };
  return { db, statements };
}

describe('Cloudflare D1 install control plane', () => {
  it('looks up canonical users by normalized email and orders memberships by synchronization recency', async () => {
    const statements: Array<{ sql: string; values: unknown[] }> = [];
    const db: InstallControlPlaneD1Database = {
      prepare(sql) {
        let values: unknown[] = [];
        const statement = {
          bind(...nextValues: unknown[]) {
            values = nextValues;
            return statement;
          },
          async first<T>() {
            statements.push({ sql, values: [...values] });
            return null as T | null;
          },
          async all<T>() {
            statements.push({ sql, values: [...values] });
            if (sql.includes('FROM os_install_users')) {
              return {
                results: [
                  { user_id: 'user_123', email: 'ko@example.com' } as T,
                ],
              };
            }
            if (sql.includes('FROM os_install_user_workspaces')) {
              return {
                results: [
                  {
                    workspace_id: 'workspace_new',
                    verified_at: '2026-08-13T12:00:00.000Z',
                  } as T,
                  {
                    workspace_id: 'workspace_old',
                    verified_at: '2026-08-10T12:00:00.000Z',
                  } as T,
                ],
              };
            }
            return { results: [] as T[] };
          },
          async run() {
            statements.push({ sql, values: [...values] });
            return { success: true, meta: { changes: 1 } };
          },
        };
        return statement;
      },
    };
    const repository = createCloudflareD1InstallControlPlaneRepository(db);

    await expect(repository.findCanonicalUsersByEmail(' KO@EXAMPLE.COM ')).resolves.toEqual([
      {
        userId: 'user_123',
        email: 'ko@example.com',
        workspaceMemberships: [
          { workspaceId: 'workspace_new', verifiedAt: '2026-08-13T12:00:00.000Z' },
          { workspaceId: 'workspace_old', verifiedAt: '2026-08-10T12:00:00.000Z' },
        ],
      },
    ]);
    expect(
      statements.find(({ sql }) => sql.includes('FROM os_install_users')),
    ).toMatchObject({ values: ['ko@example.com'] });
    expect(
      statements.find(({ sql }) => sql.includes('FROM os_install_users'))?.sql,
    ).toContain('LOWER(TRIM(email)) = ?');
    expect(
      statements.find(({ sql }) => sql.includes('FROM os_install_user_workspaces'))?.sql,
    ).toContain('verified_at IS NOT NULL');
    expect(
      statements.find(({ sql }) => sql.includes('FROM os_install_user_workspaces'))?.sql,
    ).toContain('ORDER BY verified_at DESC, workspace_id ASC');
  });

  it('persists an idempotent event and its projected canonical session instead of using vendor telemetry as storage', async () => {
    const { db, statements } = createCapturedD1();
    const repository = createCloudflareD1InstallControlPlaneRepository(db);

    const result = await repository.ingestEvent(startedEvent(), {
      trust: 'installer',
      ingestedAt: '2026-08-13T16:00:01.000Z',
    });

    expect(result).toMatchObject({
      created: true,
      install: {
        installId: INSTALL_ID,
        status: 'in_progress',
        currentStage: 'bootstrap',
        platform: 'darwin',
        architecture: 'arm64',
        channel: 'canary',
      },
    });
    expect(statements.some(({ sql }) => sql.includes('INSERT OR IGNORE INTO os_install_events'))).toBe(true);
    expect(statements.some(({ sql }) => sql.includes('INSERT INTO os_install_sessions'))).toBe(true);
    expect(
      statements.some(({ sql }) =>
        sql.includes('ORDER BY occurred_at ASC, producer ASC, sequence ASC, event_id ASC'),
      ),
    ).toBe(true);
    expect(JSON.stringify(statements)).not.toContain('email');
  });

  it('repairs the session projection when an event persisted before a previous session write failed', async () => {
    const persistedEvent = startedEvent();
    const statements: Array<{ sql: string; values: unknown[] }> = [];
    const db: InstallControlPlaneD1Database = {
      prepare(sql) {
        let values: unknown[] = [];
        const statement = {
          bind(...nextValues: unknown[]) {
            values = nextValues;
            return statement;
          },
          async first<T>() {
            statements.push({ sql, values: [...values] });
            if (sql.includes('FROM os_install_events WHERE event_id')) {
              return {
                event_json: JSON.stringify(persistedEvent),
                ingested_at: '2026-08-13T16:00:01.000Z',
              } as T;
            }
            if (sql.includes('FROM os_install_sessions WHERE install_id')) {
              return null as T | null;
            }
            return null as T | null;
          },
          async all<T>() {
            statements.push({ sql, values: [...values] });
            if (sql.includes('FROM os_install_events WHERE install_id')) {
              return {
                results: [
                  {
                    event_json: JSON.stringify(persistedEvent),
                    ingested_at: '2026-08-13T16:00:01.000Z',
                  } as T,
                ],
              };
            }
            return { results: [] as T[] };
          },
          async run() {
            statements.push({ sql, values: [...values] });
            return { success: true, meta: { changes: 1 } };
          },
        };
        return statement;
      },
    };
    const repository = createCloudflareD1InstallControlPlaneRepository(db);

    await expect(
      repository.ingestEvent(persistedEvent, {
        trust: 'installer',
        ingestedAt: '2026-08-13T16:01:00.000Z',
      }),
    ).resolves.toMatchObject({
      created: false,
      install: {
        installId: INSTALL_ID,
        status: 'in_progress',
        currentStage: 'bootstrap',
      },
    });
    expect(
      statements.some(({ sql }) => sql.includes('INSERT INTO os_install_sessions')),
    ).toBe(true);
  });

  it('replays anonymous trusted-producer events without misclassifying them as installer-trust input', async () => {
    const persistedTrustedEvent: InstallTelemetryEvent = {
      schemaVersion: 1,
      eventId: CONTROL_PLANE_EVENT_ID,
      installId: INSTALL_ID,
      producer: 'control_plane',
      name: 'install.stage.completed',
      stage: 'dependencies',
      outcome: 'succeeded',
      occurredAt: '2026-08-13T15:59:00.000Z',
      sequence: 99,
      identity: { state: 'anonymous' },
    };
    const db: InstallControlPlaneD1Database = {
      prepare(sql) {
        const statement = {
          bind() {
            return statement;
          },
          async first<T>() {
            return null as T | null;
          },
          async all<T>() {
            if (sql.includes('FROM os_install_events WHERE install_id')) {
              return {
                results: [
                  {
                    event_json: JSON.stringify(persistedTrustedEvent),
                    ingested_at: '2026-08-13T15:59:01.000Z',
                  } as T,
                ],
              };
            }
            return { results: [] as T[] };
          },
          async run() {
            return { success: true, meta: { changes: 1 } };
          },
        };
        return statement;
      },
    };
    const repository = createCloudflareD1InstallControlPlaneRepository(db);

    await expect(
      repository.ingestEvent(startedEvent(), {
        trust: 'installer',
        ingestedAt: '2026-08-13T16:00:01.000Z',
      }),
    ).resolves.toMatchObject({
      created: true,
      install: {
        installId: INSTALL_ID,
        currentStage: 'bootstrap',
      },
    });
  });

  it('ships a migration for sessions, idempotent events, private user directory, diagnostic metadata, evidence, and retention indexes', () => {
    const migration = readFileSync(
      new URL('../cloudflare/workspace-edge/migrations/0004_install_control_plane.sql', import.meta.url),
      'utf8',
    );
    for (const table of [
      'os_install_sessions',
      'os_install_events',
      'os_install_users',
      'os_install_user_workspaces',
      'os_install_diagnostic_bundles',
      'os_install_evidence',
    ]) {
      expect(migration).toContain(`CREATE TABLE IF NOT EXISTS ${table}`);
    }
    expect(migration).toContain('CREATE INDEX IF NOT EXISTS idx_os_install_events_occurred_at');
    expect(migration).toContain('CREATE INDEX IF NOT EXISTS idx_os_install_events_install_timeline');
    expect(migration).toContain('CREATE INDEX IF NOT EXISTS idx_os_install_sessions_started_at');
    expect(migration).toContain('CREATE INDEX IF NOT EXISTS idx_os_install_diagnostic_expires_at');
  });

  it('ships a follow-up migration that separates signed workspace verification from projection history', () => {
    const migration = readFileSync(
      new URL(
        '../cloudflare/workspace-edge/migrations/0005_install_user_workspace_verification.sql',
        import.meta.url,
      ),
      'utf8',
    );
    expect(migration).toContain(
      'ALTER TABLE os_install_user_workspaces ADD COLUMN verified_at TEXT',
    );
    expect(migration).toContain(
      'CREATE INDEX IF NOT EXISTS idx_os_install_user_workspaces_verified',
    );
    expect(migration).not.toMatch(/UPDATE\s+os_install_user_workspaces\s+SET\s+verified_at/i);
  });
});
