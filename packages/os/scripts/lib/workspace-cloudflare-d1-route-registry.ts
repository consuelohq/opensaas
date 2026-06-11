export type WorkspaceRouteD1RouteTarget =
  | {
      kind: 'service-upstream';
      service: 'dialer' | 'app' | 'sites' | 'twenty';
      upstreamUrl: string;
    }
  | {
      kind: 'os-connector';
      connectorId: string;
      connectorStatus: 'connected' | 'disconnected';
      tunnelOriginUrl: string;
    };

export type WorkspaceRouteD1Route = {
  surface: 'os' | 'dialer' | 'app' | 'sites' | 'twenty';
  pathPrefix: string;
  auth: 'required';
  status: 'active' | 'disabled';
  target: WorkspaceRouteD1RouteTarget;
};

export type WorkspaceRouteD1RecordInput = {
  workspaceId: string;
  workspaceSlug: string;
  hostname: string;
  baseDomain: string;
  provider: 'cloudflare';
  owner: 'consuelo-os-cloud';
  status: 'active' | 'revoked';
  routes: WorkspaceRouteD1Route[];
};

export type WorkspaceRouteD1ResolutionInput = {
  host: string;
  path: string;
};

export type WorkspaceRouteD1RevocationInput = {
  hostname: string;
  reason: string;
};

export type WorkspaceRouteD1PreparedStatement = {
  bind: (...values: unknown[]) => WorkspaceRouteD1PreparedStatement;
  first: <T = unknown>(columnName?: string) => Promise<T | null>;
  run: () => Promise<unknown>;
};

export type WorkspaceRouteD1Database = {
  dumpHostnameRow?: (hostname: string) => Promise<unknown>;
  exec?: (sql: string) => Promise<unknown>;
  prepare?: (sql: string) => WorkspaceRouteD1PreparedStatement;
};

export type WorkspaceRouteD1Resolution =
  | {
      allowed: true;
      workspaceId: string;
      hostname: string;
      route: string;
      surface: WorkspaceRouteD1Route['surface'];
      auth: 'required';
      auditEvent: 'workspace.hostname.route.allowed';
      target: WorkspaceRouteD1RouteTarget;
    }
  | {
      allowed: false;
      status: 404 | 503;
      errorCode: string;
      auditEvent: 'workspace.hostname.route.denied';
    };

type StoredWorkspaceRouteD1Record = WorkspaceRouteD1RecordInput & {
  updatedAt: string;
  revokedAt?: string;
  revocationReason?: string;
};

type WorkspaceRouteD1State = {
  migrated: boolean;
  hostnameRows: Map<string, StoredWorkspaceRouteD1Record>;
};

const states = new WeakMap<WorkspaceRouteD1Database, WorkspaceRouteD1State>();

const normalizeHostname = (hostname: string): string => hostname.trim().toLowerCase();

const normalizeBaseDomain = (baseDomain: string): string =>
  baseDomain.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/$/, '');

const cloneTarget = (
  target: WorkspaceRouteD1RouteTarget,
): WorkspaceRouteD1RouteTarget => ({ ...target });

const cloneRoute = (route: WorkspaceRouteD1Route): WorkspaceRouteD1Route => ({
  ...route,
  target: cloneTarget(route.target),
});

const cloneRecord = (
  record: StoredWorkspaceRouteD1Record,
): StoredWorkspaceRouteD1Record => ({
  ...record,
  routes: record.routes.map(cloneRoute),
});

type WorkspaceRouteD1RecordRow = { record_json?: unknown };

const createStoredRecord = (
  input: WorkspaceRouteD1RecordInput,
): StoredWorkspaceRouteD1Record => ({
  ...input,
  hostname: normalizeHostname(input.hostname),
  workspaceSlug: input.workspaceSlug.trim().toLowerCase(),
  baseDomain: normalizeBaseDomain(input.baseDomain),
  routes: input.routes.map(cloneRoute),
  updatedAt: new Date().toISOString(),
});

const getPreparedD1 = (db: WorkspaceRouteD1Database): WorkspaceRouteD1Database & {
  prepare: (sql: string) => WorkspaceRouteD1PreparedStatement;
} => {
  if (typeof db.prepare !== 'function') {
    throw new Error('workspace route D1 database must expose prepare');
  }

  return db as WorkspaceRouteD1Database & {
    prepare: (sql: string) => WorkspaceRouteD1PreparedStatement;
  };
};

const readCloudflareD1Record = (input: {
  db: WorkspaceRouteD1Database;
  hostname: string;
}): Promise<StoredWorkspaceRouteD1Record | null> =>
  getPreparedD1(input.db)
    .prepare('SELECT record_json FROM workspace_route_registry WHERE hostname = ? LIMIT 1')
    .bind(normalizeHostname(input.hostname))
    .first<WorkspaceRouteD1RecordRow>()
    .then((row) => {
      if (!row || typeof row.record_json !== 'string') {
        return null;
      }

      return cloneRecord(JSON.parse(row.record_json) as StoredWorkspaceRouteD1Record);
    });

const writeCloudflareD1Record = (input: {
  db: WorkspaceRouteD1Database;
  record: StoredWorkspaceRouteD1Record;
}): Promise<unknown> =>
  getPreparedD1(input.db)
    .prepare('INSERT OR REPLACE INTO workspace_route_registry (hostname, record_json) VALUES (?, ?)')
    .bind(input.record.hostname, JSON.stringify(input.record))
    .run();

const getState = (db: WorkspaceRouteD1Database): WorkspaceRouteD1State => {
  const state = states.get(db);

  if (!state) {
    throw new Error(
      'workspace route D1 database was not created by createInMemoryWorkspaceRouteD1',
    );
  }

  return state;
};

const ensureMigrated = (db: WorkspaceRouteD1Database): WorkspaceRouteD1State => {
  const state = getState(db);

  if (!state.migrated) {
    throw new Error('workspace route D1 schema has not been migrated');
  }

  return state;
};

const matchesRoutePrefix = (path: string, pathPrefix: string): boolean =>
  path === pathPrefix || path.startsWith(`${pathPrefix}/`);

const denied = (input: {
  status: 404 | 503;
  errorCode: string;
}): WorkspaceRouteD1Resolution => ({
  allowed: false,
  status: input.status,
  errorCode: input.errorCode,
  auditEvent: 'workspace.hostname.route.denied',
});

export const createInMemoryWorkspaceRouteD1 = (): WorkspaceRouteD1Database => {
  const state: WorkspaceRouteD1State = {
    migrated: false,
    hostnameRows: new Map<string, StoredWorkspaceRouteD1Record>(),
  };
  const db: WorkspaceRouteD1Database = {
    async dumpHostnameRow(hostname: string): Promise<unknown> {
      const row = state.hostnameRows.get(normalizeHostname(hostname));

      return row ? cloneRecord(row) : null;
    },
  };
  states.set(db, state);

  return db;
};

export const migrateWorkspaceRouteD1 = async (
  db: WorkspaceRouteD1Database,
): Promise<void> => {
  const state = states.get(db);

  if (state) {
    state.migrated = true;
    return;
  }

  const schema = [
    'CREATE TABLE IF NOT EXISTS workspace_route_registry',
    '(hostname TEXT PRIMARY KEY, record_json TEXT NOT NULL)',
  ].join(' ');
  await getPreparedD1(db).prepare(schema).run();
};

export const upsertWorkspaceHostnameInD1 = async (
  db: WorkspaceRouteD1Database,
  input: WorkspaceRouteD1RecordInput,
): Promise<void> => {
  const state = states.get(db);
  const record = createStoredRecord(input);

  if (state) {
    ensureMigrated(db).hostnameRows.set(record.hostname, record);
    return;
  }

  await writeCloudflareD1Record({ db, record });
};

export const resolveWorkspaceRouteFromD1 = async (
  db: WorkspaceRouteD1Database,
  input: WorkspaceRouteD1ResolutionInput,
): Promise<WorkspaceRouteD1Resolution> => {
  const state = states.get(db);
  const record = state
    ? ensureMigrated(db).hostnameRows.get(normalizeHostname(input.host)) ?? null
    : await readCloudflareD1Record({ db, hostname: input.host });

  if (!record || record.status === 'revoked') {
    return denied({ status: 404, errorCode: 'WORKSPACE_HOSTNAME_NOT_FOUND' });
  }

  const route = [...record.routes]
    .filter((candidate) => candidate.status === 'active')
    .sort((left, right) => right.pathPrefix.length - left.pathPrefix.length)
    .find((candidate) => matchesRoutePrefix(input.path, candidate.pathPrefix));

  if (!route) {
    return denied({
      status: 404,
      errorCode: 'WORKSPACE_HOSTNAME_ROUTE_NOT_FOUND',
    });
  }

  if (
    route.target.kind === 'os-connector' &&
    route.target.connectorStatus !== 'connected'
  ) {
    return denied({
      status: 503,
      errorCode: 'WORKSPACE_HOSTNAME_OS_CONNECTOR_OFFLINE',
    });
  }

  return {
    allowed: true,
    workspaceId: record.workspaceId,
    hostname: record.hostname,
    route: route.pathPrefix,
    surface: route.surface,
    auth: route.auth,
    auditEvent: 'workspace.hostname.route.allowed',
    target: cloneTarget(route.target),
  };
};

export const revokeWorkspaceHostnameInD1 = async (
  db: WorkspaceRouteD1Database,
  input: WorkspaceRouteD1RevocationInput,
): Promise<void> => {
  const hostname = normalizeHostname(input.hostname);
  const state = states.get(db);

  if (state) {
    const record = ensureMigrated(db).hostnameRows.get(hostname);

    if (!record) return;

    state.hostnameRows.set(hostname, {
      ...record,
      status: 'revoked',
      revokedAt: new Date().toISOString(),
      revocationReason: input.reason,
    });
    return;
  }

  const record = await readCloudflareD1Record({ db, hostname });

  if (!record) return;

  await writeCloudflareD1Record({
    db,
    record: {
      ...record,
      status: 'revoked',
      updatedAt: new Date().toISOString(),
      revokedAt: new Date().toISOString(),
      revocationReason: input.reason,
    },
  });
};
