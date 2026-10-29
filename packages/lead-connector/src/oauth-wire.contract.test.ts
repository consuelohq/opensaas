import { describe, expect, it } from 'bun:test';
import { Effect, Either, Layer } from 'effect';

import {
  LeadConnectorClock,
  LeadConnectorConfig,
  LeadConnectorRandom,
  LeadConnectorTokenCipher,
  completeLeadConnectorMarketplaceOAuth,
  completeLeadConnectorOAuth,
  createLeadConnectorFetchTransportLayer,
  getValidLeadConnectorAccessToken,
  getValidLeadConnectorCompanyAccessToken,
  type LeadConnectorCompanyCredential,
  type LeadConnectorInstallation,
} from './index';
import {
  createInMemoryLeadConnectorState,
  createInMemoryLeadConnectorStoreLayer,
} from './testing/in-memory';

const now = new Date('2026-10-29T20:00:00.000Z');
const connectedAt = '2026-10-28T20:00:00.000Z';
const code = 'fixture-code+with&delimiters=1';
const refreshToken = 'fixture-refresh+with&delimiters=1';
const config = {
  clientId: 'fixture-client',
  clientSecret: 'fixture-secret',
  redirectUri: 'https://dialer.example/v1/integrations/leadconnector/callback',
  scopes: ['contacts.readonly'],
  authorizationUrl: 'https://marketplace.gohighlevel.com/oauth/chooselocation',
  apiBaseUrl: 'https://services.leadconnectorhq.com',
  tokenRefreshSkewSeconds: 300,
  userType: 'Location' as const,
};

type WireRequest = {
  method: string;
  pathname: string;
  contentType: string | null;
  form: Record<string, string>;
  status: number;
};

const expiredCompany = (): LeadConnectorCompanyCredential => ({
  companyId: 'company-1',
  accessTokenCiphertext: 'encrypted:old-company-access',
  refreshTokenCiphertext: `encrypted:${refreshToken}`,
  expiresAt: connectedAt,
  scopes: config.scopes,
  connectedAt,
  updatedAt: connectedAt,
});

const expiredLocation = (): LeadConnectorInstallation => ({
  installationId: 'installation-1',
  workspaceId: 'workspace-1',
  locationId: 'location-1',
  accessTokenCiphertext: 'encrypted:old-location-access',
  refreshTokenCiphertext: `encrypted:${refreshToken}`,
  expiresAt: connectedAt,
  scopes: config.scopes,
  connectedAt,
  updatedAt: connectedAt,
});

const createHarness = (rejectValidRequest = false) => {
  const state = createInMemoryLeadConnectorState();
  const requests: WireRequest[] = [];
  // This is the documented provider schema, including its observed 422 rejection.
  const acceptedFields = new Set([
    'client_id',
    'client_secret',
    'grant_type',
    'user_type',
    'redirect_uri',
    'code',
    'refresh_token',
  ]);
  const transport = createLeadConnectorFetchTransportLayer((async (
    input: string | URL | Request,
    init?: RequestInit,
  ) => {
    const form = Object.fromEntries(
      new URLSearchParams(String(init?.body ?? '')),
    );
    const forbidden = Object.keys(form).filter(
      (key) => !acceptedFields.has(key),
    );
    const valid =
      forbidden.length === 0 &&
      form.client_id === config.clientId &&
      form.client_secret === config.clientSecret &&
      ['Company', 'Location'].includes(form.user_type) &&
      (form.grant_type === 'authorization_code'
        ? form.code === code && form.redirect_uri === config.redirectUri
        : form.grant_type === 'refresh_token' &&
          form.refresh_token === refreshToken);
    const status = !valid ? 422 : rejectValidRequest ? 401 : 200;
    requests.push({
      method: init?.method ?? 'GET',
      pathname: new URL(String(input)).pathname,
      contentType: new Headers(init?.headers).get('content-type'),
      form,
      status,
    });
    return new Response(
      JSON.stringify(
        status === 200
          ? {
              access_token: `${form.user_type}-access`,
              refresh_token: `${form.user_type}-refresh`,
              expires_in: 3600,
              companyId: 'company-1',
              ...(form.user_type === 'Location'
                ? { locationId: 'location-1' }
                : {}),
              scope: config.scopes.join(' '),
            }
          : {
              statusCode: status,
              message: valid
                ? 'Authorization code not found'
                : [
                    ...forbidden.map(
                      (key) => `property ${key} should not exist`,
                    ),
                    'client_id, client_secret and grant_type are required',
                  ],
            },
      ),
      { status, headers: { 'content-type': 'application/json' } },
    );
  }) as typeof fetch);
  const layer = Layer.mergeAll(
    Layer.succeed(LeadConnectorConfig, config),
    Layer.succeed(LeadConnectorClock, { now: Effect.succeed(now) }),
    Layer.succeed(LeadConnectorRandom, {
      randomBytes: (size) => Effect.succeed(new Uint8Array(size).fill(7)),
    }),
    Layer.succeed(LeadConnectorTokenCipher, {
      encrypt: (value) => Effect.succeed(`encrypted:${value}`),
      decrypt: (value) => Effect.succeed(value.replace(/^encrypted:/, '')),
    }),
    createInMemoryLeadConnectorStoreLayer(state),
    transport,
  );
  state.oauthStates.set('state-1', {
    state: 'state-1',
    workspaceId: 'workspace-1',
    redirectUri: config.redirectUri,
    expiresAt: new Date(now.getTime() + 60_000).toISOString(),
  });
  return { state, requests, layer };
};

const expectWire = (
  request: WireRequest | undefined,
  specific: Record<string, string>,
) => {
  expect(request).toEqual({
    method: 'POST',
    pathname: '/oauth/token',
    contentType: 'application/x-www-form-urlencoded',
    form: {
      client_id: config.clientId,
      client_secret: config.clientSecret,
      ...specific,
    },
    status: 200,
  });
};

describe('HighLevel OAuth HTTP wire contract', () => {
  it('exchanges a Company authorization code with documented form fields', async () => {
    const h = createHarness();
    const result = await Effect.runPromise(
      completeLeadConnectorMarketplaceOAuth({ code }).pipe(
        Effect.provide(h.layer),
      ),
    );
    expect(result).toEqual({ companyId: 'company-1', connected: true });
    expectWire(h.requests[0], {
      grant_type: 'authorization_code',
      user_type: 'Company',
      redirect_uri: config.redirectUri,
      code,
    });
    expect(
      h.state.companyCredentials.get('company-1')?.accessTokenCiphertext,
    ).toBe('encrypted:Company-access');
  });

  it('exchanges a Location authorization code without changing state ownership', async () => {
    const h = createHarness();
    const result = await Effect.runPromise(
      completeLeadConnectorOAuth({ code, state: 'state-1' }).pipe(
        Effect.provide(h.layer),
      ),
    );
    expect(result).toEqual({
      workspaceId: 'workspace-1',
      locationId: 'location-1',
      connected: true,
    });
    expectWire(h.requests[0], {
      grant_type: 'authorization_code',
      user_type: 'Location',
      redirect_uri: config.redirectUri,
      code,
    });
    expect(h.state.oauthStates.has('state-1')).toBe(false);
    expect(
      h.state.installationsByWorkspace.get('workspace-1')
        ?.accessTokenCiphertext,
    ).toBe('encrypted:Location-access');
  });

  it('refreshes an expired Company credential using refresh_token', async () => {
    const h = createHarness();
    h.state.companyCredentials.set('company-1', expiredCompany());
    const token = await Effect.runPromise(
      getValidLeadConnectorCompanyAccessToken('company-1').pipe(
        Effect.provide(h.layer),
      ),
    );
    expect(token).toBe('Company-access');
    expectWire(h.requests[0], {
      grant_type: 'refresh_token',
      user_type: 'Company',
      redirect_uri: config.redirectUri,
      refresh_token: refreshToken,
    });
    expect(h.state.companyCredentials.get('company-1')).toMatchObject({
      refreshTokenCiphertext: 'encrypted:Company-refresh',
      connectedAt,
    });
  });

  it('refreshes an expired Location credential using refresh_token', async () => {
    const h = createHarness();
    h.state.installationsByWorkspace.set('workspace-1', expiredLocation());
    h.state.workspaceByLocation.set('location-1', 'workspace-1');
    const token = await Effect.runPromise(
      getValidLeadConnectorAccessToken('workspace-1').pipe(
        Effect.provide(h.layer),
      ),
    );
    expect(token).toBe('Location-access');
    expectWire(h.requests[0], {
      grant_type: 'refresh_token',
      user_type: 'Location',
      refresh_token: refreshToken,
    });
    expect(h.state.installationsByWorkspace.get('workspace-1')).toMatchObject({
      installationId: 'installation-1',
      connectedAt,
      refreshTokenCiphertext: 'encrypted:Location-refresh',
    });
  });

  it('preserves an existing encrypted credential when the provider rejects a code', async () => {
    const h = createHarness(true);
    const previous = expiredCompany();
    h.state.companyCredentials.set('company-1', previous);
    const result = await Effect.runPromise(
      Effect.either(completeLeadConnectorMarketplaceOAuth({ code })).pipe(
        Effect.provide(h.layer),
      ),
    );
    expect(Either.isLeft(result)).toBe(true);
    if (Either.isLeft(result))
      expect(result.left).toMatchObject({ status: 401 });
    expect(h.state.companyCredentials.get('company-1')).toEqual(previous);
    expect(h.requests).toHaveLength(1);
  });
});
