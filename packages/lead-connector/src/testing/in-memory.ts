import { Effect, Layer } from 'effect';

import type {
  LeadConnectorCompanyCredential,
  LeadConnectorInstallation,
  LeadConnectorOAuthState,
} from '../contracts/index.js';
import { LeadConnectorInstallationOwnershipError } from '../errors.js';
import {
  LeadConnectorCompanyCredentialStore,
  LeadConnectorInstallationStore,
  LeadConnectorOAuthStateStore,
  LeadConnectorWebhookEventStore,
} from '../ports/index.js';

export type InMemoryLeadConnectorState = {
  companyCredentials: Map<string, LeadConnectorCompanyCredential>;
  installationsByWorkspace: Map<string, LeadConnectorInstallation>;
  workspaceByLocation: Map<string, string>;
  oauthStates: Map<string, LeadConnectorOAuthState>;
  webhookEventIds: Set<string>;
};

export const createInMemoryLeadConnectorState =
  (): InMemoryLeadConnectorState => ({
    companyCredentials: new Map(),
    installationsByWorkspace: new Map(),
    workspaceByLocation: new Map(),
    oauthStates: new Map(),
    webhookEventIds: new Set(),
  });

export const createInMemoryLeadConnectorStoreLayer = (
  state: InMemoryLeadConnectorState,
) =>
  Layer.mergeAll(
    Layer.succeed(LeadConnectorCompanyCredentialStore, {
      getByCompanyId: (companyId) =>
        Effect.sync(() => {
          const credential = state.companyCredentials.get(companyId);
          return credential ? structuredClone(credential) : null;
        }),
      save: (credential) =>
        Effect.sync(() => {
          state.companyCredentials.set(
            credential.companyId,
            structuredClone(credential),
          );
        }),
    }),
    Layer.succeed(LeadConnectorInstallationStore, {
      getByWorkspaceId: (workspaceId) =>
        Effect.sync(() => {
          const installation = state.installationsByWorkspace.get(workspaceId);
          return installation ? structuredClone(installation) : null;
        }),
      getByLocationId: (locationId) =>
        Effect.sync(() => {
          const workspaceId = state.workspaceByLocation.get(locationId);
          if (!workspaceId) return null;
          const installation = state.installationsByWorkspace.get(workspaceId);
          return installation ? structuredClone(installation) : null;
        }),
      save: (installation) =>
        Effect.suspend(() => {
          const ownerWorkspaceId = state.workspaceByLocation.get(
            installation.locationId,
          );
          if (
            ownerWorkspaceId &&
            ownerWorkspaceId !== installation.workspaceId
          ) {
            return Effect.fail(
              new LeadConnectorInstallationOwnershipError({
                locationId: installation.locationId,
                workspaceId: installation.workspaceId,
                ownerWorkspaceId,
                message: 'LeadConnector location belongs to another workspace',
                retryable: false,
              }),
            );
          }
          return Effect.sync(() => {
            const previous = state.installationsByWorkspace.get(
              installation.workspaceId,
            );
            if (previous && previous.locationId !== installation.locationId) {
              state.workspaceByLocation.delete(previous.locationId);
            }
            state.installationsByWorkspace.set(
              installation.workspaceId,
              structuredClone(installation),
            );
            state.workspaceByLocation.set(
              installation.locationId,
              installation.workspaceId,
            );
          });
        }),
      deleteByWorkspaceId: (workspaceId) =>
        Effect.sync(() => {
          const previous = state.installationsByWorkspace.get(workspaceId);
          if (previous) state.workspaceByLocation.delete(previous.locationId);
          state.installationsByWorkspace.delete(workspaceId);
        }),
    }),
    Layer.succeed(LeadConnectorOAuthStateStore, {
      put: (oauthState) =>
        Effect.sync(() => {
          state.oauthStates.set(oauthState.state, structuredClone(oauthState));
        }),
      consume: (value) =>
        Effect.sync(() => {
          const oauthState = state.oauthStates.get(value);
          state.oauthStates.delete(value);
          return oauthState ? structuredClone(oauthState) : null;
        }),
    }),
    Layer.succeed(LeadConnectorWebhookEventStore, {
      claim: (eventId) =>
        Effect.sync(() => {
          if (state.webhookEventIds.has(eventId)) return false;
          state.webhookEventIds.add(eventId);
          return true;
        }),
    }),
  );
