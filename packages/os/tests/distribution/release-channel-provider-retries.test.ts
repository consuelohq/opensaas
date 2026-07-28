import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  createEmptyReleaseState,
  type ReleaseMutationResult,
  type ReleaseState,
} from '../../scripts/lib/distribution/release-channels';
import {
  createReleaseProviderCommandBackend,
  executeReleaseProviderMutation,
  type ReleaseProviderBackend,
  type ReleaseProviderCommandRunner,
  type ReleaseProviderConfig,
} from '../../scripts/lib/distribution/release-channel-provider';

const roots: string[] = [];
const SOURCE_COMMIT = '0123456789abcdef0123456789abcdef01234567';
const PLATFORM_BUNDLE_ID = `sha256:${'2'.repeat(64)}`;
const RELEASE_SET_ID = `sha256:${'3'.repeat(64)}`;
const FINGERPRINT = `sha256:${'4'.repeat(64)}`;
const TAG = 'consuelo-os-v1.2.3';

function tempRoot(): string {
  const root = mkdtempSync(join(tmpdir(), 'consuelo-provider-retry-'));
  roots.push(root);
  return root;
}

function digestFile(path: string): string {
  return `sha256:${createHash('sha256').update(readFileSync(path)).digest('hex')}`;
}

function digestJson(value: unknown): string {
  return `sha256:${createHash('sha256').update(`${JSON.stringify(value, null, 2)}\n`).digest('hex')}`;
}

function publicationMutation(): ReleaseMutationResult {
  const root = tempRoot();
  const archivePath = join(root, 'runtime.tar.gz');
  const signaturePath = join(root, 'runtime.tar.gz.sig');
  writeFileSync(archivePath, 'archive-bytes');
  writeFileSync(signaturePath, 'signature-bytes');
  const state = createEmptyReleaseState();
  state.revision = 1;
  state.releases[RELEASE_SET_ID] = {
    bundleId: RELEASE_SET_ID,
    bundles: [{
      architecture: 'x64',
      archiveDigest: digestFile(archivePath),
      bundleId: PLATFORM_BUNDLE_ID,
      cloudflare: {
        digest: digestFile(archivePath),
        objectKey: `bundles/${PLATFORM_BUNDLE_ID}/runtime.tar.gz`,
      },
      github: {
        assetName: 'runtime.tar.gz',
        digest: digestFile(archivePath),
      },
      manifest: {
        architecture: 'x64',
        bundleId: PLATFORM_BUNDLE_ID,
        platform: 'linux',
        releaseFingerprint: FINGERPRINT,
        schemaVersion: 1,
        sourceCommit: SOURCE_COMMIT,
        version: '1.2.3',
      },
      platform: 'linux',
      signature: {
        algorithm: 'ed25519',
        keyId: 'fixture',
        signature: 'fixture',
      },
    }],
    createdAt: '2026-07-23T00:00:00.000Z',
    evidence: [{ kind: 'tests', reference: 'fixture' }],
    immutableTag: TAG,
    releaseFingerprint: FINGERPRINT,
    sourceCommit: SOURCE_COMMIT,
    version: '1.2.3',
  };
  state.tags[TAG] = RELEASE_SET_ID;
  state.githubReleases[TAG] = {
    bundleId: RELEASE_SET_ID,
    prerelease: true,
    releaseFingerprint: FINGERPRINT,
    sourceCommit: SOURCE_COMMIT,
    tag: TAG,
    version: '1.2.3',
  };
  state.channels.dev = {
    payload: {
      bundleId: RELEASE_SET_ID,
      channel: 'dev',
      evidence: [{ kind: 'tests', reference: 'fixture' }],
      kind: 'consuelo-os-channel-manifest',
      platforms: [{
        architecture: 'x64',
        archiveDigest: digestFile(archivePath),
        bundleId: PLATFORM_BUNDLE_ID,
        cloudflareObjectKey: `bundles/${PLATFORM_BUNDLE_ID}/runtime.tar.gz`,
        githubAssetName: 'runtime.tar.gz',
        platform: 'linux',
      }],
      promotedAt: '2026-07-23T00:00:00.000Z',
      releaseFingerprint: FINGERPRINT,
      revision: 1,
      schemaVersion: 1,
      sourceChannel: null,
      sourceCommit: SOURCE_COMMIT,
      version: '1.2.3',
    },
    signature: {
      algorithm: 'ed25519',
      keyId: 'fixture',
      signature: 'fixture',
      signedAt: '2026-07-23T00:00:00.000Z',
    },
  };
  return {
    artifacts: {
      [PLATFORM_BUNDLE_ID]: { archivePath, signaturePath },
    },
    changed: true,
    idempotent: false,
    operations: [
      { kind: 'create-immutable-tag', bundleId: RELEASE_SET_ID, tag: TAG },
      { kind: 'create-github-release', bundleId: RELEASE_SET_ID, prerelease: true, tag: TAG },
      { kind: 'upload-github-asset', assetName: 'runtime.tar.gz', bundleId: PLATFORM_BUNDLE_ID, digest: digestFile(archivePath) },
      { kind: 'put-cloudflare-object', bundleId: PLATFORM_BUNDLE_ID, digest: digestFile(archivePath), objectKey: `bundles/${PLATFORM_BUNDLE_ID}/runtime.tar.gz` },
      { kind: 'create-github-deployment', bundleId: RELEASE_SET_ID, environment: 'consuelo-os-dev' },
      { kind: 'put-channel-manifest', bundleId: RELEASE_SET_ID, channel: 'dev', digest: digestJson(state.channels.dev) },
    ],
    state,
  };
}

function promotionMutation(): ReleaseMutationResult {
  const state = createEmptyReleaseState();
  state.revision = 2;
  state.releases[RELEASE_SET_ID] = {
    bundleId: RELEASE_SET_ID,
    bundles: [],
    createdAt: '2026-07-23T00:00:00.000Z',
    evidence: [{ kind: 'tests', reference: 'fixture' }],
    immutableTag: TAG,
    releaseFingerprint: FINGERPRINT,
    sourceCommit: SOURCE_COMMIT,
    version: '1.2.3',
  };
  state.githubReleases[TAG] = {
    bundleId: RELEASE_SET_ID,
    prerelease: true,
    releaseFingerprint: FINGERPRINT,
    sourceCommit: SOURCE_COMMIT,
    tag: TAG,
    version: '1.2.3',
  };
  state.channels.canary = {
    payload: {
      bundleId: RELEASE_SET_ID,
      channel: 'canary',
      evidence: [{ kind: 'tests', reference: 'fixture' }],
      kind: 'consuelo-os-channel-manifest',
      platforms: [],
      promotedAt: '2026-07-23T00:00:00.000Z',
      releaseFingerprint: FINGERPRINT,
      revision: 2,
      schemaVersion: 1,
      sourceChannel: 'dev',
      sourceCommit: SOURCE_COMMIT,
      version: '1.2.3',
    },
    signature: {
      algorithm: 'ed25519',
      keyId: 'fixture',
      signature: 'fixture',
      signedAt: '2026-07-23T00:00:00.000Z',
    },
  };
  return {
    changed: true,
    idempotent: false,
    operations: [
      { kind: 'update-protected-channel-ref', channel: 'canary', sourceCommit: SOURCE_COMMIT },
      { kind: 'update-github-release', prerelease: true, tag: TAG },
      { kind: 'create-github-deployment', bundleId: RELEASE_SET_ID, environment: 'consuelo-os-canary' },
      { kind: 'put-channel-manifest', bundleId: RELEASE_SET_ID, channel: 'canary', digest: digestJson(state.channels.canary) },
    ],
    state,
  };
}

const config: ReleaseProviderConfig = {
  cloudflareAccountId: 'account',
  cloudflareApiToken: 'cloudflare-secret',
  githubRepository: 'consuelohq/opensaas',
  githubToken: 'github-secret',
  r2Bucket: 'consuelo-os-releases',
};

function backend(input: {
  integrated?: boolean;
  remoteState?: ReleaseState | null;
  remoteStates?: Array<ReleaseState | null>;
  tagSha?: string | null;
  assetDigest?: string | null;
  assetDigests?: Record<string, string | null>;
  r2Digests?: Record<string, string | null>;
} = {}): ReleaseProviderBackend & { writes: string[] } {
  const writes: string[] = [];
  let releaseStateReads = 0;
  return {
    writes,
    async createDeployment(value) { writes.push(`deployment:${value.environment}`); },
    async createGithubRelease(value) { writes.push(`release:${value.tag}`); },
    async createProtectedRef(value) { writes.push(`create-ref:${value.channel}`); },
    async createTag(value) { writes.push(`tag:${value.tag}`); },
    async deploymentExists() { return true; },
    async getGithubAssetDigest(_tag, name) { return input.assetDigests?.[name] ?? input.assetDigest ?? null; },
    async getGithubRelease() { return { prerelease: true }; },
    async getProtectedRefSha() { return SOURCE_COMMIT; },
    async getR2ObjectDigest(key) { return input.r2Digests?.[key] ?? null; },
    async getReleaseState() {
      const sequenced = input.remoteStates?.[releaseStateReads];
      releaseStateReads += 1;
      return sequenced ?? input.remoteState ?? createEmptyReleaseState();
    },
    async getTagSha() { return input.tagSha ?? null; },
    async isCommitIntegratedToMain() { return input.integrated ?? true; },
    async putR2Object(key, path) { writes.push(`r2:${key}:${digestFile(path)}`); },
    async updateGithubRelease(value) { writes.push(`update-release:${value.tag}`); },
    async updateProtectedRef(value) { writes.push(`update-ref:${value.channel}`); },
    async uploadGithubAsset(value) { writes.push(`asset:${value.name}:${digestFile(value.path)}`); },
  };
}

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { force: true, recursive: true });
});

describe('release provider retry safety', () => {
  it('skips exact immutable provider objects and commits state last', async () => {
    const mutation = publicationMutation();
    const archive = mutation.artifacts![PLATFORM_BUNDLE_ID].archivePath;
    const signature = mutation.artifacts![PLATFORM_BUNDLE_ID].signaturePath;
    const manifestDigest = digestJson(mutation.state.channels.dev);
    const fake = backend({
      assetDigests: {
        'runtime.tar.gz': digestFile(archive),
        'runtime.tar.gz.sig': digestFile(signature),
      },
      r2Digests: {
        [`bundles/${PLATFORM_BUNDLE_ID}/runtime.tar.gz`]: digestFile(archive),
        [`bundles/${PLATFORM_BUNDLE_ID}/runtime.tar.gz.sig`]: digestFile(signature),
        'channels/dev.json': manifestDigest,
        [`channel-history/dev/${manifestDigest.slice('sha256:'.length)}.json`]: manifestDigest,
      },
      tagSha: SOURCE_COMMIT,
    });

    await executeReleaseProviderMutation({ config, mutation, sourceCommit: SOURCE_COMMIT }, {
      backend: fake,
    });

    expect(fake.writes).toHaveLength(1);
    expect(fake.writes[0]).toMatch(/^r2:state\/release-state\.json:/);
  });

  it('rejects an immutable GitHub asset with a different digest', async () => {
    const mutation = publicationMutation();
    const fake = backend({
      assetDigest: `sha256:${'f'.repeat(64)}`,
      tagSha: SOURCE_COMMIT,
    });

    await expect(executeReleaseProviderMutation({
      config,
      mutation,
      sourceCommit: SOURCE_COMMIT,
    }, { backend: fake })).rejects.toThrow(
      'GitHub release asset runtime.tar.gz already exists with a different digest',
    );
    expect(fake.writes).toEqual([]);
  });

  it('rejects a stale remote release-state revision before provider mutation', async () => {
    const mutation = publicationMutation();
    const remoteState = createEmptyReleaseState();
    remoteState.revision = 9;
    const fake = backend({ remoteState });

    await expect(executeReleaseProviderMutation({
      config,
      mutation,
      sourceCommit: SOURCE_COMMIT,
    }, { backend: fake })).rejects.toThrow(
      'remote release state revision changed: expected 0, actual 9',
    );
    expect(fake.writes).toEqual([]);
  });

  it('fails closed when remote release state changes before the final commit marker', async () => {
    const mutation = publicationMutation();
    const initialState = createEmptyReleaseState();
    const concurrentState = createEmptyReleaseState();
    concurrentState.revision = 1;
    concurrentState.audit.push({
      action: 'promote',
      bundleId: `sha256:${'9'.repeat(64)}`,
      channel: 'canary',
      occurredAt: '2026-07-23T00:00:01.000Z',
      revision: 1,
      version: '9.9.9',
    });
    const fake = backend({ remoteStates: [initialState, concurrentState] });

    await expect(executeReleaseProviderMutation({
      config,
      mutation,
      sourceCommit: SOURCE_COMMIT,
    }, { backend: fake })).rejects.toThrow(
      'remote release state changed during provider mutation',
    );
    expect(fake.writes.some((write) => write.startsWith('r2:state/release-state.json:'))).toBe(false);
  });

  it('treats an already committed identical release state as an exact retry no-op', async () => {
    const mutation = publicationMutation();
    const fake = backend({ remoteState: structuredClone(mutation.state) });

    const result = await executeReleaseProviderMutation({
      config,
      mutation,
      sourceCommit: SOURCE_COMMIT,
    }, { backend: fake });

    expect(result).toEqual([]);
    expect(fake.writes).toEqual([]);
  });

  it('downloads and hashes a GitHub asset when digest metadata is unavailable', async () => {
    const remoteBytes = Buffer.from('remote-release-asset');
    const runner: ReleaseProviderCommandRunner = async (planned) => {
      if (planned.purpose === `read GitHub Release ${TAG}`) {
        return {
          exitCode: 0,
          stderr: '',
          stdout: JSON.stringify({ assets: [{ digest: null, name: 'runtime.tar.gz' }] }),
        };
      }
      if (planned.purpose === 'download GitHub Release asset runtime.tar.gz') {
        const directoryIndex = planned.args.indexOf('--dir');
        const directory = planned.args[directoryIndex + 1];
        writeFileSync(join(directory, 'runtime.tar.gz'), remoteBytes);
        return { exitCode: 0, stderr: '', stdout: '' };
      }
      throw new Error(`unexpected provider command: ${planned.purpose}`);
    };
    const provider = createReleaseProviderCommandBackend(config, runner);

    expect(await provider.getGithubAssetDigest(TAG, 'runtime.tar.gz')).toBe(
      `sha256:${createHash('sha256').update(remoteBytes).digest('hex')}`,
    );
  });

  it('creates a deployment without inheriting the currently running publication status', async () => {
    let captured: Parameters<ReleaseProviderCommandRunner>[0] | null = null;
    const runner: ReleaseProviderCommandRunner = async (planned) => {
      captured = planned;
      return { exitCode: 0, stderr: '', stdout: '{}' };
    };
    const provider = createReleaseProviderCommandBackend(config, runner);

    await provider.createDeployment({
      bundleId: RELEASE_SET_ID,
      environment: 'consuelo-os-dev',
      sourceCommit: SOURCE_COMMIT,
    });

    expect(captured?.purpose).toBe('create GitHub Deployment consuelo-os-dev');
    expect(captured?.args).toEqual(expect.arrayContaining([
      `ref=${SOURCE_COMMIT}`,
      'environment=consuelo-os-dev',
      'auto_merge=false',
      'required_contexts[]',
      `payload[bundleId]=${RELEASE_SET_ID}`,
    ]));
  });

  it('requires the promoted source commit to be integrated to main before moving a protected ref', async () => {
    const mutation = promotionMutation();
    const remoteState = createEmptyReleaseState();
    remoteState.revision = 1;
    const fake = backend({ integrated: false, remoteState });

    await expect(executeReleaseProviderMutation({
      config,
      mutation,
      sourceCommit: SOURCE_COMMIT,
    }, { backend: fake })).rejects.toThrow(
      'source commit is not integrated to main',
    );
    expect(fake.writes).toEqual([]);
  });
});
