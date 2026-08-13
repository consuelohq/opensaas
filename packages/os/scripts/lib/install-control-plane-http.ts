import {
  INSTALL_DASHBOARD_API_PREFIX,
  INSTALL_DASHBOARD_API_ROUTES,
  INSTALL_ERROR_CODES,
  INSTALL_ERROR_IMPACTS,
  INSTALL_EVENT_NAMES,
  INSTALL_ID_HEADER,
  INSTALL_OUTCOMES,
  INSTALL_STAGES,
  INSTALL_TELEMETRY_PRODUCERS,
  INSTALL_TELEMETRY_SCHEMA_VERSION,
  isInstallEventId,
  isInstallId,
  pickInstallTelemetrySafeContext,
  type InstallDashboardWindow,
  type InstallTelemetryEvent,
} from './install-telemetry-contract';
import type {
  InstallControlPlaneRepository,
  InstallControlPlaneService,
} from './install-control-plane';
import type { InstallDiagnosticBundleStore } from './install-control-plane-r2';

export const INSTALL_CONTROL_PLANE_EVENT_INGEST_PATH =
  '/api/os/v1/install-events' as const;
export const INSTALL_CONTROL_PLANE_DIAGNOSTIC_INGEST_PATH =
  '/api/os/v1/install-diagnostics' as const;
export const INSTALL_CONTROL_PLANE_MAX_EVENT_BYTES = 64 * 1024;
export const INSTALL_CONTROL_PLANE_MAX_DIAGNOSTIC_BYTES = 2 * 1024 * 1024;
export const INSTALL_INTERNAL_DASHBOARD_HOST = 'internal.consuelohq.com' as const;

export type InstallDashboardAuthorizer = (
  request: Request,
) => Promise<boolean> | boolean;

const JSON_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
  'x-content-type-options': 'nosniff',
} as const;

function json(value: unknown, status = 200, extraHeaders?: HeadersInit): Response {
  const headers = new Headers(JSON_HEADERS);
  if (extraHeaders) {
    for (const [key, value] of new Headers(extraHeaders)) headers.set(key, value);
  }
  return new Response(JSON.stringify(value), { status, headers });
}

function object(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function exactKeys(
  value: Record<string, unknown>,
  allowed: readonly string[],
): boolean {
  const allowedSet = new Set(allowed);
  return Object.keys(value).every((key) => allowedSet.has(key));
}

function included<T extends string>(
  values: readonly T[],
  value: unknown,
): value is T {
  return typeof value === 'string' && (values as readonly string[]).includes(value);
}

export function parseInstallTelemetryEvent(
  input: unknown,
): InstallTelemetryEvent | undefined {
  const value = object(input);
  if (!value) return undefined;
  if (
    !exactKeys(value, [
      'schemaVersion',
      'eventId',
      'installId',
      'producer',
      'name',
      'stage',
      'outcome',
      'occurredAt',
      'sequence',
      'identity',
      'context',
      'error',
    ]) ||
    value.schemaVersion !== INSTALL_TELEMETRY_SCHEMA_VERSION ||
    typeof value.eventId !== 'string' ||
    !isInstallEventId(value.eventId) ||
    typeof value.installId !== 'string' ||
    !isInstallId(value.installId) ||
    !included(INSTALL_TELEMETRY_PRODUCERS, value.producer) ||
    !included(INSTALL_EVENT_NAMES, value.name) ||
    !included(INSTALL_STAGES, value.stage) ||
    !included(INSTALL_OUTCOMES, value.outcome) ||
    typeof value.occurredAt !== 'string' ||
    !Number.isFinite(Date.parse(value.occurredAt)) ||
    !Number.isInteger(value.sequence) ||
    (value.sequence as number) < 0
  ) {
    return undefined;
  }

  const identity = object(value.identity);
  if (!identity || !exactKeys(identity, ['state', 'userId', 'workspaceId', 'nodeId'])) {
    return undefined;
  }
  let parsedIdentity: InstallTelemetryEvent['identity'];
  if (identity.state === 'anonymous') {
    if (identity.userId !== undefined || identity.workspaceId !== undefined) return undefined;
    if (identity.nodeId !== undefined && typeof identity.nodeId !== 'string') return undefined;
    parsedIdentity = {
      state: 'anonymous',
      ...(typeof identity.nodeId === 'string' && identity.nodeId.trim()
        ? { nodeId: identity.nodeId.trim() }
        : {}),
    };
  } else if (identity.state === 'canonical') {
    if (
      typeof identity.userId !== 'string' ||
      !identity.userId.trim() ||
      identity.userId.startsWith('google:') ||
      typeof identity.workspaceId !== 'string' ||
      !identity.workspaceId.trim() ||
      (identity.nodeId !== undefined && typeof identity.nodeId !== 'string')
    ) {
      return undefined;
    }
    parsedIdentity = {
      state: 'canonical',
      userId: identity.userId.trim(),
      workspaceId: identity.workspaceId.trim(),
      ...(typeof identity.nodeId === 'string' && identity.nodeId.trim()
        ? { nodeId: identity.nodeId.trim() }
        : {}),
    };
  } else {
    return undefined;
  }

  let context: InstallTelemetryEvent['context'];
  if (value.context !== undefined) {
    const rawContext = object(value.context);
    if (!rawContext) return undefined;
    const safeContext = pickInstallTelemetrySafeContext(rawContext);
    if (
      Object.keys(rawContext).length !== Object.keys(safeContext).length ||
      Object.keys(rawContext).some((key) => !(key in safeContext))
    ) {
      return undefined;
    }
    context = safeContext;
  }

  let error: InstallTelemetryEvent['error'];
  if (value.error !== undefined) {
    const rawError = object(value.error);
    if (
      !rawError ||
      !exactKeys(rawError, ['code', 'impact']) ||
      !included(INSTALL_ERROR_CODES, rawError.code) ||
      !included(INSTALL_ERROR_IMPACTS, rawError.impact)
    ) {
      return undefined;
    }
    error = { code: rawError.code, impact: rawError.impact };
  }

  return {
    schemaVersion: INSTALL_TELEMETRY_SCHEMA_VERSION,
    eventId: value.eventId,
    installId: value.installId,
    producer: value.producer,
    name: value.name,
    stage: value.stage,
    outcome: value.outcome,
    occurredAt: value.occurredAt,
    sequence: value.sequence as number,
    identity: parsedIdentity,
    ...(context ? { context } : {}),
    ...(error ? { error } : {}),
  };
}

export function createInstallTelemetryIngestHandler(input: {
  repository: InstallControlPlaneRepository;
  now?: () => number;
}): (request: Request) => Promise<Response> {
  const now = input.now ?? (() => Date.now());
  return async (request) => {
    const url = new URL(request.url);
    if (url.pathname !== INSTALL_CONTROL_PLANE_EVENT_INGEST_PATH) {
      return json({ error: 'not_found' }, 404);
    }
    if (request.method !== 'POST') {
      return json({ error: 'method_not_allowed' }, 405, { allow: 'POST' });
    }
    if (!(request.headers.get('content-type') ?? '').toLowerCase().includes('application/json')) {
      return json({ error: 'application_json_required' }, 415);
    }
    const declaredLength = Number.parseInt(request.headers.get('content-length') ?? '', 10);
    if (Number.isFinite(declaredLength) && declaredLength > INSTALL_CONTROL_PLANE_MAX_EVENT_BYTES) {
      return json({ error: 'event_too_large' }, 413);
    }
    let text: string;
    try {
      text = await request.text();
    } catch {
      return json({ error: 'invalid_event' }, 400);
    }
    if (new TextEncoder().encode(text).byteLength > INSTALL_CONTROL_PLANE_MAX_EVENT_BYTES) {
      return json({ error: 'event_too_large' }, 413);
    }
    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(text);
    } catch {
      return json({ error: 'invalid_event' }, 400);
    }
    const event = parseInstallTelemetryEvent(parsedJson);
    if (!event) return json({ error: 'invalid_event' }, 400);
    const installHeader = request.headers.get(INSTALL_ID_HEADER)?.trim() ?? '';
    if (!installHeader || installHeader !== event.installId) {
      return json({ error: 'install_id_mismatch' }, 400);
    }
    if (event.identity.state === 'canonical') {
      return json({ error: 'canonical_identity_not_allowed' }, 403);
    }
    if (event.producer !== 'installer') {
      return json({ error: 'installer_producer_required' }, 403);
    }
    try {
      const result = await input.repository.ingestEvent(event, {
        trust: 'installer',
        ingestedAt: new Date(now()).toISOString(),
      });
      return json({ accepted: true, duplicate: !result.created }, 202);
    } catch {
      return json({ error: 'ingest_unavailable' }, 503);
    }
  };
}


export function createInstallDiagnosticUploadHandler(input: {
  store: InstallDiagnosticBundleStore;
}): (request: Request) => Promise<Response> {
  return async (request) => {
    const url = new URL(request.url);
    if (url.pathname !== INSTALL_CONTROL_PLANE_DIAGNOSTIC_INGEST_PATH) {
      return json({ error: 'not_found' }, 404);
    }
    if (request.method !== 'POST') {
      return json({ error: 'method_not_allowed' }, 405, { allow: 'POST' });
    }
    if (!(request.headers.get('content-type') ?? '').toLowerCase().includes('application/json')) {
      return json({ error: 'application_json_required' }, 415);
    }
    const declaredLength = Number.parseInt(request.headers.get('content-length') ?? '', 10);
    if (
      Number.isFinite(declaredLength) &&
      declaredLength > INSTALL_CONTROL_PLANE_MAX_DIAGNOSTIC_BYTES
    ) {
      return json({ error: 'diagnostic_too_large' }, 413);
    }
    let text: string;
    try {
      text = await request.text();
    } catch {
      return json({ error: 'invalid_diagnostic' }, 400);
    }
    if (new TextEncoder().encode(text).byteLength > INSTALL_CONTROL_PLANE_MAX_DIAGNOSTIC_BYTES) {
      return json({ error: 'diagnostic_too_large' }, 413);
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      return json({ error: 'invalid_diagnostic' }, 400);
    }
    const body = object(parsed);
    if (
      !body ||
      !exactKeys(body, ['installId', 'outcome', 'diagnostic']) ||
      typeof body.installId !== 'string' ||
      !isInstallId(body.installId) ||
      (body.outcome !== 'failed' && body.outcome !== 'successful') ||
      body.diagnostic === undefined
    ) {
      return json({ error: 'invalid_diagnostic' }, 400);
    }
    const installHeader = request.headers.get(INSTALL_ID_HEADER)?.trim() ?? '';
    if (!installHeader || installHeader !== body.installId) {
      return json({ error: 'install_id_mismatch' }, 400);
    }
    try {
      const result = await input.store.put({
        installId: body.installId,
        outcome: body.outcome,
        diagnostic: body.diagnostic,
      });
      if (!result.stored) {
        return json({ accepted: true, stored: false, reason: result.reason }, 202);
      }
      return json(
        {
          accepted: true,
          stored: true,
          bundleId: result.bundleId,
          createdAt: result.createdAt,
          expiresAt: result.expiresAt,
        },
        202,
      );
    } catch {
      return json({ error: 'diagnostic_store_unavailable' }, 503);
    }
  };
}

function dashboardWindow(value: string | null): InstallDashboardWindow | undefined {
  if (!value) return '30d';
  return ['24h', '7d', '30d', '90d', '400d'].includes(value)
    ? (value as InstallDashboardWindow)
    : undefined;
}

function pageOptions(url: URL): { limit?: number; cursor?: string } {
  const limitValue = url.searchParams.get('limit');
  const limit = limitValue ? Number.parseInt(limitValue, 10) : undefined;
  const cursor = url.searchParams.get('cursor')?.trim() || undefined;
  return {
    ...(Number.isFinite(limit) ? { limit } : {}),
    ...(cursor ? { cursor } : {}),
  };
}

export function createInstallDashboardApiHandler(input: {
  service: InstallControlPlaneService;
  authorize: InstallDashboardAuthorizer;
  now?: () => number;
  expectedHost?: string;
}): (request: Request) => Promise<Response> {
  const now = input.now ?? (() => Date.now());
  const expectedHost = (input.expectedHost ?? INSTALL_INTERNAL_DASHBOARD_HOST).toLowerCase();
  return async (request) => {
    const url = new URL(request.url);
    if (
      url.hostname.toLowerCase() !== expectedHost ||
      !url.pathname.startsWith(`${INSTALL_DASHBOARD_API_PREFIX}/`) &&
        url.pathname !== INSTALL_DASHBOARD_API_PREFIX
    ) {
      return json({ error: 'not_found' }, 404);
    }
    if (request.method !== 'GET') {
      return json({ error: 'method_not_allowed' }, 405, { allow: 'GET' });
    }
    let authorized = false;
    try {
      authorized = await input.authorize(request);
    } catch {
      authorized = false;
    }
    if (!authorized) return json({ error: 'forbidden' }, 403);

    const nowMs = now();
    const window = dashboardWindow(url.searchParams.get('window'));
    if (!window) return json({ error: 'invalid_window' }, 400);
    const pagination = pageOptions(url);
    try {
      if (url.pathname === INSTALL_DASHBOARD_API_ROUTES.overview) {
        return json(await input.service.getOverview({ window, nowMs }));
      }
      if (url.pathname === INSTALL_DASHBOARD_API_ROUTES.users) {
        return json(await input.service.listUsers({ nowMs, ...pagination }));
      }
      if (url.pathname === INSTALL_DASHBOARD_API_ROUTES.installs) {
        return json(await input.service.listInstalls({ nowMs, ...pagination }));
      }
      if (url.pathname === INSTALL_DASHBOARD_API_ROUTES.devices) {
        return json(await input.service.listDevices({ nowMs, ...pagination }));
      }
      if (url.pathname === INSTALL_DASHBOARD_API_ROUTES.errors) {
        return json(
          await input.service.listErrors({ window, nowMs, ...pagination }),
        );
      }
      const detailPrefix = `${INSTALL_DASHBOARD_API_ROUTES.installs}/`;
      if (url.pathname.startsWith(detailPrefix)) {
        const rawId = decodeURIComponent(url.pathname.slice(detailPrefix.length));
        if (!isInstallId(rawId) || rawId.includes('/')) {
          return json({ error: 'invalid_install_id' }, 400);
        }
        const detail = await input.service.getInstallDetail(rawId, { nowMs });
        return detail ? json(detail) : json({ error: 'not_found' }, 404);
      }
      return json({ error: 'not_found' }, 404);
    } catch {
      return json({ error: 'dashboard_unavailable' }, 503);
    }
  };
}

type AccessJwtHeader = {
  alg?: unknown;
  kid?: unknown;
};

type AccessJwtClaims = {
  iss?: unknown;
  aud?: unknown;
  email?: unknown;
  exp?: unknown;
  nbf?: unknown;
};

type AccessJwk = JsonWebKey & { kid?: string; alg?: string; use?: string };

function base64UrlDecode(value: string): Uint8Array | undefined {
  try {
    const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
    const raw = atob(padded);
    return Uint8Array.from(raw, (character) => character.charCodeAt(0));
  } catch {
    return undefined;
  }
}

function jsonSegment<T>(segment: string): T | undefined {
  const bytes = base64UrlDecode(segment);
  if (!bytes) return undefined;
  try {
    return JSON.parse(new TextDecoder().decode(bytes)) as T;
  } catch {
    return undefined;
  }
}

function normalizeAccessTeamDomain(value: string): string | undefined {
  const host = value.trim().toLowerCase().replace(/^https:\/\//, '').replace(/\/$/, '');
  if (
    !host ||
    host.includes('/') ||
    host.includes(':') ||
    !/^[a-z0-9.-]+$/.test(host) ||
    !host.endsWith('.cloudflareaccess.com')
  ) {
    return undefined;
  }
  return host;
}

export function createCloudflareAccessDashboardAuthorizer(input: {
  teamDomain: string;
  audience: string;
  allowedEmails: string[];
  fetchImpl?: typeof fetch;
  now?: () => number;
}): InstallDashboardAuthorizer {
  const teamDomain = normalizeAccessTeamDomain(input.teamDomain);
  const audience = input.audience.trim();
  const allowedEmails = new Set(
    input.allowedEmails.map((email) => email.trim().toLowerCase()).filter(Boolean),
  );
  const fetchImpl = input.fetchImpl ?? globalThis.fetch.bind(globalThis);
  const now = input.now ?? (() => Date.now());
  let cachedKeys:
    | { fetchedAt: number; keys: AccessJwk[] }
    | undefined;

  const loadKeys = async (): Promise<AccessJwk[] | undefined> => {
    if (!teamDomain) return undefined;
    if (cachedKeys && now() - cachedKeys.fetchedAt < 5 * 60_000) return cachedKeys.keys;
    try {
      const response = await fetchImpl(`https://${teamDomain}/cdn-cgi/access/certs`, {
        headers: { accept: 'application/json' },
      });
      if (!response.ok) return undefined;
      const body = object(await response.json());
      if (!body || !Array.isArray(body.keys)) return undefined;
      const keys = body.keys.filter((key): key is AccessJwk => Boolean(object(key)));
      cachedKeys = { fetchedAt: now(), keys };
      return keys;
    } catch {
      return undefined;
    }
  };

  return async (request) => {
    if (!teamDomain || !audience || allowedEmails.size === 0) return false;
    const token = request.headers.get('cf-access-jwt-assertion')?.trim() ?? '';
    const parts = token.split('.');
    if (parts.length !== 3) return false;
    const [headerPart, payloadPart, signaturePart] = parts;
    if (!headerPart || !payloadPart || !signaturePart) return false;
    const header = jsonSegment<AccessJwtHeader>(headerPart);
    const claims = jsonSegment<AccessJwtClaims>(payloadPart);
    if (
      !header ||
      header.alg !== 'RS256' ||
      typeof header.kid !== 'string' ||
      !claims ||
      claims.iss !== `https://${teamDomain}` ||
      typeof claims.email !== 'string' ||
      !allowedEmails.has(claims.email.trim().toLowerCase()) ||
      typeof claims.exp !== 'number'
    ) {
      return false;
    }
    const audiences = Array.isArray(claims.aud)
      ? claims.aud.filter((value): value is string => typeof value === 'string')
      : typeof claims.aud === 'string'
        ? [claims.aud]
        : [];
    if (!audiences.includes(audience)) return false;
    const nowSeconds = Math.floor(now() / 1000);
    if (claims.exp <= nowSeconds) return false;
    if (typeof claims.nbf === 'number' && claims.nbf > nowSeconds + 30) return false;

    const keys = await loadKeys();
    const jwk = keys?.find(
      (candidate) =>
        candidate.kid === header.kid &&
        (!candidate.alg || candidate.alg === 'RS256') &&
        (!candidate.use || candidate.use === 'sig'),
    );
    if (!jwk) return false;
    const signature = base64UrlDecode(signaturePart);
    if (!signature) return false;
    try {
      const key = await crypto.subtle.importKey(
        'jwk',
        jwk,
        { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
        false,
        ['verify'],
      );
      return await crypto.subtle.verify(
        { name: 'RSASSA-PKCS1-v1_5' },
        key,
        signature,
        new TextEncoder().encode(`${headerPart}.${payloadPart}`),
      );
    } catch {
      return false;
    }
  };
}
