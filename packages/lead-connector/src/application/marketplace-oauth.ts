import { Effect } from 'effect';

import type {
  LeadConnectorCompanyCredential,
} from '../contracts/index.js';
import {
  LeadConnectorInstallationNotFoundError,
  LeadConnectorProviderError,
} from '../errors.js';
import {
  LeadConnectorClock,
  LeadConnectorCompanyCredentialStore,
  LeadConnectorConfig,
  LeadConnectorTokenCipher,
} from '../ports/index.js';
import {
  asRecord,
  readNumber,
  readString,
  requestLeadConnector,
  providerUrl,
} from './provider.js';
import {
  persistLeadConnectorTokens,
  type LeadConnectorTokenResponse,
} from './tokens.js';

type LeadConnectorCompanyTokenResponse = {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  scope: string[];
  companyId: string;
};

const decodeCompanyTokenResponse = (
  value: unknown,
): Effect.Effect<
  LeadConnectorCompanyTokenResponse,
  LeadConnectorProviderError
> =>
  Effect.gen(function* () {
    const record = asRecord(value);
    const accessToken = readString(record, 'accessToken', 'access_token');
    const refreshToken = readString(record, 'refreshToken', 'refresh_token');
    const expiresIn = readNumber(record, 'expiresIn', 'expires_in');
    const companyId = readString(record, 'companyId', 'company_id');
    const scopeValue = readString(record, 'scope') ?? '';
    if (!accessToken || !refreshToken || !expiresIn || !companyId) {
      return yield* Effect.fail(
        new LeadConnectorProviderError({
          operation: 'decode-company-token-response',
          message: 'LeadConnector Company token response was incomplete',
          retryable: false,
        }),
      );
    }
    return {
      accessToken,
      refreshToken,
      expiresIn,
      companyId,
      scope: scopeValue.split(/\s+/).filter(Boolean),
    };
  });

const decodeLocationTokenResponse = (
  value: unknown,
): Effect.Effect<LeadConnectorTokenResponse, LeadConnectorProviderError> =>
  Effect.gen(function* () {
    const record = asRecord(value);
    const accessToken = readString(record, 'accessToken', 'access_token');
    const refreshToken = readString(record, 'refreshToken', 'refresh_token');
    const expiresIn = readNumber(record, 'expiresIn', 'expires_in');
    const locationId = readString(record, 'locationId', 'location_id');
    const scopeValue = readString(record, 'scope') ?? '';
    if (!accessToken || !refreshToken || !expiresIn || !locationId) {
      return yield* Effect.fail(
        new LeadConnectorProviderError({
          operation: 'decode-location-token-response',
          message: 'LeadConnector Location token response was incomplete',
          retryable: false,
        }),
      );
    }
    return {
      accessToken,
      refreshToken,
      expiresIn,
      locationId,
      scope: scopeValue.split(/\s+/).filter(Boolean),
    };
  });

const exchangeCompanyToken = (input: {
  grantType: 'authorization_code' | 'refresh_token';
  code?: string;
  refreshToken?: string;
}) =>
  Effect.gen(function* () {
    const config = yield* LeadConnectorConfig;
    const url = yield* providerUrl('/oauth/token');
    const response = yield* requestLeadConnector(
      {
        method: 'POST',
        url,
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: {
          clientId: config.clientId,
          clientSecret: config.clientSecret,
          grantType: input.grantType,
          userType: 'Company',
          redirectUri: config.redirectUri,
          ...(input.code ? { code: input.code } : {}),
          ...(input.refreshToken ? { refreshToken: input.refreshToken } : {}),
        },
      },
      input.grantType === 'authorization_code'
        ? 'exchange-marketplace-authorization-code'
        : 'refresh-marketplace-company-token',
    );
    return yield* decodeCompanyTokenResponse(response.body);
  });

const persistCompanyToken = (input: {
  token: LeadConnectorCompanyTokenResponse;
  connectedAt?: string;
}) =>
  Effect.gen(function* () {
    const clock = yield* LeadConnectorClock;
    const cipher = yield* LeadConnectorTokenCipher;
    const store = yield* LeadConnectorCompanyCredentialStore;
    const existing = yield* store.getByCompanyId(input.token.companyId);
    const now = yield* clock.now;
    const timestamp = now.toISOString();
    const credential: LeadConnectorCompanyCredential = {
      companyId: input.token.companyId,
      accessTokenCiphertext: yield* cipher.encrypt(input.token.accessToken),
      refreshTokenCiphertext: yield* cipher.encrypt(input.token.refreshToken),
      expiresAt: new Date(
        now.getTime() + input.token.expiresIn * 1000,
      ).toISOString(),
      scopes: input.token.scope,
      connectedAt: input.connectedAt ?? existing?.connectedAt ?? timestamp,
      updatedAt: timestamp,
    };
    yield* store.save(credential);
    return credential;
  });

export const completeLeadConnectorMarketplaceOAuth = (input: {
  code: string;
}) =>
  Effect.gen(function* () {
    const token = yield* exchangeCompanyToken({
      grantType: 'authorization_code',
      code: input.code,
    });
    yield* persistCompanyToken({ token });
    return { companyId: token.companyId, connected: true as const };
  });

export const getValidLeadConnectorCompanyAccessToken = (companyId: string) =>
  Effect.gen(function* () {
    const config = yield* LeadConnectorConfig;
    const clock = yield* LeadConnectorClock;
    const cipher = yield* LeadConnectorTokenCipher;
    const store = yield* LeadConnectorCompanyCredentialStore;
    const credential = yield* store.getByCompanyId(companyId);
    if (!credential) {
      return yield* Effect.fail(
        new LeadConnectorInstallationNotFoundError({
          workspaceId: companyId,
          message: 'LeadConnector Company installation credential not found',
          retryable: false,
        }),
      );
    }
    const now = yield* clock.now;
    const refreshAt =
      new Date(credential.expiresAt).getTime() -
      config.tokenRefreshSkewSeconds * 1000;
    if (now.getTime() < refreshAt) {
      return yield* cipher.decrypt(credential.accessTokenCiphertext);
    }
    const refreshToken = yield* cipher.decrypt(
      credential.refreshTokenCiphertext,
    );
    const token = yield* exchangeCompanyToken({
      grantType: 'refresh_token',
      refreshToken,
    });
    const refreshed = yield* persistCompanyToken({
      token,
      connectedAt: credential.connectedAt,
    });
    return yield* cipher.decrypt(refreshed.accessTokenCiphertext);
  });

export const provisionLeadConnectorLocationFromCompany = (input: {
  companyId: string;
  locationId: string;
  installationId?: string;
  connectedAt?: string;
}) =>
  Effect.gen(function* () {
    const accessToken = yield* getValidLeadConnectorCompanyAccessToken(
      input.companyId,
    );
    const url = yield* providerUrl('/oauth/locationToken');
    const response = yield* requestLeadConnector(
      {
        method: 'POST',
        url,
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          Version: '2021-07-28',
          Authorization: `Bearer ${accessToken}`,
        },
        body: {
          companyId: input.companyId,
          locationId: input.locationId,
        },
      },
      'exchange-company-for-location-token',
    );
    const token = yield* decodeLocationTokenResponse(response.body);
    if (token.locationId !== input.locationId) {
      return yield* Effect.fail(
        new LeadConnectorProviderError({
          operation: 'exchange-company-for-location-token',
          message: 'LeadConnector Location token did not match the requested location',
          retryable: false,
        }),
      );
    }
    return yield* persistLeadConnectorTokens({
      workspaceId: input.companyId,
      token,
      ...(input.installationId
        ? { installationId: input.installationId }
        : {}),
      ...(input.connectedAt ? { connectedAt: input.connectedAt } : {}),
    });
  });
