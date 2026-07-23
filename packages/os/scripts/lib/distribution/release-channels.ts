import {
  createHash,
  createPrivateKey,
  createPublicKey,
  sign as signBytes,
  verify as verifyBytes,
} from 'node:crypto';

export const RELEASE_STATE_SCHEMA_VERSION = 1 as const;
export const CHANNEL_MANIFEST_SCHEMA_VERSION = 1 as const;
export const RELEASE_TAG_PREFIX = 'consuelo-os-v' as const;
export const RELEASE_CHANNELS = ['dev', 'canary', 'beta', 'stable'] as const;
export const DEFAULT_REQUIRED_RELEASE_PLATFORMS = [
  'darwin-arm64',
  'linux-x64',
  'windows-x64',
] as const;

export type ReleaseChannel = typeof RELEASE_CHANNELS[number];
export type ReleaseIntent = 'major' | 'minor' | 'patch';

export type ReleaseEvidence = {
  kind: string;
  reference: string;
};

export type DetachedReleaseSignature = {
  algorithm: 'ed25519';
  keyId: string;
  signature: string;
};

export type PlatformBundlePublication = {
  architecture: string;
  archivePath?: string;
  archiveDigest: string;
  bundleId: string;
  cloudflare: {
    digest: string;
    objectKey: string;
  };
  github: {
    assetName: string;
    digest: string;
  };
  manifest: {
    architecture: string;
    bundleId: string;
    platform: string;
    releaseFingerprint: string;
    schemaVersion: number;
    sourceCommit: string;
    version: string;
  };
  platform: string;
  signature: DetachedReleaseSignature;
  signaturePath?: string;
};

export type BundleSignaturePayload = {
  architecture: string;
  archiveDigest: string;
  bundleId: string;
  platform: string;
  releaseFingerprint: string;
  sourceCommit: string;
  version: string;
};

export type ReleaseRecord = {
  bundleId: string;
  bundles: PlatformBundlePublication[];
  createdAt: string;
  evidence: ReleaseEvidence[];
  immutableTag: string;
  releaseFingerprint: string;
  sourceCommit: string;
  version: string;
};

export type ChannelManifestPayload = {
  bundleId: string;
  channel: ReleaseChannel;
  evidence: ReleaseEvidence[];
  kind: 'consuelo-os-channel-manifest';
  platforms: Array<{
    architecture: string;
    archiveDigest: string;
    bundleId: string;
    cloudflareObjectKey: string;
    githubAssetName: string;
    platform: string;
  }>;
  promotedAt: string;
  releaseFingerprint: string;
  revision: number;
  schemaVersion: number;
  sourceChannel: ReleaseChannel | null;
  sourceCommit: string;
  version: string;
};

export type SignedChannelManifest = {
  payload: ChannelManifestPayload;
  signature: DetachedReleaseSignature & {
    signedAt: string;
  };
};

export type GitHubReleaseRecord = {
  bundleId: string;
  prerelease: boolean;
  releaseFingerprint: string;
  sourceCommit: string;
  tag: string;
  version: string;
};

export type ReleaseDeploymentRecord = {
  bundleId: string;
  createdAt: string;
  environment: string;
  releaseFingerprint: string;
  sourceCommit: string;
  version: string;
};

export type ReleaseAuditEvent = {
  action: 'publish' | 'promote' | 'rollback';
  actor?: string;
  bundleId: string;
  channel: ReleaseChannel;
  fromChannel?: ReleaseChannel;
  occurredAt: string;
  revision: number;
  version: string;
};

export type ReleaseState = {
  allocations: Record<string, string>;
  audit: ReleaseAuditEvent[];
  branchRefs: Partial<Record<Exclude<ReleaseChannel, 'dev'>, string>>;
  channelHistory: Record<ReleaseChannel, string[]>;
  channelSchemaVersion: number;
  channels: Partial<Record<ReleaseChannel, SignedChannelManifest>>;
  cloudflareObjects: Record<string, string>;
  deployments: ReleaseDeploymentRecord[];
  githubReleases: Record<string, GitHubReleaseRecord>;
  releases: Record<string, ReleaseRecord>;
  revision: number;
  schemaVersion: 1;
  tags: Record<string, string>;
};

export type ChannelSigner = {
  keyId: string;
  publicKeyPem: string;
  sign: (payload: ChannelManifestPayload, signedAt: string) => SignedChannelManifest;
};

export type ReleaseOperation =
  | { kind: 'create-immutable-tag'; bundleId: string; tag: string }
  | { kind: 'create-github-release'; bundleId: string; prerelease: boolean; tag: string }
  | { kind: 'upload-github-asset'; assetName: string; bundleId: string; digest: string }
  | { kind: 'put-cloudflare-object'; bundleId: string; digest: string; objectKey: string }
  | { kind: 'create-github-deployment'; bundleId: string; environment: string }
  | { kind: 'put-channel-manifest'; bundleId: string; channel: ReleaseChannel; digest: string }
  | { kind: 'update-protected-channel-ref'; channel: Exclude<ReleaseChannel, 'dev'>; sourceCommit: string }
  | { kind: 'update-github-release'; prerelease: boolean; tag: string };

export type ReleaseArtifactPaths = {
  archivePath: string;
  signaturePath: string;
};

export type ReleaseMutationResult = {
  artifacts?: Record<string, ReleaseArtifactPaths>;
  changed: boolean;
  idempotent: boolean;
  manifest?: SignedChannelManifest;
  operations: ReleaseOperation[];
  state: ReleaseState;
};

export type DevPublicationInput = {
  approvedVersion: string;
  bundleId: string;
  bundleSigningPublicKeys: Record<string, string>;
  bundles: PlatformBundlePublication[];
  channel: 'dev';
  channelSchemaVersion?: number;
  evidence: ReleaseEvidence[];
  expectedRevision?: number;
  formatMigration?: {
    from: number;
    reference: string;
    to: number;
  };
  githubDeployment: {
    environment: 'consuelo-os-dev';
    releaseFingerprint: string;
    sourceCommit: string;
    version: string;
  };
  githubRelease: {
    prerelease: boolean;
    releaseFingerprint: string;
    sourceCommit: string;
    tag: string;
    version: string;
  };
  releaseFingerprint: string;
  releaseIntent?: ReleaseIntent;
  requiredPlatforms?: string[];
  sourceCommit: string;
};

export type PromotionInput = {
  approval?: {
    actor: string;
    approved: boolean;
    evidence: string;
  };
  bundleId: string;
  expectedRevision?: number;
  from: ReleaseChannel;
  to: ReleaseChannel;
};

export type RollbackInput = {
  approval?: {
    actor: string;
    approved: boolean;
    evidence: string;
  };
  bundleId: string;
  channel: ReleaseChannel;
  expectedRevision?: number;
};

const SHA256_PATTERN = /^sha256:[a-f0-9]{64}$/;
const SEMVER_PATTERN = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const LEGAL_TRANSITIONS: Readonly<Record<ReleaseChannel, ReleaseChannel | null>> = {
  beta: 'stable',
  canary: 'beta',
  dev: 'canary',
  stable: null,
};

export class StaleReleaseStateError extends Error {
  constructor(expected: number, actual: number) {
    super(`release state revision changed: expected ${expected}, actual ${actual}`);
    this.name = 'StaleReleaseStateError';
  }
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    const output: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      const item = (value as Record<string, unknown>)[key];
      if (item !== undefined) output[key] = canonicalize(item);
    }
    return output;
  }
  return value;
}

export function canonicalReleaseJson(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

export function canonicalBundleSignatureJson(payload: BundleSignaturePayload): string {
  return canonicalReleaseJson(payload);
}

function sha256(value: string | Uint8Array): string {
  return `sha256:${createHash('sha256').update(value).digest('hex')}`;
}

function cloneState(state: ReleaseState): ReleaseState {
  return structuredClone(state);
}

function assertSha256(value: string, label: string): void {
  if (!SHA256_PATTERN.test(value)) throw new Error(`${label} must be a sha256 digest`);
}

function parseSemver(value: string, label: string): [number, number, number] {
  const match = SEMVER_PATTERN.exec(value);
  if (!match) throw new Error(`${label} must be a stable SemVer value`);
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

function compareSemver(left: string, right: string): number {
  const leftParts = parseSemver(left, 'release version');
  const rightParts = parseSemver(right, 'release version');
  for (let index = 0; index < 3; index += 1) {
    if (leftParts[index] !== rightParts[index]) return leftParts[index] - rightParts[index];
  }
  return 0;
}

function assertChannel(channel: string): asserts channel is ReleaseChannel {
  if (!RELEASE_CHANNELS.includes(channel as ReleaseChannel)) {
    throw new Error(`unsupported release channel: ${channel}`);
  }
}

function assertExpectedRevision(state: ReleaseState, expectedRevision?: number): void {
  if (expectedRevision !== undefined && expectedRevision !== state.revision) {
    throw new StaleReleaseStateError(expectedRevision, state.revision);
  }
}

function allocationKey(sourceCommit: string, releaseFingerprint: string): string {
  return `${sourceCommit}:${releaseFingerprint}`;
}

function platformKey(bundle: Pick<PlatformBundlePublication, 'architecture' | 'platform'>): string {
  return `${bundle.platform}-${bundle.architecture}`;
}

function assertEvidence(evidence: ReleaseEvidence[]): void {
  if (evidence.length === 0) throw new Error('release evidence is required');
  for (const item of evidence) {
    if (!item.kind.trim() || !item.reference.trim()) {
      throw new Error('release evidence kind and reference are required');
    }
  }
}

function assertStableApproval(
  channel: ReleaseChannel,
  approval: PromotionInput['approval'] | RollbackInput['approval'],
): void {
  if (channel !== 'stable') return;
  if (!approval?.approved || !approval.actor.trim() || !approval.evidence.trim()) {
    throw new Error('stable promotion requires explicit approval evidence');
  }
}

export function createEmptyReleaseState(): ReleaseState {
  return {
    allocations: {},
    audit: [],
    branchRefs: {},
    channelHistory: {
      beta: [],
      canary: [],
      dev: [],
      stable: [],
    },
    channelSchemaVersion: CHANNEL_MANIFEST_SCHEMA_VERSION,
    channels: {},
    cloudflareObjects: {},
    deployments: [],
    githubReleases: {},
    releases: {},
    revision: 0,
    schemaVersion: RELEASE_STATE_SCHEMA_VERSION,
    tags: {},
  };
}

export function createEd25519ChannelSigner(input: {
  keyId: string;
  privateKeyPem: string;
  publicKeyPem: string;
}): ChannelSigner {
  if (!input.keyId.trim()) throw new Error('release signing key ID is required');
  const privateKey = createPrivateKey(input.privateKeyPem);
  const publicKey = createPublicKey(input.publicKeyPem);
  if (privateKey.asymmetricKeyType !== 'ed25519' || publicKey.asymmetricKeyType !== 'ed25519') {
    throw new Error('release channel signer requires Ed25519 keys');
  }

  return {
    keyId: input.keyId,
    publicKeyPem: input.publicKeyPem,
    sign(payload, signedAt) {
      const signature = signBytes(
        null,
        Buffer.from(canonicalReleaseJson(payload)),
        privateKey,
      ).toString('base64url');
      return {
        payload,
        signature: {
          algorithm: 'ed25519',
          keyId: input.keyId,
          signature,
          signedAt,
        },
      };
    },
  };
}

export function verifySignedChannelManifest(
  manifest: SignedChannelManifest,
  publicKeys: Record<string, string>,
): boolean {
  try {
    if (manifest.signature.algorithm !== 'ed25519') return false;
    const publicKeyPem = publicKeys[manifest.signature.keyId];
    if (!publicKeyPem) return false;
    const publicKey = createPublicKey(publicKeyPem);
    if (publicKey.asymmetricKeyType !== 'ed25519') return false;
    return verifyBytes(
      null,
      Buffer.from(canonicalReleaseJson(manifest.payload)),
      publicKey,
      Buffer.from(manifest.signature.signature, 'base64url'),
    );
  } catch {
    return false;
  }
}

export function calculateNextReleaseVersion(input: {
  immutableTags: string[];
  intent?: ReleaseIntent;
  seedVersion?: string;
}): string {
  const intent = input.intent ?? 'patch';
  if (!['patch', 'minor', 'major'].includes(intent)) {
    throw new Error('release intent must be patch, minor, or major');
  }

  const versions = input.immutableTags
    .filter((tag) => tag.startsWith(RELEASE_TAG_PREFIX))
    .map((tag) => tag.slice(RELEASE_TAG_PREFIX.length));
  for (const version of versions) parseSemver(version, 'immutable Consuelo OS tag');

  if (versions.length === 0) {
    if (!input.seedVersion) {
      throw new Error('first Consuelo OS release requires an explicit seed version');
    }
    parseSemver(input.seedVersion, 'first-release seed version');
    return input.seedVersion;
  }

  const highest = [...versions].sort(compareSemver).at(-1)!;
  const [major, minor, patch] = parseSemver(highest, 'release version');
  if (intent === 'major') return `${major + 1}.0.0`;
  if (intent === 'minor') return `${major}.${minor + 1}.0`;
  return `${major}.${minor}.${patch + 1}`;
}

export function planDevPublication(
  state: ReleaseState,
  input: {
    immutableTags?: string[];
    intent?: ReleaseIntent;
    releaseFingerprint: string;
    seedVersion?: string;
    sourceCommit: string;
  },
):
  | {
      changed: false;
      noOp: true;
      reason: string;
      releaseFingerprint: string;
    }
  | {
      changed: true;
      immutableTag: string;
      noOp: false;
      releaseFingerprint: string;
      retry: boolean;
      version: string;
    } {
  assertSha256(input.releaseFingerprint, 'release fingerprint');
  if (!input.sourceCommit.trim()) throw new Error('source commit is required');
  const current = state.channels.dev?.payload;
  if (current?.releaseFingerprint === input.releaseFingerprint) {
    return {
      changed: false,
      noOp: true,
      reason: 'release fingerprint already published to dev',
      releaseFingerprint: input.releaseFingerprint,
    };
  }

  const existingVersion = state.allocations[allocationKey(
    input.sourceCommit,
    input.releaseFingerprint,
  )];
  const version = existingVersion ?? calculateNextReleaseVersion({
    immutableTags: input.immutableTags ?? Object.keys(state.tags),
    intent: input.intent,
    seedVersion: input.seedVersion,
  });
  return {
    changed: true,
    immutableTag: `${RELEASE_TAG_PREFIX}${version}`,
    noOp: false,
    releaseFingerprint: input.releaseFingerprint,
    retry: Boolean(existingVersion),
    version,
  };
}

export function releaseSetIdForBundles(bundles: PlatformBundlePublication[]): string {
  if (bundles.length === 0) throw new Error('release requires at least one runtime bundle');
  const identities = bundles
    .map((bundle) => ({
      architecture: bundle.architecture,
      archiveDigest: bundle.archiveDigest,
      bundleId: bundle.bundleId,
      platform: bundle.platform,
    }))
    .sort((left, right) => platformKey(left).localeCompare(platformKey(right)));
  return sha256(canonicalReleaseJson(identities));
}

function channelPlatforms(release: ReleaseRecord): ChannelManifestPayload['platforms'] {
  return release.bundles
    .map((bundle) => ({
      architecture: bundle.architecture,
      archiveDigest: bundle.archiveDigest,
      bundleId: bundle.bundleId,
      cloudflareObjectKey: bundle.cloudflare.objectKey,
      githubAssetName: bundle.github.assetName,
      platform: bundle.platform,
    }))
    .sort((left, right) => platformKey(left).localeCompare(platformKey(right)));
}

function signedManifest(
  release: ReleaseRecord,
  channel: ReleaseChannel,
  sourceChannel: ReleaseChannel | null,
  stateRevision: number,
  now: string,
  signer: ChannelSigner,
  schemaVersion: number,
): SignedChannelManifest {
  return signer.sign({
    bundleId: release.bundleId,
    channel,
    evidence: release.evidence,
    kind: 'consuelo-os-channel-manifest',
    platforms: channelPlatforms(release),
    promotedAt: now,
    releaseFingerprint: release.releaseFingerprint,
    revision: stateRevision,
    schemaVersion,
    sourceChannel,
    sourceCommit: release.sourceCommit,
    version: release.version,
  }, now);
}

function verifyRuntimeBundleSignature(
  bundle: PlatformBundlePublication,
  publicKeys: Record<string, string>,
): boolean {
  try {
    if (bundle.signature.algorithm !== 'ed25519') return false;
    const publicKeyPem = publicKeys[bundle.signature.keyId];
    if (!publicKeyPem) return false;
    const publicKey = createPublicKey(publicKeyPem);
    if (publicKey.asymmetricKeyType !== 'ed25519') return false;
    const payload: BundleSignaturePayload = {
      architecture: bundle.architecture,
      archiveDigest: bundle.archiveDigest,
      bundleId: bundle.bundleId,
      platform: bundle.platform,
      releaseFingerprint: bundle.manifest.releaseFingerprint,
      sourceCommit: bundle.manifest.sourceCommit,
      version: bundle.manifest.version,
    };
    return verifyBytes(
      null,
      Buffer.from(canonicalBundleSignatureJson(payload)),
      publicKey,
      Buffer.from(bundle.signature.signature, 'base64url'),
    );
  } catch {
    return false;
  }
}

function assertBundles(input: DevPublicationInput): void {
  const requiredPlatforms = input.requiredPlatforms ?? [...DEFAULT_REQUIRED_RELEASE_PLATFORMS];
  const seen = new Set<string>();
  for (const bundle of input.bundles) {
    const key = platformKey(bundle);
    if (seen.has(key)) throw new Error(`duplicate runtime bundle platform: ${key}`);
    seen.add(key);
    if (!bundle.platform.trim() || !bundle.architecture.trim()) {
      throw new Error('runtime bundle platform and architecture are required');
    }
    assertSha256(bundle.archiveDigest, `archive digest for ${key}`);
    assertSha256(bundle.bundleId, `runtime bundle ID for ${key}`);
    if (bundle.manifest.platform !== bundle.platform || bundle.manifest.architecture !== bundle.architecture) {
      throw new Error(`runtime bundle platform identity mismatch for ${key}`);
    }
    if (bundle.manifest.bundleId !== bundle.bundleId) {
      throw new Error(`runtime bundle ID mismatch for ${key}`);
    }
    if (bundle.manifest.version !== input.approvedVersion) {
      throw new Error(`runtime bundle version mismatch for ${key}`);
    }
    if (bundle.manifest.releaseFingerprint !== input.releaseFingerprint) {
      throw new Error(`runtime bundle release fingerprint mismatch for ${key}`);
    }
    if (bundle.manifest.sourceCommit !== input.sourceCommit) {
      throw new Error(`runtime bundle source commit mismatch for ${key}`);
    }
    if (bundle.github.digest !== bundle.archiveDigest) {
      throw new Error(`GitHub digest does not match built archive digest for ${key}`);
    }
    if (bundle.cloudflare.digest !== bundle.archiveDigest) {
      throw new Error(`Cloudflare digest does not match built archive digest for ${key}`);
    }
    if (!bundle.github.assetName.trim() || !bundle.cloudflare.objectKey.trim()) {
      throw new Error(`publication location is missing for ${key}`);
    }
    if (
      bundle.signature.algorithm !== 'ed25519' ||
      !bundle.signature.keyId.trim() ||
      !bundle.signature.signature.trim()
    ) {
      throw new Error(`detached runtime bundle signature is missing for ${key}`);
    }
    if (!verifyRuntimeBundleSignature(bundle, input.bundleSigningPublicKeys)) {
      throw new Error(`runtime bundle signature verification failed for ${key}`);
    }
  }
  for (const required of requiredPlatforms) {
    if (!seen.has(required)) throw new Error(`release is missing required platform ${required}`);
  }
}

function assertPublicationConsensus(state: ReleaseState, input: DevPublicationInput): void {
  parseSemver(input.approvedVersion, 'approved release version');
  assertSha256(input.bundleId, 'release-set bundle ID');
  assertSha256(input.releaseFingerprint, 'release fingerprint');
  if (!input.sourceCommit.trim()) throw new Error('source commit is required');
  if (input.channel !== 'dev') throw new Error('automatic publication may update only dev');
  assertEvidence(input.evidence);
  assertBundles(input);
  const calculatedBundleId = releaseSetIdForBundles(input.bundles);
  if (calculatedBundleId !== input.bundleId) {
    throw new Error('release-set bundle ID does not match platform bundle inventory');
  }

  const expectedTag = `${RELEASE_TAG_PREFIX}${input.approvedVersion}`;
  if (
    input.githubRelease.tag !== expectedTag ||
    input.githubRelease.version !== input.approvedVersion ||
    input.githubRelease.releaseFingerprint !== input.releaseFingerprint ||
    input.githubRelease.sourceCommit !== input.sourceCommit
  ) {
    throw new Error('GitHub Release identity does not match approved release');
  }
  if (
    input.githubDeployment.environment !== 'consuelo-os-dev' ||
    input.githubDeployment.version !== input.approvedVersion ||
    input.githubDeployment.releaseFingerprint !== input.releaseFingerprint ||
    input.githubDeployment.sourceCommit !== input.sourceCommit
  ) {
    throw new Error('GitHub Deployment identity does not match approved release');
  }

  const allocation = state.allocations[allocationKey(input.sourceCommit, input.releaseFingerprint)];
  if (allocation && allocation !== input.approvedVersion) {
    throw new Error('source and release fingerprint already allocated a different version');
  }

  const currentTags = Object.keys(state.tags);
  const expectedVersion = calculateNextReleaseVersion({
    immutableTags: currentTags,
    intent: input.releaseIntent,
    ...(currentTags.length === 0 ? { seedVersion: input.approvedVersion } : {}),
  });
  if (!allocation && expectedVersion !== input.approvedVersion) {
    throw new Error(`approved release version must be ${expectedVersion}`);
  }

  const existingTagBundle = state.tags[expectedTag];
  if (existingTagBundle && existingTagBundle !== input.bundleId) {
    throw new Error(`immutable tag ${expectedTag} already references another release`);
  }
}

function channelManifestDigest(manifest: SignedChannelManifest): string {
  return sha256(canonicalReleaseJson(manifest));
}

function appendHistory(state: ReleaseState, channel: ReleaseChannel, bundleId: string): void {
  const history = state.channelHistory[channel];
  if (history.at(-1) !== bundleId) history.push(bundleId);
}

export function publishDevRelease(
  state: ReleaseState,
  input: DevPublicationInput,
  options: {
    now: string;
    signer: ChannelSigner;
  },
): ReleaseMutationResult {
  assertExpectedRevision(state, input.expectedRevision);
  const existing = state.releases[input.bundleId];
  const currentDev = state.channels.dev?.payload;
  if (existing && currentDev?.bundleId === input.bundleId) {
    if (
      existing.version !== input.approvedVersion ||
      existing.releaseFingerprint !== input.releaseFingerprint ||
      existing.sourceCommit !== input.sourceCommit
    ) {
      throw new Error('immutable release identity conflicts with retry input');
    }
    return { changed: false, idempotent: true, operations: [], state };
  }
  if (currentDev?.releaseFingerprint === input.releaseFingerprint) {
    return { changed: false, idempotent: true, operations: [], state };
  }

  const requestedSchemaVersion = input.channelSchemaVersion ?? state.channelSchemaVersion;
  if (requestedSchemaVersion !== state.channelSchemaVersion) {
    const migration = input.formatMigration;
    if (
      !migration ||
      migration.from !== state.channelSchemaVersion ||
      migration.to !== requestedSchemaVersion ||
      !migration.reference.trim()
    ) {
      throw new Error('channel schema version changes require an explicit format migration decision');
    }
  }
  assertPublicationConsensus(state, input);

  const next = cloneState(state);
  next.revision += 1;
  next.channelSchemaVersion = requestedSchemaVersion;
  const artifacts = Object.fromEntries(input.bundles.flatMap((bundle) => {
    if (!bundle.archivePath || !bundle.signaturePath) return [];
    return [[bundle.bundleId, {
      archivePath: bundle.archivePath,
      signaturePath: bundle.signaturePath,
    }]];
  }));
  const durableBundles = input.bundles.map(({ archivePath: _archivePath, signaturePath: _signaturePath, ...bundle }) => bundle);
  const release: ReleaseRecord = {
    bundleId: input.bundleId,
    bundles: structuredClone(durableBundles),
    createdAt: options.now,
    evidence: structuredClone(input.evidence),
    immutableTag: input.githubRelease.tag,
    releaseFingerprint: input.releaseFingerprint,
    sourceCommit: input.sourceCommit,
    version: input.approvedVersion,
  };
  next.releases[input.bundleId] = release;
  next.allocations[allocationKey(input.sourceCommit, input.releaseFingerprint)] = input.approvedVersion;
  next.tags[input.githubRelease.tag] = input.bundleId;
  next.githubReleases[input.githubRelease.tag] = {
    bundleId: input.bundleId,
    prerelease: input.githubRelease.prerelease,
    releaseFingerprint: input.releaseFingerprint,
    sourceCommit: input.sourceCommit,
    tag: input.githubRelease.tag,
    version: input.approvedVersion,
  };
  for (const bundle of input.bundles) {
    next.cloudflareObjects[bundle.cloudflare.objectKey] = bundle.archiveDigest;
  }
  next.deployments.push({
    bundleId: input.bundleId,
    createdAt: options.now,
    environment: input.githubDeployment.environment,
    releaseFingerprint: input.releaseFingerprint,
    sourceCommit: input.sourceCommit,
    version: input.approvedVersion,
  });
  const manifest = signedManifest(
    release,
    'dev',
    null,
    next.revision,
    options.now,
    options.signer,
    requestedSchemaVersion,
  );
  next.channels.dev = manifest;
  next.cloudflareObjects['channels/dev.json'] = channelManifestDigest(manifest);
  appendHistory(next, 'dev', input.bundleId);
  next.audit.push({
    action: 'publish',
    bundleId: input.bundleId,
    channel: 'dev',
    occurredAt: options.now,
    revision: next.revision,
    version: input.approvedVersion,
  });

  const operations: ReleaseOperation[] = [
    { kind: 'create-immutable-tag', bundleId: input.bundleId, tag: input.githubRelease.tag },
    {
      kind: 'create-github-release',
      bundleId: input.bundleId,
      prerelease: input.githubRelease.prerelease,
      tag: input.githubRelease.tag,
    },
    ...input.bundles.flatMap<ReleaseOperation>((bundle) => [
      {
        kind: 'upload-github-asset',
        assetName: bundle.github.assetName,
        bundleId: bundle.bundleId,
        digest: bundle.archiveDigest,
      },
      {
        kind: 'put-cloudflare-object',
        bundleId: bundle.bundleId,
        digest: bundle.archiveDigest,
        objectKey: bundle.cloudflare.objectKey,
      },
    ]),
    {
      kind: 'create-github-deployment',
      bundleId: input.bundleId,
      environment: 'consuelo-os-dev',
    },
    {
      kind: 'put-channel-manifest',
      bundleId: input.bundleId,
      channel: 'dev',
      digest: channelManifestDigest(manifest),
    },
  ];

  verifyReleaseStateConsensus(next, input.bundleId);
  return { artifacts, changed: true, idempotent: false, manifest, operations, state: next };
}

export function promoteReleaseChannel(
  state: ReleaseState,
  input: PromotionInput,
  options: {
    now: string;
    publicKeys?: Record<string, string>;
    signer: ChannelSigner;
  },
): ReleaseMutationResult {
  assertChannel(input.from);
  assertChannel(input.to);
  assertExpectedRevision(state, input.expectedRevision);
  if (LEGAL_TRANSITIONS[input.from] !== input.to) {
    throw new Error(`illegal channel transition: ${input.from} -> ${input.to}`);
  }
  const existingTarget = state.channels[input.to]?.payload;
  if (existingTarget?.bundleId === input.bundleId) {
    return { changed: false, idempotent: true, operations: [], state };
  }
  assertStableApproval(input.to, input.approval);
  const sourceManifest = state.channels[input.from];
  const source = sourceManifest?.payload;
  if (!sourceManifest || !source) throw new Error(`source channel ${input.from} does not exist`);
  const sourcePublicKeys = {
    ...(options.publicKeys ?? {}),
    [options.signer.keyId]: options.signer.publicKeyPem,
  };
  if (!verifySignedChannelManifest(sourceManifest, sourcePublicKeys)) {
    throw new Error(`source channel ${input.from} signature verification failed`);
  }
  if (source.bundleId !== input.bundleId) {
    throw new Error(`source channel ${input.from} does not reference requested bundle`);
  }
  const release = state.releases[input.bundleId];
  if (!release) throw new Error('verified immutable release does not exist');
  verifyReleaseStateConsensus(state, input.bundleId);

  const next = cloneState(state);
  next.revision += 1;
  const manifest = signedManifest(
    release,
    input.to,
    input.from,
    next.revision,
    options.now,
    options.signer,
    next.channelSchemaVersion,
  );
  next.channels[input.to] = manifest;
  next.cloudflareObjects[`channels/${input.to}.json`] = channelManifestDigest(manifest);
  appendHistory(next, input.to, input.bundleId);
  if (input.to !== 'dev') next.branchRefs[input.to] = release.sourceCommit;
  next.githubReleases[release.immutableTag] = {
    ...next.githubReleases[release.immutableTag],
    prerelease: input.to !== 'stable',
  };
  next.deployments.push({
    bundleId: input.bundleId,
    createdAt: options.now,
    environment: `consuelo-os-${input.to}`,
    releaseFingerprint: release.releaseFingerprint,
    sourceCommit: release.sourceCommit,
    version: release.version,
  });
  next.audit.push({
    action: 'promote',
    ...(input.approval?.actor ? { actor: input.approval.actor } : {}),
    bundleId: input.bundleId,
    channel: input.to,
    fromChannel: input.from,
    occurredAt: options.now,
    revision: next.revision,
    version: release.version,
  });

  const operations: ReleaseOperation[] = [
    {
      kind: 'update-protected-channel-ref',
      channel: input.to as Exclude<ReleaseChannel, 'dev'>,
      sourceCommit: release.sourceCommit,
    },
    {
      kind: 'update-github-release',
      prerelease: input.to !== 'stable',
      tag: release.immutableTag,
    },
    {
      kind: 'create-github-deployment',
      bundleId: input.bundleId,
      environment: `consuelo-os-${input.to}`,
    },
    {
      kind: 'put-channel-manifest',
      bundleId: input.bundleId,
      channel: input.to,
      digest: channelManifestDigest(manifest),
    },
  ];

  verifyReleaseStateConsensus(next, input.bundleId);
  return { changed: true, idempotent: false, manifest, operations, state: next };
}

export function rollbackReleaseChannel(
  state: ReleaseState,
  input: RollbackInput,
  options: {
    now: string;
    publicKeys?: Record<string, string>;
    signer: ChannelSigner;
  },
): ReleaseMutationResult {
  assertChannel(input.channel);
  assertExpectedRevision(state, input.expectedRevision);
  assertStableApproval(input.channel, input.approval);
  const currentManifest = state.channels[input.channel];
  const current = currentManifest?.payload;
  if (currentManifest) {
    const currentPublicKeys = {
      ...(options.publicKeys ?? {}),
      [options.signer.keyId]: options.signer.publicKeyPem,
    };
    if (!verifySignedChannelManifest(currentManifest, currentPublicKeys)) {
      throw new Error(`source channel ${input.channel} signature verification failed`);
    }
  }
  if (current?.bundleId === input.bundleId) {
    return { changed: false, idempotent: true, operations: [], state };
  }
  const release = state.releases[input.bundleId];
  if (!release || !state.channelHistory[input.channel].includes(input.bundleId)) {
    throw new Error('verified immutable release does not exist in channel history');
  }
  verifyReleaseStateConsensus(state, input.bundleId);

  const next = cloneState(state);
  next.revision += 1;
  const manifest = signedManifest(
    release,
    input.channel,
    input.channel,
    next.revision,
    options.now,
    options.signer,
    next.channelSchemaVersion,
  );
  next.channels[input.channel] = manifest;
  next.cloudflareObjects[`channels/${input.channel}.json`] = channelManifestDigest(manifest);
  appendHistory(next, input.channel, input.bundleId);
  if (input.channel !== 'dev') next.branchRefs[input.channel] = release.sourceCommit;
  next.deployments.push({
    bundleId: input.bundleId,
    createdAt: options.now,
    environment: `consuelo-os-${input.channel}`,
    releaseFingerprint: release.releaseFingerprint,
    sourceCommit: release.sourceCommit,
    version: release.version,
  });
  next.audit.push({
    action: 'rollback',
    ...(input.approval?.actor ? { actor: input.approval.actor } : {}),
    bundleId: input.bundleId,
    channel: input.channel,
    occurredAt: options.now,
    revision: next.revision,
    version: release.version,
  });
  const operations: ReleaseOperation[] = [
    ...(input.channel === 'dev' ? [] : [{
      kind: 'update-protected-channel-ref' as const,
      channel: input.channel as Exclude<ReleaseChannel, 'dev'>,
      sourceCommit: release.sourceCommit,
    }]),
    {
      kind: 'create-github-deployment',
      bundleId: input.bundleId,
      environment: `consuelo-os-${input.channel}`,
    },
    {
      kind: 'put-channel-manifest',
      bundleId: input.bundleId,
      channel: input.channel,
      digest: channelManifestDigest(manifest),
    },
  ];

  verifyReleaseStateConsensus(next, input.bundleId);
  return { changed: true, idempotent: false, manifest, operations, state: next };
}

export function verifyReleaseStateConsensus(state: ReleaseState, bundleId: string): void {
  const release = state.releases[bundleId];
  if (!release) throw new Error('verified immutable release does not exist');
  if (state.tags[release.immutableTag] !== bundleId) {
    throw new Error('immutable tag does not reference release bundle');
  }
  const githubRelease = state.githubReleases[release.immutableTag];
  if (
    !githubRelease ||
    githubRelease.bundleId !== bundleId ||
    githubRelease.version !== release.version ||
    githubRelease.releaseFingerprint !== release.releaseFingerprint ||
    githubRelease.sourceCommit !== release.sourceCommit
  ) {
    throw new Error('GitHub Release disagrees with immutable release identity');
  }
  for (const bundle of release.bundles) {
    const key = platformKey(bundle);
    if (bundle.manifest.version !== release.version) {
      throw new Error(`runtime bundle version mismatch for ${key}`);
    }
    if (bundle.manifest.releaseFingerprint !== release.releaseFingerprint) {
      throw new Error(`runtime bundle release fingerprint mismatch for ${key}`);
    }
    if (bundle.manifest.sourceCommit !== release.sourceCommit) {
      throw new Error(`runtime bundle source commit mismatch for ${key}`);
    }
    if (state.cloudflareObjects[bundle.cloudflare.objectKey] !== bundle.archiveDigest) {
      throw new Error(`Cloudflare object disagrees with immutable archive digest for ${key}`);
    }
    if (bundle.github.digest !== bundle.archiveDigest) {
      throw new Error(`GitHub asset disagrees with immutable archive digest for ${key}`);
    }
  }
  for (const [channel, signed] of Object.entries(state.channels) as Array<[
    ReleaseChannel,
    SignedChannelManifest,
  ]>) {
    if (signed.payload.bundleId !== bundleId) continue;
    if (
      signed.payload.version !== release.version ||
      signed.payload.releaseFingerprint !== release.releaseFingerprint ||
      signed.payload.sourceCommit !== release.sourceCommit ||
      canonicalReleaseJson(signed.payload.platforms) !== canonicalReleaseJson(channelPlatforms(release))
    ) {
      throw new Error(`channel ${channel} disagrees with immutable release identity`);
    }
    if (state.cloudflareObjects[`channels/${channel}.json`] !== channelManifestDigest(signed)) {
      throw new Error(`Cloudflare channel manifest digest mismatch for ${channel}`);
    }
    if (channel !== 'dev' && state.branchRefs[channel] !== release.sourceCommit) {
      throw new Error(`protected channel ref disagrees with source commit for ${channel}`);
    }
  }
  const deployments = state.deployments.filter((deployment) => deployment.bundleId === bundleId);
  if (deployments.length === 0) throw new Error('GitHub Deployment evidence is missing');
  for (const deployment of deployments) {
    if (
      deployment.version !== release.version ||
      deployment.releaseFingerprint !== release.releaseFingerprint ||
      deployment.sourceCommit !== release.sourceCommit
    ) {
      throw new Error('GitHub Deployment disagrees with immutable release identity');
    }
  }
}

export function inspectReleaseChannel(
  state: ReleaseState,
  channel: ReleaseChannel,
  options: {
    publicKeys: Record<string, string>;
  },
): {
  manifest: SignedChannelManifest;
  release: ReleaseRecord;
} {
  assertChannel(channel);
  const manifest = state.channels[channel];
  if (!manifest) throw new Error(`release channel ${channel} does not exist`);
  if (!verifySignedChannelManifest(manifest, options.publicKeys)) {
    throw new Error(`release channel ${channel} signature verification failed`);
  }
  verifyReleaseStateConsensus(state, manifest.payload.bundleId);
  return {
    manifest,
    release: state.releases[manifest.payload.bundleId],
  };
}

const SECRET_KEY_PATTERN = /(authorization|credential|password|private.?key|secret|token)/i;
const BEARER_PATTERN = /\bBearer\s+[A-Za-z0-9._~+/=-]+/gi;

export function redactReleaseAuditValue<T>(value: T, key = ''): T {
  if (SECRET_KEY_PATTERN.test(key)) return '[REDACTED]' as T;
  if (Array.isArray(value)) {
    return value.map((item) => redactReleaseAuditValue(item)) as T;
  }
  if (value && typeof value === 'object') {
    const output: Record<string, unknown> = {};
    for (const [childKey, childValue] of Object.entries(value as Record<string, unknown>)) {
      output[childKey] = redactReleaseAuditValue(childValue, childKey);
    }
    return output as T;
  }
  if (typeof value === 'string') {
    return value.replaceAll(BEARER_PATTERN, 'Bearer [REDACTED]') as T;
  }
  return value;
}
