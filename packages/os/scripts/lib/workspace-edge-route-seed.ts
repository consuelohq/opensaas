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
  siteSnapshotKey?: string;
  siteVersionId?: string;
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
const DEFAULT_SITE_ID = 'launcher';
const DEFAULT_SITE_VERSION_ID = 'seeded-workspace-site-shell';
const DEFAULT_SITE_MANIFEST_KEY = `sites/${DEFAULT_WORKSPACE_ID}/${DEFAULT_SITE_ID}/${DEFAULT_SITE_VERSION_ID}/index.html`;
const DEFAULT_SITE_CONTENT_TYPE = 'text/html; charset=utf-8';
const SITE_SNAPSHOT_ROUTES = [
  { pathPrefix: '/', siteId: 'launcher' },
  { pathPrefix: '/office', siteId: 'office' },
  { pathPrefix: '/observability', siteId: 'traces' },
  { pathPrefix: '/traces', siteId: 'traces' },
  { pathPrefix: '/tracing', siteId: 'traces' },
  { pathPrefix: '/diffs', siteId: 'diffs' },
  { pathPrefix: '/docs', siteId: 'docs' },
  { pathPrefix: '/settings', siteId: 'settings' },
] as const;
type SiteSnapshotRoute = typeof SITE_SNAPSHOT_ROUTES[number];

const normalizeHostname = (hostname: string): string => hostname.trim().toLowerCase();

const normalizeBaseDomain = (baseDomain: string): string =>
  normalizeHostname(baseDomain).replace(/^https?:\/\//, '').replace(/\/$/, '');

const normalizeWorkspaceSlug = (workspaceSlug: string): string =>
  workspaceSlug.trim().toLowerCase();
const trimmedValue = (value: string | undefined): string | undefined => {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
};

const trimmedOrDefault = (value: string | undefined, defaultValue: string): string =>
  trimmedValue(value) ?? defaultValue;

const hasOsConnectorInput = (
  input: WorkspaceEdgeRouteSeedInput,
): boolean =>
  trimmedValue(input.connectorId) !== undefined &&
  trimmedValue(input.tunnelOriginUrl) !== undefined;
const escapeSqlText = (value: string): string => value.replace(/'/g, "''");

const sqlText = (value: string): string => `'${escapeSqlText(value)}'`;

const sqlNullableText = (value: string | null): string =>
  value === null ? 'NULL' : sqlText(value);

const siteVersionFromSnapshotKey = (siteSnapshotKey: string | undefined): string | undefined => {
  const match = trimmedValue(siteSnapshotKey)?.match(/^sites\/[^/]+\/[^/]+\/([^/]+)\/index\.html$/);
  return match?.[1];
};

const siteManifestKey = (input: {
  workspaceId: string;
  siteId: string;
  siteSnapshotKey?: string;
  siteVersionId?: string;
}): string => {
  const versionId = trimmedValue(input.siteVersionId) ?? siteVersionFromSnapshotKey(input.siteSnapshotKey) ?? DEFAULT_SITE_VERSION_ID;
  const snapshotKey = trimmedValue(input.siteSnapshotKey);
  const snapshotMatch = snapshotKey?.match(/^(sites\/[^/]+)\/[^/]+\/[^/]+\/index\.html$/);
  if (snapshotMatch) return `${snapshotMatch[1]}/${input.siteId}/${versionId}/index.html`;
  return `sites/${input.workspaceId}/${input.siteId}/${versionId}/index.html`;
};

const buildSiteSnapshotRoute = (input: SiteSnapshotRoute & {
  workspaceId: string;
  siteSnapshotKey?: string;
  siteVersionId?: string;
}): WorkspaceRouteD1Route => ({
  surface: 'sites',
  pathPrefix: input.pathPrefix,
  auth: 'public',
  status: 'active',
  target: {
    kind: 'site-snapshot',
    siteId: input.siteId,
    versionId: trimmedValue(input.siteVersionId) ?? siteVersionFromSnapshotKey(input.siteSnapshotKey) ?? DEFAULT_SITE_VERSION_ID,
    manifestKey: siteManifestKey({
      workspaceId: input.workspaceId,
      siteId: input.siteId,
      siteSnapshotKey: input.siteSnapshotKey,
      siteVersionId: input.siteVersionId,
    }),
    contentType: DEFAULT_SITE_CONTENT_TYPE,
    cachePolicy: 'static-shell',
  },
});

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
}): WorkspaceRouteD1Route[] => [{
  surface: 'os',
  pathPrefix: '/mcp',
  auth: 'required',
  status: 'active',
  target: {
    kind: 'os-connector',
    connectorId: input.connectorId,
    connectorStatus: 'connected',
    tunnelOriginUrl: input.tunnelOriginUrl,
  },
}];

const buildTraceGatewayRoutes = (): WorkspaceRouteD1Route[] => [
  {
    surface: 'sites',
    pathPrefix: '/gateway/traces/events',
    auth: 'required',
    status: 'active',
    target: {
      kind: 'consuelo-gateway-service',
      serviceName: 'trace-sites-live-endpoints',
      gatewayRouteFamily: '/gateway/traces/*',
      publicSiteRouteFamily: '/observability/*',
    },
  },
  {
    surface: 'sites',
    pathPrefix: '/gateway/traces',
    auth: 'required',
    status: 'active',
    target: {
      kind: 'consuelo-gateway-service',
      serviceName: 'trace-sites-read-layer',
      gatewayRouteFamily: '/gateway/traces/*',
      publicSiteRouteFamily: '/observability/*',
    },
  },
];

const getPrimaryRoute = (
  record: WorkspaceEdgeSeedRecord,
): WorkspaceRouteD1Route => {
  const route = record.routes.find((candidate) => candidate.pathPrefix === '/') ?? record.routes[0];

  if (!route) {
    throw new Error('workspace edge seed requires at least one route');
  }

  return route;
};

const getTargetOriginUrl = (target: WorkspaceRouteD1RouteTarget): string => {
  if (target.kind === 'service-upstream') return target.upstreamUrl;
  if (target.kind === 'os-connector') return target.tunnelOriginUrl;
  if (target.kind === 'site-snapshot') return `r2://consuelo-sites-snapshots/${target.manifestKey}`;
  return `consuelo-gateway://${target.serviceName}`;
};

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
  const workspaceId = trimmedOrDefault(input.workspaceId, DEFAULT_WORKSPACE_ID);
  const workspaceSlug = trimmedOrDefault(
    input.workspaceSlug,
    DEFAULT_WORKSPACE_SLUG,
  );
  const hostname = trimmedOrDefault(input.hostname, DEFAULT_HOSTNAME);
  const baseDomain = trimmedOrDefault(input.baseDomain, DEFAULT_BASE_DOMAIN);
  const appUpstreamUrl = trimmedOrDefault(input.appUpstreamUrl, DEFAULT_APP_UPSTREAM_URL);
  const routes: WorkspaceRouteD1Route[] = [
    ...SITE_SNAPSHOT_ROUTES.map((route) => buildSiteSnapshotRoute({
      ...route,
      workspaceId,
      siteSnapshotKey: input.siteSnapshotKey,
      siteVersionId: input.siteVersionId,
    })),
    ...buildTraceGatewayRoutes(),
  ];

  if (trimmedValue(input.appUpstreamUrl) !== undefined) {
    routes.push(buildAppRoute({ appUpstreamUrl }));
  }

  if (hasOsConnectorInput(input)) {
    const connectorId = trimmedValue(input.connectorId);
    const tunnelOriginUrl = trimmedValue(input.tunnelOriginUrl);

    if (connectorId !== undefined && tunnelOriginUrl !== undefined) {
      routes.push(
        ...buildOsRoutes({
          connectorId,
          tunnelOriginUrl,
        }),
      );
    }
  }

  return {
    workspaceId,
    workspaceSlug: normalizeWorkspaceSlug(workspaceSlug),
    hostname: normalizeHostname(hostname),
    baseDomain: normalizeBaseDomain(baseDomain),
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
  `INSERT OR REPLACE INTO workspace_connectors (` +
  [
    'connector_id',
    'workspace_id',
    'workspace_host',
    'transport',
    'local_service_url',
    'connector_status',
    'created_at',
    'updated_at',
  ].join(', ') +
  `) VALUES (` +
  [
    sqlText(input.connectorTarget.connectorId),
    sqlText(input.record.workspaceId),
    sqlText(input.record.hostname),
    sqlText('cloudflare-tunnel'),
    sqlText(input.localServiceUrl),
    sqlText(input.connectorTarget.connectorStatus),
    "datetime('now')",
    "datetime('now')",
  ].join(', ') +
  `);`;

const createRouteSql = (input: {
  record: WorkspaceEdgeSeedRecord;
  primaryRoute: WorkspaceRouteD1Route;
  connectorTarget: Extract<WorkspaceRouteD1RouteTarget, { kind: 'os-connector' }> | null;
}): string =>
  `INSERT OR REPLACE INTO workspace_route_registry (` +
  [
    'hostname',
    'workspace_id',
    'workspace_slug',
    'workspace_host',
    'base_domain',
    'route_path_prefix',
    'route_surface',
    'route_status',
    'route_target_kind',
    'target_origin_url',
    'connector_id',
    'connector_status',
    'record_json',
    'created_at',
    'updated_at',
  ].join(', ') +
  `) VALUES (` +
  [
    sqlText(input.record.hostname),
    sqlText(input.record.workspaceId),
    sqlText(input.record.workspaceSlug),
    sqlText(input.record.hostname),
    sqlText(input.record.baseDomain),
    sqlText(input.primaryRoute.pathPrefix),
    sqlText(input.primaryRoute.surface),
    sqlText(input.primaryRoute.status),
    sqlText(input.primaryRoute.target.kind),
    sqlText(getTargetOriginUrl(input.primaryRoute.target)),
    sqlNullableText(input.connectorTarget?.connectorId ?? null),
    sqlNullableText(input.connectorTarget?.connectorStatus ?? null),
    sqlText(JSON.stringify(input.record)),
    "datetime('now')",
    "datetime('now')",
  ].join(', ') +
  `);`;

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
        localServiceUrl: trimmedOrDefault(input.localServiceUrl, DEFAULT_LOCAL_SERVICE_URL),
      }),
    );
  }

  statements.push(createRouteSql({ record, primaryRoute, connectorTarget }));

  return statements.join('\n\n');
};
