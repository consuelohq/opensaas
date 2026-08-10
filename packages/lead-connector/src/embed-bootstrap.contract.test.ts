import { describe, expect, it } from 'bun:test';
import { Effect, Either, Layer } from 'effect';

import {
  LeadConnectorEmbedIdentityError,
  LeadConnectorInstallationStore,
  LeadConnectorUserContextDecoder,
  exchangeLeadConnectorEmbedContext,
  validateLeadConnectorEmbedIdentity,
  type LeadConnectorInstallation,
} from './index';

const installation = (
  overrides: Partial<LeadConnectorInstallation> = {},
): LeadConnectorInstallation => ({
  installationId: 'installation-1',
  workspaceId: 'workspace-1',
  locationId: 'location-1',
  accessTokenCiphertext: 'ciphertext-access',
  refreshTokenCiphertext: 'ciphertext-refresh',
  expiresAt: '2026-07-25T00:00:00.000Z',
  scopes: ['contacts.readonly'],
  connectedAt: '2026-07-24T00:00:00.000Z',
  updatedAt: '2026-07-24T00:00:00.000Z',
  ...overrides,
});

const makeLayer = (current: LeadConnectorInstallation | null) =>
  Layer.mergeAll(
    Layer.succeed(LeadConnectorUserContextDecoder, {
      decrypt: (_encryptedData: string) =>
        Effect.succeed({
          userId: 'provider-user-1',
          companyId: 'company-1',
          role: 'user',
          type: 'location' as const,
          activeLocation: 'location-1',
          versionId: 'version-1',
          appStatus: 'installed',
        }),
    }),
    Layer.succeed(LeadConnectorInstallationStore, {
      getByWorkspaceId: (workspaceId: string) =>
        Effect.succeed(current?.workspaceId === workspaceId ? current : null),
      getByLocationId: (locationId: string) =>
        Effect.succeed(current?.locationId === locationId ? current : null),
      save: () => Effect.void,
      deleteByWorkspaceId: () => Effect.void,
    }),
  );

describe('LeadConnector embed bootstrap contracts', () => {
  it('binds decrypted parent context to the active installation, location, workspace, and user', async () => {
    const result = await Effect.runPromise(
      exchangeLeadConnectorEmbedContext({
        encryptedData: 'opaque-ciphertext',
      }).pipe(Effect.provide(makeLayer(installation()))),
    );

    expect(result).toEqual({
      workspaceId: 'workspace-1',
      userId: 'provider-user-1',
      installationId: 'installation-1',
      locationId: 'location-1',
    });
  });

  it('rejects a location without an active installation', async () => {
    const result = await Effect.runPromise(
      Effect.either(
        exchangeLeadConnectorEmbedContext({
          encryptedData: 'opaque-ciphertext',
        }).pipe(Effect.provide(makeLayer(null))),
      ),
    );

    expect(Either.isLeft(result)).toBe(true);
    if (Either.isRight(result)) return;
    expect(result.left).toBeInstanceOf(LeadConnectorEmbedIdentityError);
    expect(result.left).toEqual(
      expect.objectContaining({
        code: 'EMBED_INSTALLATION_NOT_FOUND',
        retryable: false,
      }),
    );
  });

  it('invalidates a session identity after the location is reinstalled', async () => {
    const result = await Effect.runPromise(
      validateLeadConnectorEmbedIdentity({
        workspaceId: 'workspace-1',
        userId: 'provider-user-1',
        installationId: 'installation-old',
        locationId: 'location-1',
      }).pipe(
        Effect.provide(
          makeLayer(installation({ installationId: 'installation-new' })),
        ),
      ),
    );

    expect(result).toBe(false);
  });
});
