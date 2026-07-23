import { createHash, generateKeyPairSync, sign } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readlinkSync,
  readdirSync,
  rmSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { mkdtempSync } from 'node:fs';

import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { buildRuntimeBundle } from '../scripts/lib/distribution/runtime-bundle';
import {
  acquireLifecycleLock,
  canonicalReleaseManifestPayload,
  createLifecycleProgressEmitter,
  createLifecycleEngine,
  inspectLifecycleInstallState,
  loadLifecyclePreferences,
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
  'scripts/server/main.ts',
  'scripts/lib/install-state.ts',
  'manifests/generated/tool.manifest.json',
  'manifests/generated/core.manifest.json',
  'hooks/dispatcher.js',
  'steering/system_prompt.md',
  'steering/decision.md',
  'streams/tools/AGENTS.md',
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
  const payload: ReleaseManifestPayload = {
    schemaVersion: 1,
    channel: 'dev',
    version: bundle.manifest.version,
    bundleId: bundle.manifest.bundleId,
    bundleDigest: bundle.archiveDigest,
    bundleUrl: `memory://${bundle.manifest.bundleId}`,
    releaseFingerprint: bundle.manifest.releaseFingerprint,
    publishedAt: '2026-07-23T00:00:00.000Z',
    ...overrides,
  };
  return {
    payload,
    signature: {
      algorithm: 'ed25519',
      keyId: releaseKeyId,
      value: sign(null, Buffer.from(canonicalReleaseManifestPayload(payload)), privateKey).toString('base64url'),
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
  health?: boolean;
  stagingFailure?: Error;
  onboarding?: () => Promise<void>;
} = {}): LifecycleEngine & { serviceOperations: string[]; onboardingCalls: number } {
  const events = input.events ?? [];
  const serviceOperations: string[] = [];
  let onboardingCalls = 0;
  const bundle = input.bundle ?? bundle100;
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
        if (input.serviceFailure) throw input.serviceFailure;
      },
    },
    health: {
      async accept() {
        serviceOperations.push('health');
        return input.health ?? true;
      },
    },
    hooks: {
      async beforeStage() {
        if (input.stagingFailure) throw input.stagingFailure;
      },
    },
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
    expect(currentTarget()).toBe(`releases/${bundle100.manifest.bundleId}`);
    expect(existsSync(join(tempHome, 'runtime', 'releases', bundle100.manifest.bundleId, 'scripts', 'os.ts'))).toBe(true);
    expect(events.map((event) => event.phase)).toEqual([
      'inspect',
      'onboarding',
      'lock',
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
    expect(currentTarget()).toBe(`releases/${bundle110.manifest.bundleId}`);
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
    expect(currentTarget()).toBe(`releases/${bundle100.manifest.bundleId}`);
  });

  it('rejects a concurrent update lock without touching current', async () => {
    const initial = createEngine({ bundle: bundle100 });
    await initial.install({ channel: 'dev' });
    const release = await acquireLifecycleLock({ home: tempHome, operationId: 'held', now: new Date('2026-07-23T00:00:00.000Z') });
    const update = createEngine({ bundle: bundle110, now: () => new Date('2026-07-23T00:00:10.000Z') });

    await expect(update.update({ channel: 'dev' })).rejects.toMatchObject({ code: 'LOCK_HELD' });
    expect(currentTarget()).toBe(`releases/${bundle100.manifest.bundleId}`);
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
    manifest.signature.value = `${manifest.signature.value.slice(0, -2)}aa`;
    const engine = createEngine({ source: sourceFor(bundle100, manifest) });

    await expect(engine.update({ channel: 'dev' })).rejects.toMatchObject({ code: 'MANIFEST_SIGNATURE_INVALID' });
    expect(existsSync(join(tempHome, 'runtime', 'current'))).toBe(false);
  });

  it('fails closed on an archive digest mismatch and leaves current untouched', async () => {
    const initial = createEngine({ bundle: bundle100 });
    await initial.install({ channel: 'dev' });
    const manifest = signedManifest(bundle110, { bundleDigest: 'sha256:deadbeef' });
    const update = createEngine({ source: sourceFor(bundle110, manifest) });

    await expect(update.update({ channel: 'dev' })).rejects.toMatchObject({ code: 'BUNDLE_DIGEST_MISMATCH' });
    expect(currentTarget()).toBe(`releases/${bundle100.manifest.bundleId}`);
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
    expect(currentTarget()).toBe(`releases/${bundle100.manifest.bundleId}`);
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
    expect(currentTarget()).toBe(`releases/${bundle100.manifest.bundleId}`);
  });

  it('restarts only the service adapter and never invokes onboarding', async () => {
    writeInstalledIdentity();
    const engine = createEngine();

    await expect(engine.restart()).resolves.toMatchObject({ operation: 'restart', changed: true });
    expect(engine.onboardingCalls).toBe(0);
    expect(engine.serviceOperations).toEqual(['restart', 'health']);
  });

  it('reports restart and health failures as typed lifecycle errors', async () => {
    writeInstalledIdentity();
    const failedRestart = createEngine({ serviceFailure: new Error('launchctl failed') });
    await expect(failedRestart.restart()).rejects.toMatchObject({ code: 'SERVICE_RESTART_FAILED' });

    const failedHealth = createEngine({ health: false });
    await expect(failedHealth.restart()).rejects.toMatchObject({ code: 'HEALTH_REJECTED' });
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
    expect(currentTarget()).toBe(`releases/${bundle100.manifest.bundleId}`);
    expect(repair.onboardingCalls).toBe(0);
  });

  it('replaces a corrupt same-id retained release from the verified staged download', async () => {
    const initial = createEngine({ bundle: bundle100 });
    await initial.install({ channel: 'dev' });
    const releasePath = join(
      tempHome,
      'runtime',
      'releases',
      bundle100.manifest.bundleId,
    );
    writeFileSync(join(releasePath, 'scripts', 'os.ts'), 'corrupt runtime bytes\n');
    expect((await inspectLifecycleInstallState(tempHome)).kind).toBe('corrupt');

    const repair = createEngine({ bundle: bundle100 });
    await repair.repair();

    expect((await inspectLifecycleInstallState(tempHome)).kind).toBe('valid');
    expect(currentTarget()).toBe(`releases/${bundle100.manifest.bundleId}`);
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
    expect(currentTarget()).toBe(`releases/${bundle1100.manifest.bundleId}`);
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
