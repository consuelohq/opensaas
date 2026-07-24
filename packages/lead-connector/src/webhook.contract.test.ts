import { describe, expect, it } from 'bun:test';
import { Effect, Either, Layer } from 'effect';

import {
  LeadConnectorInstallationStore,
  LeadConnectorWebhookPayloadError,
  LeadConnectorWebhookEventStore,
  LeadConnectorWebhookSignatureError,
  LeadConnectorWebhookVerifier,
  processLeadConnectorWebhook,
  verifyLeadConnectorWebhookSignature,
  type LeadConnectorInstallation,
} from './index';

const installation: LeadConnectorInstallation = {
  installationId: 'installation-1',
  workspaceId: 'workspace-1',
  locationId: 'location-1',
  accessTokenCiphertext: 'encrypted-access',
  refreshTokenCiphertext: 'encrypted-refresh',
  expiresAt: '2026-07-25T00:00:00.000Z',
  scopes: [],
  connectedAt: '2026-07-24T00:00:00.000Z',
  updatedAt: '2026-07-24T00:00:00.000Z',
};

const body = JSON.stringify({
  webhookId: 'event-1',
  type: 'OpportunityUpdate',
  locationId: 'location-1',
  id: 'opportunity-1',
  contactId: 'contact-1',
  pipelineId: 'pipeline-1',
  pipelineStageId: 'stage-1',
  status: 'open',
});

const toPem = (value: ArrayBuffer): string => {
  const base64 = Buffer.from(value).toString('base64');
  const lines = base64.match(/.{1,64}/g) ?? [];
  return `-----BEGIN PUBLIC KEY-----\n${lines.join('\n')}\n-----END PUBLIC KEY-----`;
};

describe('LeadConnector webhook contracts', () => {
  it('verifies, atomically claims, owns, and translates an event exactly once', async () => {
    const claimed = new Set<string>();
    const layer = Layer.mergeAll(
      Layer.succeed(LeadConnectorWebhookVerifier, {
        verify: () => Effect.succeed(true),
      }),
      Layer.succeed(LeadConnectorWebhookEventStore, {
        claim: (eventId: string) =>
          Effect.sync(() => {
            if (claimed.has(eventId)) return false;
            claimed.add(eventId);
            return true;
          }),
      }),
      Layer.succeed(LeadConnectorInstallationStore, {
        getByWorkspaceId: () => Effect.succeed(null),
        getByLocationId: (locationId: string) =>
          Effect.succeed(locationId === 'location-1' ? installation : null),
        save: () => Effect.void,
        deleteByWorkspaceId: () => Effect.void,
      }),
    );

    const first = await Effect.runPromise(
      processLeadConnectorWebhook({
        rawBody: body,
        headers: { 'x-ghl-signature': 'provider-signature' },
      }).pipe(Effect.provide(layer)),
    );
    const duplicate = await Effect.runPromise(
      processLeadConnectorWebhook({
        rawBody: body,
        headers: { 'x-ghl-signature': 'provider-signature' },
      }).pipe(Effect.provide(layer)),
    );

    expect(first).toEqual({
      accepted: true,
      duplicate: false,
      workspaceId: 'workspace-1',
      event: {
        id: 'event-1',
        type: 'opportunity.updated',
        workspaceId: 'workspace-1',
        locationId: 'location-1',
        occurredAt: null,
        data: {
          opportunityId: 'opportunity-1',
          contactId: 'contact-1',
          pipelineId: 'pipeline-1',
          stageId: 'stage-1',
          status: 'open',
        },
      },
    });
    expect(duplicate).toEqual({
      accepted: true,
      duplicate: true,
      workspaceId: 'workspace-1',
      event: null,
    });
  });

  it('returns a stable typed signature error before idempotency or translation', async () => {
    let claims = 0;
    const layer = Layer.mergeAll(
      Layer.succeed(LeadConnectorWebhookVerifier, {
        verify: () => Effect.succeed(false),
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
        getByLocationId: () => Effect.succeed(installation),
        save: () => Effect.void,
        deleteByWorkspaceId: () => Effect.void,
      }),
    );

    const result = await Effect.runPromise(
      Effect.either(
        processLeadConnectorWebhook({
          rawBody: body,
          headers: { 'x-ghl-signature': 'invalid' },
        }).pipe(Effect.provide(layer)),
      ),
    );

    expect(Either.isLeft(result)).toBe(true);
    if (Either.isRight(result)) return;
    expect(result.left).toBeInstanceOf(LeadConnectorWebhookSignatureError);
    expect(result.left).toEqual(
      expect.objectContaining({
        code: 'INVALID_WEBHOOK_SIGNATURE',
        retryable: false,
      }),
    );
    expect(claims).toBe(0);
  });

  it('does not consume idempotency state for an unsupported provider event', async () => {
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
        getByLocationId: () => Effect.succeed(installation),
        save: () => Effect.void,
        deleteByWorkspaceId: () => Effect.void,
      }),
    );

    const result = await Effect.runPromise(
      Effect.either(
        processLeadConnectorWebhook({
          rawBody: JSON.stringify({
            webhookId: 'unsupported-1',
            type: 'UnknownEvent',
            locationId: 'location-1',
          }),
          headers: { 'x-ghl-signature': 'provider-signature' },
        }).pipe(Effect.provide(layer)),
      ),
    );

    expect(Either.isLeft(result)).toBe(true);
    if (Either.isLeft(result)) {
      expect(result.left).toBeInstanceOf(LeadConnectorWebhookPayloadError);
    }
    expect(claims).toBe(0);
  });

  it('translates nested provider data without leaking its wire shape', async () => {
    const layer = Layer.mergeAll(
      Layer.succeed(LeadConnectorWebhookVerifier, {
        verify: () => Effect.succeed(true),
      }),
      Layer.succeed(LeadConnectorWebhookEventStore, {
        claim: () => Effect.succeed(true),
      }),
      Layer.succeed(LeadConnectorInstallationStore, {
        getByWorkspaceId: () => Effect.succeed(null),
        getByLocationId: () => Effect.succeed(installation),
        save: () => Effect.void,
        deleteByWorkspaceId: () => Effect.void,
      }),
    );

    const result = await Effect.runPromise(
      processLeadConnectorWebhook({
        rawBody: JSON.stringify({
          webhookId: 'contact-event-1',
          type: 'ContactCreate',
          locationId: 'location-1',
          data: {
            id: 'contact-1',
            email: 'ada@example.test',
            firstName: 'Ada',
            lastName: 'Lovelace',
          },
        }),
        headers: { 'x-ghl-signature': 'provider-signature' },
      }).pipe(Effect.provide(layer)),
    );

    expect(result.event).toEqual({
      id: 'contact-event-1',
      type: 'contact.created',
      workspaceId: 'workspace-1',
      locationId: 'location-1',
      occurredAt: null,
      data: {
        contactId: 'contact-1',
        email: 'ada@example.test',
        phone: null,
        firstName: 'Ada',
        lastName: 'Lovelace',
      },
    });
  });

  it('verifies current Ed25519 signatures and supports the temporary RSA fallback', async () => {
    const payload = new TextEncoder().encode(body);
    const currentKeys = await crypto.subtle.generateKey('Ed25519', true, [
      'sign',
      'verify',
    ]);
    const currentPublicKey = await crypto.subtle.exportKey(
      'spki',
      currentKeys.publicKey,
    );
    const currentSignature = await crypto.subtle.sign(
      'Ed25519',
      currentKeys.privateKey,
      payload,
    );

    const legacyKeys = await crypto.subtle.generateKey(
      {
        name: 'RSASSA-PKCS1-v1_5',
        modulusLength: 2048,
        publicExponent: new Uint8Array([1, 0, 1]),
        hash: 'SHA-256',
      },
      true,
      ['sign', 'verify'],
    );
    const legacyPublicKey = await crypto.subtle.exportKey(
      'spki',
      legacyKeys.publicKey,
    );
    const legacySignature = await crypto.subtle.sign(
      'RSASSA-PKCS1-v1_5',
      legacyKeys.privateKey,
      payload,
    );

    expect(
      await verifyLeadConnectorWebhookSignature({
        rawBody: body,
        currentSignature: Buffer.from(currentSignature).toString('base64'),
        currentPublicKey: toPem(currentPublicKey),
      }),
    ).toBe(true);
    expect(
      await verifyLeadConnectorWebhookSignature({
        rawBody: body,
        legacySignature: Buffer.from(legacySignature).toString('base64'),
        legacyPublicKey: toPem(legacyPublicKey),
      }),
    ).toBe(true);
    expect(
      await verifyLeadConnectorWebhookSignature({
        rawBody: `${body}tampered`,
        currentSignature: Buffer.from(currentSignature).toString('base64'),
        currentPublicKey: toPem(currentPublicKey),
      }),
    ).toBe(false);
  });
});
