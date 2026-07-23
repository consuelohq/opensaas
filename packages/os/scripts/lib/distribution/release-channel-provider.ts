import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';

import {
  canonicalReleaseJson,
  redactReleaseAuditValue,
  type PlatformBundlePublication,
  type ReleaseArtifactPaths,
  type ReleaseChannel,
  type ReleaseMutationResult,
  type ReleaseState,
} from './release-channels';

export type ReleaseProviderConfig = {
  cloudflareAccountId: string;
  cloudflareApiToken: string;
  githubRepository: string;
  githubToken: string;
  r2Bucket: string;
};

export type ReleaseProviderCommand = {
  args: string[];
  command: 'gh' | 'wrangler';
  purpose: string;
};

export type ReleaseProviderCommandResult = {
  exitCode: number;
  stderr: string;
  stdout: string;
};

export type ReleaseProviderCommandRunner = (
  command: ReleaseProviderCommand,
  options: {
    env: Record<string, string>;
  },
) => Promise<ReleaseProviderCommandResult>;

export type ReleaseProviderExecutionInput = {
  config: ReleaseProviderConfig;
  mutation: ReleaseMutationResult;
  sourceCommit: string;
};

export type ReleaseProviderBackend = {
  createDeployment(input: {
    bundleId: string;
    environment: string;
    sourceCommit: string;
  }): Promise<void>;
  createGithubRelease(input: {
    prerelease: boolean;
    tag: string;
  }): Promise<void>;
  createProtectedRef(input: {
    channel: Exclude<ReleaseChannel, 'dev'>;
    sourceCommit: string;
  }): Promise<void>;
  createTag(input: {
    sourceCommit: string;
    tag: string;
  }): Promise<void>;
  deploymentExists(input: {
    bundleId: string;
    environment: string;
    sourceCommit: string;
  }): Promise<boolean>;
  getGithubAssetDigest(tag: string, name: string): Promise<string | null>;
  getGithubRelease(tag: string): Promise<{ prerelease: boolean } | null>;
  getProtectedRefSha(channel: Exclude<ReleaseChannel, 'dev'>): Promise<string | null>;
  getR2ObjectDigest(key: string): Promise<string | null>;
  getReleaseState(): Promise<ReleaseState | null>;
  getTagSha(tag: string): Promise<string | null>;
  isCommitIntegratedToMain(sourceCommit: string): Promise<boolean>;
  putR2Object(key: string, path: string): Promise<void>;
  updateGithubRelease(input: {
    prerelease: boolean;
    tag: string;
  }): Promise<void>;
  updateProtectedRef(input: {
    channel: Exclude<ReleaseChannel, 'dev'>;
    sourceCommit: string;
  }): Promise<void>;
  uploadGithubAsset(input: {
    name: string;
    path: string;
    tag: string;
  }): Promise<void>;
};

function requiredEnvironmentValue(
  env: NodeJS.ProcessEnv,
  name: string,
): string {
  const value = env[name]?.trim();
  if (!value) throw new Error(`missing release provider credential ${name}`);
  return value;
}

export function releaseProviderConfigFromEnvironment(
  env: NodeJS.ProcessEnv = process.env,
): ReleaseProviderConfig {
  return {
    cloudflareAccountId: requiredEnvironmentValue(env, 'CLOUDFLARE_ACCOUNT_ID'),
    cloudflareApiToken: requiredEnvironmentValue(env, 'CLOUDFLARE_OS_RELEASE_API_TOKEN'),
    githubRepository: requiredEnvironmentValue(env, 'GITHUB_REPOSITORY'),
    githubToken: env.GH_TOKEN?.trim()
      || requiredEnvironmentValue(env, 'GITHUB_TOKEN'),
    r2Bucket: requiredEnvironmentValue(env, 'CONSUELO_OS_RELEASE_R2_BUCKET'),
  };
}

function command(
  executable: ReleaseProviderCommand['command'],
  purpose: string,
  ...args: string[]
): ReleaseProviderCommand {
  return { args, command: executable, purpose };
}

function sourceRelease(
  mutation: ReleaseMutationResult,
  bundleId: string,
) {
  const release = mutation.state.releases[bundleId];
  if (!release) throw new Error(`release provider cannot resolve immutable release ${bundleId}`);
  return release;
}

function bundlePublication(
  mutation: ReleaseMutationResult,
  bundleId: string,
): PlatformBundlePublication {
  for (const release of Object.values(mutation.state.releases)) {
    const bundle = release.bundles.find((candidate) => candidate.bundleId === bundleId);
    if (bundle) return bundle;
  }
  throw new Error(`release provider cannot resolve platform bundle ${bundleId}`);
}

function artifactPaths(
  mutation: ReleaseMutationResult,
  bundleId: string,
): ReleaseArtifactPaths | undefined {
  return mutation.artifacts?.[bundleId];
}

function releaseTagForBundle(
  mutation: ReleaseMutationResult,
  bundleId: string,
): string {
  for (const release of Object.values(mutation.state.releases)) {
    if (release.bundles.some((bundle) => bundle.bundleId === bundleId)) {
      return release.immutableTag;
    }
  }
  throw new Error(`release provider cannot resolve tag for platform bundle ${bundleId}`);
}

function manifestPlaceholder(channel: string): string {
  return `<generated-channel-manifest:${channel}>`;
}

function statePlaceholder(): string {
  return '<generated-release-state>';
}

export function planReleaseProviderCommands(
  mutation: ReleaseMutationResult,
  options: {
    config: ReleaseProviderConfig;
    sourceCommit: string;
  },
): ReleaseProviderCommand[] {
  const { config, sourceCommit } = options;
  const commands: ReleaseProviderCommand[] = [];

  for (const operation of mutation.operations) {
    switch (operation.kind) {
      case 'create-immutable-tag':
        commands.push(command(
          'gh',
          `ensure immutable tag ${operation.tag}`,
          'api',
          '-X',
          'POST',
          `repos/${config.githubRepository}/git/refs`,
          '-f',
          `ref=refs/tags/${operation.tag}`,
          '-f',
          `sha=${sourceCommit}`,
        ));
        break;
      case 'create-github-release':
        commands.push(command(
          'gh',
          `ensure GitHub Release ${operation.tag}`,
          'release',
          'create',
          operation.tag,
          '--repo',
          config.githubRepository,
          '--verify-tag',
          '--title',
          operation.tag,
          ...(operation.prerelease ? ['--prerelease'] : []),
        ));
        break;
      case 'upload-github-asset': {
        const tag = releaseTagForBundle(mutation, operation.bundleId);
        const paths = artifactPaths(mutation, operation.bundleId);
        commands.push(command(
          'gh',
          `ensure GitHub asset ${operation.assetName}`,
          'release',
          'upload',
          tag,
          `${paths?.archivePath ?? `<archive:${operation.bundleId}>`}#${operation.assetName}`,
          '--repo',
          config.githubRepository,
        ));
        commands.push(command(
          'gh',
          `ensure detached GitHub signature ${operation.assetName}.sig`,
          'release',
          'upload',
          tag,
          `${paths?.signaturePath ?? `<signature:${operation.bundleId}>`}#${operation.assetName}.sig`,
          '--repo',
          config.githubRepository,
        ));
        break;
      }
      case 'put-cloudflare-object': {
        const paths = artifactPaths(mutation, operation.bundleId);
        commands.push(command(
          'wrangler',
          `ensure R2 object ${operation.objectKey}`,
          'r2',
          'object',
          'put',
          `${config.r2Bucket}/${operation.objectKey}`,
          '--remote',
          '--file',
          paths?.archivePath ?? `<archive:${operation.bundleId}>`,
        ));
        commands.push(command(
          'wrangler',
          `ensure detached R2 signature ${operation.objectKey}.sig`,
          'r2',
          'object',
          'put',
          `${config.r2Bucket}/${operation.objectKey}.sig`,
          '--remote',
          '--file',
          paths?.signaturePath ?? `<signature:${operation.bundleId}>`,
        ));
        break;
      }
      case 'create-github-deployment':
        commands.push(command(
          'gh',
          `ensure GitHub Deployment ${operation.environment}`,
          'api',
          '-X',
          'POST',
          `repos/${config.githubRepository}/deployments`,
          '-f',
          `ref=${sourceCommit}`,
          '-f',
          `environment=${operation.environment}`,
          '-F',
          'auto_merge=false',
          '-f',
          `payload[bundleId]=${operation.bundleId}`,
        ));
        break;
      case 'put-channel-manifest':
        commands.push(command(
          'wrangler',
          `ensure signed ${operation.channel} channel manifest`,
          'r2',
          'object',
          'put',
          `${config.r2Bucket}/channels/${operation.channel}.json`,
          '--remote',
          '--file',
          manifestPlaceholder(operation.channel),
        ));
        commands.push(command(
          'wrangler',
          `retain immutable ${operation.channel} manifest history`,
          'r2',
          'object',
          'put',
          `${config.r2Bucket}/channel-history/${operation.channel}/${operation.digest.slice('sha256:'.length)}.json`,
          '--remote',
          '--file',
          manifestPlaceholder(operation.channel),
        ));
        break;
      case 'update-protected-channel-ref':
        commands.push(command(
          'gh',
          `move protected ${operation.channel} release ref`,
          'api',
          '-X',
          'PATCH',
          `repos/${config.githubRepository}/git/refs/heads/${operation.channel}`,
          '-f',
          `sha=${operation.sourceCommit}`,
          '-F',
          'force=true',
        ));
        break;
      case 'update-github-release':
        commands.push(command(
          'gh',
          `update GitHub Release ${operation.tag}`,
          'release',
          'edit',
          operation.tag,
          '--repo',
          config.githubRepository,
          `--prerelease=${String(operation.prerelease)}`,
          ...(operation.prerelease ? [] : ['--latest']),
        ));
        break;
    }
  }

  if (mutation.changed) {
    commands.push(command(
      'wrangler',
      'persist release state',
      'r2',
      'object',
      'put',
      `${config.r2Bucket}/state/release-state.json`,
      '--remote',
      '--file',
      statePlaceholder(),
    ));
  }

  return commands;
}

function providerEnvironment(config: ReleaseProviderConfig): Record<string, string> {
  return {
    CLOUDFLARE_ACCOUNT_ID: config.cloudflareAccountId,
    CLOUDFLARE_API_TOKEN: config.cloudflareApiToken,
    GH_TOKEN: config.githubToken,
  };
}

export const defaultReleaseProviderCommandRunner: ReleaseProviderCommandRunner = async (
  planned,
  options,
) => {
  try {
    const child = Bun.spawn([planned.command, ...planned.args], {
      env: { ...process.env, ...options.env },
      stderr: 'pipe',
      stdout: 'pipe',
    });
    const [stdout, stderr, exitCode] = await Promise.all([
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
      child.exited,
    ]);
    return { exitCode, stderr, stdout };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return { exitCode: 1, stderr: message, stdout: '' };
  }
};

function sha256File(path: string): string {
  return `sha256:${createHash('sha256').update(readFileSync(path)).digest('hex')}`;
}

function safeProviderFailure(
  planned: ReleaseProviderCommand,
  result: ReleaseProviderCommandResult,
): Error {
  const details = redactReleaseAuditValue({
    command: planned.command,
    purpose: planned.purpose,
    stderr: result.stderr.trim(),
    stdout: result.stdout.trim(),
  });
  return new Error(`release provider command failed: ${canonicalReleaseJson(details)}`);
}

function isNotFound(result: ReleaseProviderCommandResult): boolean {
  const text = `${result.stdout}\n${result.stderr}`.toLowerCase();
  return result.exitCode !== 0 && (
    text.includes('http 404')
    || text.includes('not found')
    || text.includes('does not exist')
    || text.includes('10007')
  );
}

export function createReleaseProviderCommandBackend(
  config: ReleaseProviderConfig,
  runner: ReleaseProviderCommandRunner,
): ReleaseProviderBackend {
  const env = providerEnvironment(config);

  async function run(planned: ReleaseProviderCommand): Promise<ReleaseProviderCommandResult> {
    return runner(planned, { env });
  }

  async function runRequired(planned: ReleaseProviderCommand): Promise<ReleaseProviderCommandResult> {
    const result = await run(planned);
    if (result.exitCode !== 0) throw safeProviderFailure(planned, result);
    return result;
  }

  async function runJson<T>(planned: ReleaseProviderCommand): Promise<T | null> {
    const result = await run(planned);
    if (isNotFound(result)) return null;
    if (result.exitCode !== 0) throw safeProviderFailure(planned, result);
    try {
      return JSON.parse(result.stdout) as T;
    } catch {
      throw new Error(`release provider returned invalid JSON for ${planned.purpose}`);
    }
  }

  async function getR2Object(key: string): Promise<{ digest: string; path: string; root: string } | null> {
    const root = mkdtempSync(join(tmpdir(), 'consuelo-r2-read-'));
    try {
      const path = join(root, 'object');
      const planned = command(
        'wrangler',
        `read R2 object ${key}`,
        'r2',
        'object',
        'get',
        `${config.r2Bucket}/${key}`,
        '--remote',
        '--file',
        path,
      );
      const result = await run(planned);
      if (isNotFound(result)) {
        rmSync(root, { force: true, recursive: true });
        return null;
      }
      if (result.exitCode !== 0) throw safeProviderFailure(planned, result);
      return { digest: sha256File(path), path, root };
    } catch (error: unknown) {
      rmSync(root, { force: true, recursive: true });
      throw error instanceof Error ? error : new Error(String(error));
    }
  }

  return {
    createDeployment(input) {
      return runRequired(command(
        'gh',
        `create GitHub Deployment ${input.environment}`,
        'api',
        '-X',
        'POST',
        `repos/${config.githubRepository}/deployments`,
        '-f',
        `ref=${input.sourceCommit}`,
        '-f',
        `environment=${input.environment}`,
        '-F',
        'auto_merge=false',
        '-f',
        `payload[bundleId]=${input.bundleId}`,
      )).then(() => undefined);
    },
    createGithubRelease(input) {
      return runRequired(command(
        'gh',
        `create GitHub Release ${input.tag}`,
        'release',
        'create',
        input.tag,
        '--repo',
        config.githubRepository,
        '--verify-tag',
        '--title',
        input.tag,
        ...(input.prerelease ? ['--prerelease'] : []),
      )).then(() => undefined);
    },
    createProtectedRef(input) {
      return runRequired(command(
        'gh',
        `create protected ${input.channel} release ref`,
        'api',
        '-X',
        'POST',
        `repos/${config.githubRepository}/git/refs`,
        '-f',
        `ref=refs/heads/${input.channel}`,
        '-f',
        `sha=${input.sourceCommit}`,
      )).then(() => undefined);
    },
    createTag(input) {
      return runRequired(command(
        'gh',
        `create immutable tag ${input.tag}`,
        'api',
        '-X',
        'POST',
        `repos/${config.githubRepository}/git/refs`,
        '-f',
        `ref=refs/tags/${input.tag}`,
        '-f',
        `sha=${input.sourceCommit}`,
      )).then(() => undefined);
    },
    async deploymentExists(input) {
      const deployments = await runJson<Array<{ payload?: { bundleId?: string } }>>(command(
        'gh',
        `read GitHub Deployments for ${input.environment}`,
        'api',
        '-X',
        'GET',
        `repos/${config.githubRepository}/deployments`,
        '-f',
        `environment=${input.environment}`,
        '-f',
        `ref=${input.sourceCommit}`,
      ));
      return Boolean(deployments?.some((deployment) => deployment.payload?.bundleId === input.bundleId));
    },
    async getGithubAssetDigest(tag, name) {
      const release = await runJson<{ assets?: Array<{ digest?: string | null; name: string }> }>(command(
        'gh',
        `read GitHub Release ${tag}`,
        'api',
        `repos/${config.githubRepository}/releases/tags/${encodeURIComponent(tag)}`,
      ));
      const asset = release?.assets?.find((candidate) => candidate.name === name);
      if (!asset) return null;
      if (asset.digest) return asset.digest;

      const root = mkdtempSync(join(tmpdir(), 'consuelo-github-asset-'));
      try {
        await runRequired(command(
          'gh',
          `download GitHub Release asset ${name}`,
          'release',
          'download',
          tag,
          '--repo',
          config.githubRepository,
          '--pattern',
          name,
          '--dir',
          root,
          '--clobber',
        ));
        const downloadedPath = join(root, basename(name));
        if (!existsSync(downloadedPath)) {
          throw new Error(`GitHub release asset ${name} download did not produce a file`);
        }
        return sha256File(downloadedPath);
      } finally {
        rmSync(root, { force: true, recursive: true });
      }
    },
    async getGithubRelease(tag) {
      const release = await runJson<{ prerelease: boolean }>(command(
        'gh',
        `read GitHub Release ${tag}`,
        'api',
        `repos/${config.githubRepository}/releases/tags/${encodeURIComponent(tag)}`,
      ));
      return release ? { prerelease: release.prerelease } : null;
    },
    async getProtectedRefSha(channel) {
      const ref = await runJson<{ object?: { sha?: string } }>(command(
        'gh',
        `read protected ${channel} release ref`,
        'api',
        `repos/${config.githubRepository}/git/ref/heads/${channel}`,
      ));
      return ref?.object?.sha ?? null;
    },
    async getR2ObjectDigest(key) {
      const object = await getR2Object(key);
      if (!object) return null;
      try {
        return object.digest;
      } finally {
        rmSync(object.root, { force: true, recursive: true });
      }
    },
    async getReleaseState() {
      const object = await getR2Object('state/release-state.json');
      if (!object) return null;
      try {
        return JSON.parse(readFileSync(object.path, 'utf8')) as ReleaseState;
      } catch {
        throw new Error('remote release state is not valid JSON');
      } finally {
        rmSync(object.root, { force: true, recursive: true });
      }
    },
    getTagSha(tag) {
      return runJson<{ object?: { sha?: string } }>(command(
        'gh',
        `read immutable tag ${tag}`,
        'api',
        `repos/${config.githubRepository}/git/ref/tags/${encodeURIComponent(tag)}`,
      )).then((ref) => ref?.object?.sha ?? null);
    },
    isCommitIntegratedToMain(sourceCommit) {
      return runJson<{ status?: string }>(command(
        'gh',
        `verify ${sourceCommit} is integrated to main`,
        'api',
        `repos/${config.githubRepository}/compare/${sourceCommit}...main`,
      )).then((comparison) => (
        comparison?.status === 'ahead' || comparison?.status === 'identical'
      ));
    },
    putR2Object(key, path) {
      return runRequired(command(
        'wrangler',
        `write R2 object ${key}`,
        'r2',
        'object',
        'put',
        `${config.r2Bucket}/${key}`,
        '--remote',
        '--file',
        path,
      )).then(() => undefined);
    },
    updateGithubRelease(input) {
      return runRequired(command(
        'gh',
        `update GitHub Release ${input.tag}`,
        'release',
        'edit',
        input.tag,
        '--repo',
        config.githubRepository,
        `--prerelease=${String(input.prerelease)}`,
        ...(input.prerelease ? [] : ['--latest']),
      )).then(() => undefined);
    },
    updateProtectedRef(input) {
      return runRequired(command(
        'gh',
        `update protected ${input.channel} release ref`,
        'api',
        '-X',
        'PATCH',
        `repos/${config.githubRepository}/git/refs/heads/${input.channel}`,
        '-f',
        `sha=${input.sourceCommit}`,
        '-F',
        'force=true',
      )).then(() => undefined);
    },
    uploadGithubAsset(input) {
      return runRequired(command(
        'gh',
        `upload GitHub Release asset ${input.name}`,
        'release',
        'upload',
        input.tag,
        `${input.path}#${input.name}`,
        '--repo',
        config.githubRepository,
      )).then(() => undefined);
    },
  };
}

function assertRequiredArtifactFiles(mutation: ReleaseMutationResult): void {
  const requiredBundleIds = new Set(mutation.operations.flatMap((operation) => {
    if (operation.kind === 'upload-github-asset' || operation.kind === 'put-cloudflare-object') {
      return [operation.bundleId];
    }
    return [];
  }));
  for (const bundleId of requiredBundleIds) {
    const bundle = bundlePublication(mutation, bundleId);
    const paths = artifactPaths(mutation, bundleId);
    if (!paths?.archivePath || !existsSync(paths.archivePath)) {
      throw new Error(`release archive is missing for ${bundle.platform}-${bundle.architecture}`);
    }
    if (sha256File(paths.archivePath) !== bundle.archiveDigest) {
      throw new Error(`release archive digest changed for ${bundle.platform}-${bundle.architecture}`);
    }
    if (!paths.signaturePath || !existsSync(paths.signaturePath)) {
      throw new Error(`detached release signature is missing for ${bundle.platform}-${bundle.architecture}`);
    }
  }
}

function materializeMutationFiles(
  mutation: ReleaseMutationResult,
  root: string,
): {
  channelManifestPaths: Map<ReleaseChannel, string>;
  statePath: string;
} {
  const channelManifestPaths = new Map<ReleaseChannel, string>();
  for (const operation of mutation.operations) {
    if (operation.kind !== 'put-channel-manifest') continue;
    const manifest = mutation.state.channels[operation.channel];
    if (!manifest) throw new Error(`signed channel manifest ${operation.channel} is missing`);
    const path = join(root, `channel-${operation.channel}.json`);
    writeFileSync(path, `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o600 });
    channelManifestPaths.set(operation.channel, path);
  }
  const statePath = join(root, 'release-state.json');
  writeFileSync(statePath, `${JSON.stringify(mutation.state, null, 2)}\n`, { mode: 0o600 });
  return { channelManifestPaths, statePath };
}

function ensureImmutableDigest(
  currentDigest: string | null,
  expectedDigest: string,
  label: string,
  write: () => Promise<void>,
): Promise<void> {
  if (currentDigest === expectedDigest) return Promise.resolve();
  if (currentDigest !== null) {
    throw new Error(`${label} already exists with a different digest`);
  }
  return write();
}

function assertRemoteStateRevision(
  remoteState: ReleaseState | null,
  targetState: ReleaseState,
): 'apply' | 'complete' {
  if (remoteState?.revision === targetState.revision) {
    if (canonicalReleaseJson(remoteState) === canonicalReleaseJson(targetState)) return 'complete';
    throw new Error(`remote release state revision ${targetState.revision} has conflicting content`);
  }
  const expected = targetState.revision - 1;
  const actual = remoteState?.revision ?? 0;
  if (actual !== expected) {
    throw new Error(`remote release state revision changed: expected ${expected}, actual ${actual}`);
  }
  return 'apply';
}

export async function executeReleaseProviderMutation(
  input: ReleaseProviderExecutionInput,
  options: {
    backend?: ReleaseProviderBackend;
    runner?: ReleaseProviderCommandRunner;
  } = {},
): Promise<ReleaseProviderCommand[]> {
  if (!input.mutation.changed) return [];
  const backend = options.backend ?? createReleaseProviderCommandBackend(
    input.config,
    options.runner ?? defaultReleaseProviderCommandRunner,
  );
  const remoteState = await backend.getReleaseState();
  if (assertRemoteStateRevision(remoteState, input.mutation.state) === 'complete') return [];

  assertRequiredArtifactFiles(input.mutation);
  const root = mkdtempSync(join(tmpdir(), 'consuelo-release-provider-'));
  try {
    const files = materializeMutationFiles(input.mutation, root);
    for (const operation of input.mutation.operations) {
      switch (operation.kind) {
        case 'create-immutable-tag': {
          const currentSha = await backend.getTagSha(operation.tag);
          if (currentSha === input.sourceCommit) break;
          if (currentSha !== null) {
            throw new Error(`immutable tag ${operation.tag} already references another commit`);
          }
          await backend.createTag({ sourceCommit: input.sourceCommit, tag: operation.tag });
          break;
        }
        case 'create-github-release': {
          const current = await backend.getGithubRelease(operation.tag);
          if (!current) {
            await backend.createGithubRelease({
              prerelease: operation.prerelease,
              tag: operation.tag,
            });
          } else if (current.prerelease !== operation.prerelease) {
            await backend.updateGithubRelease({
              prerelease: operation.prerelease,
              tag: operation.tag,
            });
          }
          break;
        }
        case 'upload-github-asset': {
          const paths = artifactPaths(input.mutation, operation.bundleId)!;
          const tag = releaseTagForBundle(input.mutation, operation.bundleId);
          await ensureImmutableDigest(
            await backend.getGithubAssetDigest(tag, operation.assetName),
            operation.digest,
            `GitHub release asset ${operation.assetName}`,
            () => backend.uploadGithubAsset({
              name: operation.assetName,
              path: paths.archivePath,
              tag,
            }),
          );
          const signatureName = `${operation.assetName}.sig`;
          const signatureDigest = sha256File(paths.signaturePath);
          await ensureImmutableDigest(
            await backend.getGithubAssetDigest(tag, signatureName),
            signatureDigest,
            `GitHub release asset ${signatureName}`,
            () => backend.uploadGithubAsset({
              name: signatureName,
              path: paths.signaturePath,
              tag,
            }),
          );
          break;
        }
        case 'put-cloudflare-object': {
          const paths = artifactPaths(input.mutation, operation.bundleId)!;
          await ensureImmutableDigest(
            await backend.getR2ObjectDigest(operation.objectKey),
            operation.digest,
            `R2 object ${operation.objectKey}`,
            () => backend.putR2Object(operation.objectKey, paths.archivePath),
          );
          const signatureKey = `${operation.objectKey}.sig`;
          await ensureImmutableDigest(
            await backend.getR2ObjectDigest(signatureKey),
            sha256File(paths.signaturePath),
            `R2 object ${signatureKey}`,
            () => backend.putR2Object(signatureKey, paths.signaturePath),
          );
          break;
        }
        case 'create-github-deployment': {
          const deployment = {
            bundleId: operation.bundleId,
            environment: operation.environment,
            sourceCommit: input.sourceCommit,
          };
          if (!await backend.deploymentExists(deployment)) {
            await backend.createDeployment(deployment);
          }
          break;
        }
        case 'put-channel-manifest': {
          const path = files.channelManifestPaths.get(operation.channel)!;
          const digest = sha256File(path);
          const currentKey = `channels/${operation.channel}.json`;
          if (await backend.getR2ObjectDigest(currentKey) !== digest) {
            await backend.putR2Object(currentKey, path);
          }
          const historyKey = `channel-history/${operation.channel}/${digest.slice('sha256:'.length)}.json`;
          await ensureImmutableDigest(
            await backend.getR2ObjectDigest(historyKey),
            digest,
            `R2 object ${historyKey}`,
            () => backend.putR2Object(historyKey, path),
          );
          break;
        }
        case 'update-protected-channel-ref': {
          if (!await backend.isCommitIntegratedToMain(operation.sourceCommit)) {
            throw new Error('source commit is not integrated to main');
          }
          const currentSha = await backend.getProtectedRefSha(operation.channel);
          if (currentSha === operation.sourceCommit) break;
          if (currentSha === null) {
            await backend.createProtectedRef({
              channel: operation.channel,
              sourceCommit: operation.sourceCommit,
            });
          } else {
            await backend.updateProtectedRef({
              channel: operation.channel,
              sourceCommit: operation.sourceCommit,
            });
          }
          break;
        }
        case 'update-github-release': {
          const current = await backend.getGithubRelease(operation.tag);
          if (!current) throw new Error(`GitHub Release ${operation.tag} does not exist`);
          if (current.prerelease !== operation.prerelease) {
            await backend.updateGithubRelease({
              prerelease: operation.prerelease,
              tag: operation.tag,
            });
          }
          break;
        }
      }
    }

    const latestRemoteState = await backend.getReleaseState();
    if (canonicalReleaseJson(latestRemoteState) !== canonicalReleaseJson(remoteState)) {
      throw new Error('remote release state changed during provider mutation');
    }
    await backend.putR2Object('state/release-state.json', files.statePath);
    return planReleaseProviderCommands(input.mutation, {
      config: input.config,
      sourceCommit: input.sourceCommit,
    });
  } finally {
    rmSync(root, { force: true, recursive: true });
  }
}

export function describeReleaseProviderCommand(
  item: ReleaseProviderCommand,
): string {
  return `${item.command} ${item.args.map((argument) => {
    if (/\s/.test(argument)) return JSON.stringify(argument);
    return argument;
  }).join(' ')}`;
}

export function providerArtifactBasename(bundle: PlatformBundlePublication): string {
  return bundle.archivePath ? basename(bundle.archivePath) : bundle.github.assetName;
}
