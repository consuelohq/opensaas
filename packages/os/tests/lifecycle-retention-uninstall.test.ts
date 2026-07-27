import { generateKeyPairSync, sign } from 'node:crypto';
import {
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readlinkSync,
  readdirSync,
  rmSync,
  symlinkSync,
  utimesSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { buildRuntimeBundle } from '../scripts/lib/distribution/runtime-bundle';
import {
  canonicalReleaseManifestPayload,
  createLifecycleEngine,
  createReloadServiceController,
  materializeRuntimeBundleDownload,
  pruneLifecycleEphemeralDirectories,
  pruneLifecycleReleases,
  recoverInterruptedLifecycleActivation,
  stageVerifiedRuntimeBundle,
  writeLifecycleActivationJournal,
  writeLifecycleRetentionState,
  type LifecycleEngine,
  type LifecycleProgressEvent,
  type ReleaseManifestPayload,
  type ReleaseSource,
  type SignedReleaseManifest,
} from '../scripts/lib/lifecycle';
import { runLifecycleCli } from '../scripts/lifecycle';

const osRoot = resolve(import.meta.dirname, '..');
const requiredRuntimePaths = [
  'package.json',
  'bun.lock',
  'scripts/os.ts',
  'scripts/native-lifecycle-operation.ts',
  'scripts/server/main.ts',
  'scripts/lib/install-state.ts',
  'scripts/managed-components.ts',
  'scripts/lib/managed-components.ts',
  'scripts/lib/managed-component-install.ts',
  'manifests/generated/tool.manifest.json',
  'manifests/generated/core.manifest.json',
  'hooks/dispatcher.js',
  'steering/system_prompt.md',
  'steering/decision.md',
  'streams/tools/AGENTS.md',
  'skills/task/SKILL.md',
  'skills/task/skill.json',
];

type BuiltBundle = Awaited<ReturnType<typeof buildRuntimeBundle>>;

let tempHome = '';
let outsideDir = '';
let releaseKeyId = 'worker-05-test-key';
let privateKey: ReturnType<typeof generateKeyPairSync>['privateKey'];
let publicKeyPem = '';
let bundle100: BuiltBundle;
let bundle110: BuiltBundle;
let bundle120: BuiltBundle;
let bundle130: BuiltBundle;

beforeAll(async () => {
  const pair = generateKeyPairSync('ed25519');
  privateKey = pair.privateKey;
  publicKeyPem = pair.publicKey.export({ type: 'spki', format: 'pem' }).toString();
  const build = (version: string, sourceCommit: string) => buildRuntimeBundle({
    architecture: process.arch,
    includePaths: requiredRuntimePaths,
    minimumUpdaterVersion: '1.0.0',
    platform: process.platform,
    sourceCommit,
    sourceRoot: osRoot,
    version,
  });
  [bundle100, bundle110, bundle120, bundle130] = await Promise.all([
    build('1.0.0', 'worker-05-100'),
    build('1.1.0', 'worker-05-110'),
    build('1.2.0', 'worker-05-120'),
    build('1.3.0', 'worker-05-130'),
  ]);
});

beforeEach(() => {
  tempHome = mkdtempSync(join(tmpdir(), 'consuelo-worker-05-'));
  outsideDir = mkdtempSync(join(tmpdir(), 'consuelo-worker-05-outside-'));
});

afterEach(() => {
  rmSync(tempHome, { recursive: true, force: true });
  rmSync(outsideDir, { recursive: true, force: true });
});

function signedManifest(bundle: BuiltBundle): SignedReleaseManifest {
  const payload: ReleaseManifestPayload = {
    schemaVersion: 1,
    channel: 'dev',
    version: bundle.manifest.version,
    bundleId: bundle.manifest.bundleId,
    bundleDigest: bundle.archiveDigest,
    bundleUrl: `memory://${bundle.manifest.bundleId}`,
    releaseFingerprint: bundle.manifest.releaseFingerprint,
    publishedAt: '2026-07-23T00:00:00.000Z',
  };
  return {
    payload,
    signature: {
      algorithm: 'ed25519',
      keyId: releaseKeyId,
      value: sign(null, Buffer.from(canonicalReleaseManifestPayload(payload)), privateKey)
        .toString('base64url'),
    },
  };
}

function sourceFor(bundle: BuiltBundle): ReleaseSource {
  return {
    async fetchManifest() {
      return signedManifest(bundle);
    },
    async fetchBundle() {
      return bundle.archiveBytes;
    },
  };
}

function writeInstalledIdentity(channel = 'dev'): void {
  mkdirSync(join(tempHome, 'node', 'security', 'generated'), { recursive: true });
  mkdirSync(join(tempHome, 'node', 'tunnels'), { recursive: true });
  mkdirSync(join(tempHome, 'node', 'caddy'), { recursive: true });
  mkdirSync(join(tempHome, 'node', 'cache'), { recursive: true });
  mkdirSync(join(tempHome, 'node', 'tmp'), { recursive: true });
  mkdirSync(join(tempHome, 'node', 'runs'), { recursive: true });
  mkdirSync(join(tempHome, 'node', 'logs'), { recursive: true });
  mkdirSync(join(tempHome, 'workspaces', 'workspace_test', 'shared'), { recursive: true });
  writeFileSync(join(tempHome, 'consuelo.yaml'), [
    'version: 1',
    'activeWorkspace: workspace_test',
    'activeNode: node_test',
    'runtime:',
    '  current: runtime/current',
    'updates:',
    `  channel: ${channel}`,
    '  notifications:',
    '    mode: on',
    '',
  ].join('\n'));
  writeFileSync(join(tempHome, 'node', 'node.yaml'), [
    'version: 1',
    'node:',
    '  id: node_test',
    '  name: Test Node',
    'capabilities: []',
    'workspaces: []',
    '',
  ].join('\n'));
  writeFileSync(
    join(tempHome, 'workspaces', 'workspace_test', 'shared', 'workspace.yaml'),
    'version: 1\nworkspace:\n  id: workspace_test\n  name: Test\ndefaults: {}\nprojects: []\nrouting: {}\npolicy: {}\nsites: {}\nagents: {}\n',
  );
  writeFileSync(join(tempHome, 'workspaces', 'workspace_test', 'visible-note.md'), 'keep me\n');
  writeFileSync(join(tempHome, 'node', 'security', 'generated', 'owned.plist'), 'generated\n');
  writeFileSync(join(tempHome, 'node', 'tunnels', 'state.json'), '{}\n');
  writeFileSync(join(tempHome, 'node', 'caddy', 'Caddyfile'), 'localhost\n');
  writeFileSync(join(tempHome, 'node', 'cache', 'cache.bin'), 'cache\n');
  writeFileSync(join(tempHome, 'node', 'tmp', 'tmp.bin'), 'tmp\n');
  writeFileSync(join(tempHome, 'node', 'runs', 'run.json'), '{}\n');
  writeFileSync(join(tempHome, 'node', 'logs', 'runtime.log'), 'log\n');
  writeFileSync(join(tempHome, 'provider-credentials.keep'), 'do not delete\n');
}

function createEngine(input: {
  bundle?: BuiltBundle;
  health?: boolean | boolean[];
  events?: LifecycleProgressEvent[];
} = {}): LifecycleEngine & {
  serviceOperations: string[];
  onboardingCalls: number;
} {
  const bundle = input.bundle ?? bundle100;
  const serviceOperations: string[] = [];
  let onboardingCalls = 0;
  let healthIndex = 0;
  const engine = createLifecycleEngine({
    home: tempHome,
    releaseSource: sourceFor(bundle),
    trustedReleaseKeys: { [releaseKeyId]: publicKeyPem },
    progress: (event) => input.events?.push(event),
    service: {
      async preflight() {
        serviceOperations.push('preflight');
      },
      async restart() {
        serviceOperations.push('restart');
      },
      async uninstall(options) {
        serviceOperations.push(`uninstall:${options?.dryRun ? 'dry-run' : 'apply'}`);
      },
    },
    health: {
      async accept() {
        serviceOperations.push('health');
        if (Array.isArray(input.health)) {
          const accepted = input.health[Math.min(healthIndex, input.health.length - 1)] ?? true;
          healthIndex += 1;
          return accepted;
        }
        return input.health ?? true;
      },
    },
    onboarding: async () => {
      onboardingCalls += 1;
      writeInstalledIdentity();
    },
  }) as LifecycleEngine & { serviceOperations: string[]; onboardingCalls: number };
  Object.defineProperties(engine, {
    serviceOperations: { get: () => serviceOperations },
    onboardingCalls: { get: () => onboardingCalls },
  });
  return engine;
}

function stageBundle(bundle: BuiltBundle, operationId: string): string {
  const archivePath = materializeRuntimeBundleDownload({
    home: tempHome,
    operationId,
    bytes: bundle.archiveBytes,
  });
  return stageVerifiedRuntimeBundle({
    home: tempHome,
    operationId,
    archivePath,
    manifest: bundle.manifest,
  }).releasePath;
}

function currentBundleId(): string {
  return readlinkSync(join(tempHome, 'runtime', 'current')).split('/').at(-1) ?? '';
}

function releaseNames(): string[] {
  return readdirSync(join(tempHome, 'runtime', 'releases')).sort();
}

describe('lifecycle rollback and retention', () => {
  it('supports dry-run rollback and atomically swaps current and previous after acceptance', async () => {
    const initial = createEngine({ bundle: bundle100 });
    await initial.install({ channel: 'dev' });
    const update = createEngine({ bundle: bundle110 });
    await update.update({ channel: 'dev', yes: true });

    await expect(update.rollback({ dryRun: true })).resolves.toMatchObject({
      operation: 'rollback',
      changed: false,
      bundleId: bundle100.manifest.bundleId,
      detail: { dryRun: true },
    });
    expect(currentBundleId()).toBe(bundle110.manifest.bundleId);

    await expect(update.rollback()).resolves.toMatchObject({
      operation: 'rollback',
      changed: true,
      bundleId: bundle100.manifest.bundleId,
    });
    expect(currentBundleId()).toBe(bundle100.manifest.bundleId);
    expect(readlinkSync(join(tempHome, 'runtime', 'previous')))
      .toBe(`releases/${bundle110.manifest.bundleId}`);
    expect(update.serviceOperations.slice(-2)).toEqual(['restart', 'health']);
  });

  it('keeps an explicit rollback successful when post-commit retention fails', async () => {
    await createEngine({ bundle: bundle100 }).install({ channel: 'dev' });
    await createEngine({ bundle: bundle110 }).update({ channel: 'dev', yes: true });
    writeLifecycleRetentionState({
      home: tempHome,
      pinnedBundleIds: [bundle130.manifest.bundleId],
      unresolvedContentBaseBundleIds: [],
    });
    const events: LifecycleProgressEvent[] = [];
    const rollback = createEngine({ bundle: bundle110, events });

    await expect(rollback.rollback()).resolves.toMatchObject({
      operation: 'rollback',
      changed: true,
      bundleId: bundle100.manifest.bundleId,
    });

    expect(currentBundleId()).toBe(bundle100.manifest.bundleId);
    expect(existsSync(join(tempHome, 'runtime', 'activation.json'))).toBe(false);
    expect(events).toContainEqual(expect.objectContaining({
      phase: 'retention',
      detail: expect.objectContaining({ status: 'failed' }),
    }));
    expect(events.at(-1)?.phase).toBe('complete');
  });

  it('recovers an interrupted activation journal to the previous known-good release', async () => {
    writeInstalledIdentity();
    const previousPath = stageBundle(bundle100, 'stage-previous');
    const candidatePath = stageBundle(bundle110, 'stage-candidate');
    mkdirSync(join(tempHome, 'runtime'), { recursive: true });
    symlinkSync(`releases/${bundle110.manifest.bundleId}`, join(tempHome, 'runtime', 'current'));
    symlinkSync(`releases/${bundle100.manifest.bundleId}`, join(tempHome, 'runtime', 'previous'));
    writeLifecycleActivationJournal({
      home: tempHome,
      operationId: 'interrupted-update',
      previousReleasePath: previousPath,
      nextReleasePath: candidatePath,
    });

    const recovery = recoverInterruptedLifecycleActivation(tempHome);

    expect(recovery).toMatchObject({ recovered: true, restoredBundleId: bundle100.manifest.bundleId });
    expect(currentBundleId()).toBe(bundle100.manifest.bundleId);
    expect(existsSync(join(tempHome, 'runtime', 'activation.json'))).toBe(false);
  });

  it('recovers the previous known-good release when the failed candidate is missing', () => {
    writeInstalledIdentity();
    const previousPath = stageBundle(bundle100, 'stage-missing-candidate-previous');
    const candidatePath = stageBundle(bundle110, 'stage-missing-candidate');
    mkdirSync(join(tempHome, 'runtime'), { recursive: true });
    symlinkSync(`releases/${bundle110.manifest.bundleId}`, join(tempHome, 'runtime', 'current'));
    symlinkSync(`releases/${bundle100.manifest.bundleId}`, join(tempHome, 'runtime', 'previous'));
    writeLifecycleActivationJournal({
      home: tempHome,
      operationId: 'interrupted-missing-candidate',
      previousReleasePath: previousPath,
      nextReleasePath: candidatePath,
    });
    rmSync(candidatePath, { recursive: true, force: true });

    expect(recoverInterruptedLifecycleActivation(tempHome)).toMatchObject({
      recovered: true,
      restoredBundleId: bundle100.manifest.bundleId,
    });
    expect(currentBundleId()).toBe(bundle100.manifest.bundleId);
    expect(existsSync(join(tempHome, 'runtime', 'activation.json'))).toBe(false);
  });

  it('recovers the previous known-good release when the failed candidate is corrupt', () => {
    writeInstalledIdentity();
    const previousPath = stageBundle(bundle100, 'stage-corrupt-candidate-previous');
    const candidatePath = stageBundle(bundle110, 'stage-corrupt-candidate');
    mkdirSync(join(tempHome, 'runtime'), { recursive: true });
    symlinkSync(`releases/${bundle110.manifest.bundleId}`, join(tempHome, 'runtime', 'current'));
    symlinkSync(`releases/${bundle100.manifest.bundleId}`, join(tempHome, 'runtime', 'previous'));
    writeLifecycleActivationJournal({
      home: tempHome,
      operationId: 'interrupted-corrupt-candidate',
      previousReleasePath: previousPath,
      nextReleasePath: candidatePath,
    });
    writeFileSync(join(candidatePath, 'package.json'), '{"corrupt":true}\n');

    expect(recoverInterruptedLifecycleActivation(tempHome)).toMatchObject({
      recovered: true,
      restoredBundleId: bundle100.manifest.bundleId,
    });
    expect(currentBundleId()).toBe(bundle100.manifest.bundleId);
    expect(existsSync(join(tempHome, 'runtime', 'activation.json'))).toBe(false);
  });

  it('retains current, previous, pinned, and unresolved content-base releases only', async () => {
    writeInstalledIdentity();
    const paths = [bundle100, bundle110, bundle120, bundle130].map((bundle, index) =>
      stageBundle(bundle, `stage-${index}`));
    mkdirSync(join(tempHome, 'runtime'), { recursive: true });
    symlinkSync(`releases/${bundle130.manifest.bundleId}`, join(tempHome, 'runtime', 'current'));
    symlinkSync(`releases/${bundle120.manifest.bundleId}`, join(tempHome, 'runtime', 'previous'));
    writeLifecycleRetentionState({
      home: tempHome,
      pinnedBundleIds: [bundle100.manifest.bundleId],
      unresolvedContentBaseBundleIds: [bundle110.manifest.bundleId],
    });

    const result = pruneLifecycleReleases({ home: tempHome });

    expect(result.removedBundleIds).toEqual([]);
    expect(result.retainedBundleIds.sort()).toEqual([
      bundle100.manifest.bundleId,
      bundle110.manifest.bundleId,
      bundle120.manifest.bundleId,
      bundle130.manifest.bundleId,
    ].sort());
    expect(paths.every((path) => existsSync(path))).toBe(true);

    writeLifecycleRetentionState({
      home: tempHome,
      pinnedBundleIds: [],
      unresolvedContentBaseBundleIds: [],
    });
    const pruned = pruneLifecycleReleases({ home: tempHome });
    expect(pruned.removedBundleIds.sort()).toEqual([
      bundle100.manifest.bundleId,
      bundle110.manifest.bundleId,
    ].sort());
    expect(releaseNames().sort()).toEqual([
      bundle120.manifest.bundleId,
      bundle130.manifest.bundleId,
    ].sort());
  });

  it('refuses pruning when a runtime reference is inconsistent', () => {
    writeInstalledIdentity();
    stageBundle(bundle100, 'stage-current');
    mkdirSync(join(tempHome, 'runtime'), { recursive: true });
    symlinkSync('releases/missing-release', join(tempHome, 'runtime', 'current'));

    expect(() => pruneLifecycleReleases({ home: tempHome })).toThrow(/current.*missing/i);
    expect(releaseNames()).toContain(bundle100.manifest.bundleId);
  });

  it('never follows a malicious release symlink outside the managed release directory', () => {
    writeInstalledIdentity();
    const sentinel = join(outsideDir, 'sentinel.txt');
    writeFileSync(sentinel, 'outside\n');
    const releasesDir = join(tempHome, 'runtime', 'releases');
    mkdirSync(releasesDir, { recursive: true });
    symlinkSync(outsideDir, join(releasesDir, 'malicious-release'), 'dir');

    expect(() => pruneLifecycleReleases({ home: tempHome })).toThrow(/symbolic link/i);
    expect(readFileSync(sentinel, 'utf8')).toBe('outside\n');
    expect(lstatSync(join(releasesDir, 'malicious-release')).isSymbolicLink()).toBe(true);
  });

  it('removes a failed candidate after automatic rollback accepts the previous release', async () => {
    await createEngine({ bundle: bundle100 }).install({ channel: 'dev' });
    const events: LifecycleProgressEvent[] = [];
    const failedUpdate = createEngine({ bundle: bundle110, health: [false, true], events });

    await expect(failedUpdate.update({ channel: 'dev', yes: true }))
      .rejects.toMatchObject({ code: 'HEALTH_REJECTED' });

    expect(currentBundleId()).toBe(bundle100.manifest.bundleId);
    expect(releaseNames()).toEqual([bundle100.manifest.bundleId]);
    expect(events.some((event) => event.phase === 'rollback')).toBe(true);
    expect(existsSync(join(tempHome, 'runtime', 'activation.json'))).toBe(false);
  });

  it('keeps a committed update successful when post-activation retention fails', async () => {
    await createEngine({ bundle: bundle100 }).install({ channel: 'dev' });
    writeLifecycleRetentionState({
      home: tempHome,
      pinnedBundleIds: [bundle130.manifest.bundleId],
      unresolvedContentBaseBundleIds: [],
    });
    const events: LifecycleProgressEvent[] = [];
    const update = createEngine({ bundle: bundle110, events });

    await expect(update.update({ channel: 'dev', yes: true })).resolves.toMatchObject({
      operation: 'update',
      changed: true,
      bundleId: bundle110.manifest.bundleId,
    });

    expect(currentBundleId()).toBe(bundle110.manifest.bundleId);
    expect(existsSync(join(tempHome, 'runtime', 'activation.json'))).toBe(false);
    expect(events).toContainEqual(expect.objectContaining({
      phase: 'retention',
      detail: expect.objectContaining({ status: 'failed' }),
    }));
    expect(events.at(-1)?.phase).toBe('complete');
  });

  it('preserves the health rejection when retention fails after an accepted automatic rollback', async () => {
    await createEngine({ bundle: bundle100 }).install({ channel: 'dev' });
    writeLifecycleRetentionState({
      home: tempHome,
      pinnedBundleIds: [bundle130.manifest.bundleId],
      unresolvedContentBaseBundleIds: [],
    });
    const events: LifecycleProgressEvent[] = [];
    const failedUpdate = createEngine({ bundle: bundle110, health: [false, true], events });

    await expect(failedUpdate.update({ channel: 'dev', yes: true }))
      .rejects.toMatchObject({ code: 'HEALTH_REJECTED' });

    expect(currentBundleId()).toBe(bundle100.manifest.bundleId);
    expect(existsSync(join(tempHome, 'runtime', 'activation.json'))).toBe(false);
    expect(events).toContainEqual(expect.objectContaining({
      phase: 'retention',
      detail: expect.objectContaining({ status: 'failed', automatic: true }),
    }));
  });

  it('bounds staging, test-home, and dev-slot directories by TTL and count', () => {
    const roots = ['staging', 'test-homes', 'dev-slots'].map((name) =>
      join(tempHome, 'runtime', name));
    const now = new Date('2026-07-23T12:00:00.000Z');
    for (const root of roots) {
      mkdirSync(join(root, 'old'), { recursive: true });
      mkdirSync(join(root, 'middle'), { recursive: true });
      mkdirSync(join(root, 'new'), { recursive: true });
      utimesSync(join(root, 'old'), new Date('2026-07-20T12:00:00.000Z'), new Date('2026-07-20T12:00:00.000Z'));
      utimesSync(join(root, 'middle'), new Date('2026-07-23T10:00:00.000Z'), new Date('2026-07-23T10:00:00.000Z'));
      utimesSync(join(root, 'new'), new Date('2026-07-23T11:00:00.000Z'), new Date('2026-07-23T11:00:00.000Z'));
    }

    const removed = pruneLifecycleEphemeralDirectories({
      home: tempHome,
      now,
      ttlMs: 24 * 60 * 60 * 1000,
      maxEntries: 2,
    });

    expect(removed).toHaveLength(3);
    for (const root of roots) {
      expect(existsSync(join(root, 'old'))).toBe(false);
      expect(existsSync(join(root, 'middle'))).toBe(true);
      expect(existsSync(join(root, 'new'))).toBe(true);
    }
  });

  it('keeps repeated successful updates bounded to current and previous releases', async () => {
    await createEngine({ bundle: bundle100 }).install({ channel: 'dev' });
    await createEngine({ bundle: bundle110 }).update({ channel: 'dev', yes: true });
    await createEngine({ bundle: bundle120 }).update({ channel: 'dev', yes: true });
    await createEngine({ bundle: bundle130 }).update({ channel: 'dev', yes: true });

    expect(releaseNames().sort()).toEqual([
      bundle120.manifest.bundleId,
      bundle130.manifest.bundleId,
    ].sort());
  });
});

describe('lifecycle uninstall and development reset', () => {
  it('default uninstall removes managed runtime/generated state but preserves identity and visible content', async () => {
    const engine = createEngine({ bundle: bundle100 });
    await engine.install({ channel: 'dev' });

    await expect(engine.uninstall()).resolves.toMatchObject({
      operation: 'uninstall',
      changed: true,
      detail: {
        removeNode: false,
        removeUserContent: false,
      },
    });

    expect(engine.serviceOperations).toContain('uninstall:apply');
    expect(existsSync(join(tempHome, 'runtime'))).toBe(false);
    expect(existsSync(join(tempHome, 'node', 'security', 'generated'))).toBe(false);
    expect(existsSync(join(tempHome, 'node', 'tunnels'))).toBe(false);
    expect(existsSync(join(tempHome, 'node', 'caddy'))).toBe(false);
    expect(existsSync(join(tempHome, 'node', 'cache'))).toBe(false);
    expect(existsSync(join(tempHome, 'node', 'tmp'))).toBe(false);
    expect(existsSync(join(tempHome, 'node', 'runs'))).toBe(false);
    expect(existsSync(join(tempHome, 'node', 'logs'))).toBe(false);
    expect(existsSync(join(tempHome, 'consuelo.yaml'))).toBe(true);
    expect(existsSync(join(tempHome, 'node', 'node.yaml'))).toBe(true);
    expect(readFileSync(join(tempHome, 'workspaces', 'workspace_test', 'visible-note.md'), 'utf8'))
      .toBe('keep me\n');
    expect(readFileSync(join(tempHome, 'provider-credentials.keep'), 'utf8'))
      .toBe('do not delete\n');
  });

  it('supports dry-run uninstall without changing services or files', async () => {
    const engine = createEngine({ bundle: bundle100 });
    await engine.install({ channel: 'dev' });

    await expect(engine.uninstall({ dryRun: true })).resolves.toMatchObject({
      operation: 'uninstall',
      changed: false,
      detail: { dryRun: true },
    });

    expect(engine.serviceOperations).toContain('uninstall:dry-run');
    expect(existsSync(join(tempHome, 'runtime', 'current'))).toBe(true);
    expect(existsSync(join(tempHome, 'node', 'security', 'generated'))).toBe(true);
  });

  it('removes node identity and visible workspace content only with explicit flags', async () => {
    const engine = createEngine({ bundle: bundle100 });
    await engine.install({ channel: 'dev' });

    await engine.uninstall({ removeNode: true, removeUserContent: true });

    expect(existsSync(join(tempHome, 'node'))).toBe(false);
    expect(existsSync(join(tempHome, 'workspaces'))).toBe(false);
    expect(existsSync(join(tempHome, 'provider-credentials.keep'))).toBe(true);
  });

  it('reinstalls after default uninstall without repeating onboarding', async () => {
    const initial = createEngine({ bundle: bundle100 });
    await initial.install({ channel: 'dev' });
    await initial.uninstall();
    const reinstall = createEngine({ bundle: bundle110 });

    await expect(reinstall.install({ channel: 'dev' })).resolves.toMatchObject({
      operation: 'install',
      changed: true,
      bundleId: bundle110.manifest.bundleId,
    });
    expect(reinstall.onboardingCalls).toBe(0);
    expect(currentBundleId()).toBe(bundle110.manifest.bundleId);
  });

  it('requires explicit confirmation and a development channel for full reset', async () => {
    writeInstalledIdentity('stable');
    const stable = createEngine();
    await expect(stable.devReset({ yes: true })).rejects.toMatchObject({ code: 'RESET_NOT_ALLOWED' });

    writeInstalledIdentity('dev');
    await expect(stable.devReset()).rejects.toMatchObject({ code: 'RESET_NOT_ALLOWED' });
    await expect(stable.devReset({ yes: true })).resolves.toMatchObject({
      operation: 'reset',
      changed: true,
    });
    expect(existsSync(join(tempHome, 'consuelo.yaml'))).toBe(false);
    expect(existsSync(join(tempHome, 'node'))).toBe(false);
    expect(existsSync(join(tempHome, 'workspaces'))).toBe(false);
    expect(existsSync(join(tempHome, 'provider-credentials.keep'))).toBe(true);
  });

  it('routes macOS service cleanup through the maintained uninstall script', async () => {
    const calls: Array<{ command: string; args: string[] }> = [];
    const controller = createReloadServiceController({
      osRoot,
      platform: 'darwin',
      run: async (command, args) => {
        calls.push({ command, args });
        return { exitCode: 0, stdout: '', stderr: '' };
      },
    });

    await controller.uninstall?.({ dryRun: true, home: tempHome });

    expect(calls).toEqual([{
      command: 'bash',
      args: [
        resolve(osRoot, 'scripts', 'uninstall-system-daemons.sh'),
        '--dry-run',
      ],
    }]);
  });

  it('exposes rollback and uninstall dry-run through stable JSON CLI envelopes', async () => {
    const engine = createEngine();
    engine.rollback = async (input) => ({
      operation: 'rollback',
      changed: false,
      bundleId: bundle100.manifest.bundleId,
      detail: { dryRun: input?.dryRun ?? false },
    });
    engine.uninstall = async (input) => ({
      operation: 'uninstall',
      changed: false,
      detail: { dryRun: input?.dryRun ?? false },
    });
    const rollbackOutput: string[] = [];
    const uninstallOutput: string[] = [];

    expect(await runLifecycleCli(['rollback', '--dry-run', '--json'], {
      engine,
      stdout: (value) => rollbackOutput.push(value),
      stderr: () => {},
    })).toBe(0);
    expect(await runLifecycleCli(['uninstall', '--dry-run', '--json'], {
      engine,
      stdout: (value) => uninstallOutput.push(value),
      stderr: () => {},
    })).toBe(0);

    expect(JSON.parse(rollbackOutput.join(''))).toMatchObject({
      schemaVersion: 1,
      command: 'rollback',
      ok: true,
      result: { operation: 'rollback', changed: false, detail: { dryRun: true } },
    });
    expect(JSON.parse(uninstallOutput.join(''))).toMatchObject({
      schemaVersion: 1,
      command: 'uninstall',
      ok: true,
      result: { operation: 'uninstall', changed: false, detail: { dryRun: true } },
    });
  });
});
