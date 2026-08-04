export {
  LEAD_CONNECTOR_API_BASE_URL,
  LEAD_CONNECTOR_API_VERSION,
  LEAD_CONNECTOR_AUTHORIZATION_URL,
  LEAD_CONNECTOR_CURRENT_SIGNATURE_HEADER,
  LEAD_CONNECTOR_LEGACY_SIGNATURE_HEADER,
  LEAD_CONNECTOR_OAUTH_STATE_TTL_SECONDS,
} from './constants.js';

export type {
  LeadConnectorConfiguration,
  LeadConnectorContact,
  LeadConnectorHttpMethod,
  LeadConnectorHttpRequest,
  LeadConnectorHttpResponse,
  LeadConnectorInstallation,
  LeadConnectorEmbedIdentity,
  LeadConnectorOAuthState,
  LeadConnectorUserContext,
  LeadConnectorOpportunity,
  LeadConnectorPipeline,
  LeadConnectorPipelineStage,
  LeadConnectorQueueCandidate,
  LeadConnectorQueuePreview,
  LeadConnectorWebhookEvent,
  LeadConnectorWebhookEventType,
  LeadConnectorWebhookProcessResult,
} from './contracts/index.js';

export {
  LeadConnectorInstallationNotFoundError,
  LeadConnectorInstallationOwnershipError,
  LeadConnectorEmbedIdentityError,
  LeadConnectorOAuthStateError,
  LeadConnectorProviderError,
  LeadConnectorStateError,
  LeadConnectorTokenCipherError,
  LeadConnectorWebhookPayloadError,
  LeadConnectorWebhookSignatureError,
} from './errors.js';
export type { LeadConnectorError } from './errors.js';

export {
  LeadConnectorClock,
  LeadConnectorConfig,
  LeadConnectorHttpTransport,
  LeadConnectorInstallationStore,
  LeadConnectorOAuthStateStore,
  LeadConnectorRandom,
  LeadConnectorTokenCipher,
  LeadConnectorUserContextDecoder,
  LeadConnectorWebhookEventStore,
  LeadConnectorWebhookVerifier,
} from './ports/index.js';
export type {
  LeadConnectorClockService,
  LeadConnectorHttpTransportService,
  LeadConnectorInstallationStoreService,
  LeadConnectorOAuthStateStoreService,
  LeadConnectorRandomService,
  LeadConnectorTokenCipherService,
  LeadConnectorUserContextDecoderService,
  LeadConnectorWebhookEventStoreService,
  LeadConnectorWebhookVerificationInput,
  LeadConnectorWebhookVerifierService,
} from './ports/index.js';

export {
  beginLeadConnectorOAuth,
  completeLeadConnectorOAuth,
} from './application/oauth.js';
export {
  exchangeLeadConnectorToken,
  getValidLeadConnectorAccessToken,
  persistLeadConnectorTokens,
} from './application/tokens.js';
export type { LeadConnectorTokenResponse } from './application/tokens.js';
export {
  createLeadConnectorNote,
  createLeadConnectorTask,
  listLeadConnectorContacts,
  listLeadConnectorPipelines,
  recordLeadConnectorDisposition,
  resolveLeadConnectorQueueCandidates,
  searchLeadConnectorOpportunities,
} from './application/resources.js';
export { processLeadConnectorWebhook } from './application/webhooks.js';
export {
  exchangeLeadConnectorEmbedContext,
  validateLeadConnectorEmbedIdentity,
} from './application/embed-bootstrap.js';

export { createLeadConnectorFetchTransportLayer } from './infrastructure/fetch-transport.js';
export {
  createLeadConnectorConfigLayer,
  liveLeadConnectorClockLayer,
  liveLeadConnectorRandomLayer,
} from './infrastructure/runtime.js';
export { createLeadConnectorTokenCipherLayer } from './infrastructure/token-cipher.js';
export { createLeadConnectorUserContextDecoderLayer } from './infrastructure/user-context-decoder.js';
export {
  createPersistentLeadConnectorStoreLayer,
  initializeLeadConnectorPersistence,
} from './infrastructure/persistent-stores.js';
export type {
  LeadConnectorCache,
  LeadConnectorDatabase,
} from './infrastructure/persistent-stores.js';
export {
  createLeadConnectorWebhookVerifierLayer,
  verifyLeadConnectorWebhookSignature,
} from './infrastructure/webhook-verifier.js';

export {
  createInMemoryLeadConnectorState,
  createInMemoryLeadConnectorStoreLayer,
} from './testing/in-memory.js';
export type { InMemoryLeadConnectorState } from './testing/in-memory.js';
