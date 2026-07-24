import { describe, expect, it } from 'bun:test';
import { Effect, Layer } from 'effect';

import {
  LeadConnectorConfig,
  LeadConnectorHttpTransport,
  LeadConnectorTokenCipher,
  LeadConnectorTokenCipherError,
  createLeadConnectorConfigLayer,
  createLeadConnectorFetchTransportLayer,
  createLeadConnectorTokenCipherLayer,
} from './index';

describe('LeadConnector infrastructure contracts', () => {
  it('encrypts tokens with authenticated ciphertext and rejects another secret', async () => {
    const correctLayer = createLeadConnectorTokenCipherLayer(
      'correct-secret-with-sufficient-entropy',
    );
    const wrongLayer = createLeadConnectorTokenCipherLayer(
      'different-secret-with-sufficient-entropy',
    );

    const ciphertext = await Effect.runPromise(
      Effect.gen(function* () {
        const cipher = yield* LeadConnectorTokenCipher;
        return yield* cipher.encrypt('provider-access-token');
      }).pipe(Effect.provide(correctLayer)),
    );
    expect(ciphertext).not.toContain('provider-access-token');
    expect(ciphertext.startsWith('v1.')).toBe(true);

    const plaintext = await Effect.runPromise(
      Effect.gen(function* () {
        const cipher = yield* LeadConnectorTokenCipher;
        return yield* cipher.decrypt(ciphertext);
      }).pipe(Effect.provide(correctLayer)),
    );
    expect(plaintext).toBe('provider-access-token');

    const wrongResult = await Effect.runPromise(
      Effect.either(
        Effect.gen(function* () {
          const cipher = yield* LeadConnectorTokenCipher;
          return yield* cipher.decrypt(ciphertext);
        }).pipe(Effect.provide(wrongLayer)),
      ),
    );
    expect(wrongResult._tag).toBe('Left');
    if (wrongResult._tag === 'Left') {
      expect(wrongResult.left).toBeInstanceOf(LeadConnectorTokenCipherError);
    }
  });

  it('provides current defaults and a deterministic Fetch transport boundary', async () => {
    const requests: Array<{ url: string; init?: RequestInit }> = [];
    const fetchLayer = createLeadConnectorFetchTransportLayer((async (
      url: string | URL | Request,
      init?: RequestInit,
    ) => {
      requests.push({ url: String(url), init });
      return new Response(JSON.stringify({ ok: true }), {
        status: 201,
        headers: { 'content-type': 'application/json' },
      });
    }) as typeof fetch);
    const configLayer = createLeadConnectorConfigLayer({
      clientId: 'client-id',
      clientSecret: 'client-secret',
      redirectUri: 'https://dialer.example/callback',
      scopes: ['contacts.readonly'],
    });

    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const config = yield* LeadConnectorConfig;
        const transport = yield* LeadConnectorHttpTransport;
        const response = yield* transport.request({
          method: 'POST',
          url: `${config.apiBaseUrl}/fixture`,
          headers: { 'content-type': 'application/json' },
          body: { value: true },
        });
        return { config, response };
      }).pipe(Effect.provide(Layer.mergeAll(configLayer, fetchLayer))),
    );

    expect(result.config.apiBaseUrl).toBe(
      'https://services.leadconnectorhq.com',
    );
    expect(result.config.tokenRefreshSkewSeconds).toBe(300);
    expect(result.config.userType).toBe('Location');
    expect(result.response).toEqual({ status: 201, body: { ok: true } });
    expect(requests[0]).toEqual({
      url: 'https://services.leadconnectorhq.com/fixture',
      init: expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ value: true }),
      }),
    });
  });
});
