import { generateKeyPairSync } from 'node:crypto';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  buildWorkerSource,
  materializeHostedBootstrap,
  trustedReleaseKeysJson,
} from '../../workspace/scripts/os-release-install';
import { createEd25519ChannelSigner } from '../scripts/lib/distribution/release-channels';

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
    const moduleDirectory = mkdtempSync(
      join(tmpdir(), 'consuelo-hosted-release-worker-'),
    );
    const modulePath = join(moduleDirectory, 'worker.mjs');
    writeFileSync(modulePath, worker);
    type GeneratedWorker = {
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
    const generated = await (async (): Promise<GeneratedWorker> => {
      try {
        return await import(
          /* @vite-ignore */ `${pathToFileURL(modulePath).href}?fixture=${Date.now()}`
        ) as GeneratedWorker;
      } finally {
        rmSync(moduleDirectory, { recursive: true, force: true });
      }
    })();
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

  it('should expose a stable Windows x64 PowerShell installer route', () => {
    const worker = buildWorkerSource(
      '#!/usr/bin/env bash\n',
      { pathname: '/os' },
      'a'.repeat(64),
      '[CmdletBinding()]\nparam()\n',
    );

    expect(worker).toContain('WINDOWS_INSTALL_PATH');
    expect(worker).toContain('channels/stable.json');
    expect(worker).toContain("platform === 'windows'");
    expect(worker).toContain("architecture === 'x64'");
    expect(worker).toContain('Windows installer unavailable');
  });

  it('should verify the signed stable pointer before binding the Windows bundle', async () => {
    const { privateKey, publicKey } = generateKeyPairSync('ed25519');
    const publicKeyPem = publicKey.export({ format: 'pem', type: 'spki' }).toString();
    const signer = createEd25519ChannelSigner({
      keyId: 'fixture-release-key',
      privateKeyPem: privateKey.export({ format: 'pem', type: 'pkcs8' }).toString(),
      publicKeyPem,
    });
    const bundleId = `sha256:${'3'.repeat(64)}`;
    const archiveDigest = `sha256:${'2'.repeat(64)}`;
    const objectKey = `bundles/${bundleId}/consuelo-os-1.2.3-windows-x64.tar.gz`;
    const manifest = signer.sign({
      kind: 'consuelo-os-channel-manifest',
      schemaVersion: 1,
      channel: 'stable',
      sourceChannel: 'beta',
      version: '1.2.3',
      sourceCommit: 'fixture-source',
      bundleId: `sha256:${'4'.repeat(64)}`,
      releaseFingerprint: `sha256:${'5'.repeat(64)}`,
      revision: 7,
      promotedAt: '2026-09-10T00:00:00.000Z',
      evidence: [{ kind: 'test', reference: 'fixture' }],
      platforms: [{
        platform: 'windows',
        architecture: 'x64',
        bundleId,
        archiveDigest,
        cloudflareObjectKey: objectKey,
        githubAssetName: 'consuelo-os-1.2.3-windows-x64.tar.gz',
      }],
    }, '2026-09-10T00:00:00.000Z');
    const worker = buildWorkerSource(
      '#!/usr/bin/env bash\n',
      { pathname: '/os' },
      'a'.repeat(64),
      '[CmdletBinding()]\nparam([string]$BundleUrl, [string]$BundleSha256)\nWrite-Output $BundleUrl\n',
      JSON.stringify({ 'fixture-release-key': publicKeyPem }),
    );
    const moduleDirectory = mkdtempSync(join(tmpdir(), 'consuelo-windows-installer-worker-'));
    const modulePath = join(moduleDirectory, 'worker.mjs');
    writeFileSync(modulePath, worker);
    const generated = await (async () => {
      try {
        return await import(
          /* @vite-ignore */ `${pathToFileURL(modulePath).href}?fixture=${Date.now()}`
        );
      } finally {
        rmSync(moduleDirectory, { recursive: true, force: true });
      }
    })();
    const response = await generated.default.fetch(
      new Request('https://install.consuelohq.com/os.ps1'),
      {
        CONSUELO_OS_RELEASES: {
          async get(key: string) {
            if (key !== 'channels/stable.json') return null;
            return {
              body: JSON.stringify(manifest),
              httpEtag: '"fixture"',
              writeHttpMetadata() {},
            };
          },
        },
      },
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('text/x-powershell; charset=utf-8');
    const body = await response.text();
    expect(body).toContain('Start-Process powershell.exe');
    expect(body).toContain('-Verb RunAs');
    expect(body).toContain("Invoke-WebRequest -UseBasicParsing -Uri 'https://install.consuelohq.com/os.ps1'");
    expect(body).toContain(`/os/releases/${objectKey}`);
    expect(body).toContain(archiveDigest.slice('sha256:'.length));

    const head = await generated.default.fetch(
      new Request('https://install.consuelohq.com/os.ps1', { method: 'HEAD' }),
      {
        CONSUELO_OS_RELEASES: {
          async get(key: string) {
            if (key !== 'channels/stable.json') return null;
            return {
              body: JSON.stringify(manifest),
              httpEtag: '"fixture"',
              writeHttpMetadata() {},
            };
          },
        },
      },
    );
    expect(head.status).toBe(200);
    expect(await head.text()).toBe('');

    const post = await generated.default.fetch(
      new Request('https://install.consuelohq.com/os.ps1', { method: 'POST' }),
      { CONSUELO_OS_RELEASES: { async get() { return null; } } },
    );
    expect(post.status).toBe(405);
    expect(post.headers.get('allow')).toBe('GET, HEAD');

    const tamperedManifest = structuredClone(manifest);
    tamperedManifest.payload.platforms[0].archiveDigest = `sha256:${'9'.repeat(64)}`;
    const rejected = await generated.default.fetch(
      new Request('https://install.consuelohq.com/os.ps1'),
      {
        CONSUELO_OS_RELEASES: {
          async get() {
            return {
              body: JSON.stringify(tamperedManifest),
              httpEtag: '"tampered"',
              writeHttpMetadata() {},
            };
          },
        },
      },
    );
    expect(rejected.status).toBe(503);
    expect(await rejected.text()).toBe('Windows installer unavailable\n');
  });
});
