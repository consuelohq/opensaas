import { describe, expect, it } from 'bun:test';
import { Effect, Layer } from 'effect';

import {
  LeadConnectorInstallationStore,
  LeadConnectorWebhookEventStore,
  LeadConnectorWebhookVerifier,
  processLeadConnectorWebhook,
  type LeadConnectorInstallation,
} from './index';

const installation: LeadConnectorInstallation = {
  installationId: 'installation-one',
  workspaceId: 'workspace-one',
  locationId: 'location-one',
  accessTokenCiphertext: 'encrypted-access',
  refreshTokenCiphertext: 'encrypted-refresh',
  expiresAt: '2026-08-06T00:00:00.000Z',
  scopes: [],
  connectedAt: '2026-08-01T00:00:00.000Z',
  updatedAt: '2026-08-01T00:00:00.000Z',
};

describe('LeadConnector commercial lifecycle webhooks', () => {
  it('translates AppUninstall and claims the lifecycle transition exactly once', async () => {
    const claims = new Set<string>();
    const layer = Layer.mergeAll(
      Layer.succeed(LeadConnectorWebhookVerifier, {
        verify: () => Effect.succeed(true),
      }),
      Layer.succeed(LeadConnectorWebhookEventStore, {
        claim: (eventId: string) =>
          Effect.sync(() => {
            if (claims.has(eventId)) return false;
            claims.add(eventId);
            return true;
          }),
      }),
      Layer.succeed(LeadConnectorInstallationStore, {
        getByWorkspaceId: () => Effect.succeed(null),
        getByLocationId: (locationId: string) =>
          Effect.succeed(locationId === 'location-one' ? installation : null),
        save: () => Effect.void,
        deleteByWorkspaceId: () => Effect.void,
      }),
    );
    const request = {
      rawBody: JSON.stringify({
        webhookId: 'uninstall-one',
        type: 'UNINSTALL',
        appId: 'app-one',
        locationId: 'location-one',
      }),
      headers: { 'x-ghl-signature': 'provider-signature' },
    };

    const first = await Effect.runPromise(
      processLeadConnectorWebhook(request).pipe(Effect.provide(layer)),
    );
    const duplicate = await Effect.runPromise(
      processLeadConnectorWebhook(request).pipe(Effect.provide(layer)),
    );

    expect(first).toEqual({
      accepted: true,
      duplicate: false,
      workspaceId: 'workspace-one',
      event: {
        id: 'uninstall-one',
        type: 'installation.uninstalled',
        workspaceId: 'workspace-one',
        locationId: 'location-one',
        occurredAt: null,
        data: { appId: 'app-one' },
      },
    });
    expect(duplicate).toEqual({
      accepted: true,
      duplicate: true,
      workspaceId: 'workspace-one',
      event: first.event,
    });
  });

  it('rejects an uninstall for an unknown location before a lifecycle side effect', async () => {
    let claims = 0;
    const layer = Layer.mergeAll(
      Layer.succeed(LeadConnectorWebhookVerifier, {
        verify: () => Effect.succeed(true),
      }),
      Layer.succeed(LeadConnectorWebhookEventStore, {
        claim: () =>
          Effect.sync(() => {
            claims += 1;
            return true;
          }),
      }),
      Layer.succeed(LeadConnectorInstallationStore, {
        getByWorkspaceId: () => Effect.succeed(null),
        getByLocationId: () => Effect.succeed(null),
        save: () => Effect.void,
        deleteByWorkspaceId: () => Effect.void,
      }),
    );

    await expect(
      Effect.runPromise(
        processLeadConnectorWebhook({
          rawBody: JSON.stringify({
            webhookId: 'uninstall-unknown',
            type: 'UNINSTALL',
            appId: 'app-one',
            locationId: 'location-unknown',
          }),
          headers: { 'x-ghl-signature': 'provider-signature' },
        }).pipe(Effect.provide(layer)),
      ),
    ).rejects.toThrow();
    expect(claims).toBe(0);
  });
});
