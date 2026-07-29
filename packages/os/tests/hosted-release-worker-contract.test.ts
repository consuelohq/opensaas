import { describe, expect, it } from 'vitest';

import {
  buildWorkerSource,
  materializeHostedBootstrap,
  trustedReleaseKeysJson,
} from '../../workspace/scripts/os-release-install';

describe('hosted OS installer release worker', () => {
  it('should inject the public release trust anchor when the hosted bootstrap contains the placeholder', () => {
    const publicKey = [
      '-----BEGIN PUBLIC KEY-----',
      'fixture',
      '-----END PUBLIC KEY-----',
    ].join('\n');
    const env = {
      CONSUELO_OS_RELEASE_SIGNING_KEY_ID: 'release-key-1',
      CONSUELO_OS_RELEASE_SIGNING_PUBLIC_KEY: publicKey,
    };

    expect(JSON.parse(trustedReleaseKeysJson(env))).toEqual({
      'release-key-1': publicKey,
    });
    const hosted = materializeHostedBootstrap(
      'KEYS="__CONSUELO_RELEASE_PUBLIC_KEYS_BASE64__"\n',
      env,
    );
    expect(hosted).not.toContain('__CONSUELO_RELEASE_PUBLIC_KEYS_BASE64__');
    const encoded = hosted.match(/^KEYS="([^"]+)"/)?.[1];
    expect(
      JSON.parse(Buffer.from(encoded ?? '', 'base64').toString('utf8')),
    ).toEqual({ 'release-key-1': publicKey });
    expect(() =>
      trustedReleaseKeysJson({
        CONSUELO_OS_RELEASE_TRUSTED_PUBLIC_KEYS: '{invalid',
      }),
    ).toThrow(
      /CONSUELO_OS_RELEASE_TRUSTED_PUBLIC_KEYS is not valid JSON/,
    );
  });

  it('should serve only signed channel pointers and immutable bundle objects when the worker handles requests', async () => {
    const worker = buildWorkerSource(
      '#!/usr/bin/env bash\n',
      { pathname: '/os' },
      'a'.repeat(64),
    );
    const moduleUrl = `data:text/javascript;base64,${Buffer.from(worker).toString('base64')}`;
    const generated = await import(/* @vite-ignore */ moduleUrl) as {
      default: {
        fetch(
          request: Request,
          env: {
            CONSUELO_OS_RELEASES: {
              get(key: string): Promise<{
                body: string;
                httpEtag: string;
                writeHttpMetadata(headers: Headers): void;
              } | null>;
            };
          },
        ): Promise<Response>;
      };
    };
    const requestedKeys: string[] = [];
    const env = {
      CONSUELO_OS_RELEASES: {
        async get(key: string) {
          requestedKeys.push(key);
          return {
            body: key.endsWith('.json') ? '{"channel":"fixture"}' : 'bundle',
            httpEtag: '"fixture-etag"',
            writeHttpMetadata(headers: Headers) {
              headers.set('x-r2-fixture', 'true');
            },
          };
        },
      },
    };
    const request = (pathname: string, method = 'GET') =>
      generated.default.fetch(
        new Request(`https://install.consuelohq.com${pathname}`, { method }),
        env,
      );

    for (const channel of ['stable', 'nightly']) {
      const response = await request(`/os/releases/channels/${channel}.json`);
      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toBe(
        'application/json; charset=utf-8',
      );
      expect(response.headers.get('cache-control')).toBe(
        'public, max-age=60, must-revalidate',
      );
    }

    const bundleId = `sha256:${'1'.repeat(64)}`;
    const bundle = await request(
      `/os/releases/bundles/${bundleId}/runtime.tar.gz`,
    );
    expect(bundle.status).toBe(200);
    expect(bundle.headers.get('cache-control')).toBe(
      'public, max-age=31536000, immutable',
    );

    const invalid = await request('/os/releases/bundles/not-a-digest/runtime.tar.gz');
    expect(invalid.status).toBe(404);
    expect(invalid.headers.get('content-type')).toBe(
      'text/plain; charset=utf-8',
    );
    const post = await request('/os/releases/channels/stable.json', 'POST');
    expect(post.status).toBe(405);
    expect(post.headers.get('allow')).toBe('GET, HEAD');
    expect(requestedKeys).toEqual([
      'channels/stable.json',
      'channels/nightly.json',
      `bundles/${bundleId}/runtime.tar.gz`,
    ]);
  });
});
