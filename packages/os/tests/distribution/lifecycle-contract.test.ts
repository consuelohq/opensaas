import { generateKeyPairSync } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import {
  createEd25519ChannelSigner,
  type ChannelManifestPayload,
} from '../../scripts/lib/distribution/release-channels';
import { verifySignedReleaseManifest } from '../../scripts/lib/lifecycle/release';

describe('OS distribution lifecycle contracts', () => {
  // Worker 05 rollback, retention, and uninstall contracts are behavioral tests in
  // tests/lifecycle-retention-uninstall.test.ts.
  it('resolves the published signed channel manifest to one platform runtime bundle', () => {
    const { privateKey, publicKey } = generateKeyPairSync('ed25519');
    const keyId = 'fixture-release-key';
    const signer = createEd25519ChannelSigner({
      keyId,
      privateKeyPem: privateKey.export({ format: 'pem', type: 'pkcs8' }).toString(),
      publicKeyPem: publicKey.export({ format: 'pem', type: 'spki' }).toString(),
    });
    const payload: ChannelManifestPayload = {
      bundleId: `sha256:${'1'.repeat(64)}`,
      channel: 'stable',
      evidence: [{ kind: 'ci', reference: 'run-123' }],
      kind: 'consuelo-os-channel-manifest',
      platforms: [
        {
          architecture: 'arm64',
          archiveDigest: `sha256:${'2'.repeat(64)}`,
          bundleId: `sha256:${'1'.repeat(64)}`,
          cloudflareObjectKey:
            `bundles/sha256:${'1'.repeat(64)}/consuelo-os-runtime-1.2.3-darwin-arm64.tar.gz`,
          githubAssetName:
            'consuelo-os-runtime-1.2.3-darwin-arm64.tar.gz',
          platform: 'darwin',
        },
      ],
      promotedAt: '2026-07-29T12:00:00.000Z',
      releaseFingerprint: `sha256:${'3'.repeat(64)}`,
      revision: 7,
      schemaVersion: 1,
      sourceChannel: 'beta',
      sourceCommit: 'a'.repeat(40),
      version: '1.2.3',
    };
    const manifest = signer.sign(payload, '2026-07-29T12:00:01.000Z');

    expect(
      verifySignedReleaseManifest(
        manifest,
        { [keyId]: signer.publicKeyPem },
        { platform: 'darwin', architecture: 'arm64' },
      ),
    ).toMatchObject({
      channel: 'stable',
      version: '1.2.3',
      bundleId: payload.bundleId,
      bundleDigest: payload.platforms[0].archiveDigest,
      bundleUrl: payload.platforms[0].cloudflareObjectKey,
      releaseFingerprint: payload.releaseFingerprint,
      publishedAt: payload.promotedAt,
    });
  });

  it.todo('[Worker 04] should activate one verified runtime bundle on clean install');
  it.todo('[Worker 04] should update an existing install without onboarding');
  it.todo('[Worker 04] should leave current unchanged when a download is interrupted');
  it.todo('[Workers 02 and 04] should fail closed when a signature or digest mismatches');
  it.todo('[Worker 06] should never silently overwrite modified managed content');
  it.todo('[Worker 03] should promote a channel without rebuilding or mutating bundle bytes');
  it.todo('[Workers 04 and 23] should redact representative tokens and provider secrets from diagnostics');
});
