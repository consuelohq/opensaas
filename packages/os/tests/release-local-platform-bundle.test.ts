import { describe, expect, it } from 'vitest';

import { selectReleasePlatformBundleId } from '../scripts/lib/release-platform-bundle';

const sha = (char: string) => `sha256:${char.repeat(64)}`;

describe('release local platform bundle selection', () => {
  const platforms = [
    { platform: 'darwin', architecture: 'arm64', bundleId: sha('a') },
    { platform: 'darwin', architecture: 'x64', bundleId: sha('b') },
    { platform: 'linux', architecture: 'x64', bundleId: sha('c') },
    { platform: 'win32', architecture: 'x64', bundleId: sha('d') },
  ];

  it('selects the exact platform runtime bundle instead of the release-set bundle', () => {
    expect(selectReleasePlatformBundleId(platforms, {
      platform: 'darwin',
      architecture: 'arm64',
    })).toBe(sha('a'));
  });

  it('fails closed when the signed release does not publish the operator platform', () => {
    expect(() => selectReleasePlatformBundleId(platforms, {
      platform: 'linux',
      architecture: 'arm64',
    })).toThrow('does not publish linux-arm64');
  });

  it('rejects malformed platform bundle identities', () => {
    expect(() => selectReleasePlatformBundleId([
      { platform: 'darwin', architecture: 'arm64', bundleId: 'sha256:not-a-digest' },
    ], {
      platform: 'darwin',
      architecture: 'arm64',
    })).toThrow('invalid bundle ID');
  });
});
