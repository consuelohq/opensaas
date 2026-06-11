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

export type WorkspaceRouteD1Database = {
  dumpHostnameRow: (hostname: string) => Promise<unknown>;
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
  const state = getState(db);
  state.migrated = true;
};

export const upsertWorkspaceHostnameInD1 = async (
  db: WorkspaceRouteD1Database,
  input: WorkspaceRouteD1RecordInput,
): Promise<void> => {
  const state = ensureMigrated(db);
  const hostname = normalizeHostname(input.hostname);
  state.hostnameRows.set(hostname, {
    ...input,
    hostname,
    workspaceSlug: input.workspaceSlug.trim().toLowerCase(),
    baseDomain: normalizeBaseDomain(input.baseDomain),
    routes: input.routes.map(cloneRoute),
    updatedAt: new Date().toISOString(),
  });
};

export const resolveWorkspaceRouteFromD1 = async (
  db: WorkspaceRouteD1Database,
  input: WorkspaceRouteD1ResolutionInput,
): Promise<WorkspaceRouteD1Resolution> => {
  const state = ensureMigrated(db);
  const record = state.hostnameRows.get(normalizeHostname(input.host));

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
  const state = ensureMigrated(db);
  const hostname = normalizeHostname(input.hostname);
  const record = state.hostnameRows.get(hostname);

  if (!record) return;

  state.hostnameRows.set(hostname, {
    ...record,
    status: 'revoked',
    revokedAt: new Date().toISOString(),
    revocationReason: input.reason,
  });
};
