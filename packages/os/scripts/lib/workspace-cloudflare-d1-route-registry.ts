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
    }
  | {
      kind: 'site-snapshot';
      siteId: string;
      versionId: string;
      manifestKey: string;
      htmlKey?: string;
      contentHash?: string;
      contentType?: string;
      cachePolicy: 'static-shell' | 'versioned-asset' | 'mutable-artifact' | 'private-preview';
    }
  | {
      kind: 'consuelo-gateway-service';
      serviceName:
        | 'trace-sites-read-layer'
        | 'trace-sites-live-endpoints'
        | 'configuration-sites-read-endpoints'
        | 'configuration-sites-write-endpoints'
        | 'settings-sites-read-endpoints'
        | 'settings-sites-write-endpoints'
        | 'environment-sites-read-endpoints'
        | 'environment-sites-write-endpoints'
        | 'secrets-sites-read-endpoints'
        | 'secrets-sites-write-endpoints'
        | (string & {});
      gatewayRouteFamily: string;
      publicSiteRouteFamily: string;
    }
  | {
      kind: 'redirect';
      location: string;
      statusCode: 301 | 302 | 307 | 308;
    };

export type WorkspaceRouteD1Route = {
  surface: 'os' | 'dialer' | 'app' | 'sites' | 'twenty';
  pathPrefix: string;
  auth: 'public' | 'required' | 'workspace-session' | 'signed-connector';
  status: 'active' | 'disabled';
  target: WorkspaceRouteD1RouteTarget;
};

export type WorkspaceRouteD1NodeTarget = {
  nodeId: string;
  connectorId: string;
  connectorStatus: 'connected' | 'disconnected';
  tunnelOriginUrl: string;
  state: 'active' | 'revoked';
  lastSeenAt: number;
  heartbeatTtlMs: number;
};

export type WorkspaceRouteD1NodeConnector = {
  nodeId: string;
  connectorId: string;
  connectorStatus: 'connected' | 'disconnected';
  tunnelOriginUrl: string;
};

export type WorkspaceRouteD1RecordInput = {
  workspaceId: string;
  workspaceSlug: string;
  hostname: string;
  baseDomain: string;
  provider: 'cloudflare';
  owner: 'consuelo-os-cloud';
  status: 'active' | 'revoked';
  defaultNodeId?: string;
  nodeTargets?: WorkspaceRouteD1NodeTarget[];
  routes: WorkspaceRouteD1Route[];
};

export type WorkspaceRouteD1ResolutionInput = {
  host: string;
  path: string;
  nodeId?: string;
  nowMs?: number;
  requireOnlineNode?: boolean;
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
      auth: WorkspaceRouteD1Route['auth'];
      auditEvent: 'workspace.hostname.route.allowed';
      nodeId?: string;
      nodeConnector?: WorkspaceRouteD1NodeConnector;
      target: WorkspaceRouteD1RouteTarget;
    }
  | {
      allowed: false;
      status: 404 | 503;
      errorCode: string;
      auditEvent: 'workspace.hostname.route.denied';
      diagnostic?: {
        message: string;
      };
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

const getD1ErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : 'unknown D1 registry error';

const createD1RegistryError = (operation: string, error: unknown): Error =>
  new Error(
    `workspace route D1 ${operation} failed: ${getD1ErrorMessage(error)}`,
  );

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
  ...(record.nodeTargets
    ? { nodeTargets: record.nodeTargets.map((target) => ({ ...target })) }
    : {}),
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
  ...(input.defaultNodeId ? { defaultNodeId: input.defaultNodeId } : {}),
  ...(input.nodeTargets
    ? { nodeTargets: input.nodeTargets.map((target) => ({ ...target })) }
    : {}),
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
}): Promise<unknown> => {
  const primaryRoute = input.record.routes[0];
  if (!primaryRoute) throw new Error('workspace route record must contain a route');
  const defaultNodeTarget = input.record.nodeTargets?.find(
    (target) => target.nodeId === input.record.defaultNodeId,
  );
  const connectorTarget =
    defaultNodeTarget ??
    (primaryRoute.target.kind === 'os-connector'
      ? {
          connectorId: primaryRoute.target.connectorId,
          connectorStatus: primaryRoute.target.connectorStatus,
          tunnelOriginUrl: primaryRoute.target.tunnelOriginUrl,
        }
      : undefined);
  const targetOriginUrl =
    primaryRoute.target.kind === 'service-upstream'
      ? primaryRoute.target.upstreamUrl
      : primaryRoute.target.kind === 'os-connector'
        ? primaryRoute.target.tunnelOriginUrl
        : primaryRoute.target.kind === 'redirect'
          ? primaryRoute.target.location
          : '';
  const sql = [
    'INSERT INTO workspace_route_registry',
    '(hostname, workspace_id, workspace_slug, workspace_host, base_domain, route_path_prefix, route_surface, route_status, route_target_kind, target_origin_url, connector_id, connector_status, record_json, created_at, updated_at)',
    'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime(\'now\'), datetime(\'now\'))',
    'ON CONFLICT(hostname) DO UPDATE SET',
    'workspace_id = excluded.workspace_id, workspace_slug = excluded.workspace_slug, workspace_host = excluded.workspace_host,',
    'base_domain = excluded.base_domain, route_path_prefix = excluded.route_path_prefix, route_surface = excluded.route_surface,',
    'route_status = excluded.route_status, route_target_kind = excluded.route_target_kind, target_origin_url = excluded.target_origin_url,',
    'connector_id = excluded.connector_id, connector_status = excluded.connector_status, record_json = excluded.record_json, updated_at = datetime(\'now\')',
  ].join(' ');
  return getPreparedD1(input.db)
    .prepare(sql)
    .bind(
      input.record.hostname,
      input.record.workspaceId,
      input.record.workspaceSlug,
      input.record.hostname,
      input.record.baseDomain,
      primaryRoute.pathPrefix,
      primaryRoute.surface,
      primaryRoute.status,
      primaryRoute.target.kind,
      targetOriginUrl,
      connectorTarget?.connectorId ?? null,
      connectorTarget?.connectorStatus ?? null,
      JSON.stringify(input.record),
    )
    .run();
};

const writeCloudflareD1Connector = async (input: {
  db: WorkspaceRouteD1Database;
  record: StoredWorkspaceRouteD1Record;
  target: WorkspaceRouteD1NodeTarget;
  localServiceUrl: string;
}): Promise<void> => {
  try {
    if (states.has(input.db)) return;
    await getPreparedD1(input.db)
      .prepare(
        [
          'INSERT INTO workspace_connectors',
          '(connector_id, workspace_id, workspace_host, transport, local_service_url, connector_status, created_at, updated_at)',
          'VALUES (?, ?, ?, ?, ?, ?, datetime(\'now\'), datetime(\'now\'))',
          'ON CONFLICT(connector_id) DO UPDATE SET workspace_id = excluded.workspace_id, workspace_host = excluded.workspace_host,',
          'transport = excluded.transport, local_service_url = excluded.local_service_url, connector_status = excluded.connector_status, updated_at = datetime(\'now\')',
        ].join(' '),
      )
      .bind(
        input.target.connectorId,
        input.record.workspaceId,
        input.record.hostname,
        'cloudflare-tunnel',
        input.localServiceUrl,
        input.target.connectorStatus,
      )
      .run();
  } catch (error: unknown) {
    throw createD1RegistryError('connector write', error);
  }
};

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
  pathPrefix === '/' || path === pathPrefix || path.startsWith(`${pathPrefix}/`);

const denied = (input: {
  status: 404 | 503;
  errorCode: string;
  diagnostic?: { message: string };
}): WorkspaceRouteD1Resolution => ({
  allowed: false,
  status: input.status,
  errorCode: input.errorCode,
  auditEvent: 'workspace.hostname.route.denied',
  ...(input.diagnostic ? { diagnostic: input.diagnostic } : {}),
});

const readStoredRecord = async (
  db: WorkspaceRouteD1Database,
  hostname: string,
): Promise<StoredWorkspaceRouteD1Record | null> => {
  try {
    const state = states.get(db);
    if (state) {
      const record = ensureMigrated(db).hostnameRows.get(normalizeHostname(hostname));
      return record ? cloneRecord(record) : null;
    }
    return await readCloudflareD1Record({ db, hostname });
  } catch (error: unknown) {
    throw createD1RegistryError('hostname read', error);
  }
};

const writeStoredRecord = async (
  db: WorkspaceRouteD1Database,
  record: StoredWorkspaceRouteD1Record,
): Promise<void> => {
  try {
    const state = states.get(db);
    if (state) {
      ensureMigrated(db).hostnameRows.set(record.hostname, cloneRecord(record));
      return;
    }
    await writeCloudflareD1Record({ db, record });
  } catch (error: unknown) {
    throw createD1RegistryError('hostname write', error);
  }
};

const connectorTargetForNode = (
  target: WorkspaceRouteD1NodeTarget,
): Extract<WorkspaceRouteD1RouteTarget, { kind: 'os-connector' }> => ({
  kind: 'os-connector',
  connectorId: target.connectorId,
  connectorStatus: target.connectorStatus,
  tunnelOriginUrl: target.tunnelOriginUrl,
});

const nodeConnectorForTarget = (
  target: WorkspaceRouteD1NodeTarget,
): WorkspaceRouteD1NodeConnector => ({
  nodeId: target.nodeId,
  connectorId: target.connectorId,
  connectorStatus: target.connectorStatus,
  tunnelOriginUrl: target.tunnelOriginUrl,
});

const nodePresence = (
  target: WorkspaceRouteD1NodeTarget,
  nowMs: number,
): 'online' | 'stale' | 'offline' => {
  if (target.connectorStatus === 'disconnected') return 'offline';
  const ageMs = Math.max(0, nowMs - target.lastSeenAt);
  if (ageMs <= target.heartbeatTtlMs) return 'online';
  if (ageMs <= target.heartbeatTtlMs * 3) return 'stale';
  return 'offline';
};

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
const WORKSPACE_ROUTE_REGISTRY_TABLE_SQL = [
  'CREATE TABLE workspace_route_registry',
  '(hostname TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, workspace_slug TEXT NOT NULL, workspace_host TEXT NOT NULL,',
  'base_domain TEXT NOT NULL, route_path_prefix TEXT NOT NULL,',
  "route_surface TEXT NOT NULL CHECK (route_surface IN ('os', 'dialer', 'app', 'sites', 'twenty')),",
  "route_status TEXT NOT NULL CHECK (route_status IN ('active', 'disabled')),",
  "route_target_kind TEXT NOT NULL CHECK (route_target_kind IN ('service-upstream', 'os-connector', 'site-snapshot', 'consuelo-gateway-service', 'redirect')),",
  'target_origin_url TEXT NOT NULL, connector_id TEXT,',
  "connector_status TEXT CHECK (connector_status IN ('connected', 'disconnected') OR connector_status IS NULL),",
  'record_json TEXT NOT NULL, revoked_at TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,',
  'updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,',
  'FOREIGN KEY (connector_id) REFERENCES workspace_connectors(connector_id))',
].join(' ');

const WORKSPACE_ROUTE_REGISTRY_LEGACY_REBUILD_SQL = [
  'DROP TABLE IF EXISTS workspace_route_registry_next;',
  WORKSPACE_ROUTE_REGISTRY_TABLE_SQL.replace(
    'workspace_route_registry',
    'workspace_route_registry_next',
  ) + ';',
  [
    'INSERT INTO workspace_route_registry_next',
    '(hostname, workspace_id, workspace_slug, workspace_host, base_domain, route_path_prefix, route_surface,',
    'route_status, route_target_kind, target_origin_url, connector_id, connector_status, record_json,',
    'revoked_at, created_at, updated_at)',
    'SELECT hostname,',
    "COALESCE(json_extract(record_json, '$.workspaceId'), 'legacy:' || hostname),",
    "COALESCE(json_extract(record_json, '$.workspaceSlug'), hostname),",
    "COALESCE(json_extract(record_json, '$.hostname'), hostname),",
    "COALESCE(json_extract(record_json, '$.baseDomain'), ''),",
    "COALESCE(json_extract(record_json, '$.routes[0].pathPrefix'), '/'),",
    "COALESCE(json_extract(record_json, '$.routes[0].surface'), 'os'),",
    "COALESCE(json_extract(record_json, '$.routes[0].status'), 'disabled'),",
    "CASE WHEN json_extract(record_json, '$.routes[0].target.kind') IN",
    "('service-upstream', 'os-connector', 'site-snapshot', 'consuelo-gateway-service', 'redirect')",
    "THEN json_extract(record_json, '$.routes[0].target.kind') ELSE 'service-upstream' END,",
    "COALESCE(json_extract(record_json, '$.routes[0].target.upstreamUrl'),",
    "json_extract(record_json, '$.routes[0].target.tunnelOriginUrl'),",
    "json_extract(record_json, '$.routes[0].target.location'), ''),",
    'NULL, NULL, record_json, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP',
    'FROM workspace_route_registry;',
  ].join(' '),
  'DROP TABLE workspace_route_registry;',
  'ALTER TABLE workspace_route_registry_next RENAME TO workspace_route_registry;',
].join('\n');

export const migrateWorkspaceRouteD1 = async (
  db: WorkspaceRouteD1Database,
): Promise<void> => {
  try {
    const state = states.get(db);

    if (state) {
      state.migrated = true;
      return;
    }

    const prepared = getPreparedD1(db);
    const bootstrapStatements = [
      [
        'CREATE TABLE IF NOT EXISTS workspace_connectors',
        '(connector_id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, workspace_host TEXT NOT NULL,',
        "transport TEXT NOT NULL CHECK (transport IN ('cloudflare-tunnel', 'websocket-relay')),",
        'local_service_url TEXT NOT NULL,',
        "connector_status TEXT NOT NULL CHECK (connector_status IN ('connected', 'disconnected')),",
        'revoked_at TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)',
      ].join(' '),
      WORKSPACE_ROUTE_REGISTRY_TABLE_SQL.replace(
        'CREATE TABLE workspace_route_registry',
        'CREATE TABLE IF NOT EXISTS workspace_route_registry',
      ),
    ];
    for (const statement of bootstrapStatements) {
      await prepared.prepare(statement).run();
    }

    const schema = await prepared
      .prepare(
        "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'workspace_route_registry' LIMIT 1",
      )
      .first<{ sql?: string }>();
    const schemaSql = schema?.sql ?? '';
    const requiredSchemaTokens = [
      'workspace_id',
      'workspace_slug',
      'route_path_prefix',
      'record_json',
      'consuelo-gateway-service',
      'redirect',
    ];
    if (
      schemaSql &&
      requiredSchemaTokens.some((token) => !schemaSql.includes(token))
    ) {
      if (!db.exec) {
        throw new Error(
          'legacy workspace route schema requires an executable D1 migration binding',
        );
      }
      await db.exec(WORKSPACE_ROUTE_REGISTRY_LEGACY_REBUILD_SQL);
    }

    const indexStatements = [
      'CREATE UNIQUE INDEX IF NOT EXISTS idx_workspace_route_registry_hostname_path ON workspace_route_registry(hostname, route_path_prefix)',
      'CREATE INDEX IF NOT EXISTS idx_workspace_route_registry_workspace_id ON workspace_route_registry(workspace_id)',
      'CREATE INDEX IF NOT EXISTS idx_workspace_route_registry_connector_id ON workspace_route_registry(connector_id)',
      'CREATE INDEX IF NOT EXISTS idx_workspace_route_registry_workspace_connector ON workspace_route_registry(workspace_id, connector_id)',
      'CREATE INDEX IF NOT EXISTS idx_workspace_connectors_workspace_id ON workspace_connectors(workspace_id)',
      'CREATE INDEX IF NOT EXISTS idx_workspace_connectors_status ON workspace_connectors(connector_status)',
    ];
    for (const statement of indexStatements) {
      await prepared.prepare(statement).run();
    }
  } catch (error: unknown) {
    throw createD1RegistryError('migration', error);
  }
};

export const upsertWorkspaceHostnameInD1 = async (
  db: WorkspaceRouteD1Database,
  input: WorkspaceRouteD1RecordInput,
): Promise<void> => {
  try {
    const state = states.get(db);
    const record = createStoredRecord(input);

    if (state) {
      ensureMigrated(db).hostnameRows.set(record.hostname, record);
      return;
    }

    await writeCloudflareD1Record({ db, record });
  } catch (error: unknown) {
    throw createD1RegistryError('upsert', error);
  }
};

export const resolveWorkspaceRouteFromD1 = async (
  db: WorkspaceRouteD1Database,
  input: WorkspaceRouteD1ResolutionInput,
): Promise<WorkspaceRouteD1Resolution> => {
  try {
    const record = await readStoredRecord(db, input.host);

    if (!record || record.status === 'revoked') {
      return denied({ status: 404, errorCode: 'WORKSPACE_HOSTNAME_NOT_FOUND' });
    }

    const route = [...record.routes]
      .sort((left, right) => right.pathPrefix.length - left.pathPrefix.length)
      .find((candidate) => matchesRoutePrefix(input.path, candidate.pathPrefix));

    if (!route || route.status !== 'active') {
      return denied({
        status: 404,
        errorCode: 'WORKSPACE_HOSTNAME_ROUTE_NOT_FOUND',
      });
    }

    let target = cloneTarget(route.target);
    let nodeId: string | undefined;
    let nodeConnector: WorkspaceRouteD1NodeConnector | undefined;
    const requiresNodeConnector =
      route.target.kind === 'os-connector' ||
      route.target.kind === 'consuelo-gateway-service';

    if (requiresNodeConnector && record.nodeTargets?.length) {
      nodeId = input.nodeId?.trim() || record.defaultNodeId;
      const nodeTarget = record.nodeTargets.find(
        (candidate) => candidate.nodeId === nodeId,
      );
      if (!nodeId || !nodeTarget) {
        return denied({ status: 404, errorCode: 'WORKSPACE_NODE_NOT_FOUND' });
      }
      if (nodeTarget.state === 'revoked') {
        return denied({ status: 404, errorCode: 'WORKSPACE_NODE_REVOKED' });
      }
      if (
        input.requireOnlineNode !== false &&
        (nodeTarget.connectorStatus !== 'connected' ||
          nodePresence(nodeTarget, input.nowMs ?? Date.now()) !== 'online')
      ) {
        return denied({ status: 503, errorCode: 'WORKSPACE_NODE_OFFLINE' });
      }
      nodeConnector = nodeConnectorForTarget(nodeTarget);
      if (route.target.kind === 'os-connector') {
        target = connectorTargetForNode(nodeTarget);
      }
    } else if (route.target.kind === 'consuelo-gateway-service') {
      const legacyConnectorRoute = record.routes.find(
        (candidate) => candidate.target.kind === 'os-connector',
      );
      if (legacyConnectorRoute?.target.kind !== 'os-connector') {
        return denied({ status: 404, errorCode: 'WORKSPACE_NODE_NOT_FOUND' });
      }
      if (
        input.requireOnlineNode !== false &&
        legacyConnectorRoute.target.connectorStatus !== 'connected'
      ) {
        return denied({ status: 503, errorCode: 'WORKSPACE_NODE_OFFLINE' });
      }
      nodeId = input.nodeId?.trim() || record.defaultNodeId || record.workspaceSlug;
      nodeConnector = {
        nodeId,
        connectorId: legacyConnectorRoute.target.connectorId,
        connectorStatus: legacyConnectorRoute.target.connectorStatus,
        tunnelOriginUrl: legacyConnectorRoute.target.tunnelOriginUrl,
      };
    } else if (
      input.requireOnlineNode !== false &&
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
      ...(nodeId ? { nodeId } : {}),
      ...(nodeConnector ? { nodeConnector } : {}),
      target,
    };
  } catch (error: unknown) {
    return denied({
      status: 503,
      errorCode: 'WORKSPACE_ROUTE_REGISTRY_UNAVAILABLE',
      diagnostic: { message: getD1ErrorMessage(error) },
    });
  }
};

export const revokeWorkspaceHostnameInD1 = async (
  db: WorkspaceRouteD1Database,
  input: WorkspaceRouteD1RevocationInput,
): Promise<void> => {
  try {
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

    const revokedAt = new Date().toISOString();
    await writeCloudflareD1Record({
      db,
      record: {
        ...record,
        status: 'revoked',
        updatedAt: revokedAt,
        revokedAt,
        revocationReason: input.reason,
      },
    });
  } catch (error: unknown) {
    throw createD1RegistryError('revocation', error);
  }
};

export const createWorkspaceCloudflareD1RouteRegistry = (
  db: WorkspaceRouteD1Database,
): {
  resolve: (input: {
    host: string;
    path: string;
    method: string;
    nodeId?: string;
    nowMs?: number;
    requireOnlineNode?: boolean;
  }) => Promise<WorkspaceRouteD1Resolution>;
} => ({
  async resolve(input: {
    host: string;
    path: string;
    method: string;
    nodeId?: string;
    nowMs?: number;
    requireOnlineNode?: boolean;
  }): Promise<WorkspaceRouteD1Resolution> {
    // NOTE: method is reserved for future method-scoped route policies.
    try {
      return await resolveWorkspaceRouteFromD1(db, {
        host: input.host,
        path: input.path,
        ...(input.nodeId ? { nodeId: input.nodeId } : {}),
        ...(input.nowMs !== undefined ? { nowMs: input.nowMs } : {}),
        ...(input.requireOnlineNode !== undefined
          ? { requireOnlineNode: input.requireOnlineNode }
          : {}),
      });
    } catch (error: unknown) {
      throw createD1RegistryError('route_resolution', error);
    }
  },
});

export const upsertWorkspaceNodeTargetInD1 = async (
  db: WorkspaceRouteD1Database,
  input: {
    record: WorkspaceRouteD1RecordInput;
    target: WorkspaceRouteD1NodeTarget;
    makeDefault?: boolean;
    localServiceUrl?: string;
    refreshSiteSnapshots?: boolean;
  },
): Promise<void> => {
  try {
    const existing = await readStoredRecord(db, input.record.hostname);
    const base = existing ?? createStoredRecord(input.record);
    const legacyConnectorRoute = existing?.routes.find(
      (route) => route.target.kind === 'os-connector',
    );
    const legacyTarget =
      existing &&
      !(base.nodeTargets?.length) &&
      legacyConnectorRoute?.target.kind === 'os-connector'
        ? {
            nodeId:
              base.defaultNodeId ??
              (legacyConnectorRoute.target.connectorId === input.target.connectorId
                ? input.target.nodeId
                : base.workspaceSlug),
            connectorId: legacyConnectorRoute.target.connectorId,
            connectorStatus: legacyConnectorRoute.target.connectorStatus,
            tunnelOriginUrl: legacyConnectorRoute.target.tunnelOriginUrl,
            state: 'active' as const,
            lastSeenAt: Date.now(),
            heartbeatTtlMs: input.target.heartbeatTtlMs,
          }
        : undefined;
    const targets = [
      ...(legacyTarget ? [legacyTarget] : []),
      ...(base.nodeTargets ?? []).filter(
        (candidate) => candidate.nodeId !== input.target.nodeId,
      ),
      { ...input.target },
    ].filter(
      (candidate, index, candidates) =>
        candidates.findIndex((item) => item.nodeId === candidate.nodeId) === index,
    );
    const defaultNodeId =
      (input.makeDefault ? input.target.nodeId : undefined) ??
      base.defaultNodeId ??
      legacyTarget?.nodeId ??
      input.target.nodeId;
    const defaultTarget = targets.find(
      (candidate) => candidate.nodeId === defaultNodeId,
    );
    const incomingControlPlaneRoutes = input.record.routes.filter((route) =>
      route.target.kind === 'os-connector' ||
      route.target.kind === 'consuelo-gateway-service' ||
      route.target.kind === 'redirect',
    );
    const incomingSiteSnapshotRoutes = input.refreshSiteSnapshots
      ? input.record.routes.filter(
          (route) => route.status === 'active' && route.target.kind === 'site-snapshot',
        )
      : [];
    const incomingRoutePaths = new Set(
      [...incomingControlPlaneRoutes, ...incomingSiteSnapshotRoutes].map(
        (route) => route.pathPrefix,
      ),
    );
    const preservedPublishedRoutes = base.routes.filter((route) => {
      if (incomingRoutePaths.has(route.pathPrefix)) return false;
      return (
        route.target.kind !== 'os-connector' &&
        route.target.kind !== 'consuelo-gateway-service' &&
        route.target.kind !== 'redirect'
      );
    });
    const routes = [
      ...preservedPublishedRoutes,
      ...incomingSiteSnapshotRoutes,
      ...incomingControlPlaneRoutes,
    ].map((route) =>
        route.target.kind === 'os-connector' && defaultTarget
          ? { ...route, target: connectorTargetForNode(defaultTarget) }
          : cloneRoute(route),
      );
    await writeCloudflareD1Connector({
      db,
      record: base,
      target: input.target,
      localServiceUrl: input.localServiceUrl ?? 'http://127.0.0.1:46320',
    });
    await writeStoredRecord(db, {
      ...base,
      defaultNodeId,
      nodeTargets: targets,
      routes,
      updatedAt: new Date().toISOString(),
    });
  } catch (error: unknown) {
    throw createD1RegistryError('node target upsert', error);
  }
};

export const updateWorkspaceNodeTargetInD1 = async (
  db: WorkspaceRouteD1Database,
  input: {
    hostname: string;
    nodeId: string;
    connectorStatus?: 'connected' | 'disconnected';
    state?: 'active' | 'revoked';
    lastSeenAt?: number;
    heartbeatTtlMs?: number;
  },
): Promise<void> => {
  try {
    const record = await readStoredRecord(db, input.hostname);
    if (!record) return;
    const nodeTargets = (record.nodeTargets ?? []).map((target) =>
      target.nodeId === input.nodeId
        ? {
            ...target,
            ...(input.connectorStatus
              ? { connectorStatus: input.connectorStatus }
              : {}),
            ...(input.state ? { state: input.state } : {}),
            ...(input.lastSeenAt !== undefined
              ? { lastSeenAt: input.lastSeenAt }
              : {}),
            ...(input.heartbeatTtlMs !== undefined
              ? { heartbeatTtlMs: input.heartbeatTtlMs }
              : {}),
          }
        : target,
    );
    await writeStoredRecord(db, {
      ...record,
      nodeTargets,
      updatedAt: new Date().toISOString(),
    });
  } catch (error: unknown) {
    throw createD1RegistryError('node target update', error);
  }
};

export const setDefaultWorkspaceNodeInD1 = async (
  db: WorkspaceRouteD1Database,
  input: { hostname: string; nodeId: string },
): Promise<void> => {
  try {
    const record = await readStoredRecord(db, input.hostname);
    if (!record) throw new Error('workspace hostname was not found');
    const target = record.nodeTargets?.find(
      (candidate) => candidate.nodeId === input.nodeId,
    );
    if (!target || target.state !== 'active') {
      throw new Error('workspace node target was not found');
    }
    const routes = record.routes.map((route) =>
      route.target.kind === 'os-connector'
        ? { ...route, target: connectorTargetForNode(target) }
        : cloneRoute(route),
    );
    await writeStoredRecord(db, {
      ...record,
      defaultNodeId: input.nodeId,
      routes,
      updatedAt: new Date().toISOString(),
    });
  } catch (error: unknown) {
    throw createD1RegistryError('default node update', error);
  }
};
