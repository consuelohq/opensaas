import { appendFileSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

export type ConsueloCiPlan = {
  verify: boolean;
  workflowSecurity: boolean;
  osContracts: boolean;
  dialer: boolean;
  sitesGatewayCloudflare: boolean;
};

type JsonObject = Record<string, unknown>;

type CliArgs = {
  base?: string;
};

const ROOT_CROSS_CUTTING_FILES = new Set([
  'package.json',
  'yarn.lock',
  '.yarnrc.yml',
  'bun.lock',
  'bunfig.toml',
  '.bun-version',
  'nx.json',
]);

const CONSUELO_DIALER_WORKFLOWS = new Set([
  '.github/workflows/consuelo-ci.yaml',
  '.github/workflows/consuelo-production-release.yaml',
  '.github/workflows/consuelo-dialer-rollback.yaml',
]);

function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function nestedString(value: unknown, keys: string[]): string | undefined {
  let current: unknown = value;
  for (const key of keys) {
    if (!isJsonObject(current)) return undefined;
    current = current[key];
  }
  return typeof current === 'string' && current.length > 0 ? current : undefined;
}

function isLegacyTwentyPackage(file: string): boolean {
  return /^packages\/(?:twenty-[^/]+|create-twenty-app)(?:\/|$)/.test(file);
}

function isRootTypeScriptConfig(file: string): boolean {
  return /^tsconfig[^/]*\.json$/.test(file);
}

function isRootCrossCuttingFile(file: string): boolean {
  return ROOT_CROSS_CUTTING_FILES.has(file)
    || isRootTypeScriptConfig(file)
    || file.startsWith('.yarn/');
}

function isSitesGatewayChange(file: string): boolean {
  return file.startsWith('packages/os/cloudflare/')
    || file.includes('gateway')
    || file.includes('workspace-edge')
    || file.endsWith('wrangler.toml');
}

export function classifyConsueloChanges(files: string[]): ConsueloCiPlan {
  const plan: ConsueloCiPlan = {
    verify: false,
    workflowSecurity: false,
    osContracts: false,
    dialer: false,
    sitesGatewayCloudflare: false,
  };

  for (const file of files) {
    if (file.startsWith('.github/')) {
      plan.workflowSecurity = true;
      plan.verify = true;
    }

    if (isRootCrossCuttingFile(file)) {
      plan.dialer = true;
      plan.verify = true;
    }

    if (file.startsWith('packages/') && !isLegacyTwentyPackage(file)) {
      plan.verify = true;
    }

    if (file.startsWith('packages/os/')) {
      plan.osContracts = true;
      plan.verify = true;
    }

    if (
      file.startsWith('packages/dialer/')
      || file.startsWith('packages/dialer-server/')
      || file.startsWith('packages/lead-connector/')
      || file.startsWith('packages/logger/')
    ) {
      plan.dialer = true;
      plan.verify = true;
    }

    if (file.startsWith('packages/twenty-server/src/engine/core-modules/consuelo-api/')) {
      plan.dialer = true;
      plan.verify = true;
    }

    if (CONSUELO_DIALER_WORKFLOWS.has(file)) {
      plan.dialer = true;
    }

    if (isSitesGatewayChange(file)) {
      plan.sitesGatewayCloudflare = true;
      plan.osContracts = true;
      plan.verify = true;
    }
  }

  return plan;
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {};
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--base') {
      const value = argv[index + 1];
      if (!value || value.startsWith('--')) {
        throw new Error('missing value for --base');
      }
      args.base = value;
      index += 1;
      continue;
    }
    if (argument === '--help') {
      process.stdout.write('usage: bun packages/os/scripts/ci-plan.ts [--base <ref>]\n');
      process.exit(0);
    }
    throw new Error(`unknown argument: ${argument}`);
  }
  return args;
}

function runGit(args: string[]): string {
  const result = spawnSync('git', args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  if (result.status !== 0) {
    const detail = String(result.stderr || result.stdout || '').trim();
    throw new Error(`git ${args.join(' ')} failed${detail ? `: ${detail}` : ''}`);
  }
  return String(result.stdout || '').trim();
}

function tryGit(args: string[]): string | undefined {
  const result = spawnSync('git', args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  if (result.status !== 0) return undefined;
  const output = String(result.stdout || '').trim();
  return output || undefined;
}

function readEventPayload(): JsonObject {
  const eventPath = process.env.GITHUB_EVENT_PATH;
  if (!eventPath) return {};
  const parsed: unknown = JSON.parse(readFileSync(eventPath, 'utf8'));
  return isJsonObject(parsed) ? parsed : {};
}

function normalizeRemoteBaseRef(baseRef: string): string {
  if (baseRef.startsWith('refs/heads/')) {
    return `origin/${baseRef.slice('refs/heads/'.length)}`;
  }
  return baseRef;
}

function resolveBaseRef(args: CliArgs, eventPayload: JsonObject): string {
  if (args.base) return normalizeRemoteBaseRef(args.base);

  const eventName = process.env.GITHUB_EVENT_NAME || '';
  const mergeParent = tryGit(['rev-parse', 'HEAD^1']);

  if (eventName === 'pull_request') {
    return mergeParent
      || nestedString(eventPayload, ['pull_request', 'base', 'sha'])
      || 'origin/main';
  }

  if (eventName === 'merge_group') {
    return mergeParent
      || nestedString(eventPayload, ['merge_group', 'base_sha'])
      || normalizeRemoteBaseRef(
        nestedString(eventPayload, ['merge_group', 'base_ref']) || 'refs/heads/main',
      );
  }

  if (eventName === 'workflow_dispatch') {
    return normalizeRemoteBaseRef(process.env.CONSUELO_CI_MANUAL_BASE || 'origin/main');
  }

  return 'origin/main';
}

function fetchRemoteRefIfNeeded(baseRef: string): void {
  if (!baseRef.startsWith('origin/')) return;
  const branch = baseRef.slice('origin/'.length);
  runGit([
    'fetch',
    '--no-tags',
    '--prune',
    'origin',
    `+refs/heads/${branch}:refs/remotes/origin/${branch}`,
  ]);
}

function readChangedFiles(baseSha: string): string[] {
  const output = runGit([
    'diff',
    '--name-only',
    '--diff-filter=ACMR',
    `${baseSha}...HEAD`,
  ]);
  return output.split(/\r?\n/).map((file) => file.trim()).filter(Boolean);
}

function writeGithubOutput(name: string, value: string | boolean): void {
  const outputPath = process.env.GITHUB_OUTPUT;
  if (!outputPath) return;
  appendFileSync(outputPath, `${name}=${String(value)}\n`);
}

function writePlanOutputs(baseSha: string, headSha: string, plan: ConsueloCiPlan): void {
  writeGithubOutput('base_ref', baseSha);
  writeGithubOutput('head_sha', headSha);
  writeGithubOutput('verify', plan.verify);
  writeGithubOutput('workflow_security', plan.workflowSecurity);
  writeGithubOutput('os_contracts', plan.osContracts);
  writeGithubOutput('dialer', plan.dialer);
  writeGithubOutput('sites_gateway_cloudflare', plan.sitesGatewayCloudflare);
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  const eventPayload = readEventPayload();
  const baseRef = resolveBaseRef(args, eventPayload);
  fetchRemoteRefIfNeeded(baseRef);
  const baseSha = runGit(['rev-parse', `${baseRef}^{commit}`]);
  const headSha = runGit(['rev-parse', 'HEAD']);
  const changedFiles = readChangedFiles(baseSha);
  const plan = classifyConsueloChanges(changedFiles);

  writePlanOutputs(baseSha, headSha, plan);
  process.stdout.write(`${JSON.stringify({ baseRef: baseSha, headSha, changedFiles, plan }, null, 2)}\n`);
}

if (import.meta.main) {
  try {
    main();
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'unknown Consuelo CI planning error';
    process.stderr.write(`${message}\n`);
    process.exit(1);
  }
}
