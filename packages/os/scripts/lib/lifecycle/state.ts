import { createHash } from 'node:crypto';
import {
  existsSync,
  lstatSync,
  readFileSync,
  readlinkSync,
  readdirSync,
  statSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';

import type { RuntimeBundleManifest } from '../distribution/runtime-bundle';
import { isPathWithin, resolveLifecyclePaths } from './paths';
import type { LifecycleInstallState } from './types';

function sha256(bytes: Uint8Array): string {
  return `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
}

export function verifyInstalledRuntimeRelease(releasePath: string): RuntimeBundleManifest {
  const manifestPath = join(releasePath, 'runtime-bundle.manifest.json');
  if (!existsSync(manifestPath)) throw new Error('runtime release manifest is missing');
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as RuntimeBundleManifest;
  if (manifest.kind !== 'consuelo-runtime-bundle' || manifest.schemaVersion !== 1) {
    throw new Error('runtime release manifest is invalid');
  }
  for (const file of manifest.files) {
    const absolutePath = resolve(releasePath, file.path);
    if (!isPathWithin(releasePath, absolutePath) || !existsSync(absolutePath)) {
      throw new Error(`runtime release is missing ${file.path}`);
    }
    const stat = statSync(absolutePath);
    if (!stat.isFile()) throw new Error(`runtime release entry is not a file: ${file.path}`);
    const bytes = readFileSync(absolutePath);
    if (bytes.byteLength !== file.size || sha256(bytes) !== file.digest) {
      throw new Error(`runtime release digest mismatch for ${file.path}`);
    }
    if ((stat.mode & 0o777) !== file.mode) {
      throw new Error(`runtime release mode mismatch for ${file.path}`);
    }
  }
  return manifest;
}

function currentRelease(paths: ReturnType<typeof resolveLifecyclePaths>): {
  releasePath: string;
  manifest: RuntimeBundleManifest;
} {
  const stat = lstatSync(paths.currentLink);
  if (!stat.isSymbolicLink()) throw new Error('runtime/current must be a symbolic link');
  const target = readlinkSync(paths.currentLink);
  const releasePath = resolve(dirname(paths.currentLink), target);
  if (!isPathWithin(paths.releasesDir, releasePath) || releasePath === resolve(paths.releasesDir)) {
    throw new Error('runtime/current points outside runtime/releases');
  }
  if (!existsSync(releasePath) || !statSync(releasePath).isDirectory()) {
    throw new Error('runtime/current points to a missing release');
  }
  return { releasePath, manifest: verifyInstalledRuntimeRelease(releasePath) };
}

export async function inspectLifecycleInstallState(home?: string): Promise<LifecycleInstallState> {
  const paths = resolveLifecyclePaths(home);
  const homeEntries = existsSync(paths.home) ? readdirSync(paths.home) : [];
  const hasConfig = existsSync(paths.configPath);
  const hasNode = existsSync(join(paths.home, 'node', 'node.yaml'));

  if (!hasConfig && existsSync(paths.legacyHome)) {
    return {
      kind: 'legacy',
      home: paths.home,
      onboardingRequired: false,
      reason: 'legacy ~/.consuelo/os install detected',
    };
  }
  if (!hasConfig && homeEntries.length === 0) {
    return { kind: 'no-install', home: paths.home, onboardingRequired: true };
  }
  if (!existsSync(paths.currentLink) && !lstatExists(paths.currentLink)) {
    return {
      kind: hasConfig || hasNode ? 'partial' : 'no-install',
      home: paths.home,
      onboardingRequired: !hasConfig && !hasNode,
      reason: 'runtime/current is not activated',
    };
  }

  try {
    const current = currentRelease(paths);
    return {
      kind: 'valid',
      home: paths.home,
      onboardingRequired: false,
      currentBundleId: current.manifest.bundleId,
      currentVersion: current.manifest.version,
      currentReleasePath: current.releasePath,
      manifest: current.manifest,
    };
  } catch (error: unknown) {
    return {
      kind: 'corrupt',
      home: paths.home,
      onboardingRequired: !hasConfig && !hasNode,
      reason: error instanceof Error ? error.message : String(error),
    };
  }
}

function lstatExists(path: string): boolean {
  try {
    lstatSync(path);
    return true;
  } catch {
    return false;
  }
}

type ParsedSemver = {
  major: bigint;
  minor: bigint;
  patch: bigint;
  prerelease: string[];
};

function parseSemver(version: string): ParsedSemver {
  const withoutBuild = version.split('+', 1)[0];
  const [core, prerelease = ''] = withoutBuild.split('-', 2);
  const [major, minor, patch] = core.split('.');
  return {
    major: BigInt(major),
    minor: BigInt(minor),
    patch: BigInt(patch),
    prerelease: prerelease ? prerelease.split('.') : [],
  };
}

function comparePrerelease(left: string[], right: string[]): number {
  if (left.length === 0 && right.length === 0) return 0;
  if (left.length === 0) return 1;
  if (right.length === 0) return -1;
  const count = Math.max(left.length, right.length);
  for (let index = 0; index < count; index += 1) {
    const leftPart = left[index];
    const rightPart = right[index];
    if (leftPart === undefined) return -1;
    if (rightPart === undefined) return 1;
    if (leftPart === rightPart) continue;
    const leftNumeric = /^\d+$/.test(leftPart);
    const rightNumeric = /^\d+$/.test(rightPart);
    if (leftNumeric && rightNumeric) {
      const leftValue = BigInt(leftPart);
      const rightValue = BigInt(rightPart);
      return leftValue < rightValue ? -1 : 1;
    }
    if (leftNumeric !== rightNumeric) return leftNumeric ? -1 : 1;
    return leftPart < rightPart ? -1 : 1;
  }
  return 0;
}

function compareSemver(leftVersion: string, rightVersion: string): number {
  const left = parseSemver(leftVersion);
  const right = parseSemver(rightVersion);
  for (const key of ['major', 'minor', 'patch'] as const) {
    if (left[key] !== right[key]) return left[key] < right[key] ? -1 : 1;
  }
  return comparePrerelease(left.prerelease, right.prerelease);
}

export function listVerifiedRetainedReleases(home?: string): Array<{
  path: string;
  manifest: RuntimeBundleManifest;
}> {
  const paths = resolveLifecyclePaths(home);
  if (!existsSync(paths.releasesDir)) return [];
  const releases: Array<{ path: string; manifest: RuntimeBundleManifest }> = [];
  for (const entry of readdirSync(paths.releasesDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const releasePath = join(paths.releasesDir, entry.name);
    try {
      releases.push({ path: releasePath, manifest: verifyInstalledRuntimeRelease(releasePath) });
    } catch {
      // Corrupt retained releases are ignored; repair never activates unverified bytes.
    }
  }
  return releases.sort((left, right) => compareSemver(right.manifest.version, left.manifest.version));
}
