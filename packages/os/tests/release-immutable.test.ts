import { describe, expect, it } from 'vitest';

import { resolveImmutableReleaseIdentityFromEvidence } from '../scripts/lib/release-immutable';

const digest = (character: string) => `sha256:${character.repeat(64)}`;

describe('immutable exact-SHA release resolution', () => {
  it('reconstructs the historical release set even after the mutable dev pointer advances', () => {
    const identity = resolveImmutableReleaseIdentityFromEvidence({
      mergeSha: 'a'.repeat(40),
      platform: 'darwin',
      architecture: 'arm64',
      tags: [
        { name: 'consuelo-os-v1.2.4', sha: 'b'.repeat(40) },
        { name: 'consuelo-os-v1.2.3', sha: 'a'.repeat(40) },
      ],
      signaturePayloads: [
        { platform: 'darwin', architecture: 'arm64', archiveDigest: digest('1'), bundleId: digest('a'), releaseFingerprint: digest('f'), sourceCommit: 'a'.repeat(40), version: '1.2.3' },
        { platform: 'darwin', architecture: 'x64', archiveDigest: digest('2'), bundleId: digest('b'), releaseFingerprint: digest('f'), sourceCommit: 'a'.repeat(40), version: '1.2.3' },
        { platform: 'linux', architecture: 'x64', archiveDigest: digest('3'), bundleId: digest('c'), releaseFingerprint: digest('f'), sourceCommit: 'a'.repeat(40), version: '1.2.3' },
        { platform: 'windows', architecture: 'x64', archiveDigest: digest('4'), bundleId: digest('d'), releaseFingerprint: digest('f'), sourceCommit: 'a'.repeat(40), version: '1.2.3' },
      ],
    });

    expect(identity).toMatchObject({
      channel: 'dev',
      sourceCommit: 'a'.repeat(40),
      version: '1.2.3',
      platformBundleId: digest('a'),
    });
    expect(identity?.releaseSetBundleId).toMatch(/^sha256:[a-f0-9]{64}$/);
  });

  it('fails closed when immutable signature evidence is incomplete or mismatched', () => {
    expect(() => resolveImmutableReleaseIdentityFromEvidence({
      mergeSha: 'a'.repeat(40),
      platform: 'darwin',
      architecture: 'arm64',
      tags: [{ name: 'consuelo-os-v1.2.3', sha: 'a'.repeat(40) }],
      signaturePayloads: [
        { platform: 'darwin', architecture: 'arm64', archiveDigest: digest('1'), bundleId: digest('a'), releaseFingerprint: digest('f'), sourceCommit: 'a'.repeat(40), version: '1.2.3' },
      ],
    })).toThrow(/required platform/i);
  });
});
