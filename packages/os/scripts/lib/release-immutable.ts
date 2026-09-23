import {
  DEFAULT_REQUIRED_RELEASE_PLATFORMS,
  releaseSetIdForBundles,
  type BundleSignaturePayload,
  type PlatformBundlePublication,
} from './distribution/release-channels';
import type { ReleaseIdentity } from './release-orchestrator';

export type ImmutableReleaseTag = {
  name: string;
  sha: string;
};

const RELEASE_TAG_PATTERN = /^consuelo-os-v((0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*))$/;
const SHA_PATTERN = /^[0-9a-f]{40}$/i;
const DIGEST_PATTERN = /^sha256:[a-f0-9]{64}$/;

function platformKey(input: Pick<BundleSignaturePayload, 'platform' | 'architecture'>): string {
  return `${input.platform}-${input.architecture}`;
}

export function resolveImmutableReleaseIdentityFromEvidence(input: {
  mergeSha: string;
  platform: string;
  architecture: string;
  tags: ImmutableReleaseTag[];
  signaturePayloads: BundleSignaturePayload[];
}): ReleaseIdentity | null {
  if (!SHA_PATTERN.test(input.mergeSha)) {
    throw new Error('merged main SHA must be a 40-character commit SHA');
  }
  const matchingTags = input.tags.filter((tag) => (
    tag.sha.toLowerCase() === input.mergeSha.toLowerCase()
    && RELEASE_TAG_PATTERN.test(tag.name)
  ));
  if (matchingTags.length === 0) return null;
  if (matchingTags.length !== 1) {
    throw new Error(`multiple immutable Consuelo OS release tags point at ${input.mergeSha}`);
  }
  const version = RELEASE_TAG_PATTERN.exec(matchingTags[0]!.name)?.[1] ?? '';
  const expected = new Set(DEFAULT_REQUIRED_RELEASE_PLATFORMS);
  const observed = new Set<string>();
  let releaseFingerprint = '';
  const bundles: PlatformBundlePublication[] = input.signaturePayloads.map((payload) => {
    const key = platformKey(payload);
    if (!expected.has(key as (typeof DEFAULT_REQUIRED_RELEASE_PLATFORMS)[number])) {
      throw new Error(`unexpected immutable release platform: ${key}`);
    }
    if (observed.has(key)) throw new Error(`duplicate immutable release platform: ${key}`);
    observed.add(key);
    if (payload.sourceCommit.toLowerCase() !== input.mergeSha.toLowerCase()) {
      throw new Error(`immutable release signature source commit mismatch for ${key}`);
    }
    if (payload.version !== version) {
      throw new Error(`immutable release signature version mismatch for ${key}`);
    }
    if (!DIGEST_PATTERN.test(payload.archiveDigest) || !DIGEST_PATTERN.test(payload.bundleId)) {
      throw new Error(`immutable release signature digest is invalid for ${key}`);
    }
    if (!DIGEST_PATTERN.test(payload.releaseFingerprint)) {
      throw new Error(`immutable release fingerprint is invalid for ${key}`);
    }
    if (releaseFingerprint && releaseFingerprint !== payload.releaseFingerprint) {
      throw new Error('immutable release signatures disagree on the release fingerprint');
    }
    releaseFingerprint = payload.releaseFingerprint;
    return {
      architecture: payload.architecture,
      archiveDigest: payload.archiveDigest,
      bundleId: payload.bundleId,
      cloudflare: { digest: payload.archiveDigest, objectKey: '' },
      github: { assetName: '', digest: payload.archiveDigest },
      manifest: {
        architecture: payload.architecture,
        bundleId: payload.bundleId,
        ...(payload.capabilities ? { capabilities: [...payload.capabilities] } : {}),
        platform: payload.platform,
        releaseFingerprint: payload.releaseFingerprint,
        schemaVersion: 1,
        sourceCommit: payload.sourceCommit,
        version: payload.version,
      },
      platform: payload.platform,
      signature: { algorithm: 'ed25519', keyId: '', signature: '' },
    };
  });

  for (const required of expected) {
    if (!observed.has(required)) {
      throw new Error(`immutable release is missing required platform ${required}`);
    }
  }

  const current = input.signaturePayloads.find(
    (payload) => payload.platform === input.platform && payload.architecture === input.architecture,
  );
  if (!current) {
    throw new Error(`immutable release is missing current platform ${input.platform}-${input.architecture}`);
  }

  return {
    channel: 'dev',
    sourceCommit: input.mergeSha,
    version,
    releaseSetBundleId: releaseSetIdForBundles(bundles),
    platformBundleId: current.bundleId,
  };
}
