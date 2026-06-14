import { createHmac } from 'node:crypto';

export type WorkspaceCloudflareEdgeRouteTarget =
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
      contentType?: string;
      cachePolicy:
        | 'static-shell'
        | 'versioned-asset'
        | 'mutable-artifact'
        | 'private-preview';
    };

export type WorkspaceSitesEdgeCache = {
  match: (request: Request) => Promise<Response | null>;
  put: (request: Request, response: Response) => Promise<void>;
};

export type WorkspaceSitesEdgeR2Object = {
  text: () => Promise<string>;
};

export type WorkspaceSitesEdgeR2Bucket = {
  get: (key: string) => Promise<WorkspaceSitesEdgeR2Object | null>;
};

export type WorkspaceSitesSnapshotStore = {
  cache?: WorkspaceSitesEdgeCache;
  r2?: WorkspaceSitesEdgeR2Bucket;
};

export type WorkspaceCloudflareEdgeRouteResolution =
  | {
      allowed: true;
      workspaceId: string;
      hostname: string;
      route: string;
      surface: 'os' | 'dialer' | 'app' | 'sites' | 'twenty';
      auth: 'public' | 'required' | 'workspace-session' | 'signed-connector';
      auditEvent: 'workspace.hostname.route.allowed';
      target: WorkspaceCloudflareEdgeRouteTarget;
    }
  | {
      allowed: false;
      status: 404 | 503;
      errorCode: string;
      auditEvent: 'workspace.hostname.route.denied';
    };

export type WorkspaceCloudflareEdgeRouteRegistry = {
  resolve: (input: {
    host: string;
    path: string;
    method: string;
  }) => Promise<WorkspaceCloudflareEdgeRouteResolution>;
};

export type WorkspaceCloudflareEdgeRouter = {
  fetch: (request: Request) => Promise<Response>;
};

export type WorkspaceCloudflareEdgeRouterInput = {
  registry: WorkspaceCloudflareEdgeRouteRegistry;
  internalSigningSecret?: string;
  fetchUpstream?: (request: Request) => Promise<Response>;
  siteSnapshots?: WorkspaceSitesSnapshotStore;
  workspaceBaseDomains?: string[];
  reservedHostnames?: string[];
};

const SAFE_ERROR_MESSAGES: Record<string, string> = {
  WORKSPACE_HOSTNAME_NOT_FOUND: 'Workspace hostname was not found',
  WORKSPACE_HOSTNAME_ROUTE_NOT_FOUND: 'Workspace route was not found',
  WORKSPACE_HOSTNAME_RESERVED: 'Workspace hostname is protected',
  WORKSPACE_HOSTNAME_OS_CONNECTOR_OFFLINE:
    'Workspace route is temporarily unavailable',
  WORKSPACE_EDGE_ROUTER_ERROR: 'Workspace route is temporarily unavailable',
  WORKSPACE_EDGE_AUTH_REQUIRED: 'Workspace route is temporarily unavailable',
  WORKSPACE_SITE_SNAPSHOT_UNAVAILABLE:
    'Workspace route is temporarily unavailable',
};

const SITE_SNAPSHOT_CACHE_AUTHORITY = 'sites-snapshot';
const DEFAULT_WORKSPACE_BASE_DOMAINS = ['consuelohq.com'];
const DEFAULT_RESERVED_HOSTNAMES = [
  'app.consuelohq.com',
  'docs.consuelohq.com',
  'diffs.consuelohq.com',
  'install.consuelohq.com',
  'linear.consuelohq.com',
  'api.consuelohq.com',
  'www.consuelohq.com',
  'sites.consuelohq.com',
];

const normalizeHostname = (host: string): string => host.trim().toLowerCase().replace(/\.$/, '');

const normalizeHostnameList = (values: readonly string[] | undefined, defaults: readonly string[]): string[] =>
  (values && values.length > 0 ? values : defaults).map(normalizeHostname);

const isReservedWorkspaceHostname = (host: string, reservedHostnames?: string[]): boolean =>
  normalizeHostnameList(reservedHostnames, DEFAULT_RESERVED_HOSTNAMES).includes(normalizeHostname(host));

const isWorkspaceBaseDomainHost = (host: string, workspaceBaseDomains?: string[]): boolean => {
  const hostname = normalizeHostname(host);
  return normalizeHostnameList(workspaceBaseDomains, DEFAULT_WORKSPACE_BASE_DOMAINS).some((domain) =>
    hostname.endsWith('.' + domain) && hostname !== domain,
  );
};

const createSafeErrorResponse = (input: {
  status: 404 | 503;
  code: string;
}): Response => {
  const message = SAFE_ERROR_MESSAGES[input.code] ?? 'Workspace route denied';

  return Response.json(
    {
      error: {
        code: input.code,
        message,
      },
    },
    {
      status: input.status,
      headers: {
        'cache-control': 'no-store',
      },
    },
  );
};

const buildUpstreamUrl = (input: {
  upstreamBaseUrl: string;
  inboundUrl: URL;
}): string => {
  const upstreamUrl = new URL(input.upstreamBaseUrl);
  const basePath = upstreamUrl.pathname.replace(/\/$/, '');
  upstreamUrl.pathname = `${basePath}${input.inboundUrl.pathname}`;
  upstreamUrl.search = input.inboundUrl.search;

  return upstreamUrl.toString();
};

const signEdgeRequest = (input: {
  secret: string;
  method: string;
  pathWithSearch: string;
  workspaceId: string;
  surface: string;
}): string => {
  const canonical = [
    input.method.toUpperCase(),
    input.pathWithSearch,
    input.workspaceId,
    input.surface,
  ].join('\n');

  return `sha256=${createHmac('sha256', input.secret)
    .update(canonical)
    .digest('hex')}`;
};

const buildProxyRequest = (input: {
  request: Request;
  resolution: Extract<WorkspaceCloudflareEdgeRouteResolution, { allowed: true }>;
  upstreamUrl: string;
  internalSigningSecret: string;
}): Request => {
  const inboundUrl = new URL(input.request.url);
  const headers = new Headers(input.request.headers);
  headers.delete('x-consuelo-workspace-id');
  headers.delete('x-consuelo-hostname');
  headers.delete('x-consuelo-route');
  headers.delete('x-consuelo-surface');
  headers.delete('x-consuelo-edge-signature');
  headers.delete('x-consuelo-connector-id');

  headers.set('x-consuelo-workspace-id', input.resolution.workspaceId);
  headers.set('x-consuelo-hostname', input.resolution.hostname);
  headers.set('x-consuelo-route', input.resolution.route);
  headers.set('x-consuelo-surface', input.resolution.surface);

  if (input.resolution.target.kind === 'os-connector') {
    headers.set('x-consuelo-connector-id', input.resolution.target.connectorId);
  }

  headers.set(
    'x-consuelo-edge-signature',
    signEdgeRequest({
      secret: input.internalSigningSecret,
      method: input.request.method,
      pathWithSearch: `${inboundUrl.pathname}${inboundUrl.search}`,
      workspaceId: input.resolution.workspaceId,
      surface: input.resolution.surface,
    }),
  );

  const init: RequestInit & { duplex?: 'half' } = {
    headers,
    method: input.request.method,
  };

  if (input.request.method !== 'GET' && input.request.method !== 'HEAD') {
    init.body = input.request.body;
    init.duplex = 'half';
  }

  return new Request(input.upstreamUrl, init);
};

const createSiteSnapshotCacheKey = (request: Request): Request => {
  const url = new URL(request.url);
  url.search = '';
  return new Request(url.toString(), { method: 'GET' });
};

const getDefaultSiteCache = (): WorkspaceSitesEdgeCache | undefined => {
  const maybeCaches = globalThis.caches as
    | (CacheStorage & { default?: WorkspaceSitesEdgeCache })
    | undefined;
  return maybeCaches?.default;
};

const siteSnapshotCacheControl = (
  policy: Extract<
    WorkspaceCloudflareEdgeRouteTarget,
    { kind: 'site-snapshot' }
  >['cachePolicy'],
): string => {
  if (policy === 'versioned-asset') {
    return 'public, max-age=31536000, immutable';
  }
  if (policy === 'mutable-artifact') {
    return 'public, max-age=60, s-maxage=300, stale-while-revalidate=86400, stale-if-error=86400';
  }
  if (policy === 'private-preview') return 'no-store';
  return 'public, max-age=60, s-maxage=2592000, stale-while-revalidate=604800, stale-if-error=604800';
};

const withSiteSnapshotCacheState = (
  response: Response,
  state: 'hit' | 'miss',
): Response => {
  const headers = new Headers(response.headers);
  headers.set('x-consuelo-sites-cache', state);
  return new Response(response.clone().body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
};

const readCachedSiteSnapshot = async (input: {
  request: Request;
  cache?: WorkspaceSitesEdgeCache;
}): Promise<Response | null> => {
  try {
    if (input.request.method !== 'GET' && input.request.method !== 'HEAD') {
      return null;
    }
    const cached = await input.cache?.match(createSiteSnapshotCacheKey(input.request));
    if (
      cached?.headers.get('x-consuelo-edge-cache-authority') !==
      SITE_SNAPSHOT_CACHE_AUTHORITY
    ) {
      return null;
    }
    return withSiteSnapshotCacheState(cached, 'hit');
  } catch {
    return null;
  }
};

const readSiteSnapshotHtml = async (input: {
  store?: WorkspaceSitesSnapshotStore;
  target: Extract<WorkspaceCloudflareEdgeRouteTarget, { kind: 'site-snapshot' }>;
}): Promise<string | null> => {
  try {
    const keys = [input.target.htmlKey, input.target.manifestKey].filter(
      (key): key is string => typeof key === 'string' && key.length > 0,
    );
    for (const key of keys) {
      const object = await input.store?.r2?.get(key);
      if (object) return await object.text();
    }
    return null;
  } catch {
    return null;
  }
};

const createSiteSnapshotResponse = (input: {
  html: string;
  target: Extract<WorkspaceCloudflareEdgeRouteTarget, { kind: 'site-snapshot' }>;
}): Response =>
  new Response(input.html, {
    status: 200,
    headers: {
      'cache-control': siteSnapshotCacheControl(input.target.cachePolicy),
      'content-type': input.target.contentType ?? 'text/html; charset=utf-8',
      'x-consuelo-edge-cache-authority': SITE_SNAPSHOT_CACHE_AUTHORITY,
      'x-consuelo-site-version': input.target.versionId,
    },
  });

const serveSiteSnapshot = async (input: {
  request: Request;
  resolution: Extract<WorkspaceCloudflareEdgeRouteResolution, { allowed: true }> & {
    target: Extract<WorkspaceCloudflareEdgeRouteTarget, { kind: 'site-snapshot' }>;
  };
  store?: WorkspaceSitesSnapshotStore;
}): Promise<Response> => {
  try {
    if (input.request.method !== 'GET' && input.request.method !== 'HEAD') {
      return createSafeErrorResponse({
        status: 404,
        code: 'WORKSPACE_HOSTNAME_ROUTE_NOT_FOUND',
      });
    }

    const cache = input.store?.cache ?? getDefaultSiteCache();
    const cached = await readCachedSiteSnapshot({ request: input.request, cache });
    if (cached) return cached;

    const html = await readSiteSnapshotHtml({
      store: input.store,
      target: input.resolution.target,
    });
    if (!html) {
      return createSafeErrorResponse({
        status: 503,
        code: 'WORKSPACE_SITE_SNAPSHOT_UNAVAILABLE',
      });
    }

    const response = createSiteSnapshotResponse({
      html,
      target: input.resolution.target,
    });
    await cache
      ?.put(createSiteSnapshotCacheKey(input.request), response.clone())
      .catch(() => undefined);
    return withSiteSnapshotCacheState(response, 'miss');
  } catch {
    return createSafeErrorResponse({
      status: 503,
      code: 'WORKSPACE_SITE_SNAPSHOT_UNAVAILABLE',
    });
  }
};

export const createWorkspaceCloudflareEdgeRouter = (
  input: WorkspaceCloudflareEdgeRouterInput,
): WorkspaceCloudflareEdgeRouter => {
  const fetchUpstream = input.fetchUpstream ?? globalThis.fetch;
  return {
    async fetch(request: Request): Promise<Response> {
      try {
        const inboundUrl = new URL(request.url);
        if (isReservedWorkspaceHostname(inboundUrl.hostname, input.reservedHostnames)) {
          return createSafeErrorResponse({
            status: 404,
            code: 'WORKSPACE_HOSTNAME_RESERVED',
          });
        }
        if (inboundUrl.pathname === '/' && isWorkspaceBaseDomainHost(inboundUrl.hostname, input.workspaceBaseDomains)) {
          const cachedSiteSnapshot = await readCachedSiteSnapshot({
            request,
            cache: input.siteSnapshots?.cache ?? getDefaultSiteCache(),
          });
          if (cachedSiteSnapshot) return cachedSiteSnapshot;
        }

        const resolution = await input.registry.resolve({
          host: inboundUrl.hostname,
          path: inboundUrl.pathname,
          method: request.method,
        });

        if (!resolution.allowed) {
          return createSafeErrorResponse({
            status: resolution.status,
            code: resolution.errorCode,
          });
        }

        if (resolution.target.kind === 'site-snapshot') {
          if (resolution.auth !== 'public') {
            return createSafeErrorResponse({
              status: 503,
              code: 'WORKSPACE_EDGE_AUTH_REQUIRED',
            });
          }
          return await serveSiteSnapshot({
            request,
            resolution: resolution as Extract<
              WorkspaceCloudflareEdgeRouteResolution,
              { allowed: true }
            > & {
              target: Extract<
                WorkspaceCloudflareEdgeRouteTarget,
                { kind: 'site-snapshot' }
              >;
            },
            store: input.siteSnapshots,
          });
        }

        if (
          resolution.target.kind === 'os-connector' &&
          resolution.target.connectorStatus !== 'connected'
        ) {
          return createSafeErrorResponse({
            status: 503,
            code: 'WORKSPACE_HOSTNAME_OS_CONNECTOR_OFFLINE',
          });
        }

        const internalSigningSecret = input.internalSigningSecret?.trim();

        if (!internalSigningSecret) {
          return createSafeErrorResponse({
            status: 503,
            code: 'WORKSPACE_EDGE_AUTH_REQUIRED',
          });
        }

        const upstreamBaseUrl =
          resolution.target.kind === 'service-upstream'
            ? resolution.target.upstreamUrl
            : resolution.target.tunnelOriginUrl;
        const upstreamUrl = buildUpstreamUrl({ upstreamBaseUrl, inboundUrl });
        const proxyRequest = buildProxyRequest({
          request,
          resolution,
          upstreamUrl,
          internalSigningSecret,
        });

        return await fetchUpstream(proxyRequest);
      } catch (error: unknown) {
        return createSafeErrorResponse({
          status: 503,
          code: 'WORKSPACE_EDGE_ROUTER_ERROR',
        });
      }
    },
  };
};





