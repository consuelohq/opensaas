import { CONSUELO_DEVICE_VERIFICATION_URL } from '../../../scripts/lib/workspace-device-authorization';
import { createWorkspaceCloudflareD1RouteRegistry, type WorkspaceRouteD1Database, type WorkspaceRouteD1Resolution } from '../../../scripts/lib/workspace-cloudflare-d1-route-registry';
import { createWorkspaceEdgeRouteSeedSql } from '../../../scripts/lib/workspace-edge-route-seed';
import {
  applyWorkspaceCloudflareProvisioning,
  createCloudflareWorkspaceProvisioningClient,
} from '../../../scripts/lib/workspace-cloudflare-provisioning';

type GrantStatus = 'pending' | 'approved' | 'denied';
type WorkspaceNodeRole = 'home' | 'member';
type WorkspaceNodeStatus = 'created' | 'reconnected';
type StrongerAuthMethod = 'google' | 'passkey' | 'magic_link' | 'hardware_key' | 'admin_invite';

type Grant = {
  hash: string;
  userCode: string;
  workspaceSlug?: string;
  workspaceHost?: string;
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
  cloudflareTunnelToken?: string;
  nodeId?: string;
  nodeName?: string;
  nodeRole?: WorkspaceNodeRole;
  nodeStatus?: WorkspaceNodeStatus;
};

type AccountWorkspace = {
  accountId: string;
  workspaceSlug: string;
  workspaceHost: string;
  homeNodeId?: string;
  updatedAt: number;
};

type WorkspaceNode = {
  accountId: string;
  workspaceSlug: string;
  workspaceHost: string;
  nodeId: string;
  nodeName: string;
  role: WorkspaceNodeRole;
  devicePublicKeyThumbprint: string;
  createdAt: number;
  updatedAt: number;
};

type OAuthState = {
  state: string;
  userCode: string;
  expiresAt: number;
};

type McpOAuthState = {
  state: string;
  clientId: string;
  redirectUri: string;
  requestedState: string;
  scope: string;
  scopes: string[];
  resource: string;
  workspaceHost: string;
  codeChallenge: string;
  expiresAt: number;
};

type McpOAuthCode = {
  codeHash: string;
  clientId: string;
  redirectUri: string;
  scope: string;
  scopes: string[];
  resource: string;
  workspaceHost: string;
  accountId: string;
  email: string;
  codeChallenge: string;
  expiresAt: number;
};

type McpOAuthAccessToken = {
  tokenHash: string;
  clientId: string;
  scope: string;
  scopes: string[];
  resource: string;
  workspaceHost: string;
  accountId: string;
  email: string;
  expiresAt: number;
  issuedAt: number;
};

type WorkspaceRouteRegistryBinding = WorkspaceRouteD1Database;
type DefaultSiteSnapshot = {
  key: string;
  versionId: string;
  siteId?: string;
  contentType?: string;
  cachePolicy?: 'static-shell' | 'versioned-asset' | 'mutable-artifact' | 'private-preview';
};

type WorkspaceConnectorProvisioningInput = {
  workspaceId: string;
  workspaceSlug: string;
  workspaceHost: string;
  connectorId: string;
};

type WorkspaceConnectorProvisioningResult = {
  connectorId: string;
  cloudflareTunnelToken: string;
  tunnelOriginUrl: string;
  localServiceUrl: string;
};

type WorkspaceConnectorProvisioner = (
  input: WorkspaceConnectorProvisioningInput,
) => Promise<WorkspaceConnectorProvisioningResult>;

type Store = {
  put(g: Grant): Promise<void>;
  byHash(hash: string): Promise<Grant | undefined>;
  byUserCode(code: string): Promise<Grant | undefined>;
  del(hash: string): Promise<void>;
  putOAuthState(s: OAuthState): Promise<void>;
  byOAuthState(state: string): Promise<OAuthState | undefined>;
  delOAuthState(state: string): Promise<void>;
  putMcpOAuthState(s: McpOAuthState): Promise<void>;
  byMcpOAuthState(state: string): Promise<McpOAuthState | undefined>;
  delMcpOAuthState(state: string): Promise<void>;
  putMcpOAuthCode(c: McpOAuthCode): Promise<void>;
  byMcpOAuthCode(codeHash: string): Promise<McpOAuthCode | undefined>;
  delMcpOAuthCode(codeHash: string): Promise<void>;
  putMcpOAuthAccessToken(t: McpOAuthAccessToken): Promise<void>;
  byMcpOAuthAccessToken(tokenHash: string): Promise<McpOAuthAccessToken | undefined>;
  putAccountWorkspace(workspace: AccountWorkspace): Promise<void>;
  byAccountWorkspace(accountId: string): Promise<AccountWorkspace | undefined>;
  putWorkspaceNode(node: WorkspaceNode): Promise<void>;
  byWorkspaceNode(accountId: string, nodeId: string): Promise<WorkspaceNode | undefined>;
};
type StorageLike = { get<T>(key: string): Promise<T | undefined>; put<T>(key: string, value: T): Promise<void>; delete(key: string): Promise<boolean> };
type StateLike = { storage: StorageLike };
type StubLike = { fetch(request: Request): Promise<Response> };
type NamespaceLike = { idFromName(name: string): unknown; get(id: unknown): StubLike };
type Env = {
  DEVICE_GRANTS: NamespaceLike;
  OS_DEVICE_AUTH_ORIGIN?: string;
  OS_DEVICE_AUTH_ASSERTION_SECRET?: string;
  GOOGLE_OAUTH_CLIENT_ID?: string;
  GOOGLE_OAUTH_CLIENT_SECRET?: string;
  WORKSPACE_ROUTE_REGISTRY?: WorkspaceRouteRegistryBinding;
  WORKSPACE_EDGE_INTERNAL_SIGNING_SECRET?: string;
  OS_DEVICE_AUTH_DEFAULT_SITE_SNAPSHOT_KEY?: string;
  OS_DEVICE_AUTH_DEFAULT_SITE_SNAPSHOT_VERSION_ID?: string;
  CLOUDFLARE_ACCOUNT_ID?: string;
  CLOUDFLARE_ZONE_ID?: string;
  CLOUDFLARE_API_TOKEN?: string;
  OS_DEVICE_AUTH_BASE_DOMAIN?: string;
  OS_DEVICE_AUTH_WORKSPACE_EDGE_HOSTNAME?: string;
  OS_DEVICE_AUTH_CONNECTOR_LOCAL_SERVICE_URL?: string;
  OS_DEVICE_AUTH_CLOUDFLARE_API_BASE_URL?: string;
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
const CLOUDFLARE_TUNNEL_TOKEN_KEY = 'cloudflare_tunnel' + '_token';
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
const DEFAULT_SITE_SNAPSHOT_KEY = 'sites/workspace_testing/launcher/sha256-15c3f6f5c611b43c/index.html';
const DEFAULT_SITE_SNAPSHOT_VERSION_ID = 'sha256-15c3f6f5c611b43c';
const DEFAULT_SITE_ID = 'launcher';
const DEFAULT_SITE_CONTENT_TYPE = 'text/html; charset=utf-8';
const DEFAULT_CONNECTOR_LOCAL_SERVICE_URL = 'http://127.0.0.1:8960';
const CHATGPT_OAUTH_CLIENT_ID = 'chatgpt-consuelo-os';
const CHATGPT_REDIRECT_PREFIX = 'https://chatgpt.com/connector/oauth/';
const MCP_OAUTH_TTL_MS = 60 * 60 * 1000;
const MCP_OAUTH_CODE_TTL_MS = 5 * 60 * 1000;
const MCP_OAUTH_SCOPES = ['mcp:read', 'mcp:call', 'workspace:read', 'os:tools', 'route:/mcp:read', 'tool:*:read'];

const json = (body: unknown, init: ResponseInit = {}) => new Response(JSON.stringify(body, null, 2), { ...init, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff', ...(init.headers ?? {}) } });
const text = (body: string, init: ResponseInit = {}) => new Response(body, { ...init, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff', ...(init.headers ?? {}) } });
const methodNotAllowed = (allow: string) => new Response('Method not allowed\n', { status: 405, headers: { allow, 'content-type': 'text/plain; charset=utf-8', 'x-content-type-options': 'nosniff' } });

function b64(bytes: Uint8Array): string { let s = ''; for (const b of bytes) s += String.fromCharCode(b); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, ''); }
function b64Decode(value: string): Uint8Array { const normalized = value.replace(/-/g, '+').replace(/_/g, '/'); const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '='); const raw = atob(padded); return Uint8Array.from(raw, c => c.charCodeAt(0)); }
function rand(prefix: string, len: number): string { const bytes = new Uint8Array(len); crypto.getRandomValues(bytes); return `${prefix}_${b64(bytes)}`; }
function userCode(): string { const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; const bytes = new Uint8Array(8); crypto.getRandomValues(bytes); const c = Array.from(bytes, b => alphabet[b % alphabet.length]); return `${c.slice(0, 4).join('')}-${c.slice(4).join('')}`; }
async function hash(value: string): Promise<string> { try { return b64(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)))); } catch { throw new Error('hash failed'); } }
async function hashChallenge(value: string): Promise<string> { return await hash(value); }
async function hmac(secret: string, value: string): Promise<string> { try { const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']); return b64(new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value)))); } catch { throw new Error('auth assertion signing failed'); } }
async function devicePublicKeyThumbprint(value: string): Promise<string> { try { return `dpk_${(await hash(value)).slice(0, 32)}`; } catch { throw new Error('device public key thumbprint failed'); } }
function slug(value: string): string { const out = value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); if (!out) throw new Error('workspace_name is required'); return out; }
function host(value: string): string { const out = value.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/$/, ''); if (!out) throw new Error('workspace_host is required'); return out; }
function optionalNodeId(value: string): string | undefined { const out = value.trim().replace(/[^A-Za-z0-9_-]+/g, '-').replace(/^-|-$/g, ''); return out || undefined; }
function connectorIdFromNodeId(value: string): string { const segment = value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'local'; return `connector_${segment}`; }
function workspaceIdFromSlug(value: string): string { return `workspace_${slug(value).replace(/-/g, '_')}`; }
function baseDomainFromHost(value: string): string { const normalized = host(value); return normalized.endsWith('.consuelohq.com') ? 'consuelohq.com' : normalized.split('.').slice(-2).join('.'); }
function workspaceHostFromMcpResource(resource: string): string { const url = new URL(resource); if (url.protocol !== 'https:' || url.pathname !== '/mcp') throw new Error('invalid_resource'); return host(url.hostname); }
function normalizeScopes(value: string): string[] {
  const requested = value.split(/\s+/).map(scope => scope.trim()).filter(Boolean);
  const allowed = requested.filter(scope => MCP_OAUTH_SCOPES.includes(scope));
  const scopes = allowed.length > 0 ? allowed : ['mcp:read', 'mcp:call', 'tool:*:read'];
  if ((scopes.includes('mcp:read') || scopes.includes('mcp:call')) && !scopes.includes('route:/mcp:read')) {
    scopes.push('route:/mcp:read');
  }
  return [...new Set(scopes)];
}
function hasGrantedScope(scopes: string[], requiredScope: string): boolean { if (!requiredScope || scopes.includes(requiredScope)) return true; const parts = requiredScope.split(':'); return parts.length === 3 && parts[0] === 'tool' && (scopes.includes(`tool:*:${parts[2]}`) || scopes.includes('tool:*:*')); }
function validChatGptRedirectUri(value: string): boolean { try { return value.startsWith(CHATGPT_REDIRECT_PREFIX) && new URL(value).origin === 'https://chatgpt.com'; } catch { return false; } }
function validChatGptClientId(value: string): boolean {
  if (value === CHATGPT_OAUTH_CLIENT_ID) return true;
  try {
    const url = new URL(value);
    return url.origin === 'https://chatgpt.com' &&
      url.username === '' &&
      url.password === '' &&
      url.hash === '' &&
      url.pathname.startsWith('/oauth/') &&
      url.pathname.endsWith('/client.json');
  } catch {
    return false;
  }
}
function cleanCode(value: string): string { return value.trim().replace(/[^a-z0-9]/gi, '').toUpperCase(); }
function showCode(value: string): string { return cleanCode(value).replace(/(.{4})(?=.)/g, '$1-'); }
function htmlEscape(value: string): string { return value.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] ?? c)); }
async function params(request: Request): Promise<URLSearchParams> { try { const ct = request.headers.get('content-type') ?? ''; if (ct.includes('application/json')) { const body = await request.json() as Record<string, string>; return new URLSearchParams(body); } return new URLSearchParams(await request.text()); } catch { throw new Error('parse failed'); } }
function verifyUrl(origin: string, code: string): string { const url = new URL('/login/device', origin); url.searchParams.set('user_code', cleanCode(code)); return url.toString(); }
function stringField(record: Record<string, unknown>, key: string): string { const value = record[key]; return typeof value === 'string' ? value : ''; }
function expectedDeviceProofPayload(input: { clientId: string; deviceCode: string; devicePublicKeyThumbprint: string }): string { return `${input.clientId}.${input.deviceCode}.${input.devicePublicKeyThumbprint}`; }

function page(input: { code: string; origin: string; message?: string; error?: string }): string {
  const shown = htmlEscape(showCode(input.code));
  const hidden = shown.replace(/-/g, '');
  const approveUrl = new URL('/login/google/start', input.origin);
  approveUrl.searchParams.set('user_code', hidden);
  const state = input.error ? 'failed' : input.message ? 'authorized' : 'signin';
  const title = state === 'authorized' ? 'Device authorized' : state === 'failed' ? 'Device authorization failed' : 'Sign in to Consuelo OS';
  const message = state === 'authorized'
    ? 'Your device has been authorized. You can close this window and return to your terminal.'
    : state === 'failed'
      ? htmlEscape(input.error ?? 'Return to your terminal and restart device approval.')
      : 'Enter the code shown in your terminal.';
  const detail = state === 'authorized' && input.message ? `<p class="detail">${htmlEscape(input.message)}</p>` : '';
  const codeBox = state === 'signin'
    ? `<div class="code-box" aria-live="polite"><strong class="code" data-device-code>${shown || 'Waiting for code'}</strong></div>`
    : '';
  const guardrail = state === 'signin' ? '<p class="guardrail">Only continue if you just initiated a sign-in from your device.</p>' : '';
  const action = state === 'signin' ? `<a class="button" href="${htmlEscape(approveUrl.toString())}">Continue with Google</a>` : '';

  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><style>*{box-sizing:border-box}body{margin:0;min-height:100vh;background:#fff;color:#171717;font-family:ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.shell{min-height:100vh;display:grid;grid-template-columns:minmax(0,52%) minmax(0,48%)}.copy{min-height:100vh;display:grid;grid-template-rows:auto 1fr;padding:42px clamp(24px,6vw,88px) 64px}.brand{width:fit-content;color:#171717;font-size:14px;font-weight:600;letter-spacing:0;line-height:1;text-decoration:none}.form{align-self:center;width:min(100%,680px);display:grid;gap:23px}.form h1{margin:0 0 26px;color:#171717;font-size:34px;font-weight:400;letter-spacing:0;line-height:1.06}.instruction,.guardrail,.message{margin:0;color:#777;font-size:16px;line-height:1.6}.detail{margin:0;color:#999;font-size:14px;line-height:1.5}.code-box{min-height:58px;display:grid;place-items:center;background:#fff;box-shadow:rgba(0,0,0,.1) 0 0 0 1px}.code{color:#171717;font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;font-size:19px;font-weight:650;letter-spacing:0;line-height:1}.button{min-height:74px;display:inline-flex;align-items:center;justify-content:center;border-radius:8px;background:#000;color:#fff;font-size:17px;font-weight:500;line-height:1;text-decoration:none}.visual{position:relative;min-height:100vh;overflow:hidden;background:radial-gradient(circle at 82% 48%,rgba(255,255,255,.32),transparent 0 28%,transparent 46%),linear-gradient(125deg,#050505 0%,#0c0d10 48%,#26313e 100%)}.mark{position:absolute;right:-64px;top:50%;transform:translateY(-50%) rotate(-18deg);color:rgba(255,255,255,.11);font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;font-size:272px;font-weight:700;letter-spacing:0;line-height:.85;white-space:nowrap}@media(max-width:860px){.shell{grid-template-columns:1fr}.copy{min-height:68vh;padding:22px 20px 42px}.form{align-self:end;gap:18px}.form h1{margin-bottom:16px;font-size:34px}.button{min-height:58px}.visual{min-height:32vh}.mark{right:16px;font-size:144px}}</style></head><body><main class="shell" data-os-device-page-state="${state}"><section class="copy"><a class="brand" href="/" aria-label="Consuelo OS home">Consuelo OS</a><div class="form"><h1>${title}</h1><p class="${state === 'signin' ? 'instruction' : 'message'}">${message}</p>${codeBox}${guardrail}${action}${detail}</div></section><aside class="visual" aria-hidden="true"><div class="mark">OS</div></aside></main></body></html>`;
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
  async putMcpOAuthState(s: McpOAuthState) { try { await this.storage.put(`mos:${s.state}`, s); } catch { throw new Error('mcp oauth state write failed'); } }
  async byMcpOAuthState(state: string) { try { return await this.storage.get<McpOAuthState>(`mos:${state}`); } catch { throw new Error('mcp oauth state read failed'); } }
  async delMcpOAuthState(state: string) { try { await this.storage.delete(`mos:${state}`); } catch { throw new Error('mcp oauth state delete failed'); } }
  async putMcpOAuthCode(c: McpOAuthCode) { try { await this.storage.put(`moc:${c.codeHash}`, c); } catch { throw new Error('mcp oauth code write failed'); } }
  async byMcpOAuthCode(codeHash: string) { try { return await this.storage.get<McpOAuthCode>(`moc:${codeHash}`); } catch { throw new Error('mcp oauth code read failed'); } }
  async delMcpOAuthCode(codeHash: string) { try { await this.storage.delete(`moc:${codeHash}`); } catch { throw new Error('mcp oauth code delete failed'); } }
  async putMcpOAuthAccessToken(t: McpOAuthAccessToken) { try { await this.storage.put(`mot:${t.tokenHash}`, t); } catch { throw new Error('mcp oauth token write failed'); } }
  async byMcpOAuthAccessToken(tokenHash: string) { try { return await this.storage.get<McpOAuthAccessToken>(`mot:${tokenHash}`); } catch { throw new Error('mcp oauth token read failed'); } }
  async putAccountWorkspace(workspace: AccountWorkspace) { try { await this.storage.put(`aw:${workspace.accountId}`, workspace); } catch { throw new Error('account workspace write failed'); } }
  async byAccountWorkspace(accountId: string) { try { return await this.storage.get<AccountWorkspace>(`aw:${accountId}`); } catch { throw new Error('account workspace read failed'); } }
  async putWorkspaceNode(node: WorkspaceNode) { try { await this.storage.put(`wn:${node.accountId}:${node.nodeId}`, node); } catch { throw new Error('workspace node write failed'); } }
  async byWorkspaceNode(accountId: string, nodeId: string) { try { return await this.storage.get<WorkspaceNode>(`wn:${accountId}:${nodeId}`); } catch { throw new Error('workspace node read failed'); } }
}


export function createMemoryDeviceGrantStore(): Store {
  const grants = new Map<string, Grant>();
  const states = new Map<string, OAuthState>();
  const mcpStates = new Map<string, McpOAuthState>();
  const mcpCodes = new Map<string, McpOAuthCode>();
  const mcpTokens = new Map<string, McpOAuthAccessToken>();
  const accountWorkspaces = new Map<string, AccountWorkspace>();
  const workspaceNodes = new Map<string, WorkspaceNode>();
  return {
    put(g) { grants.set(g.hash, { ...g }); return Promise.resolve(); },
    byHash(h) { const g = grants.get(h); return Promise.resolve(g ? { ...g } : undefined); },
    byUserCode(c) { for (const g of grants.values()) if (cleanCode(g.userCode) === cleanCode(c)) return Promise.resolve({ ...g }); return Promise.resolve(undefined); },
    del(h) { grants.delete(h); return Promise.resolve(); },
    putOAuthState(s) { states.set(s.state, { ...s }); return Promise.resolve(); },
    byOAuthState(state) { const s = states.get(state); return Promise.resolve(s ? { ...s } : undefined); },
    delOAuthState(state) { states.delete(state); return Promise.resolve(); },
    putMcpOAuthState(s) { mcpStates.set(s.state, { ...s, scopes: [...s.scopes] }); return Promise.resolve(); },
    byMcpOAuthState(state) { const s = mcpStates.get(state); return Promise.resolve(s ? { ...s, scopes: [...s.scopes] } : undefined); },
    delMcpOAuthState(state) { mcpStates.delete(state); return Promise.resolve(); },
    putMcpOAuthCode(c) { mcpCodes.set(c.codeHash, { ...c, scopes: [...c.scopes] }); return Promise.resolve(); },
    byMcpOAuthCode(codeHash) { const c = mcpCodes.get(codeHash); return Promise.resolve(c ? { ...c, scopes: [...c.scopes] } : undefined); },
    delMcpOAuthCode(codeHash) { mcpCodes.delete(codeHash); return Promise.resolve(); },
    putMcpOAuthAccessToken(t) { mcpTokens.set(t.tokenHash, { ...t, scopes: [...t.scopes] }); return Promise.resolve(); },
    byMcpOAuthAccessToken(tokenHash) { const t = mcpTokens.get(tokenHash); return Promise.resolve(t ? { ...t, scopes: [...t.scopes] } : undefined); },
    putAccountWorkspace(workspace) { accountWorkspaces.set(workspace.accountId, { ...workspace }); return Promise.resolve(); },
    byAccountWorkspace(accountId) { const workspace = accountWorkspaces.get(accountId); return Promise.resolve(workspace ? { ...workspace } : undefined); },
    putWorkspaceNode(node) { workspaceNodes.set(`${node.accountId}:${node.nodeId}`, { ...node }); return Promise.resolve(); },
    byWorkspaceNode(accountId, nodeId) { const node = workspaceNodes.get(`${accountId}:${nodeId}`); return Promise.resolve(node ? { ...node } : undefined); },
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

async function googleIdentity(input: { code: string; origin: string; clientId: string; clientSecret: string; fetchImpl: typeof fetch; redirectUri?: string }): Promise<{ sub: string; email: string; emailVerified: boolean }> {
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
        redirect_uri: input.redirectUri ?? redirectUri(input.origin),
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


function authorizationServerMetadata(origin: string): Record<string, unknown> {
  return {
    issuer: origin,
    authorization_endpoint: new URL('/oauth/authorize', origin).toString(),
    token_endpoint: new URL('/oauth/token', origin).toString(),
    introspection_endpoint: new URL('/oauth/introspect', origin).toString(),
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code'],
    code_challenge_methods_supported: ['S256'],
    token_endpoint_auth_methods_supported: ['none'],
    client_id_metadata_document_supported: true,
    scopes_supported: MCP_OAUTH_SCOPES,
  };
}

function mcpOAuthGoogleRedirect(input: { clientId: string; state: string; googleRedirectUri: string }): string {
  const url = new URL(GOOGLE_AUTH_URL);
  url.searchParams.set('client_id', input.clientId);
  url.searchParams.set('redirect_uri', input.googleRedirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', GOOGLE_SCOPE);
  url.searchParams.set('state', input.state);
  url.searchParams.set('access_type', 'online');
  url.searchParams.set('prompt', 'select_account');
  return url.toString();
}

function redirectWithParams(base: string, params: Record<string, string>): Response {
  const url = new URL(base);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return Response.redirect(url.toString(), 302);
}

function invalidOauthRequest(error: string, description: string, status = 400): Response {
  return json({ error, error_description: description }, { status });
}

function mcpResourceUrl(origin: string): string {
  return new URL('/mcp', origin).toString();
}

function oauthProtectedResourceMetadata(origin: string): Record<string, unknown> {
  return {
    resource: mcpResourceUrl(origin),
    authorization_servers: [origin],
    scopes_supported: MCP_OAUTH_SCOPES,
    bearer_methods_supported: ['header'],
  };
}

function isCentralMcpResource(resource: string, origin: string): boolean {
  try {
    const resourceUrl = new URL(resource);
    const originUrl = new URL(origin);
    return resourceUrl.protocol === 'https:' &&
      resourceUrl.pathname === '/mcp' &&
      host(resourceUrl.hostname) === host(originUrl.hostname);
  } catch {
    return false;
  }
}

function isProtectedResourceMetadataPath(pathname: string): boolean {
  return pathname === '/.well-known/oauth-protected-resource' ||
    pathname === '/.well-known/oauth-protected-resource/mcp';
}

function isMcpRequestPath(pathname: string): boolean {
  return pathname === '/mcp' || pathname.startsWith('/mcp/');
}

type McpOAuthWorkspaceResolution =
  | { ok: true; workspaceHost: string }
  | { ok: false; error: string; description: string; status: number };

async function resolveMcpOAuthWorkspaceHost(input: {
  store: Store;
  accountId: string;
  resource: string;
  requestedWorkspaceHost: string;
  origin: string;
}): Promise<McpOAuthWorkspaceResolution> {
  try {
    const accountWorkspace = await input.store.byAccountWorkspace(input.accountId);
    if (!accountWorkspace) {
      return {
        ok: false,
        error: 'access_denied',
        description: 'No Consuelo OS workspace is connected for this Google account.',
        status: 403,
      };
    }

    if (isCentralMcpResource(input.resource, input.origin)) {
      return { ok: true, workspaceHost: accountWorkspace.workspaceHost };
    }

    if (host(accountWorkspace.workspaceHost) !== host(input.requestedWorkspaceHost)) {
      return {
        ok: false,
        error: 'access_denied',
        description: 'This Google account is not connected to the requested Consuelo OS workspace.',
        status: 403,
      };
    }

    return { ok: true, workspaceHost: input.requestedWorkspaceHost };
  } catch {
    return {
      ok: false,
      error: 'server_error',
      description: 'Workspace membership lookup failed.',
      status: 500,
    };
  }
}

function bearerToken(request: Request): string | undefined {
  const authorization = request.headers.get('authorization')?.trim() ?? '';
  const match = /^Bearer\s+(.+)$/i.exec(authorization);
  return match?.[1]?.trim() || undefined;
}

function centralMcpUnauthorized(origin: string): Response {
  return json(
    { error: 'unauthorized', message: 'OAuth bearer token is required.' },
    {
      status: 401,
      headers: {
        'www-authenticate': 'Bearer resource_metadata="' + new URL('/.well-known/oauth-protected-resource', origin).toString() + '"',
      },
    },
  );
}

function centralMcpSafeError(input: { status: number; code: string; message?: string }): Response {
  return json({ error: { code: input.code, message: input.message ?? input.code } }, { status: input.status });
}

function centralMcpUpstreamUrl(input: { tunnelOriginUrl: string; inboundUrl: URL }): string {
  const upstreamUrl = new URL(input.tunnelOriginUrl);
  const basePath = upstreamUrl.pathname.replace(/\/$/, '');
  upstreamUrl.pathname = basePath + input.inboundUrl.pathname;
  upstreamUrl.search = input.inboundUrl.search;
  return upstreamUrl.toString();
}

function hex(bytes: Uint8Array): string {
  return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
}

async function edgeSignature(input: {
  secret: string;
  method: string;
  pathWithSearch: string;
  workspaceId: string;
  surface: string;
  timestamp: string;
  nonce: string;
}): Promise<string> {
  try {
    const canonical = [
      input.method.toUpperCase(),
      input.pathWithSearch,
      input.workspaceId,
      input.surface,
      input.timestamp,
      input.nonce,
    ].join('\n');
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(input.secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(canonical));
    return 'sha256=' + hex(new Uint8Array(signature));
  } catch {
    throw new Error('edge request signing failed');
  }
}

async function centralMcpProxyRequest(input: {
  request: Request;
  resolution: Extract<WorkspaceRouteD1Resolution, { allowed: true }>;
  upstreamUrl: string;
  internalSigningSecret: string;
}): Promise<Request> {
  try {
    const inboundUrl = new URL(input.request.url);
    const headers = new Headers(input.request.headers);
    headers.delete('x-consuelo-workspace-id');
    headers.delete('x-consuelo-hostname');
    headers.delete('x-consuelo-route');
    headers.delete('x-consuelo-surface');
    headers.delete('x-consuelo-edge-signature');
    headers.delete('x-consuelo-edge-timestamp');
    headers.delete('x-consuelo-edge-nonce');
    headers.delete('x-consuelo-connector-id');

    headers.set('x-consuelo-workspace-id', input.resolution.workspaceId);
    headers.set('x-consuelo-hostname', input.resolution.hostname);
    headers.set('x-consuelo-route', input.resolution.route);
    headers.set('x-consuelo-surface', input.resolution.surface);

    if (input.resolution.target.kind === 'os-connector') {
      headers.set('x-consuelo-connector-id', input.resolution.target.connectorId);
    }

    const edgeTimestamp = String(Date.now());
    const edgeNonce = crypto.randomUUID();
    headers.set('x-consuelo-edge-timestamp', edgeTimestamp);
    headers.set('x-consuelo-edge-nonce', edgeNonce);

    headers.set('x-consuelo-edge-signature', await edgeSignature({
      secret: input.internalSigningSecret,
      method: input.request.method,
      pathWithSearch: inboundUrl.pathname + inboundUrl.search,
      workspaceId: input.resolution.workspaceId,
      surface: input.resolution.surface,
      timestamp: edgeTimestamp,
      nonce: edgeNonce,
    }));

    const init: RequestInit & { duplex?: 'half' } = {
      headers,
      method: input.request.method,
    };

    if (input.request.method !== 'GET' && input.request.method !== 'HEAD') {
      init.body = input.request.body;
      init.duplex = 'half';
    }

    return new Request(input.upstreamUrl, init);
  } catch (error: unknown) {
    throw new Error(error instanceof Error ? error.message : 'central MCP proxy request failed');
  }
}

async function proxyCentralMcpRequest(input: {
  request: Request;
  store: Store;
  origin: string;
  nowMs: number;
  routeRegistry?: WorkspaceRouteRegistryBinding;
  internalSigningSecret?: string;
  fetchImpl: typeof fetch;
}): Promise<Response> {
  try {
    const token = bearerToken(input.request);
    if (!token) return centralMcpUnauthorized(input.origin);

    const stored = await input.store.byMcpOAuthAccessToken(await hash(token));
    if (!stored || input.nowMs >= stored.expiresAt || stored.resource !== mcpResourceUrl(input.origin)) {
      return centralMcpUnauthorized(input.origin);
    }
    if (!hasGrantedScope(stored.scopes, 'route:/mcp:read')) {
      return centralMcpSafeError({ status: 403, code: 'MISSING_SCOPE', message: 'OAuth token does not grant MCP route access.' });
    }
    if (!input.routeRegistry) {
      return centralMcpSafeError({ status: 503, code: 'WORKSPACE_ROUTE_REGISTRY_UNAVAILABLE' });
    }

    const inboundUrl = new URL(input.request.url);
    const resolution = await createWorkspaceCloudflareD1RouteRegistry(input.routeRegistry).resolve({
      host: stored.workspaceHost,
      path: inboundUrl.pathname,
      method: input.request.method,
    });
    if (!resolution.allowed) {
      return centralMcpSafeError({
        status: resolution.status,
        code: resolution.errorCode,
        message: resolution.diagnostic?.message,
      });
    }
    if (resolution.target.kind !== 'os-connector') {
      return centralMcpSafeError({ status: 404, code: 'WORKSPACE_HOSTNAME_ROUTE_NOT_FOUND' });
    }

    const internalSigningSecret = input.internalSigningSecret?.trim();
    if (!internalSigningSecret) {
      return centralMcpSafeError({ status: 503, code: 'WORKSPACE_EDGE_AUTH_REQUIRED' });
    }

    const proxyRequest = await centralMcpProxyRequest({
      request: input.request,
      resolution,
      upstreamUrl: centralMcpUpstreamUrl({
        tunnelOriginUrl: resolution.target.tunnelOriginUrl,
        inboundUrl,
      }),
      internalSigningSecret,
    });

    return await input.fetchImpl(proxyRequest);
  } catch {
    return centralMcpSafeError({ status: 500, code: 'CENTRAL_MCP_PROXY_FAILED' });
  }
}

async function startMcpOAuthAuthorization(input: {
  request: Request;
  store: Store;
  origin: string;
  googleClientId: string;
  nowMs: number;
}): Promise<Response> {
  const url = new URL(input.request.url);
  const responseType = url.searchParams.get('response_type') ?? '';
  const clientId = url.searchParams.get('client_id') ?? '';
  const redirectUriValue = url.searchParams.get('redirect_uri') ?? '';
  const resource = url.searchParams.get('resource') ?? '';
  const codeChallenge = url.searchParams.get('code_challenge') ?? '';
  const codeChallengeMethod = url.searchParams.get('code_challenge_method') ?? '';
  if (responseType !== 'code') return invalidOauthRequest('unsupported_response_type', 'Only authorization code is supported.');
  if (!validChatGptClientId(clientId)) return invalidOauthRequest('unauthorized_client', 'OAuth client is not allowed.');
  if (!validChatGptRedirectUri(redirectUriValue)) return invalidOauthRequest('invalid_request', 'redirect_uri is not allowed.');
  if (!codeChallenge || codeChallengeMethod !== 'S256') return invalidOauthRequest('invalid_request', 'PKCE S256 is required.');
  let workspaceHost: string;
  try {
    workspaceHost = workspaceHostFromMcpResource(resource);
  } catch {
    return invalidOauthRequest('invalid_target', 'resource must be a workspace MCP URL.');
  }
  const state = rand('mcp_oauth_state', 24);
  const scopes = normalizeScopes(url.searchParams.get('scope') ?? '');
  await input.store.putMcpOAuthState({
    state,
    clientId,
    redirectUri: redirectUriValue,
    requestedState: url.searchParams.get('state') ?? '',
    scope: scopes.join(' '),
    scopes,
    resource,
    workspaceHost,
    codeChallenge,
    expiresAt: input.nowMs + TTL_MS,
  });
  return Response.redirect(mcpOAuthGoogleRedirect({
    clientId: input.googleClientId,
    state,
    googleRedirectUri: redirectUri(input.origin),
  }), 302);
}

async function finishMcpOAuthGoogleCallback(input: {
  request: Request;
  store: Store;
  origin: string;
  googleClientId: string;
  googleClientSecret: string;
  fetchImpl: typeof fetch;
  googleRedirectUri: string;
  nowMs: number;
}): Promise<Response> {
  const url = new URL(input.request.url);
  const stateValue = url.searchParams.get('state') ?? '';
  const authCode = url.searchParams.get('code') ?? '';
  const oauthState = await input.store.byMcpOAuthState(stateValue);
  if (!stateValue || !authCode || !oauthState) return invalidOauthRequest('invalid_request', 'OAuth session was not found.');
  if (input.nowMs >= oauthState.expiresAt) return invalidOauthRequest('invalid_request', 'OAuth session expired.', 410);
  let identity: { sub: string; email: string; emailVerified: boolean };
  try {
    identity = await googleIdentity({
      code: authCode,
      origin: input.origin,
      clientId: input.googleClientId,
      clientSecret: input.googleClientSecret,
      fetchImpl: input.fetchImpl,
      redirectUri: input.googleRedirectUri,
    });
  } catch (error: unknown) {
    return invalidOauthRequest('access_denied', googleApprovalErrorMessage(error), 502);
  }
  const accountId = 'google:' + identity.sub;
  const workspaceResolution = await resolveMcpOAuthWorkspaceHost({
    store: input.store,
    accountId,
    resource: oauthState.resource,
    requestedWorkspaceHost: oauthState.workspaceHost,
    origin: input.origin,
  });
  if (!workspaceResolution.ok) {
    await input.store.delMcpOAuthState(stateValue);
    return invalidOauthRequest(workspaceResolution.error, workspaceResolution.description, workspaceResolution.status);
  }
  const code = rand('coa_code', 24);
  await input.store.putMcpOAuthCode({
    codeHash: await hash(code),
    clientId: oauthState.clientId,
    redirectUri: oauthState.redirectUri,
    scope: oauthState.scope,
    scopes: oauthState.scopes,
    resource: oauthState.resource,
    workspaceHost: workspaceResolution.workspaceHost,
    accountId,
    email: identity.email,
    codeChallenge: oauthState.codeChallenge,
    expiresAt: input.nowMs + MCP_OAUTH_CODE_TTL_MS,
  });
  await input.store.delMcpOAuthState(stateValue);
  return redirectWithParams(oauthState.redirectUri, {
    code,
    ...(oauthState.requestedState ? { state: oauthState.requestedState } : {}),
  });
}

async function exchangeMcpOAuthToken(input: {
  request: Request;
  store: Store;
  nowMs: number;
}): Promise<Response> {
  try {
    const p = await params(input.request);
    if (p.get('grant_type') !== 'authorization_code') return invalidOauthRequest('unsupported_grant_type', 'Only authorization_code is supported.');
    const clientId = p.get('client_id') ?? '';
    const redirectUriValue = p.get('redirect_uri') ?? '';
    const code = p.get('code') ?? '';
    const verifier = p.get('code_verifier') ?? '';
    const resource = p.get('resource') ?? '';
    const authCode = await input.store.byMcpOAuthCode(await hash(code));
    if (!authCode) return invalidOauthRequest('invalid_grant', 'Authorization code was not found.');
    if (input.nowMs >= authCode.expiresAt) return invalidOauthRequest('invalid_grant', 'Authorization code expired.');
    if (authCode.clientId !== clientId || authCode.redirectUri !== redirectUriValue) return invalidOauthRequest('invalid_grant', 'Authorization code binding mismatch.');
    if (resource && resource !== authCode.resource) return invalidOauthRequest('invalid_grant', 'Resource binding mismatch.');
    if (!verifier || await hashChallenge(verifier) !== authCode.codeChallenge) return invalidOauthRequest('invalid_grant', 'PKCE verification failed.');
    const accessToken = rand('coa', 32);
    await input.store.putMcpOAuthAccessToken({
      tokenHash: await hash(accessToken),
      clientId: authCode.clientId,
      scope: authCode.scope,
      scopes: authCode.scopes,
      resource: authCode.resource,
      workspaceHost: authCode.workspaceHost,
      accountId: authCode.accountId,
      email: authCode.email,
      issuedAt: input.nowMs,
      expiresAt: input.nowMs + MCP_OAUTH_TTL_MS,
    });
    await input.store.delMcpOAuthCode(authCode.codeHash);
    return json({
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: Math.floor(MCP_OAUTH_TTL_MS / 1000),
      scope: authCode.scope,
    });
  } catch (error: unknown) {
    return invalidOauthRequest('server_error', error instanceof Error ? error.message : 'OAuth token exchange failed.', 500);
  }
}


async function introspectMcpOAuthToken(input: {
  request: Request;
  store: Store;
  nowMs: number;
}): Promise<Response> {
  try {
    const p = await params(input.request);
    const token = p.get('token') ?? '';
    const resource = p.get('resource') ?? '';
    const requiredScope = p.get('scope') ?? '';
    const stored = token ? await input.store.byMcpOAuthAccessToken(await hash(token)) : undefined;
    if (!stored || input.nowMs >= stored.expiresAt || (resource && resource !== stored.resource) || !hasGrantedScope(stored.scopes, requiredScope)) {
      return json({ active: false });
    }
    return json({
      active: true,
      client_id: stored.clientId,
      sub: stored.accountId,
      username: stored.email,
      workspace_host: stored.workspaceHost,
      resource: stored.resource,
      scope: stored.scope,
      scopes: stored.scopes,
      exp: Math.floor(stored.expiresAt / 1000),
      iat: Math.floor(stored.issuedAt / 1000),
    });
  } catch {
    return json({ active: false });
  }
}

function grantWorkspace(grant: Grant): { workspaceSlug: string; workspaceHost: string } {
  if (!grant.workspaceSlug || !grant.workspaceHost) {
    throw new Error('workspace is required before bootstrap can be issued');
  }
  return { workspaceSlug: grant.workspaceSlug, workspaceHost: grant.workspaceHost };
}

function assignGrantWorkspace(input: { grant: Grant; workspaceSlug: string; workspaceHost: string }): void {
  input.grant.workspaceSlug = slug(input.workspaceSlug);
  input.grant.workspaceHost = host(input.workspaceHost);
}

async function rememberAccountWorkspace(input: { store: Store; grant: Grant; accountId: string; nowMs: number }): Promise<void> {
  try {
    const workspace = grantWorkspace(input.grant);
    const existing = await input.store.byAccountWorkspace(input.accountId);
    await input.store.putAccountWorkspace({
      accountId: input.accountId,
      workspaceSlug: workspace.workspaceSlug,
      workspaceHost: workspace.workspaceHost,
      homeNodeId: existing?.homeNodeId ?? input.grant.nodeId,
      updatedAt: input.nowMs,
    });
  } catch (error: unknown) {
    throw new Error(error instanceof Error ? error.message : 'account workspace persistence failed');
  }
}

async function registerGrantNode(input: { store: Store; grant: Grant; accountId: string; nowMs: number }): Promise<void> {
  try {
    const workspace = grantWorkspace(input.grant);
    const existingWorkspace = await input.store.byAccountWorkspace(input.accountId);
    const requestedNodeId = input.grant.nodeId ? optionalNodeId(input.grant.nodeId) : undefined;
    const nodeId = requestedNodeId ?? (existingWorkspace ? rand('node', 12) : workspace.workspaceSlug);
    const existingNode = await input.store.byWorkspaceNode(input.accountId, nodeId);
    const role = existingNode?.role ?? (existingWorkspace?.homeNodeId ? 'member' : 'home');
    const nodeName = input.grant.nodeName?.trim() || existingNode?.nodeName || 'local';
    input.grant.nodeId = nodeId;
    input.grant.nodeName = nodeName;
    input.grant.nodeRole = role;
    input.grant.nodeStatus = existingNode ? 'reconnected' : 'created';
    await input.store.putWorkspaceNode({
      accountId: input.accountId,
      workspaceSlug: workspace.workspaceSlug,
      workspaceHost: workspace.workspaceHost,
      nodeId,
      nodeName,
      role,
      devicePublicKeyThumbprint: input.grant.devicePublicKeyThumbprint,
      createdAt: existingNode?.createdAt ?? input.nowMs,
      updatedAt: input.nowMs,
    });
  } catch (error: unknown) {
    throw new Error(error instanceof Error ? error.message : 'workspace node registration failed');
  }
}

async function prepareGrantApproval(input: { store: Store; grant: Grant; accountId: string; authMethod: StrongerAuthMethod; nowMs: number }): Promise<Grant> {
  try {
    grantWorkspace(input.grant);
    await registerGrantNode({ store: input.store, grant: input.grant, accountId: input.accountId, nowMs: input.nowMs });
    input.grant.accountId = input.accountId;
    input.grant.accountAuthMethod = input.authMethod;
    input.grant.connectorToken = rand('cbt', 32);
    input.grant.connectorExpiresAt = input.nowMs + BOOTSTRAP_TTL_MS;
    return input.grant;
  } catch (error: unknown) {
    throw new Error(`grant approval preparation failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function commitGrantApproval(input: { store: Store; grant: Grant; accountId: string; nowMs: number }): Promise<Grant> {
  try {
    input.grant.status = 'approved';
    await input.store.put(input.grant);
    await rememberAccountWorkspace({
      store: input.store,
      grant: input.grant,
      accountId: input.accountId,
      nowMs: input.nowMs,
    });
    return input.grant;
  } catch (error: unknown) {
    throw new Error(`grant approval commit failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function defaultSiteSnapshot(input?: DefaultSiteSnapshot): Required<DefaultSiteSnapshot> {
  return {
    key: input?.key?.trim() || DEFAULT_SITE_SNAPSHOT_KEY,
    versionId: input?.versionId?.trim() || DEFAULT_SITE_SNAPSHOT_VERSION_ID,
    siteId: input?.siteId?.trim() || DEFAULT_SITE_ID,
    contentType: input?.contentType?.trim() || DEFAULT_SITE_CONTENT_TYPE,
    cachePolicy: input?.cachePolicy ?? 'static-shell',
  };
}

function createWorkspaceConnectorProvisionerFromEnv(env: Env, fetchImpl: typeof fetch): WorkspaceConnectorProvisioner | undefined {
  const accountId = env.CLOUDFLARE_ACCOUNT_ID?.trim();
  const zoneId = env.CLOUDFLARE_ZONE_ID?.trim();
  const apiToken = env.CLOUDFLARE_API_TOKEN?.trim();
  if (!accountId || !zoneId || !apiToken) return undefined;

  const cloudflare = createCloudflareWorkspaceProvisioningClient({
    accountId,
    apiToken,
    apiBaseUrl: env.OS_DEVICE_AUTH_CLOUDFLARE_API_BASE_URL,
    fetchImpl,
  });

  return async (input) => {
    try {
      const baseDomain = env.OS_DEVICE_AUTH_BASE_DOMAIN?.trim() || baseDomainFromHost(input.workspaceHost);
      const localServiceUrl = env.OS_DEVICE_AUTH_CONNECTOR_LOCAL_SERVICE_URL?.trim() || DEFAULT_CONNECTOR_LOCAL_SERVICE_URL;
      const result = await applyWorkspaceCloudflareProvisioning({
        cloudflare,
        input: {
          workspaceId: input.workspaceId,
          workspaceSlug: input.workspaceSlug,
          baseDomain,
          cloudflareZoneId: zoneId,
          connectorId: input.connectorId,
          edgeHostname: env.OS_DEVICE_AUTH_WORKSPACE_EDGE_HOSTNAME?.trim() || `workspace-edge.${baseDomain}`,
          localServiceUrl,
        },
      });

      if (host(result.workspaceHostname) !== host(input.workspaceHost)) {
        throw new Error('provisioned workspace hostname did not match device workspace host');
      }

      return {
        connectorId: result.connectorBootstrap.connectorId,
        cloudflareTunnelToken: result.connectorBootstrap.tunnelCredential,
        tunnelOriginUrl: `https://${result.osTunnelHostname}`,
        localServiceUrl,
      };
    } catch (error: unknown) {
      throw new Error(`workspace connector provisioning failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  };
}

async function registerApprovedWorkspaceRoute(input: {
  routeRegistry?: WorkspaceRouteRegistryBinding;
  workspaceConnectorProvisioner?: WorkspaceConnectorProvisioner;
  grant: Grant;
  defaultSiteSnapshot?: DefaultSiteSnapshot;
}): Promise<void> {
  if (!input.routeRegistry?.exec) return;
  try {
    if (!input.workspaceConnectorProvisioner) {
      throw new Error('workspace connector provisioning is not configured');
    }
    const workspace = grantWorkspace(input.grant);
    const workspaceId = workspaceIdFromSlug(workspace.workspaceSlug);
    const nodeId = input.grant.nodeId ?? workspace.workspaceSlug;
    const connectorId = connectorIdFromNodeId(nodeId);
    const connector = await input.workspaceConnectorProvisioner({
      workspaceId,
      workspaceSlug: workspace.workspaceSlug,
      workspaceHost: workspace.workspaceHost,
      connectorId,
    });
    const snapshot = defaultSiteSnapshot(input.defaultSiteSnapshot);
    input.grant.cloudflareTunnelToken = connector.cloudflareTunnelToken;
    await input.routeRegistry.exec(createWorkspaceEdgeRouteSeedSql({
      workspaceId,
      workspaceSlug: workspace.workspaceSlug,
      hostname: workspace.workspaceHost,
      baseDomain: baseDomainFromHost(workspace.workspaceHost),
      siteSnapshotKey: snapshot.key,
      siteVersionId: snapshot.versionId,
      connectorId: connector.connectorId,
      tunnelOriginUrl: connector.tunnelOriginUrl,
      localServiceUrl: connector.localServiceUrl,
    }));
  } catch (error: unknown) {
    throw new Error(`workspace route setup failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function approvedJson(g: Grant): Record<string, unknown> {
  const workspace = grantWorkspace(g);
  const nodeId = g.nodeId ?? workspace.workspaceSlug;
  return {
    [TOKEN_KEY]: rand('osat', 32),
    token_type: 'bearer',
    workspace_id: `workspace_${workspace.workspaceSlug.replace(/-/g, '_')}`,
    workspace_slug: workspace.workspaceSlug,
    workspace_host: workspace.workspaceHost,
    node_id: nodeId,
    node_name: g.nodeName ?? 'local',
    node_role: g.nodeRole ?? 'home',
    node_status: g.nodeStatus ?? 'created',
    connector_id: connectorIdFromNodeId(nodeId),
    [CONNECTOR_TOKEN_KEY]: g.connectorToken ?? rand('cbt', 32),
    ...(g.cloudflareTunnelToken ? { [CLOUDFLARE_TUNNEL_TOKEN_KEY]: g.cloudflareTunnelToken } : {}),
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
  workspaceRouteRegistry?: WorkspaceRouteRegistryBinding;
  workspaceConnectorProvisioner?: WorkspaceConnectorProvisioner;
  workspaceEdgeInternalSigningSecret?: string;
  defaultSiteSnapshot?: DefaultSiteSnapshot;
}) {
  const origin = input.origin ?? ORIGIN;
  const now = input.now ?? Date.now;
  const fetchImpl = input.fetchImpl ?? ((url, init) => globalThis.fetch(url, init));
  return async (request: Request): Promise<Response> => {
    try {
      const url = new URL(request.url);
      if (url.pathname === '/') return Response.redirect(new URL('/login/device', origin), 302);
      if (url.pathname === '/health') return json({ ok: true, service: 'consuelo-os-device-authority' });
      if (url.pathname === '/.well-known/oauth-authorization-server') return json(authorizationServerMetadata(origin));
      if (isProtectedResourceMetadataPath(url.pathname)) return json(oauthProtectedResourceMetadata(origin));
      if (isMcpRequestPath(url.pathname)) {
        return await proxyCentralMcpRequest({
          request,
          store: input.store,
          origin,
          nowMs: now(),
          routeRegistry: input.workspaceRouteRegistry,
          internalSigningSecret: input.workspaceEdgeInternalSigningSecret,
          fetchImpl,
        });
      }
      if (url.pathname === '/oauth/authorize') {
        if (request.method !== 'GET') return methodNotAllowed('GET');
        const google = googleConfig({ clientId: input.googleOAuthClientId, clientSecret: input.googleOAuthClientSecret });
        if (!google) return invalidOauthRequest('temporarily_unavailable', 'Google approval is not configured yet.', 503);
        return await startMcpOAuthAuthorization({
          request,
          store: input.store,
          origin,
          googleClientId: google.clientId,
          nowMs: now(),
        });
      }
      if (url.pathname === '/oauth/google/callback') {
        if (request.method !== 'GET') return methodNotAllowed('GET');
        const google = googleConfig({ clientId: input.googleOAuthClientId, clientSecret: input.googleOAuthClientSecret });
        if (!google) return invalidOauthRequest('temporarily_unavailable', 'Google approval is not configured yet.', 503);
        return await finishMcpOAuthGoogleCallback({
          request,
          store: input.store,
          origin,
          googleClientId: google.clientId,
          googleClientSecret: google.clientSecret,
          fetchImpl,
          googleRedirectUri: new URL('/oauth/google/callback', origin).toString(),
          nowMs: now(),
        });
      }
      if (url.pathname === '/oauth/token') {
        if (request.method !== 'POST') return methodNotAllowed('POST');
        return await exchangeMcpOAuthToken({ request, store: input.store, nowMs: now() });
      }
      if (url.pathname === '/oauth/introspect') {
        if (request.method !== 'POST') return methodNotAllowed('POST');
        return await introspectMcpOAuthToken({ request, store: input.store, nowMs: now() });
      }
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
        const mcpOAuthState = stateValue ? await input.store.byMcpOAuthState(stateValue) : undefined;
        if (authCode && mcpOAuthState) {
          return await finishMcpOAuthGoogleCallback({
            request,
            store: input.store,
            origin,
            googleClientId: google.clientId,
            googleClientSecret: google.clientSecret,
            fetchImpl,
            googleRedirectUri: redirectUri(origin),
            nowMs: now(),
          });
        }
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
        const accountId = `google:${identity.sub}`;
        const existingWorkspace = await input.store.byAccountWorkspace(accountId);
        if (existingWorkspace) {
          assignGrantWorkspace({
            grant,
            workspaceSlug: existingWorkspace.workspaceSlug,
            workspaceHost: existingWorkspace.workspaceHost,
          });
        }
        if (grant.workspaceSlug && grant.workspaceHost) {
          try {
            await prepareGrantApproval({ store: input.store, grant, accountId, authMethod: 'google', nowMs: now() });
            await registerApprovedWorkspaceRoute({
              routeRegistry: input.workspaceRouteRegistry,
              workspaceConnectorProvisioner: input.workspaceConnectorProvisioner,
              grant,
              defaultSiteSnapshot: input.defaultSiteSnapshot,
            });
          } catch (error: unknown) {
            return text(page({ code: oauthState.userCode, origin, error: `Workspace route setup failed (${error instanceof Error ? error.message : String(error)}). Restart the installer after platform setup is fixed.` }), { status: 502 });
          }
          await input.store.delOAuthState(stateValue);
          await commitGrantApproval({ store: input.store, grant, accountId, nowMs: now() });
          return text(page({ code: oauthState.userCode, origin, message: `Approved for ${identity.email}. Return to your terminal.` }));
        }
        grant.accountId = accountId;
        grant.accountAuthMethod = 'google';
        await input.store.put(grant);
        await input.store.delOAuthState(stateValue);
        return text(page({ code: oauthState.userCode, origin, message: `Approved for ${identity.email}. Return to your terminal to name this workspace.` }));
      }
      if (url.pathname === '/login/device/code') {
        if (request.method !== 'POST') return methodNotAllowed('POST');
        const p = await params(request);
        const publicKey = (p.get('device_public_key_jwk') ?? '').trim();
        if (!publicKey) return json({ error: 'device_public_key_required' }, { status: 400 });
        const requestedWorkspaceSlug = p.get('workspace_slug') ?? p.get('workspace_name') ?? '';
        const workspaceSlug = requestedWorkspaceSlug.trim() ? slug(requestedWorkspaceSlug) : undefined;
        const workspaceHost = workspaceSlug
          ? host(p.get('workspace_host')?.trim() || `${workspaceSlug}.consuelohq.com`)
          : undefined;
        const requestedNodeId = optionalNodeId(p.get('node_id') ?? '');
        const requestedNodeName = (p.get('node_name') ?? '').trim();
        const deviceCode = rand('dev', 24);
        const code = userCode();
        const g: Grant = {
          hash: await hash(deviceCode),
          userCode: code,
          ...(workspaceSlug && workspaceHost ? { workspaceSlug, workspaceHost } : {}),
          ...(requestedNodeId ? { nodeId: requestedNodeId } : {}),
          ...(requestedNodeName ? { nodeName: requestedNodeName } : {}),
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
      if (url.pathname === '/login/device/workspace') {
        if (request.method !== 'POST') return methodNotAllowed('POST');
        const p = await params(request);
        const deviceCode = p.get('device_code') ?? '';
        const g = await input.store.byHash(await hash(deviceCode));
        if (!g) return json({ error: 'access_denied' }, { status: 400 });
        if (now() >= g.expiresAt) { await input.store.del(g.hash); return json({ error: 'expired_token' }, { status: 400 }); }
        if (!g.accountId || !g.accountAuthMethod) return json({ error: 'account_session_required' }, { status: 401 });
        const clientId = p.get('client_id') ?? '';
        const proofPayload = p.get(DEVICE_PROOF_PAYLOAD_KEY) ?? '';
        const proof = p.get(DEVICE_PROOF_KEY) ?? '';
        if (!await verifyDevicePublicKeyProof(g, { clientId, deviceCode, proofPayload, proof })) return json({ error: 'invalid_device_public_key_proof' }, { status: 400 });
        const workspaceSlug = slug(p.get('workspace_slug') ?? p.get('workspace_name') ?? '');
        const workspaceHost = host(p.get('workspace_host')?.trim() || `${workspaceSlug}.consuelohq.com`);
        assignGrantWorkspace({ grant: g, workspaceSlug, workspaceHost });
        try {
          await prepareGrantApproval({ store: input.store, grant: g, accountId: g.accountId, authMethod: g.accountAuthMethod, nowMs: now() });
          await registerApprovedWorkspaceRoute({
            routeRegistry: input.workspaceRouteRegistry,
            workspaceConnectorProvisioner: input.workspaceConnectorProvisioner,
            grant: g,
            defaultSiteSnapshot: input.defaultSiteSnapshot,
          });
        } catch (error: unknown) {
          return json({ error: 'workspace_route_setup_failed', message: error instanceof Error ? error.message : String(error) }, { status: 502 });
        }
        await commitGrantApproval({ store: input.store, grant: g, accountId: g.accountId, nowMs: now() });
        await input.store.del(g.hash);
        return json(approvedJson(g));
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
        const existingWorkspace = await input.store.byAccountWorkspace(auth.accountId);
        if (existingWorkspace) {
          assignGrantWorkspace({
            grant: g,
            workspaceSlug: existingWorkspace.workspaceSlug,
            workspaceHost: existingWorkspace.workspaceHost,
          });
        }
        if (!g.workspaceSlug || !g.workspaceHost) {
          g.accountId = auth.accountId;
          g.accountAuthMethod = auth.method;
          await input.store.put(g);
          return json({ status: 'workspace_required', account_id: auth.accountId, account_auth_method: auth.method, device_public_key_thumbprint: g.devicePublicKeyThumbprint, device_public_key_bound: true });
        }
        try {
          await prepareGrantApproval({ store: input.store, grant: g, accountId: auth.accountId, authMethod: auth.method, nowMs: now() });
          await registerApprovedWorkspaceRoute({
            routeRegistry: input.workspaceRouteRegistry,
            workspaceConnectorProvisioner: input.workspaceConnectorProvisioner,
            grant: g,
            defaultSiteSnapshot: input.defaultSiteSnapshot,
          });
        } catch (error: unknown) {
          return json({ error: 'workspace_route_setup_failed', message: error instanceof Error ? error.message : String(error) }, { status: 502 });
        }
        await commitGrantApproval({ store: input.store, grant: g, accountId: auth.accountId, nowMs: now() });
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
        if (g.status !== 'approved') {
          if (g.accountId && (!g.workspaceSlug || !g.workspaceHost)) {
            return json({ error: 'workspace_required', interval: g.interval, message: 'Name this workspace in your terminal to finish device setup.' }, { status: 400 });
          }
          return json({ error: 'authorization_pending', interval: g.interval }, { status: 400 });
        }
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
      workspaceRouteRegistry: env.WORKSPACE_ROUTE_REGISTRY,
      workspaceConnectorProvisioner: createWorkspaceConnectorProvisionerFromEnv(env, (url, init) => globalThis.fetch(url, init)),
      workspaceEdgeInternalSigningSecret: env.WORKSPACE_EDGE_INTERNAL_SIGNING_SECRET,
      defaultSiteSnapshot: {
        key: env.OS_DEVICE_AUTH_DEFAULT_SITE_SNAPSHOT_KEY ?? DEFAULT_SITE_SNAPSHOT_KEY,
        versionId: env.OS_DEVICE_AUTH_DEFAULT_SITE_SNAPSHOT_VERSION_ID ?? DEFAULT_SITE_SNAPSHOT_VERSION_ID,
      },
    });
  }
  fetch(request: Request) { return this.handler(request); }
}

export default { fetch(request: Request, env: Env) { return env.DEVICE_GRANTS.get(env.DEVICE_GRANTS.idFromName('global')).fetch(request); } };
