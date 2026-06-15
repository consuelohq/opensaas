import { createHash, createHmac } from 'node:crypto';

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

export type StoredWorkspaceMcpConnectionCredential = {
  credentialId: string;
  workspaceId: string;
  connectorId: string;
  subjectId: string;
  scopes: string[];
  status: 'active' | 'rotated' | 'revoked';
  createdAt: string;
  lastUsedAt?: string;
  rotatedAt?: string;
  revokedAt?: string;
};

export type WorkspaceMcpConnectionCredentialKv = {
  get: <T = unknown>(key: string, options?: unknown) => Promise<T | null>;
  put?: (key: string, value: string, options?: unknown) => Promise<void>;
};

export type WorkspaceMcpCredentialValidationResult =
  | {
      allowed: true;
      credentialId: string;
      workspaceId: string;
      connectorId: string;
      subjectId: string;
      scopes: string[];
    }
  | {
      allowed: false;
      status: 401 | 403;
      errorCode: string;
    };

export type WorkspaceMcpConnectionCredentialStore = {
  validate: (input: {
    credential: string;
    workspaceId: string;
    connectorId: string;
    requiredScope: string;
    now: string;
  }) => Promise<WorkspaceMcpCredentialValidationResult>;
};

export type WorkspaceMcpProviderNetworkPolicy = {
  allowedCidrs: string[];
  sourceIpHeader?: string;
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
  mcpConnectionCredentials?: WorkspaceMcpConnectionCredentialStore;
  mcpProviderNetwork?: WorkspaceMcpProviderNetworkPolicy;
};

const PLATFORM_SAFETY_MESSAGE = 'This workspace is protected by Consuelo platform safety.';
const PLATFORM_SAFETY_HELP_URL = 'https://os.consuelohq.com/help/workspace-access';

const SAFE_ERROR_MESSAGES: Record<string, string> = {
  WORKSPACE_HOSTNAME_NOT_FOUND: PLATFORM_SAFETY_MESSAGE,
  WORKSPACE_HOSTNAME_ROUTE_NOT_FOUND: PLATFORM_SAFETY_MESSAGE,
  WORKSPACE_HOSTNAME_RESERVED: PLATFORM_SAFETY_MESSAGE,
  WORKSPACE_HOSTNAME_OS_CONNECTOR_OFFLINE: PLATFORM_SAFETY_MESSAGE,
  WORKSPACE_EDGE_ROUTER_ERROR: PLATFORM_SAFETY_MESSAGE,
  WORKSPACE_EDGE_AUTH_REQUIRED: PLATFORM_SAFETY_MESSAGE,
  WORKSPACE_SITE_SNAPSHOT_UNAVAILABLE: PLATFORM_SAFETY_MESSAGE,
  WORKSPACE_MCP_CREDENTIAL_REQUIRED: PLATFORM_SAFETY_MESSAGE,
  WORKSPACE_MCP_CREDENTIAL_INVALID: PLATFORM_SAFETY_MESSAGE,
  WORKSPACE_MCP_CREDENTIAL_ROTATED: PLATFORM_SAFETY_MESSAGE,
  WORKSPACE_MCP_CREDENTIAL_REVOKED: PLATFORM_SAFETY_MESSAGE,
  WORKSPACE_MCP_CREDENTIAL_WORKSPACE_MISMATCH: PLATFORM_SAFETY_MESSAGE,
  WORKSPACE_MCP_CREDENTIAL_CONNECTOR_MISMATCH: PLATFORM_SAFETY_MESSAGE,
  WORKSPACE_MCP_CREDENTIAL_MISSING_SCOPE: PLATFORM_SAFETY_MESSAGE,
  WORKSPACE_MCP_PROVIDER_SOURCE_BLOCKED: PLATFORM_SAFETY_MESSAGE,
  WORKSPACE_MCP_PROVIDER_POLICY_INVALID: PLATFORM_SAFETY_MESSAGE,
};

const SITE_SNAPSHOT_CACHE_AUTHORITY = 'sites-snapshot';
const MCP_ACCESS_SCOPE = 'route:/mcp:access';
const MCP_CREDENTIAL_KEY_PREFIX = 'mcp-credential:sha256:';
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

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>This workspace is protected</title>
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
      <p class="eyebrow">Platform safety</p>
      <h1>This workspace is protected</h1>
      <p>${escapeHtml(input.message)}</p>
      <p>This hostname is protected by Consuelo platform safety. If this is your workspace, sign in to Consuelo or contact the workspace owner with the request ID below.</p>
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
  status: 401 | 403 | 404 | 503;
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

export const mcpConnectionCredentialStorageKey = (credential: string): string =>
  `${MCP_CREDENTIAL_KEY_PREFIX}${createHash('sha256').update(credential).digest('hex')}`;

const isStoredMcpConnectionCredential = (
  value: unknown,
): value is StoredWorkspaceMcpConnectionCredential => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const record = value as Partial<StoredWorkspaceMcpConnectionCredential>;
  return (
    typeof record.credentialId === 'string' &&
    typeof record.workspaceId === 'string' &&
    typeof record.connectorId === 'string' &&
    typeof record.subjectId === 'string' &&
    Array.isArray(record.scopes) &&
    record.scopes.every((scope) => typeof scope === 'string') &&
    (record.status === 'active' || record.status === 'rotated' || record.status === 'revoked') &&
    typeof record.createdAt === 'string'
  );
};

export const createWorkspaceMcpConnectionCredentialStore = (input: {
  kv: WorkspaceMcpConnectionCredentialKv;
}): WorkspaceMcpConnectionCredentialStore => ({
  async validate(request) {
    try {
      const storageKey = mcpConnectionCredentialStorageKey(request.credential);
      const stored = await input.kv.get<unknown>(storageKey, { type: 'json' });

      if (!isStoredMcpConnectionCredential(stored)) {
        return { allowed: false, status: 401, errorCode: 'WORKSPACE_MCP_CREDENTIAL_INVALID' };
      }
      if (stored.status === 'rotated') {
        return { allowed: false, status: 401, errorCode: 'WORKSPACE_MCP_CREDENTIAL_ROTATED' };
      }
      if (stored.status === 'revoked') {
        return { allowed: false, status: 401, errorCode: 'WORKSPACE_MCP_CREDENTIAL_REVOKED' };
      }
      if (stored.workspaceId !== request.workspaceId) {
        return { allowed: false, status: 403, errorCode: 'WORKSPACE_MCP_CREDENTIAL_WORKSPACE_MISMATCH' };
      }
      if (stored.connectorId !== request.connectorId) {
        return { allowed: false, status: 403, errorCode: 'WORKSPACE_MCP_CREDENTIAL_CONNECTOR_MISMATCH' };
      }
      if (!stored.scopes.includes(request.requiredScope)) {
        return { allowed: false, status: 403, errorCode: 'WORKSPACE_MCP_CREDENTIAL_MISSING_SCOPE' };
      }

      await input.kv
        .put?.(storageKey, JSON.stringify({ ...stored, lastUsedAt: request.now }))
        .catch(() => undefined);

      return {
        allowed: true,
        credentialId: stored.credentialId,
        workspaceId: stored.workspaceId,
        connectorId: stored.connectorId,
        subjectId: stored.subjectId,
        scopes: [...stored.scopes],
      };
    } catch (error: unknown) {
      return { allowed: false, status: 401, errorCode: 'WORKSPACE_MCP_CREDENTIAL_INVALID' };
    }
  },
});

type ParsedIpAddress = {
  version: 4 | 6;
  bits: 32 | 128;
  value: bigint;
};

type ParsedCidr = ParsedIpAddress & {
  prefix: number;
};

const parseIpv4 = (value: string): bigint | null => {
  const parts = value.split('.');
  if (parts.length !== 4) return null;
  let result = 0n;

  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null;
    const octet = Number(part);
    if (!Number.isInteger(octet) || octet < 0 || octet > 255) return null;
    result = (result << 8n) + BigInt(octet);
  }

  return result;
};

const parseIpv6Parts = (value: string): number[] | null => {
  if (value.length === 0) return [];
  const parts = value.split(':');
  const parsed: number[] = [];

  for (const part of parts) {
    if (!/^[0-9a-fA-F]{1,4}$/.test(part)) return null;
    parsed.push(Number.parseInt(part, 16));
  }

  return parsed;
};

const parseIpv6 = (value: string): bigint | null => {
  const compressed = value.split('::');
  if (compressed.length > 2) return null;
  const head = parseIpv6Parts(compressed[0]);
  const tail = compressed.length === 2 ? parseIpv6Parts(compressed[1]) : [];
  if (!head || !tail) return null;

  const missing = 8 - head.length - tail.length;
  if (compressed.length === 1 && missing !== 0) return null;
  if (compressed.length === 2 && missing < 1) return null;

  const parts = compressed.length === 2 ? [...head, ...Array(missing).fill(0), ...tail] : head;
  if (parts.length !== 8) return null;

  return parts.reduce((accumulator, part) => (accumulator << 16n) + BigInt(part), 0n);
};

const parseIpAddress = (value: string): ParsedIpAddress | null => {
  const trimmed = value.trim();
  if (trimmed.includes('.')) {
    const ipv4 = parseIpv4(trimmed);
    return ipv4 === null ? null : { version: 4, bits: 32, value: ipv4 };
  }

  const ipv6 = parseIpv6(trimmed);
  return ipv6 === null ? null : { version: 6, bits: 128, value: ipv6 };
};

const parseCidr = (value: string): ParsedCidr | null => {
  const parts = value.trim().split('/');
  if (parts.length > 2 || !parts[0]) return null;
  const address = parseIpAddress(parts[0]);
  if (!address) return null;
  const prefix = parts[1] === undefined ? address.bits : Number(parts[1]);
  if (!Number.isInteger(prefix) || prefix < 0 || prefix > address.bits) return null;
  return { ...address, prefix };
};

const ipMatchesCidr = (source: ParsedIpAddress, cidr: ParsedCidr): boolean => {
  if (source.version !== cidr.version) return false;
  if (cidr.prefix === 0) return true;
  const shift = BigInt(cidr.bits - cidr.prefix);
  return (source.value >> shift) === (cidr.value >> shift);
};

const mcpCredentialFromRequest = (request: Request): string | null => {
  const authorization = request.headers.get('authorization')?.trim() ?? '';
  const match = /^Bearer\s+(.+)$/i.exec(authorization);
  return match?.[1]?.trim() || null;
};

const isMcpPath = (pathname: string): boolean => pathname === '/mcp' || pathname.startsWith('/mcp/');

const validateMcpProviderNetwork = (input: {
  request: Request;
  policy?: WorkspaceMcpProviderNetworkPolicy;
}): { status: 403 | 503; code: string } | null => {
  const cidrs = input.policy?.allowedCidrs.filter((cidr) => cidr.trim().length > 0) ?? [];
  if (cidrs.length === 0) return null;

  const parsedCidrs = cidrs.map(parseCidr);
  if (parsedCidrs.some((cidr) => cidr === null)) {
    return { status: 503, code: 'WORKSPACE_MCP_PROVIDER_POLICY_INVALID' };
  }

  const sourceIp = input.request.headers.get(input.policy?.sourceIpHeader ?? 'cf-connecting-ip')?.trim() ?? '';
  const parsedSourceIp = parseIpAddress(sourceIp);
  if (!parsedSourceIp) {
    return { status: 403, code: 'WORKSPACE_MCP_PROVIDER_SOURCE_BLOCKED' };
  }

  const allowed = parsedCidrs.some((cidr) => cidr !== null && ipMatchesCidr(parsedSourceIp, cidr));
  return allowed ? null : { status: 403, code: 'WORKSPACE_MCP_PROVIDER_SOURCE_BLOCKED' };
};

const validateMcpConnectionCredential = async (input: {
  request: Request;
  resolution: Extract<WorkspaceCloudflareEdgeRouteResolution, { allowed: true }> & {
    target: Extract<WorkspaceCloudflareEdgeRouteTarget, { kind: 'os-connector' }>;
  };
  credentials?: WorkspaceMcpConnectionCredentialStore;
}): Promise<{ status: 401 | 403 | 503; code: string } | null> => {
  if (!input.credentials) {
    return { status: 503, code: 'WORKSPACE_EDGE_AUTH_REQUIRED' };
  }

  const credential = mcpCredentialFromRequest(input.request);
  if (!credential) {
    return { status: 401, code: 'WORKSPACE_MCP_CREDENTIAL_REQUIRED' };
  }

  try {
    const decision = await input.credentials.validate({
      credential,
      workspaceId: input.resolution.workspaceId,
      connectorId: input.resolution.target.connectorId,
      requiredScope: MCP_ACCESS_SCOPE,
      now: new Date().toISOString(),
    });

    return decision.allowed ? null : { status: decision.status, code: decision.errorCode };
  } catch (error: unknown) {
    return { status: 401, code: 'WORKSPACE_MCP_CREDENTIAL_INVALID' };
  }
};

const buildProxyRequest = (input: {
  request: Request;
  resolution: Extract<WorkspaceCloudflareEdgeRouteResolution, { allowed: true }>;
  upstreamUrl: string;
  internalSigningSecret: string;
  stripAuthorization?: boolean;
}): Request => {
  const inboundUrl = new URL(input.request.url);
  const headers = new Headers(input.request.headers);
  for (const headerName of Array.from(headers.keys())) {
    if (headerName.toLowerCase().startsWith('x-consuelo-')) {
      headers.delete(headerName);
    }
  }
  if (input.stripAuthorization) headers.delete('authorization');

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
        request: input.request,
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
        request: input.request,
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
      request: input.request,
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
            request,
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
            request,
          });
        }

        if (resolution.target.kind === 'site-snapshot') {
          if (resolution.auth !== 'public') {
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

        const isMcpConnectorRequest =
          resolution.target.kind === 'os-connector' && isMcpPath(inboundUrl.pathname);

        if (isMcpConnectorRequest) {
          const providerDenied = validateMcpProviderNetwork({
            request,
            policy: input.mcpProviderNetwork,
          });
          if (providerDenied) {
            return createSafeErrorResponse({
              status: providerDenied.status,
              code: providerDenied.code,
              request,
            });
          }

          const credentialDenied = await validateMcpConnectionCredential({
            request,
            resolution: resolution as Extract<WorkspaceCloudflareEdgeRouteResolution, { allowed: true }> & {
              target: Extract<WorkspaceCloudflareEdgeRouteTarget, { kind: 'os-connector' }>;
            },
            credentials: input.mcpConnectionCredentials,
          });
          if (credentialDenied) {
            return createSafeErrorResponse({
              status: credentialDenied.status,
              code: credentialDenied.code,
              request,
            });
          }
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
          stripAuthorization: isMcpConnectorRequest,
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





