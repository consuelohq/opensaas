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
  WorkspaceBrowserSession,
  WorkspaceMembership,
} from '../types';
import { hash, htmlEscape, params, rand } from '../utils';
import {
  CloudFirstOnboardingError,
  cloudFirstProvisioningStatus,
  createCloudFirstWorkspace,
} from '../services/cloud-first-onboarding';
import {
  ManagedCloudBillingError,
  handleManagedCloudStripeWebhook,
  isPaidCloudFirstPlanId,
  managedCloudCheckoutStatus,
  managedCloudSignupCatalog,
  startManagedCloudCheckout,
} from '../services/managed-cloud-billing';

export const AUTHORITY_SESSION_COOKIE = '__Host-consuelo_os_authority';
export const WORKSPACE_SESSION_COOKIE = '__Host-consuelo_os_session';
export const WORKSPACE_CSRF_COOKIE = '__Host-consuelo_os_csrf';

const AUTHORITY_SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const WORKSPACE_HANDOFF_TTL_MS = 60 * 1000;
const WORKSPACE_SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const INTERNAL_AUTH_HEADER = 'x-consuelo-internal-auth-secret';

function cookieValue(request: Request, name: string): string {
  const raw = request.headers.get('cookie') ?? '';
  for (const part of raw.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return decodeURIComponent(rest.join('='));
  }
  return '';
}

export async function authenticateInternalWorkspaceSession(
  request: Request,
  runtime: DeviceAuthorityRuntime,
  options: { requireCsrf?: boolean; requireWorkspaceId?: boolean } = {},
): Promise<
  | { ok: true; session: WorkspaceBrowserSession }
  | { ok: false; response: Response }
> {
  try {
    if (
      !runtime.workspaceEdgeInternalSigningSecret ||
      request.headers.get(INTERNAL_AUTH_HEADER) !== runtime.workspaceEdgeInternalSigningSecret
    ) {
      return { ok: false, response: json({ error: 'not_found' }, { status: 404 }) };
    }
    const token = cookieValue(request, WORKSPACE_SESSION_COOKIE);
    if (!token) {
      return { ok: false, response: json({ error: 'workspace_session_required' }, { status: 401 }) };
    }
    const session = await runtime.store.byWorkspaceBrowserSession(await hash(token));
    const workspaceHost = request.headers.get('x-consuelo-workspace-host')?.trim().toLowerCase() ?? '';
    const workspaceId = request.headers.get('x-consuelo-workspace-id')?.trim() ?? '';
    const requireWorkspaceId = options.requireWorkspaceId !== false;
    if (
      !session ||
      runtime.now() >= session.expiresAt ||
      !workspaceHost ||
      session.workspaceHost !== workspaceHost ||
      (requireWorkspaceId && !workspaceId) ||
      (workspaceId && session.workspaceId !== workspaceId)
    ) {
      return { ok: false, response: json({ error: 'workspace_session_required' }, { status: 401 }) };
    }
    if (options.requireCsrf) {
      const csrfCookieValue = cookieValue(request, WORKSPACE_CSRF_COOKIE);
      const csrfHeader = request.headers.get('x-consuelo-csrf-token') ?? '';
      if (
        request.headers.get('origin') !== 'https://' + workspaceHost ||
        !csrfCookieValue ||
        csrfCookieValue !== session.csrfToken ||
        csrfHeader !== session.csrfToken
      ) {
        return { ok: false, response: json({ error: 'csrf_failed' }, { status: 403 }) };
      }
    }
    return { ok: true, session };
  } catch {
    return { ok: false, response: json({ error: 'workspace_session_unavailable' }, { status: 503 }) };
  }
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

async function pendingCloudOnboardingResponse(input: {
  runtime: DeviceAuthorityRuntime;
  membership: WorkspaceMembership;
}): Promise<Response | undefined> {
  try {
    const trial = await input.runtime.store.byWorkspaceCloudTrial(
      input.membership.workspaceId,
    );
    const paidCheckout = trial
      ? undefined
      : await input.runtime.store.byAccountManagedCloudCheckout(
          input.membership.accountId,
        );
    const provisioningJobId = trial?.provisioningJobId ?? (
      paidCheckout?.status === 'paid' &&
      paidCheckout.workspaceId === input.membership.workspaceId
        ? paidCheckout.provisioningJobId
        : undefined
    );
    if (!provisioningJobId) return undefined;
    const job = await input.runtime.store.byManagedCloudProvisioningJob(
      provisioningJobId,
    );
    if (!job || job.accountId !== input.membership.accountId) {
      return text(onboardingErrorPage('Cloud workspace state is temporarily unavailable.'), {
        status: 503,
      });
    }
    if (job.status === 'ready') return undefined;
    const location = new URL('/onboarding/provisioning', input.runtime.origin);
    location.searchParams.set('job_id', job.jobId);
    return Response.redirect(location.toString(), 302);
  } catch {
    return text(onboardingErrorPage('Cloud workspace state is temporarily unavailable.'), {
      status: 503,
    });
  }
}

const authShellStyles = `
  :root{color-scheme:light dark;--bg:#fff;--fg:#0a0a0a;--muted:#666;--line:#e6e6e6;--surface:#fff;--hover:#fafafa}
  *{box-sizing:border-box}
  html,body{margin:0;min-height:100%;background:var(--bg);color:var(--fg)}
  body{min-height:100svh;font-family:ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;font-size:14px;-webkit-font-smoothing:antialiased}
  a{color:inherit}
  .site-header{position:fixed;z-index:2;top:0;left:0;right:0;height:64px;display:flex;align-items:center;justify-content:space-between;padding:0 16px;pointer-events:none}
  .site-header a{pointer-events:auto;text-decoration:none}
  .brand-logo{display:inline-flex;width:32px;height:32px;align-items:center;justify-content:center}
  .brand-logo img{display:block;width:32px;height:32px;border-radius:6px}
  .top-action{min-height:32px;display:inline-flex;align-items:center;justify-content:center;padding:0 8px;border:1px solid var(--line);border-radius:6px;background:var(--surface);font-size:14px;font-weight:500;transition:background .16s ease,border-color .16s ease}
  .top-action:hover{background:var(--hover);border-color:#b5b5b5}
  .auth-main{min-height:100svh;display:grid;place-items:center;padding:120px 24px 100px}
  .auth-card{width:min(100%,402px);text-align:center}
  .auth-card h1{margin:0 0 30px;font-size:32px;line-height:1.16;letter-spacing:-.045em;font-weight:650}
  .auth-main--login{place-items:start center;padding:max(104px,calc(50svh - 296px)) 24px 64px}
  .auth-main--login .auth-card{width:min(100%,320px)}
  .auth-main--login .auth-card h1{margin-bottom:32px;font-size:28px;line-height:36px;font-weight:600;letter-spacing:-.035em}
  .auth-main--login .provider-button{min-height:40px;padding:0 14px;font-weight:500}
  .auth-main--login .auth-footer{margin-top:32px;font-size:16px;line-height:24px}
  .auth-main--login .auth-footer a{color:#52a8ff;text-decoration:none}
  .auth-main--login .auth-footer a:hover{color:#79bcff}
  .lede{max-width:360px;margin:-12px auto 28px;color:var(--muted);font-size:15px;line-height:1.55}
  .provider-button,.primary-button{width:100%;min-height:52px;border:1px solid var(--line);border-radius:8px;background:var(--surface);color:var(--fg);display:flex;align-items:center;justify-content:center;gap:12px;text-decoration:none;font-size:16px;font-weight:520;cursor:pointer;transition:background .16s ease,border-color .16s ease,transform .16s ease}
  .provider-button:hover,.primary-button:hover{background:var(--hover);border-color:#b5b5b5}
  .provider-button:active,.primary-button:active{transform:translateY(1px)}
  .provider-button svg{width:20px;height:20px;flex:0 0 auto}
  .auth-footer{margin:34px 0 0;color:var(--muted);font-size:14px}
  .auth-footer a{color:var(--fg);text-underline-offset:4px;text-decoration-thickness:1px}
  .auth-footer a:hover{text-decoration-thickness:2px}
  .field{display:grid;gap:9px;text-align:left;margin-bottom:14px}
  .field label{font-size:13px;font-weight:560}
  .field input{width:100%;height:52px;padding:0 14px;border:1px solid var(--line);border-radius:8px;background:var(--surface);color:var(--fg);font:inherit;font-size:16px;outline:none}
  .field input::placeholder{color:#8a8a8a}
  .field input:focus{border-color:var(--fg);box-shadow:0 0 0 1px var(--fg)}
  .trial-note{margin:20px 0 22px;padding:16px 0;border-top:1px solid var(--line);border-bottom:1px solid var(--line);display:grid;grid-template-columns:1fr auto;gap:10px 18px;text-align:left}
  .trial-note strong{font-size:14px;font-weight:620}.trial-note span{color:var(--muted);line-height:1.45}.trial-note .spec{font-variant-numeric:tabular-nums;text-align:right;color:var(--fg)}
  .auth-card--plans{width:min(100%,520px)}
  .plan-options{display:grid;gap:10px;margin:18px 0 22px;text-align:left}
  .plan-choice{position:relative}
  .plan-radio{position:absolute;opacity:0;pointer-events:none}
  .plan-card{min-height:70px;padding:13px 14px;border:1px solid var(--line);border-radius:8px;background:var(--surface);display:grid;grid-template-columns:1fr auto;gap:8px 18px;align-items:center;cursor:pointer;transition:background .16s ease,border-color .16s ease,box-shadow .16s ease}
  .plan-card:hover{background:var(--hover);border-color:#b5b5b5}
  .plan-radio:checked + .plan-card{border-color:var(--fg);box-shadow:0 0 0 1px var(--fg)}
  .plan-radio:focus-visible + .plan-card{outline:2px solid var(--fg);outline-offset:3px}
  .plan-name{display:block;font-weight:620}.plan-detail{display:block;margin-top:3px;color:var(--muted);font-size:13px;line-height:1.35}.plan-price{text-align:right;font-variant-numeric:tabular-nums;font-weight:560}.plan-price small{display:block;margin-top:3px;color:var(--muted);font-size:12px;font-weight:400}
  .workspace-options{display:grid;gap:10px}.workspace-options button{width:100%;min-height:50px;border:1px solid var(--line);border-radius:8px;background:var(--surface);color:var(--fg);font:inherit;cursor:pointer}.workspace-options button:hover{background:var(--hover)}
  .progress-shell{display:grid;gap:18px}.progress-status{padding:20px;border:1px solid var(--line);border-radius:10px;text-align:left}.progress-status small{display:block;color:var(--muted);text-transform:uppercase;letter-spacing:.12em;font-size:10px;margin-bottom:8px}.progress-status strong{font-size:18px}.progress-detail{margin-top:8px;color:var(--muted);line-height:1.5}.pulse{display:inline-block;width:8px;height:8px;margin-right:8px;border-radius:999px;background:currentColor;animation:pulse 1.5s ease-in-out infinite}.error-text{margin-top:14px;color:#b42318;line-height:1.45}
  :focus-visible{outline:2px solid var(--fg);outline-offset:3px}
  @keyframes pulse{0%,100%{opacity:.3}50%{opacity:1}}
  @media (prefers-color-scheme: dark){:root{--bg:#000;--fg:#ededed;--muted:#8f8f8f;--line:#2d2d2d;--surface:#090909;--hover:#111}.top-action:hover,.provider-button:hover,.primary-button:hover{border-color:#555}.error-text{color:#ff8a80}}
  @media (max-width:560px){.auth-main{padding:108px 18px 76px}.auth-main--login{padding:max(104px,calc(50svh - 296px)) 18px 64px}.auth-card h1{font-size:29px}.auth-main--login .auth-card h1{font-size:28px}.trial-note{grid-template-columns:1fr}.trial-note .spec{text-align:left}}
  @media (prefers-reduced-motion:reduce){*,*::before,*::after{scroll-behavior:auto!important;transition:none!important;animation:none!important}}
`;

function authShell(input: {
  title: string;
  body: string;
  topActionHref?: string;
  topActionLabel?: string;
  mainClass?: string;
  script?: string;
}): string {
  const topActionHref = input.topActionHref ?? '/login/google/start?purpose=web&amp;intent=signup';
  const topActionLabel = input.topActionLabel ?? 'Sign Up';
  const mainClass = input.mainClass ?? 'auth-main';
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="color-scheme" content="light dark"><title>${htmlEscape(input.title)} · Consuelo OS</title><style>${authShellStyles}</style></head><body><header class="site-header"><a class="brand-logo" href="/" aria-label="Consuelo OS home"><img src="https://consuelohq.com/favicon.svg" alt="" width="32" height="32"></a><a class="top-action" href="${topActionHref}">${htmlEscape(topActionLabel)}</a></header><main class="${htmlEscape(mainClass)}">${input.body}</main>${input.script ? `<script>${input.script}</script>` : ''}</body></html>`;
}

function googleMark(): string {
  return '<svg id="google-mark" class="google-mark" viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M21.6 12.2c0-.7-.1-1.4-.2-2H12v3.8h5.4a4.6 4.6 0 0 1-2 3v2.5h3.2c1.9-1.7 3-4.3 3-7.3Z"/><path fill="#34A853" d="M12 22c2.7 0 5-.9 6.6-2.4L15.4 17c-.9.6-2 1-3.4 1-2.6 0-4.8-1.8-5.6-4.2H3.1v2.6A10 10 0 0 0 12 22Z"/><path fill="#FBBC05" d="M6.4 13.8A6 6 0 0 1 6 12c0-.6.1-1.2.4-1.8V7.6H3.1A10 10 0 0 0 2 12c0 1.6.4 3.1 1.1 4.4l3.3-2.6Z"/><path fill="#EA4335" d="M12 6c1.5 0 2.9.5 4 1.6l3-3A10 10 0 0 0 3.1 7.6l3.3 2.6C7.2 7.8 9.4 6 12 6Z"/></svg>';
}

export function universalLoginPage(): string {
  return authShell({
    title: 'Log in',
    mainClass: 'auth-main auth-main--login',
    body: `<section class="auth-card"><h1>Log in to Consuelo OS</h1><a class="provider-button" href="/login/google/start?purpose=web&amp;intent=login">${googleMark()}<span>Continue with Google</span></a><p class="auth-footer">Don't have an account? <a href="/login/google/start?purpose=web&amp;intent=signup">Sign Up</a></p></section>`,
  });
}

export async function universalLoginResponse(
  request: Request,
  runtime: DeviceAuthorityRuntime,
): Promise<Response> {
  try {
    const session = await authoritySession(request, runtime);
    if (session) {
      return Response.redirect(new URL('/auth/workspaces', runtime.origin), 302);
    }
    return text(universalLoginPage());
  } catch {
    return text(onboardingErrorPage('Sign in is temporarily unavailable.'), {
      status: 503,
    });
  }
}

export async function completeWebGoogleLogin(input: {
  runtime: DeviceAuthorityRuntime;
  accountId: string;
  email: string;
  returnPath: string;
  cloudOnboardingEligible: boolean;
}): Promise<Response> {
  try {
    const token = rand('was', 32);
    const nowMs = input.runtime.now();
    await input.runtime.store.putAuthoritySession({
      tokenHash: await hash(token),
      accountId: input.accountId,
      email: input.email,
      cloudOnboardingEligible: input.cloudOnboardingEligible,
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
  return authShell({
    title: 'Choose workspace',
    topActionHref: '/',
    topActionLabel: 'Home',
    body: `<section class="auth-card"><h1>Choose a workspace</h1><p class="lede">Continue to the Consuelo OS workspace you want to use.</p><form class="workspace-options" method="post" action="/auth/handoff"><input type="hidden" name="csrf_token" value="${htmlEscape(input.csrfToken)}"><input type="hidden" name="return_to" value="${htmlEscape(input.returnPath)}">${options}</form></section>`,
  });
}

function formatUsdMonthly(cents: number): string {
  const dollars = cents / 100;
  return `$${Number.isInteger(dollars) ? dollars.toFixed(0) : dollars.toFixed(2)}/mo`;
}

function planDisplayName(planId: string): string {
  return planId.charAt(0).toUpperCase() + planId.slice(1);
}

function noMembershipPage(runtime: DeviceAuthorityRuntime, csrfToken: string): string {
  const catalog = managedCloudSignupCatalog(runtime);
  if (!catalog.pricingAvailable) {
    return onboardingErrorPage('Cloud pricing is temporarily unavailable.');
  }
  const quotes = catalog.billingConfigured
    ? catalog.quotes
    : catalog.quotes.filter((quote) => quote.plan.id === 'standard');
  const planOptions = quotes.map((quote) => {
    const isStandard = quote.plan.id === 'standard';
    const paid = !isStandard;
    const id = `plan-${quote.plan.id}`;
    const price = isStandard ? '14 days free' : formatUsdMonthly(quote.monthlyPriceCents);
    const priceNote = isStandard ? 'No card required' : 'Billed monthly';
    return `<div class="plan-choice"><input class="plan-radio" id="${id}" type="radio" name="plan_id" value="${htmlEscape(quote.plan.id)}" data-paid="${paid ? 'true' : 'false'}"${isStandard ? ' checked' : ''}><label class="plan-card" for="${id}"><span><span class="plan-name">${htmlEscape(quote.plan.name)}</span><span class="plan-detail">${quote.plan.cpu.vcpus} vCPU · ${quote.plan.memoryGb} GB</span></span><span class="plan-price">${htmlEscape(price)}<small>${htmlEscape(priceNote)}</small></span></label></div>`;
  }).join('');
  const script = `const radios=[...document.querySelectorAll('.plan-radio')];const cta=document.querySelector('[data-plan-cta]');function syncPlanCta(){const selected=radios.find((radio)=>radio.checked);if(cta)cta.textContent=selected?.dataset.paid==='true'?'Checkout and Create Workspace':'Create Workspace'}for(const radio of radios)radio.addEventListener('change',syncPlanCta);syncPlanCta();`;
  return authShell({
    title: 'Create workspace',
    topActionHref: '/',
    topActionLabel: 'Home',
    script,
    body: `<section class="auth-card auth-card--plans"><h1>Name your workspace</h1><p class="lede">Start with a 14-day free trial on Standard, or choose a larger Consuelo Cloud plan and check out now.</p><form method="post" action="/onboarding/workspace"><div class="field"><label for="workspace-name">Workspace name</label><input id="workspace-name" name="workspace-name" type="text" maxlength="80" autocomplete="organization" placeholder="Acme" required autofocus></div><input type="hidden" name="csrf_token" value="${htmlEscape(csrfToken)}"><div class="plan-options" role="radiogroup" aria-label="Cloud plan">${planOptions}</div><button class="primary-button" type="submit" data-plan-cta>Create Workspace</button></form></section>`,
  });
}

function existingAccountNoWorkspacePage(): string {
  return authShell({
    title: 'Workspace unavailable',
    topActionHref: '/login/google/start?purpose=web&intent=login',
    topActionLabel: 'Sign in again',
    body: `<section class="auth-card"><h1>Your workspace is not available yet</h1><p class="lede">You are signed in to an existing Consuelo account, so we will not create a new cloud workspace automatically. If you already installed Consuelo OS, make sure that installation is online and sign in again.</p></section>`,
  });
}

export function accountNotFoundPage(): string {
  return authShell({
    title: 'Account not found',
    topActionHref: '/',
    topActionLabel: 'Home',
    body: `<section class="auth-card"><h1>No Consuelo account found</h1><p class="lede">That Google account is not connected to Consuelo yet.</p><a class="provider-button" href="/login/google/start?purpose=web&amp;intent=signup">Create an account</a></section>`,
  });
}

function provisioningPage(input: {
  jobId: string;
  status: string;
  planId: string;
}): string {
  const safeJobId = htmlEscape(input.jobId);
  const statusLabel = htmlEscape(input.status.charAt(0).toUpperCase() + input.status.slice(1));
  const script = `const jobId=${JSON.stringify(input.jobId)};const label=document.querySelector('[data-status]');const detail=document.querySelector('[data-detail]');async function poll(){try{const r=await fetch('/onboarding/status?job_id='+encodeURIComponent(jobId),{credentials:'same-origin',headers:{accept:'application/json'}});if(!r.ok)throw new Error('status');const p=await r.json();const s=p.job.status;label.textContent=s.charAt(0).toUpperCase()+s.slice(1);if(s==='ready'){detail.textContent='Your cloud workspace is ready. Opening Consuelo OS…';window.location.assign('/auth/workspaces');return}if(s==='failed'){detail.textContent=p.job.errorMessage||'Cloud setup could not finish. Retry from this page or contact Consuelo support.';document.querySelector('.pulse')?.remove();return}detail.textContent=s==='requested'?'Your workspace is queued.':s==='provisioning'?'Creating your Consuelo Cloud machine.':s==='booting'?'Starting Consuelo OS and its background services.':'Connecting your workspace and finishing setup.';setTimeout(poll,1800)}catch{detail.textContent='Still waiting for Consuelo Cloud. Retrying…';setTimeout(poll,3000)}}setTimeout(poll,700);`;
  return authShell({
    title: 'Setting up workspace',
    topActionHref: '/',
    topActionLabel: 'Home',
    script,
    body: `<section class="auth-card"><h1>Setting up Consuelo OS</h1><p class="lede">We’re creating your ${htmlEscape(planDisplayName(input.planId))} cloud workspace, installing the OS runtime, and connecting its background services.</p><div class="progress-shell" aria-live="polite"><div class="progress-status"><small>Cloud workspace</small><strong><span class="pulse" aria-hidden="true"></span><span data-status>${statusLabel}</span></strong><div class="progress-detail" data-detail>Preparing your workspace…</div></div></div><p class="auth-footer">You can keep this page open. Setup will continue automatically.</p><span hidden data-job-id="${safeJobId}"></span></section>`,
  });
}

function checkoutConfirmationPage(sessionId: string): string {
  const script = `const sessionId=${JSON.stringify(sessionId)};const detail=document.querySelector('[data-checkout-detail]');async function pollCheckout(){try{const r=await fetch('/onboarding/checkout/status?session_id='+encodeURIComponent(sessionId),{credentials:'same-origin',headers:{accept:'application/json'}});if(!r.ok)throw new Error('status');const p=await r.json();if(p.status==='paid'&&p.jobId){window.location.assign('/onboarding/provisioning?job_id='+encodeURIComponent(p.jobId));return}if(p.status==='expired'){detail.textContent='This checkout expired. Return to workspace setup to choose a plan again.';return}detail.textContent='Payment is still being confirmed. This page will continue automatically.';setTimeout(pollCheckout,1400)}catch{detail.textContent='Still confirming payment. Retrying…';setTimeout(pollCheckout,2500)}}setTimeout(pollCheckout,500);`;
  return authShell({
    title: 'Confirming payment',
    topActionHref: '/',
    topActionLabel: 'Home',
    script,
    body: `<section class="auth-card"><h1>Confirming your payment</h1><p class="lede">Stripe checkout is complete. Consuelo will create your workspace only after the signed payment event is verified.</p><div class="progress-status" aria-live="polite"><strong><span class="pulse" aria-hidden="true"></span>Payment confirmation</strong><div class="progress-detail" data-checkout-detail>Waiting for Stripe confirmation…</div></div></section>`,
  });
}

function onboardingErrorPage(message: string): string {
  return authShell({
    title: 'Setup unavailable',
    topActionHref: '/',
    topActionLabel: 'Home',
    body: `<section class="auth-card"><h1>Setup needs another try</h1><p class="lede">${htmlEscape(message)}</p><a class="provider-button" href="/auth/workspaces">Return to workspace setup</a></section>`,
  });
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
    if (choice.kind === 'none') {
      return text(
        session.cloudOnboardingEligible === true
          ? noMembershipPage(runtime, session.csrfToken)
          : existingAccountNoWorkspacePage(),
      );
    }
    if (choice.kind === 'single') {
      const membership = memberships[0];
      if (!membership) return json({ error: 'membership_not_found' }, { status: 404 });
      const onboarding = await pendingCloudOnboardingResponse({ runtime, membership });
      if (onboarding) return onboarding;
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

  if (url.pathname === '/onboarding/workspace') {
    if (request.method !== 'POST') return methodNotAllowed('POST');
    if (request.headers.get('origin') !== runtime.origin) {
      return json({ error: 'csrf_failed' }, { status: 403 });
    }
    const session = await authoritySession(request, runtime);
    if (!session) return json({ error: 'authority_session_required' }, { status: 401 });
    if (session.cloudOnboardingEligible !== true) {
      return json({ error: 'cloud_onboarding_not_available' }, { status: 403 });
    }
    const body = await params(request);
    if (body.get('csrf_token') !== session.csrfToken) {
      return json({ error: 'csrf_failed' }, { status: 403 });
    }
    const workspaceName = body.get('workspace-name') ?? body.get('workspace_name') ?? '';
    const planId = body.get('plan_id')?.trim() || 'standard';
    try {
      if (planId === 'standard') {
        const created = await createCloudFirstWorkspace({
          runtime,
          accountId: session.accountId,
          email: session.email,
          workspaceName,
        });
        const location = new URL('/onboarding/provisioning', runtime.origin);
        location.searchParams.set('job_id', created.job.jobId);
        return Response.redirect(location.toString(), 302);
      }
      if (!isPaidCloudFirstPlanId(planId)) {
        return text(onboardingErrorPage('Choose a supported Consuelo Cloud plan.'), { status: 400 });
      }
      const checkout = await startManagedCloudCheckout({
        runtime,
        accountId: session.accountId,
        email: session.email,
        workspaceName,
        planId,
      });
      if (!checkout.stripeCheckoutUrl) {
        throw new ManagedCloudBillingError(
          'BILLING_UNAVAILABLE',
          503,
          'Cloud billing is temporarily unavailable.',
        );
      }
      return Response.redirect(checkout.stripeCheckoutUrl, 302);
    } catch (error: unknown) {
      if (error instanceof CloudFirstOnboardingError || error instanceof ManagedCloudBillingError) {
        return text(onboardingErrorPage(error.message), { status: error.status });
      }
      return text(onboardingErrorPage('Cloud workspace setup is temporarily unavailable.'), {
        status: 503,
      });
    }
  }

  if (url.pathname === '/onboarding/provisioning') {
    if (request.method !== 'GET') return methodNotAllowed('GET');
    const session = await authoritySession(request, runtime);
    if (!session) return json({ error: 'authority_session_required' }, { status: 401 });
    const status = await cloudFirstProvisioningStatus({
      runtime,
      accountId: session.accountId,
      jobId: url.searchParams.get('job_id')?.trim() ?? '',
    });
    if (!status) return json({ error: 'onboarding_not_found' }, { status: 404 });
    if (status.job.status === 'ready') {
      return Response.redirect(new URL('/auth/workspaces', runtime.origin), 302);
    }
    return text(
      provisioningPage({
        jobId: status.job.jobId,
        status: status.job.status,
        planId: status.job.planId,
      }),
    );
  }

  if (url.pathname === '/onboarding/status') {
    if (request.method !== 'GET') return methodNotAllowed('GET');
    const session = await authoritySession(request, runtime);
    if (!session) return json({ error: 'authority_session_required' }, { status: 401 });
    const status = await cloudFirstProvisioningStatus({
      runtime,
      accountId: session.accountId,
      jobId: url.searchParams.get('job_id')?.trim() ?? '',
    });
    if (!status) return json({ error: 'onboarding_not_found' }, { status: 404 });
    return json(status, { headers: { 'cache-control': 'no-store' } });
  }

  if (url.pathname === '/onboarding/checkout/success') {
    if (request.method !== 'GET') return methodNotAllowed('GET');
    const session = await authoritySession(request, runtime);
    if (!session) return json({ error: 'authority_session_required' }, { status: 401 });
    const sessionId = url.searchParams.get('session_id')?.trim() ?? '';
    const status = await managedCloudCheckoutStatus({
      runtime,
      accountId: session.accountId,
      sessionId,
    });
    if (!status) return json({ error: 'checkout_not_found' }, { status: 404 });
    if (status.status === 'paid') {
      const location = new URL('/onboarding/provisioning', runtime.origin);
      location.searchParams.set('job_id', status.jobId);
      return Response.redirect(location.toString(), 302);
    }
    return text(checkoutConfirmationPage(sessionId));
  }

  if (url.pathname === '/onboarding/checkout/status') {
    if (request.method !== 'GET') return methodNotAllowed('GET');
    const session = await authoritySession(request, runtime);
    if (!session) return json({ error: 'authority_session_required' }, { status: 401 });
    const status = await managedCloudCheckoutStatus({
      runtime,
      accountId: session.accountId,
      sessionId: url.searchParams.get('session_id')?.trim() ?? '',
    });
    if (!status) return json({ error: 'checkout_not_found' }, { status: 404 });
    return json(status, { headers: { 'cache-control': 'no-store' } });
  }

  if (url.pathname === '/webhooks/stripe') {
    if (request.method !== 'POST') return methodNotAllowed('POST');
    const rawBody = await request.text();
    try {
      const result = await handleManagedCloudStripeWebhook({
        runtime,
        rawBody,
        signatureHeader: request.headers.get('stripe-signature') ?? '',
      });
      return json({ received: true, handled: result.handled }, { headers: { 'cache-control': 'no-store' } });
    } catch (error: unknown) {
      if (error instanceof ManagedCloudBillingError) {
        return json({ error: error.code.toLowerCase() }, { status: error.status });
      }
      return json({ error: 'billing_unavailable' }, { status: 503 });
    }
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
    const onboarding = await pendingCloudOnboardingResponse({ runtime, membership });
    if (onboarding) return onboarding;
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
    const auth = await authenticateInternalWorkspaceSession(request, runtime);
    if (!auth.ok) return auth.response;
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
    '/onboarding/workspace',
    '/onboarding/provisioning',
    '/onboarding/status',
    '/onboarding/checkout/success',
    '/onboarding/checkout/status',
    '/webhooks/stripe',
    '/internal/auth/session/validate',
  ]) {
    app.all(path, (context) => handleWebAuthRequest(context.req.raw, runtime));
  }
}
