import type { Hono } from 'hono';

import { json, methodNotAllowed, text } from '../http';
import {
  buildWorkspaceSessionCookie,
  normalizeAuthReturnPath,
  resolveMembershipChoice,
} from '../security/web-auth-contract';
import type {
  AuthoritySession,
  DeviceAuthorityRuntime,
  WorkspaceMembership,
} from '../types';
import { hash, htmlEscape, params, rand } from '../utils';

export const AUTHORITY_SESSION_COOKIE = '__Host-consuelo_os_authority';
export const WORKSPACE_SESSION_COOKIE = '__Host-consuelo_os_session';
export const WORKSPACE_CSRF_COOKIE = '__Host-consuelo_os_csrf';

const AUTHORITY_SESSION_TTL_MS = 15 * 60 * 1000;
const WORKSPACE_HANDOFF_TTL_MS = 60 * 1000;
const WORKSPACE_SESSION_TTL_MS = 8 * 60 * 60 * 1000;
const INTERNAL_AUTH_HEADER = 'x-consuelo-internal-auth-secret';

function cookieValue(request: Request, name: string): string {
  const raw = request.headers.get('cookie') ?? '';
  for (const part of raw.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return decodeURIComponent(rest.join('='));
  }
  return '';
}

function authorityCookie(value: string, maxAgeSeconds: number): string {
  return [
    `${AUTHORITY_SESSION_COOKIE}=${encodeURIComponent(value)}`,
    'Path=/',
    `Max-Age=${Math.max(0, Math.floor(maxAgeSeconds))}`,
    'Secure',
    'HttpOnly',
    'SameSite=Lax',
  ].join('; ');
}

function csrfCookie(value: string, maxAgeSeconds: number): string {
  return [
    `${WORKSPACE_CSRF_COOKIE}=${encodeURIComponent(value)}`,
    'Path=/',
    `Max-Age=${Math.max(0, Math.floor(maxAgeSeconds))}`,
    'Secure',
    'SameSite=Strict',
  ].join('; ');
}

function clearCookie(name: string, httpOnly: boolean): string {
  return [
    `${name}=`,
    'Path=/',
    'Max-Age=0',
    'Secure',
    ...(httpOnly ? ['HttpOnly'] : []),
    'SameSite=Lax',
  ].join('; ');
}

function redirectWithCookies(location: string, cookies: string[]): Response {
  const headers = new Headers({
    location,
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
  });
  for (const cookie of cookies) headers.append('set-cookie', cookie);
  return new Response(null, { status: 302, headers });
}

function activeMemberships(
  memberships: WorkspaceMembership[],
): WorkspaceMembership[] {
  return memberships
    .filter((membership) => membership.status === 'active')
    .sort((a, b) =>
      a.workspaceHost.localeCompare(b.workspaceHost) ||
      a.workspaceId.localeCompare(b.workspaceId),
    );
}

function canonicalWorkspaceHost(value: string): string {
  const normalized = value.trim().toLowerCase();
  if (
    !normalized ||
    !/^[a-z0-9.-]+$/.test(normalized) ||
    normalized.includes('..')
  ) {
    throw new Error('invalid workspace host');
  }
  const url = new URL(`https://${normalized}`);
  if (
    url.hostname !== normalized ||
    url.host !== normalized ||
    url.username ||
    url.password ||
    url.port ||
    url.pathname !== '/'
  ) {
    throw new Error('invalid workspace host');
  }
  return normalized;
}

async function authoritySession(
  request: Request,
  runtime: DeviceAuthorityRuntime,
): Promise<AuthoritySession | undefined> {
  try {
    const token = cookieValue(request, AUTHORITY_SESSION_COOKIE);
    if (!token) return undefined;
    const session = await runtime.store.byAuthoritySession(await hash(token));
    if (!session || runtime.now() >= session.expiresAt) {
      if (session) await runtime.store.delAuthoritySession(session.tokenHash);
      return undefined;
    }
    return session;
  } catch {
    throw new Error('authority session lookup failed');
  }
}

async function issueHandoff(input: {
  runtime: DeviceAuthorityRuntime;
  session: AuthoritySession;
  membership: WorkspaceMembership;
  returnPath: string;
}): Promise<Response> {
  try {
    const token = rand('wlh', 32);
    const nowMs = input.runtime.now();
    const workspaceHost = canonicalWorkspaceHost(
      input.membership.workspaceHost,
    );
    await input.runtime.store.putWorkspaceLoginHandoff({
      tokenHash: await hash(token),
      accountId: input.session.accountId,
      workspaceId: input.membership.workspaceId,
      workspaceHost,
      returnPath: normalizeAuthReturnPath(input.returnPath),
      nonce: rand('handoff_nonce', 16),
      issuedAt: nowMs,
      expiresAt: nowMs + WORKSPACE_HANDOFF_TTL_MS,
    });
    const destination = new URL(
      '/auth/consume',
      `https://${workspaceHost}`,
    );
    destination.searchParams.set('handoff', token);
    return Response.redirect(destination.toString(), 302);
  } catch {
    return json({ error: 'handoff_unavailable' }, { status: 503 });
  }
}

export function universalLoginPage(): string {
  return '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Consuelo OS</title></head><body><main><h1>Consuelo OS</h1><p>Continue to your workspace.</p><a href="/login/google/start?purpose=web">Sign in with Google</a></main></body></html>';
}

export async function completeWebGoogleLogin(input: {
  runtime: DeviceAuthorityRuntime;
  accountId: string;
  email: string;
  returnPath: string;
}): Promise<Response> {
  try {
    const token = rand('was', 32);
    const nowMs = input.runtime.now();
    await input.runtime.store.putAuthoritySession({
      tokenHash: await hash(token),
      accountId: input.accountId,
      email: input.email,
      csrfToken: rand('csrf', 24),
      issuedAt: nowMs,
      expiresAt: nowMs + AUTHORITY_SESSION_TTL_MS,
    });
    const location = new URL('/auth/workspaces', input.runtime.origin);
    location.searchParams.set(
      'return_to',
      normalizeAuthReturnPath(input.returnPath),
    );
    return redirectWithCookies(location.toString(), [
      authorityCookie(token, AUTHORITY_SESSION_TTL_MS / 1000),
    ]);
  } catch {
    return json({ error: 'login_unavailable' }, { status: 503 });
  }
}

function chooserPage(input: {
  memberships: WorkspaceMembership[];
  csrfToken: string;
  returnPath: string;
}): string {
  const options = input.memberships
    .map(
      (membership) =>
        `<button type="submit" name="workspace_id" value="${htmlEscape(membership.workspaceId)}">${htmlEscape(membership.workspaceHost)}</button>`,
    )
    .join('');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Choose workspace</title></head><body><main><h1>Choose a workspace</h1><form method="post" action="/auth/handoff"><input type="hidden" name="csrf_token" value="${htmlEscape(input.csrfToken)}"><input type="hidden" name="return_to" value="${htmlEscape(input.returnPath)}">${options}</form></main></body></html>`;
}

function noMembershipPage(): string {
  return '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>No workspace</title></head><body><main><h1>No workspace is connected</h1><p>Ask a workspace administrator for access.</p></main></body></html>';
}

async function handleWebAuthRequest(
  request: Request,
  runtime: DeviceAuthorityRuntime,
): Promise<Response> {
  const url = new URL(request.url);
  try {

  if (url.pathname === '/auth/workspaces') {
    if (request.method !== 'GET') return methodNotAllowed('GET');
    const session = await authoritySession(request, runtime);
    if (!session) return json({ error: 'authority_session_required' }, { status: 401 });
    const memberships = activeMemberships(
      await runtime.store.listWorkspaceMemberships(session.accountId),
    );
    const returnPath = normalizeAuthReturnPath(url.searchParams.get('return_to'));
    const choice = resolveMembershipChoice(memberships);
    if (choice.kind === 'none') return text(noMembershipPage());
    if (choice.kind === 'single') {
      const membership = memberships[0];
      if (!membership) return json({ error: 'membership_not_found' }, { status: 404 });
      return issueHandoff({ runtime, session, membership, returnPath });
    }
    return text(
      chooserPage({
        memberships,
        csrfToken: session.csrfToken,
        returnPath,
      }),
    );
  }

  if (url.pathname === '/auth/handoff') {
    if (request.method !== 'POST') return methodNotAllowed('POST');
    if (request.headers.get('origin') !== runtime.origin) {
      return json({ error: 'csrf_failed' }, { status: 403 });
    }
    const session = await authoritySession(request, runtime);
    if (!session) return json({ error: 'authority_session_required' }, { status: 401 });
    const body = await params(request);
    if (body.get('csrf_token') !== session.csrfToken) {
      return json({ error: 'csrf_failed' }, { status: 403 });
    }
    const workspaceId = body.get('workspace_id') ?? '';
    const memberships = activeMemberships(
      await runtime.store.listWorkspaceMemberships(session.accountId),
    );
    const membership = memberships.find(
      (candidate) => candidate.workspaceId === workspaceId,
    );
    if (!membership) {
      return json({ error: 'membership_not_found' }, { status: 404 });
    }
    return issueHandoff({
      runtime,
      session,
      membership,
      returnPath: body.get('return_to') ?? '/',
    });
  }

  if (url.pathname === '/auth/consume') {
    if (request.method !== 'GET') return methodNotAllowed('GET');
    const token = url.searchParams.get('handoff') ?? '';
    if (!token) return json({ error: 'invalid_handoff' }, { status: 400 });
    const handoff = await runtime.store.consumeWorkspaceLoginHandoff({
      tokenHash: await hash(token),
      audienceHost: url.hostname,
      nowMs: runtime.now(),
    });
    if (!handoff) return json({ error: 'invalid_handoff' }, { status: 400 });
    const sessionToken = rand('wss', 32);
    const csrfToken = rand('csrf', 24);
    const nowMs = runtime.now();
    await runtime.store.putWorkspaceBrowserSession({
      tokenHash: await hash(sessionToken),
      accountId: handoff.accountId,
      workspaceId: handoff.workspaceId,
      workspaceHost: handoff.workspaceHost,
      csrfToken,
      issuedAt: nowMs,
      expiresAt: nowMs + WORKSPACE_SESSION_TTL_MS,
    });
    return redirectWithCookies(handoff.returnPath, [
      buildWorkspaceSessionCookie({
        value: sessionToken,
        maxAgeSeconds: WORKSPACE_SESSION_TTL_MS / 1000,
      }),
      csrfCookie(csrfToken, WORKSPACE_SESSION_TTL_MS / 1000),
    ]);
  }

  if (url.pathname === '/auth/logout') {
    if (request.method !== 'POST') return methodNotAllowed('POST');
    if (request.headers.get('origin') !== `https://${url.hostname}`) {
      return json({ error: 'csrf_failed' }, { status: 403 });
    }
    const token = cookieValue(request, WORKSPACE_SESSION_COOKIE);
    const csrfToken = cookieValue(request, WORKSPACE_CSRF_COOKIE);
    if (!token || !csrfToken || request.headers.get('x-consuelo-csrf-token') !== csrfToken) {
      return json({ error: 'csrf_failed' }, { status: 403 });
    }
    const tokenHash = await hash(token);
    const session = await runtime.store.byWorkspaceBrowserSession(tokenHash);
    if (
      !session ||
      runtime.now() >= session.expiresAt ||
      session.workspaceHost !== url.hostname ||
      session.csrfToken !== csrfToken
    ) {
      return json({ error: 'workspace_session_required' }, { status: 401 });
    }
    await runtime.store.delWorkspaceBrowserSession(tokenHash);
    const headers = new Headers({ 'cache-control': 'no-store' });
    headers.append('set-cookie', clearCookie(WORKSPACE_SESSION_COOKIE, true));
    headers.append('set-cookie', clearCookie(WORKSPACE_CSRF_COOKIE, false));
    return new Response(null, { status: 204, headers });
  }

  if (url.pathname === '/internal/auth/session/validate') {
    if (request.method !== 'POST') return methodNotAllowed('POST');
    if (
      !runtime.workspaceEdgeInternalSigningSecret ||
      request.headers.get(INTERNAL_AUTH_HEADER) !==
        runtime.workspaceEdgeInternalSigningSecret
    ) {
      return json({ error: 'not_found' }, { status: 404 });
    }
    const token = cookieValue(request, WORKSPACE_SESSION_COOKIE);
    if (!token) {
      return json({ error: 'workspace_session_required' }, { status: 401 });
    }
    const session = await runtime.store.byWorkspaceBrowserSession(
      await hash(token),
    );
    const workspaceId = request.headers.get('x-consuelo-workspace-id') ?? '';
    const workspaceHost =
      request.headers.get('x-consuelo-workspace-host')?.trim().toLowerCase() ?? '';
    if (
      !session ||
      runtime.now() >= session.expiresAt ||
      session.workspaceId !== workspaceId ||
      session.workspaceHost !== workspaceHost
    ) {
      return json({ error: 'workspace_session_required' }, { status: 401 });
    }
    return new Response(null, {
      status: 204,
      headers: { 'cache-control': 'no-store' },
    });
  }

    return new Response('Not found\n', { status: 404 });
  } catch {
    return json({ error: 'auth_unavailable' }, { status: 503 });
  }
}

export function registerWebAuthRoutes(
  app: Hono,
  runtime: DeviceAuthorityRuntime,
): void {
  for (const path of [
    '/auth/workspaces',
    '/auth/handoff',
    '/auth/consume',
    '/auth/logout',
    '/internal/auth/session/validate',
  ]) {
    app.all(path, (context) => handleWebAuthRequest(context.req.raw, runtime));
  }
}
