import { createHash, generateKeyPairSync, sign } from 'node:crypto';
import fs from 'node:fs';
import {
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readlinkSync,
  readdirSync,
  renameSync,
  rmSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { mkdtempSync } from 'node:fs';

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { buildRuntimeBundle } from '../scripts/lib/distribution/runtime-bundle';
import { canonicalReleaseJson } from '../scripts/lib/distribution/release-channels';
import { runtimeReleaseDirectoryName } from '../scripts/lib/lifecycle/runtime-release-path';
import { provisionLocalOs } from '../scripts/lib/install-state';
import { writeYamlConfig } from '../scripts/lib/consuelo-home';
import {
  acquireLifecycleLock,
  activateRuntimeRelease,
  createBunRuntimeMaterializer,
  createHttpHealthAcceptance,
  createLifecycleProgressEmitter,
  createLifecycleEngine,
  inspectLifecycleInstallState,
  loadLifecyclePreferences,
  materializeRuntimeBundleDownload,
  writeLifecycleActivationJournal,
  noOpLifecycleMigrationRunner,
  stageVerifiedRuntimeBundle,
  verifySignedReleaseManifest,
  type LifecycleEngine,
  type LifecycleRuntimeMaterializer,
  type LifecycleProgressEvent,
  type ReleaseManifestPayload,
  type ReleaseSource,
  type SignedReleaseManifest,
} from '../scripts/lib/lifecycle';
import {
  runLifecycleCli,
  trustedReleaseKeysFromEnvironment,
  waitForAdvisoryProcessExit,
} from '../scripts/lifecycle';

const osRoot = resolve(import.meta.dirname, '..');
const requiredRuntimePaths = [
  'package.json',
  'bun.lock',
  'scripts/os.ts',
  'scripts/native-lifecycle-operation.ts',
  'scripts/retire-legacy-system-daemons.sh',
  'scripts/server/main.ts',
  'scripts/server/supervisor.ts',
  'scripts/server/routes/mcp.ts',
  'scripts/lib/mcp-protocol.ts',
  'scripts/lib/mcp-gateway.ts',
  'scripts/lib/worker-pool.ts',
  'scripts/lib/security-gateway.ts',
  'scripts/consuelo-reload.js',
  'scripts/workspace-watchdog.sh',
  'scripts/lib/lifecycle/connector-readiness.ts',
  'scripts/workspace-node-heartbeat.ts',
  'scripts/lib/workspace-node-heartbeat-client.ts',
  'scripts/lib/install-state.ts',
  'scripts/lib/subagent/runner.ts',
  'scripts/managed-components.ts',
  'scripts/lib/managed-components.ts',
  'scripts/lib/managed-component-install.ts',
  'scripts/lib/subagent/runner.ts',
  'manifests/generated/tool.manifest.json',
  'manifests/generated/core.manifest.json',
  'hooks/dispatcher.js',
  'steering/system_prompt.md',
  'streams/tools/AGENTS.md',
  'streams/dialer/AGENTS.md',
  'skills/task/SKILL.md',
  'skills/task/skill.json',
];

let tempHome = '';
let releaseKeyId = 'test-release-key';
let privateKey: ReturnType<typeof generateKeyPairSync>['privateKey'];
let publicKeyPem = '';
let bundle100: Awaited<ReturnType<typeof buildRuntimeBundle>>;
let bundle110: Awaited<ReturnType<typeof buildRuntimeBundle>>;
let bundle190: Awaited<ReturnType<typeof buildRuntimeBundle>>;
let bundle1100: Awaited<ReturnType<typeof buildRuntimeBundle>>;
let legacyRecoveryBundle: Awaited<ReturnType<typeof buildRuntimeBundle>>;

function runtimeReleaseDirectoryFor(
  bundle: Awaited<ReturnType<typeof buildRuntimeBundle>>,
): string {
  return runtimeReleaseDirectoryName(bundle.manifest.bundleId, 'darwin');
}

function runtimeReleaseTargetFor(
  bundle: Awaited<ReturnType<typeof buildRuntimeBundle>>,
): string {
  return `releases/${runtimeReleaseDirectoryFor(bundle)}`;
}

function runtimeReleasePathFor(
  bundle: Awaited<ReturnType<typeof buildRuntimeBundle>>,
): string {
  return join(tempHome, 'runtime', 'releases', runtimeReleaseDirectoryFor(bundle));
}

beforeAll(async () => {
  const pair = generateKeyPairSync('ed25519');
  privateKey = pair.privateKey;
  publicKeyPem = pair.publicKey.export({ type: 'spki', format: 'pem' }).toString();
  bundle100 = await buildRuntimeBundle({
    architecture: 'arm64',
    includePaths: requiredRuntimePaths,
    minimumUpdaterVersion: '1.0.0',
    platform: 'darwin',
    sourceCommit: 'fixture-100',
    sourceRoot: osRoot,
    version: '1.0.0',
  });
  bundle110 = await buildRuntimeBundle({
    architecture: 'arm64',
    includePaths: requiredRuntimePaths,
    minimumUpdaterVersion: '1.0.0',
    platform: 'darwin',
    sourceCommit: 'fixture-110',
    sourceRoot: osRoot,
    version: '1.1.0',
  });
  bundle190 = await buildRuntimeBundle({
    architecture: 'arm64',
    includePaths: requiredRuntimePaths,
    minimumUpdaterVersion: '1.0.0',
    platform: 'darwin',
    sourceCommit: 'fixture-190',
    sourceRoot: osRoot,
    version: '1.9.0',
  });
  bundle1100 = await buildRuntimeBundle({
    architecture: 'arm64',
    includePaths: requiredRuntimePaths,
    minimumUpdaterVersion: '1.0.0',
    platform: 'darwin',
    sourceCommit: 'fixture-1100',
    sourceRoot: osRoot,
    version: '1.10.0',
  });
  legacyRecoveryBundle = await buildRuntimeBundle({
    architecture: 'arm64',
    includePaths: requiredRuntimePaths.filter(
      (runtimePath) =>
        runtimePath !== 'scripts/lib/lifecycle/connector-readiness.ts' &&
        runtimePath !== 'scripts/workspace-node-heartbeat.ts' &&
        runtimePath !== 'scripts/lib/workspace-node-heartbeat-client.ts',
    ),
    minimumUpdaterVersion: '1.0.0',
    platform: 'darwin',
    sourceCommit: 'fixture-legacy-recovery',
    sourceRoot: osRoot,
    version: '0.9.0',
  });
});

beforeEach(() => {
  tempHome = mkdtempSync(join(tmpdir(), 'consuelo-lifecycle-'));
});

afterEach(() => {
  rmSync(tempHome, { recursive: true, force: true });
});

function signedManifest(
  bundle: Awaited<ReturnType<typeof buildRuntimeBundle>>,
  overrides: Partial<ReleaseManifestPayload> = {},
): SignedReleaseManifest {
  const resolved: ReleaseManifestPayload = {
    channel: 'dev',
    version: bundle.manifest.version,
    bundleId: bundle.manifest.bundleId,
    bundleDigest: bundle.archiveDigest,
    bundleUrl: `bundles/${bundle.manifest.bundleId}/runtime.tar.gz`,
    releaseFingerprint: bundle.manifest.releaseFingerprint,
    publishedAt: '2026-07-23T00:00:00.000Z',
    sourceCommit: bundle.manifest.sourceCommit,
    capabilities: [...(bundle.manifest.capabilities ?? [])],
    ...overrides,
  };
  const payload = {
    bundleId: resolved.bundleId,
    channel: resolved.channel === 'nightly' ? 'dev' as const : resolved.channel,
    evidence: [{ kind: 'test', reference: 'lifecycle-engine' }],
    kind: 'consuelo-os-channel-manifest' as const,
    platforms: [{
      architecture: process.arch,
      archiveDigest: resolved.bundleDigest,
      bundleId: resolved.bundleId,
      capabilities: resolved.capabilities,
      cloudflareObjectKey: resolved.bundleUrl,
      githubAssetName: `consuelo-os-runtime-${resolved.version}.tar.gz`,
      platform: process.platform,
    }],
    promotedAt: resolved.publishedAt,
    releaseFingerprint: resolved.releaseFingerprint,
    revision: 1,
    schemaVersion: 1,
    sourceChannel: null,
    sourceCommit: resolved.sourceCommit,
    version: resolved.version,
  };
  return {
    payload,
    signature: {
      algorithm: 'ed25519',
      keyId: releaseKeyId,
      signature: sign(null, Buffer.from(canonicalReleaseJson(payload)), privateKey).toString('base64url'),
      signedAt: '2026-07-23T00:00:01.000Z',
    },
  };
}

function sourceFor(
  bundle: Awaited<ReturnType<typeof buildRuntimeBundle>>,
  manifest = signedManifest(bundle),
): ReleaseSource {
  return {
    async fetchManifest() {
      return manifest;
    },
    async fetchBundle() {
      return bundle.archiveBytes;
    },
  };
}

function writeInstalledIdentity(): void {
  mkdirSync(join(tempHome, 'node'), { recursive: true });
  mkdirSync(join(tempHome, 'workspaces', 'workspace_test', 'shared'), { recursive: true });
  writeFileSync(
    join(tempHome, 'consuelo.yaml'),
    [
      'version: 1',
      'activeWorkspace: workspace_test',
      'activeNode: node_test',
      'runtime:',
      '  current: runtime/current',
      'updates:',
      '  channel: dev',
      '  notifications:',
      '    mode: on',
      '',
    ].join('\n'),
  );
  writeFileSync(join(tempHome, 'node', 'node.yaml'), 'version: 1\nnode:\n  id: node_test\n  name: Test Mac\ncapabilities: []\nworkspaces: []\n');
  writeFileSync(join(tempHome, 'workspaces', 'workspace_test', 'shared', 'workspace.yaml'), 'version: 1\nworkspace:\n  id: workspace_test\n  name: Test\ndefaults: {}\nprojects: []\nrouting: {}\npolicy: {}\nsites: {}\nagents: {}\n');
  writeFileSync(join(tempHome, 'user-note.txt'), 'keep me\n');
}

function createEngine(input: {
  bundle?: Awaited<ReturnType<typeof buildRuntimeBundle>>;
  source?: ReleaseSource;
  events?: LifecycleProgressEvent[];
  now?: () => Date;
  serviceFailure?: Error;
  serviceFailures?: Error[];
  health?: boolean | boolean[];
  connectivity?: boolean;
  publicReadiness?: boolean;
  stagingFailure?: Error;
  onboarding?: () => Promise<void>;
  runtime?: LifecycleRuntimeMaterializer;
  visibleUserRoot?: string;
} = {}): LifecycleEngine & { serviceOperations: string[]; onboardingCalls: number } {
  const events = input.events ?? [];
  const serviceOperations: string[] = [];
  let onboardingCalls = 0;
  const bundle = input.bundle ?? bundle100;
  let healthIndex = 0;
  let serviceRestartIndex = 0;
  const engine = createLifecycleEngine({
    home: tempHome,
    now: input.now,
    releaseSource: input.source ?? sourceFor(bundle),
    trustedReleaseKeys: { [releaseKeyId]: publicKeyPem },
    progress: (event) => events.push(event),
    service: {
      async preflight() {
        serviceOperations.push('preflight');
      },
      async restart() {
        serviceOperations.push('restart');
        const sequencedFailure = input.serviceFailures?.[serviceRestartIndex];
        serviceRestartIndex += 1;
        if (sequencedFailure) throw sequencedFailure;
        if (input.serviceFailure) throw input.serviceFailure;
      },
    },
    health: {
      async accept() {
        serviceOperations.push('health');
        if (Array.isArray(input.health)) {
          const value = input.health[Math.min(healthIndex, input.health.length - 1)] ?? true;
          healthIndex += 1;
          return value;
        }
        return input.health ?? true;
      },
    },
    ...(input.connectivity === undefined ? {} : {
      connectivity: {
        async accept() {
          serviceOperations.push('connectivity');
          return input.connectivity ?? true;
        },
      },
    }),
    ...(input.publicReadiness === undefined ? {} : {
      connectorReadiness: {
        async accept() {
          serviceOperations.push('connector-readiness');
          return input.publicReadiness ?? true;
        },
      },
    }),
    hooks: {
      async beforeStage() {
        if (input.stagingFailure) throw input.stagingFailure;
      },
    },
    runtime: input.runtime,
    visibleUserRoot: input.visibleUserRoot,
    onboarding: input.onboarding ?? (async () => {
      onboardingCalls += 1;
      writeInstalledIdentity();
    }),
  }) as LifecycleEngine & { serviceOperations: string[]; onboardingCalls: number };
  Object.defineProperties(engine, {
    serviceOperations: { get: () => serviceOperations },
    onboardingCalls: { get: () => onboardingCalls },
  });
  return engine;
}

function currentTarget(): string {
  return readlinkSync(join(tempHome, 'runtime', 'current'));
}

describe('unified lifecycle engine', () => {
  it('runs clean install as onboarding then verified atomic activation with stable typed progress', async () => {
    const events: LifecycleProgressEvent[] = [];
    const engine = createEngine({ events });

    const result = await engine.install({ channel: 'dev' });

    expect(engine.onboardingCalls).toBe(1);
    expect(result.operation).toBe('install');
    expect(result.changed).toBe(true);
    expect(currentTarget()).toBe(runtimeReleaseTargetFor(bundle100));
    expect(existsSync(join(runtimeReleasePathFor(bundle100), 'scripts', 'os.ts'))).toBe(true);
    expect(events.map((event) => event.phase)).toEqual([
      'inspect',
      'lock',
      'onboarding',
      'manifest-fetch',
      'manifest-verify',
      'bundle-download',
      'bundle-verify',
      'stage',
      'preflight',
      'migrate',
      'activate',
      'service-restart',
      'health',
      'complete',
    ]);
  });

  it('updates an existing valid install without repeating onboarding or changing protected state', async () => {
    const initial = createEngine({ bundle: bundle100 });
    await initial.install({ channel: 'dev' });
    const noteBefore = readFileSync(join(tempHome, 'user-note.txt'), 'utf8');
    const nodeBefore = readFileSync(join(tempHome, 'node', 'node.yaml'), 'utf8');
    const update = createEngine({ bundle: bundle110 });

    const result = await update.update({ channel: 'dev', yes: true });

    expect(update.onboardingCalls).toBe(0);
    expect(result.changed).toBe(true);
    expect(result.version).toBe('1.1.0');
    expect(readFileSync(join(tempHome, 'user-note.txt'), 'utf8')).toBe(noteBefore);
    expect(readFileSync(join(tempHome, 'node', 'node.yaml'), 'utf8')).toBe(nodeBefore);
    expect(currentTarget()).toBe(runtimeReleaseTargetFor(bundle110));
    expect(readlinkSync(join(tempHome, 'runtime', 'previous')))
      .toBe(runtimeReleaseTargetFor(bundle100));
  });

  it('updates from a verified legacy POSIX colon-named release without changing bundle identity', async () => {
    const initial = createEngine({ bundle: bundle100 });
    await initial.install({ channel: 'dev' });
    const canonicalReleasePath = runtimeReleasePathFor(bundle100);
    const legacyReleasePath = join(
      tempHome,
      'runtime',
      'releases',
      bundle100.manifest.bundleId,
    );
    renameSync(canonicalReleasePath, legacyReleasePath);
    unlinkSync(join(tempHome, 'runtime', 'current'));
    symlinkSync(
      `releases/${bundle100.manifest.bundleId}`,
      join(tempHome, 'runtime', 'current'),
    );

    const update = createEngine({ bundle: bundle110 });
    await expect(update.update({ channel: 'dev', yes: true })).resolves.toMatchObject({
      changed: true,
      version: '1.1.0',
    });

    expect(currentTarget()).toBe(runtimeReleaseTargetFor(bundle110));
    expect(readlinkSync(join(tempHome, 'runtime', 'previous'))).toBe(
      `releases/${bundle100.manifest.bundleId}`,
    );
  });

  it('fails closed when a pinned update target no longer matches channel head', async () => {
    const initial = createEngine({ bundle: bundle100 });
    await initial.install({ channel: 'dev' });
    let bundleFetches = 0;
    const source: ReleaseSource = {
      async fetchManifest() {
        return signedManifest(bundle110);
      },
      async fetchBundle() {
        bundleFetches += 1;
        return bundle110.archiveBytes;
      },
    };
    const update = createEngine({ source });

    await expect(
      update.update({
        channel: 'dev',
        yes: true,
        expectedVersion: '1.0.1',
      }),
    ).rejects.toMatchObject({ code: 'MANIFEST_INVALID' });
    expect(bundleFetches).toBe(0);
    expect(update.serviceOperations).toEqual([]);
    expect(currentTarget()).toBe(runtimeReleaseTargetFor(bundle100));
  });

  it('preserves the original activation failure when automatic rollback also fails', async () => {
    await createEngine({ bundle: bundle100 }).install({ channel: 'dev' });
    const update = createEngine({
      bundle: bundle110,
      serviceFailures: [
        new Error('candidate worker handoff failed'),
        new Error('rollback reconciliation failed'),
      ],
    });

    await expect(update.update({ channel: 'dev', yes: true })).rejects.toThrow(
      /runtime activation failed: .*candidate worker handoff failed.*rollback was not accepted: .*rollback reconciliation failed/,
    );
    expect(currentTarget()).toBe(runtimeReleaseTargetFor(bundle100));
    expect(update.serviceOperations.filter((operation) => operation === 'restart')).toHaveLength(2);
  });

  it('supports check-only updates without downloading, activating, or restarting', async () => {
    const initial = createEngine({ bundle: bundle100 });
    await initial.install({ channel: 'dev' });
    let bundleFetches = 0;
    const source: ReleaseSource = {
      async fetchManifest() {
        return signedManifest(bundle110);
      },
      async fetchBundle() {
        bundleFetches += 1;
        return bundle110.archiveBytes;
      },
    };
    const check = createEngine({ source });

    await expect(check.update({ channel: 'dev', check: true })).resolves.toMatchObject({
      changed: false,
      updateAvailable: true,
      version: '1.1.0',
    });
    expect(bundleFetches).toBe(0);
    expect(check.serviceOperations).toEqual([]);
    expect(currentTarget()).toBe(runtimeReleaseTargetFor(bundle100));
  });

  it('keeps check-only updates read-only when an activation journal is present', async () => {
    await createEngine({ bundle: bundle100 }).install({ channel: 'dev' });
    await createEngine({ bundle: bundle110 }).update({ channel: 'dev', yes: true });
    writeLifecycleActivationJournal({
      home: tempHome,
      operationId: 'interrupted-check',
      previousReleasePath: runtimeReleasePathFor(bundle100),
      nextReleasePath: runtimeReleasePathFor(bundle110),
    });
    const check = createEngine({ bundle: bundle110 });

    await expect(
      check.update({ channel: 'dev', check: true }),
    ).resolves.toMatchObject({
      changed: false,
      updateAvailable: false,
      version: '1.1.0',
    });

    expect(currentTarget()).toBe(runtimeReleaseTargetFor(bundle110));
    expect(existsSync(join(tempHome, 'runtime', 'activation.json'))).toBe(true);
    expect(check.serviceOperations).toEqual([]);
  });

  it('reconciles connector-backed hosted state when update is already current', async () => {
    await createEngine({ bundle: bundle100 }).install({ channel: 'dev' });
    const current = createEngine({ bundle: bundle100, publicReadiness: true });

    await expect(current.update({ channel: 'dev', yes: true })).resolves.toMatchObject({
      changed: false,
      updateAvailable: false,
      version: '1.0.0',
    });

    expect(current.serviceOperations).toEqual([
      'preflight',
      'restart',
      'health',
      'connector-readiness',
    ]);
  });

  it('reconciles release-managed user content when update is already current', async () => {
    const visibleUserRoot = join(tempHome, 'visible-user');
    await createEngine({ bundle: bundle100, visibleUserRoot }).install({ channel: 'dev' });
    const managedExample = join(visibleUserRoot, 'Steering', 'example-system.md');
    const expected = readFileSync(managedExample, 'utf8');
    writeFileSync(managedExample, 'stale managed content\n');
    const current = createEngine({
      bundle: bundle100,
      publicReadiness: true,
      visibleUserRoot,
    });

    await expect(current.update({ channel: 'dev', yes: true })).resolves.toMatchObject({
      changed: false,
      updateAvailable: false,
      version: '1.0.0',
    });

    expect(readFileSync(managedExample, 'utf8')).toBe(expected);
  });

  it('keeps current-version check-only updates free of hosted reconciliation side effects', async () => {
    await createEngine({ bundle: bundle100 }).install({ channel: 'dev' });
    const current = createEngine({ bundle: bundle100, publicReadiness: true });

    await expect(current.update({ channel: 'dev', check: true })).resolves.toMatchObject({
      changed: false,
      updateAvailable: false,
      version: '1.0.0',
    });

    expect(current.serviceOperations).toEqual([]);
  });

  it('finalizes an interrupted candidate that is already current and healthy', async () => {
    await createEngine({ bundle: bundle100 }).install({ channel: 'dev' });
    await createEngine({ bundle: bundle110 }).update({ channel: 'dev', yes: true });
    writeLifecycleActivationJournal({
      home: tempHome,
      operationId: 'interrupted-healthy-candidate',
      previousReleasePath: runtimeReleasePathFor(bundle100),
      nextReleasePath: runtimeReleasePathFor(bundle110),
    });
    const recovery = createEngine({ bundle: bundle110, health: true });

    await expect(recovery.update({ channel: 'dev', yes: true })).resolves.toMatchObject({
      changed: false,
      updateAvailable: false,
      version: '1.1.0',
    });

    expect(currentTarget()).toBe(runtimeReleaseTargetFor(bundle110));
    expect(existsSync(join(tempHome, 'runtime', 'activation.json'))).toBe(false);
    expect(recovery.serviceOperations).toEqual([
      'health',
      'preflight',
      'restart',
      'health',
    ]);
  });

  it('re-inspects post-recovery state before applying an interrupted unhealthy candidate', async () => {
    await createEngine({ bundle: bundle100 }).install({ channel: 'dev' });
    await createEngine({ bundle: bundle110 }).update({ channel: 'dev', yes: true });
    writeLifecycleActivationJournal({
      home: tempHome,
      operationId: 'interrupted-unhealthy-candidate',
      previousReleasePath: runtimeReleasePathFor(bundle100),
      nextReleasePath: runtimeReleasePathFor(bundle110),
    });
    const recovery = createEngine({ bundle: bundle110, health: [false, true] });

    await expect(recovery.update({ channel: 'dev', yes: true })).resolves.toMatchObject({
      changed: true,
      updateAvailable: false,
      version: '1.1.0',
    });

    expect(currentTarget()).toBe(runtimeReleaseTargetFor(bundle110));
    expect(existsSync(join(tempHome, 'runtime', 'activation.json'))).toBe(false);
    expect(recovery.serviceOperations).toEqual([
      'health',
      'preflight',
      'restart',
      'health',
    ]);
  });

  it('rejects a concurrent update lock without touching current', async () => {
    const initial = createEngine({ bundle: bundle100 });
    await initial.install({ channel: 'dev' });
    const release = await acquireLifecycleLock({ home: tempHome, operationId: 'held', now: new Date('2026-07-23T00:00:00.000Z') });
    const update = createEngine({ bundle: bundle110, now: () => new Date('2026-07-23T00:00:10.000Z') });

    await expect(update.update({ channel: 'dev' })).rejects.toMatchObject({ code: 'LOCK_HELD' });
    expect(currentTarget()).toBe(runtimeReleaseTargetFor(bundle100));
    await release();
  });

  it('recovers a stale update lock and records the recovery in progress', async () => {
    writeInstalledIdentity();
    mkdirSync(join(tempHome, 'runtime'), { recursive: true });
    writeFileSync(
      join(tempHome, 'runtime', 'lifecycle.lock'),
      JSON.stringify({ operationId: 'stale', acquiredAt: '2026-07-22T00:00:00.000Z', pid: 999999 }),
    );
    const events: LifecycleProgressEvent[] = [];
    const engine = createEngine({ events, now: () => new Date('2026-07-23T00:00:00.000Z') });

    await engine.update({ channel: 'dev' });

    expect(events.find((event) => event.phase === 'lock')).toMatchObject({ detail: { recoveredStaleLock: true } });
    expect(existsSync(join(tempHome, 'runtime', 'lifecycle.lock'))).toBe(false);
  });

  it('fails closed on a manifest signature mismatch', async () => {
    writeInstalledIdentity();
    const manifest = signedManifest(bundle100);
    manifest.signature.signature = `${manifest.signature.signature.slice(0, -2)}aa`;
    const engine = createEngine({ source: sourceFor(bundle100, manifest) });

    await expect(engine.update({ channel: 'dev' })).rejects.toMatchObject({ code: 'MANIFEST_SIGNATURE_INVALID' });
    expect(existsSync(join(tempHome, 'runtime', 'current'))).toBe(false);
  });

  it('rejects a signed release when its source commit disagrees with the verified runtime archive', async () => {
    writeInstalledIdentity();
    const manifest = signedManifest(bundle100, {
      sourceCommit: 'different-signed-source-commit',
    });
    const engine = createEngine({ source: sourceFor(bundle100, manifest) });

    await expect(engine.update({ channel: 'dev' })).rejects.toMatchObject({
      code: 'BUNDLE_VERIFY_FAILED',
    });
    expect(existsSync(join(tempHome, 'runtime', 'current'))).toBe(false);
  });

  it('rejects a signed release that omits any required runtime recovery capability', () => {
    const capabilities = [...(bundle100.manifest.capabilities ?? [])];
    capabilities.shift();
    const manifest = signedManifest(bundle100, { capabilities });

    expect(() =>
      verifySignedReleaseManifest(
        manifest,
        { [releaseKeyId]: publicKeyPem },
        { platform: process.platform, architecture: process.arch },
      ),
    ).toThrowError(
      expect.objectContaining({ code: 'RUNTIME_CAPABILITY_MISMATCH' }),
    );
  });

  it('refuses to repair a valid installed runtime that predates required recovery capabilities', async () => {
    writeInstalledIdentity();
    const operationId = 'legacy-recovery-runtime';
    const archivePath = materializeRuntimeBundleDownload({
      home: tempHome,
      operationId,
      bytes: legacyRecoveryBundle.archiveBytes,
    });
    const { releasePath } = stageVerifiedRuntimeBundle({
      home: tempHome,
      operationId,
      archivePath,
      manifest: legacyRecoveryBundle.manifest,
    });
    activateRuntimeRelease({ home: tempHome, releasePath, operationId });
    const engine = createEngine({ bundle: bundle100 });

    await expect(engine.repair()).rejects.toMatchObject({
      code: 'RUNTIME_CAPABILITY_MISMATCH',
      phase: 'repair-scan',
    });
    expect(engine.serviceOperations).toEqual([]);
  });

  it('rejects signed manifests with malformed platform collections using structured errors', () => {
    const valid = signedManifest(bundle100);
    for (const platforms of [null, ['invalid-platform-entry']]) {
      const payload = {
        ...valid.payload,
        platforms,
      };
      const malformed = {
        payload,
        signature: {
          ...valid.signature,
          signature: sign(
            null,
            Buffer.from(canonicalReleaseJson(payload)),
            privateKey,
          ).toString('base64url'),
        },
      } as unknown as SignedReleaseManifest;

      expect(() =>
        verifySignedReleaseManifest(
          malformed,
          { [releaseKeyId]: publicKeyPem },
        ),
      ).toThrow(expect.objectContaining({ code: 'MANIFEST_INVALID' }));
    }
  });

  it('distinguishes unsupported signature algorithms and unusable trusted keys', () => {
    const valid = signedManifest(bundle100);
    const unsupported = {
      ...valid,
      signature: { ...valid.signature, algorithm: 'rsa' },
    } as unknown as SignedReleaseManifest;

    expect(() =>
      verifySignedReleaseManifest(
        unsupported,
        { [releaseKeyId]: publicKeyPem },
      ),
    ).toThrow(/unsupported release manifest signature algorithm/);
    expect(() =>
      verifySignedReleaseManifest(
        valid,
        { [releaseKeyId]: 'not-a-public-key' },
      ),
    ).toThrow(/trusted release key .* is not usable/);
  });

  it('rejects missing, writable, and symlinked file-based trust anchors', () => {
    const publicKeysJson = process.env.CONSUELO_RELEASE_PUBLIC_KEYS_JSON;
    const keyId = process.env.CONSUELO_RELEASE_KEY_ID;
    const publicKey = process.env.CONSUELO_RELEASE_PUBLIC_KEY;
    delete process.env.CONSUELO_RELEASE_PUBLIC_KEYS_JSON;
    delete process.env.CONSUELO_RELEASE_KEY_ID;
    delete process.env.CONSUELO_RELEASE_PUBLIC_KEY;
    try {
      expect(() => trustedReleaseKeysFromEnvironment(tempHome)).toThrow(
        /no trusted release keys are installed/,
      );

      const runtimeDirectory = join(tempHome, 'runtime');
      const trustedKeysPath = join(
        runtimeDirectory,
        'trusted-release-keys.json',
      );
      mkdirSync(runtimeDirectory, { recursive: true });
      writeFileSync(
        trustedKeysPath,
        JSON.stringify({ [releaseKeyId]: publicKeyPem }),
        { mode: 0o600 },
      );
      expect(trustedReleaseKeysFromEnvironment(tempHome)).toEqual({
        [releaseKeyId]: publicKeyPem,
      });

      chmodSync(trustedKeysPath, 0o622);
      expect(() => trustedReleaseKeysFromEnvironment(tempHome)).toThrow(
        /must not be group- or world-writable/,
      );

      unlinkSync(trustedKeysPath);
      const targetPath = join(runtimeDirectory, 'keys-target.json');
      writeFileSync(
        targetPath,
        JSON.stringify({ [releaseKeyId]: publicKeyPem }),
        { mode: 0o600 },
      );
      symlinkSync(targetPath, trustedKeysPath);
      expect(() => trustedReleaseKeysFromEnvironment(tempHome)).toThrow(
        /must be a regular file/,
      );
    } finally {
      if (publicKeysJson === undefined) {
        delete process.env.CONSUELO_RELEASE_PUBLIC_KEYS_JSON;
      } else {
        process.env.CONSUELO_RELEASE_PUBLIC_KEYS_JSON = publicKeysJson;
      }
      if (keyId === undefined) {
        delete process.env.CONSUELO_RELEASE_KEY_ID;
      } else {
        process.env.CONSUELO_RELEASE_KEY_ID = keyId;
      }
      if (publicKey === undefined) {
        delete process.env.CONSUELO_RELEASE_PUBLIC_KEY;
      } else {
        process.env.CONSUELO_RELEASE_PUBLIC_KEY = publicKey;
      }
    }
  });

  it('should reject partial legacy release-key environment configuration', () => {
    const publicKeysJson = process.env.CONSUELO_RELEASE_PUBLIC_KEYS_JSON;
    const keyId = process.env.CONSUELO_RELEASE_KEY_ID;
    const publicKey = process.env.CONSUELO_RELEASE_PUBLIC_KEY;
    delete process.env.CONSUELO_RELEASE_PUBLIC_KEYS_JSON;
    try {
      process.env.CONSUELO_RELEASE_KEY_ID = releaseKeyId;
      delete process.env.CONSUELO_RELEASE_PUBLIC_KEY;
      expect(() => trustedReleaseKeysFromEnvironment(tempHome)).toThrow(
        /must be configured together/,
      );

      delete process.env.CONSUELO_RELEASE_KEY_ID;
      process.env.CONSUELO_RELEASE_PUBLIC_KEY = publicKeyPem;
      expect(() => trustedReleaseKeysFromEnvironment(tempHome)).toThrow(
        /must be configured together/,
      );
    } finally {
      if (publicKeysJson === undefined)
        delete process.env.CONSUELO_RELEASE_PUBLIC_KEYS_JSON;
      else process.env.CONSUELO_RELEASE_PUBLIC_KEYS_JSON = publicKeysJson;
      if (keyId === undefined) delete process.env.CONSUELO_RELEASE_KEY_ID;
      else process.env.CONSUELO_RELEASE_KEY_ID = keyId;
      if (publicKey === undefined)
        delete process.env.CONSUELO_RELEASE_PUBLIC_KEY;
      else process.env.CONSUELO_RELEASE_PUBLIC_KEY = publicKey;
    }
  });

  it('fails closed on an archive digest mismatch and leaves current untouched', async () => {
    const initial = createEngine({ bundle: bundle100 });
    await initial.install({ channel: 'dev' });
    const manifest = signedManifest(bundle110, {
      bundleDigest: `sha256:${'0'.repeat(64)}`,
    });
    const update = createEngine({ source: sourceFor(bundle110, manifest) });

    await expect(update.update({ channel: 'dev' })).rejects.toMatchObject({ code: 'BUNDLE_DIGEST_MISMATCH' });
    expect(currentTarget()).toBe(runtimeReleaseTargetFor(bundle100));
  });

  it('leaves current untouched and no staged archive when download is interrupted', async () => {
    const initial = createEngine({ bundle: bundle100 });
    await initial.install({ channel: 'dev' });
    const source: ReleaseSource = {
      async fetchManifest() {
        return signedManifest(bundle110);
      },
      async fetchBundle() {
        throw new Error('connection reset after partial response');
      },
    };
    const update = createEngine({ source });

    await expect(update.update({ channel: 'dev' })).rejects.toMatchObject({
      code: 'BUNDLE_DOWNLOAD_FAILED',
    });
    expect(currentTarget()).toBe(runtimeReleaseTargetFor(bundle100));
    expect(readdirSync(join(tempHome, 'runtime', 'staging'))).toEqual([]);
  });

  it('rejects a signed archive whose internal runtime inventory is corrupted', async () => {
    writeInstalledIdentity();
    const corrupted = new Uint8Array(bundle110.archiveBytes);
    corrupted[Math.floor(corrupted.length / 2)] ^= 0xff;
    const digest = `sha256:${createHash('sha256').update(corrupted).digest('hex')}`;
    const manifest = signedManifest(bundle110, { bundleDigest: digest });
    const source: ReleaseSource = {
      async fetchManifest() {
        return manifest;
      },
      async fetchBundle() {
        return corrupted;
      },
    };

    await expect(createEngine({ source }).update({ channel: 'dev' })).rejects.toMatchObject({
      code: 'BUNDLE_VERIFY_FAILED',
    });
    expect(existsSync(join(tempHome, 'runtime', 'current'))).toBe(false);
    expect(readdirSync(join(tempHome, 'runtime', 'staging'))).toEqual([]);
  });

  it('leaves current untouched when staging fails', async () => {
    const initial = createEngine({ bundle: bundle100 });
    await initial.install({ channel: 'dev' });
    const update = createEngine({ bundle: bundle110, stagingFailure: new Error('disk full') });

    await expect(update.update({ channel: 'dev' })).rejects.toMatchObject({ code: 'STAGING_FAILED' });
    expect(currentTarget()).toBe(runtimeReleaseTargetFor(bundle100));
  });

  it('restarts the service, waits for local health, and never invokes onboarding', async () => {
    writeInstalledIdentity();
    const engine = createEngine();

    await expect(engine.restart()).resolves.toMatchObject({
      operation: 'restart',
      changed: true,
      detail: { scheduled: false, localHealthy: true, connectorReady: true },
    });
    expect(engine.onboardingCalls).toBe(0);
    expect(engine.serviceOperations).toEqual(['preflight', 'restart', 'health']);
  });

  it('fails restart closed when the public MCP connector is not ready after local health', async () => {
    writeInstalledIdentity();
    const engine = createEngine({ publicReadiness: false });

    await expect(engine.restart()).rejects.toMatchObject({
      code: 'CONNECTOR_READINESS_FAILED',
    });
    expect(engine.serviceOperations).toEqual([
      'preflight',
      'restart',
      'health',
      'connector-readiness',
    ]);
  });

  it('fails repair closed when the public MCP connector remains unavailable', async () => {
    const initial = createEngine({ bundle: bundle100 });
    await initial.install({ channel: 'dev' });
    const repair = createEngine({ publicReadiness: false });

    await expect(repair.repair()).rejects.toMatchObject({
      code: 'CONNECTOR_READINESS_FAILED',
    });
    expect(repair.serviceOperations).toEqual([
      'preflight',
      'restart',
      'health',
      'connector-readiness',
    ]);
  });

  it('reports reply-safe restart scheduling failures as typed lifecycle errors', async () => {
    writeInstalledIdentity();
    const failedRestart = createEngine({ serviceFailure: new Error('launchctl failed') });
    await expect(failedRestart.restart()).rejects.toMatchObject({ code: 'SERVICE_RESTART_FAILED' });
  });

  it('should terminate an advisory process when its lifecycle deadline expires', async () => {
    const kill = vi.fn();
    const exitCode = await waitForAdvisoryProcessExit({
      exited: new Promise<number>(() => {}),
      kill,
    }, 10);

    expect(exitCode).toBeNull();
    expect(kill).toHaveBeenCalledTimes(1);
  });

  it('accepts local MCP connectivity after repaired runtime health', async () => {
    const initial = createEngine({ bundle: bundle100 });
    await initial.install({ channel: 'dev' });
    const repair = createEngine({ connectivity: true });

    await expect(repair.repair()).resolves.toMatchObject({
      operation: 'repair',
      changed: true,
    });
    expect(repair.serviceOperations).toEqual([
      'preflight',
      'restart',
      'health',
      'connectivity',
    ]);
  });

  it('reports failed local MCP connectivity as advisory after repair', async () => {
    const initial = createEngine({ bundle: bundle100 });
    await initial.install({ channel: 'dev' });
    const events: LifecycleProgressEvent[] = [];
    const repair = createEngine({ connectivity: false, events });

    await expect(repair.repair()).resolves.toMatchObject({
      operation: 'repair',
      changed: true,
    });
    expect(events).toContainEqual(expect.objectContaining({
      phase: 'connectivity',
      detail: expect.objectContaining({
        advisory: true,
        connected: false,
        diagnostic: 'not-verified',
      }),
    }));
  });

  it('should keep optional local-agent connectivity out of update acceptance when connectivity fails', async () => {
    const initial = createEngine({ bundle: bundle100 });
    await initial.install({ channel: 'dev' });
    const update = createEngine({
      bundle: bundle110,
      connectivity: false,
    });

    await expect(update.update({ channel: 'dev' })).resolves.toMatchObject({
      operation: 'update',
      changed: true,
      version: bundle110.manifest.version,
    });
    expect(currentTarget()).toBe(runtimeReleaseTargetFor(bundle110));
    expect(update.serviceOperations).toContain('connectivity');
  });

  it('preserves local launcher customization across a runtime update', async () => {
    const initial = createEngine({ bundle: bundle100 });
    await initial.install({ channel: 'dev' });
    const configPath = join(tempHome, 'consuelo.yaml');
    const configWithLauncher = `${readFileSync(configPath, 'utf8').trimEnd()}\nlauncher:\n  extraSections:\n    - id: internal\n      label: Internal\n      links:\n        - label: Users & installs\n          href: https://internal.consuelohq.com/users\n`;
    writeFileSync(configPath, configWithLauncher, { mode: 0o600 });

    const update = createEngine({ bundle: bundle110 });
    await expect(update.update({ channel: 'dev' })).resolves.toMatchObject({
      operation: 'update',
      changed: true,
      version: bundle110.manifest.version,
    });

    expect(readFileSync(configPath, 'utf8')).toBe(configWithLauncher);

    await update.setChannel('canary');
    const afterChannelChange = readFileSync(configPath, 'utf8');
    expect(afterChannelChange).toContain('channel: canary');
    expect(afterChannelChange).toContain('launcher:');
    expect(afterChannelChange).toContain('href: https://internal.consuelohq.com/users');
  });

  it('persists channel and notification preferences and expires snooze at read time', async () => {
    writeInstalledIdentity();
    const now = new Date('2026-07-23T00:00:00.000Z');
    const engine = createEngine({ now: () => now });

    await engine.setChannel('beta');
    await engine.setUpdateNotifications({ mode: 'snoozed', snoozedUntil: '2026-07-23T01:00:00.000Z' });
    expect(loadLifecyclePreferences(tempHome, now)).toEqual({
      channel: 'beta',
      notifications: { mode: 'snoozed', snoozedUntil: '2026-07-23T01:00:00.000Z' },
    });
    expect(loadLifecyclePreferences(tempHome, new Date('2026-07-23T02:00:00.000Z'))).toEqual({
      channel: 'beta',
      notifications: { mode: 'on' },
    });
    const yaml = readFileSync(join(tempHome, 'consuelo.yaml'), 'utf8');
    expect(yaml).toContain('channel: beta');
    expect(yaml).not.toMatch(/token|secret|credential/i);
  });

  it('repairs a corrupted current link from a verified retained release without touching user-owned state', async () => {
    const initial = createEngine({ bundle: bundle100 });
    await initial.install({ channel: 'dev' });
    unlinkSync(join(tempHome, 'runtime', 'current'));
    symlinkSync('releases/missing-bundle', join(tempHome, 'runtime', 'current'));
    writeFileSync(join(tempHome, 'user-note.txt'), 'custom user content\n');
    const repair = createEngine({ bundle: bundle110 });

    const before = await inspectLifecycleInstallState(tempHome);
    expect(before.kind).toBe('corrupt');
    await repair.repair();

    expect(readFileSync(join(tempHome, 'user-note.txt'), 'utf8')).toBe('custom user content\n');
    expect(currentTarget()).toBe(runtimeReleaseTargetFor(bundle100));
    expect(repair.onboardingCalls).toBe(0);
  });

  it('replaces a corrupt same-id retained release from the verified staged download', async () => {
    const initial = createEngine({ bundle: bundle100 });
    await initial.install({ channel: 'dev' });
    const releasePath = runtimeReleasePathFor(bundle100);
    writeFileSync(join(releasePath, 'scripts', 'os.ts'), 'corrupt runtime bytes\n');
    expect((await inspectLifecycleInstallState(tempHome)).kind).toBe('corrupt');

    const repair = createEngine({ bundle: bundle100 });
    await repair.repair();

    expect((await inspectLifecycleInstallState(tempHome)).kind).toBe('valid');
    expect(currentTarget()).toBe(runtimeReleaseTargetFor(bundle100));
  });

  it('repairs to the highest retained semantic version instead of lexical order', async () => {
    const initial = createEngine({ bundle: bundle190 });
    await initial.install({ channel: 'dev' });
    const update = createEngine({ bundle: bundle1100 });
    await update.update({ channel: 'dev' });
    unlinkSync(join(tempHome, 'runtime', 'current'));
    symlinkSync('releases/missing-release', join(tempHome, 'runtime', 'current'));

    const repair = createEngine({ bundle: bundle1100 });
    const result = await repair.repair();

    expect(result.version).toBe('1.10.0');
    expect(currentTarget()).toBe(runtimeReleaseTargetFor(bundle1100));
  });

  it('detects no-install, legacy, partial, corrupt, and valid states', async () => {
    expect((await inspectLifecycleInstallState(tempHome)).kind).toBe('no-install');
    mkdirSync(join(tempHome, 'os'), { recursive: true });
    expect((await inspectLifecycleInstallState(tempHome)).kind).toBe('legacy');
    rmSync(join(tempHome, 'os'), { recursive: true });
    writeInstalledIdentity();
    expect((await inspectLifecycleInstallState(tempHome)).kind).toBe('partial');
    mkdirSync(join(tempHome, 'runtime'), { recursive: true });
    symlinkSync('releases/missing', join(tempHome, 'runtime', 'current'));
    expect((await inspectLifecycleInstallState(tempHome)).kind).toBe('corrupt');
    unlinkSync(join(tempHome, 'runtime', 'current'));
    const engine = createEngine({ bundle: bundle100 });
    await engine.update({ channel: 'dev' });
    expect((await inspectLifecycleInstallState(tempHome)).kind).toBe('valid');
  });

  it('keeps JSON output stable and independent of terminal text', async () => {
    writeInstalledIdentity();
    const engine = createEngine();
    const stdout: string[] = [];
    const stderr: string[] = [];

    const exitCode = await runLifecycleCli(['status', '--json'], {
      engine,
      stdout: (value) => stdout.push(value),
      stderr: (value) => stderr.push(value),
    });

    expect(exitCode).toBe(0);
    expect(stderr).toEqual([]);
    expect(JSON.parse(stdout.join(''))).toEqual({
      schemaVersion: 1,
      command: 'status',
      ok: true,
      result: expect.objectContaining({
        installState: 'partial',
        preferences: { channel: 'dev', notifications: { mode: 'on' } },
      }),
    });
  });

  it('hands a self-hosted update to the durable lifecycle worker before activation', async () => {
    const engine = createEngine();
    const update = vi.spyOn(engine, 'update').mockResolvedValue({
      operation: 'update',
      changed: false,
      updateAvailable: true,
      version: '1.5.0',
      bundleId: 'bundle-1.5.0',
    });
    const launch = vi.fn(async () => ({
      accepted: true as const,
      operationId: 'daemon-update-1',
    }));
    const read = vi.fn(() => ({
      schemaVersion: 1 as const,
      operationId: 'daemon-update-1',
      kind: 'update' as const,
      phase: 'queued' as const,
      updatedAt: '2026-08-13T18:00:00.000Z',
      targetVersion: '1.5.0',
      channel: 'dev' as const,
    }));
    const stdout: string[] = [];
    const stderr: string[] = [];

    const exitCode = await runLifecycleCli(
      ['update', '--channel', 'dev', '--yes', '--json'],
      {
        engine,
        environment: {
          XPC_SERVICE_NAME: 'com.consuelo.system',
        },
        operationLauncher: { launch, read },
        stdout: (value) => stdout.push(value),
        stderr: (value) => stderr.push(value),
      },
    );

    expect(exitCode).toBe(0);
    expect(stderr).toEqual([]);
    expect(update).toHaveBeenCalledWith({
      channel: 'dev',
      check: true,
      yes: true,
    });
    expect(launch).toHaveBeenCalledWith({
      kind: 'update',
      targetVersion: '1.5.0',
      channel: 'dev',
    });
    expect(JSON.parse(stdout.join(''))).toMatchObject({
      schemaVersion: 1,
      command: 'update',
      ok: true,
      result: {
        operation: 'update',
        changed: false,
        version: '1.5.0',
        detail: {
          detached: true,
          accepted: true,
          operationId: 'daemon-update-1',
        },
      },
    });
  });

  it('hands a same-version self-hosted update to the durable worker for gateway reconciliation', async () => {
    const engine = createEngine();
    const update = vi.spyOn(engine, 'update').mockResolvedValue({
      operation: 'update',
      changed: false,
      updateAvailable: false,
      version: '1.5.0',
      bundleId: 'bundle-1.5.0',
    });
    const launch = vi.fn(async () => ({
      accepted: true as const,
      operationId: 'daemon-update-reconcile-1',
    }));
    const stdout: string[] = [];
    const stderr: string[] = [];

    const exitCode = await runLifecycleCli(
      ['update', '--channel', 'dev', '--yes', '--json'],
      {
        engine,
        environment: { XPC_SERVICE_NAME: 'com.consuelo.system' },
        operationLauncher: { launch, read: () => undefined },
        stdout: (value) => stdout.push(value),
        stderr: (value) => stderr.push(value),
      },
    );

    expect(exitCode).toBe(0);
    expect(stderr).toEqual([]);
    expect(update).toHaveBeenCalledWith({
      channel: 'dev',
      check: true,
      yes: true,
    });
    expect(launch).toHaveBeenCalledWith({
      kind: 'update',
      targetVersion: '1.5.0',
      channel: 'dev',
    });
    expect(JSON.parse(stdout.join(''))).toMatchObject({
      command: 'update',
      ok: true,
      result: {
        operation: 'update',
        changed: false,
        version: '1.5.0',
        detail: {
          detached: true,
          accepted: true,
          operationId: 'daemon-update-reconcile-1',
        },
      },
    });
  });

  it('hands a self-hosted restart to the durable lifecycle worker before disruption', async () => {
    const engine = createEngine();
    const restart = vi.spyOn(engine, 'restart').mockRejectedValue(
      new Error('inline restart must not run inside the active daemon'),
    );
    const launch = vi.fn(async () => ({
      accepted: true as const,
      operationId: 'daemon-restart-1',
    }));
    const stdout: string[] = [];
    const stderr: string[] = [];

    const exitCode = await runLifecycleCli(['restart', '--json'], {
      engine,
      environment: {
        CONSUELO_OS_DAEMON_PROCESS: '1',
      },
      operationLauncher: { launch, read: () => undefined },
      stdout: (value) => stdout.push(value),
      stderr: (value) => stderr.push(value),
    });

    expect(exitCode).toBe(0);
    expect(stderr).toEqual([]);
    expect(restart).not.toHaveBeenCalled();
    expect(launch).toHaveBeenCalledWith({ kind: 'restart' });
    expect(JSON.parse(stdout.join(''))).toMatchObject({
      schemaVersion: 1,
      command: 'restart',
      ok: true,
      result: {
        operation: 'restart',
        changed: true,
        detail: {
          detached: true,
          accepted: true,
          operationId: 'daemon-restart-1',
        },
      },
    });
  });

  it('keeps terminal lifecycle restart synchronous outside the active daemon', async () => {
    const engine = createEngine();
    const restart = vi.spyOn(engine, 'restart').mockResolvedValue({
      operation: 'restart',
      changed: true,
    });
    const launch = vi.fn();
    const stdout: string[] = [];

    const exitCode = await runLifecycleCli(['restart', '--json'], {
      engine,
      environment: {},
      operationLauncher: { launch, read: () => undefined },
      stdout: (value) => stdout.push(value),
      stderr: () => {},
    });

    expect(exitCode).toBe(0);
    expect(restart).toHaveBeenCalledTimes(1);
    expect(launch).not.toHaveBeenCalled();
    expect(JSON.parse(stdout.join(''))).toMatchObject({
      command: 'restart',
      ok: true,
      result: { operation: 'restart', changed: true },
    });
  });

  it('should hand off an update when inherited daemon context survives launchd rewriting XPC_SERVICE_NAME', async () => {
    const engine = createEngine();
    const update = vi.spyOn(engine, 'update').mockResolvedValue({
      operation: 'update',
      changed: false,
      updateAvailable: true,
      version: '1.6.0',
      bundleId: 'bundle-1.6.0',
    });
    const launch = vi.fn(async () => ({
      accepted: true as const,
      operationId: 'daemon-update-2',
    }));
    const stderr: string[] = [];
    const stdout: string[] = [];

    const exitCode = await runLifecycleCli(
      ['update', '--yes', '--json'],
      {
        engine,
        environment: {
          CONSUELO_OS_DAEMON_PROCESS: '1',
          XPC_SERVICE_NAME: '0',
        },
        operationLauncher: { launch, read: () => undefined },
        stdout: (value) => stdout.push(value),
        stderr: (value) => stderr.push(value),
      },
    );

    expect(exitCode).toBe(0);
    expect(stderr).toEqual([]);
    expect(update).toHaveBeenCalledWith({
      channel: undefined,
      check: true,
      yes: true,
    });
    expect(launch).toHaveBeenCalledWith({
      kind: 'update',
      targetVersion: '1.6.0',
    });
    expect(JSON.parse(stdout.join(''))).toMatchObject({
      command: 'update',
      ok: true,
      result: {
        detail: {
          detached: true,
          operationId: 'daemon-update-2',
        },
      },
    });
  });

  it('includes the durable lifecycle operation in JSON status', async () => {
    const engine = createEngine();
    vi.spyOn(engine, 'status').mockResolvedValue({
      operation: 'status',
      changed: false,
      installState: 'valid',
      version: '1.5.0',
      bundleId: 'bundle-1.5.0',
      preferences: { channel: 'canary', notifications: { mode: 'on' } },
    });
    const stdout: string[] = [];

    const exitCode = await runLifecycleCli(['status', '--json'], {
      engine,
      operationLauncher: {
        launch: vi.fn(),
        read: () => ({
          schemaVersion: 1,
          operationId: 'daemon-update-1',
          kind: 'update',
          phase: 'succeeded',
          updatedAt: '2026-08-13T18:00:30.000Z',
          targetVersion: '1.5.0',
          channel: 'canary',
          resultingVersion: '1.5.0',
          resultingBundleId: 'bundle-1.5.0',
        }),
      },
      stdout: (value) => stdout.push(value),
      stderr: vi.fn(),
    });

    expect(exitCode).toBe(0);
    expect(JSON.parse(stdout.join(''))).toMatchObject({
      command: 'status',
      ok: true,
      result: {
        detail: {
          lifecycleOperation: {
            operationId: 'daemon-update-1',
            kind: 'update',
            phase: 'succeeded',
            targetVersion: '1.5.0',
            channel: 'canary',
            resultingVersion: '1.5.0',
            resultingBundleId: 'bundle-1.5.0',
          },
        },
      },
    });
  });

  it('should reject a synchronous repair when inherited from the active daemon', async () => {
    const engine = createEngine();
    const repair = vi.spyOn(engine, 'repair');
    const stderr: string[] = [];

    const exitCode = await runLifecycleCli(['repair', '--json'], {
      engine,
      environment: {
        CONSUELO_OS_DAEMON_PROCESS: '1',
        XPC_SERVICE_NAME: '0',
      },
      stdout: vi.fn(),
      stderr: (value) => stderr.push(value),
    });

    expect(exitCode).toBe(1);
    expect(repair).not.toHaveBeenCalled();
    expect(JSON.parse(stderr.join(''))).toMatchObject({
      command: 'repair',
      ok: false,
      error: {
        code: 'DAEMON_MUTATION_NOT_ALLOWED',
        message: expect.stringContaining('separate lifecycle process'),
      },
    });
  });

  it('allows status without installed release trust anchors', async () => {
    const publicKeysJson = process.env.CONSUELO_RELEASE_PUBLIC_KEYS_JSON;
    const keyId = process.env.CONSUELO_RELEASE_KEY_ID;
    const publicKey = process.env.CONSUELO_RELEASE_PUBLIC_KEY;
    delete process.env.CONSUELO_RELEASE_PUBLIC_KEYS_JSON;
    delete process.env.CONSUELO_RELEASE_KEY_ID;
    delete process.env.CONSUELO_RELEASE_PUBLIC_KEY;
    const stdout: string[] = [];
    const stderr: string[] = [];
    try {
      const exitCode = await runLifecycleCli(
        ['status', '--home', tempHome, '--json'],
        {
          stdout: (value) => stdout.push(value),
          stderr: (value) => stderr.push(value),
        },
      );

      expect(exitCode).toBe(0);
      expect(stderr).toEqual([]);
      expect(JSON.parse(stdout.join(''))).toMatchObject({
        schemaVersion: 1,
        command: 'status',
        ok: true,
      });
    } finally {
      if (publicKeysJson === undefined)
        delete process.env.CONSUELO_RELEASE_PUBLIC_KEYS_JSON;
      else process.env.CONSUELO_RELEASE_PUBLIC_KEYS_JSON = publicKeysJson;
      if (keyId === undefined) delete process.env.CONSUELO_RELEASE_KEY_ID;
      else process.env.CONSUELO_RELEASE_KEY_ID = keyId;
      if (publicKey === undefined)
        delete process.env.CONSUELO_RELEASE_PUBLIC_KEY;
      else process.env.CONSUELO_RELEASE_PUBLIC_KEY = publicKey;
    }
  });

  it('redacts secrets from structured progress and diagnostics events', () => {
    const events: LifecycleProgressEvent[] = [];
    const emit = createLifecycleProgressEmitter({
      home: tempHome,
      operation: 'update',
      now: () => new Date('2026-07-23T00:00:00.000Z'),
      sink: (event) => events.push(event),
      persistDiagnostics: false,
    });

    emit('manifest-fetch', {
      authorization: 'Bearer top-secret-token',
      endpoint: 'https://example.test?token=cst_not-for-logs',
    });

    expect(events[0].detail).toEqual({
      authorization: '[REDACTED]',
      endpoint: 'https://example.test?token=[REDACTED]',
    });
  });
});

describe('lifecycle transaction hardening regressions', () => {
  it('activates after production provisioning without leaving runtime/current as a directory', async () => {
    const engine = createLifecycleEngine({
      home: tempHome,
      releaseSource: sourceFor(bundle100),
      trustedReleaseKeys: { [releaseKeyId]: publicKeyPem },
      service: { async preflight() {}, async restart() {} },
      health: { async accept() { return true; } },
      onboarding: async () => {
        provisionLocalOs({
          home: tempHome,
          userHome: join(tempHome, 'user-home'),
        });
      },
    });

    await expect(engine.install({ channel: 'dev' })).resolves.toMatchObject({ changed: true });
    expect(currentTarget()).toBe(runtimeReleaseTargetFor(bundle100));
  });

  it('should return a typed install-state error when post-onboarding inspection fails', async () => {
    const engine = createLifecycleEngine({
      home: tempHome,
      releaseSource: sourceFor(bundle100),
      trustedReleaseKeys: { [releaseKeyId]: publicKeyPem },
      service: { async preflight() {}, async restart() {} },
      health: { async accept() { return true; } },
      onboarding: async () => {
        rmSync(tempHome, { recursive: true, force: true });
        writeFileSync(tempHome, 'not a Consuelo home directory');
      },
    });

    await expect(engine.install({ channel: 'dev' })).rejects.toMatchObject({
      _tag: 'LifecycleError',
      code: 'INSTALL_STATE_INVALID',
      phase: 'onboarding',
    });
  });

  it('acquires the lifecycle lock before running first-install onboarding', async () => {
    const release = await acquireLifecycleLock({
      home: tempHome,
      operationId: 'held-before-onboarding',
      now: new Date('2026-07-23T00:00:00.000Z'),
    });
    let onboardingCalls = 0;
    const engine = createLifecycleEngine({
      home: tempHome,
      now: () => new Date('2026-07-23T00:00:10.000Z'),
      releaseSource: sourceFor(bundle100),
      trustedReleaseKeys: { [releaseKeyId]: publicKeyPem },
      service: { async preflight() {}, async restart() {} },
      health: { async accept() { return true; } },
      onboarding: async () => {
        onboardingCalls += 1;
        writeInstalledIdentity();
      },
    });

    await expect(engine.install({ channel: 'dev' })).rejects.toMatchObject({ code: 'LOCK_HELD' });
    expect(onboardingCalls).toBe(0);
    await release();
  });

  it('does not reclaim an old lock while its owner PID is still alive', async () => {
    mkdirSync(join(tempHome, 'runtime'), { recursive: true });
    writeFileSync(join(tempHome, 'runtime', 'lifecycle.lock'), JSON.stringify({
      operationId: 'live-owner',
      acquiredAt: '2026-07-22T00:00:00.000Z',
      pid: process.pid,
    }));

    await expect(acquireLifecycleLock({
      home: tempHome,
      operationId: 'contender',
      now: new Date('2026-07-23T00:00:00.000Z'),
    })).rejects.toMatchObject({ code: 'LOCK_HELD' });
  });

  it('rejects a signed manifest for a different requested channel', async () => {
    writeInstalledIdentity();
    const engine = createEngine({ source: sourceFor(bundle100, signedManifest(bundle100, { channel: 'dev' })) });

    await expect(engine.update({ channel: 'stable' })).rejects.toMatchObject({ code: 'MANIFEST_INVALID' });
    expect(existsSync(join(tempHome, 'runtime', 'current'))).toBe(false);
  });

  it('rejects incompatible platform, architecture, and minimum updater requirements', async () => {
    writeInstalledIdentity();
    const cases = [
      await buildRuntimeBundle({
        architecture: process.arch,
        includePaths: requiredRuntimePaths,
        minimumUpdaterVersion: '1.0.0',
        platform: process.platform === 'darwin' ? 'linux' : 'darwin',
        sourceCommit: 'fixture-wrong-platform',
        sourceRoot: osRoot,
        version: '2.0.0',
      }),
      await buildRuntimeBundle({
        architecture: process.arch === 'arm64' ? 'x64' : 'arm64',
        includePaths: requiredRuntimePaths,
        minimumUpdaterVersion: '1.0.0',
        platform: process.platform,
        sourceCommit: 'fixture-wrong-arch',
        sourceRoot: osRoot,
        version: '2.0.1',
      }),
      await buildRuntimeBundle({
        architecture: process.arch,
        includePaths: requiredRuntimePaths,
        minimumUpdaterVersion: '999.0.0',
        platform: process.platform,
        sourceCommit: 'fixture-new-updater',
        sourceRoot: osRoot,
        version: '2.0.2',
      }),
    ];

    for (const bundle of cases) {
      await expect(createEngine({ bundle }).update({ channel: 'dev' })).rejects.toMatchObject({
        code: 'BUNDLE_VERIFY_FAILED',
      });
      expect(existsSync(join(tempHome, 'runtime', 'current'))).toBe(false);
    }
  });

  it('rejects a retained release whose embedded manifest omits deleted payload files', async () => {
    const initial = createEngine({ bundle: bundle100 });
    await initial.install({ channel: 'dev' });
    const releasePath = runtimeReleasePathFor(bundle100);
    const manifestPath = join(releasePath, 'runtime-bundle.manifest.json');
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as typeof bundle100.manifest;
    const removed = manifest.files[0];
    manifest.files = manifest.files.slice(1);
    writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
    rmSync(join(releasePath, removed.path), { force: true });

    await expect(inspectLifecycleInstallState(tempHome)).resolves.toMatchObject({ kind: 'corrupt' });
  });

  it('restores the previous release when post-activation health acceptance fails', async () => {
    const initial = createEngine({ bundle: bundle100 });
    await initial.install({ channel: 'dev' });
    const update = createEngine({ bundle: bundle110, health: [false, true] });

    await expect(update.update({ channel: 'dev' })).rejects.toMatchObject({ code: 'HEALTH_REJECTED' });
    expect(currentTarget()).toBe(runtimeReleaseTargetFor(bundle100));
  });

  it('materializes runtime dependencies before activation', async () => {
    let materializedReleasePath = '';
    const dependencies = {
      home: tempHome,
      releaseSource: sourceFor(bundle100),
      trustedReleaseKeys: { [releaseKeyId]: publicKeyPem },
      service: { async preflight() {}, async restart() {} },
      health: { async accept() { return true; } },
      onboarding: async () => writeInstalledIdentity(),
      runtime: {
        async materialize(input: { releasePath: string }) {
          materializedReleasePath = input.releasePath;
        },
      },
    };
    const engine = createLifecycleEngine(dependencies);

    await engine.install({ channel: 'dev' });
    expect(materializedReleasePath).toBe(runtimeReleasePathFor(bundle100));
    expect(materializedReleasePath).not.toBe('');
  });

  it('executes declared migrations exactly once with a durable journal', async () => {
    const releasePath = join(tempHome, 'runtime', 'releases', 'migration-fixture');
    const migrationPath = join(releasePath, 'scripts', 'migrations', '001-marker.mjs');
    mkdirSync(resolve(migrationPath, '..'), { recursive: true });
    writeFileSync(migrationPath, [
      "import { existsSync, readFileSync, writeFileSync } from 'node:fs';",
      "import { join } from 'node:path';",
      "const marker = join(process.argv[2], 'node', 'migration-count.txt');",
      "const count = existsSync(marker) ? Number(readFileSync(marker, 'utf8')) : 0;",
      "writeFileSync(marker, String(count + 1));",
      '',
    ].join('\n'));
    mkdirSync(join(tempHome, 'node'), { recursive: true });
    const manifest = {
      ...bundle100.manifest,
      migrations: [{ id: '001-marker', path: 'scripts/migrations/001-marker.mjs' }],
    };

    await noOpLifecycleMigrationRunner.run({ home: tempHome, releasePath, manifest });
    await noOpLifecycleMigrationRunner.run({ home: tempHome, releasePath, manifest });

    expect(readFileSync(join(tempHome, 'node', 'migration-count.txt'), 'utf8')).toBe('1');
  });

  it('preserves the original YAML when atomic replacement fails', () => {
    const configPath = join(tempHome, 'consuelo.yaml');
    const original = 'version: 1\nupdates:\n  channel: stable\n  notifications:\n    mode: on\n';
    writeFileSync(configPath, original, { mode: 0o600 });
    const rename = vi.spyOn(fs, 'renameSync').mockImplementation(() => {
      throw new Error('injected rename failure');
    });
    try {
      expect(() => writeYamlConfig(configPath, { version: 1, updates: { channel: 'beta' } }, false))
        .toThrow('injected rename failure');
      expect(readFileSync(configPath, 'utf8')).toBe(original);
    } finally {
      rename.mockRestore();
    }
  });

  it('rejects unused positional arguments without invoking update', async () => {
    const engine = createEngine();
    let updateCalls = 0;
    engine.update = async () => {
      updateCalls += 1;
      return { operation: 'update', changed: false };
    };
    const stderr: string[] = [];

    const exitCode = await runLifecycleCli(['update', 'check'], {
      engine,
      stdout: () => {},
      stderr: (value) => stderr.push(value),
    });

    expect(exitCode).toBe(2);
    expect(updateCalls).toBe(0);
    expect(stderr.join('')).toContain('unexpected positional argument');
  });

  it('accepts health only from the expected activated bundle identity', async () => {
    let calls = 0;
    const options = {
      url: 'http://127.0.0.1:46321/health',
      attempts: 2,
      intervalMs: 0,
      expectedName: 'consuelo-os',
      expectedBundleId: 'bundle-new',
      fetchImpl: async () => {
        calls += 1;
        return new Response(JSON.stringify({
          name: 'consuelo-os',
          bundleId: calls === 1 ? 'bundle-old' : 'bundle-new',
        }), { status: 200, headers: { 'content-type': 'application/json' } });
      },
    };

    await expect(createHttpHealthAcceptance(options).accept()).resolves.toBe(true);
    expect(calls).toBe(2);
  });

  it('recovers a malformed stale lock without deleting a replacement owner', async () => {
    mkdirSync(join(tempHome, 'runtime'), { recursive: true });
    writeFileSync(join(tempHome, 'runtime', 'lifecycle.lock'), '{malformed');

    const release = await acquireLifecycleLock({
      home: tempHome,
      operationId: 'recover-malformed',
      now: new Date('2026-07-23T00:00:00.000Z'),
    });
    expect(release.recoveredStaleLock).toBe(true);
    await release();
  });

  it('rebuilds the managed dependency tree with a frozen production install', async () => {
    const releasePath = join(tempHome, 'runtime', 'releases', 'dependency-fixture');
    mkdirSync(join(releasePath, 'node_modules', 'stale-package'), { recursive: true });
    writeFileSync(join(releasePath, 'node_modules', 'stale-package', 'index.js'), 'stale\n');
    const calls: Array<{ command: string; args: string[]; cwd: string; env: NodeJS.ProcessEnv }> = [];
    const materializer = createBunRuntimeMaterializer({
      run: async (input) => {
        calls.push(input);
        expect(existsSync(join(releasePath, 'node_modules'))).toBe(false);
        return { exitCode: 0, stdout: '', stderr: '' };
      },
    });

    await materializer.materialize({ home: tempHome, releasePath, manifest: bundle100.manifest });

    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({
      command: process.execPath,
      args: ['install', '--frozen-lockfile', '--production'],
      cwd: releasePath,
    });
    expect(calls[0].env.BUN_INSTALL_CACHE_DIR).toBe(join(tempHome, 'runtime', 'cache', 'bun'));
  });


  it('repairs managed dependencies even when the signed runtime tree is otherwise valid', async () => {
    const initial = createEngine({ bundle: bundle100 });
    await initial.install({ channel: 'dev' });
    const materialized: string[] = [];
    const repair = createEngine({
      runtime: {
        async materialize({ releasePath }) {
          materialized.push(releasePath);
        },
      },
    });

    await expect(repair.repair()).resolves.toMatchObject({
      operation: 'repair',
      changed: true,
      detail: { repaired: ['dependencies', 'migrations', 'service', 'connector'] },
    });
    expect(materialized).toEqual([
      runtimeReleasePathFor(bundle100),
    ]);
    expect(repair.serviceOperations).toEqual(['preflight', 'restart', 'health']);
  });

});
