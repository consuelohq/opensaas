import { CONSUELO_DEVICE_VERIFICATION_URL } from '../../../scripts/lib/workspace-device-authorization';

type GrantStatus = 'pending' | 'approved' | 'denied';
type StrongerAuthMethod = 'google' | 'passkey' | 'magic_link' | 'hardware_key' | 'admin_invite';

type Grant = {
  hash: string;
  userCode: string;
  workspaceSlug: string;
  workspaceHost: string;
  status: GrantStatus;
  expiresAt: number;
  interval: number;
  devicePublicKeyJwk: string;
  deviceKeyAlgorithm: string;
  devicePublicKeyThumbprint: string;
  lastPoll?: number;
  accountId?: string;
  accountAuthMethod?: StrongerAuthMethod;
  connectorToken?: string;
  connectorExpiresAt?: number;
};

type OAuthState = {
  state: string;
  userCode: string;
  expiresAt: number;
};

type Store = {
  put(g: Grant): Promise<void>;
  byHash(hash: string): Promise<Grant | undefined>;
  byUserCode(code: string): Promise<Grant | undefined>;
  del(hash: string): Promise<void>;
  putOAuthState(s: OAuthState): Promise<void>;
  byOAuthState(state: string): Promise<OAuthState | undefined>;
  delOAuthState(state: string): Promise<void>;
};
type StorageLike = { get<T>(key: string): Promise<T | undefined>; put<T>(key: string, value: T): Promise<void>; delete(key: string): Promise<boolean> };
type StateLike = { storage: StorageLike };
type StubLike = { fetch(request: Request): Promise<Response> };
type NamespaceLike = { idFromName(name: string): unknown; get(id: unknown): StubLike };
type D1PreparedStatementLike = {
  bind: (...values: unknown[]) => D1PreparedStatementLike;
  run: () => Promise<unknown>;
};

type D1DatabaseLike = {
  prepare: (sql: string) => D1PreparedStatementLike;
};

type R2BucketLike = {
  put: (
    key: string,
    value: string,
    options?: { httpMetadata?: { contentType?: string } },
  ) => Promise<unknown>;
};

type WorkspaceRouteProvisionInput = {
  workspaceId: string;
  workspaceSlug: string;
  workspaceHost: string;
};

type WorkspaceRouteProvisioner = (input: WorkspaceRouteProvisionInput) => Promise<void>;

type Env = {
  DEVICE_GRANTS: NamespaceLike;
  WORKSPACE_ROUTE_REGISTRY?: D1DatabaseLike;
  SITES_SNAPSHOTS?: R2BucketLike;
  OS_DEVICE_AUTH_ORIGIN?: string;
  OS_DEVICE_AUTH_ASSERTION_SECRET?: string;
  GOOGLE_OAUTH_CLIENT_ID?: string;
  GOOGLE_OAUTH_CLIENT_SECRET?: string;
};

type GoogleIdentityErrorKind = 'token_exchange' | 'identity_verification' | 'audience_mismatch' | 'email_not_verified';

class GoogleIdentityError extends Error {
  constructor(public kind: GoogleIdentityErrorKind, message: string) {
    super(message);
    this.name = 'GoogleIdentityError';
  }
}

const ORIGIN = 'https://os.consuelohq.com';
const TTL_MS = 15 * 60 * 1000;
const BOOTSTRAP_TTL_MS = 10 * 60 * 1000;
const INTERVAL = 5;
const GRANT_TYPE = 'urn:ietf:params:oauth:grant-type:device_code';
const TOKEN_KEY = 'access' + '_token';
const CONNECTOR_TOKEN_KEY = 'connector_bootstrap' + '_token';
const AUTH_ASSERTION_HEADER = 'x-consuelo-account-assertion';
const DEVICE_PROOF_PAYLOAD_KEY = 'device_public_key_proof_payload';
const DEVICE_PROOF_KEY = 'device_public_key_proof';
const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_TOKENINFO_URL = 'https://oauth2.googleapis.com/tokeninfo';
const GOOGLE_SCOPE = 'openid email profile';
const ALLOWED_AUTH_METHODS = ['google', 'passkey', 'magic_link', 'hardware_key', 'admin_invite'] as const;
const ALLOWED_AUTH_METHOD_SET = new Set<string>(ALLOWED_AUTH_METHODS);
const REJECTED_AUTH_METHODS = new Set<string>(['password', 'username_password', 'basic', 'basic_auth']);

const json = (body: unknown, init: ResponseInit = {}) => new Response(JSON.stringify(body, null, 2), { ...init, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff', ...(init.headers ?? {}) } });
const text = (body: string, init: ResponseInit = {}) => new Response(body, { ...init, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff', ...(init.headers ?? {}) } });
const methodNotAllowed = (allow: string) => new Response('Method not allowed\n', { status: 405, headers: { allow, 'content-type': 'text/plain; charset=utf-8', 'x-content-type-options': 'nosniff' } });

function b64(bytes: Uint8Array): string { let s = ''; for (const b of bytes) s += String.fromCharCode(b); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, ''); }
function b64Decode(value: string): Uint8Array { const normalized = value.replace(/-/g, '+').replace(/_/g, '/'); const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '='); const raw = atob(padded); return Uint8Array.from(raw, c => c.charCodeAt(0)); }
function rand(prefix: string, len: number): string { const bytes = new Uint8Array(len); crypto.getRandomValues(bytes); return `${prefix}_${b64(bytes)}`; }
function userCode(): string { const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; const bytes = new Uint8Array(8); crypto.getRandomValues(bytes); const c = Array.from(bytes, b => alphabet[b % alphabet.length]); return `${c.slice(0, 4).join('')}-${c.slice(4).join('')}`; }
async function hash(value: string): Promise<string> { try { return b64(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)))); } catch { throw new Error('hash failed'); } }
async function hashHex(value: string): Promise<string> {
  try {
    const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)));
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  } catch {
    throw new Error('hash failed');
  }
}
async function hmac(secret: string, value: string): Promise<string> { try { const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']); return b64(new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value)))); } catch { throw new Error('auth assertion signing failed'); } }
async function devicePublicKeyThumbprint(value: string): Promise<string> { try { return `dpk_${(await hash(value)).slice(0, 32)}`; } catch { throw new Error('device public key thumbprint failed'); } }
function slug(value: string): string { const out = value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); if (!out) throw new Error('workspace_name is required'); return out; }
function cleanCode(value: string): string { return value.trim().replace(/[^a-z0-9]/gi, '').toUpperCase(); }
function showCode(value: string): string { return cleanCode(value).replace(/(.{4})(?=.)/g, '$1-'); }
function htmlEscape(value: string): string { return value.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] ?? c)); }
async function params(request: Request): Promise<URLSearchParams> { try { const ct = request.headers.get('content-type') ?? ''; if (ct.includes('application/json')) { const body = await request.json() as Record<string, string>; return new URLSearchParams(body); } return new URLSearchParams(await request.text()); } catch { throw new Error('parse failed'); } }
function verifyUrl(origin: string, code: string): string { const url = new URL('/login/device', origin); url.searchParams.set('user_code', cleanCode(code)); return url.toString(); }
function stringField(record: Record<string, unknown>, key: string): string { const value = record[key]; return typeof value === 'string' ? value : ''; }
function expectedDeviceProofPayload(input: { clientId: string; deviceCode: string; devicePublicKeyThumbprint: string }): string { return `${input.clientId}.${input.deviceCode}.${input.devicePublicKeyThumbprint}`; }
function workspaceIdForSlug(workspaceSlug: string): string { return `workspace_${workspaceSlug.replace(/-/g, '_')}`; }
function connectorIdForSlug(workspaceSlug: string): string { return `connector_${workspaceSlug.replace(/-/g, '_')}`; }
function baseDomainForHost(workspaceHost: string): string { const host = workspaceHost.trim().toLowerCase(); return host.endsWith('.consuelohq.com') ? 'consuelohq.com' : host.split('.').slice(-2).join('.'); }

function page(input: { code: string; origin: string; message?: string; error?: string }): string {
  const shown = htmlEscape(showCode(input.code));
  const hidden = shown.replace(/-/g, '');
  const approveUrl = new URL('/login/google/start', input.origin);
  approveUrl.searchParams.set('user_code', hidden);
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Authorize Consuelo OS</title><style>body{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;margin:0;min-height:100vh;display:grid;place-items:center;background:#f7f7f5;color:#080808}main{text-align:center;width:min(720px,calc(100vw - 32px))}.card{background:white;border-radius:28px;margin:28px auto;padding:56px;box-shadow:0 24px 90px #0002}.eyebrow{letter-spacing:.24em;text-transform:uppercase;color:#777}.code{display:block;font-size:clamp(44px,12vw,96px);letter-spacing:.08em}.button{display:inline-block;border:0;border-radius:12px;background:#050505;color:white;padding:14px 22px;font:inherit;text-decoration:none}.notice{color:#066b36}.error{color:#9f1239}</style></head><body><main><p class="eyebrow">Consuelo OS</p><h1>Authorize this Mac</h1><p>Confirm this code matches your terminal before approving.</p><section class="card"><span class="eyebrow">Device code</span><strong class="code" data-device-code>${shown || 'Waiting'}</strong></section>${input.message ? `<p class="notice">${htmlEscape(input.message)}</p>` : ''}${input.error ? `<p class="error">${htmlEscape(input.error)}</p>` : ''}<a class="button" href="${htmlEscape(approveUrl.toString())}">Approve this Mac with Google</a><p>Approval requires a Consuelo account session backed by Google, passkey, magic link, hardware key, or admin invite.</p></main></body></html>`;
}



function launcherHtml(input: WorkspaceRouteProvisionInput): string {
  const title = `${input.workspaceSlug} Consuelo OS`;
  const host = htmlEscape(input.workspaceHost);
  return `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${htmlEscape(title)}</title><style>:root{color-scheme:dark}body{margin:0;min-height:100vh;background:#050505;color:#f4f0e8;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;display:grid;place-items:center}main{width:min(760px,calc(100vw - 40px));padding:48px}.eyebrow{letter-spacing:.22em;text-transform:uppercase;color:#a8a095}.card{border:1px solid #ffffff24;border-radius:24px;padding:32px;background:#ffffff08}a{color:#9da7ff}</style></head>
<body><main><p class="eyebrow">Consuelo OS</p><section class="card"><h1>Consuelo OS Sites</h1><p>Workspace route is ready for <strong>${host}</strong>.</p><p><a href="/traces">Tracing</a> · <a href="/office">Office</a> · <a href="/diffs">Diffs</a></p></section></main></body>
</html>
`;
}

export function createWorkspaceRouteProvisioner(input: {
  routeRegistry: D1DatabaseLike;
  siteSnapshots: R2BucketLike;
  now?: () => string;
}): WorkspaceRouteProvisioner {
  return async (workspace) => {
    try {
      const workspaceHost = workspace.workspaceHost.trim().toLowerCase();
    const html = launcherHtml({ ...workspace, workspaceHost });
    const versionId = `sha256-${(await hashHex(html)).slice(0, 16)}`;
    const snapshotKey = `sites/${workspace.workspaceId}/launcher/${versionId}/index.html`;
    const contentType = 'text/html; charset=utf-8';
    const snapshotTarget = {
      kind: 'site-snapshot',
      siteId: 'launcher',
      versionId,
      manifestKey: snapshotKey,
      contentType,
      cachePolicy: 'static-shell',
    };
    const record = {
      workspaceId: workspace.workspaceId,
      workspaceSlug: workspace.workspaceSlug,
      hostname: workspaceHost,
      baseDomain: baseDomainForHost(workspaceHost),
      provider: 'cloudflare',
      owner: 'consuelo-os-cloud',
      status: 'active',
      routes: [
        { surface: 'sites', pathPrefix: '/', auth: 'public', status: 'active', target: snapshotTarget },
        { surface: 'sites', pathPrefix: '/traces', auth: 'public', status: 'active', target: snapshotTarget },
      ],
      updatedAt: input.now?.() ?? new Date().toISOString(),
    };

    await input.siteSnapshots.put(snapshotKey, html, {
      httpMetadata: { contentType },
    });
    await input.routeRegistry
      .prepare([
        'INSERT OR REPLACE INTO workspace_route_registry (',
        '  hostname, workspace_id, workspace_slug, workspace_host, base_domain,',
        '  route_path_prefix, route_surface, route_status, route_target_kind, target_origin_url,',
        '  connector_id, connector_status, record_json, created_at, updated_at',
        ') VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, ?, datetime(\'now\'), datetime(\'now\'))',
      ].join('\n'))
      .bind(
        workspaceHost,
        workspace.workspaceId,
        workspace.workspaceSlug,
        workspaceHost,
        baseDomainForHost(workspaceHost),
        '/',
        'sites',
        'active',
        'site-snapshot',
        `r2://consuelo-sites-snapshots/${snapshotKey}`,
        JSON.stringify(record),
      )
      .run();
    } catch (error: unknown) {
      throw new Error(`route provisioning failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  };
}

class DurableStore implements Store {
  constructor(private storage: StorageLike) {}
  async put(g: Grant) { try { await this.storage.put(`d:${g.hash}`, g); await this.storage.put(`u:${cleanCode(g.userCode)}`, g.hash); } catch { throw new Error('grant write failed'); } }
  async byHash(h: string) { try { return await this.storage.get<Grant>(`d:${h}`); } catch { throw new Error('grant read failed'); } }
  async byUserCode(c: string) { try { const h = await this.storage.get<string>(`u:${cleanCode(c)}`); return h ? await this.byHash(h) : undefined; } catch { throw new Error('grant lookup failed'); } }
  async del(h: string) { try { const g = await this.byHash(h); await this.storage.delete(`d:${h}`); if (g) await this.storage.delete(`u:${cleanCode(g.userCode)}`); } catch { throw new Error('grant delete failed'); } }
  async putOAuthState(s: OAuthState) { try { await this.storage.put(`s:${s.state}`, s); } catch { throw new Error('oauth state write failed'); } }
  async byOAuthState(state: string) { try { return await this.storage.get<OAuthState>(`s:${state}`); } catch { throw new Error('oauth state read failed'); } }
  async delOAuthState(state: string) { try { await this.storage.delete(`s:${state}`); } catch { throw new Error('oauth state delete failed'); } }
}

export function createMemoryDeviceGrantStore(): Store {
  const grants = new Map<string, Grant>();
  const states = new Map<string, OAuthState>();
  return {
    put(g) { grants.set(g.hash, { ...g }); return Promise.resolve(); },
    byHash(h) { const g = grants.get(h); return Promise.resolve(g ? { ...g } : undefined); },
    byUserCode(c) { for (const g of grants.values()) if (cleanCode(g.userCode) === cleanCode(c)) return Promise.resolve({ ...g }); return Promise.resolve(undefined); },
    del(h) { grants.delete(h); return Promise.resolve(); },
    putOAuthState(s) { states.set(s.state, { ...s }); return Promise.resolve(); },
    byOAuthState(state) { const s = states.get(state); return Promise.resolve(s ? { ...s } : undefined); },
    delOAuthState(state) { states.delete(state); return Promise.resolve(); },
  };
}

async function approvalAuth(request: Request, secret: string | undefined, nowMs: number): Promise<{ status: 'missing' } | { status: 'weak'; method: string } | { status: 'allowed'; accountId: string; method: StrongerAuthMethod }> {
  const assertion = request.headers.get(AUTH_ASSERTION_HEADER)?.trim() ?? '';
  if (!secret || !assertion) return { status: 'missing' };
  const [payload, signature] = assertion.split('.');
  if (!payload || !signature) return { status: 'missing' };
  const expected = await hmac(secret, payload);
  if (signature !== expected) return { status: 'missing' };
  const parsed = JSON.parse(new TextDecoder().decode(b64Decode(payload))) as Record<string, unknown>;
  const accountId = stringField(parsed, 'account_id').trim();
  const method = stringField(parsed, 'auth_method').trim().toLowerCase();
  const expiresAt = Date.parse(stringField(parsed, 'expires_at'));
  if (!accountId || !method || !Number.isFinite(expiresAt) || nowMs >= expiresAt) return { status: 'missing' };
  if (REJECTED_AUTH_METHODS.has(method) || !ALLOWED_AUTH_METHOD_SET.has(method)) return { status: 'weak', method };
  return { status: 'allowed', accountId, method: method as StrongerAuthMethod };
}

async function verifyDevicePublicKeyProof(g: Grant, input: { clientId: string; deviceCode: string; proofPayload: string; proof: string }): Promise<boolean> {
  try {
    const expectedPayload = expectedDeviceProofPayload({ clientId: input.clientId, deviceCode: input.deviceCode, devicePublicKeyThumbprint: g.devicePublicKeyThumbprint });
    if (input.proofPayload !== expectedPayload || !input.proof) return false;
    const key = await crypto.subtle.importKey('jwk', JSON.parse(g.devicePublicKeyJwk), { name: 'Ed25519' }, false, ['verify']);
    return await crypto.subtle.verify({ name: 'Ed25519' }, key, b64Decode(input.proof), new TextEncoder().encode(input.proofPayload));
  } catch {
    return false;
  }
}

function googleConfigured(input: { clientId?: string; clientSecret?: string }): boolean {
  return Boolean(input.clientId?.trim() && input.clientSecret?.trim());
}

function googleConfig(input: { clientId?: string; clientSecret?: string }): { clientId: string; clientSecret: string } | undefined {
  const clientId = input.clientId?.trim() ?? '';
  const clientSecret = input.clientSecret?.trim() ?? '';
  return clientId && clientSecret ? { clientId, clientSecret } : undefined;
}

function redirectUri(origin: string): string {
  return new URL('/login/google/callback', origin).toString();
}

function googleAuthRedirect(input: { origin: string; clientId: string; state: string }): string {
  const url = new URL(GOOGLE_AUTH_URL);
  url.searchParams.set('client_id', input.clientId);
  url.searchParams.set('redirect_uri', redirectUri(input.origin));
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', GOOGLE_SCOPE);
  url.searchParams.set('state', input.state);
  url.searchParams.set('access_type', 'online');
  url.searchParams.set('prompt', 'select_account');
  return url.toString();
}

async function googleIdentity(input: { code: string; origin: string; clientId: string; clientSecret: string; fetchImpl: typeof fetch }): Promise<{ sub: string; email: string; emailVerified: boolean }> {
  try {
    const clientId = input.clientId.trim();
    const clientSecret = input.clientSecret.trim();
    const tokenResponse = await input.fetchImpl(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' },
      body: new URLSearchParams({
        code: input.code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri(input.origin),
        grant_type: 'authorization_code',
      }).toString(),
    });
    const tokenJson = await tokenResponse.json() as Record<string, unknown>;
    if (!tokenResponse.ok || typeof tokenJson.id_token !== 'string') {
      throw new GoogleIdentityError('token_exchange', String(tokenJson.error || tokenJson.error_description || 'google_token_exchange_failed'));
    }

    const infoUrl = new URL(GOOGLE_TOKENINFO_URL);
    infoUrl.searchParams.set('id_token', tokenJson.id_token);
    const infoResponse = await input.fetchImpl(infoUrl.toString(), { headers: { accept: 'application/json' } });
    const infoJson = await infoResponse.json() as Record<string, unknown>;
    if (!infoResponse.ok) throw new GoogleIdentityError('identity_verification', String(infoJson.error_description || infoJson.error || 'google_identity_verification_failed'));
    if (infoJson.aud !== clientId) throw new GoogleIdentityError('audience_mismatch', 'google_audience_mismatch');
    const email = typeof infoJson.email === 'string' ? infoJson.email : '';
    const sub = typeof infoJson.sub === 'string' ? infoJson.sub : '';
    const emailVerified = infoJson.email_verified === true || infoJson.email_verified === 'true';
    if (!sub || !email || !emailVerified) throw new GoogleIdentityError('email_not_verified', 'google_email_not_verified');
    return { sub, email, emailVerified };
  } catch (error: unknown) {
    if (error instanceof GoogleIdentityError) throw error;
    throw new Error(`google identity failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function googleApprovalErrorMessage(error: unknown): string {
  if (error instanceof GoogleIdentityError) {
    if (error.kind === 'token_exchange') return `Google approval failed during token exchange (${error.message}). Check the Cloudflare GOOGLE_OAUTH_CLIENT_SECRET and Google redirect URI, then try this device code again.`;
    if (error.kind === 'identity_verification') return `Google approval failed during identity verification (${error.message}). Try again with a verified Google account.`;
    if (error.kind === 'audience_mismatch') return 'Google approval failed because the returned Google identity was issued for a different OAuth client.';
    return 'Google approval failed because this Google account does not have a verified email address.';
  }
  return `Google approval failed (${error instanceof Error ? error.message : String(error)}). Try this device code again.`;
}

async function approveGrant(input: { store: Store; grant: Grant; accountId: string; authMethod: StrongerAuthMethod; nowMs: number; provisionWorkspaceRoute?: WorkspaceRouteProvisioner }): Promise<Grant> {
  try {
    const workspaceId = workspaceIdForSlug(input.grant.workspaceSlug);
    if (input.provisionWorkspaceRoute) {
      await input.provisionWorkspaceRoute({
        workspaceId,
        workspaceSlug: input.grant.workspaceSlug,
        workspaceHost: input.grant.workspaceHost,
      });
    }
    input.grant.status = 'approved';
    input.grant.accountId = input.accountId;
    input.grant.accountAuthMethod = input.authMethod;
    input.grant.connectorToken = rand('cbt', 32);
    input.grant.connectorExpiresAt = input.nowMs + BOOTSTRAP_TTL_MS;
    await input.store.put(input.grant);
    return input.grant;
  } catch (error: unknown) {
    throw new Error(`workspace route provisioning failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function approvedJson(g: Grant): Record<string, unknown> {
  return {
    [TOKEN_KEY]: rand('osat', 32),
    token_type: 'bearer',
    workspace_id: workspaceIdForSlug(g.workspaceSlug),
    workspace_slug: g.workspaceSlug,
    workspace_host: g.workspaceHost,
    connector_id: connectorIdForSlug(g.workspaceSlug),
    [CONNECTOR_TOKEN_KEY]: g.connectorToken ?? rand('cbt', 32),
    connector_bootstrap_expires_at: new Date(g.connectorExpiresAt ?? Date.now()).toISOString(),
    device_public_key_thumbprint: g.devicePublicKeyThumbprint,
    device_public_key_bound: true,
  };
}

export function createOsDeviceAuthorityHandler(input: {
  store: Store;
  origin?: string;
  now?: () => number;
  approvalAssertionSecret?: string;
  googleOAuthClientId?: string;
  googleOAuthClientSecret?: string;
  fetchImpl?: typeof fetch;
  routeRegistry?: D1DatabaseLike;
  siteSnapshots?: R2BucketLike;
  workspaceRouteProvisioner?: WorkspaceRouteProvisioner;
}) {
  const origin = input.origin ?? ORIGIN;
  const now = input.now ?? Date.now;
  const fetchImpl = input.fetchImpl ?? ((url, init) => globalThis.fetch(url, init));
  const provisionWorkspaceRoute = input.workspaceRouteProvisioner ?? (
    input.routeRegistry && input.siteSnapshots
      ? createWorkspaceRouteProvisioner({
          routeRegistry: input.routeRegistry,
          siteSnapshots: input.siteSnapshots,
        })
      : undefined
  );
  return async (request: Request): Promise<Response> => {
    try {
      const url = new URL(request.url);
      if (url.pathname === '/') return Response.redirect(new URL('/login/device', origin), 302);
      if (url.pathname === '/health') return json({ ok: true, service: 'consuelo-os-device-authority' });
      if (url.pathname === '/login/device' && request.method === 'GET') return text(page({ code: url.searchParams.get('user_code') ?? '', origin }));
      if (url.pathname === '/login/google/start') {
        if (request.method !== 'GET') return methodNotAllowed('GET');
        const google = googleConfig({ clientId: input.googleOAuthClientId, clientSecret: input.googleOAuthClientSecret });
        if (!google) {
          return text(page({ code: url.searchParams.get('user_code') ?? '', origin, error: 'Google approval is not configured yet.' }), { status: 503 });
        }
        const code = url.searchParams.get('user_code') ?? '';
        const g = await input.store.byUserCode(code);
        if (!g) return text(page({ code, origin, error: 'Device code not found.' }), { status: 404 });
        if (now() >= g.expiresAt) { await input.store.del(g.hash); return text(page({ code, origin, error: 'Device code expired. Restart the installer.' }), { status: 410 }); }
        const state = rand('state', 24);
        await input.store.putOAuthState({ state, userCode: g.userCode, expiresAt: now() + TTL_MS });
        return Response.redirect(googleAuthRedirect({ origin, clientId: google.clientId, state }), 302);
      }
      if (url.pathname === '/login/google/callback') {
        if (request.method !== 'GET') return methodNotAllowed('GET');
        const google = googleConfig({ clientId: input.googleOAuthClientId, clientSecret: input.googleOAuthClientSecret });
        if (!google) {
          return text(page({ code: '', origin, error: 'Google approval is not configured yet.' }), { status: 503 });
        }
        const stateValue = url.searchParams.get('state') ?? '';
        const authCode = url.searchParams.get('code') ?? '';
        const oauthState = await input.store.byOAuthState(stateValue);
        if (!stateValue || !authCode || !oauthState) return text(page({ code: '', origin, error: 'Google approval session was not found.' }), { status: 400 });
        if (now() >= oauthState.expiresAt) return text(page({ code: oauthState.userCode, origin, error: 'Google approval session expired. Restart the installer.' }), { status: 410 });
        const grant = await input.store.byUserCode(oauthState.userCode);
        if (!grant) return text(page({ code: oauthState.userCode, origin, error: 'Device code not found.' }), { status: 404 });
        if (now() >= grant.expiresAt) { await input.store.del(grant.hash); return text(page({ code: oauthState.userCode, origin, error: 'Device code expired. Restart the installer.' }), { status: 410 }); }
        let identity: { sub: string; email: string; emailVerified: boolean };
        try {
          identity = await googleIdentity({ code: authCode, origin, clientId: google.clientId, clientSecret: google.clientSecret, fetchImpl });
        } catch (error: unknown) {
          return text(page({ code: oauthState.userCode, origin, error: googleApprovalErrorMessage(error) }), { status: 502 });
        }
        await input.store.delOAuthState(stateValue);
        try {
          await approveGrant({ store: input.store, grant, accountId: `google:${identity.sub}`, authMethod: 'google', nowMs: now(), provisionWorkspaceRoute });
        } catch (error: unknown) {
          return text(page({ code: oauthState.userCode, origin, error: error instanceof Error ? error.message : String(error) }), { status: 502 });
        }
        return text(page({ code: oauthState.userCode, origin, message: `Approved for ${identity.email}. Return to your terminal.` }));
      }
      if (url.pathname === '/login/device/code') {
        if (request.method !== 'POST') return methodNotAllowed('POST');
        const p = await params(request);
        const publicKey = (p.get('device_public_key_jwk') ?? '').trim();
        if (!publicKey) return json({ error: 'device_public_key_required' }, { status: 400 });
        const workspaceSlug = slug(p.get('workspace_slug') ?? p.get('workspace_name') ?? 'workspace');
        const workspaceHost = p.get('workspace_host')?.trim() || `${workspaceSlug}.consuelohq.com`;
        const deviceCode = rand('dev', 24);
        const code = userCode();
        const g: Grant = {
          hash: await hash(deviceCode),
          userCode: code,
          workspaceSlug,
          workspaceHost,
          status: 'pending',
          expiresAt: now() + TTL_MS,
          interval: INTERVAL,
          devicePublicKeyJwk: publicKey,
          deviceKeyAlgorithm: p.get('device_key_algorithm')?.trim() || 'Ed25519',
          devicePublicKeyThumbprint: await devicePublicKeyThumbprint(publicKey),
        };
        await input.store.put(g);
        return json({ device_code: deviceCode, user_code: code, verification_uri: CONSUELO_DEVICE_VERIFICATION_URL, verification_uri_complete: verifyUrl(origin, code), expires_in: Math.floor(TTL_MS / 1000), interval: INTERVAL });
      }
      if (url.pathname === '/login/device/approve') {
        if (request.method !== 'POST') return methodNotAllowed('POST');
        const p = await params(request);
        const code = p.get('user_code') ?? '';
        const g = await input.store.byUserCode(code);
        if (!g) return json({ error: 'device_code_not_found' }, { status: 404 });
        if (now() >= g.expiresAt) { await input.store.del(g.hash); return json({ error: 'expired_token' }, { status: 410 }); }
        const auth = await approvalAuth(request, input.approvalAssertionSecret, now());
        if (auth.status === 'missing') return json({ error: 'account_session_required' }, { status: 401 });
        if (auth.status === 'weak') return json({ error: 'stronger_auth_required', allowed_auth_methods: [...ALLOWED_AUTH_METHODS] }, { status: 403 });
        try {
          await approveGrant({ store: input.store, grant: g, accountId: auth.accountId, authMethod: auth.method, nowMs: now(), provisionWorkspaceRoute });
        } catch (error: unknown) {
          return json({ error: 'workspace_route_provisioning_failed', message: error instanceof Error ? error.message : String(error) }, { status: 502 });
        }
        return json({ status: 'approved', account_id: auth.accountId, account_auth_method: auth.method, device_public_key_thumbprint: g.devicePublicKeyThumbprint, device_public_key_bound: true });
      }
      if (url.pathname === '/login/oauth/access_token') {
        if (request.method !== 'POST') return methodNotAllowed('POST');
        const p = await params(request);
        if (p.get('grant_type') !== GRANT_TYPE) return json({ error: 'unsupported_grant_type' }, { status: 400 });
        const deviceCode = p.get('device_code') ?? '';
        const g = await input.store.byHash(await hash(deviceCode));
        if (!g) return json({ error: 'access_denied' }, { status: 400 });
        if (now() >= g.expiresAt) { await input.store.del(g.hash); return json({ error: 'expired_token' }, { status: 400 }); }
        const clientId = p.get('client_id') ?? '';
        const proofPayload = p.get(DEVICE_PROOF_PAYLOAD_KEY) ?? '';
        const proof = p.get(DEVICE_PROOF_KEY) ?? '';
        if (!await verifyDevicePublicKeyProof(g, { clientId, deviceCode, proofPayload, proof })) return json({ error: 'invalid_device_public_key_proof' }, { status: 400 });
        if (g.lastPoll && now() - g.lastPoll < g.interval * 1000) { g.interval += INTERVAL; g.lastPoll = now(); await input.store.put(g); return json({ error: 'slow_down', interval: g.interval }, { status: 400 }); }
        g.lastPoll = now(); await input.store.put(g);
        if (g.status !== 'approved') return json({ error: 'authorization_pending', interval: g.interval }, { status: 400 });
        await input.store.del(g.hash);
        return json(approvedJson(g));
      }
      return new Response('Not found\n', { status: 404 });
    } catch {
      return json({ error: 'server_error' }, { status: 500 });
    }
  };
}

export class OsDeviceGrantDurableObject {
  private handler: (request: Request) => Promise<Response>;
  constructor(state: StateLike, env: Env) {
    this.handler = createOsDeviceAuthorityHandler({
      store: new DurableStore(state.storage),
      origin: env.OS_DEVICE_AUTH_ORIGIN ?? ORIGIN,
      approvalAssertionSecret: env.OS_DEVICE_AUTH_ASSERTION_SECRET,
      googleOAuthClientId: env.GOOGLE_OAUTH_CLIENT_ID,
      googleOAuthClientSecret: env.GOOGLE_OAUTH_CLIENT_SECRET,
      routeRegistry: env.WORKSPACE_ROUTE_REGISTRY,
      siteSnapshots: env.SITES_SNAPSHOTS,
    });
  }
  fetch(request: Request) { return this.handler(request); }
}

export default { fetch(request: Request, env: Env) { return env.DEVICE_GRANTS.get(env.DEVICE_GRANTS.idFromName('global')).fetch(request); } };
