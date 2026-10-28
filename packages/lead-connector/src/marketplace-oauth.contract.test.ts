import { describe, expect, it } from 'bun:test';
import { Effect, Layer } from 'effect';

import {
  LeadConnectorClock,
  LeadConnectorCompanyCredentialStore,
  LeadConnectorConfig,
  LeadConnectorHttpTransport,
  LeadConnectorInstallationStore,
  LeadConnectorTokenCipher,
  LeadConnectorUserContextDecoder,
  completeLeadConnectorMarketplaceOAuth,
  exchangeLeadConnectorEmbedContext,
  type LeadConnectorCompanyCredential,
  type LeadConnectorCompanyCredentialStoreService,
  type LeadConnectorHttpRequest,
  type LeadConnectorInstallation,
  type LeadConnectorInstallationStoreService,
} from './index';

const now = new Date('2026-10-08T15:00:00.000Z');
const config = {
  clientId: 'client-id',
  clientSecret: 'client-secret',
  redirectUri:
    'https://calls.consuelohq.com/api/lead-connector-embed/auth/callback',
  scopes: ['contacts.readonly', 'opportunities.readonly'],
  authorizationUrl:
    'https://marketplace.leadconnectorhq.com/oauth/chooselocation',
  apiBaseUrl: 'https://services.leadconnectorhq.com',
  tokenRefreshSkewSeconds: 300,
  userType: 'Location' as const,
};

const makeLayer = () => {
  const requests: LeadConnectorHttpRequest[] = [];
  const companies = new Map<string, LeadConnectorCompanyCredential>();
  const installations = new Map<string, LeadConnectorInstallation>();

  const companyStore: LeadConnectorCompanyCredentialStoreService = {
    getByCompanyId: (companyId) =>
      Effect.succeed(companies.get(companyId) ?? null),
    save: (credential) =>
      Effect.sync(() => {
        companies.set(credential.companyId, structuredClone(credential));
      }),
  };
  const installationStore: LeadConnectorInstallationStoreService = {
    getByWorkspaceId: (workspaceId) =>
      Effect.succeed(installations.get(workspaceId) ?? null),
    getByLocationId: (locationId) =>
      Effect.succeed(
        [...installations.values()].find(
          (installation) => installation.locationId === locationId,
        ) ?? null,
      ),
    save: (installation) =>
      Effect.sync(() => {
        installations.set(
          installation.workspaceId,
          structuredClone(installation),
        );
      }),
    deleteByWorkspaceId: (workspaceId) =>
      Effect.sync(() => {
        installations.delete(workspaceId);
      }),
  };

  const layer = Layer.mergeAll(
    Layer.succeed(LeadConnectorConfig, config),
    Layer.succeed(LeadConnectorClock, { now: Effect.succeed(now) }),
    Layer.succeed(LeadConnectorCompanyCredentialStore, companyStore),
    Layer.succeed(LeadConnectorInstallationStore, installationStore),
    Layer.succeed(LeadConnectorTokenCipher, {
      encrypt: (value: string) => Effect.succeed(`encrypted:${value}`),
      decrypt: (value: string) =>
        Effect.succeed(value.replace(/^encrypted:/, '')),
    }),
    Layer.succeed(LeadConnectorUserContextDecoder, {
      decrypt: () =>
        Effect.succeed({
          userId: 'user-1',
          companyId: 'company-1',
          role: 'admin',
          type: 'location' as const,
          activeLocation: 'location-1',
          versionId: 'version-1',
          appStatus: 'installed',
        }),
    }),
    Layer.succeed(LeadConnectorHttpTransport, {
      request: (request: LeadConnectorHttpRequest) =>
        Effect.sync(() => {
          requests.push(structuredClone(request));
          if (request.url.endsWith('/oauth/token')) {
            return {
              status: 200,
              body: {
                access_token: 'company-access',
                refresh_token: 'company-refresh',
                expires_in: 86400,
                scope: 'contacts.readonly opportunities.readonly',
                userType: 'Company',
                companyId: 'company-1',
                isBulkInstallation: true,
              },
            };
          }
          if (request.url.endsWith('/oauth/locationToken')) {
            return {
              status: 200,
              body: {
                access_token: 'location-access',
                refresh_token: 'location-refresh',
                expires_in: 86400,
                scope: 'contacts.readonly opportunities.readonly',
                userType: 'Location',
                companyId: 'company-1',
                locationId: 'location-1',
              },
            };
          }
          return { status: 404, body: {} };
        }),
    }),
  );

  return { layer, requests, companies, installations };
};

describe('LeadConnector Marketplace bulk OAuth', () => {
  it('accepts the provider code-only install callback as a Company token', async () => {
    const harness = makeLayer();

    const result = await Effect.runPromise(
      completeLeadConnectorMarketplaceOAuth({ code: 'marketplace-code' }).pipe(
        Effect.provide(harness.layer),
      ),
    );

    expect(result).toEqual({ companyId: 'company-1', connected: true });
    expect(harness.requests[0]).toEqual(
      expect.objectContaining({
        method: 'POST',
        url: 'https://services.leadconnectorhq.com/oauth/token',
        body: expect.objectContaining({
          clientId: 'client-id',
          clientSecret: 'client-secret',
          grantType: 'authorization_code',
          code: 'marketplace-code',
          userType: 'Company',
          redirectUri: config.redirectUri,
        }),
      }),
    );
    expect(harness.companies.get('company-1')).toEqual(
      expect.objectContaining({
        companyId: 'company-1',
        accessTokenCiphertext: 'encrypted:company-access',
        refreshTokenCiphertext: 'encrypted:company-refresh',
      }),
    );
  });

  it('converts the verified Company install into a Location token on first embed session', async () => {
    const harness = makeLayer();
    await Effect.runPromise(
      completeLeadConnectorMarketplaceOAuth({ code: 'marketplace-code' }).pipe(
        Effect.provide(harness.layer),
      ),
    );

    const identity = await Effect.runPromise(
      exchangeLeadConnectorEmbedContext({ encryptedData: 'verified-context' }).pipe(
        Effect.provide(harness.layer),
      ),
    );

    expect(harness.requests[1]).toEqual(
      expect.objectContaining({
        method: 'POST',
        url: 'https://services.leadconnectorhq.com/oauth/locationToken',
        headers: expect.objectContaining({
          Authorization: 'Bearer company-access',
        }),
        body: {
          companyId: 'company-1',
          locationId: 'location-1',
        },
      }),
    );
    expect(harness.installations.get('company-1')).toEqual(
      expect.objectContaining({
        workspaceId: 'company-1',
        locationId: 'location-1',
        accessTokenCiphertext: 'encrypted:location-access',
        refreshTokenCiphertext: 'encrypted:location-refresh',
      }),
    );
    expect(identity).toEqual(
      expect.objectContaining({
        workspaceId: 'company-1',
        locationId: 'location-1',
        userId: 'user-1',
      }),
    );
  });
});
