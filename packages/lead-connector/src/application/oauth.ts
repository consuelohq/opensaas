import { Effect } from 'effect';

import { LEAD_CONNECTOR_OAUTH_STATE_TTL_SECONDS } from '../constants.js';
import {
  LeadConnectorInstallationOwnershipError,
  LeadConnectorOAuthStateError,
  LeadConnectorStateError,
  errorMessage,
} from '../errors.js';
import {
  LeadConnectorClock,
  LeadConnectorConfig,
  LeadConnectorInstallationStore,
  LeadConnectorOAuthStateStore,
  LeadConnectorRandom,
} from '../ports/index.js';
import {
  exchangeLeadConnectorToken,
  persistLeadConnectorTokens,
} from './tokens.js';

const base64Url = (bytes: Uint8Array): string =>
  Buffer.from(bytes).toString('base64url');

export const beginLeadConnectorOAuth = (input: { workspaceId: string }) =>
  Effect.gen(function* () {
    const config = yield* LeadConnectorConfig;
    const clock = yield* LeadConnectorClock;
    const random = yield* LeadConnectorRandom;
    const stateStore = yield* LeadConnectorOAuthStateStore;
    const now = yield* clock.now;
    const state = base64Url(yield* random.randomBytes(32));
    const expiresAt = new Date(
      now.getTime() + LEAD_CONNECTOR_OAUTH_STATE_TTL_SECONDS * 1000,
    ).toISOString();
    yield* stateStore.put({
      state,
      workspaceId: input.workspaceId,
      redirectUri: config.redirectUri,
      expiresAt,
    });

    const url = new URL(config.authorizationUrl);
    url.searchParams.set('client_id', config.clientId);
    url.searchParams.set('redirect_uri', config.redirectUri);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', config.scopes.join(' '));
    url.searchParams.set('state', state);

    return { authorizationUrl: url.toString(), state };
  });

export const completeLeadConnectorOAuth = (input: {
  code: string;
  state: string;
}) =>
  Effect.gen(function* () {
    const clock = yield* LeadConnectorClock;
    const random = yield* LeadConnectorRandom;
    const stateStore = yield* LeadConnectorOAuthStateStore;
    const installationStore = yield* LeadConnectorInstallationStore;
    const stored = yield* stateStore.consume(input.state);
    const now = yield* clock.now;
    if (!stored || new Date(stored.expiresAt).getTime() <= now.getTime()) {
      return yield* Effect.fail(
        new LeadConnectorOAuthStateError({
          code: 'INVALID_OAUTH_STATE',
          message: 'LeadConnector OAuth state is invalid or expired',
          retryable: false,
        }),
      );
    }

    const token = yield* exchangeLeadConnectorToken({
      grantType: 'authorization_code',
      code: input.code,
      redirectUri: stored.redirectUri,
    });
    const owner = yield* installationStore.getByLocationId(token.locationId);
    if (owner && owner.workspaceId !== stored.workspaceId) {
      return yield* Effect.fail(
        new LeadConnectorInstallationOwnershipError({
          locationId: token.locationId,
          workspaceId: stored.workspaceId,
          ownerWorkspaceId: owner.workspaceId,
          message: 'LeadConnector location belongs to another workspace',
          retryable: false,
        }),
      );
    }
    const installation = yield* persistLeadConnectorTokens({
      workspaceId: stored.workspaceId,
      token,
      installationId: base64Url(yield* random.randomBytes(24)),
    });
    return {
      workspaceId: installation.workspaceId,
      locationId: installation.locationId,
      connected: true as const,
    };
  });
