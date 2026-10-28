import { Effect } from 'effect';

import type { LeadConnectorInstallation } from '../contracts/index.js';
import {
  LeadConnectorInstallationNotFoundError,
  LeadConnectorProviderError,
} from '../errors.js';
import {
  LeadConnectorClock,
  LeadConnectorConfig,
  LeadConnectorInstallationStore,
  LeadConnectorTokenCipher,
} from '../ports/index.js';
import {
  asRecord,
  providerHeaders,
  providerUrl,
  readNumber,
  readString,
  requestLeadConnector,
} from './provider.js';

export type LeadConnectorTokenResponse = {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  scope: string[];
  locationId: string;
};

const decodeTokenResponse = (
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
          operation: 'decode-token-response',
          message: 'LeadConnector token response was incomplete',
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

export const exchangeLeadConnectorToken = (input: {
  grantType: 'authorization_code' | 'refresh_token';
  code?: string;
  refreshToken?: string;
  redirectUri?: string;
}) =>
  Effect.gen(function* () {
    const config = yield* LeadConnectorConfig;
    const url = yield* providerUrl('/oauth/token');
    const response = yield* requestLeadConnector(
      {
        method: 'POST',
        url,
        headers: {
          ...providerHeaders(),
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: {
          clientId: config.clientId,
          clientSecret: config.clientSecret,
          grantType: input.grantType,
          userType: config.userType,
          ...(input.code ? { code: input.code } : {}),
          ...(input.refreshToken ? { refreshToken: input.refreshToken } : {}),
          ...(input.redirectUri ? { redirectUri: input.redirectUri } : {}),
        },
      },
      input.grantType === 'authorization_code'
        ? 'exchange-authorization-code'
        : 'refresh-access-token',
    );
    return yield* decodeTokenResponse(response.body);
  });

export const persistLeadConnectorTokens = (input: {
  workspaceId: string;
  token: LeadConnectorTokenResponse;
  installationId?: string;
  connectedAt?: string;
}) =>
  Effect.gen(function* () {
    const clock = yield* LeadConnectorClock;
    const cipher = yield* LeadConnectorTokenCipher;
    const store = yield* LeadConnectorInstallationStore;
    const now = yield* clock.now;
    const existing = yield* store.getByWorkspaceId(input.workspaceId);
    const accessTokenCiphertext = yield* cipher.encrypt(
      input.token.accessToken,
    );
    const refreshTokenCiphertext = yield* cipher.encrypt(
      input.token.refreshToken,
    );
    const timestamp = now.toISOString();
    const installation: LeadConnectorInstallation = {
      installationId:
        input.installationId ?? existing?.installationId ?? crypto.randomUUID(),
      workspaceId: input.workspaceId,
      locationId: input.token.locationId,
      accessTokenCiphertext,
      refreshTokenCiphertext,
      expiresAt: new Date(
        now.getTime() + input.token.expiresIn * 1000,
      ).toISOString(),
      scopes: input.token.scope,
      connectedAt: input.connectedAt ?? existing?.connectedAt ?? timestamp,
      updatedAt: timestamp,
    };
    yield* store.save(installation);
    return installation;
  });

export const getValidLeadConnectorAccessToken = (workspaceId: string) =>
  Effect.gen(function* () {
    const config = yield* LeadConnectorConfig;
    const clock = yield* LeadConnectorClock;
    const store = yield* LeadConnectorInstallationStore;
    const cipher = yield* LeadConnectorTokenCipher;
    const installation = yield* store.getByWorkspaceId(workspaceId);
    if (!installation) {
      return yield* Effect.fail(
        new LeadConnectorInstallationNotFoundError({
          workspaceId,
          message: 'LeadConnector installation not found',
          retryable: false,
        }),
      );
    }
    const now = yield* clock.now;
    const refreshAt =
      new Date(installation.expiresAt).getTime() -
      config.tokenRefreshSkewSeconds * 1000;
    if (now.getTime() < refreshAt) {
      return yield* cipher.decrypt(installation.accessTokenCiphertext);
    }
    const refreshToken = yield* cipher.decrypt(
      installation.refreshTokenCiphertext,
    );
    const token = yield* exchangeLeadConnectorToken({
      grantType: 'refresh_token',
      refreshToken,
    });
    const refreshed = yield* persistLeadConnectorTokens({
      workspaceId,
      token,
      installationId: installation.installationId,
      connectedAt: installation.connectedAt,
    });
    return yield* cipher.decrypt(refreshed.accessTokenCiphertext);
  });
