import { describe, expect, it } from 'bun:test';
import { createCipheriv, createHash, randomBytes } from 'node:crypto';

import { Effect, Either, Layer } from 'effect';

import {
  LeadConnectorConfig,
  LeadConnectorHttpTransport,
  LeadConnectorUserContextDecoder,
  LeadConnectorEmbedIdentityError,
  LeadConnectorTokenCipher,
  LeadConnectorTokenCipherError,
  createLeadConnectorConfigLayer,
  createLeadConnectorFetchTransportLayer,
  createLeadConnectorTokenCipherLayer,
  createLeadConnectorUserContextDecoderLayer,
} from './index';

const encryptOpenSslContext = (secret: string, value: unknown): string => {
  const salt = randomBytes(8);
  const secretBytes = Buffer.from(secret, 'utf8');
  let derived = Buffer.alloc(0);
  let block = Buffer.alloc(0);
  while (derived.length < 48) {
    block = createHash('md5')
      .update(Buffer.concat([block, secretBytes, salt]))
      .digest();
    derived = Buffer.concat([derived, block]);
  }
  const cipher = createCipheriv(
    'aes-256-cbc',
    derived.subarray(0, 32),
    derived.subarray(32, 48),
  );
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(value), 'utf8'),
    cipher.final(),
  ]);
  return Buffer.concat([
    Buffer.from('Salted__', 'utf8'),
    salt,
    ciphertext,
  ]).toString('base64');
};

describe('LeadConnector infrastructure contracts', () => {
  it('decrypts provider user context with the server-only shared secret and rejects another secret', async () => {
    const secret = 'lead-connector-shared-secret';
    const encryptedData = encryptOpenSslContext(secret, {
      userId: 'provider-user-1',
      companyId: 'company-1',
      role: 'user',
      type: 'location',
      activeLocation: 'location-1',
      versionId: 'version-1',
      appStatus: 'installed',
    });
    const decoded = await Effect.runPromise(
      Effect.gen(function* () {
        const decoder = yield* LeadConnectorUserContextDecoder;
        return yield* decoder.decrypt(encryptedData);
      }).pipe(
        Effect.provide(createLeadConnectorUserContextDecoderLayer(secret)),
      ),
    );
    expect(decoded).toEqual({
      userId: 'provider-user-1',
      companyId: 'company-1',
      role: 'user',
      type: 'location',
      activeLocation: 'location-1',
      versionId: 'version-1',
      appStatus: 'installed',
    });

    const wrongSecret = await Effect.runPromise(
      Effect.either(
        Effect.gen(function* () {
          const decoder = yield* LeadConnectorUserContextDecoder;
          return yield* decoder.decrypt(encryptedData);
        }).pipe(
          Effect.provide(
            createLeadConnectorUserContextDecoderLayer(
              'different-lead-connector-secret',
            ),
          ),
        ),
      ),
    );
    expect(Either.isLeft(wrongSecret)).toBe(true);
    if (Either.isRight(wrongSecret)) return;
    expect(wrongSecret.left).toBeInstanceOf(LeadConnectorEmbedIdentityError);
  });

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

  it('form-encodes camelCase token bodies when requested by the provider contract', async () => {
    const requests: Array<{ url: string; init?: RequestInit }> = [];
    const layer = createLeadConnectorFetchTransportLayer((async (
      url: string | URL | Request,
      init?: RequestInit,
    ) => {
      requests.push({ url: String(url), init });
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }) as typeof fetch);

    await Effect.runPromise(
      Effect.gen(function* () {
        const transport = yield* LeadConnectorHttpTransport;
        yield* transport.request({
          method: 'POST',
          url: 'https://services.leadconnectorhq.com/oauth/token',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/x-www-form-urlencoded',
            Version: 'v3',
          },
          body: {
            clientId: 'client-id',
            clientSecret: 'client-secret',
            grantType: 'authorization_code',
            userType: 'Location',
            code: 'code-1',
            redirectUri: 'https://dialer.example/callback',
          },
        });
      }).pipe(Effect.provide(layer)),
    );

    expect(requests[0]?.init?.body).toBe(
      new URLSearchParams({
        clientId: 'client-id',
        clientSecret: 'client-secret',
        grantType: 'authorization_code',
        userType: 'Location',
        code: 'code-1',
        redirectUri: 'https://dialer.example/callback',
      }).toString(),
    );
  });
});
