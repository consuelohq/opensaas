import {
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { dirname, resolve } from 'node:path';

import {
  createEd25519ChannelSigner,
  createEmptyReleaseState,
  inspectReleaseChannel,
  planDevPublication,
  promoteReleaseChannel,
  publishDevRelease,
  redactReleaseAuditValue,
  rollbackReleaseChannel,
  type ChannelSigner,
  type DevPublicationInput,
  type ReleaseChannel,
  type ReleaseIntent,
  type ReleaseMutationResult,
  type ReleaseState,
} from './lib/distribution/release-channels';
import {
  describeReleaseProviderCommand,
  executeReleaseProviderMutation,
  planReleaseProviderCommands,
  releaseProviderConfigFromEnvironment,
  type ReleaseProviderConfig,
} from './lib/distribution/release-channel-provider';

type ParsedArguments = {
  command: string;
  flags: Map<string, string[]>;
};

function parseArguments(argv: string[]): ParsedArguments {
  const [command = '', ...tokens] = argv;
  const flags = new Map<string, string[]>();
  const booleanFlags = new Set(['apply', 'dry-run', 'json', 'plan-only']);

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (!token.startsWith('--')) throw new Error(`unexpected argument: ${token}`);
    const name = token.slice(2);
    if (booleanFlags.has(name)) {
      flags.set(name, [...(flags.get(name) ?? []), 'true']);
      continue;
    }
    const value = tokens[index + 1];
    if (!value || value.startsWith('--')) throw new Error(`missing value for --${name}`);
    flags.set(name, [...(flags.get(name) ?? []), value]);
    index += 1;
  }

  return { command, flags };
}

function hasFlag(parsed: ParsedArguments, name: string): boolean {
  return parsed.flags.has(name);
}

function optionalFlag(parsed: ParsedArguments, name: string): string | undefined {
  return parsed.flags.get(name)?.at(-1);
}

function repeatedFlag(parsed: ParsedArguments, name: string): string[] {
  return parsed.flags.get(name) ?? [];
}

function requiredFlag(parsed: ParsedArguments, name: string): string {
  const value = optionalFlag(parsed, name)?.trim();
  if (!value) throw new Error(`--${name} is required`);
  return value;
}

function integerFlag(parsed: ParsedArguments, name: string): number | undefined {
  const value = optionalFlag(parsed, name);
  if (value === undefined) return undefined;
  const parsedValue = Number(value);
  if (!Number.isInteger(parsedValue) || parsedValue < 0) {
    throw new Error(`--${name} must be a non-negative integer`);
  }
  return parsedValue;
}

function readJsonFile<T>(path: string): T {
  try {
    return JSON.parse(readFileSync(resolve(path), 'utf8')) as T;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`failed to read JSON file ${path}: ${message}`);
  }
}

function readReleaseState(path: string): ReleaseState {
  const absolutePath = resolve(path);
  if (!existsSync(absolutePath)) return createEmptyReleaseState();
  const state = readJsonFile<ReleaseState>(absolutePath);
  if (state.schemaVersion !== 1 || !Number.isInteger(state.revision)) {
    throw new Error('release state schema is unsupported or malformed');
  }
  return state;
}

function writeReleaseStateAtomically(path: string, state: ReleaseState): void {
  const absolutePath = resolve(path);
  mkdirSync(dirname(absolutePath), { recursive: true });
  const lockPath = `${absolutePath}.lock`;
  let lockDescriptor: number | undefined;
  try {
    lockDescriptor = openSync(lockPath, 'wx', 0o600);
  } catch {
    throw new Error(`release state is locked: ${lockPath}`);
  }

  const tempPath = `${absolutePath}.${process.pid}.${Date.now()}.tmp`;
  try {
    writeFileSync(tempPath, `${JSON.stringify(state, null, 2)}\n`, {
      encoding: 'utf8',
      mode: 0o600,
    });
    renameSync(tempPath, absolutePath);
  } finally {
    if (lockDescriptor !== undefined) closeSync(lockDescriptor);
    rmSync(tempPath, { force: true });
    rmSync(lockPath, { force: true });
  }
}

function requiredSigningValue(env: NodeJS.ProcessEnv, name: string): string {
  const value = env[name];
  if (!value?.trim()) throw new Error(`missing release signing credential ${name}`);
  return value;
}

function signerFromEnvironment(env: NodeJS.ProcessEnv): ChannelSigner {
  return createEd25519ChannelSigner({
    keyId: requiredSigningValue(env, 'CONSUELO_OS_RELEASE_SIGNING_KEY_ID'),
    privateKeyPem: requiredSigningValue(env, 'CONSUELO_OS_RELEASE_SIGNING_PRIVATE_KEY'),
    publicKeyPem: requiredSigningValue(env, 'CONSUELO_OS_RELEASE_SIGNING_PUBLIC_KEY'),
  });
}

function trustedPublicKeys(
  env: NodeJS.ProcessEnv,
  signer?: ChannelSigner,
): Record<string, string> {
  const raw = env.CONSUELO_OS_RELEASE_TRUSTED_PUBLIC_KEYS?.trim();
  let parsed: Record<string, string> = {};
  if (raw) {
    try {
      parsed = JSON.parse(raw) as Record<string, string>;
    } catch {
      throw new Error('CONSUELO_OS_RELEASE_TRUSTED_PUBLIC_KEYS must be a JSON object');
    }
  }
  if (signer) parsed[signer.keyId] = signer.publicKeyPem;
  return parsed;
}

function nowFromArguments(parsed: ParsedArguments): string {
  const value = optionalFlag(parsed, 'now') ?? new Date().toISOString();
  if (Number.isNaN(Date.parse(value))) throw new Error('--now must be an ISO-8601 timestamp');
  return new Date(value).toISOString();
}

function releaseChannel(value: string): ReleaseChannel {
  if (!['dev', 'canary', 'beta', 'stable'].includes(value)) {
    throw new Error(`unsupported release channel: ${value}`);
  }
  return value as ReleaseChannel;
}

function releaseIntent(value: string | undefined): ReleaseIntent | undefined {
  if (value === undefined) return undefined;
  if (!['patch', 'minor', 'major'].includes(value)) {
    throw new Error('release intent must be patch, minor, or major');
  }
  return value as ReleaseIntent;
}

function approvalFromArguments(parsed: ParsedArguments) {
  const actor = optionalFlag(parsed, 'approval-actor');
  const evidence = optionalFlag(parsed, 'approval-evidence');
  if (!actor && !evidence) return undefined;
  if (!actor || !evidence) {
    throw new Error('--approval-actor and --approval-evidence must be provided together');
  }
  return { actor, approved: true, evidence };
}

function placeholderProviderConfig(env: NodeJS.ProcessEnv): ReleaseProviderConfig {
  return {
    cloudflareAccountId: env.CLOUDFLARE_ACCOUNT_ID?.trim() || '<cloudflare-account>',
    cloudflareApiToken: '[REDACTED]',
    githubRepository: env.GITHUB_REPOSITORY?.trim() || '<github-repository>',
    githubToken: '[REDACTED]',
    r2Bucket: env.CONSUELO_OS_RELEASE_R2_BUCKET?.trim() || '<r2-bucket>',
  };
}

function printJson(value: unknown): void {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

function printJsonError(error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  const redacted = redactReleaseAuditValue({ error: message, ok: false });
  process.stderr.write(`${JSON.stringify(redacted)}\n`);
}

function executionMode(parsed: ParsedArguments): 'apply' | 'dry-run' {
  const apply = hasFlag(parsed, 'apply');
  const dryRun = hasFlag(parsed, 'dry-run');
  if (apply && dryRun) throw new Error('--apply and --dry-run are mutually exclusive');
  return apply ? 'apply' : 'dry-run';
}

function mutationExpectedRevision(
  parsed: ParsedArguments,
  mode: 'apply' | 'dry-run',
): number | undefined {
  const revision = integerFlag(parsed, 'expected-revision');
  if (mode === 'apply' && revision === undefined) {
    throw new Error('--expected-revision is required with --apply');
  }
  return revision;
}

function finishMutation(
  mutation: ReleaseMutationResult,
  input: {
    mode: 'apply' | 'dry-run';
    sourceCommit: string;
    statePath: string;
  },
  env: NodeJS.ProcessEnv,
): Promise<void> {
  const config = input.mode === 'apply'
    ? releaseProviderConfigFromEnvironment(env)
    : placeholderProviderConfig(env);
  const planned = planReleaseProviderCommands(mutation, {
    config,
    sourceCommit: input.sourceCommit,
  });
  const printResult = () => printJson({
    changed: mutation.changed,
    commands: planned.map(describeReleaseProviderCommand),
    dryRun: input.mode === 'dry-run',
    idempotent: mutation.idempotent,
    ok: true,
    operations: mutation.operations,
    revision: mutation.state.revision,
  });

  if (input.mode !== 'apply' || !mutation.changed) {
    printResult();
    return Promise.resolve();
  }
  return executeReleaseProviderMutation({
    config,
    mutation,
    sourceCommit: input.sourceCommit,
  }).then(() => {
    writeReleaseStateAtomically(input.statePath, mutation.state);
    printResult();
  });
}

function publishCommand(
  parsed: ParsedArguments,
  env: NodeJS.ProcessEnv,
): Promise<void> {
  const channel = releaseChannel(requiredFlag(parsed, 'channel'));
  if (channel !== 'dev') throw new Error('automatic publication may update only dev');
  const statePath = requiredFlag(parsed, 'state');
  const state = readReleaseState(statePath);

  if (hasFlag(parsed, 'plan-only')) {
    const plan = planDevPublication(state, {
      immutableTags: repeatedFlag(parsed, 'immutable-tag'),
      intent: releaseIntent(optionalFlag(parsed, 'intent')),
      releaseFingerprint: requiredFlag(parsed, 'fingerprint'),
      seedVersion: optionalFlag(parsed, 'seed-version'),
      sourceCommit: requiredFlag(parsed, 'source-commit'),
    });
    printJson({ ok: true, ...plan });
    return;
  }

  const mode = executionMode(parsed);
  const expectedRevision = mutationExpectedRevision(parsed, mode);
  const signer = signerFromEnvironment(env);
  const inputPath = requiredFlag(parsed, 'input');
  const publication = readJsonFile<DevPublicationInput>(inputPath);
  const bundleId = requiredFlag(parsed, 'bundle');
  if (publication.bundleId !== bundleId) {
    throw new Error('--bundle does not match the publication input bundleId');
  }
  const sourceCommit = publication.sourceCommit;
  const mutation = publishDevRelease(state, {
    ...publication,
    expectedRevision,
  }, {
    immutableTags: repeatedFlag(parsed, 'immutable-tag'),
    now: nowFromArguments(parsed),
    signer,
  });
  return finishMutation(mutation, {
    mode,
    sourceCommit,
    statePath,
  }, env);
}

function promoteCommand(
  parsed: ParsedArguments,
  env: NodeJS.ProcessEnv,
): Promise<void> {
  const mode = executionMode(parsed);
  const expectedRevision = mutationExpectedRevision(parsed, mode);
  const signer = signerFromEnvironment(env);
  const statePath = requiredFlag(parsed, 'state');
  const state = readReleaseState(statePath);
  const from = releaseChannel(requiredFlag(parsed, 'from'));
  const to = releaseChannel(requiredFlag(parsed, 'to'));
  const bundleId = requiredFlag(parsed, 'bundle');
  const release = state.releases[bundleId];
  if (!release) throw new Error('verified immutable release does not exist');
  const mutation = promoteReleaseChannel(state, {
    approval: approvalFromArguments(parsed),
    bundleId,
    expectedRevision,
    from,
    to,
  }, {
    now: nowFromArguments(parsed),
    publicKeys: trustedPublicKeys(env, signer),
    signer,
  });
  return finishMutation(mutation, {
    mode,
    sourceCommit: release.sourceCommit,
    statePath,
  }, env);
}

function rollbackCommand(
  parsed: ParsedArguments,
  env: NodeJS.ProcessEnv,
): Promise<void> {
  const mode = executionMode(parsed);
  const expectedRevision = mutationExpectedRevision(parsed, mode);
  const signer = signerFromEnvironment(env);
  const statePath = requiredFlag(parsed, 'state');
  const state = readReleaseState(statePath);
  const channel = releaseChannel(requiredFlag(parsed, 'channel'));
  const bundleId = requiredFlag(parsed, 'bundle');
  const release = state.releases[bundleId];
  if (!release) throw new Error('verified immutable release does not exist');
  const mutation = rollbackReleaseChannel(state, {
    approval: approvalFromArguments(parsed),
    bundleId,
    channel,
    expectedRevision,
  }, {
    now: nowFromArguments(parsed),
    publicKeys: trustedPublicKeys(env, signer),
    signer,
  });
  return finishMutation(mutation, {
    mode,
    sourceCommit: release.sourceCommit,
    statePath,
  }, env);
}

function inspectCommand(parsed: ParsedArguments, env: NodeJS.ProcessEnv): void {
  const state = readReleaseState(requiredFlag(parsed, 'state'));
  const channel = releaseChannel(requiredFlag(parsed, 'channel'));
  const publicKeys = trustedPublicKeys(env);
  if (Object.keys(publicKeys).length === 0) {
    const keyId = requiredSigningValue(env, 'CONSUELO_OS_RELEASE_SIGNING_KEY_ID');
    const publicKey = requiredSigningValue(env, 'CONSUELO_OS_RELEASE_SIGNING_PUBLIC_KEY');
    publicKeys[keyId] = publicKey;
  }
  const inspected = inspectReleaseChannel(state, channel, { publicKeys });
  printJson({ ok: true, ...inspected });
}

export async function runReleaseChannelsCli(
  argv: string[],
  env: NodeJS.ProcessEnv = process.env,
): Promise<void> {
  const parsed = parseArguments(argv);
  if (parsed.command === 'publish') return publishCommand(parsed, env);
  if (parsed.command === 'promote') return promoteCommand(parsed, env);
  if (parsed.command === 'rollback-channel') return rollbackCommand(parsed, env);
  if (parsed.command === 'inspect') return inspectCommand(parsed, env);
  throw new Error(
    'usage: release-channels.ts <publish|promote|inspect|rollback-channel> [--flag value]',
  );
}

if (import.meta.main) {
  try {
    await runReleaseChannelsCli(process.argv.slice(2));
  } catch (error: unknown) {
    printJsonError(error);
    process.exitCode = 1;
  }
}
