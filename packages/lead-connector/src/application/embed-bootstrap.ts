import { Effect } from 'effect';

import type { LeadConnectorEmbedIdentity } from '../contracts/index.js';
import { LeadConnectorEmbedIdentityError } from '../errors.js';
import {
  LeadConnectorCompanyCredentialStore,
  LeadConnectorInstallationStore,
  LeadConnectorUserContextDecoder,
} from '../ports/index.js';
import { provisionLeadConnectorLocationFromCompany } from './marketplace-oauth.js';

export const exchangeLeadConnectorEmbedContext = (input: {
  encryptedData: string;
}) =>
  Effect.gen(function* () {
    const decoder = yield* LeadConnectorUserContextDecoder;
    const installations = yield* LeadConnectorInstallationStore;
    const context = yield* decoder.decrypt(input.encryptedData);
    if (!context.activeLocation) {
      return yield* Effect.fail(
        new LeadConnectorEmbedIdentityError({
          code: 'EMBED_LOCATION_REQUIRED',
          message: 'LeadConnector location context is required',
          retryable: false,
        }),
      );
    }
    let installation = yield* installations.getByLocationId(
      context.activeLocation,
    );
    const companyCredentials = yield* LeadConnectorCompanyCredentialStore;
    const companyCredential = yield* companyCredentials.getByCompanyId(
      context.companyId,
    );
    const bulkCredentialIsNewer =
      installation &&
      companyCredential &&
      installation.workspaceId === context.companyId &&
      new Date(companyCredential.updatedAt).getTime() >
        new Date(installation.updatedAt).getTime();
    if (!installation || bulkCredentialIsNewer) {
      if (!companyCredential) {
        return yield* Effect.fail(
          new LeadConnectorEmbedIdentityError({
            code: 'EMBED_INSTALLATION_NOT_FOUND',
            message: 'LeadConnector installation is not active for this location',
            retryable: false,
          }),
        );
      }
      installation = yield* provisionLeadConnectorLocationFromCompany({
        companyId: context.companyId,
        locationId: context.activeLocation,
        ...(installation?.installationId
          ? { installationId: installation.installationId }
          : {}),
        ...(installation?.connectedAt
          ? { connectedAt: installation.connectedAt }
          : {}),
      });
    }
    if (!installation) {
      return yield* Effect.fail(
        new LeadConnectorEmbedIdentityError({
          code: 'EMBED_INSTALLATION_NOT_FOUND',
          message: 'LeadConnector installation is not active for this location',
          retryable: false,
        }),
      );
    }
    return {
      workspaceId: installation.workspaceId,
      userId: context.userId,
      installationId: installation.installationId,
      locationId: installation.locationId,
      role: context.role,
      contextType: context.type,
    } satisfies LeadConnectorEmbedIdentity;
  });

export const validateLeadConnectorEmbedIdentity = (
  identity: LeadConnectorEmbedIdentity,
) =>
  Effect.gen(function* () {
    const installations = yield* LeadConnectorInstallationStore;
    const installation = yield* installations.getByLocationId(
      identity.locationId,
    );
    return Boolean(
      installation &&
      installation.workspaceId === identity.workspaceId &&
      installation.locationId === identity.locationId &&
      installation.installationId === identity.installationId,
    );
  });
