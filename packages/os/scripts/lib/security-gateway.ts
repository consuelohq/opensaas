import { createHmac, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

type JsonObject = Record<string, unknown>;

type GatewaySecurityConfig = {
  workspaceId: string;
  workspaceSlug: string;
  workspaceHost: string;
  generatedAuthPath: string;
  tokenIssuer: string;
  signingKeyId: string;
  publicRoutes: string[];
};

type AgentAppToken = {
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

type VerificationResult =
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
  routes: Array<{
    path: string;
    upstream: { host: string; port: number };
    auth: 'required';
    workspaceId: string;
  }>;
  resolve: (input: { host: string; path: string; workspaceId: string }) => {
    route: string;
    upstream: { host: string; port: number };
  };
};

type OutboundConnectorConfig = {
  mode: 'outbound';
  workspaceId: string;
  strategy: string;
  listeners: Array<{ host: string; port: number }>;
  requires: string[];
  audit: { enabled: boolean; eventName: string };
};

type StoredToken = AgentAppToken & {
  status: 'active' | 'rotated' | 'revoked';
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
  tokens: Record<string, StoredToken>;
  seenNonces: Record<string, string>;
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
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
  fs.chmodSync(filePath, 0o600);
}

function readStoredAuth(config: GatewaySecurityConfig): StoredAuthConfig {
  const raw = fs.readFileSync(config.generatedAuthPath, 'utf8');
  return JSON.parse(raw) as StoredAuthConfig;
}

function writeStoredAuth(config: GatewaySecurityConfig, stored: StoredAuthConfig): void {
  writeJsonSecure(config.generatedAuthPath, { ...stored, updatedAt: nowIso() });
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
}): GatewaySecurityConfig {
  ensureSecurityDirs(input.home);
  const generatedAuthPath = authPathForHome(input.home);
  const stored: StoredAuthConfig = {
    version: 1,
    kind: 'consuelo-generated',
    workspaceId: input.workspaceId,
    workspaceSlug: input.workspaceSlug,
    workspaceHost: input.workspaceHost,
    tokenIssuer: 'consuelo-os-gateway',
    signingKeyId: `csg_${randomUUID()}`,
    publicRoutes: [...PUBLIC_ROUTES],
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
      upstream: { host: '127.0.0.1', port: 8850 },
    }),
    { mode: 0o600 },
  );
  fs.chmodSync(caddyPathForHome(input.home), 0o600);
  return toPublicConfig(stored, generatedAuthPath);
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
  if (existing) existing.status = 'rotated';
  const rotated: StoredToken = {
    ...input.token,
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
  if (input.workspaceId !== input.config.workspaceId) {
    return safeError(403, 'WORKSPACE_MISMATCH', 'Workspace identity does not match this gateway.');
  }

  const stored = readStoredAuth(input.config);
  const tokenId = input.headers['x-consuelo-token-id'] ?? input.headers.authorization?.replace(/^Bearer\s+/i, '');
  const timestamp = input.headers['x-consuelo-timestamp'];
  const nonce = input.headers['x-consuelo-nonce'];
  const signature = input.headers['x-consuelo-signature'];

  if (!tokenId || !timestamp || !nonce || !signature) {
    return safeError(401, 'MISSING_SIGNATURE', 'Signed gateway headers are required.');
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

  stored.seenNonces[nonce] = tokenId;
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
  mtls?: { enabled: boolean; caFile: string };
}): string {
  requirePrivateUpstream(input.upstream);
  const mtlsBlock = input.mtls?.enabled
    ? `\n  tls {\n    client_auth {\n      mode require_and_verify\n      trusted_ca_cert_file ${input.mtls.caFile}\n    }\n  }\n`
    : '';
  return `${input.workspaceHost} {\n  encode zstd gzip\n  reverse_proxy ${input.upstream.host}:${input.upstream.port}${mtlsBlock}}\n`;
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
  }));
  return {
    workspaceId: input.workspaceId,
    workspaceHost,
    routes,
    resolve: (request) => {
      if (request.workspaceId !== input.workspaceId || request.host !== workspaceHost) {
        throw new Error('workspace tenant host mismatch');
      }
      const route = routes.find((candidate) => (
        request.path === candidate.path || request.path.startsWith(`${candidate.path}/`)
      ));
      if (!route) throw new Error('route not found');
      return { route: route.path, upstream: { ...route.upstream } };
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
    requires: ['generated-auth', 'workspace-identity'],
    audit: { enabled: true, eventName: 'gateway.connector.state' },
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
