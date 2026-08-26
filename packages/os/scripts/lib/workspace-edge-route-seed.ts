import type {
  WorkspaceRouteD1RecordInput,
  WorkspaceRouteD1Route,
  WorkspaceRouteD1RouteTarget,
} from './workspace-cloudflare-d1-route-registry';

export type WorkspaceEdgeRouteSeedInput = {
  workspaceId: string;
  workspaceSlug: string;
  hostname: string;
  baseDomain: string;
  siteSnapshotKey?: string;
  siteVersionId?: string;
  publishedSiteIds?: WorkspaceSiteSnapshotId[];
  siteContentHashes?: Partial<Record<WorkspaceSiteSnapshotId, string>>;
  appUpstreamUrl?: string;
  connectorId?: string;
  tunnelOriginUrl?: string;
  localServiceUrl?: string;
  preserveExistingConnectorState?: boolean;
};

type WorkspaceEdgeSeedRecord = WorkspaceRouteD1RecordInput & {
  updatedAt: string;
};

const DEFAULT_APP_UPSTREAM_URL = 'https://app.consuelohq.com';
const DEFAULT_LOCAL_SERVICE_URL = 'http://127.0.0.1:8787';
export const WORKSPACE_SITE_SNAPSHOT_IDS = [
  'launcher',
  'artifacts',
  'traces',
  'diffs',
  'docs',
  'configuration',
  'tools',
  'nodes',
  'environments',
  'secrets',
] as const;
export type WorkspaceSiteSnapshotId =
  (typeof WORKSPACE_SITE_SNAPSHOT_IDS)[number];

export const WORKSPACE_RELEASE_MANAGED_SITE_SNAPSHOT_IDS = [
  'launcher',
  'traces',
  'configuration',
  'tools',
  'nodes',
  'environments',
  'secrets',
] as const satisfies readonly WorkspaceSiteSnapshotId[];

const WORKSPACE_PRIVATE_SITE_SNAPSHOT_IDS = new Set<WorkspaceSiteSnapshotId>(
  WORKSPACE_RELEASE_MANAGED_SITE_SNAPSHOT_IDS,
);

export const workspaceSiteSnapshotRequiresSession = (
  siteId: WorkspaceSiteSnapshotId,
): boolean => WORKSPACE_PRIVATE_SITE_SNAPSHOT_IDS.has(siteId);

const DEFAULT_SITE_ID: WorkspaceSiteSnapshotId = 'launcher';
const DEFAULT_SITE_VERSION_ID = 'seeded-workspace-site-shell';
const DEFAULT_SITE_CONTENT_TYPE = 'text/html; charset=utf-8';
const SITE_SNAPSHOT_ROUTES: ReadonlyArray<{
  pathPrefix: string;
  siteId: WorkspaceSiteSnapshotId;
}> = [
  { pathPrefix: '/', siteId: 'launcher' },
  { pathPrefix: '/artifacts', siteId: 'artifacts' },
  { pathPrefix: '/observability', siteId: 'traces' },
  { pathPrefix: '/observability/traces', siteId: 'traces' },
  { pathPrefix: '/traces', siteId: 'traces' },
  { pathPrefix: '/tracing', siteId: 'traces' },
  { pathPrefix: '/trace-burn-intelligence', siteId: 'traces' },
  { pathPrefix: '/docs', siteId: 'docs' },
  { pathPrefix: '/configuration', siteId: 'configuration' },
  { pathPrefix: '/tools', siteId: 'tools' },
  { pathPrefix: '/nodes', siteId: 'nodes' },
  { pathPrefix: '/environments', siteId: 'environments' },
  { pathPrefix: '/secrets', siteId: 'secrets' },
] as const;
type SiteSnapshotRoute = typeof SITE_SNAPSHOT_ROUTES[number];
const WORKSPACE_SITE_SNAPSHOT_ID_SET = new Set<string>(
  WORKSPACE_SITE_SNAPSHOT_IDS,
);

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

const requiredWorkspaceIdentityValue = (
  value: string | undefined,
  field: 'workspaceId' | 'workspaceSlug' | 'hostname' | 'baseDomain',
): string => {
  const normalized = trimmedValue(value);
  if (!normalized) {
    throw new Error(
      `workspace edge seed requires explicit workspace identity: ${field}`,
    );
  }
  return normalized;
};

const hasOsConnectorInput = (
  input: WorkspaceEdgeRouteSeedInput,
): boolean =>
  trimmedValue(input.connectorId) !== undefined &&
  trimmedValue(input.tunnelOriginUrl) !== undefined;

const resolvePublishedSiteIds = (
  publishedSiteIds: WorkspaceEdgeRouteSeedInput['publishedSiteIds'],
): Set<WorkspaceSiteSnapshotId> => {
  if (publishedSiteIds === undefined) {
    return new Set([DEFAULT_SITE_ID]);
  }
  if (publishedSiteIds.length === 0) {
    throw new Error('workspace edge seed requires a published launcher snapshot');
  }

  const normalized = new Set<WorkspaceSiteSnapshotId>();
  for (const siteId of publishedSiteIds) {
    if (!WORKSPACE_SITE_SNAPSHOT_ID_SET.has(siteId)) {
      throw new Error(`workspace edge seed received unknown Site snapshot: ${siteId}`);
    }
    normalized.add(siteId);
  }
  if (!normalized.has(DEFAULT_SITE_ID)) {
    throw new Error('workspace edge seed requires a published launcher snapshot');
  }
  return normalized;
};
const escapeSqlText = (value: string): string => value.replace(/'/g, "''");

const sqlText = (value: string): string => `'${escapeSqlText(value)}'`;

const sqlNullableText = (value: string | null): string =>
  value === null ? 'NULL' : sqlText(value);

const siteVersionFromSnapshotKey = (siteSnapshotKey: string | undefined): string | undefined => {
  const match = trimmedValue(siteSnapshotKey)?.match(/^sites\/[^/]+\/[^/]+\/([^/]+)\/index\.html$/);
  return match?.[1];
};

const normalizedContentHash = (contentHash: string | undefined): string | undefined => {
  const normalized = trimmedValue(contentHash)?.toLowerCase();
  if (normalized !== undefined && !/^[a-f0-9]{64}$/.test(normalized)) {
    throw new Error('workspace edge seed received invalid site snapshot content hash');
  }
  return normalized;
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
  contentHash?: string;
  published: boolean;
}): WorkspaceRouteD1Route => {
  const isLauncher = input.pathPrefix === '/' && input.siteId === 'launcher';
  const requiresWorkspaceSession = workspaceSiteSnapshotRequiresSession(
    input.siteId,
  );
  return {
    surface: 'sites',
    pathPrefix: input.pathPrefix,
    auth: requiresWorkspaceSession ? 'workspace-session' : 'public',
    status: input.published ? 'active' : 'disabled',
    target: {
      kind: 'site-snapshot',
      siteId: input.siteId,
      versionId: trimmedValue(input.siteVersionId) ?? siteVersionFromSnapshotKey(input.siteSnapshotKey) ?? DEFAULT_SITE_VERSION_ID,
      manifestKey: siteManifestKey({
        workspaceId: input.workspaceId,
        siteId: input.siteId,
        siteSnapshotKey: input?.siteSnapshotKey,
        siteVersionId: input?.siteVersionId,
      }),
      ...(normalizedContentHash(input.contentHash)
        ? { contentHash: normalizedContentHash(input.contentHash) }
        : {}),
      contentType: DEFAULT_SITE_CONTENT_TYPE,
      cachePolicy: isLauncher ? 'private-preview' : 'static-shell',
    },
  };
};

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
}): WorkspaceRouteD1Route[] => {
  const target: Extract<WorkspaceRouteD1RouteTarget, { kind: 'os-connector' }> = {
    kind: 'os-connector',
    connectorId: input.connectorId,
    connectorStatus: 'connected',
    tunnelOriginUrl: input.tunnelOriginUrl,
  };
  return [
    {
      surface: 'os',
      pathPrefix: '/gtm',
      auth: 'workspace-session',
      status: 'active',
      target,
    },
    {
      surface: 'os',
      pathPrefix: '/mcp',
      auth: 'required',
      status: 'active',
      target,
    },
  ];
};

const buildTraceGatewayRoutes = (): WorkspaceRouteD1Route[] => [
  {
    surface: 'sites',
    pathPrefix: '/gateway/traces/events',
    auth: 'workspace-session',
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
    auth: 'workspace-session',
    status: 'active',
    target: {
      kind: 'consuelo-gateway-service',
      serviceName: 'trace-sites-read-layer',
      gatewayRouteFamily: '/gateway/traces/*',
      publicSiteRouteFamily: '/observability/*',
    },
  },
];

const buildConfigurationGatewayRoutes = (): WorkspaceRouteD1Route[] => [
  {
    surface: 'sites',
    pathPrefix: '/gateway/configuration/source-control/github',
    auth: 'workspace-session',
    status: 'active',
    target: {
      kind: 'consuelo-gateway-service',
      serviceName: 'configuration-sites-write-endpoints',
      gatewayRouteFamily: '/gateway/configuration/*',
      publicSiteRouteFamily: '/configuration/*',
    },
  },
  {
    surface: 'sites',
    pathPrefix: '/gateway/configuration/overlay',
    auth: 'workspace-session',
    status: 'active',
    target: {
      kind: 'consuelo-gateway-service',
      serviceName: 'configuration-sites-write-endpoints',
      gatewayRouteFamily: '/gateway/configuration/*',
      publicSiteRouteFamily: '/configuration/*',
    },
  },
  {
    surface: 'sites',
    pathPrefix: '/gateway/configuration',
    auth: 'workspace-session',
    status: 'active',
    target: {
      kind: 'consuelo-gateway-service',
      serviceName: 'configuration-sites-read-endpoints',
      gatewayRouteFamily: '/gateway/configuration/*',
      publicSiteRouteFamily: '/configuration/*',
    },
  },
  {
    surface: 'sites',
    pathPrefix: '/gateway/settings/overlay',
    auth: 'workspace-session',
    status: 'active',
    target: {
      kind: 'consuelo-gateway-service',
      serviceName: 'configuration-sites-write-endpoints',
      gatewayRouteFamily: '/gateway/settings/*',
      publicSiteRouteFamily: '/settings/*',
    },
  },
  {
    surface: 'sites',
    pathPrefix: '/gateway/settings',
    auth: 'workspace-session',
    status: 'active',
    target: {
      kind: 'consuelo-gateway-service',
      serviceName: 'configuration-sites-read-endpoints',
      gatewayRouteFamily: '/gateway/settings/*',
      publicSiteRouteFamily: '/settings/*',
    },
  },
];

const buildEnvironmentGatewayRoutes = (): WorkspaceRouteD1Route[] => [
  {
    surface: 'sites',
    pathPrefix: '/gateway/environments/upsert',
    auth: 'workspace-session',
    status: 'active',
    target: {
      kind: 'consuelo-gateway-service',
      serviceName: 'environment-sites-write-endpoints',
      gatewayRouteFamily: '/gateway/environments/*',
      publicSiteRouteFamily: '/environments/*',
    },
  },
  {
    surface: 'sites',
    pathPrefix: '/gateway/environments/delete',
    auth: 'workspace-session',
    status: 'active',
    target: {
      kind: 'consuelo-gateway-service',
      serviceName: 'environment-sites-write-endpoints',
      gatewayRouteFamily: '/gateway/environments/*',
      publicSiteRouteFamily: '/environments/*',
    },
  },
  {
    surface: 'sites',
    pathPrefix: '/gateway/environments',
    auth: 'workspace-session',
    status: 'active',
    target: {
      kind: 'consuelo-gateway-service',
      serviceName: 'environment-sites-read-endpoints',
      gatewayRouteFamily: '/gateway/environments/*',
      publicSiteRouteFamily: '/environments/*',
    },
  },
];

const buildSecretGatewayRoutes = (): WorkspaceRouteD1Route[] => [
  {
    surface: 'sites',
    pathPrefix: '/gateway/secrets/install',
    auth: 'workspace-session',
    status: 'active',
    target: {
      kind: 'consuelo-gateway-service',
      serviceName: 'secrets-sites-write-endpoints',
      gatewayRouteFamily: '/gateway/secrets/*',
      publicSiteRouteFamily: '/secrets/*',
    },
  },
  {
    surface: 'sites',
    pathPrefix: '/gateway/secrets',
    auth: 'workspace-session',
    status: 'active',
    target: {
      kind: 'consuelo-gateway-service',
      serviceName: 'secrets-sites-read-endpoints',
      gatewayRouteFamily: '/gateway/secrets/*',
      publicSiteRouteFamily: '/secrets/*',
    },
  },
];

const buildArtifactsGatewayRoutes = (): WorkspaceRouteD1Route[] => [
  {
    surface: 'sites',
    pathPrefix: '/gateway/artifacts',
    auth: 'workspace-session',
    status: 'active',
    target: {
      kind: 'consuelo-gateway-service',
      serviceName: 'artifacts-sites-read-layer',
      gatewayRouteFamily: '/gateway/artifacts/*',
      publicSiteRouteFamily: '/artifacts/*',
    },
  },
];

const buildDiffsGatewayRoutes = (): WorkspaceRouteD1Route[] => [
  {
    surface: 'sites',
    pathPrefix: '/gateway/diffs/write',
    auth: 'workspace-session',
    status: 'active',
    target: {
      kind: 'consuelo-gateway-service',
      serviceName: 'diffs-sites-write-endpoints',
      gatewayRouteFamily: '/gateway/diffs/*',
      publicSiteRouteFamily: '/diffs/*',
    },
  },
  {
    surface: 'sites',
    pathPrefix: '/gateway/diffs',
    auth: 'workspace-session',
    status: 'active',
    target: {
      kind: 'consuelo-gateway-service',
      serviceName: 'diffs-sites-read-endpoints',
      gatewayRouteFamily: '/gateway/diffs/*',
      publicSiteRouteFamily: '/diffs/*',
    },
  },
  {
    surface: 'sites',
    pathPrefix: '/diffs',
    auth: 'workspace-session',
    status: 'active',
    target: {
      kind: 'consuelo-gateway-service',
      serviceName: 'diffs-sites-read-endpoints',
      gatewayRouteFamily: '/gateway/diffs/*',
      publicSiteRouteFamily: '/diffs/*',
    },
  },
];

const buildLegacyConfigurationRedirectRoutes = (): WorkspaceRouteD1Route[] => [
  {
    surface: 'sites',
    pathPrefix: '/settings',
    auth: 'public',
    status: 'active',
    target: { kind: 'redirect', location: '/configuration', statusCode: 308 },
  },
];

const buildLegacyArtifactRedirectRoutes = (): WorkspaceRouteD1Route[] => [
  {
    surface: 'sites',
    pathPrefix: '/office',
    auth: 'public',
    status: 'active',
    target: { kind: 'redirect', location: '/artifacts', statusCode: 308 },
  },
  {
    surface: 'sites',
    pathPrefix: '/design-wiki',
    auth: 'public',
    status: 'active',
    target: { kind: 'redirect', location: '/artifacts', statusCode: 308 },
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
  if (target.kind === 'redirect') return `redirect://${target.location}`;
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
  input: WorkspaceEdgeRouteSeedInput,
): WorkspaceEdgeSeedRecord => {
  const workspaceId = requiredWorkspaceIdentityValue(input?.workspaceId, 'workspaceId');
  const workspaceSlug = requiredWorkspaceIdentityValue(input?.workspaceSlug, 'workspaceSlug');
  const hostname = requiredWorkspaceIdentityValue(input?.hostname, 'hostname');
  const baseDomain = requiredWorkspaceIdentityValue(input?.baseDomain, 'baseDomain');
  const appUpstreamUrl = trimmedOrDefault(input?.appUpstreamUrl, DEFAULT_APP_UPSTREAM_URL);
  const connectorId = trimmedValue(input?.connectorId);
  const tunnelOriginUrl = trimmedValue(input?.tunnelOriginUrl);
  const publishedSiteIds = resolvePublishedSiteIds(input?.publishedSiteIds);
  const osRoutes =
    hasOsConnectorInput(input) && connectorId !== undefined && tunnelOriginUrl !== undefined
      ? buildOsRoutes({ connectorId, tunnelOriginUrl })
      : [];
  const routes: WorkspaceRouteD1Route[] = [
    ...osRoutes,
    ...SITE_SNAPSHOT_ROUTES.map((route) => buildSiteSnapshotRoute({
      ...route,
      workspaceId,
      siteSnapshotKey: input?.siteSnapshotKey,
      siteVersionId: input?.siteVersionId,
      contentHash: input?.siteContentHashes?.[route.siteId],
      published: publishedSiteIds.has(route.siteId),
    })),
    ...buildLegacyConfigurationRedirectRoutes(),
    ...buildTraceGatewayRoutes(),
    ...buildConfigurationGatewayRoutes(),
    ...buildEnvironmentGatewayRoutes(),
    ...buildSecretGatewayRoutes(),
    ...buildArtifactsGatewayRoutes(),
    ...buildDiffsGatewayRoutes(),
    ...buildLegacyArtifactRedirectRoutes(),
  ];

  if (trimmedValue(input?.appUpstreamUrl) !== undefined) {
    routes.push(buildAppRoute({ appUpstreamUrl }));
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
export const createWorkspaceReleaseManagedSiteRefreshSql = (input: {
  versionId: string;
  snapshotWorkspaceId: string;
  siteContentHashes: Record<string, string>;
}): string => {
  const versionId = trimmedValue(input.versionId);
  const snapshotWorkspaceId = trimmedValue(input.snapshotWorkspaceId);
  if (!versionId || !snapshotWorkspaceId) {
    throw new Error('workspace release site refresh requires snapshot workspace and version');
  }
  const contentHashes = Object.fromEntries(
    WORKSPACE_RELEASE_MANAGED_SITE_SNAPSHOT_IDS.map((siteId) => {
      const contentHash = normalizedContentHash(input.siteContentHashes[siteId]);
      if (!contentHash) {
        throw new Error(`workspace release site refresh requires content hash for ${siteId}`);
      }
      return [siteId, contentHash] as const;
    }),
  ) as Record<(typeof WORKSPACE_RELEASE_MANAGED_SITE_SNAPSHOT_IDS)[number], string>;
  const managedSiteIds = WORKSPACE_RELEASE_MANAGED_SITE_SNAPSHOT_IDS
    .map((siteId) => sqlText(siteId))
    .join(', ');
  const hashCase =
    `CASE json_extract(route.value, '$.target.siteId') `
    + WORKSPACE_RELEASE_MANAGED_SITE_SNAPSHOT_IDS
      .map((siteId) => `WHEN ${sqlText(siteId)} THEN ${sqlText(contentHashes[siteId])} `)
      .join('')
    + `ELSE json_extract(route.value, '$.target.contentHash') END`;
  const snapshotKey =
    `${sqlText('sites/' + snapshotWorkspaceId + '/')} || `
    + `json_extract(route.value, '$.target.siteId') || `
    + `${sqlText('/' + versionId + '/index.html')}`;
  const matchesManagedSite =
    `json_extract(route.value, '$.target.kind') = 'site-snapshot' `
    + `AND json_extract(route.value, '$.target.siteId') IN (${managedSiteIds})`;
  const refreshedRoute =
    `json_set(route.value, `
    + `'$.target.versionId', ${sqlText(versionId)}, `
    + `'$.target.manifestKey', ${snapshotKey}, `
    + `'$.target.htmlKey', ${snapshotKey}, `
    + `'$.target.contentHash', ${hashCase})`;
  const refreshedRoutes =
    `(SELECT json_group_array(json(CASE WHEN ${matchesManagedSite} `
    + `THEN ${refreshedRoute} ELSE route.value END)) `
    + `FROM json_each(workspace_route_registry.record_json, '$.routes') AS route)`;
  return (
    `UPDATE workspace_route_registry SET `
    + `record_json = json_set(record_json, '$.routes', json(${refreshedRoutes})), `
    + `updated_at = datetime('now') `
    + `WHERE revoked_at IS NULL AND json_valid(record_json) AND EXISTS (`
    + `SELECT 1 FROM json_each(workspace_route_registry.record_json, '$.routes') AS route `
    + `WHERE ${matchesManagedSite}`
    + `);`
  );
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
}): string => {
  const currentRecord = 'workspace_route_registry.record_json';
  const incomingRecord = 'excluded.record_json';
  const mergedRoutes = [
    '(SELECT json_group_array(json(value)) FROM (',
    `SELECT old_route.value AS value FROM json_each(${currentRecord}, '$.routes') AS old_route`,
    "WHERE json_extract(old_route.value, '$.target.kind') IN ('os-connector', 'service-upstream')",
    'AND NOT EXISTS (',
    `SELECT 1 FROM json_each(${incomingRecord}, '$.routes') AS new_route`,
    "WHERE json_extract(new_route.value, '$.surface') = json_extract(old_route.value, '$.surface')",
    "AND json_extract(new_route.value, '$.pathPrefix') = json_extract(old_route.value, '$.pathPrefix')",
    ')',
    'UNION ALL',
    `SELECT new_route.value AS value FROM json_each(${incomingRecord}, '$.routes') AS new_route`,
    '))',
  ].join(' ');
  const mergedRecord = [
    `json_set(${incomingRecord},`,
    "'$.defaultNodeId',",
    `COALESCE(json_extract(${incomingRecord}, '$.defaultNodeId'), json_extract(${currentRecord}, '$.defaultNodeId')),`,
    "'$.nodeTargets',",
    `json(COALESCE(json_extract(${incomingRecord}, '$.nodeTargets'), json_extract(${currentRecord}, '$.nodeTargets'), '[]')),`,
    "'$.routes',",
    `json(${mergedRoutes}))`,
  ].join(' ');

  return (
    `INSERT INTO workspace_route_registry (` +
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
    `) ON CONFLICT(hostname) DO UPDATE SET ` +
    [
      'workspace_id = excluded.workspace_id',
      'workspace_slug = excluded.workspace_slug',
      'workspace_host = excluded.workspace_host',
      'base_domain = excluded.base_domain',
      'route_path_prefix = excluded.route_path_prefix',
      'route_surface = excluded.route_surface',
      'route_status = excluded.route_status',
      'route_target_kind = excluded.route_target_kind',
      'target_origin_url = excluded.target_origin_url',
      'connector_id = COALESCE(excluded.connector_id, workspace_route_registry.connector_id)',
      'connector_status = COALESCE(excluded.connector_status, workspace_route_registry.connector_status)',
      `record_json = ${mergedRecord}`,
      "updated_at = datetime('now')",
    ].join(', ') +
    ` WHERE COALESCE(json_extract(${currentRecord}, '$.status'), 'active') <> 'revoked';`
  );
};

const createPreservingRouteSql = (input: {
  record: WorkspaceEdgeSeedRecord;
  primaryRoute: WorkspaceRouteD1Route;
  connectorTarget: Extract<WorkspaceRouteD1RouteTarget, { kind: 'os-connector' }> | null;
}): string => {
  const recordJson = sqlText(JSON.stringify(input.record));
  const hostname = sqlText(input.record.hostname);
  const mergedRoutes =
    `(SELECT json_group_array(json(route_json)) FROM (` +
    `SELECT incoming_route.value AS route_json ` +
    `FROM json_each(excluded.record_json, '$.routes') AS incoming_route ` +
    `UNION ALL ` +
    `SELECT existing_route.value AS route_json ` +
    `FROM json_each(workspace_route_registry.record_json, '$.routes') AS existing_route ` +
    `WHERE json_extract(existing_route.value, '$.target.kind') = 'os-connector' ` +
    `AND NOT EXISTS (` +
    `SELECT 1 FROM json_each(excluded.record_json, '$.routes') AS incoming_route ` +
    `WHERE json_extract(incoming_route.value, '$.surface') = json_extract(existing_route.value, '$.surface') ` +
    `AND json_extract(incoming_route.value, '$.pathPrefix') = json_extract(existing_route.value, '$.pathPrefix')` +
    `))` +
    `)`;
  const mergedRecord =
    `json_patch(` +
    `json_set(excluded.record_json, '$.routes', json(${mergedRoutes})), ` +
    `json_object(` +
    `'defaultNodeId', json_extract(workspace_route_registry.record_json, '$.defaultNodeId'), ` +
    `'nodeTargets', json(json_extract(workspace_route_registry.record_json, '$.nodeTargets'))` +
    `)` +
    `)`;

  return (
    `INSERT INTO workspace_route_registry (` +
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
      hostname,
      sqlText(input.record.workspaceId),
      sqlText(input.record.workspaceSlug),
      hostname,
      sqlText(input.record.baseDomain),
      sqlText(input.primaryRoute.pathPrefix),
      sqlText(input.primaryRoute.surface),
      sqlText(input.primaryRoute.status),
      sqlText(input.primaryRoute.target.kind),
      sqlText(getTargetOriginUrl(input.primaryRoute.target)),
      sqlNullableText(input.connectorTarget?.connectorId ?? null),
      sqlNullableText(input.connectorTarget?.connectorStatus ?? null),
      recordJson,
      "datetime('now')",
      "datetime('now')",
    ].join(', ') +
    `) ON CONFLICT(hostname) DO UPDATE SET ` +
    `workspace_id = excluded.workspace_id, ` +
    `workspace_slug = excluded.workspace_slug, ` +
    `workspace_host = excluded.workspace_host, ` +
    `base_domain = excluded.base_domain, ` +
    `route_path_prefix = excluded.route_path_prefix, ` +
    `route_surface = excluded.route_surface, ` +
    `route_status = excluded.route_status, ` +
    `route_target_kind = excluded.route_target_kind, ` +
    `target_origin_url = excluded.target_origin_url, ` +
    `connector_id = COALESCE(excluded.connector_id, workspace_route_registry.connector_id), ` +
    `connector_status = COALESCE(excluded.connector_status, workspace_route_registry.connector_status), ` +
    `record_json = CASE WHEN json_valid(workspace_route_registry.record_json) THEN ${mergedRecord} ELSE excluded.record_json END, ` +
    `revoked_at = NULL, ` +
    `updated_at = datetime('now');`
  );
};

export const createWorkspaceEdgeRouteSeedSql = (
  input: WorkspaceEdgeRouteSeedInput,
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

  statements.push(
    input.preserveExistingConnectorState
      ? createPreservingRouteSql({ record, primaryRoute, connectorTarget })
      : createRouteSql({ record, primaryRoute, connectorTarget }),
  );

  return statements.join('\n\n');
};
