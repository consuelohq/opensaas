import { Context, type Effect } from 'effect';

import type {
  LeadConnectorConfiguration,
  LeadConnectorHttpRequest,
  LeadConnectorHttpResponse,
  LeadConnectorInstallation,
  LeadConnectorOAuthState,
  LeadConnectorUserContext,
} from '../contracts/index.js';
import type {
  LeadConnectorInstallationOwnershipError,
  LeadConnectorProviderError,
  LeadConnectorStateError,
  LeadConnectorTokenCipherError,
  LeadConnectorEmbedIdentityError,
} from '../errors.js';

export type LeadConnectorClockService = {
  now: Effect.Effect<Date>;
};

export const LeadConnectorClock = Context.GenericTag<LeadConnectorClockService>(
  '@consuelo/lead-connector/Clock',
);

export const LeadConnectorConfig =
  Context.GenericTag<LeadConnectorConfiguration>(
    '@consuelo/lead-connector/Config',
  );

export type LeadConnectorRandomService = {
  randomBytes: (
    length: number,
  ) => Effect.Effect<Uint8Array, LeadConnectorStateError>;
};

export const LeadConnectorRandom =
  Context.GenericTag<LeadConnectorRandomService>(
    '@consuelo/lead-connector/Random',
  );

export type LeadConnectorHttpTransportService = {
  request: (
    request: LeadConnectorHttpRequest,
  ) => Effect.Effect<LeadConnectorHttpResponse, LeadConnectorProviderError>;
};

export const LeadConnectorHttpTransport =
  Context.GenericTag<LeadConnectorHttpTransportService>(
    '@consuelo/lead-connector/HttpTransport',
  );

export type LeadConnectorInstallationStoreService = {
  getByWorkspaceId: (
    workspaceId: string,
  ) => Effect.Effect<LeadConnectorInstallation | null, LeadConnectorStateError>;
  getByLocationId: (
    locationId: string,
  ) => Effect.Effect<LeadConnectorInstallation | null, LeadConnectorStateError>;
  save: (
    installation: LeadConnectorInstallation,
  ) => Effect.Effect<
    void,
    LeadConnectorInstallationOwnershipError | LeadConnectorStateError
  >;
  deleteByWorkspaceId: (
    workspaceId: string,
  ) => Effect.Effect<void, LeadConnectorStateError>;
};

export const LeadConnectorInstallationStore =
  Context.GenericTag<LeadConnectorInstallationStoreService>(
    '@consuelo/lead-connector/InstallationStore',
  );

export type LeadConnectorOAuthStateStoreService = {
  put: (
    state: LeadConnectorOAuthState,
  ) => Effect.Effect<void, LeadConnectorStateError>;
  consume: (
    state: string,
  ) => Effect.Effect<LeadConnectorOAuthState | null, LeadConnectorStateError>;
};

export const LeadConnectorOAuthStateStore =
  Context.GenericTag<LeadConnectorOAuthStateStoreService>(
    '@consuelo/lead-connector/OAuthStateStore',
  );

export type LeadConnectorTokenCipherService = {
  encrypt: (
    value: string,
  ) => Effect.Effect<string, LeadConnectorTokenCipherError>;
  decrypt: (
    value: string,
  ) => Effect.Effect<string, LeadConnectorTokenCipherError>;
};

export const LeadConnectorTokenCipher =
  Context.GenericTag<LeadConnectorTokenCipherService>(
    '@consuelo/lead-connector/TokenCipher',
  );

export type LeadConnectorUserContextDecoderService = {
  decrypt: (
    encryptedData: string,
  ) => Effect.Effect<LeadConnectorUserContext, LeadConnectorEmbedIdentityError>;
};

export const LeadConnectorUserContextDecoder =
  Context.GenericTag<LeadConnectorUserContextDecoderService>(
    '@consuelo/lead-connector/UserContextDecoder',
  );

export type LeadConnectorWebhookVerificationInput = {
  rawBody: string;
  headers: Record<string, string | undefined>;
};

export type LeadConnectorWebhookVerifierService = {
  verify: (
    input: LeadConnectorWebhookVerificationInput,
  ) => Effect.Effect<boolean, LeadConnectorProviderError>;
};

export const LeadConnectorWebhookVerifier =
  Context.GenericTag<LeadConnectorWebhookVerifierService>(
    '@consuelo/lead-connector/WebhookVerifier',
  );

export type LeadConnectorWebhookEventStoreService = {
  claim: (eventId: string) => Effect.Effect<boolean, LeadConnectorStateError>;
};

export const LeadConnectorWebhookEventStore =
  Context.GenericTag<LeadConnectorWebhookEventStoreService>(
    '@consuelo/lead-connector/WebhookEventStore',
  );
