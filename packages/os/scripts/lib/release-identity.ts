import { createHash } from 'node:crypto';

import { canonicalReleaseJson } from './release-canonical-json';

export const DEFAULT_REQUIRED_RELEASE_PLATFORMS = [
  'darwin-arm64',
  'darwin-x64',
  'linux-x64',
  'windows-x64',
] as const;

type ReleaseBundleIdentity = {
  architecture: string;
  archiveDigest: string;
  bundleId: string;
  platform: string;
};

/** Hash the canonical set of platform bundles without depending on operator signing code. */
export function releaseSetIdForBundles(bundles: readonly ReleaseBundleIdentity[]): string {
  if (bundles.length === 0) throw new Error('release requires at least one runtime bundle');
  const identities = bundles
    .map((bundle) => ({
      architecture: bundle.architecture,
      archiveDigest: bundle.archiveDigest,
      bundleId: bundle.bundleId,
      platform: bundle.platform,
    }))
    .sort((left, right) => `${left.platform}-${left.architecture}`.localeCompare(`${right.platform}-${right.architecture}`));
  return `sha256:${createHash('sha256').update(canonicalReleaseJson(identities)).digest('hex')}`;
}
