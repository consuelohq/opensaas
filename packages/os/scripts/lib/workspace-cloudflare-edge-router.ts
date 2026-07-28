import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';

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
        | (string & {});
      gatewayRouteFamily: string;
      publicSiteRouteFamily: string;
    }
  | {
      kind: 'redirect';
      location: string;
      statusCode: 301 | 302 | 307 | 308;
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
      nodeId?: string;
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
    nodeId?: string;
    nowMs?: number;
    requireOnlineNode?: boolean;
  }) => Promise<WorkspaceCloudflareEdgeRouteResolution>;
};

export type WorkspaceCloudflareEdgeRouter = {
  fetch: (request: Request) => Promise<Response>;
};

export type WorkspaceCloudflareEdgeRouterInput = {
  registry: WorkspaceCloudflareEdgeRouteRegistry;
  internalSigningSecret?: string;
  fetchUpstream?: (request: Request) => Promise<Response>;
  authorizeWorkspaceSession?: (input: {
    request: Request;
    workspaceId: string;
    workspaceHost: string;
  }) => Promise<boolean>;
  siteSnapshots?: WorkspaceSitesSnapshotStore;
  workspaceBaseDomains?: string[];
  reservedHostnames?: string[];
  now?: () => number;
  createNonce?: () => string;
};

const EDGE_SIGNATURE_TIMESTAMP_HEADER = 'x-consuelo-edge-timestamp';
const EDGE_SIGNATURE_NONCE_HEADER = 'x-consuelo-edge-nonce';
const EDGE_SIGNATURE_MAX_AGE_MS = 5 * 60 * 1000;
const PLATFORM_SAFETY_MESSAGE = 'This workspace is protected by Consuelo platform safety.';
const SITE_SNAPSHOT_UNAVAILABLE_MESSAGE =
  'The workspace is connected, but this published page could not be loaded.';
const PLATFORM_SAFETY_HELP_URL = 'https://os.consuelohq.com/help/workspace-access';

const SAFE_ERROR_MESSAGES: Record<string, string> = {
  WORKSPACE_HOSTNAME_NOT_FOUND: PLATFORM_SAFETY_MESSAGE,
  WORKSPACE_HOSTNAME_ROUTE_NOT_FOUND: PLATFORM_SAFETY_MESSAGE,
  WORKSPACE_HOSTNAME_RESERVED: PLATFORM_SAFETY_MESSAGE,
  WORKSPACE_HOSTNAME_OS_CONNECTOR_OFFLINE:
    'The selected workspace node is currently unavailable.',
  WORKSPACE_NODE_OFFLINE:
    'The selected workspace node is currently unavailable.',
  WORKSPACE_EDGE_ROUTER_ERROR: PLATFORM_SAFETY_MESSAGE,
  WORKSPACE_EDGE_AUTH_REQUIRED: PLATFORM_SAFETY_MESSAGE,
  WORKSPACE_SITE_SNAPSHOT_UNAVAILABLE: SITE_SNAPSHOT_UNAVAILABLE_MESSAGE,
};

const SITE_SNAPSHOT_CACHE_AUTHORITY = 'sites-snapshot';
const DEFAULT_RESERVED_HOSTNAMES = [
  'app.consuelohq.com',
  'docs.consuelohq.com',
  'diffs.consuelohq.com',
  'install.consuelohq.com',
  'linear.consuelohq.com',
  'api.consuelohq.com',
  'www.consuelohq.com',
];

const normalizeHostname = (host: string): string => host.trim().toLowerCase().replace(/\.$/, '');

const normalizeHostnameList = (values: readonly string[] | undefined, defaults: readonly string[]): string[] =>
  (values && values.length > 0 ? values : defaults).map(normalizeHostname);

const isReservedWorkspaceHostname = (host: string, reservedHostnames?: string[]): boolean =>
  normalizeHostnameList(reservedHostnames, DEFAULT_RESERVED_HOSTNAMES).includes(normalizeHostname(host));

const requestIdFor = (request?: Request): string =>
  request?.headers.get('cf-ray')?.trim() || crypto.randomUUID();

const browserPrefersHtml = (request?: Request): boolean => {
  const accept = request?.headers.get('accept') ?? '';
  return accept.toLowerCase().includes('text/html');
};

const escapeHtml = (value: string): string =>
  value.replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[char] ?? char);

const createPlatformSafetyHtml = (input: {
  request: Request;
  code: string;
  message: string;
  requestId: string;
}): string => {
  const url = new URL(input.request.url);
  const visitorIp = input.request.headers.get('cf-connecting-ip')?.trim() || 'Unavailable';
  const now = new Date().toISOString();
  const snapshotUnavailable = input.code === 'WORKSPACE_SITE_SNAPSHOT_UNAVAILABLE';
  const pageTitle = snapshotUnavailable
    ? 'This workspace page is unavailable'
    : 'This workspace is protected';
  const eyebrow = snapshotUnavailable ? 'Service unavailable' : 'Platform safety';
  const guidance = snapshotUnavailable
    ? 'Try again shortly or contact the workspace owner with the request ID below.'
    : 'This hostname is protected by Consuelo platform safety. If this is your workspace, sign in to Consuelo or contact the workspace owner with the request ID below.';

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(pageTitle)}</title>
  <style>
    :root { color-scheme: light dark; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
    body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #050505; color: #f4f4f1; }
    main { width: min(760px, calc(100vw - 32px)); padding: 56px 0; }
    .card { border: 1px solid rgba(255,255,255,.14); border-radius: 28px; padding: clamp(28px, 6vw, 56px); background: linear-gradient(180deg, rgba(255,255,255,.08), rgba(255,255,255,.03)); box-shadow: 0 28px 90px rgba(0,0,0,.35); }
    .brand, .eyebrow { letter-spacing: .24em; text-transform: uppercase; color: #aaa; }
    h1 { font-size: clamp(42px, 8vw, 82px); line-height: 1; margin: 20px 0; }
    p { color: #c9c9c3; line-height: 1.65; }
    dl { display: grid; grid-template-columns: max-content 1fr; gap: 10px 18px; margin-top: 28px; }
    dt { color: #8c8c86; }
    dd { margin: 0; overflow-wrap: anywhere; }
    button { font: inherit; color: #f4f4f1; background: transparent; border: 1px solid rgba(255,255,255,.25); border-radius: 999px; padding: 4px 10px; cursor: pointer; }
  </style>
</head>
<body>
  <main>
    <section class="card">
      <div class="brand">consuelo.</div>
      <p class="eyebrow">${escapeHtml(eyebrow)}</p>
      <h1>${escapeHtml(pageTitle)}</h1>
      <p>${escapeHtml(input.message)}</p>
      <p>${escapeHtml(guidance)}</p>
      <dl>
        <dt>Error code</dt><dd>${escapeHtml(input.code)}</dd>
        <dt>Request ID</dt><dd>${escapeHtml(input.requestId)}</dd>
        <dt>Host</dt><dd>${escapeHtml(url.hostname)}</dd>
        <dt>Time</dt><dd>${escapeHtml(now)}</dd>
        <dt>Your IP</dt><dd><button type="button" data-ip="${escapeHtml(visitorIp)}" onclick="this.replaceWith(this.dataset.ip || 'Unavailable')">Click to reveal IP</button></dd>
      </dl>
    </section>
  </main>
</body>
</html>`;
};

const createSafeErrorResponse = (input: {
  status: 404 | 503;
  code: string;
  request?: Request;
}): Response => {
  const message = SAFE_ERROR_MESSAGES[input.code] ?? PLATFORM_SAFETY_MESSAGE;
  const requestId = requestIdFor(input.request);

  if (browserPrefersHtml(input.request) && input.request) {
    return new Response(createPlatformSafetyHtml({
      request: input.request,
      code: input.code,
      message,
      requestId,
    }), {
      status: input.status,
      headers: {
        'cache-control': 'no-store',
        'content-type': 'text/html; charset=utf-8',
        'x-consuelo-error-code': input.code,
        'x-consuelo-request-id': requestId,
      },
    });
  }

  return Response.json(
    {
      error: {
        code: input.code,
        message,
        request_id: requestId,
        help_url: PLATFORM_SAFETY_HELP_URL,
      },
    },
    {
      status: input.status,
      headers: {
        'cache-control': 'no-store',
        'x-consuelo-error-code': input.code,
        'x-consuelo-request-id': requestId,
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
  timestamp: string;
  nonce: string;
}): string => {
  const canonical = [
    input.method.toUpperCase(),
    input.pathWithSearch,
    input.workspaceId,
    input.surface,
    input.timestamp,
    input.nonce,
  ].join('\n');

  return `sha256=${createHmac('sha256', input.secret)
    .update(canonical)
    .digest('hex')}`;
};
const signatureMatches = (left: string, right: string): boolean => {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
};

const isSignedInternalEdgeRequest = (input: {
  request: Request;
  resolution: Extract<WorkspaceCloudflareEdgeRouteResolution, { allowed: true }>;
  internalSigningSecret: string;
  nowMs: number;
}): boolean => {
  const inboundUrl = new URL(input.request.url);
  const signature = input.request.headers.get('x-consuelo-edge-signature')?.trim();
  const timestamp = input.request.headers.get(EDGE_SIGNATURE_TIMESTAMP_HEADER)?.trim();
  const nonce = input.request.headers.get(EDGE_SIGNATURE_NONCE_HEADER)?.trim();
  if (!signature || !timestamp || !nonce) return false;
  if (nonce.length < 8 || nonce.length > 128) return false;
  const timestampMs = Number(timestamp);
  if (!Number.isFinite(timestampMs)) return false;
  if (Math.abs(input.nowMs - timestampMs) > EDGE_SIGNATURE_MAX_AGE_MS) return false;

  const expectedSignature = signEdgeRequest({
    secret: input.internalSigningSecret,
    method: input.request.method,
    pathWithSearch: `${inboundUrl.pathname}${inboundUrl.search}`,
    workspaceId: input.resolution.workspaceId,
    surface: input.resolution.surface,
    timestamp,
    nonce,
  });

  return signatureMatches(signature, expectedSignature);
};

const buildProxyRequest = (input: {
  request: Request;
  resolution: Extract<WorkspaceCloudflareEdgeRouteResolution, { allowed: true }>;
  upstreamUrl: string;
  internalSigningSecret: string;
  timestamp: string;
  nonce: string;
}): Request => {
  const inboundUrl = new URL(input.request.url);
  const headers = new Headers(input.request.headers);
  headers.delete('x-consuelo-workspace-id');
  headers.delete('x-consuelo-hostname');
  headers.delete('x-consuelo-route');
  headers.delete('x-consuelo-surface');
  headers.delete('x-consuelo-edge-signature');
  headers.delete(EDGE_SIGNATURE_TIMESTAMP_HEADER);
  headers.delete(EDGE_SIGNATURE_NONCE_HEADER);
  headers.delete('x-consuelo-connector-id');
  headers.delete('x-consuelo-node-id');

  headers.set('x-consuelo-workspace-id', input.resolution.workspaceId);
  headers.set('x-consuelo-hostname', input.resolution.hostname);
  headers.set('x-consuelo-route', input.resolution.route);
  headers.set('x-consuelo-surface', input.resolution.surface);

  if (input.resolution.target.kind === 'os-connector') {
    headers.set('x-consuelo-connector-id', input.resolution.target.connectorId);
    if (input.resolution.nodeId) {
      headers.set('x-consuelo-node-id', input.resolution.nodeId);
    }
  }

  headers.set(EDGE_SIGNATURE_TIMESTAMP_HEADER, input.timestamp);
  headers.set(EDGE_SIGNATURE_NONCE_HEADER, input.nonce);

  headers.set(
    'x-consuelo-edge-signature',
    signEdgeRequest({
      secret: input.internalSigningSecret,
      method: input.request.method,
      pathWithSearch: `${inboundUrl.pathname}${inboundUrl.search}`,
      workspaceId: input.resolution.workspaceId,
      surface: input.resolution.surface,
      timestamp: input.timestamp,
      nonce: input.nonce,
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

type SiteSnapshotTarget = Extract<
  WorkspaceCloudflareEdgeRouteTarget,
  { kind: 'site-snapshot' }
>;

const createSiteSnapshotCacheKey = (request: Request): Request => {
  const url = new URL(request.url);
  url.search = '';
  return new Request(url.toString(), { method: 'GET' });
};

const isSiteSnapshotEdgeCacheable = (target: SiteSnapshotTarget): boolean =>
  target.cachePolicy === 'versioned-asset' || target.cachePolicy === 'mutable-artifact';

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
  if (policy === 'private-preview' || policy === 'static-shell') return 'no-store';
  return 'no-store';
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
  target: SiteSnapshotTarget;
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
    if (cached.headers.get('x-consuelo-site-version') !== input.target.versionId) {
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

const createConsueloGatewayServiceResponse = (input: {
  resolution: Extract<WorkspaceCloudflareEdgeRouteResolution, { allowed: true }> & {
    target: Extract<WorkspaceCloudflareEdgeRouteTarget, { kind: 'consuelo-gateway-service' }>;
  };
}): Response => Response.json(
  {
    ok: true,
    publicBoundary: 'consuelo-gateway',
    workspace: {
      workspaceId: input.resolution.workspaceId,
      workspaceHost: input.resolution.hostname,
    },
    route: {
      serviceName: input.resolution.target.serviceName,
      gatewayServiceName: input.resolution.target.serviceName,
      gatewayRouteFamily: input.resolution.target.gatewayRouteFamily,
      publicSiteRouteFamily: input.resolution.target.publicSiteRouteFamily,
    },
  },
  {
    status: 200,
    headers: {
      'cache-control': 'no-store',
      'x-consuelo-edge-route-authority': 'consuelo-gateway-service',
    },
  },
);

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
        request: input.request,
      });
    }

    const cache = input.store?.cache ?? getDefaultSiteCache();
    const cacheable = isSiteSnapshotEdgeCacheable(input.resolution.target);
    const cached = cacheable
      ? await readCachedSiteSnapshot({
          request: input.request,
          target: input.resolution.target,
          cache,
        })
      : null;
    if (cached) return cached;

    const html = await readSiteSnapshotHtml({
      store: input.store,
      target: input.resolution.target,
    });
    if (!html) {
      return createSafeErrorResponse({
        status: 503,
        code: 'WORKSPACE_SITE_SNAPSHOT_UNAVAILABLE',
        request: input.request,
      });
    }

    const response = createSiteSnapshotResponse({
      html,
      target: input.resolution.target,
    });
    if (cacheable) {
      await cache
        ?.put(createSiteSnapshotCacheKey(input.request), response.clone())
        .catch(() => undefined);
    }
    return withSiteSnapshotCacheState(response, 'miss');
  } catch {
    return createSafeErrorResponse({
      status: 503,
      code: 'WORKSPACE_SITE_SNAPSHOT_UNAVAILABLE',
      request: input.request,
    });
  }
};


const OAUTH_AUTHORIZATION_SERVER = 'https://os.consuelohq.com';
const MCP_OAUTH_SCOPES = [
  'mcp:read',
  'mcp:call',
  'workspace:read',
  'workspace:nodes:manage',
  'os:tools',
  'route:/mcp:read',
  'tool:*:read',
];

const isOAuthProtectedResourceMetadataRequest = (pathname: string): boolean =>
  pathname === '/.well-known/oauth-protected-resource' ||
  pathname === '/.well-known/oauth-protected-resource/mcp';

const isOAuthAuthorizationServerMetadataRequest = (pathname: string): boolean =>
  pathname === '/.well-known/oauth-authorization-server';

const createOAuthProtectedResourceMetadataResponse = (input: {
  hostname: string;
}): Response =>
  Response.json(
    {
      resource: `https://${input.hostname}/mcp`,
      authorization_servers: [OAUTH_AUTHORIZATION_SERVER],
      scopes_supported: MCP_OAUTH_SCOPES,
      bearer_methods_supported: ['header'],
    },
    {
      status: 200,
      headers: {
        'cache-control': 'no-store',
        'x-content-type-options': 'nosniff',
      },
    },
  );

const createOAuthAuthorizationServerMetadataResponse = (): Response =>
  Response.json(
    {
      issuer: OAUTH_AUTHORIZATION_SERVER,
      authorization_endpoint: `${OAUTH_AUTHORIZATION_SERVER}/oauth/authorize`,
      token_endpoint: `${OAUTH_AUTHORIZATION_SERVER}/oauth/token`,
      introspection_endpoint: `${OAUTH_AUTHORIZATION_SERVER}/oauth/introspect`,
      response_types_supported: ['code'],
      grant_types_supported: ['authorization_code'],
      code_challenge_methods_supported: ['S256'],
      token_endpoint_auth_methods_supported: ['none'],
      client_id_metadata_document_supported: true,
      scopes_supported: MCP_OAUTH_SCOPES,
    },
    {
      status: 200,
      headers: {
        'cache-control': 'no-store',
        'x-content-type-options': 'nosniff',
      },
    },
  );

export const createWorkspaceCloudflareEdgeRouter = (
  input: WorkspaceCloudflareEdgeRouterInput,
): WorkspaceCloudflareEdgeRouter => {
  const fetchUpstream = input.fetchUpstream ?? globalThis.fetch;
  const now = input.now ?? Date.now;
  const createNonce = input.createNonce ?? randomUUID;
  return {
    async fetch(request: Request): Promise<Response> {
      try {
        const inboundUrl = new URL(request.url);
        if (isReservedWorkspaceHostname(inboundUrl.hostname, input.reservedHostnames)) {
          return createSafeErrorResponse({
            status: 404,
            code: 'WORKSPACE_HOSTNAME_RESERVED',
            request,
          });
        }
        if (isOAuthProtectedResourceMetadataRequest(inboundUrl.pathname)) {
          const mcpResolution = await input.registry.resolve({
            host: inboundUrl.hostname,
            path: '/mcp',
            method: 'POST',
            requireOnlineNode: false,
          });
          if (!mcpResolution.allowed) {
            return createSafeErrorResponse({
              status: mcpResolution.status,
              code: mcpResolution.errorCode,
              request,
            });
          }
          if (mcpResolution.target.kind !== 'os-connector') {
            return createSafeErrorResponse({
              status: 404,
              code: 'WORKSPACE_HOSTNAME_ROUTE_NOT_FOUND',
              request,
            });
          }
          return createOAuthProtectedResourceMetadataResponse({
            hostname: inboundUrl.hostname,
          });
        }
        if (isOAuthAuthorizationServerMetadataRequest(inboundUrl.pathname)) {
          const mcpResolution = await input.registry.resolve({
            host: inboundUrl.hostname,
            path: '/mcp',
            method: 'POST',
            requireOnlineNode: false,
          });
          if (!mcpResolution.allowed) {
            return createSafeErrorResponse({
              status: mcpResolution.status,
              code: mcpResolution.errorCode,
              request,
            });
          }
          if (mcpResolution.target.kind !== 'os-connector') {
            return createSafeErrorResponse({
              status: 404,
              code: 'WORKSPACE_HOSTNAME_ROUTE_NOT_FOUND',
              request,
            });
          }
          return createOAuthAuthorizationServerMetadataResponse();
        }
        const resolution = await input.registry.resolve({
          host: inboundUrl.hostname,
          path: inboundUrl.pathname,
          method: request.method,
          ...(request.headers.get('x-consuelo-node-id')?.trim()
            ? { nodeId: request.headers.get('x-consuelo-node-id')!.trim() }
            : {}),
          nowMs: now(),
        });

        if (!resolution.allowed) {
          return createSafeErrorResponse({
            status: resolution.status,
            code: resolution.errorCode,
            request,
          });
        }

        if (resolution.auth === 'workspace-session') {
          const authorized = input.authorizeWorkspaceSession
            ? await input.authorizeWorkspaceSession({
                request,
                workspaceId: resolution.workspaceId,
                workspaceHost: resolution.hostname,
              })
            : false;
          if (!authorized) {
            const acceptsHtml =
              request.method === 'GET' &&
              (request.headers.get('accept') ?? '').includes('text/html');
            if (acceptsHtml) {
              const login = new URL(
                '/login/google/start',
                OAUTH_AUTHORIZATION_SERVER,
              );
              login.searchParams.set('purpose', 'web');
              login.searchParams.set(
                'return_to',
                `${inboundUrl.pathname}${inboundUrl.search}`,
              );
              return new Response(null, {
                status: 302,
                headers: {
                  location: login.toString(),
                  'cache-control': 'no-store',
                  'x-content-type-options': 'nosniff',
                },
              });
            }
            return new Response(
              JSON.stringify({ error: 'workspace_session_required' }),
              {
                status: 401,
                headers: {
                  'content-type': 'application/json; charset=utf-8',
                  'cache-control': 'no-store',
                  'x-content-type-options': 'nosniff',
                },
              },
            );
          }
        }

        if (resolution.target.kind === 'redirect') {
          const suffix = inboundUrl.pathname.slice(resolution.route.length);
          const location = `${resolution.target.location.replace(/\/$/, '')}${suffix}${inboundUrl.search}`;
          return new Response(null, {
            status: resolution.target.statusCode,
            headers: {
              location: location || '/',
              'cache-control': 'public, max-age=86400',
              'x-consuelo-edge-route-authority': 'legacy-redirect',
            },
          });
        }

        if (resolution.target.kind === 'site-snapshot') {
          if (
            resolution.auth !== 'public' &&
            resolution.auth !== 'workspace-session'
          ) {
            return createSafeErrorResponse({
              status: 503,
              code: 'WORKSPACE_EDGE_AUTH_REQUIRED',
              request,
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

        if (resolution.target.kind === 'consuelo-gateway-service') {
          const internalSigningSecret = input.internalSigningSecret?.trim();

          if (
            resolution.auth !== 'public' &&
            (!internalSigningSecret ||
              !isSignedInternalEdgeRequest({
                request,
                resolution,
                internalSigningSecret,
                nowMs: now(),
              }))
          ) {
            return createSafeErrorResponse({
              status: 503,
              code: 'WORKSPACE_EDGE_AUTH_REQUIRED',
              request,
            });
          }

          return createConsueloGatewayServiceResponse({
            resolution: resolution as Extract<
              WorkspaceCloudflareEdgeRouteResolution,
              { allowed: true }
            > & {
              target: Extract<
                WorkspaceCloudflareEdgeRouteTarget,
                { kind: 'consuelo-gateway-service' }
              >;
            },
          });
        }

        if (
          resolution.target.kind === 'os-connector' &&
          resolution.target.connectorStatus !== 'connected'
        ) {
          return createSafeErrorResponse({
            status: 503,
            code: 'WORKSPACE_HOSTNAME_OS_CONNECTOR_OFFLINE',
            request,
          });
        }

        const internalSigningSecret = input.internalSigningSecret?.trim();

        if (!internalSigningSecret) {
          return createSafeErrorResponse({
            status: 503,
            code: 'WORKSPACE_EDGE_AUTH_REQUIRED',
            request,
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
          timestamp: String(now()),
          nonce: createNonce(),
        });

        return await fetchUpstream(proxyRequest);
      } catch (error: unknown) {
        return createSafeErrorResponse({
          status: 503,
          code: 'WORKSPACE_EDGE_ROUTER_ERROR',
          request,
        });
      }
    },
  };
};





