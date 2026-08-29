import { describe, expect, it } from 'vitest';

import {
  INSTALL_DASHBOARD_API_ROUTES,
  INSTALL_ID_HEADER,
  type InstallTelemetryEvent,
} from '../scripts/lib/install-telemetry-contract';
import {
  createInstallControlPlaneService,
  createMemoryInstallControlPlaneRepository,
} from '../scripts/lib/install-control-plane';
import {
  INSTALL_CONTROL_PLANE_DIAGNOSTIC_INGEST_PATH,
  INSTALL_CONTROL_PLANE_EVENT_INGEST_PATH,
  createCloudflareAccessDashboardAuthorizer,
  createInstallDashboardApiHandler,
  createInstallDiagnosticUploadHandler,
  createInstallTelemetryIngestHandler,
} from '../scripts/lib/install-control-plane-http';

const INSTALL_ID = 'ins_11111111-1111-4111-8111-111111111111' as const;
const EVENT_ID = 'evt_11111111-1111-4111-8111-111111111111' as const;
const origin = 'https://os.consuelohq.com';

function event(overrides: Partial<InstallTelemetryEvent> = {}): InstallTelemetryEvent {
  return {
    schemaVersion: 1,
    eventId: EVENT_ID,
    installId: INSTALL_ID,
    producer: 'installer',
    name: 'install.started',
    stage: 'bootstrap',
    outcome: 'started',
    occurredAt: '2026-08-13T16:00:00.000Z',
    sequence: 1,
    identity: { state: 'anonymous' },
    context: { platform: 'darwin', channel: 'canary' },
    ...overrides,
  } as InstallTelemetryEvent;
}

function base64Url(bytes: Uint8Array): string {
  let raw = '';
  for (const byte of bytes) raw += String.fromCharCode(byte);
  return btoa(raw).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

async function signedAccessJwt(input: {
  privateKey: CryptoKey;
  kid: string;
  issuer: string;
  audience: string;
  email: string;
  nowSeconds: number;
}): Promise<string> {
  const header = base64Url(
    new TextEncoder().encode(JSON.stringify({ alg: 'RS256', typ: 'JWT', kid: input.kid })),
  );
  const payload = base64Url(
    new TextEncoder().encode(
      JSON.stringify({
        iss: input.issuer,
        aud: [input.audience],
        email: input.email,
        sub: 'access-user-123',
        iat: input.nowSeconds - 10,
        nbf: input.nowSeconds - 10,
        exp: input.nowSeconds + 300,
      }),
    ),
  );
  const signingInput = `${header}.${payload}`;
  const signature = new Uint8Array(
    await crypto.subtle.sign(
      { name: 'RSASSA-PKCS1-v1_5' },
      input.privateKey,
      new TextEncoder().encode(signingInput),
    ),
  );
  return `${signingInput}.${base64Url(signature)}`;
}

describe('install telemetry public ingest boundary', () => {
  it('requires the correlation header to match the validated anonymous installer event and ingests idempotently', async () => {
    const repository = createMemoryInstallControlPlaneRepository();
    const handler = createInstallTelemetryIngestHandler({
      repository,
      now: () => Date.parse('2026-08-13T16:00:01.000Z'),
    });

    const missingHeader = await handler(
      new Request(origin + INSTALL_CONTROL_PLANE_EVENT_INGEST_PATH, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(event()),
      }),
    );
    expect(missingHeader.status).toBe(400);

    const mismatched = await handler(
      new Request(origin + INSTALL_CONTROL_PLANE_EVENT_INGEST_PATH, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          [INSTALL_ID_HEADER]: 'ins_22222222-2222-4222-8222-222222222222',
        },
        body: JSON.stringify(event()),
      }),
    );
    expect(mismatched.status).toBe(400);

    const request = () =>
      new Request(origin + INSTALL_CONTROL_PLANE_EVENT_INGEST_PATH, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          [INSTALL_ID_HEADER]: INSTALL_ID,
        },
        body: JSON.stringify(event()),
      });
    const first = await handler(request());
    expect(first.status).toBe(202);
    await expect(first.json()).resolves.toEqual({ accepted: true, duplicate: false });
    const duplicate = await handler(request());
    expect(duplicate.status).toBe(202);
    await expect(duplicate.json()).resolves.toEqual({ accepted: true, duplicate: true });
  });

  it('fails closed on canonical identity, unknown telemetry fields, invalid content type, and oversized bodies', async () => {
    const repository = createMemoryInstallControlPlaneRepository();
    const handler = createInstallTelemetryIngestHandler({ repository });

    const canonical = await handler(
      new Request(origin + INSTALL_CONTROL_PLANE_EVENT_INGEST_PATH, {
        method: 'POST',
        headers: { 'content-type': 'application/json', [INSTALL_ID_HEADER]: INSTALL_ID },
        body: JSON.stringify(
          event({
            producer: 'app',
            identity: {
              state: 'canonical',
              userId: 'user_123',
              workspaceId: 'workspace_123',
            },
          }),
        ),
      }),
    );
    expect(canonical.status).toBe(403);

    const unknown = await handler(
      new Request(origin + INSTALL_CONTROL_PLANE_EVENT_INGEST_PATH, {
        method: 'POST',
        headers: { 'content-type': 'application/json', [INSTALL_ID_HEADER]: INSTALL_ID },
        body: JSON.stringify({ ...event(), email: 'should-not-be-here@example.test' }),
      }),
    );
    expect(unknown.status).toBe(400);

    const wrongContentType = await handler(
      new Request(origin + INSTALL_CONTROL_PLANE_EVENT_INGEST_PATH, {
        method: 'POST',
        headers: { 'content-type': 'text/plain', [INSTALL_ID_HEADER]: INSTALL_ID },
        body: JSON.stringify(event()),
      }),
    );
    expect(wrongContentType.status).toBe(415);

    const oversized = await handler(
      new Request(origin + INSTALL_CONTROL_PLANE_EVENT_INGEST_PATH, {
        method: 'POST',
        headers: { 'content-type': 'application/json', [INSTALL_ID_HEADER]: INSTALL_ID },
        body: JSON.stringify({ ...event(), padding: 'x'.repeat(70_000) }),
      }),
    );
    expect(oversized.status).toBe(413);
  });
});


describe('install diagnostic upload boundary', () => {
  it('requires a matching install correlation id, bounds the body, and returns only safe R2 metadata', async () => {
    const calls: unknown[] = [];
    const handler = createInstallDiagnosticUploadHandler({
      store: {
        async put(input) {
          calls.push(input);
          return {
            stored: true as const,
            bundleId: 'diag_11111111-1111-4111-8111-111111111111',
            createdAt: '2026-08-13T17:00:00.000Z',
            expiresAt: '2026-09-12T17:00:00.000Z',
          };
        },
      },
    });
    const missingHeader = await handler(
      new Request(origin + INSTALL_CONTROL_PLANE_DIAGNOSTIC_INGEST_PATH, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          installId: INSTALL_ID,
          outcome: 'failed',
          diagnostic: { message: 'background service failed' },
        }),
      }),
    );
    expect(missingHeader.status).toBe(400);

    const accepted = await handler(
      new Request(origin + INSTALL_CONTROL_PLANE_DIAGNOSTIC_INGEST_PATH, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          [INSTALL_ID_HEADER]: INSTALL_ID,
        },
        body: JSON.stringify({
          installId: INSTALL_ID,
          outcome: 'failed',
          diagnostic: { message: 'background service failed' },
        }),
      }),
    );
    expect(accepted.status).toBe(202);
    expect(calls).toEqual([
      {
        installId: INSTALL_ID,
        outcome: 'failed',
        diagnostic: { message: 'background service failed' },
      },
    ]);
    await expect(accepted.json()).resolves.toEqual({
      accepted: true,
      stored: true,
      bundleId: 'diag_11111111-1111-4111-8111-111111111111',
      createdAt: '2026-08-13T17:00:00.000Z',
      expiresAt: '2026-09-12T17:00:00.000Z',
    });
  });
});

describe('private install dashboard API', () => {
  it('never serves data without an explicit successful operator authorization and applies no-store headers', async () => {
    const repository = createMemoryInstallControlPlaneRepository();
    await repository.ingestEvent(event(), {
      trust: 'installer',
      ingestedAt: '2026-08-13T16:00:01.000Z',
    });
    const service = createInstallControlPlaneService({ repository });

    const denied = createInstallDashboardApiHandler({
      service,
      authorize: async () => false,
      now: () => Date.parse('2026-08-13T17:00:00.000Z'),
    });
    const deniedResponse = await denied(
      new Request(`https://internal.consuelohq.com${INSTALL_DASHBOARD_API_ROUTES.overview}`),
    );
    expect(deniedResponse.status).toBe(403);
    expect(deniedResponse.headers.get('cache-control')).toBe('no-store');

    const allowed = createInstallDashboardApiHandler({
      service,
      authorize: async () => true,
      now: () => Date.parse('2026-08-13T17:00:00.000Z'),
    });
    const response = await allowed(
      new Request(
        `https://internal.consuelohq.com${INSTALL_DASHBOARD_API_ROUTES.overview}?window=30d`,
      ),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    await expect(response.json()).resolves.toMatchObject({
      window: '30d',
      installs: { started: 1 },
    });
  });
});

describe('Cloudflare Access operator authorization', () => {
  it('verifies the Access JWT signature, issuer, audience, expiry, and explicit email allowlist', async () => {
    const nowMs = Date.parse('2026-08-13T17:00:00.000Z');
    const issuer = 'https://consuelo.cloudflareaccess.com';
    const audience = 'dashboard-aud-123';
    const kid = 'test-key';
    const keyPair = await crypto.subtle.generateKey(
      {
        name: 'RSASSA-PKCS1-v1_5',
        modulusLength: 2048,
        publicExponent: new Uint8Array([1, 0, 1]),
        hash: 'SHA-256',
      },
      true,
      ['sign', 'verify'],
    );
    const publicJwk = await crypto.subtle.exportKey('jwk', keyPair.publicKey);
    const fetchImpl: typeof fetch = async (request) => {
      const url = typeof request === 'string' ? request : request instanceof URL ? request.href : request.url;
      expect(url).toBe(`${issuer}/cdn-cgi/access/certs`);
      return new Response(JSON.stringify({ keys: [{ ...publicJwk, kid, alg: 'RS256', use: 'sig' }] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    };
    const token = await signedAccessJwt({
      privateKey: keyPair.privateKey,
      kid,
      issuer,
      audience,
      email: 'owner@example.test',
      nowSeconds: Math.floor(nowMs / 1000),
    });
    const authorize = createCloudflareAccessDashboardAuthorizer({
      teamDomain: 'consuelo.cloudflareaccess.com',
      audience,
      allowedEmails: ['owner@example.test'],
      fetchImpl,
      now: () => nowMs,
    });

    await expect(
      authorize(
        new Request('https://internal.consuelohq.com/api/internal/os/v1/overview', {
          headers: { 'cf-access-jwt-assertion': token },
        }),
      ),
    ).resolves.toBe(true);

    const wrongEmail = createCloudflareAccessDashboardAuthorizer({
      teamDomain: 'consuelo.cloudflareaccess.com',
      audience,
      allowedEmails: ['different@example.test'],
      fetchImpl,
      now: () => nowMs,
    });
    await expect(
      wrongEmail(
        new Request('https://internal.consuelohq.com/api/internal/os/v1/overview', {
          headers: { 'cf-access-jwt-assertion': token },
        }),
      ),
    ).resolves.toBe(false);

    await expect(
      authorize(new Request('https://internal.consuelohq.com/api/internal/os/v1/overview')),
    ).resolves.toBe(false);
  });
});
