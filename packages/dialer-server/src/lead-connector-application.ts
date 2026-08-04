import {
  beginLeadConnectorOAuth,
  completeLeadConnectorOAuth,
  exchangeLeadConnectorEmbedContext,
  listLeadConnectorContacts,
  listLeadConnectorPipelines,
  processLeadConnectorWebhook,
  recordLeadConnectorDisposition,
  resolveLeadConnectorQueueCandidates,
  searchLeadConnectorOpportunities,
  validateLeadConnectorEmbedIdentity,
  type LeadConnectorClockService,
  type LeadConnectorConfiguration,
  type LeadConnectorHttpTransportService,
  type LeadConnectorInstallationStoreService,
  type LeadConnectorOAuthStateStoreService,
  type LeadConnectorRandomService,
  type LeadConnectorTokenCipherService,
  type LeadConnectorUserContextDecoderService,
  type LeadConnectorWebhookEventStoreService,
  type LeadConnectorWebhookVerifierService,
} from '@consuelo/lead-connector';
import { Effect, type Layer } from 'effect';

import type { LeadConnectorServerApplication } from './contracts';

type LeadConnectorRuntime =
  | LeadConnectorClockService
  | LeadConnectorConfiguration
  | LeadConnectorHttpTransportService
  | LeadConnectorInstallationStoreService
  | LeadConnectorOAuthStateStoreService
  | LeadConnectorRandomService
  | LeadConnectorTokenCipherService
  | LeadConnectorUserContextDecoderService
  | LeadConnectorWebhookEventStoreService
  | LeadConnectorWebhookVerifierService;

export type LeadConnectorApplicationLayer = Layer.Layer<LeadConnectorRuntime>;

export const createEffectLeadConnectorApplication = (
  layer: LeadConnectorApplicationLayer,
): LeadConnectorServerApplication => ({
  beginOAuth: (input) =>
    beginLeadConnectorOAuth(input).pipe(Effect.provide(layer)),
  completeOAuth: (input) =>
    completeLeadConnectorOAuth(input).pipe(Effect.provide(layer)),
  processWebhook: (input) =>
    processLeadConnectorWebhook(input).pipe(Effect.provide(layer)),
  listContacts: (input) =>
    listLeadConnectorContacts(input).pipe(Effect.provide(layer)),
  searchOpportunities: (input) =>
    searchLeadConnectorOpportunities(input).pipe(Effect.provide(layer)),
  listPipelines: (workspaceId) =>
    listLeadConnectorPipelines(workspaceId).pipe(Effect.provide(layer)),
  resolveQueueCandidates: (input) =>
    resolveLeadConnectorQueueCandidates(input).pipe(Effect.provide(layer)),
  recordDisposition: (input) =>
    recordLeadConnectorDisposition(input).pipe(Effect.provide(layer)),
  exchangeEmbedBootstrap: (input) =>
    exchangeLeadConnectorEmbedContext(input).pipe(Effect.provide(layer)),
  validateEmbedIdentity: (identity) =>
    validateLeadConnectorEmbedIdentity(identity).pipe(Effect.provide(layer)),
});
