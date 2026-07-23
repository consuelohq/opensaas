import { createHash, createPublicKey, verify } from 'node:crypto';
import {
  chmodSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';

import {
  inspectRuntimeBundleArchive,
  verifyRuntimeBundleArchive,
  type RuntimeBundleManifest,
} from '../distribution/runtime-bundle';
import { lifecycleError } from './errors';
import { isPathWithin, resolveLifecyclePaths } from './paths';
import { verifyInstalledRuntimeRelease } from './state';
import {
  lifecycleReleaseChannels,
  type LifecycleReleaseChannel,
  type ReleaseManifestPayload,
  type ReleaseSource,
  type SignedReleaseManifest,
} from './types';

export const CURRENT_LIFECYCLE_UPDATER_VERSION = '1.0.0';

function compareSemver(left: string, right: string): number {
  const parse = (value: string): [bigint, bigint, bigint, string[]] => {
    const buildIndex = value.indexOf('+');
    const withoutBuild = buildIndex >= 0 ? value.slice(0, buildIndex) : value;
    const prereleaseIndex = withoutBuild.indexOf('-');
    const core = prereleaseIndex >= 0 ? withoutBuild.slice(0, prereleaseIndex) : withoutBuild;
    const prerelease = prereleaseIndex >= 0 ? withoutBuild.slice(prereleaseIndex + 1) : '';
    const parts = core.split('.');
    if (parts.length !== 3 || parts.some((part) => !/^\d+$/.test(part))) {
      throw new Error(`invalid SemVer: ${value}`);
    }
    return [BigInt(parts[0]), BigInt(parts[1]), BigInt(parts[2]), prerelease ? prerelease.split('.') : []];
  };
  const [leftMajor, leftMinor, leftPatch, leftPre] = parse(left);
  const [rightMajor, rightMinor, rightPatch, rightPre] = parse(right);
  for (const [a, b] of [[leftMajor, rightMajor], [leftMinor, rightMinor], [leftPatch, rightPatch]] as const) {
    if (a !== b) return a < b ? -1 : 1;
  }
  if (leftPre.length === 0 || rightPre.length === 0) {
    if (leftPre.length === rightPre.length) return 0;
    return leftPre.length === 0 ? 1 : -1;
  }
  const count = Math.max(leftPre.length, rightPre.length);
  for (let index = 0; index < count; index += 1) {
    const a = leftPre[index];
    const b = rightPre[index];
    if (a === undefined) return -1;
    if (b === undefined) return 1;
    if (a === b) continue;
    const aNumeric = /^\d+$/.test(a);
    const bNumeric = /^\d+$/.test(b);
    if (aNumeric && bNumeric) return BigInt(a) < BigInt(b) ? -1 : 1;
    if (aNumeric !== bNumeric) return aNumeric ? -1 : 1;
    return a < b ? -1 : 1;
  }
  return 0;
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

export function canonicalReleaseManifestPayload(payload: ReleaseManifestPayload): string {
  return JSON.stringify(canonicalize(payload));
}

function assertReleaseManifestPayload(payload: ReleaseManifestPayload): void {
  if (payload.schemaVersion !== 1) {
    throw lifecycleError('MANIFEST_INVALID', `unsupported release manifest schema: ${String(payload.schemaVersion)}`);
  }
  if (!lifecycleReleaseChannels.includes(payload.channel)) {
    throw lifecycleError('MANIFEST_INVALID', `unsupported release channel: ${String(payload.channel)}`);
  }
  for (const [name, value] of Object.entries({
    version: payload.version,
    bundleId: payload.bundleId,
    bundleDigest: payload.bundleDigest,
    bundleUrl: payload.bundleUrl,
    releaseFingerprint: payload.releaseFingerprint,
    publishedAt: payload.publishedAt,
  })) {
    if (typeof value !== 'string' || value.trim().length === 0) {
      throw lifecycleError('MANIFEST_INVALID', `release manifest ${name} is required`);
    }
  }
  if (!payload.bundleDigest.startsWith('sha256:')) {
    throw lifecycleError('MANIFEST_INVALID', 'release manifest bundleDigest must use sha256');
  }
  if (!Number.isFinite(Date.parse(payload.publishedAt))) {
    throw lifecycleError('MANIFEST_INVALID', 'release manifest publishedAt must be an ISO timestamp');
  }
}

export function verifySignedReleaseManifest(
  manifest: SignedReleaseManifest,
  trustedKeys: Record<string, string>,
): ReleaseManifestPayload {
  assertReleaseManifestPayload(manifest.payload);
  if (manifest.signature?.algorithm !== 'ed25519') {
    throw lifecycleError('MANIFEST_SIGNATURE_INVALID', 'release manifest must use ed25519');
  }
  const publicKey = trustedKeys[manifest.signature.keyId];
  if (!publicKey) {
    throw lifecycleError(
      'MANIFEST_SIGNATURE_INVALID',
      `release manifest signing key is not trusted: ${manifest.signature.keyId}`,
    );
  }
  let accepted = false;
  try {
    accepted = verify(
      null,
      Buffer.from(canonicalReleaseManifestPayload(manifest.payload)),
      createPublicKey(publicKey),
      Buffer.from(manifest.signature.value, 'base64url'),
    );
  } catch (error: unknown) {
    throw lifecycleError('MANIFEST_SIGNATURE_INVALID', 'release manifest signature could not be verified', {
      cause: error,
    });
  }
  if (!accepted) {
    throw lifecycleError('MANIFEST_SIGNATURE_INVALID', 'release manifest signature is invalid');
  }
  return manifest.payload;
}

export function sha256Digest(bytes: Uint8Array): string {
  return `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
}

export function materializeRuntimeBundleDownload(input: {
  home?: string;
  operationId: string;
  bytes: Uint8Array;
}): string {
  const paths = resolveLifecyclePaths(input.home);
  const stagingPath = join(paths.stagingDir, input.operationId);
  const archivePath = join(stagingPath, 'runtime.tar.gz');
  try {
    rmSync(stagingPath, { recursive: true, force: true });
    mkdirSync(stagingPath, { recursive: true });
    writeFileSync(archivePath, input.bytes, { mode: 0o600 });
    return archivePath;
  } catch (error: unknown) {
    rmSync(stagingPath, { recursive: true, force: true });
    throw lifecycleError('STAGING_FAILED', 'failed to materialize runtime download in staging', {
      cause: error,
    });
  }
}

export function cleanupRuntimeBundleStaging(input: {
  home?: string;
  operationId: string;
}): void {
  const paths = resolveLifecyclePaths(input.home);
  rmSync(join(paths.stagingDir, input.operationId), { recursive: true, force: true });
}

export function verifyDownloadedRuntimeBundle(
  bytes: Uint8Array,
  release: ReleaseManifestPayload,
  target: {
    platform?: string;
    architecture?: string;
    updaterVersion?: string;
  } = {},
): RuntimeBundleManifest {
  if (sha256Digest(bytes) !== release.bundleDigest) {
    throw lifecycleError('BUNDLE_DIGEST_MISMATCH', 'downloaded runtime bundle digest does not match release manifest');
  }
  let manifest: RuntimeBundleManifest;
  try {
    manifest = verifyRuntimeBundleArchive(bytes);
  } catch (error: unknown) {
    throw lifecycleError('BUNDLE_VERIFY_FAILED', 'downloaded runtime bundle failed inventory verification', {
      cause: error,
    });
  }
  if (
    manifest.bundleId !== release.bundleId ||
    manifest.version !== release.version ||
    manifest.releaseFingerprint !== release.releaseFingerprint
  ) {
    throw lifecycleError('BUNDLE_VERIFY_FAILED', 'runtime bundle identity does not match signed release manifest');
  }
  const expectedPlatform = target.platform ?? process.platform;
  const expectedArchitecture = target.architecture ?? process.arch;
  const updaterVersion = target.updaterVersion
    ?? process.env.CONSUELO_LIFECYCLE_UPDATER_VERSION
    ?? CURRENT_LIFECYCLE_UPDATER_VERSION;
  if (manifest.platform !== expectedPlatform) {
    throw lifecycleError(
      'BUNDLE_VERIFY_FAILED',
      `runtime bundle platform ${manifest.platform} does not match ${expectedPlatform}`,
    );
  }
  if (manifest.architecture !== expectedArchitecture) {
    throw lifecycleError(
      'BUNDLE_VERIFY_FAILED',
      `runtime bundle architecture ${manifest.architecture} does not match ${expectedArchitecture}`,
    );
  }
  if (compareSemver(updaterVersion, manifest.minimumUpdaterVersion) < 0) {
    throw lifecycleError(
      'BUNDLE_VERIFY_FAILED',
      `runtime bundle requires updater ${manifest.minimumUpdaterVersion} but current updater is ${updaterVersion}`,
    );
  }
  return manifest;
}

export function stageVerifiedRuntimeBundle(input: {
  home?: string;
  operationId: string;
  archivePath: string;
  manifest: RuntimeBundleManifest;
}): { releasePath: string; stagingPath: string } {
  const paths = resolveLifecyclePaths(input.home);
  const stagingPath = join(paths.stagingDir, input.operationId);
  const stagedReleasePath = join(stagingPath, 'release');
  const releasePath = join(paths.releasesDir, input.manifest.bundleId);
  if (!isPathWithin(stagingPath, input.archivePath) || !existsSync(input.archivePath)) {
    throw lifecycleError('STAGING_FAILED', 'verified runtime archive is missing from managed staging');
  }
  rmSync(stagedReleasePath, { recursive: true, force: true });
  mkdirSync(stagedReleasePath, { recursive: true });

  try {
    const inspected = inspectRuntimeBundleArchive(readFileSync(input.archivePath));
    if (inspected.manifest.bundleId !== input.manifest.bundleId) {
      throw new Error('staged runtime manifest identity changed after verification');
    }
    for (const entry of inspected.entries) {
      const target = resolve(stagedReleasePath, entry.path);
      if (!isPathWithin(stagedReleasePath, target)) {
        throw new Error(`runtime bundle entry escapes staging: ${entry.path}`);
      }
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, entry.bytes, { mode: entry.mode });
      chmodSync(target, entry.mode);
    }
    mkdirSync(paths.releasesDir, { recursive: true });
    if (existsSync(releasePath)) {
      let existingMatches = false;
      try {
        const existing = verifyInstalledRuntimeRelease(releasePath);
        existingMatches =
          existing.bundleId === input.manifest.bundleId &&
          existing.version === input.manifest.version &&
          existing.releaseFingerprint === input.manifest.releaseFingerprint;
      } catch {
        // A corrupt or stale same-id release must be replaced by the verified stage.
      }

      if (existingMatches) {
        rmSync(stagingPath, { recursive: true, force: true });
      } else {
        const replacedReleasePath = join(stagingPath, 'replaced-release');
        rmSync(replacedReleasePath, { recursive: true, force: true });
        renameSync(releasePath, replacedReleasePath);
        try {
          renameSync(stagedReleasePath, releasePath);
        } catch (error: unknown) {
          if (!existsSync(releasePath) && existsSync(replacedReleasePath)) {
            renameSync(replacedReleasePath, releasePath);
          }
          throw error;
        }
        rmSync(replacedReleasePath, { recursive: true, force: true });
        rmSync(stagingPath, { recursive: true, force: true });
      }
    } else {
      renameSync(stagedReleasePath, releasePath);
      rmSync(stagingPath, { recursive: true, force: true });
    }
    return { releasePath, stagingPath };
  } catch (error: unknown) {
    rmSync(stagingPath, { recursive: true, force: true });
    throw lifecycleError('STAGING_FAILED', 'failed to stage verified runtime bundle', { cause: error });
  }
}

export function activateRuntimeRelease(input: {
  home?: string;
  releasePath: string;
  operationId: string;
  previousReleasePath?: string;
}): void {
  const paths = resolveLifecyclePaths(input.home);
  const resolvedRelease = resolve(input.releasePath);
  if (!isPathWithin(paths.releasesDir, resolvedRelease) || resolvedRelease === resolve(paths.releasesDir)) {
    throw lifecycleError('ACTIVATION_FAILED', 'runtime activation target must be inside runtime/releases');
  }
  if (!existsSync(resolvedRelease)) {
    throw lifecycleError('ACTIVATION_FAILED', 'runtime activation target does not exist');
  }
  mkdirSync(paths.runtimeDir, { recursive: true });
  if (existsSync(paths.currentLink)) {
    const currentStat = lstatSync(paths.currentLink);
    if (currentStat.isDirectory() && !currentStat.isSymbolicLink()) {
      if (readdirSync(paths.currentLink).length > 0) {
        throw lifecycleError(
          'ACTIVATION_FAILED',
          'runtime/current is a non-empty directory and cannot be replaced safely',
        );
      }
      rmSync(paths.currentLink, { recursive: true });
    }
  }
  if (input.previousReleasePath) {
    const resolvedPrevious = resolve(input.previousReleasePath);
    if (
      resolvedPrevious !== resolvedRelease
      && isPathWithin(paths.releasesDir, resolvedPrevious)
      && existsSync(resolvedPrevious)
    ) {
      const temporaryPreviousLink = join(paths.runtimeDir, `.previous-${input.operationId}`);
      rmSync(temporaryPreviousLink, { force: true, recursive: true });
      try {
        symlinkSync(relative(paths.runtimeDir, resolvedPrevious), temporaryPreviousLink, 'dir');
        renameSync(temporaryPreviousLink, paths.previousLink);
      } catch (error: unknown) {
        rmSync(temporaryPreviousLink, { force: true, recursive: true });
        throw lifecycleError('ACTIVATION_FAILED', 'failed to retain previous runtime release', {
          cause: error,
        });
      }
    }
  }
  const temporaryLink = join(paths.runtimeDir, `.current-${input.operationId}`);
  rmSync(temporaryLink, { force: true, recursive: true });
  const target = relative(paths.runtimeDir, resolvedRelease);
  try {
    symlinkSync(target, temporaryLink, 'dir');
    renameSync(temporaryLink, paths.currentLink);
  } catch (error: unknown) {
    rmSync(temporaryLink, { force: true, recursive: true });
    throw lifecycleError('ACTIVATION_FAILED', 'failed to atomically activate runtime release', {
      cause: error,
    });
  }
}

export function createHttpReleaseSource(input: {
  baseUrl: string;
  fetchImpl?: typeof fetch;
}): ReleaseSource {
  const fetchImpl = input.fetchImpl ?? fetch;
  const baseUrl = input.baseUrl.replace(/\/$/, '');
  return {
    async fetchManifest(channel: LifecycleReleaseChannel) {
      try {
        const response = await fetchImpl(`${baseUrl}/channels/${channel}.json`);
        if (!response.ok) {
          throw new Error(`release manifest request failed with HTTP ${response.status}`);
        }
        const manifest = (await response.json()) as SignedReleaseManifest;
        if (manifest.payload?.bundleUrl) {
          manifest.payload.bundleUrl = new URL(manifest.payload.bundleUrl, `${baseUrl}/`).toString();
        }
        return manifest;
      } catch (error: unknown) {
        throw new Error(
          `failed to fetch release manifest: ${error instanceof Error ? error.message : String(error)}`,
          { cause: error },
        );
      }
    },
    async fetchBundle(url: string) {
      try {
        const response = await fetchImpl(url);
        if (!response.ok) {
          throw new Error(`runtime bundle request failed with HTTP ${response.status}`);
        }
        return new Uint8Array(await response.arrayBuffer());
      } catch (error: unknown) {
        throw new Error(
          `failed to fetch runtime bundle: ${error instanceof Error ? error.message : String(error)}`,
          { cause: error },
        );
      }
    },
  };
}
