export {
  LEAD_CONNECTOR_EMBED_PROTOCOL_VERSION,
  LEAD_CONNECTOR_PARENT_ORIGINS,
  createLeadConnectorParentBridge,
  normalizeClickToCallTarget,
} from './protocol.js';
export type {
  EmbedMessageHost,
  LeadConnectorClickToCallInput,
  LeadConnectorClickToCallTarget,
  LeadConnectorEmbedMessage,
  LeadConnectorProtocolError,
} from './protocol.js';
export {
  createInitialEmbedState,
  filterEmbedOpportunities,
  reduceEmbedState,
  removeEmbedTarget,
  selectEmbedTarget,
} from './state-machine.js';
export type {
  EmbedCallLeg,
  EmbedCallSession,
  EmbedFailure,
  EmbedFilters,
  EmbedStateEvent,
  LeadConnectorEmbedPhase,
  LeadConnectorEmbedState,
} from './state-machine.js';
export {
  EmbedApiError,
  EmbedSessionExpiredError,
  createLeadConnectorEmbedApi,
} from './api-client.js';
export type { LeadConnectorEmbedApi } from './api-client.js';

export { createLeadConnectorAgentVoice } from './agent-voice.js';
export type { LeadConnectorAgentVoice } from './agent-voice.js';
export { createLeadConnectorEmbedController } from './controller.js';
export type { LeadConnectorEmbedController } from './controller.js';
export { renderLeadConnectorEmbed } from './view.js';
