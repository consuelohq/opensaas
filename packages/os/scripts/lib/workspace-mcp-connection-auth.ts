import { createHash, randomBytes, randomUUID } from 'node:crypto';

export const MCP_ACCESS_SCOPE = 'route:/mcp:access';

const MCP_CREDENTIAL_KEY_PREFIX = 'mcp-credential:sha256:';
const MCP_CREDENTIAL_ID_KEY_PREFIX = 'mcp-credential-id:';
const MCP_CREDENTIAL_INDEX_KEY_PREFIX = 'mcp-credential-index:';
const MCP_AUDIT_KEY_PREFIX = 'mcp-credential-audit:';
const MCP_AUDIT_INDEX_KEY_PREFIX = 'mcp-credential-audit-index:';
const MCP_OAUTH_STATE_KEY_PREFIX = 'mcp-oauth-state:';
const MCP_APPROVED_BINDING_KEY_PREFIX = 'mcp-approved-binding:';
const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_TOKENINFO_URL = 'https://oauth2.googleapis.com/tokeninfo';
const GOOGLE_SCOPE = 'openid email profile';
const OAUTH_STATE_TTL_SECONDS = 10 * 60;

export type StoredWorkspaceMcpConnectionCredential = {
  credentialId: string;
  credentialHash: string;
  workspaceId: string;
  connectorId: string;
  deviceId: string;
  subjectId: string;
  subjectEmail?: string;
  capabilities: string[];
  scopes: string[];
  status: 'active' | 'rotated' | 'revoked';
  createdAt: string;
  lastUsedAt?: string;
  rotatedAt?: string;
  revokedAt?: string;
  replacedByCredentialId?: string;
};

export type WorkspaceMcpConnectionCredentialKv = {
  get: <T = unknown>(key: string, options?: unknown) => Promise<T | null>;
  put: (key: string, value: string, options?: unknown) => Promise<void>;
  delete?: (key: string) => Promise<void>;
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

export type WorkspaceMcpConnectionSummary = {
  credentialId: string;
  workspaceId: string;
  connectorId: string;
  deviceId: string;
  subjectId: string;
  subjectEmail?: string;
  capabilities: string[];
  scopes: string[];
  status: 'active' | 'rotated' | 'revoked';
  createdAt: string;
  lastUsedAt?: string;
  rotatedAt?: string;
  revokedAt?: string;
};

export type WorkspaceMcpIssuedConnectionCredential = WorkspaceMcpConnectionSummary & {
  credential: string;
};

export type WorkspaceMcpConnectionAuditEvent = {
  eventId: string;
  action: 'issued' | 'rotated' | 'revoked';
  credentialId: string;
  workspaceId: string;
  connectorId: string;
  deviceId: string;
  subjectId: string;
  timestamp: string;
  replacementCredentialId?: string;
  sourceCredentialId?: string;
};

export type WorkspaceMcpConnectionCredentialStore = {
  validate: (input: {
    credential: string;
    workspaceId: string;
    connectorId: string;
    requiredScope: string;
    now: string;
  }) => Promise<WorkspaceMcpCredentialValidationResult>;
  issue: (input: {
    workspaceId: string;
    connectorId: string;
    deviceId: string;
    subjectId: string;
    subjectEmail?: string;
    capabilities: string[];
    scopes: string[];
    now: string;
    sourceCredentialId?: string;
  }) => Promise<WorkspaceMcpIssuedConnectionCredential>;
  list: (input: {
    workspaceId: string;
    connectorId: string;
    subjectId: string;
  }) => Promise<WorkspaceMcpConnectionSummary[]>;
  rotate: (input: {
    credentialId: string;
    workspaceId: string;
    connectorId: string;
    subjectId: string;
    now: string;
  }) => Promise<WorkspaceMcpIssuedConnectionCredential>;
  revoke: (input: {
    credentialId: string;
    workspaceId: string;
    connectorId: string;
    subjectId: string;
    now: string;
  }) => Promise<WorkspaceMcpConnectionSummary>;
  audit: (input: {
    credentialId: string;
    workspaceId: string;
    connectorId: string;
    subjectId: string;
  }) => Promise<WorkspaceMcpConnectionAuditEvent[]>;
};

export type WorkspaceMcpApprovedConnectorBinding = {
  workspaceId: string;
  connectorId: string;
  deviceId: string;
  subjectId: string;
  subjectEmail?: string;
  capabilities: string[];
  status: 'active' | 'disabled' | 'revoked';
  approvedAt: string;
  disabledAt?: string;
  revokedAt?: string;
};

export type WorkspaceMcpApprovedConnectorBindingStore = {
  findApprovedBinding: (input: {
    workspaceId: string;
    connectorId: string;
    subjectId: string;
    now: string;
  }) => Promise<WorkspaceMcpApprovedConnectorBinding | null>;
};

export type WorkspaceMcpGoogleIdentity = {
  sub: string;
  email: string;
  emailVerified: boolean;
};

export type WorkspaceMcpConnectionAuthContext = {
  workspaceId: string;
  hostname: string;
  connectorId: string;
};

export type WorkspaceMcpConnectionAuthHandler = {
  fetch: (request: Request, context: WorkspaceMcpConnectionAuthContext) => Promise<Response | null>;
};

type CredentialPointer = {
  storageKey: string;
};

type CredentialIndex = {
  credentialIds: string[];
};

type AuditIndex = {
  eventKeys: string[];
};

type OAuthState = {
  state: string;
  workspaceId: string;
  hostname: string;
  connectorId: string;
  redirectUri: string;
  createdAt: string;
  expiresAt: string;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const stringArray = (value: unknown): string[] | null =>
  Array.isArray(value) && value.every((item) => typeof item === 'string')
    ? [...value]
    : null;

const sha256Hex = (value: string): string =>
  createHash('sha256').update(value).digest('hex');

const randomSecret = (): string =>
  `mcp_${randomBytes(32).toString('base64url')}`;

const nowIso = (): string => new Date().toISOString();

export const mcpConnectionCredentialStorageKey = (credential: string): string =>
  `${MCP_CREDENTIAL_KEY_PREFIX}${sha256Hex(credential)}`;

export const workspaceMcpApprovedBindingStorageKey = (input: {
  workspaceId: string;
  connectorId: string;
  subjectId: string;
}): string =>
  `${MCP_APPROVED_BINDING_KEY_PREFIX}${input.workspaceId}:${input.connectorId}:${sha256Hex(input.subjectId)}`;

const credentialIdKey = (credentialId: string): string =>
  `${MCP_CREDENTIAL_ID_KEY_PREFIX}${credentialId}`;

const credentialIndexKey = (input: {
  workspaceId: string;
  connectorId: string;
  subjectId: string;
}): string =>
  `${MCP_CREDENTIAL_INDEX_KEY_PREFIX}${input.workspaceId}:${input.connectorId}:${sha256Hex(input.subjectId)}`;

const auditIndexKey = (credentialId: string): string =>
  `${MCP_AUDIT_INDEX_KEY_PREFIX}${credentialId}`;

const oauthStateKey = (state: string): string => `${MCP_OAUTH_STATE_KEY_PREFIX}${state}`;

const isStoredMcpConnectionCredential = (
  value: unknown,
): value is StoredWorkspaceMcpConnectionCredential => {
  if (!isRecord(value)) return false;
  const scopes = stringArray(value.scopes);
  const capabilities = stringArray(value.capabilities);
  return (
    typeof value.credentialId === 'string' &&
    typeof value.credentialHash === 'string' &&
    typeof value.workspaceId === 'string' &&
    typeof value.connectorId === 'string' &&
    typeof value.deviceId === 'string' &&
    typeof value.subjectId === 'string' &&
    (typeof value.subjectEmail === 'undefined' || typeof value.subjectEmail === 'string') &&
    Boolean(scopes) &&
    Boolean(capabilities) &&
    (value.status === 'active' || value.status === 'rotated' || value.status === 'revoked') &&
    typeof value.createdAt === 'string'
  );
};

const isCredentialPointer = (value: unknown): value is CredentialPointer =>
  isRecord(value) && typeof value.storageKey === 'string';

const isCredentialIndex = (value: unknown): value is CredentialIndex =>
  isRecord(value) && Boolean(stringArray(value.credentialIds));

const isAuditIndex = (value: unknown): value is AuditIndex =>
  isRecord(value) && Boolean(stringArray(value.eventKeys));

const isAuditEvent = (value: unknown): value is WorkspaceMcpConnectionAuditEvent =>
  isRecord(value) &&
  typeof value.eventId === 'string' &&
  (value.action === 'issued' || value.action === 'rotated' || value.action === 'revoked') &&
  typeof value.credentialId === 'string' &&
  typeof value.workspaceId === 'string' &&
  typeof value.connectorId === 'string' &&
  typeof value.deviceId === 'string' &&
  typeof value.subjectId === 'string' &&
  typeof value.timestamp === 'string';

const isApprovedBinding = (value: unknown): value is WorkspaceMcpApprovedConnectorBinding => {
  if (!isRecord(value)) return false;
  const capabilities = stringArray(value.capabilities);
  return (
    typeof value.workspaceId === 'string' &&
    typeof value.connectorId === 'string' &&
    typeof value.deviceId === 'string' &&
    typeof value.subjectId === 'string' &&
    (typeof value.subjectEmail === 'undefined' || typeof value.subjectEmail === 'string') &&
    Boolean(capabilities) &&
    (value.status === 'active' || value.status === 'disabled' || value.status === 'revoked') &&
    typeof value.approvedAt === 'string'
  );
};

const isOAuthState = (value: unknown): value is OAuthState =>
  isRecord(value) &&
  typeof value.state === 'string' &&
  typeof value.workspaceId === 'string' &&
  typeof value.hostname === 'string' &&
  typeof value.connectorId === 'string' &&
  typeof value.redirectUri === 'string' &&
  typeof value.createdAt === 'string' &&
  typeof value.expiresAt === 'string';

const readJson = async <T>(input: {
  kv: WorkspaceMcpConnectionCredentialKv;
  key: string;
  guard: (value: unknown) => value is T;
}): Promise<T | null> => {
  const value = await input.kv.get<unknown>(input.key, { type: 'json' });
  return input.guard(value) ? value : null;
};

const unique = (values: string[]): string[] => [...new Set(values)];

const summaryFromRecord = (
  record: StoredWorkspaceMcpConnectionCredential,
): WorkspaceMcpConnectionSummary => ({
  credentialId: record.credentialId,
  workspaceId: record.workspaceId,
  connectorId: record.connectorId,
  deviceId: record.deviceId,
  subjectId: record.subjectId,
  ...(record.subjectEmail ? { subjectEmail: record.subjectEmail } : {}),
  capabilities: [...record.capabilities],
  scopes: [...record.scopes],
  status: record.status,
  createdAt: record.createdAt,
  ...(record.lastUsedAt ? { lastUsedAt: record.lastUsedAt } : {}),
  ...(record.rotatedAt ? { rotatedAt: record.rotatedAt } : {}),
  ...(record.revokedAt ? { revokedAt: record.revokedAt } : {}),
});

const issuedFromRecord = (input: {
  record: StoredWorkspaceMcpConnectionCredential;
  credential: string;
}): WorkspaceMcpIssuedConnectionCredential => ({
  ...summaryFromRecord(input.record),
  credential: input.credential,
});

const readRecordByStorageKey = async (input: {
  kv: WorkspaceMcpConnectionCredentialKv;
  storageKey: string;
}): Promise<StoredWorkspaceMcpConnectionCredential | null> => {
  try {
    return await readJson({
      kv: input.kv,
      key: input.storageKey,
      guard: isStoredMcpConnectionCredential,
    });
  } catch {
    return null;
  }
};

const readRecordById = async (input: {
  kv: WorkspaceMcpConnectionCredentialKv;
  credentialId: string;
}): Promise<{ record: StoredWorkspaceMcpConnectionCredential; storageKey: string } | null> => {
  try {
    const pointer = await readJson({
      kv: input.kv,
      key: credentialIdKey(input.credentialId),
      guard: isCredentialPointer,
    });
    if (!pointer) return null;
    const record = await readRecordByStorageKey({ kv: input.kv, storageKey: pointer.storageKey });
    return record ? { record, storageKey: pointer.storageKey } : null;
  } catch {
    return null;
  }
};

const writeRecord = async (input: {
  kv: WorkspaceMcpConnectionCredentialKv;
  record: StoredWorkspaceMcpConnectionCredential;
  storageKey: string;
}): Promise<void> => {
  try {
    await input.kv.put(input.storageKey, JSON.stringify(input.record));
    await input.kv.put(credentialIdKey(input.record.credentialId), JSON.stringify({ storageKey: input.storageKey }));
  } catch {
    throw new Error('MCP credential record write failed');
  }
};

const appendCredentialIndex = async (input: {
  kv: WorkspaceMcpConnectionCredentialKv;
  record: StoredWorkspaceMcpConnectionCredential;
}): Promise<void> => {
  try {
    const key = credentialIndexKey(input.record);
    const existing = await readJson({ kv: input.kv, key, guard: isCredentialIndex });
    await input.kv.put(
      key,
      JSON.stringify({ credentialIds: unique([...(existing?.credentialIds ?? []), input.record.credentialId]) }),
    );
  } catch {
    throw new Error('MCP credential index write failed');
  }
};

const recordAuditEvent = async (input: {
  kv: WorkspaceMcpConnectionCredentialKv;
  event: WorkspaceMcpConnectionAuditEvent;
}): Promise<void> => {
  try {
    const eventKey = `${MCP_AUDIT_KEY_PREFIX}${input.event.credentialId}:${input.event.timestamp}:${input.event.eventId}`;
    await input.kv.put(eventKey, JSON.stringify(input.event));
    const indexKey = auditIndexKey(input.event.credentialId);
    const existing = await readJson({ kv: input.kv, key: indexKey, guard: isAuditIndex });
    await input.kv.put(
      indexKey,
      JSON.stringify({ eventKeys: unique([...(existing?.eventKeys ?? []), eventKey]) }),
    );
  } catch {
    throw new Error('MCP credential audit write failed');
  }
};

const createAuditEvent = (input: {
  action: WorkspaceMcpConnectionAuditEvent['action'];
  record: StoredWorkspaceMcpConnectionCredential;
  now: string;
  replacementCredentialId?: string;
  sourceCredentialId?: string;
}): WorkspaceMcpConnectionAuditEvent => ({
  eventId: `mcpaud_${randomUUID()}`,
  action: input.action,
  credentialId: input.record.credentialId,
  workspaceId: input.record.workspaceId,
  connectorId: input.record.connectorId,
  deviceId: input.record.deviceId,
  subjectId: input.record.subjectId,
  timestamp: input.now,
  ...(input.replacementCredentialId ? { replacementCredentialId: input.replacementCredentialId } : {}),
  ...(input.sourceCredentialId ? { sourceCredentialId: input.sourceCredentialId } : {}),
});

export const createWorkspaceMcpConnectionCredentialStore = (input: {
  kv: WorkspaceMcpConnectionCredentialKv;
  randomCredential?: () => string;
  now?: () => string;
}): WorkspaceMcpConnectionCredentialStore => {
  const credentialFactory = input.randomCredential ?? randomSecret;
  const clock = input.now ?? nowIso;

  const issueRecord = async (issueInput: Parameters<WorkspaceMcpConnectionCredentialStore['issue']>[0]) => {
    try {
      const credential = credentialFactory();
      const storageKey = mcpConnectionCredentialStorageKey(credential);
      const record: StoredWorkspaceMcpConnectionCredential = {
        credentialId: `mcpcred_${randomUUID()}`,
        credentialHash: sha256Hex(credential),
        workspaceId: issueInput.workspaceId,
        connectorId: issueInput.connectorId,
        deviceId: issueInput.deviceId,
        subjectId: issueInput.subjectId,
        ...(issueInput.subjectEmail ? { subjectEmail: issueInput.subjectEmail } : {}),
        capabilities: [...issueInput.capabilities],
        scopes: [...issueInput.scopes],
        status: 'active',
        createdAt: issueInput.now,
      };
      await writeRecord({ kv: input.kv, record, storageKey });
      await appendCredentialIndex({ kv: input.kv, record });
      await recordAuditEvent({
        kv: input.kv,
        event: createAuditEvent({
          action: 'issued',
          record,
          now: issueInput.now,
          sourceCredentialId: issueInput.sourceCredentialId,
        }),
      });
      if (issueInput.sourceCredentialId) {
        await recordAuditEvent({
          kv: input.kv,
          event: createAuditEvent({
            action: 'rotated',
            record,
            now: issueInput.now,
            sourceCredentialId: issueInput.sourceCredentialId,
          }),
        });
      }
      return issuedFromRecord({ record, credential });
    } catch {
      throw new Error('MCP credential issue failed');
    }
  };

  return {
    async validate(request) {
      try {
        const storageKey = mcpConnectionCredentialStorageKey(request.credential);
        const stored = await readRecordByStorageKey({ kv: input.kv, storageKey });
        if (!stored || stored.credentialHash !== sha256Hex(request.credential)) {
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
          .put(storageKey, JSON.stringify({ ...stored, lastUsedAt: request.now }))
          .catch(() => undefined);
        return {
          allowed: true,
          credentialId: stored.credentialId,
          workspaceId: stored.workspaceId,
          connectorId: stored.connectorId,
          subjectId: stored.subjectId,
          scopes: [...stored.scopes],
        };
      } catch {
        return { allowed: false, status: 401, errorCode: 'WORKSPACE_MCP_CREDENTIAL_INVALID' };
      }
    },
    issue(issueInput) {
      return issueRecord(issueInput);
    },
    async list(listInput) {
      try {
        const index = await readJson({
          kv: input.kv,
          key: credentialIndexKey(listInput),
          guard: isCredentialIndex,
        });
        const records = await Promise.all(
          (index?.credentialIds ?? []).map((credentialId) => readRecordById({ kv: input.kv, credentialId })),
        );
        return records
          .filter((item): item is { record: StoredWorkspaceMcpConnectionCredential; storageKey: string } => Boolean(item))
          .map((item) => summaryFromRecord(item.record));
      } catch {
        throw new Error('MCP credential list failed');
      }
    },
    async rotate(rotateInput) {
      try {
        const existing = await readRecordById({ kv: input.kv, credentialId: rotateInput.credentialId });
        if (!existing || existing.record.workspaceId !== rotateInput.workspaceId || existing.record.connectorId !== rotateInput.connectorId || existing.record.subjectId !== rotateInput.subjectId) {
          throw new Error('MCP credential not found for subject');
        }
        if (existing.record.status !== 'active') {
          throw new Error('MCP credential is not active');
        }
        const next = await issueRecord({
          workspaceId: existing.record.workspaceId,
          connectorId: existing.record.connectorId,
          deviceId: existing.record.deviceId,
          subjectId: existing.record.subjectId,
          subjectEmail: existing.record.subjectEmail,
          capabilities: existing.record.capabilities,
          scopes: existing.record.scopes,
          now: rotateInput.now,
          sourceCredentialId: existing.record.credentialId,
        });
        const rotated: StoredWorkspaceMcpConnectionCredential = {
          ...existing.record,
          status: 'rotated',
          rotatedAt: rotateInput.now,
          replacedByCredentialId: next.credentialId,
        };
        await writeRecord({ kv: input.kv, record: rotated, storageKey: existing.storageKey });
        await recordAuditEvent({
          kv: input.kv,
          event: createAuditEvent({
            action: 'rotated',
            record: rotated,
            now: rotateInput.now,
            replacementCredentialId: next.credentialId,
          }),
        });
        return next;
      } catch {
        throw new Error('MCP credential rotate failed');
      }
    },
    async revoke(revokeInput) {
      try {
        const existing = await readRecordById({ kv: input.kv, credentialId: revokeInput.credentialId });
        if (!existing || existing.record.workspaceId !== revokeInput.workspaceId || existing.record.connectorId !== revokeInput.connectorId || existing.record.subjectId !== revokeInput.subjectId) {
          throw new Error('MCP credential not found for subject');
        }
        const revoked: StoredWorkspaceMcpConnectionCredential = {
          ...existing.record,
          status: 'revoked',
          revokedAt: revokeInput.now,
        };
        await writeRecord({ kv: input.kv, record: revoked, storageKey: existing.storageKey });
        await recordAuditEvent({
          kv: input.kv,
          event: createAuditEvent({ action: 'revoked', record: revoked, now: revokeInput.now }),
        });
        return summaryFromRecord(revoked);
      } catch {
        throw new Error('MCP credential revoke failed');
      }
    },
    async audit(auditInput) {
      try {
        const target = await readRecordById({ kv: input.kv, credentialId: auditInput.credentialId });
        if (!target || target.record.workspaceId !== auditInput.workspaceId || target.record.connectorId !== auditInput.connectorId || target.record.subjectId !== auditInput.subjectId) {
          throw new Error('MCP credential not found for subject');
        }
        const index = await readJson({ kv: input.kv, key: auditIndexKey(auditInput.credentialId), guard: isAuditIndex });
        const events = await Promise.all(
          (index?.eventKeys ?? []).map((key) => readJson({ kv: input.kv, key, guard: isAuditEvent })),
        );
        return events.filter((event): event is WorkspaceMcpConnectionAuditEvent => Boolean(event));
      } catch {
        throw new Error('MCP credential audit read failed');
      }
    },
  };
};

export const createWorkspaceMcpApprovedConnectorBindingStore = (input: {
  kv: WorkspaceMcpConnectionCredentialKv;
}): WorkspaceMcpApprovedConnectorBindingStore => ({
  async findApprovedBinding(request) {
    try {
      const binding = await readJson({
        kv: input.kv,
        key: workspaceMcpApprovedBindingStorageKey(request),
        guard: isApprovedBinding,
      });
      if (!binding || binding.status !== 'active') return null;
      if (binding.workspaceId !== request.workspaceId || binding.connectorId !== request.connectorId || binding.subjectId !== request.subjectId) {
        return null;
      }
      return {
        ...binding,
        capabilities: [...binding.capabilities],
      };
    } catch {
      return null;
    }
  },
});

const jsonResponse = (body: unknown, init: ResponseInit = {}): Response =>
  new Response(JSON.stringify(body, null, 2), {
    ...init,
    headers: {
      'cache-control': 'no-store',
      'content-type': 'application/json; charset=utf-8',
      'x-content-type-options': 'nosniff',
      ...(init.headers ?? {}),
    },
  });

const jsonError = (status: number, code: string): Response =>
  jsonResponse({ error: { code, message: 'MCP connection request was not authorized.' } }, { status });

const methodNotAllowed = (allow: string): Response =>
  new Response('Method not allowed\n', {
    status: 405,
    headers: {
      allow,
      'cache-control': 'no-store',
      'content-type': 'text/plain; charset=utf-8',
      'x-content-type-options': 'nosniff',
    },
  });

const redirectUriFor = (request: Request): string => {
  const url = new URL(request.url);
  return new URL('/mcp/oauth/callback', url.origin).toString();
};

const googleAuthRedirect = (input: {
  clientId: string;
  state: string;
  redirectUri: string;
}): string => {
  const url = new URL(GOOGLE_AUTH_URL);
  url.searchParams.set('client_id', input.clientId);
  url.searchParams.set('redirect_uri', input.redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', GOOGLE_SCOPE);
  url.searchParams.set('state', input.state);
  url.searchParams.set('access_type', 'online');
  url.searchParams.set('prompt', 'select_account');
  return url.toString();
};

export const createGoogleOAuthIdentityVerifier = (input: {
  clientId: string;
  clientSecret: string;
  fetchImpl?: typeof fetch;
}) => async (request: { code: string; redirectUri: string }): Promise<WorkspaceMcpGoogleIdentity> => {
  try {
    const fetchImpl = input.fetchImpl ?? ((url, init) => globalThis.fetch(url, init));
    const tokenResponse = await fetchImpl(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { accept: 'application/json', 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code: request.code,
        client_id: input.clientId,
        client_secret: input.clientSecret,
        redirect_uri: request.redirectUri,
        grant_type: 'authorization_code',
      }).toString(),
    });
    const tokenJson = await tokenResponse.json() as unknown;
    const idToken = isRecord(tokenJson) && typeof tokenJson.id_token === 'string' ? tokenJson.id_token : '';
    if (!tokenResponse.ok || !idToken) throw new Error('google token exchange failed');

    const infoUrl = new URL(GOOGLE_TOKENINFO_URL);
    infoUrl.searchParams.set('id_token', idToken);
    const infoResponse = await fetchImpl(infoUrl.toString(), { headers: { accept: 'application/json' } });
    const infoJson = await infoResponse.json() as unknown;
    if (!infoResponse.ok || !isRecord(infoJson)) throw new Error('google identity verification failed');
    if (infoJson.aud !== input.clientId) throw new Error('google audience mismatch');
    const sub = typeof infoJson.sub === 'string' ? infoJson.sub : '';
    const email = typeof infoJson.email === 'string' ? infoJson.email : '';
    const emailVerified = infoJson.email_verified === true || infoJson.email_verified === 'true';
    if (!sub || !email || !emailVerified) throw new Error('verified google email required');
    return { sub, email, emailVerified };
  } catch {
    throw new Error('Google identity verification failed');
  }
};

export const isWorkspaceMcpConnectionAuthPath = (pathname: string): boolean =>
  pathname === '/mcp/oauth/start' ||
  pathname === '/mcp/oauth/callback' ||
  pathname === '/mcp/connections' ||
  /^\/mcp\/connections\/[^/]+\/(rotate|revoke|audit)$/.test(pathname);

const bearerCredential = (request: Request): string | null => {
  const authorization = request.headers.get('authorization')?.trim() ?? '';
  const match = /^Bearer\s+(.+)$/i.exec(authorization);
  return match?.[1]?.trim() || null;
};

const credentialPayload = (issued: WorkspaceMcpIssuedConnectionCredential): Record<string, unknown> => ({
  mcp_connection_credential: issued.credential,
  credential_id: issued.credentialId,
  token_type: 'bearer',
  workspace_id: issued.workspaceId,
  connector_id: issued.connectorId,
  device_id: issued.deviceId,
  subject_id: issued.subjectId,
  ...(issued.subjectEmail ? { subject_email: issued.subjectEmail } : {}),
  scopes: [...issued.scopes],
  capabilities: [...issued.capabilities],
  status: issued.status,
  created_at: issued.createdAt,
});

const connectionPayload = (connection: WorkspaceMcpConnectionSummary): Record<string, unknown> => ({
  credential_id: connection.credentialId,
  workspace_id: connection.workspaceId,
  connector_id: connection.connectorId,
  device_id: connection.deviceId,
  subject_id: connection.subjectId,
  ...(connection.subjectEmail ? { subject_email: connection.subjectEmail } : {}),
  scopes: [...connection.scopes],
  capabilities: [...connection.capabilities],
  status: connection.status,
  created_at: connection.createdAt,
  ...(connection.lastUsedAt ? { last_used_at: connection.lastUsedAt } : {}),
  ...(connection.rotatedAt ? { rotated_at: connection.rotatedAt } : {}),
  ...(connection.revokedAt ? { revoked_at: connection.revokedAt } : {}),
});

const authorizeManagement = async (input: {
  request: Request;
  context: WorkspaceMcpConnectionAuthContext;
  credentials: WorkspaceMcpConnectionCredentialStore;
  now: string;
}): Promise<
  | { ok: true; credentialId: string; subjectId: string }
  | { ok: false; response: Response }
> => {
  try {
    const credential = bearerCredential(input.request);
    if (!credential) return { ok: false, response: jsonError(401, 'WORKSPACE_MCP_CREDENTIAL_REQUIRED') };
    const decision = await input.credentials.validate({
      credential,
      workspaceId: input.context.workspaceId,
      connectorId: input.context.connectorId,
      requiredScope: MCP_ACCESS_SCOPE,
      now: input.now,
    });
    if (!decision.allowed) return { ok: false, response: jsonError(decision.status, decision.errorCode) };
    return { ok: true, credentialId: decision.credentialId, subjectId: decision.subjectId };
  } catch {
    return { ok: false, response: jsonError(401, 'WORKSPACE_MCP_CREDENTIAL_INVALID') };
  }
};

export const createWorkspaceMcpConnectionAuthHandler = (input: {
  approvedBindings: WorkspaceMcpApprovedConnectorBindingStore;
  credentials: WorkspaceMcpConnectionCredentialStore;
  oauthStateKv: WorkspaceMcpConnectionCredentialKv;
  googleOAuthClientId: string;
  googleOAuthClientSecret: string;
  googleIdentity?: (input: { code: string; redirectUri: string }) => Promise<WorkspaceMcpGoogleIdentity>;
  now?: () => string;
}): WorkspaceMcpConnectionAuthHandler => {
  const clock = input.now ?? nowIso;
  const googleIdentity = input.googleIdentity ?? createGoogleOAuthIdentityVerifier({
    clientId: input.googleOAuthClientId,
    clientSecret: input.googleOAuthClientSecret,
  });

  return {
    async fetch(request, context) {
      try {
      const url = new URL(request.url);
      if (!isWorkspaceMcpConnectionAuthPath(url.pathname)) return null;
      const now = clock();

      if (url.pathname === '/mcp/oauth/start') {
        if (request.method !== 'GET') return methodNotAllowed('GET');
        if (!input.googleOAuthClientId.trim() || !input.googleOAuthClientSecret.trim()) {
          return jsonError(503, 'WORKSPACE_MCP_OAUTH_NOT_CONFIGURED');
        }
        const state = `mcp_state_${randomBytes(18).toString('base64url')}`;
        const redirectUri = redirectUriFor(request);
        const stateRecord: OAuthState = {
          state,
          workspaceId: context.workspaceId,
          hostname: context.hostname,
          connectorId: context.connectorId,
          redirectUri,
          createdAt: now,
          expiresAt: new Date(Date.parse(now) + OAUTH_STATE_TTL_SECONDS * 1000).toISOString(),
        };
        await input.oauthStateKv.put(oauthStateKey(state), JSON.stringify(stateRecord), {
          expirationTtl: OAUTH_STATE_TTL_SECONDS,
        });
        return Response.redirect(googleAuthRedirect({
          clientId: input.googleOAuthClientId,
          state,
          redirectUri,
        }), 302);
      }

      if (url.pathname === '/mcp/oauth/callback') {
        if (request.method !== 'GET') return methodNotAllowed('GET');
        const state = url.searchParams.get('state') ?? '';
        const code = url.searchParams.get('code') ?? '';
        if (!state || !code) return jsonError(400, 'WORKSPACE_MCP_OAUTH_CALLBACK_INVALID');
        const stateRecord = await readJson({ kv: input.oauthStateKv, key: oauthStateKey(state), guard: isOAuthState });
        if (!stateRecord) return jsonError(400, 'WORKSPACE_MCP_OAUTH_STATE_NOT_FOUND');
        await input.oauthStateKv.delete?.(oauthStateKey(state));
        if (Date.parse(now) >= Date.parse(stateRecord.expiresAt)) {
          return jsonError(410, 'WORKSPACE_MCP_OAUTH_STATE_EXPIRED');
        }
        if (stateRecord.workspaceId !== context.workspaceId || stateRecord.connectorId !== context.connectorId) {
          return jsonError(403, 'WORKSPACE_MCP_OAUTH_ROUTE_MISMATCH');
        }
        const identity = await googleIdentity({ code, redirectUri: stateRecord.redirectUri });
        if (!identity.emailVerified) return jsonError(403, 'WORKSPACE_MCP_GOOGLE_EMAIL_REQUIRED');
        const subjectId = `google:${identity.sub}`;
        const binding = await input.approvedBindings.findApprovedBinding({
          workspaceId: context.workspaceId,
          connectorId: context.connectorId,
          subjectId,
          now,
        });
        if (!binding) return jsonError(403, 'WORKSPACE_MCP_CONNECTOR_APPROVAL_REQUIRED');
        const issued = await input.credentials.issue({
          workspaceId: context.workspaceId,
          connectorId: context.connectorId,
          deviceId: binding.deviceId,
          subjectId,
          subjectEmail: binding.subjectEmail ?? identity.email,
          capabilities: binding.capabilities,
          scopes: [MCP_ACCESS_SCOPE],
          now,
        });
        return jsonResponse(credentialPayload(issued), { status: 201 });
      }

      const authorization = await authorizeManagement({ request, context, credentials: input.credentials, now });
      if (!authorization.ok) return authorization.response;

      if (url.pathname === '/mcp/connections') {
        if (request.method !== 'GET') return methodNotAllowed('GET');
        const connections = await input.credentials.list({
          workspaceId: context.workspaceId,
          connectorId: context.connectorId,
          subjectId: authorization.subjectId,
        });
        return jsonResponse({ connections: connections.map(connectionPayload) });
      }

      const match = /^\/mcp\/connections\/([^/]+)\/(rotate|revoke|audit)$/.exec(url.pathname);
      if (!match) return null;
      const credentialId = decodeURIComponent(match[1]);
      const action = match[2];

      if (action === 'rotate') {
        if (request.method !== 'POST') return methodNotAllowed('POST');
        const rotated = await input.credentials.rotate({
          credentialId,
          workspaceId: context.workspaceId,
          connectorId: context.connectorId,
          subjectId: authorization.subjectId,
          now,
        });
        return jsonResponse(credentialPayload(rotated), { status: 201 });
      }

      if (action === 'revoke') {
        if (request.method !== 'POST') return methodNotAllowed('POST');
        const revoked = await input.credentials.revoke({
          credentialId,
          workspaceId: context.workspaceId,
          connectorId: context.connectorId,
          subjectId: authorization.subjectId,
          now,
        });
        return jsonResponse({ revoked: true, ...connectionPayload(revoked) });
      }

      if (request.method !== 'GET') return methodNotAllowed('GET');
      const events = await input.credentials.audit({
        credentialId,
        workspaceId: context.workspaceId,
        connectorId: context.connectorId,
        subjectId: authorization.subjectId,
      });
      return jsonResponse({ events });
      } catch {
        return jsonError(500, 'WORKSPACE_MCP_CONNECTION_REQUEST_FAILED');
      }
    },
  };
};
