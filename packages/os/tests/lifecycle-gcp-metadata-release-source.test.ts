import { describe, expect, it } from 'vitest';

import {
  createGcpMetadataReleaseAuthorization,
  createHttpReleaseSource,
} from '../scripts/lib/lifecycle/release';

describe('GCP metadata-authenticated lifecycle release source', () => {
  it('fetches and caches a metadata bearer token with the required Google header', async () => {
    const requests: Request[] = [];
    let now = Date.parse('2026-07-28T05:00:00.000Z');
    const authorization = createGcpMetadataReleaseAuthorization({
      now: () => now,
      fetchImpl: async (input, init) => {
        const request = new Request(input, init);
        requests.push(request);
        return new Response(
          JSON.stringify({
            access_token: 'metadata-access-token',
            expires_in: 300,
            token_type: 'Bearer',
          }),
          {
            status: 200,
            headers: {
              'content-type': 'application/json',
              'metadata-flavor': 'Google',
            },
          },
        );
      },
    });

    await expect(authorization()).resolves.toBe(
      'Bearer metadata-access-token',
    );
    now += 60_000;
    await expect(authorization()).resolves.toBe(
      'Bearer metadata-access-token',
    );
    expect(requests).toHaveLength(1);
    expect(requests[0].url).toBe(
      'http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token',
    );
    expect(requests[0].headers.get('metadata-flavor')).toBe('Google');
  });

  it('adds bearer authorization to both manifest and bundle requests', async () => {
    const requests: Request[] = [];
    const baseUrl =
      'https://storage.googleapis.com/consuelo-cloud-dev-igg2mr-os-releases-f401931d';
    const source = createHttpReleaseSource({
      baseUrl,
      authorizationProvider: async () => 'Bearer metadata-access-token',
      fetchImpl: async (input, init) => {
        const request = new Request(input, init);
        requests.push(request);
        if (request.url.endsWith('/channels/dev.json')) {
          return new Response(
            JSON.stringify({
              payload: {
                schemaVersion: 1,
                channel: 'dev',
                version: '1.0.0-dev.fixture',
                bundleId: `sha256:${'1'.repeat(64)}`,
                bundleDigest: `sha256:${'2'.repeat(64)}`,
                bundleUrl: 'bundles/runtime.tar.gz',
                releaseFingerprint: `sha256:${'3'.repeat(64)}`,
                publishedAt: '2026-07-28T05:00:00.000Z',
              },
              signature: {
                algorithm: 'ed25519',
                keyId: 'fixture',
                value: 'fixture',
              },
            }),
            { status: 200 },
          );
        }
        return new Response(new Uint8Array([1, 2, 3]), { status: 200 });
      },
    });

    const manifest = await source.fetchManifest('dev');
    expect(manifest.payload.bundleUrl).toBe('bundles/runtime.tar.gz');
    await expect(source.fetchBundle(manifest.payload.bundleUrl)).resolves.toEqual(
      new Uint8Array([1, 2, 3]),
    );
    expect(requests).toHaveLength(2);
    expect(requests[1].url).toBe(`${baseUrl}/bundles/runtime.tar.gz`);
    expect(
      requests.every(
        (request) =>
          request.headers.get('authorization') ===
          'Bearer metadata-access-token',
      ),
    ).toBe(true);
    expect(requests.every((request) => !request.url.includes('metadata-access-token'))).toBe(
      true,
    );
  });

  it('fails closed on malformed or rejected metadata responses', async () => {
    const rejected = createGcpMetadataReleaseAuthorization({
      fetchImpl: async () =>
        new Response('denied', { status: 403, statusText: 'Forbidden' }),
    });
    await expect(rejected()).rejects.toThrow(/metadata token.*HTTP 403/i);

    const malformed = createGcpMetadataReleaseAuthorization({
      fetchImpl: async () =>
        new Response(JSON.stringify({ access_token: '', expires_in: 300 }), {
          status: 200,
        }),
    });
    await expect(malformed()).rejects.toThrow(/malformed metadata token/i);
  });
});
