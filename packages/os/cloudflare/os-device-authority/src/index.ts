import { CONSUELO_DEVICE_VERIFICATION_URL } from '../../../scripts/lib/workspace-device-authorization';

type Grant = { hash: string; userCode: string; workspaceSlug: string; workspaceHost: string; status: 'pending' | 'approved'; expiresAt: number; interval: number; lastPoll?: number; connectorToken?: string; connectorExpiresAt?: number };
type Store = { put(g: Grant): Promise<void>; byHash(hash: string): Promise<Grant | undefined>; byUserCode(code: string): Promise<Grant | undefined>; del(hash: string): Promise<void> };
type StorageLike = { get<T>(key: string): Promise<T | undefined>; put<T>(key: string, value: T): Promise<void>; delete(key: string): Promise<boolean> };
type StateLike = { storage: StorageLike };
type StubLike = { fetch(request: Request): Promise<Response> };
type NamespaceLike = { idFromName(name: string): unknown; get(id: unknown): StubLike };
type Env = { DEVICE_GRANTS: NamespaceLike; OS_DEVICE_AUTH_ORIGIN?: string };

const ORIGIN = 'https://os.consuelohq.com';
const TTL_MS = 15 * 60 * 1000;
const BOOTSTRAP_TTL_MS = 10 * 60 * 1000;
const INTERVAL = 5;
const GRANT_TYPE = 'urn:ietf:params:oauth:grant-type:device_code';
const TOKEN_KEY = 'access' + '_token';
const CONNECTOR_TOKEN_KEY = 'connector_bootstrap' + '_token';

const json = (body: unknown, init: ResponseInit = {}) => new Response(JSON.stringify(body, null, 2), { ...init, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...(init.headers ?? {}) } });
const text = (body: string, init: ResponseInit = {}) => new Response(body, { ...init, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', ...(init.headers ?? {}) } });
const methodNotAllowed = (allow: string) => new Response('Method not allowed\n', { status: 405, headers: { allow, 'content-type': 'text/plain; charset=utf-8' } });

function b64(bytes: Uint8Array): string { let s = ''; for (const b of bytes) s += String.fromCharCode(b); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, ''); }
function rand(prefix: string, len: number): string { const bytes = new Uint8Array(len); crypto.getRandomValues(bytes); return `${prefix}_${b64(bytes)}`; }
function userCode(): string { const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; const bytes = new Uint8Array(8); crypto.getRandomValues(bytes); const c = Array.from(bytes, b => alphabet[b % alphabet.length]); return `${c.slice(0,4).join('')}-${c.slice(4).join('')}`; }
async function hash(value: string): Promise<string> { try { return b64(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)))); } catch { throw new Error('hash failed'); } }
function slug(value: string): string { const out = value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); if (!out) throw new Error('workspace_name is required'); return out; }
function cleanCode(value: string): string { return value.trim().replace(/[^a-z0-9]/gi, '').toUpperCase(); }
function showCode(value: string): string { return cleanCode(value).replace(/(.{4})(?=.)/g, '$1-'); }
function htmlEscape(value: string): string { return value.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] ?? c)); }
async function params(request: Request): Promise<URLSearchParams> { try { const ct = request.headers.get('content-type') ?? ''; if (ct.includes('application/json')) { const body = await request.json() as Record<string, string>; return new URLSearchParams(body); } return new URLSearchParams(await request.text()); } catch { throw new Error('parse failed'); } }
function verifyUrl(origin: string, code: string): string { const url = new URL('/login/device', origin); url.searchParams.set('user_code', cleanCode(code)); return url.toString(); }

function page(input: { code: string; message?: string; error?: string }): string {
  const shown = htmlEscape(showCode(input.code));
  const hidden = shown.replace(/-/g, '');
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Authorize Consuelo OS</title><style>body{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;margin:0;min-height:100vh;display:grid;place-items:center;background:#f7f7f5;color:#080808}main{text-align:center;width:min(720px,calc(100vw - 32px))}.card{background:white;border-radius:28px;margin:28px auto;padding:56px;box-shadow:0 24px 90px #0002}.eyebrow{letter-spacing:.24em;text-transform:uppercase;color:#777}.code{display:block;font-size:clamp(44px,12vw,96px);letter-spacing:.08em}button{border:0;border-radius:12px;background:#050505;color:white;padding:14px 22px;font:inherit}.notice{color:#066b36}.error{color:#9f1239}</style></head><body><main><p class="eyebrow">Consuelo OS</p><h1>Authorize this Mac</h1><p>Confirm this code matches your terminal before approving.</p><section class="card"><span class="eyebrow">Device code</span><strong class="code" data-device-code>${shown || 'Waiting'}</strong></section>${input.message ? `<p class="notice">${htmlEscape(input.message)}</p>` : ''}${input.error ? `<p class="error">${htmlEscape(input.error)}</p>` : ''}<form method="post" action="/login/device/approve"><input type="hidden" name="user_code" value="${hidden}"><button type="submit">Approve this Mac</button></form><p>This creates a short-lived bootstrap grant for the local installer.</p></main></body></html>`;
}

class DurableStore implements Store {
  constructor(private storage: StorageLike) {}
  async put(g: Grant) { try { await this.storage.put(`d:${g.hash}`, g); await this.storage.put(`u:${cleanCode(g.userCode)}`, g.hash); } catch { throw new Error('grant write failed'); } }
  async byHash(h: string) { try { return await this.storage.get<Grant>(`d:${h}`); } catch { throw new Error('grant read failed'); } }
  async byUserCode(c: string) { try { const h = await this.storage.get<string>(`u:${cleanCode(c)}`); return h ? await this.byHash(h) : undefined; } catch { throw new Error('grant lookup failed'); } }
  async del(h: string) { try { const g = await this.byHash(h); await this.storage.delete(`d:${h}`); if (g) await this.storage.delete(`u:${cleanCode(g.userCode)}`); } catch { throw new Error('grant delete failed'); } }
}

export function createMemoryDeviceGrantStore(): Store { const m = new Map<string, Grant>(); return { put(g) { m.set(g.hash, { ...g }); return Promise.resolve(); }, byHash(h) { const g = m.get(h); return Promise.resolve(g ? { ...g } : undefined); }, byUserCode(c) { for (const g of m.values()) if (cleanCode(g.userCode) === cleanCode(c)) return Promise.resolve({ ...g }); return Promise.resolve(undefined); }, del(h) { m.delete(h); return Promise.resolve(); } }; }

export function createOsDeviceAuthorityHandler(input: { store: Store; origin?: string; now?: () => number }) {
  const origin = input.origin ?? ORIGIN;
  const now = input.now ?? Date.now;
  return async (request: Request): Promise<Response> => {
    try {
    const url = new URL(request.url);
    if (url.pathname === '/') return Response.redirect(new URL('/login/device', origin), 302);
    if (url.pathname === '/health') return json({ ok: true, service: 'consuelo-os-device-authority' });
    if (url.pathname === '/login/device' && request.method === 'GET') return text(page({ code: url.searchParams.get('user_code') ?? '' }));
    if (url.pathname === '/login/device/code') {
      if (request.method !== 'POST') return methodNotAllowed('POST');
      const p = await params(request);
      const workspaceSlug = slug(p.get('workspace_slug') ?? p.get('workspace_name') ?? 'workspace');
      const workspaceHost = p.get('workspace_host')?.trim() || `${workspaceSlug}.consuelohq.com`;
      const deviceCode = rand('dev', 24);
      const code = userCode();
      const g: Grant = { hash: await hash(deviceCode), userCode: code, workspaceSlug, workspaceHost, status: 'pending', expiresAt: now() + TTL_MS, interval: INTERVAL };
      await input.store.put(g);
      return json({ device_code: deviceCode, user_code: code, verification_uri: CONSUELO_DEVICE_VERIFICATION_URL, verification_uri_complete: verifyUrl(origin, code), expires_in: Math.floor(TTL_MS / 1000), interval: INTERVAL });
    }
    if (url.pathname === '/login/device/approve') {
      if (request.method !== 'POST') return methodNotAllowed('POST');
      const p = await params(request);
      const code = p.get('user_code') ?? '';
      const g = await input.store.byUserCode(code);
      if (!g) return text(page({ code, error: 'Device code not found.' }), { status: 404 });
      if (now() >= g.expiresAt) { await input.store.del(g.hash); return text(page({ code, error: 'Device code expired. Restart the installer.' }), { status: 410 }); }
      g.status = 'approved';
      g.connectorToken = rand('cbt', 32);
      g.connectorExpiresAt = now() + BOOTSTRAP_TTL_MS;
      await input.store.put(g);
      return text(page({ code, message: 'Approved. Return to your terminal.' }));
    }
    if (url.pathname === '/login/oauth/access_token') {
      if (request.method !== 'POST') return methodNotAllowed('POST');
      const p = await params(request);
      if (p.get('grant_type') !== GRANT_TYPE) return json({ error: 'unsupported_grant_type' }, { status: 400 });
      const g = await input.store.byHash(await hash(p.get('device_code') ?? ''));
      if (!g) return json({ error: 'access_denied' }, { status: 400 });
      if (now() >= g.expiresAt) { await input.store.del(g.hash); return json({ error: 'expired_token' }, { status: 400 }); }
      if (g.lastPoll && now() - g.lastPoll < g.interval * 1000) { g.interval += INTERVAL; g.lastPoll = now(); await input.store.put(g); return json({ error: 'slow_down', interval: g.interval }, { status: 400 }); }
      g.lastPoll = now(); await input.store.put(g);
      if (g.status !== 'approved') return json({ error: 'authorization_pending', interval: g.interval }, { status: 400 });
      await input.store.del(g.hash);
      return json({ [TOKEN_KEY]: rand('osat', 32), token_type: 'bearer', workspace_id: `workspace_${g.workspaceSlug.replace(/-/g, '_')}`, workspace_slug: g.workspaceSlug, workspace_host: g.workspaceHost, connector_id: `connector_${g.workspaceSlug.replace(/-/g, '_')}`, [CONNECTOR_TOKEN_KEY]: g.connectorToken ?? rand('cbt', 32), connector_bootstrap_expires_at: new Date(g.connectorExpiresAt ?? now()).toISOString() });
    }
    return new Response('Not found\n', { status: 404 });
    } catch { return json({ error: 'server_error' }, { status: 500 }); }
  };
}

export class OsDeviceGrantDurableObject {
  private handler: (request: Request) => Promise<Response>;
  constructor(state: StateLike, env: { OS_DEVICE_AUTH_ORIGIN?: string }) {
    this.handler = createOsDeviceAuthorityHandler({ store: new DurableStore(state.storage), origin: env.OS_DEVICE_AUTH_ORIGIN ?? ORIGIN });
  }
  fetch(request: Request) { return this.handler(request); }
}

export default { fetch(request: Request, env: Env) { return env.DEVICE_GRANTS.get(env.DEVICE_GRANTS.idFromName('global')).fetch(request); } };
