import { describe, expect, it } from 'vitest';

import {
  buildWorkerSource,
  materializeHostedBootstrap,
  trustedReleaseKeysJson,
} from '../../workspace/scripts/os-release-install';

describe('hosted OS installer release worker', () => {
  it('injects the public release trust anchor into the hosted bootstrap', () => {
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
  });

  it('serves only signed channel pointers and immutable bundle objects from R2', () => {
    const worker = buildWorkerSource(
      '#!/usr/bin/env bash\n',
      { pathname: '/os' },
      'a'.repeat(64),
    );

    expect(worker).toContain('env.CONSUELO_OS_RELEASES.get(key)');
    expect(worker).toContain('channels\\/(?:dev|canary|beta|stable)');
    expect(worker).toContain('bundles\\/sha256:[a-f0-9]{64}');
    expect(worker).toContain('public, max-age=31536000, immutable');
    expect(worker).toContain("key.includes('..')");
  });
});
