import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  createEmptyReleaseState,
  type ReleaseMutationResult,
} from '../../scripts/lib/distribution/release-channels';
import {
  planReleaseProviderCommands,
  type ReleaseProviderConfig,
} from '../../scripts/lib/distribution/release-channel-provider';

const roots: string[] = [];
const bunExecutable = spawnSync('which', ['bun'], { encoding: 'utf8' }).stdout.trim();

function isolatedReleaseCliEnvironment(overrides: Record<string, string> = {}): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {
    PATH: '/usr/bin:/bin',
  };
  for (const key of ['HOME', 'TMPDIR'] as const) {
    if (process.env[key]) env[key] = process.env[key];
  }
  return { ...env, ...overrides };
}

function tempRoot(): string {
  const root = mkdtempSync(join(tmpdir(), 'consuelo-release-channels-'));
  roots.push(root);
  return root;
}

function runCli(args: string[], env: Record<string, string> = {}) {
  if (!bunExecutable) throw new Error('bun executable is required for release CLI tests');
  const result = spawnSync(
    bunExecutable,
    [resolve(import.meta.dirname, '../../scripts/release-channels.ts'), ...args],
    { encoding: 'utf8', env: isolatedReleaseCliEnvironment(env) },
  );
  return {
    exitCode: result.status,
    stderr: Buffer.from(result.stderr ?? ''),
    stdout: Buffer.from(result.stdout ?? ''),
  };
}

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { force: true, recursive: true });
});

describe('release channel CLI', () => {
  it('never inherits release-provider credentials into CLI subprocess tests', () => {
    const env = isolatedReleaseCliEnvironment();

    for (const key of [
      'CLOUDFLARE_ACCOUNT_ID',
      'CLOUDFLARE_OS_RELEASE_API_TOKEN',
      'CONSUELO_OS_RELEASE_R2_BUCKET',
      'CONSUELO_OS_RELEASE_SIGNING_KEY_ID',
      'CONSUELO_OS_RELEASE_SIGNING_PRIVATE_KEY',
      'CONSUELO_OS_RELEASE_SIGNING_PUBLIC_KEY',
      'CONSUELO_OS_RELEASE_TRUSTED_PUBLIC_KEYS',
      'GH_TOKEN',
      'GITHUB_REPOSITORY',
      'GITHUB_TOKEN',
    ]) {
      expect(env[key]).toBeUndefined();
    }
  });

  it('plans an unchanged dev fingerprint as a successful no-op without credentials', () => {
    const root = tempRoot();
    const statePath = join(root, 'state.json');
    const state = createEmptyReleaseState();
    state.channels.dev = {
      payload: {
        bundleId: `sha256:${'a'.repeat(64)}`,
        channel: 'dev',
        evidence: [{ kind: 'tests', reference: 'fixture' }],
        kind: 'consuelo-os-channel-manifest',
        platforms: [],
        promotedAt: '2026-07-23T00:00:00.000Z',
        releaseFingerprint: `sha256:${'1'.repeat(64)}`,
        revision: 1,
        schemaVersion: 1,
        sourceChannel: null,
        sourceCommit: 'abc',
        version: '1.0.0',
      },
      signature: {
        algorithm: 'ed25519',
        keyId: 'fixture',
        signature: 'fixture',
        signedAt: '2026-07-23T00:00:00.000Z',
      },
    };
    writeFileSync(statePath, JSON.stringify(state));

    const result = runCli([
      'publish',
      '--channel', 'dev',
      '--plan-only',
      '--state', statePath,
      '--fingerprint', `sha256:${'1'.repeat(64)}`,
      '--source-commit', 'def',
      '--json',
    ]);

    expect(result.exitCode).toBe(0);
    expect(JSON.parse(result.stdout.toString())).toMatchObject({
      changed: false,
      noOp: true,
      ok: true,
      reason: 'release fingerprint already published to dev',
    });
  });

  it('keeps the expected-revision guard ahead of mutation execution without invoking apply mode', () => {
    const source = readFileSync(resolve(import.meta.dirname, '../../scripts/release-channels.ts'), 'utf8');
    const revisionRead = source.indexOf("integerFlag(parsed, 'expected-revision')");
    const missingRevisionGuard = source.indexOf("mode === 'apply' && revision === undefined", revisionRead);
    const guardError = source.indexOf('--expected-revision is required with --apply', missingRevisionGuard);

    expect(revisionRead).toBeGreaterThanOrEqual(0);
    expect(missingRevisionGuard).toBeGreaterThan(revisionRead);
    expect(guardError).toBeGreaterThan(missingRevisionGuard);
  });

  it('fails closed when a mutating command has no release signing credentials', () => {
    const root = tempRoot();
    const statePath = join(root, 'state.json');
    const inputPath = join(root, 'input.json');
    writeFileSync(statePath, JSON.stringify(createEmptyReleaseState()));
    writeFileSync(inputPath, JSON.stringify({ bundleId: `sha256:${'a'.repeat(64)}` }));

    const result = runCli([
      'publish',
      '--channel', 'dev',
      '--bundle', `sha256:${'a'.repeat(64)}`,
      '--input', inputPath,
      '--state', statePath,
      '--dry-run',
      '--json',
    ], {
      CONSUELO_OS_RELEASE_SIGNING_KEY_ID: '',
      CONSUELO_OS_RELEASE_SIGNING_PRIVATE_KEY: '',
      CONSUELO_OS_RELEASE_SIGNING_PUBLIC_KEY: '',
    });

    expect(result.exitCode).toBe(1);
    expect(JSON.parse(result.stderr.toString())).toMatchObject({
      ok: false,
      error: 'missing release signing credential CONSUELO_OS_RELEASE_SIGNING_KEY_ID',
    });
    expect(JSON.parse(readFileSync(statePath, 'utf8')).revision).toBe(0);
  });

  it('prints JSON errors without echoing secret values', () => {
    const root = tempRoot();
    const statePath = join(root, 'state.json');
    writeFileSync(statePath, JSON.stringify(createEmptyReleaseState()));
    const secret = 'release-secret-never-log';

    const result = runCli([
      'promote',
      '--from', 'dev',
      '--to', 'canary',
      '--bundle', `sha256:${'a'.repeat(64)}`,
      '--state', statePath,
      '--dry-run',
      '--json',
    ], {
      CONSUELO_OS_RELEASE_SIGNING_KEY_ID: 'fixture',
      CONSUELO_OS_RELEASE_SIGNING_PRIVATE_KEY: secret,
      CONSUELO_OS_RELEASE_SIGNING_PUBLIC_KEY: secret,
    });

    expect(result.exitCode).toBe(1);
    expect(result.stderr.toString()).not.toContain(secret);
    expect(JSON.parse(result.stderr.toString())).toMatchObject({ ok: false });
  });
});

describe('release provider command planning', () => {
  const config: ReleaseProviderConfig = {
    cloudflareAccountId: 'account-id',
    cloudflareApiToken: 'cloudflare-secret',
    githubRepository: 'consuelohq/opensaas',
    githubToken: 'github-secret',
    r2Bucket: 'consuelo-os-releases',
  };

  it('plans GitHub and R2 publication without putting credentials in argv', () => {
    const mutation: ReleaseMutationResult = {
      changed: true,
      idempotent: false,
      operations: [
        { kind: 'create-immutable-tag', bundleId: 'bundle', tag: 'consuelo-os-v1.2.3' },
        { kind: 'create-github-release', bundleId: 'bundle', prerelease: true, tag: 'consuelo-os-v1.2.3' },
        { kind: 'put-cloudflare-object', bundleId: 'bundle', digest: `sha256:${'1'.repeat(64)}`, objectKey: 'bundles/bundle/linux.tar.gz' },
        { kind: 'create-github-deployment', bundleId: 'bundle', environment: 'consuelo-os-dev' },
        { kind: 'put-channel-manifest', bundleId: 'bundle', channel: 'dev', digest: `sha256:${'2'.repeat(64)}` },
      ],
      state: createEmptyReleaseState(),
    };

    const commands = planReleaseProviderCommands(mutation, {
      config,
      sourceCommit: '0123456789abcdef0123456789abcdef01234567',
    });
    const serialized = JSON.stringify(commands);

    expect(commands.map((item) => item.command)).toContain('gh');
    expect(commands.map((item) => item.command)).toContain('wrangler');
    expect(serialized).not.toContain(config.githubToken);
    expect(serialized).not.toContain(config.cloudflareApiToken);
  });

  it('plans promotion as pointer/evidence changes only, with no build command', () => {
    const mutation: ReleaseMutationResult = {
      changed: true,
      idempotent: false,
      operations: [
        { kind: 'update-protected-channel-ref', channel: 'canary', sourceCommit: 'abc' },
        { kind: 'update-github-release', prerelease: true, tag: 'consuelo-os-v1.2.3' },
        { kind: 'create-github-deployment', bundleId: 'bundle', environment: 'consuelo-os-canary' },
        { kind: 'put-channel-manifest', bundleId: 'bundle', channel: 'canary', digest: `sha256:${'2'.repeat(64)}` },
      ],
      state: createEmptyReleaseState(),
    };

    const commands = planReleaseProviderCommands(mutation, {
      config,
      sourceCommit: 'abc',
    });
    const serialized = JSON.stringify(commands);

    expect(serialized).toContain('refs/heads/canary');
    expect(serialized).not.toContain('build-runtime-bundle');
    expect(serialized).not.toContain('runtime-bundle:build');
  });
});
