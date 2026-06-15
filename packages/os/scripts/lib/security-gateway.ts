import { createHmac, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

type JsonObject = Record<string, unknown>;

type PublicGatewayMetadata = {
  provider: 'cloudflare';
  routeMode: 'workspace-subdomain';
  connectorMode: 'outbound-os-connector';
  hostname: string;
  caddy: { host: '127.0.0.1'; port: number };
  upstream: { host: string; port: number };
};

export type GatewaySecurityConfig = {
  workspaceId: string;
  workspaceSlug: string;
  workspaceHost: string;
  generatedAuthPath: string;
  tokenIssuer: string;
  signingKeyId: string;
  publicRoutes: string[];
  publicGateway: PublicGatewayMetadata;
};

export type AgentAppToken = {
  tokenId: string;
  workspaceId: string;
  callerId: string;
  appId: string;
  scopes: string[];
  expiresAt: string;
  secret: string;
};

type SignedGatewayRequest = {
  headers: Record<string, string>;
  body: string;
  nonce: string;
  timestamp: string;
};

export type VerificationResult =
  | { ok: true; caller: { workspaceId: string; callerId: string; scopes: string[] } }
  | { ok: false; status: number; error: { code: string; message: string } };

type PolicyDecision = {
  allowed: boolean;
  category: 'read' | 'write' | 'dangerous';
  requiresApproval: boolean;
  reason: string;
};

type AuditEvent = {
  event: string;
  callerId: string;
  workspaceId: string;
  toolName?: string;
  route?: string;
  decision: string;
  status: 'allowed' | 'denied';
  timestamp: string;
};

type PublicRouteRegistry = {
  workspaceId: string;
  workspaceHost: string;
  edgeProvider: 'cloudflare';
  connectorMode: 'outbound-os-connector';
  routes: Array<{
    path: string;
    upstream: { host: string; port: number };
    auth: 'required';
    workspaceId: string;
    edgeProvider: 'cloudflare';
    connectorMode: 'outbound-os-connector';
  }>;
  resolve: (input: { host: string; path: string; workspaceId: string }) => {
    route: string;
    upstream: { host: string; port: number };
    auth: 'required';
    connectorMode: 'outbound-os-connector';
  };
};

type OutboundConnectorConfig = {
  mode: 'outbound';
  workspaceId: string;
  strategy: string;
  listeners: Array<{ host: string; port: number }>;
  requires: string[];
  audit: { enabled: boolean; eventName: string };
  cloudflare: { managedHostname: string; publicRoutes: string[] };
};

type StoredToken = AgentAppToken & {
  status: 'active' | 'rotated' | 'revoked';
};

type StoredNonce = {
  tokenId: string;
  seenAt: string;
};

type StoredAuthConfig = {
  version: 1;
  kind: 'consuelo-generated';
  workspaceId: string;
  workspaceSlug: string;
  workspaceHost: string;
  tokenIssuer: string;
  signingKeyId: string;
  publicRoutes: string[];
  publicGateway: PublicGatewayMetadata;
  tokens: Record<string, StoredToken>;
  seenNonces: Record<string, StoredNonce>;
  createdAt: string;
  updatedAt: string;
};

const PUBLIC_ROUTES = [
  '/office',
  '/diffs',
  '/wiki',
  '/traces',
  '/tools',
  '/api',
  '/mcp',
  '/apps/chatgpt',
] as const;

const DEFAULT_CADDY_GATEWAY_PORT = 8970;
const MAX_TIMESTAMP_SKEW_MS = 5 * 60 * 1000;

function nowIso(): string {
  return new Date().toISOString();
}

function randomSecret(): string {
  return randomBytes(32).toString('base64url');
}

function authPathForHome(home: string): string {
  return path.join(home, 'security', 'generated', 'auth.json');
}

function caddyPathForHome(home: string): string {
  return path.join(home, 'security', 'generated', 'Caddyfile');
}

function ensureSecurityDirs(home: string): void {
  fs.mkdirSync(path.join(home, 'security', 'generated'), { recursive: true });
  fs.mkdirSync(path.join(home, 'security', 'overrides'), { recursive: true });
  fs.mkdirSync(path.join(home, 'logs'), { recursive: true });
}

function writeJsonSecure(filePath: string, value: unknown): void {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  const tempPath = path.join(dir, `.${path.basename(filePath)}.${randomUUID()}.tmp`);
  try {
    fs.writeFileSync(tempPath, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
    fs.chmodSync(tempPath, 0o600);
    fs.renameSync(tempPath, filePath);
    fs.chmodSync(filePath, 0o600);
  } catch (error: unknown) {
    try {
      if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
    } catch {
      // best-effort cleanup only
    }
    throw error;
  }
}

function readStoredAuthFile(filePath: string): StoredAuthConfig {
  const raw = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(raw) as StoredAuthConfig;
}

function readStoredAuth(config: GatewaySecurityConfig): StoredAuthConfig {
  return readStoredAuthFile(config.generatedAuthPath);
}

function normalizeSeenNonces(value: unknown, fallbackSeenAt: string): Record<string, StoredNonce> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const normalized: Record<string, StoredNonce> = {};
  for (const [nonce, record] of Object.entries(value as Record<string, unknown>)) {
    if (typeof record === 'string') {
      normalized[nonce] = { tokenId: record, seenAt: fallbackSeenAt };
      continue;
    }
    if (!record || typeof record !== 'object' || Array.isArray(record)) continue;
    const candidate = record as Partial<StoredNonce>;
    if (typeof candidate.tokenId === 'string' && typeof candidate.seenAt === 'string') {
      normalized[nonce] = { tokenId: candidate.tokenId, seenAt: candidate.seenAt };
    }
  }
  return normalized;
}

function pruneSeenNonces(stored: StoredAuthConfig, nowTime: number): void {
  const cutoffTime = nowTime - MAX_TIMESTAMP_SKEW_MS;
  for (const [nonce, record] of Object.entries(stored.seenNonces)) {
    const seenTime = Date.parse(record.seenAt);
    if (!Number.isFinite(seenTime) || seenTime < cutoffTime) delete stored.seenNonces[nonce];
  }
}


function writeStoredAuth(config: GatewaySecurityConfig, stored: StoredAuthConfig): void {
  writeJsonSecure(config.generatedAuthPath, { ...stored, updatedAt: nowIso() });
}

function createPublicGatewayMetadata(input: {
  workspaceHost: string;
  upstream: { host: string; port: number };
  caddy?: { host: '127.0.0.1'; port: number };
}): PublicGatewayMetadata {
  requirePrivateUpstream(input.upstream);
  const caddy = input.caddy ?? { host: '127.0.0.1', port: DEFAULT_CADDY_GATEWAY_PORT };
  requirePrivateUpstream(caddy);
  return {
    provider: 'cloudflare',
    routeMode: 'workspace-subdomain',
    connectorMode: 'outbound-os-connector',
    hostname: input.workspaceHost,
    caddy: { ...caddy },
    upstream: { ...input.upstream },
  };
}

function toPublicConfig(stored: StoredAuthConfig, generatedAuthPath: string): GatewaySecurityConfig {
  return {
    workspaceId: stored.workspaceId,
    workspaceSlug: stored.workspaceSlug,
    workspaceHost: stored.workspaceHost,
    generatedAuthPath,
    tokenIssuer: stored.tokenIssuer,
    signingKeyId: stored.signingKeyId,
    publicRoutes: [...stored.publicRoutes],
    publicGateway: {
      ...stored.publicGateway,
      upstream: { ...stored.publicGateway.upstream },
    },
  };
}

function safeError(status: number, code: string, message: string): VerificationResult {
  return { ok: false, status, error: { code, message } };
}

function canonicalRequest(input: {
  tokenId: string;
  workspaceId: string;
  method: string;
  path: string;
  body: string;
  timestamp: string;
  nonce: string;
}): string {
  return [
    input.tokenId,
    input.workspaceId,
    input.method.toUpperCase(),
    input.path,
    input.body,
    input.timestamp,
    input.nonce,
  ].join('\n');
}

function sign(secret: string, payload: string): string {
  return createHmac('sha256', secret).update(payload).digest('base64url');
}

function signatureMatches(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function requirePrivateUpstream(upstream: { host: string; port: number }): void {
  const privateHosts = new Set(['127.0.0.1', 'localhost', '::1']);
  if (!privateHosts.has(upstream.host)) {
    throw new Error('Gateway upstream must be a private localhost server.');
  }
  if (!Number.isInteger(upstream.port) || upstream.port <= 0) {
    throw new Error('Gateway upstream port must be valid.');
  }
}

export function createGatewaySecurityConfig(input: {
  home: string;
  workspaceId: string;
  workspaceSlug: string;
  workspaceHost: string;
  upstreamPort?: number;
  caddyPort?: number;
}): GatewaySecurityConfig {
  ensureSecurityDirs(input.home);
  const generatedAuthPath = authPathForHome(input.home);
  const upstream = { host: '127.0.0.1', port: input.upstreamPort ?? 8960 };
  const caddy = { host: '127.0.0.1' as const, port: input.caddyPort ?? DEFAULT_CADDY_GATEWAY_PORT };
  const publicGateway = createPublicGatewayMetadata({
    workspaceHost: input.workspaceHost,
    upstream,
    caddy,
  });
  const existing = fs.existsSync(generatedAuthPath)
    ? readStoredAuthFile(generatedAuthPath)
    : null;
  if (existing && existing.workspaceId !== input.workspaceId) {
    throw new Error('existing generated auth belongs to a different workspace');
  }
  const stored: StoredAuthConfig = existing
    ? {
        ...existing,
        workspaceSlug: input.workspaceSlug,
        workspaceHost: input.workspaceHost,
        tokenIssuer: existing.tokenIssuer || 'consuelo-os-gateway',
        signingKeyId: existing.signingKeyId || `csg_${randomUUID()}`,
        publicRoutes: [...PUBLIC_ROUTES],
        publicGateway,
        tokens: existing.tokens ?? {},
        seenNonces: normalizeSeenNonces(existing.seenNonces, existing.updatedAt ?? existing.createdAt ?? nowIso()),
        updatedAt: nowIso(),
      }
    : {
        version: 1,
        kind: 'consuelo-generated',
        workspaceId: input.workspaceId,
        workspaceSlug: input.workspaceSlug,
        workspaceHost: input.workspaceHost,
        tokenIssuer: 'consuelo-os-gateway',
        signingKeyId: `csg_${randomUUID()}`,
        publicRoutes: [...PUBLIC_ROUTES],
        publicGateway,
        tokens: {},
        seenNonces: {},
        createdAt: nowIso(),
        updatedAt: nowIso(),
      };
  writeJsonSecure(generatedAuthPath, stored);
  fs.writeFileSync(
    caddyPathForHome(input.home),
    renderCaddyGatewayConfig({
      workspaceHost: input.workspaceHost,
      upstream,
      caddy,
    }),
    { mode: 0o600 },
  );
  fs.chmodSync(caddyPathForHome(input.home), 0o600);
  return toPublicConfig(stored, generatedAuthPath);
}

export function loadGatewaySecurityConfig(input: { authConfigPath: string }): GatewaySecurityConfig {
  const stored = readStoredAuthFile(input.authConfigPath);
  if (stored.kind !== 'consuelo-generated') {
    throw new Error('auth config is not Consuelo-generated');
  }
  return toPublicConfig(stored, input.authConfigPath);
}

export function issueAgentAppToken(input: {
  config: GatewaySecurityConfig;
  callerId: string;
  appId: string;
  scopes: string[];
  expiresInSeconds: number;
}): AgentAppToken {
  const stored = readStoredAuth(input.config);
  const token: StoredToken = {
    tokenId: `tok_${randomUUID()}`,
    workspaceId: input.config.workspaceId,
    callerId: input.callerId,
    appId: input.appId,
    scopes: [...input.scopes],
    expiresAt: new Date(Date.now() + input.expiresInSeconds * 1000).toISOString(),
    secret: randomSecret(),
    status: 'active',
  };
  stored.tokens[token.tokenId] = token;
  writeStoredAuth(input.config, stored);
  const { status: _status, ...publicToken } = token;
  void _status;
  return publicToken;
}

export function rotateAgentAppToken(input: {
  config: GatewaySecurityConfig;
  token: AgentAppToken;
}): AgentAppToken {
  const stored = readStoredAuth(input.config);
  const existing = stored.tokens[input.token.tokenId];
  if (!existing) {
    throw new Error('gateway token is not recognized');
  }
  existing.status = 'rotated';
  const rotated: StoredToken = {
    ...existing,
    tokenId: `tok_${randomUUID()}`,
    secret: randomSecret(),
    status: 'active',
  };
  stored.tokens[rotated.tokenId] = rotated;
  writeStoredAuth(input.config, stored);
  const { status: _status, ...publicToken } = rotated;
  void _status;
  return publicToken;
}

export function revokeAgentAppToken(input: {
  config: GatewaySecurityConfig;
  tokenId: string;
}): void {
  const stored = readStoredAuth(input.config);
  const token = stored.tokens[input.tokenId];
  if (token) token.status = 'revoked';
  writeStoredAuth(input.config, stored);
}

export function signMachineRequest(input: {
  config: GatewaySecurityConfig;
  token: AgentAppToken;
  method: string;
  path: string;
  body: string;
  timestamp: string;
  nonce: string;
}): SignedGatewayRequest {
  const payload = canonicalRequest({
    tokenId: input.token.tokenId,
    workspaceId: input.config.workspaceId,
    method: input.method,
    path: input.path,
    body: input.body,
    timestamp: input.timestamp,
    nonce: input.nonce,
  });
  const signature = sign(input.token.secret, payload);
  return {
    body: input.body,
    nonce: input.nonce,
    timestamp: input.timestamp,
    headers: {
      authorization: `Bearer ${input.token.tokenId}`,
      'x-consuelo-token-id': input.token.tokenId,
      'x-consuelo-workspace-id': input.config.workspaceId,
      'x-consuelo-caller-id': input.token.callerId,
      'x-consuelo-timestamp': input.timestamp,
      'x-consuelo-nonce': input.nonce,
      'x-consuelo-signature': signature,
      'x-consuelo-key-id': input.config.signingKeyId,
    },
  };
}

export function verifyMachineRequest(input: {
  config: GatewaySecurityConfig;
  method: string;
  path: string;
  body: string;
  headers: Record<string, string>;
  workspaceId: string;
  requiredScope: string;
  now: string;
}): VerificationResult {
  const stored = readStoredAuth(input.config);
  const tokenId = input.headers['x-consuelo-token-id'] ?? input.headers.authorization?.replace(/^Bearer\s+/i, '');
  const timestamp = input.headers['x-consuelo-timestamp'];
  const nonce = input.headers['x-consuelo-nonce'];
  const signature = input.headers['x-consuelo-signature'];

  if (!tokenId || !timestamp || !nonce || !signature) {
    return safeError(401, 'MISSING_SIGNATURE', 'Signed gateway headers are required.');
  }

  if (input.workspaceId !== input.config.workspaceId) {
    return safeError(403, 'WORKSPACE_MISMATCH', 'Workspace identity does not match this gateway.');
  }

  const token = stored.tokens[tokenId];
  if (!token) return safeError(401, 'UNKNOWN_TOKEN', 'Gateway token is not recognized.');
  if (token.status === 'rotated') return safeError(401, 'TOKEN_ROTATED', 'Gateway token has been rotated.');
  if (token.status === 'revoked') return safeError(401, 'TOKEN_REVOKED', 'Gateway token has been revoked.');

  const requestTime = Date.parse(timestamp);
  const nowTime = Date.parse(input.now);
  if (!Number.isFinite(requestTime) || !Number.isFinite(nowTime)) {
    return safeError(401, 'EXPIRED_TIMESTAMP', 'Gateway timestamp is invalid.');
  }
  if (Math.abs(nowTime - requestTime) > MAX_TIMESTAMP_SKEW_MS) {
    return safeError(401, 'EXPIRED_TIMESTAMP', 'Gateway timestamp is outside the allowed window.');
  }

  const expiresAt = Date.parse(token.expiresAt);
  if (!Number.isFinite(expiresAt) || expiresAt <= nowTime) {
    return safeError(401, 'TOKEN_EXPIRED', 'Gateway token has expired.');
  }

  pruneSeenNonces(stored, nowTime);
  if (stored.seenNonces[nonce]) {
    return safeError(401, 'REPLAYED_NONCE', 'Gateway nonce has already been used.');
  }

  const expected = sign(token.secret, canonicalRequest({
    tokenId,
    workspaceId: input.config.workspaceId,
    method: input.method,
    path: input.path,
    body: input.body,
    timestamp,
    nonce,
  }));
  if (!signatureMatches(signature, expected)) {
    return safeError(401, 'BAD_SIGNATURE', 'Gateway signature could not be verified.');
  }

  if (!token.scopes.includes(input.requiredScope)) {
    return safeError(403, 'MISSING_SCOPE', 'Gateway token does not grant the required scope.');
  }

  stored.seenNonces[nonce] = { tokenId, seenAt: new Date(nowTime).toISOString() };
  writeStoredAuth(input.config, stored);
  return {
    ok: true,
    caller: {
      workspaceId: token.workspaceId,
      callerId: token.callerId,
      scopes: [...token.scopes],
    },
  };
}

export function renderCaddyGatewayConfig(input: {
  workspaceHost: string;
  upstream: { host: string; port: number };
  caddy?: { host: '127.0.0.1'; port: number };
  mtls?: { enabled: boolean; caFile: string };
}): string {
  requirePrivateUpstream(input.upstream);
  const caddy = input.caddy ?? { host: '127.0.0.1' as const, port: DEFAULT_CADDY_GATEWAY_PORT };
  requirePrivateUpstream(caddy);
  const mtlsBlock = input.mtls?.enabled
    ? `
  tls {
    client_auth {
      mode require_and_verify
      trusted_ca_cert_file ${input.mtls.caFile}
    }
  }
`
    : '';
  return `http://${caddy.host}:${caddy.port} {
  @workspace_host host ${input.workspaceHost}
  handle @workspace_host {
    encode zstd gzip
    request_body {
      max_size 10MB
    }
    log {
      output stderr
      format console
    }
    reverse_proxy ${input.upstream.host}:${input.upstream.port} {
      header_up -X-Consuelo-Edge-Signature
      header_up -X-Consuelo-Connector-Id
      header_up -X-Consuelo-Hostname
      header_up -X-Consuelo-Route
      header_up -X-Consuelo-Surface
      transport http {
        dial_timeout 5s
        response_header_timeout 30s
      }
    }
  }
  respond 404
}${mtlsBlock}
`;
}

export function createPublicRouteRegistry(input: {
  workspaceId: string;
  workspaceSlug: string;
  upstream: { host: string; port: number };
}): PublicRouteRegistry {
  requirePrivateUpstream(input.upstream);
  const workspaceHost = `${input.workspaceSlug}.consuelohq.com`;
  const routes = PUBLIC_ROUTES.map((routePath) => ({
    path: routePath,
    upstream: { ...input.upstream },
    auth: 'required' as const,
    workspaceId: input.workspaceId,
    edgeProvider: 'cloudflare' as const,
    connectorMode: 'outbound-os-connector' as const,
  }));
  return {
    workspaceId: input.workspaceId,
    workspaceHost,
    edgeProvider: 'cloudflare',
    connectorMode: 'outbound-os-connector',
    routes,
    resolve: (request) => {
      if (request.workspaceId !== input.workspaceId || request.host !== workspaceHost) {
        throw new Error('workspace tenant host mismatch');
      }
      const route = routes.find((candidate) => (
        request.path === candidate.path || request.path.startsWith(`${candidate.path}/`)
      ));
      if (!route) throw new Error('route not found');
      return {
        route: route.path,
        upstream: { ...route.upstream },
        auth: route.auth,
        connectorMode: route.connectorMode,
      };
    },
  };
}

export function createOutboundConnectorConfig(input: {
  config?: GatewaySecurityConfig;
  workspaceId?: string;
  strategy: string;
}): OutboundConnectorConfig {
  if (!input.config || !input.workspaceId) {
    throw new Error('generated auth and workspace identity are required for connector mode');
  }
  if (input.config.workspaceId !== input.workspaceId) {
    throw new Error('connector workspace identity does not match generated auth');
  }
  return {
    mode: 'outbound',
    workspaceId: input.workspaceId,
    strategy: input.strategy,
    listeners: [],
    requires: ['generated-auth', 'workspace-identity', 'cloudflare-managed-host'],
    audit: { enabled: true, eventName: 'gateway.connector.state' },
    cloudflare: {
      managedHostname: input.config.workspaceHost,
      publicRoutes: [...input.config.publicRoutes],
    },
  };
}

export function evaluateToolPolicy(input: {
  token: AgentAppToken;
  toolName: string;
  category: 'read' | 'write' | 'dangerous';
  requestedScope: string;
  approvalGranted?: boolean;
}): PolicyDecision {
  const hasScope = input.token.scopes.includes(input.requestedScope);
  if (input.category === 'dangerous') {
    return {
      allowed: hasScope && input.approvalGranted === true,
      category: input.category,
      requiresApproval: true,
      reason: input.approvalGranted === true && hasScope ? 'approved' : 'approval_required',
    };
  }
  return {
    allowed: hasScope,
    category: input.category,
    requiresApproval: false,
    reason: hasScope ? 'scope_granted' : 'missing_scope',
  };
}

export function recordGatewayAuditEvent(input: {
  home: string;
  event: AuditEvent;
}): { path: string; event: AuditEvent } {
  const logPath = path.join(input.home, 'logs', 'gateway-audit.jsonl');
  fs.mkdirSync(path.dirname(logPath), { recursive: true });
  const safeEvent: AuditEvent & JsonObject = { ...input.event };
  fs.appendFileSync(logPath, `${JSON.stringify(safeEvent)}\n`, { mode: 0o600 });
  return { path: logPath, event: input.event };
}




