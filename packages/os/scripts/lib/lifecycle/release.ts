import { createHash, createPublicKey, verify } from 'node:crypto';
import {
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
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
import {
  lifecycleReleaseChannels,
  type LifecycleReleaseChannel,
  type ReleaseManifestPayload,
  type ReleaseSource,
  type SignedReleaseManifest,
} from './types';

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
      rmSync(stagingPath, { recursive: true, force: true });
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
