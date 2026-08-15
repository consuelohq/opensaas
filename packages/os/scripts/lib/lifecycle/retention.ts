import {
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readlinkSync,
  readdirSync,
  renameSync,
  rmSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { basename, dirname, join, relative, resolve } from 'node:path';

import type { RuntimeBundleManifest } from '../distribution/runtime-bundle';
import { lifecycleError } from './errors';
import { isPathWithin, resolveLifecyclePaths } from './paths';
import { createRuntimeDirectoryLink } from './runtime-links';
import { runtimeBundleIdFromDirectoryName } from './runtime-release-path';
import { verifyInstalledRuntimeRelease } from './state';

export type LifecycleActivationJournal = {
  schemaVersion: 1;
  operationId: string;
  previousReleasePath?: string;
  nextReleasePath: string;
};

type RetentionState = {
  schemaVersion: 1;
  pinnedBundleIds: string[];
  unresolvedContentBaseBundleIds: string[];
};

function releaseDirectoryMatchesBundleId(
  directoryName: string,
  bundleId: string,
): boolean {
  try {
    return runtimeBundleIdFromDirectoryName(directoryName) === bundleId;
  } catch {
    return false;
  }
}

export type LifecycleReleaseReference = {
  path: string;
  manifest: RuntimeBundleManifest;
};

function lstatExists(path: string): boolean {
  try {
    lstatSync(path);
    return true;
  } catch {
    return false;
  }
}

function writeJsonAtomically(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  const temporaryPath = `${path}.${process.pid}.${crypto.randomUUID()}.tmp`;
  try {
    writeFileSync(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, {
      mode: 0o600,
      flag: 'wx',
    });
    renameSync(temporaryPath, path);
  } finally {
    rmSync(temporaryPath, { force: true });
  }
}

function assertManagedReleasePath(
  home: string | undefined,
  releasePath: string,
): string {
  const paths = resolveLifecyclePaths(home);
  const resolvedPath = resolve(releasePath);
  if (
    !isPathWithin(paths.releasesDir, resolvedPath) ||
    resolvedPath === resolve(paths.releasesDir)
  ) {
    throw lifecycleError(
      'RETENTION_FAILED',
      'runtime release reference escapes runtime/releases',
    );
  }
  if (!existsSync(resolvedPath)) {
    throw lifecycleError(
      'RETENTION_FAILED',
      `runtime release is missing: ${basename(resolvedPath)}`,
    );
  }
  const rootStat = lstatSync(resolvedPath);
  if (rootStat.isSymbolicLink()) {
    throw lifecycleError(
      'RETENTION_FAILED',
      `runtime release root is a symbolic link: ${basename(resolvedPath)}`,
    );
  }
  if (!statSync(resolvedPath).isDirectory()) {
    throw lifecycleError(
      'RETENTION_FAILED',
      `runtime release is not a directory: ${basename(resolvedPath)}`,
    );
  }
  const manifest = verifyInstalledRuntimeRelease(resolvedPath);
  if (!releaseDirectoryMatchesBundleId(basename(resolvedPath), manifest.bundleId)) {
    throw lifecycleError(
      'RETENTION_FAILED',
      'runtime release directory does not match its verified bundle identity',
    );
  }
  return resolvedPath;
}

function replaceRuntimeLink(
  linkPath: string,
  releasePath: string,
  operationId: string,
): void {
  const paths = resolveLifecyclePaths(dirname(dirname(linkPath)));
  const resolvedReleasePath = assertManagedReleasePath(paths.home, releasePath);
  const temporaryLink = join(
    paths.runtimeDir,
    `.${basename(linkPath)}-${operationId}`,
  );
  rmSync(temporaryLink, { recursive: true, force: true });
  try {
    createRuntimeDirectoryLink({
      target: relative(paths.runtimeDir, resolvedReleasePath),
      linkPath: temporaryLink,
    });
    renameSync(temporaryLink, linkPath);
  } finally {
    rmSync(temporaryLink, { recursive: true, force: true });
  }
}

export function readLifecycleReleaseReference(
  home: string | undefined,
  name: 'current' | 'previous',
  options: { required?: boolean } = {},
): LifecycleReleaseReference | undefined {
  const paths = resolveLifecyclePaths(home);
  const linkPath = name === 'current' ? paths.currentLink : paths.previousLink;
  if (!lstatExists(linkPath)) {
    if (options.required) {
      throw lifecycleError(
        'RETENTION_FAILED',
        `runtime/${name} reference is missing`,
      );
    }
    return undefined;
  }
  const linkStat = lstatSync(linkPath);
  if (!linkStat.isSymbolicLink()) {
    throw lifecycleError(
      'RETENTION_FAILED',
      `runtime/${name} must be a symbolic link`,
    );
  }
  const releasePath = resolve(dirname(linkPath), readlinkSync(linkPath));
  try {
    const managedPath = assertManagedReleasePath(home, releasePath);
    return {
      path: managedPath,
      manifest: verifyInstalledRuntimeRelease(managedPath),
    };
  } catch (error: unknown) {
    const detail = error instanceof Error ? error.message : String(error);
    throw lifecycleError(
      'RETENTION_FAILED',
      `runtime/${name} reference is inconsistent: ${detail}`,
      {
        cause: error,
      },
    );
  }
}

export function writeLifecycleActivationJournal(input: {
  home?: string;
  operationId: string;
  previousReleasePath?: string;
  nextReleasePath: string;
}): void {
  const paths = resolveLifecyclePaths(input.home);
  const nextReleasePath = assertManagedReleasePath(
    paths.home,
    input.nextReleasePath,
  );
  const previousReleasePath = input.previousReleasePath
    ? assertManagedReleasePath(paths.home, input.previousReleasePath)
    : undefined;
  writeJsonAtomically(paths.activationJournalPath, {
    schemaVersion: 1,
    operationId: input.operationId,
    ...(previousReleasePath ? { previousReleasePath } : {}),
    nextReleasePath,
  } satisfies LifecycleActivationJournal);
}

export function clearLifecycleActivationJournal(home?: string): void {
  rmSync(resolveLifecyclePaths(home).activationJournalPath, { force: true });
}

export function readLifecycleActivationJournal(
  home?: string,
): LifecycleActivationJournal | undefined {
  const path = resolveLifecyclePaths(home).activationJournalPath;
  if (!existsSync(path)) return undefined;
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(path, 'utf8'));
  } catch (error: unknown) {
    throw lifecycleError('ROLLBACK_FAILED', 'activation journal is malformed', {
      cause: error,
    });
  }
  if (
    !parsed ||
    typeof parsed !== 'object' ||
    (parsed as LifecycleActivationJournal).schemaVersion !== 1 ||
    typeof (parsed as LifecycleActivationJournal).operationId !== 'string' ||
    typeof (parsed as LifecycleActivationJournal).nextReleasePath !== 'string' ||
    ((parsed as LifecycleActivationJournal).previousReleasePath !== undefined &&
      typeof (parsed as LifecycleActivationJournal).previousReleasePath !== 'string')
  ) {
    throw lifecycleError(
      'ROLLBACK_FAILED',
      'activation journal failed validation',
    );
  }
  return parsed as LifecycleActivationJournal;
}

export function recoverInterruptedLifecycleActivation(home?: string): {
  recovered: boolean;
  restoredBundleId?: string;
} {
  const paths = resolveLifecyclePaths(home);
  const journal = readLifecycleActivationJournal(paths.home);
  if (!journal) return { recovered: false };
  try {
    if (journal.previousReleasePath) {
      const previousPath = assertManagedReleasePath(
        paths.home,
        journal.previousReleasePath,
      );
      const manifest = verifyInstalledRuntimeRelease(previousPath);
      replaceRuntimeLink(
        paths.currentLink,
        previousPath,
        `${journal.operationId}-recover`,
      );
      const previous = readLifecycleReleaseReference(paths.home, 'previous');
      if (previous?.path === previousPath) unlinkSync(paths.previousLink);
      clearLifecycleActivationJournal(paths.home);
      return { recovered: true, restoredBundleId: manifest.bundleId };
    }
    if (lstatExists(paths.currentLink)) unlinkSync(paths.currentLink);
    clearLifecycleActivationJournal(paths.home);
    return { recovered: true };
  } catch (error: unknown) {
    throw lifecycleError(
      'ROLLBACK_FAILED',
      `failed to recover interrupted activation: ${error instanceof Error ? error.message : String(error)}`,
      { cause: error },
    );
  }
}

function validateBundleId(value: unknown, field: string): string {
  if (typeof value !== 'string' || !/^sha256:[a-f0-9]{64}$/.test(value)) {
    throw lifecycleError(
      'RETENTION_FAILED',
      `${field} contains an invalid bundle id`,
    );
  }
  return value;
}

export function writeLifecycleRetentionState(input: {
  home?: string;
  pinnedBundleIds: string[];
  unresolvedContentBaseBundleIds: string[];
}): void {
  const paths = resolveLifecyclePaths(input.home);
  const state: RetentionState = {
    schemaVersion: 1,
    pinnedBundleIds: [
      ...new Set(
        input.pinnedBundleIds.map((value) =>
          validateBundleId(value, 'pinnedBundleIds'),
        ),
      ),
    ],
    unresolvedContentBaseBundleIds: [
      ...new Set(
        input.unresolvedContentBaseBundleIds.map((value) =>
          validateBundleId(value, 'unresolvedContentBaseBundleIds'),
        ),
      ),
    ],
  };
  writeJsonAtomically(paths.retentionStatePath, state);
}

function readRetentionState(home?: string): RetentionState {
  const path = resolveLifecyclePaths(home).retentionStatePath;
  if (!existsSync(path)) {
    return {
      schemaVersion: 1,
      pinnedBundleIds: [],
      unresolvedContentBaseBundleIds: [],
    };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(path, 'utf8'));
  } catch (error: unknown) {
    throw lifecycleError('RETENTION_FAILED', 'retention state is malformed', {
      cause: error,
    });
  }
  if (
    !parsed ||
    typeof parsed !== 'object' ||
    (parsed as RetentionState).schemaVersion !== 1
  ) {
    throw lifecycleError(
      'RETENTION_FAILED',
      'retention state failed validation',
    );
  }
  const pinned = (parsed as RetentionState).pinnedBundleIds;
  const contentBases = (parsed as RetentionState)
    .unresolvedContentBaseBundleIds;
  if (!Array.isArray(pinned) || !Array.isArray(contentBases)) {
    throw lifecycleError(
      'RETENTION_FAILED',
      'retention state arrays are required',
    );
  }
  return {
    schemaVersion: 1,
    pinnedBundleIds: pinned.map((value) =>
      validateBundleId(value, 'pinnedBundleIds'),
    ),
    unresolvedContentBaseBundleIds: contentBases.map((value) =>
      validateBundleId(value, 'unresolvedContentBaseBundleIds'),
    ),
  };
}

function listStrictVerifiedReleases(
  home?: string,
): LifecycleReleaseReference[] {
  const paths = resolveLifecyclePaths(home);
  if (!existsSync(paths.releasesDir)) return [];
  const releases: LifecycleReleaseReference[] = [];
  for (const entry of readdirSync(paths.releasesDir, { withFileTypes: true })) {
    const releasePath = join(paths.releasesDir, entry.name);
    const stat = lstatSync(releasePath);
    if (stat.isSymbolicLink()) {
      throw lifecycleError(
        'RETENTION_FAILED',
        `runtime release entry is a symbolic link: ${entry.name}`,
      );
    }
    if (!stat.isDirectory()) {
      throw lifecycleError(
        'RETENTION_FAILED',
        `runtime release entry is not a directory: ${entry.name}`,
      );
    }
    const manifest = verifyInstalledRuntimeRelease(releasePath);
    if (!releaseDirectoryMatchesBundleId(entry.name, manifest.bundleId)) {
      throw lifecycleError(
        'RETENTION_FAILED',
        `runtime release identity mismatch: ${entry.name}`,
      );
    }
    releases.push({ path: releasePath, manifest });
  }
  return releases;
}

function pruneEphemeralDirectory(input: {
  root: string;
  nowMs: number;
  ttlMs: number;
  maxEntries: number;
  dryRun: boolean;
}): string[] {
  if (!existsSync(input.root)) return [];
  const entries = readdirSync(input.root)
    .map((name) => {
      const path = join(input.root, name);
      const stat = lstatSync(path);
      if (stat.isSymbolicLink()) {
        throw lifecycleError(
          'RETENTION_FAILED',
          `ephemeral lifecycle entry is a symbolic link: ${path}`,
        );
      }
      if (!stat.isDirectory()) {
        throw lifecycleError(
          'RETENTION_FAILED',
          `ephemeral lifecycle entry is not a directory: ${path}`,
        );
      }
      return { name, path, modifiedAt: stat.mtimeMs };
    })
    .sort((left, right) => right.modifiedAt - left.modifiedAt);
  const removals = entries.filter(
    (entry, index) =>
      input.nowMs - entry.modifiedAt > input.ttlMs || index >= input.maxEntries,
  );
  if (!input.dryRun) {
    for (const entry of removals)
      rmSync(entry.path, { recursive: true, force: true });
  }
  return removals.map((entry) => entry.path);
}

export function pruneLifecycleEphemeralDirectories(input: {
  home?: string;
  dryRun?: boolean;
  now?: Date;
  ttlMs?: number;
  maxEntries?: number;
}): string[] {
  const paths = resolveLifecyclePaths(input.home);
  const nowMs = (input.now ?? new Date()).getTime();
  const ttlMs = input.ttlMs ?? 24 * 60 * 60 * 1000;
  const maxEntries = input.maxEntries ?? 4;
  if (
    !Number.isFinite(ttlMs) ||
    ttlMs < 0 ||
    !Number.isInteger(maxEntries) ||
    maxEntries < 0
  ) {
    throw lifecycleError(
      'RETENTION_FAILED',
      'ephemeral retention limits are invalid',
    );
  }
  return [paths.stagingDir, paths.testHomesDir, paths.devSlotsDir].flatMap(
    (root) =>
      pruneEphemeralDirectory({
        root,
        nowMs,
        ttlMs,
        maxEntries,
        dryRun: input.dryRun ?? false,
      }),
  );
}

export function pruneLifecycleReleases(input: {
  home?: string;
  dryRun?: boolean;
  now?: Date;
  ephemeralTtlMs?: number;
  ephemeralMaxEntries?: number;
}): {
  retainedBundleIds: string[];
  removedBundleIds: string[];
  removedEphemeralPaths: string[];
} {
  const paths = resolveLifecyclePaths(input.home);
  const current = readLifecycleReleaseReference(paths.home, 'current');
  const previous = readLifecycleReleaseReference(paths.home, 'previous');
  const state = readRetentionState(paths.home);
  const releases = listStrictVerifiedReleases(paths.home);
  const byId = new Map(
    releases.map((release) => [release.manifest.bundleId, release]),
  );
  const protectedBundleIds = new Set([
    ...(current ? [current.manifest.bundleId] : []),
    ...(previous ? [previous.manifest.bundleId] : []),
    ...state.pinnedBundleIds,
    ...state.unresolvedContentBaseBundleIds,
  ]);
  for (const bundleId of protectedBundleIds) {
    if (!byId.has(bundleId)) {
      throw lifecycleError(
        'RETENTION_FAILED',
        `protected runtime release is missing: ${bundleId}`,
      );
    }
  }
  const removedBundleIds: string[] = [];
  for (const release of releases) {
    if (protectedBundleIds.has(release.manifest.bundleId)) continue;
    if (
      !isPathWithin(paths.releasesDir, release.path) ||
      release.path === resolve(paths.releasesDir)
    ) {
      throw lifecycleError(
        'RETENTION_FAILED',
        'refusing to remove release outside runtime/releases',
      );
    }
    if (!(input.dryRun ?? false))
      rmSync(release.path, { recursive: true, force: true });
    removedBundleIds.push(release.manifest.bundleId);
  }
  const removedEphemeralPaths = pruneLifecycleEphemeralDirectories({
    home: paths.home,
    dryRun: input.dryRun,
    now: input.now,
    ttlMs: input.ephemeralTtlMs,
    maxEntries: input.ephemeralMaxEntries,
  });
  return {
    retainedBundleIds: [...protectedBundleIds],
    removedBundleIds,
    removedEphemeralPaths,
  };
}
