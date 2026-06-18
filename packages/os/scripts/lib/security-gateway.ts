import {
  createPrivateKey,
  createPublicKey,
  generateKeyPairSync,
  randomUUID,
  sign as cryptoSign,
  verify as cryptoVerify,
} from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import { readFullToolManifest } from './manifest';

type JsonObject = Record<string, unknown>;
type SignatureAlgorithm = 'ed25519';

const SIGNATURE_ALGORITHM: SignatureAlgorithm = 'ed25519';

type PublicGatewayMetadata = {
  provider: 'cloudflare';
  routeMode: 'workspace-subdomain';
  connectorMode: 'outbound-os-connector';
  hostname: string;
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
  subjectId: string;
  deviceId: string;
  connectorId: string;
  connectionId: string;
  callerId: string;
  appId: string;
  scopes: string[];
  expiresAt: string;
  secret: string;
};

export type AgentAppCredentialStatus = {
  tokenId: string;
  workspaceId: string;
  subjectId: string;
  deviceId: string;
  connectorId: string;
  connectionId: string;
  callerId: string;
  appId: string;
  scopes: string[];
  expiresAt: string;
  status: 'active' | 'rotated' | 'revoked';
  createdAt: string;
  updatedAt: string;
  rotatedAt?: string;
  revokedAt?: string;
  lastUsedAt?: string;
  rotationOfTokenId?: string;
};

type SignedGatewayRequest = {
  headers: Record<string, string>;
  body: string;
  nonce: string;
  timestamp: string;
};

export type VerificationResult =
  | { ok: true; caller: { workspaceId: string; subjectId: string; deviceId: string; connectorId: string; connectionId: string; callerId: string; appId: string; scopes: string[] } }
  | { ok: false; status: number; error: { code: string; message: string } };

type PolicyDecision = {
  allowed: boolean;
  category: 'read' | 'write' | 'dangerous';
  requiresApproval: boolean;
  reason: string;
};

export type ToolScopeResolution =
  | {
      ok: true;
      toolName: string;
      category: 'read' | 'write' | 'dangerous';
      requiredScope: string;
      manifestKind: 'os-skill' | 'facade-tool';
    }
  | {
      ok: false;
      status: 403;
      error: { code: 'UNKNOWN_TOOL_SCOPE'; message: string };
    };

type AuditEvent = {
  event: string;
  callerId: string;
  workspaceId: string;
  tokenId?: string;
  appId?: string;
  subjectId?: string;
  deviceId?: string;
  connectorId?: string;
  connectionId?: string;
  scopes?: string[];
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

type StoredToken = Omit<AgentAppToken, 'secret'> & {
  status: 'active' | 'rotated' | 'revoked';
  signatureAlgorithm: SignatureAlgorithm;
  publicKey: string;
  createdAt: string;
  updatedAt: string;
  rotatedAt?: string;
  revokedAt?: string;
  lastUsedAt?: string;
  rotationOfTokenId?: string;
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

const MAX_TIMESTAMP_SKEW_MS = 5 * 60 * 1000;
const DEFAULT_DEVICE_ID = 'device:local-os';
const DEFAULT_CONNECTOR_ID = 'connector:consuelo-os-gateway';

function nowIso(): string {
  return new Date().toISOString();
}

function nonEmptyString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function fallbackConnectionId(tokenId: string): string {
  return `connection:${tokenId}`;
}

function generateCredentialKeyPair(): { privateKey: string; publicKey: string } {
  const { privateKey, publicKey } = generateKeyPairSync('ed25519');
  return {
    privateKey: privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
    publicKey: publicKey.export({ type: 'spki', format: 'pem' }).toString(),
  };
}

function publicTokenFromStored(token: StoredToken, secret: string): AgentAppToken {
  return {
    tokenId: token.tokenId,
    workspaceId: token.workspaceId,
    subjectId: token.subjectId,
    deviceId: token.deviceId,
    connectorId: token.connectorId,
    connectionId: token.connectionId,
    callerId: token.callerId,
    appId: token.appId,
    scopes: [...token.scopes],
    expiresAt: token.expiresAt,
    secret,
  };
}

function credentialStatusFromStored(token: StoredToken): AgentAppCredentialStatus {
  return {
    tokenId: token.tokenId,
    workspaceId: token.workspaceId,
    subjectId: token.subjectId,
    deviceId: token.deviceId,
    connectorId: token.connectorId,
    connectionId: token.connectionId,
    callerId: token.callerId,
    appId: token.appId,
    scopes: [...token.scopes],
    expiresAt: token.expiresAt,
    status: token.status,
    createdAt: token.createdAt,
    updatedAt: token.updatedAt,
    ...(token.rotatedAt ? { rotatedAt: token.rotatedAt } : {}),
    ...(token.revokedAt ? { revokedAt: token.revokedAt } : {}),
    ...(token.lastUsedAt ? { lastUsedAt: token.lastUsedAt } : {}),
    ...(token.rotationOfTokenId ? { rotationOfTokenId: token.rotationOfTokenId } : {}),
  };
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
  const parsed = JSON.parse(raw) as StoredAuthConfig;
  const fallbackTimestamp = parsed.updatedAt ?? parsed.createdAt ?? nowIso();
  return {
    ...parsed,
    tokens: normalizeStoredTokens(parsed.tokens, fallbackTimestamp),
    seenNonces: normalizeSeenNonces(parsed.seenNonces, fallbackTimestamp),
  };
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

function isLegacySecretToken(candidate: Partial<StoredToken> & { secret?: unknown }): boolean {
  return typeof candidate.secret === 'string'
    && typeof candidate.workspaceId === 'string'
    && typeof candidate.callerId === 'string'
    && typeof candidate.appId === 'string'
    && Array.isArray(candidate.scopes)
    && typeof candidate.expiresAt === 'string';
}

function normalizeStoredTokens(value: unknown, fallbackTimestamp: string): Record<string, StoredToken> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const normalized: Record<string, StoredToken> = {};

  for (const [tokenId, record] of Object.entries(value as Record<string, unknown>)) {
    if (!record || typeof record !== 'object' || Array.isArray(record)) continue;
    const candidate = record as Partial<StoredToken> & { credentialHash?: unknown; secret?: unknown };
    if (
      typeof candidate.workspaceId !== 'string' ||
      typeof candidate.callerId !== 'string' ||
      typeof candidate.appId !== 'string' ||
      !Array.isArray(candidate.scopes) ||
      typeof candidate.expiresAt !== 'string' ||
      candidate.signatureAlgorithm !== SIGNATURE_ALGORITHM ||
      typeof candidate.publicKey !== 'string'
    ) {
      if (isLegacySecretToken(candidate)) {
        throw new Error(`Legacy gateway token ${tokenId} requires credential rotation before generated auth can be upgraded.`);
      }
      continue;
    }
    const status = candidate.status === 'rotated' || candidate.status === 'revoked'
      ? candidate.status
      : 'active';
    const createdAt = typeof candidate.createdAt === 'string' ? candidate.createdAt : fallbackTimestamp;
    const updatedAt = typeof candidate.updatedAt === 'string' ? candidate.updatedAt : fallbackTimestamp;
    const subjectId = nonEmptyString(candidate.subjectId) ?? candidate.callerId;
    const deviceId = nonEmptyString(candidate.deviceId) ?? DEFAULT_DEVICE_ID;
    const connectorId = nonEmptyString(candidate.connectorId) ?? DEFAULT_CONNECTOR_ID;
    const connectionId = nonEmptyString(candidate.connectionId) ?? fallbackConnectionId(tokenId);

    normalized[tokenId] = {
      tokenId,
      workspaceId: candidate.workspaceId,
      subjectId,
      deviceId,
      connectorId,
      connectionId,
      callerId: candidate.callerId,
      appId: candidate.appId,
      scopes: candidate.scopes.filter((scope): scope is string => typeof scope === 'string'),
      expiresAt: candidate.expiresAt,
      signatureAlgorithm: SIGNATURE_ALGORITHM,
      publicKey: candidate.publicKey,
      status,
      createdAt,
      updatedAt,
      ...(typeof candidate.rotatedAt === 'string' ? { rotatedAt: candidate.rotatedAt } : {}),
      ...(typeof candidate.revokedAt === 'string' ? { revokedAt: candidate.revokedAt } : {}),
      ...(typeof candidate.lastUsedAt === 'string' ? { lastUsedAt: candidate.lastUsedAt } : {}),
      ...(typeof candidate.rotationOfTokenId === 'string' ? { rotationOfTokenId: candidate.rotationOfTokenId } : {}),
    };
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

function homeFromGeneratedAuthPath(generatedAuthPath: string): string {
  return path.dirname(path.dirname(path.dirname(generatedAuthPath)));
}

function recordCredentialAuditEvent(
  config: GatewaySecurityConfig,
  token: StoredToken,
  event: string,
  decision: string,
  status: 'allowed' | 'denied' = 'allowed',
  route?: string,
): void {
  recordGatewayAuditEvent({
    home: homeFromGeneratedAuthPath(config.generatedAuthPath),
    event: {
      event,
      callerId: token.callerId,
      workspaceId: token.workspaceId,
      tokenId: token.tokenId,
      appId: token.appId,
      subjectId: token.subjectId,
      deviceId: token.deviceId,
      connectorId: token.connectorId,
      connectionId: token.connectionId,
      scopes: [...token.scopes],
      ...(route ? { route } : {}),
      decision,
      status,
      timestamp: nowIso(),
    },
  });
}

function denyCredentialUse(input: {
  config: GatewaySecurityConfig;
  token: StoredToken;
  status: number;
  code: string;
  message: string;
  decision: string;
  route: string;
}): VerificationResult {
  recordCredentialAuditEvent(
    input.config,
    input.token,
    'gateway.credential.used',
    input.decision,
    'denied',
    input.route,
  );
  return safeError(input.status, input.code, input.message);
}

function createPublicGatewayMetadata(input: {
  workspaceHost: string;
  upstream: { host: string; port: number };
}): PublicGatewayMetadata {
  requirePrivateUpstream(input.upstream);
  return {
    provider: 'cloudflare',
    routeMode: 'workspace-subdomain',
    connectorMode: 'outbound-os-connector',
    hostname: input.workspaceHost,
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

function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

const DANGEROUS_TOOL_NAMES = new Set([
  'task.merge',
  'task.finish',
  'task.pr',
  'task.push',
  'fs.trash',
  'mac.call',
  'mac.exec',
]);

const ELEVATED_OS_PERMISSIONS = new Set(['execute', 'external', 'admin']);

export function resolveToolScope(toolName: string): ToolScopeResolution {
  const entry = readFullToolManifest().tools.find((candidate) => candidate.name === toolName);
  if (!entry) {
    return {
      ok: false,
      status: 403,
      error: {
        code: 'UNKNOWN_TOOL_SCOPE',
        message: 'Tool is not present in the generated Consuelo tool manifest.',
      },
    };
  }

  let category: 'read' | 'write' | 'dangerous' = 'read';
  if (DANGEROUS_TOOL_NAMES.has(toolName)) {
    category = 'dangerous';
  } else if (entry.kind === 'facade-tool') {
    const capabilities = isJsonObject(entry.definition) && isJsonObject(entry.definition.capabilities)
      ? entry.definition.capabilities
      : null;
    const readOnly = capabilities?.readOnly === true;
    const mutating = capabilities?.mutating === true;
    category = readOnly && !mutating ? 'read' : 'write';
  } else if (entry.kind === 'os-skill') {
    const definition = entry.definition;
    const permission = typeof definition.permission === 'string' ? definition.permission : 'read';
    if (ELEVATED_OS_PERMISSIONS.has(permission)) {
      category = 'dangerous';
    } else if (
      permission === 'write' ||
      permission === 'draft' ||
      definition.writesRecords === true ||
      definition.externalSideEffects === true ||
      definition.requiresApproval === true
    ) {
      category = 'write';
    }
  }

  return {
    ok: true,
    toolName,
    category,
    requiredScope: `tool:${toolName}:${category}`,
    manifestKind: entry.kind,
  };
}

function canonicalRequest(input: {
  tokenId: string;
  workspaceId: string;
  subjectId: string;
  deviceId: string;
  connectorId: string;
  connectionId: string;
  callerId: string;
  appId: string;
  method: string;
  path: string;
  body: string;
  timestamp: string;
  nonce: string;
}): string {
  return [
    input.tokenId,
    input.workspaceId,
    input.subjectId,
    input.deviceId,
    input.connectorId,
    input.connectionId,
    input.callerId,
    input.appId,
    input.method.toUpperCase(),
    input.path,
    input.body,
    input.timestamp,
    input.nonce,
  ].join('\n');
}

function sign(privateKey: string, payload: string): string {
  return cryptoSign(null, Buffer.from(payload), createPrivateKey(privateKey)).toString('base64url');
}

function verifySignature(publicKey: string, payload: string, signature: string): boolean {
  try {
    return cryptoVerify(null, Buffer.from(payload), createPublicKey(publicKey), Buffer.from(signature, 'base64url'));
  } catch {
    return false;
  }
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
  mtls?: { enabled: boolean; caFile: string };
}): GatewaySecurityConfig {
  ensureSecurityDirs(input.home);
  const generatedAuthPath = authPathForHome(input.home);
  const upstream = { host: '127.0.0.1', port: input.upstreamPort ?? 8960 };
  const publicGateway = createPublicGatewayMetadata({
    workspaceHost: input.workspaceHost,
    upstream,
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
        tokens: normalizeStoredTokens(existing.tokens, existing.updatedAt ?? existing.createdAt ?? nowIso()),
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
      ...(input.mtls ? { mtls: input.mtls } : {}),
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
  subjectId?: string;
  deviceId?: string;
  connectorId?: string;
  connectionId?: string;
  scopes: string[];
  expiresInSeconds: number;
}): AgentAppToken {
  const stored = readStoredAuth(input.config);
  const keyPair = generateCredentialKeyPair();
  const timestamp = nowIso();
  const tokenId = `tok_${randomUUID()}`;
  const token: StoredToken = {
    tokenId,
    workspaceId: input.config.workspaceId,
    subjectId: nonEmptyString(input.subjectId) ?? input.callerId,
    deviceId: nonEmptyString(input.deviceId) ?? DEFAULT_DEVICE_ID,
    connectorId: nonEmptyString(input.connectorId) ?? DEFAULT_CONNECTOR_ID,
    connectionId: nonEmptyString(input.connectionId) ?? `connection:${randomUUID()}`,
    callerId: input.callerId,
    appId: input.appId,
    scopes: [...input.scopes],
    expiresAt: new Date(Date.now() + input.expiresInSeconds * 1000).toISOString(),
    signatureAlgorithm: SIGNATURE_ALGORITHM,
    publicKey: keyPair.publicKey,
    status: 'active',
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  recordCredentialAuditEvent(input.config, token, 'gateway.credential.issued', 'issued');
  stored.tokens[token.tokenId] = token;
  writeStoredAuth(input.config, stored);
  return publicTokenFromStored(token, keyPair.privateKey);
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
  const timestamp = nowIso();
  const keyPair = generateCredentialKeyPair();
  const rotatedExisting: StoredToken = {
    ...existing,
    status: 'rotated',
    rotatedAt: timestamp,
    updatedAt: timestamp,
  };
  const rotated: StoredToken = {
    tokenId: `tok_${randomUUID()}`,
    workspaceId: existing.workspaceId,
    subjectId: existing.subjectId,
    deviceId: existing.deviceId,
    connectorId: existing.connectorId,
    connectionId: existing.connectionId,
    callerId: existing.callerId,
    appId: existing.appId,
    scopes: [...existing.scopes],
    expiresAt: existing.expiresAt,
    signatureAlgorithm: SIGNATURE_ALGORITHM,
    publicKey: keyPair.publicKey,
    status: 'active',
    createdAt: timestamp,
    updatedAt: timestamp,
    rotationOfTokenId: existing.tokenId,
  };
  recordCredentialAuditEvent(input.config, rotatedExisting, 'gateway.credential.rotated', 'rotated');
  recordCredentialAuditEvent(input.config, rotated, 'gateway.credential.issued', 'issued');
  stored.tokens[rotatedExisting.tokenId] = rotatedExisting;
  stored.tokens[rotated.tokenId] = rotated;
  writeStoredAuth(input.config, stored);
  return publicTokenFromStored(rotated, keyPair.privateKey);
}

export function revokeAgentAppToken(input: {
  config: GatewaySecurityConfig;
  tokenId: string;
}): void {
  const stored = readStoredAuth(input.config);
  const token = stored.tokens[input.tokenId];
  if (token) {
    const timestamp = nowIso();
    token.status = 'revoked';
    token.revokedAt = timestamp;
    token.updatedAt = timestamp;
    recordCredentialAuditEvent(input.config, token, 'gateway.credential.revoked', 'revoked');
  }
  writeStoredAuth(input.config, stored);
}

export function listAgentAppCredentialStatuses(input: {
  config: GatewaySecurityConfig;
}): AgentAppCredentialStatus[] {
  const stored = readStoredAuth(input.config);
  return Object.values(stored.tokens)
    .map(credentialStatusFromStored)
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
}

export function getAgentAppCredentialStatus(input: {
  config: GatewaySecurityConfig;
  tokenId: string;
}): AgentAppCredentialStatus | null {
  const stored = readStoredAuth(input.config);
  const token = stored.tokens[input.tokenId];
  return token ? credentialStatusFromStored(token) : null;
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
    subjectId: input.token.subjectId,
    deviceId: input.token.deviceId,
    connectorId: input.token.connectorId,
    connectionId: input.token.connectionId,
    callerId: input.token.callerId,
    appId: input.token.appId,
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
      'x-consuelo-subject-id': input.token.subjectId,
      'x-consuelo-device-id': input.token.deviceId,
      'x-consuelo-credential-connector-id': input.token.connectorId,
      'x-consuelo-connection-id': input.token.connectionId,
      'x-consuelo-caller-id': input.token.callerId,
      'x-consuelo-app-id': input.token.appId,
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
  const subjectId = input.headers['x-consuelo-subject-id'];
  const deviceId = input.headers['x-consuelo-device-id'];
  const connectorId = input.headers['x-consuelo-credential-connector-id'];
  const connectionId = input.headers['x-consuelo-connection-id'];
  const callerId = input.headers['x-consuelo-caller-id'];
  const appId = input.headers['x-consuelo-app-id'];

  if (!tokenId || !timestamp || !nonce || !signature || !subjectId || !deviceId || !connectorId || !connectionId || !callerId || !appId) {
    return safeError(401, 'MISSING_SIGNATURE', 'Signed gateway headers are required.');
  }

  if (input.workspaceId !== input.config.workspaceId) {
    return safeError(403, 'WORKSPACE_MISMATCH', 'Workspace identity does not match this gateway.');
  }

  const token = stored.tokens[tokenId];
  if (!token) return safeError(401, 'UNKNOWN_TOKEN', 'Gateway token is not recognized.');
  if (token.status === 'rotated') {
    return denyCredentialUse({
      config: input.config,
      token,
      status: 401,
      code: 'TOKEN_ROTATED',
      message: 'Gateway token has been rotated.',
      decision: 'token_rotated',
      route: input.path,
    });
  }
  if (token.status === 'revoked') {
    return denyCredentialUse({
      config: input.config,
      token,
      status: 401,
      code: 'TOKEN_REVOKED',
      message: 'Gateway token has been revoked.',
      decision: 'token_revoked',
      route: input.path,
    });
  }
  if (token.workspaceId !== input.workspaceId) {
    return denyCredentialUse({
      config: input.config,
      token,
      status: 403,
      code: 'WORKSPACE_MISMATCH',
      message: 'Gateway token workspace does not match the signed request.',
      decision: 'workspace_mismatch',
      route: input.path,
    });
  }
  if (token.subjectId !== subjectId) {
    return denyCredentialUse({
      config: input.config,
      token,
      status: 403,
      code: 'SUBJECT_MISMATCH',
      message: 'Gateway subject identity does not match this token.',
      decision: 'subject_mismatch',
      route: input.path,
    });
  }
  if (token.deviceId !== deviceId) {
    return denyCredentialUse({
      config: input.config,
      token,
      status: 403,
      code: 'DEVICE_MISMATCH',
      message: 'Gateway device identity does not match this token.',
      decision: 'device_mismatch',
      route: input.path,
    });
  }
  if (token.connectorId !== connectorId) {
    return denyCredentialUse({
      config: input.config,
      token,
      status: 403,
      code: 'CONNECTOR_MISMATCH',
      message: 'Gateway connector identity does not match this token.',
      decision: 'connector_mismatch',
      route: input.path,
    });
  }
  if (token.connectionId !== connectionId) {
    return denyCredentialUse({
      config: input.config,
      token,
      status: 403,
      code: 'CONNECTION_MISMATCH',
      message: 'Gateway connection identity does not match this token.',
      decision: 'connection_mismatch',
      route: input.path,
    });
  }
  if (token.callerId !== callerId) {
    return denyCredentialUse({
      config: input.config,
      token,
      status: 403,
      code: 'CALLER_MISMATCH',
      message: 'Gateway caller identity does not match this token.',
      decision: 'caller_mismatch',
      route: input.path,
    });
  }
  if (token.appId !== appId) {
    return denyCredentialUse({
      config: input.config,
      token,
      status: 403,
      code: 'APP_MISMATCH',
      message: 'Gateway app identity does not match this token.',
      decision: 'app_mismatch',
      route: input.path,
    });
  }

  const requestTime = Date.parse(timestamp);
  const nowTime = Date.parse(input.now);
  if (!Number.isFinite(requestTime) || !Number.isFinite(nowTime)) {
    return denyCredentialUse({
      config: input.config,
      token,
      status: 401,
      code: 'EXPIRED_TIMESTAMP',
      message: 'Gateway timestamp is invalid.',
      decision: 'invalid_timestamp',
      route: input.path,
    });
  }
  if (Math.abs(nowTime - requestTime) > MAX_TIMESTAMP_SKEW_MS) {
    return denyCredentialUse({
      config: input.config,
      token,
      status: 401,
      code: 'EXPIRED_TIMESTAMP',
      message: 'Gateway timestamp is outside the allowed window.',
      decision: 'expired_timestamp',
      route: input.path,
    });
  }

  const expiresAt = Date.parse(token.expiresAt);
  if (!Number.isFinite(expiresAt) || expiresAt <= nowTime) {
    return denyCredentialUse({
      config: input.config,
      token,
      status: 401,
      code: 'TOKEN_EXPIRED',
      message: 'Gateway token has expired.',
      decision: 'token_expired',
      route: input.path,
    });
  }

  pruneSeenNonces(stored, nowTime);
  if (stored.seenNonces[nonce]) {
    return denyCredentialUse({
      config: input.config,
      token,
      status: 401,
      code: 'REPLAYED_NONCE',
      message: 'Gateway nonce has already been used.',
      decision: 'replayed_nonce',
      route: input.path,
    });
  }

  if (token.signatureAlgorithm !== SIGNATURE_ALGORITHM) {
    return denyCredentialUse({
      config: input.config,
      token,
      status: 401,
      code: 'BAD_SIGNATURE',
      message: 'Gateway signature could not be verified.',
      decision: 'unsupported_signature_algorithm',
      route: input.path,
    });
  }

  const payload = canonicalRequest({
    tokenId,
    workspaceId: input.config.workspaceId,
    subjectId: token.subjectId,
    deviceId: token.deviceId,
    connectorId: token.connectorId,
    connectionId: token.connectionId,
    callerId: token.callerId,
    appId: token.appId,
    method: input.method,
    path: input.path,
    body: input.body,
    timestamp,
    nonce,
  });
  if (!verifySignature(token.publicKey, payload, signature)) {
    return denyCredentialUse({
      config: input.config,
      token,
      status: 401,
      code: 'BAD_SIGNATURE',
      message: 'Gateway signature could not be verified.',
      decision: 'bad_signature',
      route: input.path,
    });
  }

  if (!token.scopes.includes(input.requiredScope)) {
    return denyCredentialUse({
      config: input.config,
      token,
      status: 403,
      code: 'MISSING_SCOPE',
      message: 'Gateway token does not grant the required scope.',
      decision: 'missing_scope',
      route: input.path,
    });
  }

  const verifiedAt = new Date(nowTime).toISOString();
  stored.seenNonces[nonce] = { tokenId, seenAt: verifiedAt };
  token.lastUsedAt = verifiedAt;
  token.updatedAt = verifiedAt;
  recordCredentialAuditEvent(
    input.config,
    token,
    'gateway.credential.used',
    'verified',
    'allowed',
    input.path,
  );
  writeStoredAuth(input.config, stored);
  return {
    ok: true,
    caller: {
      workspaceId: token.workspaceId,
      subjectId: token.subjectId,
      deviceId: token.deviceId,
      connectorId: token.connectorId,
      connectionId: token.connectionId,
      callerId: token.callerId,
      appId: token.appId,
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
  return `${input.workspaceHost} {\n  encode zstd gzip\n  request_body {\n    max_size 4MB\n  }\n  header {\n    -Server\n    X-Content-Type-Options \"nosniff\"\n    Referrer-Policy \"no-referrer\"\n    Permissions-Policy \"camera=(), microphone=(), geolocation=()\"\n  }${mtlsBlock}\n  reverse_proxy ${input.upstream.host}:${input.upstream.port} {\n    header_up -X-Consuelo-Edge-Signature\n    header_up -X-Consuelo-Edge-Cache-Authority\n    header_up -X-Consuelo-Route\n    header_up -X-Consuelo-Surface\n    header_up -X-Consuelo-Connector-Id\n    header_up X-Forwarded-Host {host}\n    header_up X-Forwarded-Proto {scheme}\n    transport http {\n      dial_timeout 5s\n      response_header_timeout 15s\n      read_timeout 60s\n      write_timeout 60s\n    }\n  }\n}\n`;
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




