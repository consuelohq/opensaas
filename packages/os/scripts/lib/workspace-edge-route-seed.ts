import type {
  WorkspaceRouteD1RecordInput,
  WorkspaceRouteD1Route,
  WorkspaceRouteD1RouteTarget,
} from './workspace-cloudflare-d1-route-registry';

export type WorkspaceEdgeRouteSeedInput = {
  workspaceId?: string;
  workspaceSlug?: string;
  hostname?: string;
  baseDomain?: string;
  appUpstreamUrl?: string;
  connectorId?: string;
  tunnelOriginUrl?: string;
  localServiceUrl?: string;
};

type WorkspaceEdgeSeedRecord = WorkspaceRouteD1RecordInput & {
  updatedAt: string;
};

const DEFAULT_WORKSPACE_ID = 'workspace_internal';
const DEFAULT_WORKSPACE_SLUG = 'internal';
const DEFAULT_HOSTNAME = 'internal.consuelohq.com';
const DEFAULT_BASE_DOMAIN = 'consuelohq.com';
const DEFAULT_APP_UPSTREAM_URL = 'https://app.consuelohq.com';
const DEFAULT_LOCAL_SERVICE_URL = 'http://127.0.0.1:8787';

const normalizeHostname = (hostname: string): string => hostname.trim().toLowerCase();

const normalizeBaseDomain = (baseDomain: string): string =>
  normalizeHostname(baseDomain).replace(/^https?:\/\//, '').replace(/\/$/, '');

const normalizeWorkspaceSlug = (workspaceSlug: string): string =>
  workspaceSlug.trim().toLowerCase();

const hasOsConnectorInput = (
  input: WorkspaceEdgeRouteSeedInput,
): input is WorkspaceEdgeRouteSeedInput & {
  connectorId: string;
  tunnelOriginUrl: string;
} =>
  typeof input.connectorId === 'string' &&
  input.connectorId.trim().length > 0 &&
  typeof input.tunnelOriginUrl === 'string' &&
  input.tunnelOriginUrl.trim().length > 0;

const escapeSqlText = (value: string): string => value.replace(/'/g, "''");

const sqlText = (value: string): string => `'${escapeSqlText(value)}'`;

const sqlNullableText = (value: string | null): string =>
  value === null ? 'NULL' : sqlText(value);

const buildAppRoute = (input: {
  appUpstreamUrl: string;
}): WorkspaceRouteD1Route => ({
  surface: 'app',
  pathPrefix: '/',
  auth: 'required',
  status: 'active',
  target: {
    kind: 'service-upstream',
    service: 'app',
    upstreamUrl: input.appUpstreamUrl,
  },
});

const buildOsRoutes = (input: {
  connectorId: string;
  tunnelOriginUrl: string;
}): WorkspaceRouteD1Route[] =>
  ['/mcp', '/traces'].map((pathPrefix) => ({
    surface: 'os' as const,
    pathPrefix,
    auth: 'required' as const,
    status: 'active' as const,
    target: {
      kind: 'os-connector' as const,
      connectorId: input.connectorId,
      connectorStatus: 'connected' as const,
      tunnelOriginUrl: input.tunnelOriginUrl,
    },
  }));

const getPrimaryRoute = (
  record: WorkspaceEdgeSeedRecord,
): WorkspaceRouteD1Route => {
  const route = record.routes.find((candidate) => candidate.pathPrefix === '/') ?? record.routes[0];

  if (!route) {
    throw new Error('workspace edge seed requires at least one route');
  }

  return route;
};

const getTargetOriginUrl = (target: WorkspaceRouteD1RouteTarget): string =>
  target.kind === 'service-upstream' ? target.upstreamUrl : target.tunnelOriginUrl;

const getConnectorTarget = (
  record: WorkspaceEdgeSeedRecord,
): Extract<WorkspaceRouteD1RouteTarget, { kind: 'os-connector' }> | null => {
  const route = record.routes.find(
    (candidate) => candidate.target.kind === 'os-connector',
  );

  return route?.target.kind === 'os-connector' ? route.target : null;
};

export const createWorkspaceEdgeRouteSeedRecord = (
  input: WorkspaceEdgeRouteSeedInput = {},
): WorkspaceEdgeSeedRecord => {
  const appUpstreamUrl = input.appUpstreamUrl ?? DEFAULT_APP_UPSTREAM_URL;
  const routes: WorkspaceRouteD1Route[] = [buildAppRoute({ appUpstreamUrl })];

  if (hasOsConnectorInput(input)) {
    routes.push(
      ...buildOsRoutes({
        connectorId: input.connectorId.trim(),
        tunnelOriginUrl: input.tunnelOriginUrl.trim(),
      }),
    );
  }

  return {
    workspaceId: input.workspaceId?.trim() || DEFAULT_WORKSPACE_ID,
    workspaceSlug: normalizeWorkspaceSlug(input.workspaceSlug ?? DEFAULT_WORKSPACE_SLUG),
    hostname: normalizeHostname(input.hostname ?? DEFAULT_HOSTNAME),
    baseDomain: normalizeBaseDomain(input.baseDomain ?? DEFAULT_BASE_DOMAIN),
    provider: 'cloudflare',
    owner: 'consuelo-os-cloud',
    status: 'active',
    routes,
    updatedAt: new Date().toISOString(),
  };
};

const createConnectorSql = (input: {
  record: WorkspaceEdgeSeedRecord;
  connectorTarget: Extract<WorkspaceRouteD1RouteTarget, { kind: 'os-connector' }>;
  localServiceUrl: string;
}): string =>
  [
    'INSERT OR REPLACE INTO workspace_connectors (',
    '  connector_id,',
    '  workspace_id,',
    '  workspace_host,',
    '  transport,',
    '  local_service_url,',
    '  connector_status,',
    '  created_at,',
    '  updated_at',
    ') VALUES (',
    `  ${sqlText(input.connectorTarget.connectorId)},`,
    `  ${sqlText(input.record.workspaceId)},`,
    `  ${sqlText(input.record.hostname)},`,
    "  'cloudflare-tunnel',",
    `  ${sqlText(input.localServiceUrl)},`,
    `  ${sqlText(input.connectorTarget.connectorStatus)},`,
    "  datetime('now'),",
    "  datetime('now')",
    ');',
  ].join('\n');

const createRouteSql = (input: {
  record: WorkspaceEdgeSeedRecord;
  primaryRoute: WorkspaceRouteD1Route;
  connectorTarget: Extract<WorkspaceRouteD1RouteTarget, { kind: 'os-connector' }> | null;
}): string =>
  [
    'INSERT OR REPLACE INTO workspace_route_registry (',
    '  hostname,',
    '  workspace_id,',
    '  workspace_slug,',
    '  workspace_host,',
    '  base_domain,',
    '  route_path_prefix,',
    '  route_surface,',
    '  route_status,',
    '  route_target_kind,',
    '  target_origin_url,',
    '  connector_id,',
    '  connector_status,',
    '  record_json,',
    '  created_at,',
    '  updated_at',
    ') VALUES (',
    `  ${sqlText(input.record.hostname)},`,
    `  ${sqlText(input.record.workspaceId)},`,
    `  ${sqlText(input.record.workspaceSlug)},`,
    `  ${sqlText(input.record.hostname)},`,
    `  ${sqlText(input.record.baseDomain)},`,
    `  ${sqlText(input.primaryRoute.pathPrefix)},`,
    `  ${sqlText(input.primaryRoute.surface)},`,
    `  ${sqlText(input.primaryRoute.status)},`,
    `  ${sqlText(input.primaryRoute.target.kind)},`,
    `  ${sqlText(getTargetOriginUrl(input.primaryRoute.target))},`,
    `  ${sqlNullableText(input.connectorTarget?.connectorId ?? null)},`,
    `  ${sqlNullableText(input.connectorTarget?.connectorStatus ?? null)},`,
    `  ${sqlText(JSON.stringify(input.record))},`,
    "  datetime('now'),",
    "  datetime('now')",
    ');',
  ].join('\n');

export const createWorkspaceEdgeRouteSeedSql = (
  input: WorkspaceEdgeRouteSeedInput = {},
): string => {
  const record = createWorkspaceEdgeRouteSeedRecord(input);
  const primaryRoute = getPrimaryRoute(record);
  const connectorTarget = getConnectorTarget(record);
  const statements: string[] = [];

  if (connectorTarget) {
    statements.push(
      createConnectorSql({
        record,
        connectorTarget,
        localServiceUrl: input.localServiceUrl ?? DEFAULT_LOCAL_SERVICE_URL,
      }),
    );
  }

  statements.push(createRouteSql({ record, primaryRoute, connectorTarget }));

  return statements.join('\n\n');
};
