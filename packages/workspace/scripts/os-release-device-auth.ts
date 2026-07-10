#!/usr/bin/env bun

import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { assertRequiredDeviceAuthorityWorkerSecrets } from '../../os/scripts/lib/device-authority-release-readiness';
import { getSitesPaths, materializeSites } from '../../os/scripts/lib/sites';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(SCRIPT_DIR, '..', '..', '..');
const WORKER_DIR = resolve(REPO_ROOT, 'packages/os/cloudflare/os-device-authority');
const WORKER_NAME = 'consuelo-os-device-authority';
const HEALTH_URL = 'https://os.consuelohq.com/health';
const DEVICE_PAGE_URL = 'https://os.consuelohq.com/login/device?user_code=RELSMOKE';
const DEVICE_CODE_URL = 'https://os.consuelohq.com/login/device/code';
const REQUEST_TIMEOUT_MS = 30_000;
const SNAPSHOT_BUCKET = 'consuelo-sites-snapshots';
const DEFAULT_SNAPSHOT_WORKSPACE_ID = 'workspace_testing';
const DEFAULT_SNAPSHOT_HOST = 'sites.consuelohq.com';
const SNAPSHOT_CONTENT_TYPE = 'text/html; charset=utf-8';

type Options = {
  dryRun: boolean;
  verifyOnly: boolean;
  noVerify: boolean;
  help: boolean;
};

export type ReleaseCommand = {
  command: string;
  args: string[];
  cwd?: string;
  stdio?: 'inherit' | 'pipe';
};

export type ReleaseCommandResult = {
  status: number | null;
  stdout: string;
  stderr: string;
  error?: Error;
};

export type ReleaseCommandRunner = (
  command: ReleaseCommand,
) => ReleaseCommandResult;

type ReleaseDependencies = {
  commandRunner: ReleaseCommandRunner;
  writeOut: (message?: string) => void;
  writeErr: (message?: string) => void;
  fetchImpl: typeof fetch;
};

type ReleaseDependencyOverrides = Partial<ReleaseDependencies>;

type DefaultSiteSnapshot = {
  key: string;
  versionId: string;
};

type HealthResponse = {
  status: number;
  json: Record<string, unknown>;
};

function defaultWriteOut(message = ''): void {
  process.stdout.write(`${message}\n`);
}

function defaultWriteErr(message = ''): void {
  process.stderr.write(`${message}\n`);
}

function defaultCommandRunner(input: ReleaseCommand): ReleaseCommandResult {
  const stdio = input.stdio ?? 'inherit';
  const result = spawnSync(input.command, input.args, {
    cwd: input.cwd ?? REPO_ROOT,
    stdio,
    encoding: stdio === 'pipe' ? 'utf8' : undefined,
  });

  return {
    status: result.status,
    stdout: typeof result.stdout === 'string' ? result.stdout : '',
    stderr: typeof result.stderr === 'string' ? result.stderr : '',
    ...(result.error ? { error: result.error } : {}),
  };
}

function dependencies(
  overrides: ReleaseDependencyOverrides = {},
): ReleaseDependencies {
  return {
    commandRunner: overrides.commandRunner ?? defaultCommandRunner,
    writeOut: overrides.writeOut ?? defaultWriteOut,
    writeErr: overrides.writeErr ?? defaultWriteErr,
    fetchImpl: overrides.fetchImpl ?? fetch,
  };
}

function helpText(): string {
  return `Usage: bun run os:release-device-auth -- [options]

Release the Consuelo OS device approval authority Worker to os.consuelohq.com.

Options:
  --dry-run       Run wrangler deploy --dry-run only
  --verify-only   Skip deploy and verify the current live Worker
  --no-verify     Skip live verification after deploy
  --help          Show this help

Examples:
  bun run os:release-device-auth -- --dry-run
  bun run os:release-device-auth
  bun run os:release-device-auth -- --verify-only
  bun run os:release-device-auth -- --no-verify`;
}

function parseArgs(argv: string[]): Options {
  const options: Options = {
    dryRun: false,
    verifyOnly: false,
    noVerify: false,
    help: false,
  };

  for (const arg of argv) {
    switch (arg) {
      case '--help':
      case '-h':
        options.help = true;
        break;
      case '--dry-run':
        options.dryRun = true;
        break;
      case '--verify-only':
        options.verifyOnly = true;
        break;
      case '--no-verify':
        options.noVerify = true;
        break;
      default:
        throw new Error(`Unknown option: ${arg}`);
    }
  }

  if (options.verifyOnly && options.noVerify) {
    throw new Error('--verify-only and --no-verify are mutually exclusive');
  }
  if (options.verifyOnly && options.dryRun) {
    throw new Error('--verify-only cannot be combined with --dry-run');
  }

  return options;
}

function snapshotVersionId(html: string): string {
  return `sha256-${createHash('sha256').update(html).digest('hex').slice(0, 16)}`;
}

function runCommand(
  input: ReleaseCommand,
  deps: ReleaseDependencies,
  options: { announce?: boolean } = {},
): ReleaseCommandResult {
  if (options.announce !== false) {
    deps.writeOut(`$ ${[input.command, ...input.args].join(' ')}`);
  }
  const result = deps.commandRunner(input);

  if (result.error) {
    throw new Error(`Failed to spawn ${input.command}: ${result.error.message}`);
  }
  if (result.status !== 0) {
    throw new Error(
      `${input.command} ${input.args.join(' ')} failed with exit code ${result.status ?? 'unknown'}`,
    );
  }
  return result;
}

function assertRemoteWorkerReleaseReadiness(deps: ReleaseDependencies): void {
  const result = runCommand({
    command: 'wrangler',
    args: [
      'secret',
      'list',
      '--name',
      WORKER_NAME,
      '--format',
      'json',
    ],
    cwd: WORKER_DIR,
    stdio: 'pipe',
  }, deps, { announce: false });
  assertRequiredDeviceAuthorityWorkerSecrets(result.stdout);
}

function releaseDefaultSiteSnapshots(
  dryRun: boolean,
  deps: ReleaseDependencies,
): DefaultSiteSnapshot {
  const tempHome = mkdtempSync(join(tmpdir(), 'consuelo-os-device-auth-sites-'));
  const dbPath = join(tempHome, 'empty.sqlite');
  try {
    materializeSites({
      home: tempHome,
      dbPath,
      dryRun: false,
      workspaceHost: DEFAULT_SNAPSHOT_HOST,
    });
    const paths = getSitesPaths(tempHome);
    const rootHtml = readFileSync(paths.indexPath, 'utf8');
    const versionId = snapshotVersionId(rootHtml);
    const snapshots = [
      { siteId: 'launcher', filePath: paths.indexPath },
      { siteId: 'office', filePath: paths.officeIndexPath },
      { siteId: 'traces', filePath: paths.tracesIndexPath },
      { siteId: 'diffs', filePath: paths.diffsIndexPath },
      { siteId: 'docs', filePath: paths.docsIndexPath },
    ];

    for (const snapshot of snapshots) {
      const key = `sites/${DEFAULT_SNAPSHOT_WORKSPACE_ID}/${snapshot.siteId}/${versionId}/index.html`;
      if (dryRun) {
        deps.writeOut(`plannedSnapshot=r2://${SNAPSHOT_BUCKET}/${key}`);
        continue;
      }
      runCommand({
        command: 'wrangler',
        args: [
          'r2',
          'object',
          'put',
          `${SNAPSHOT_BUCKET}/${key}`,
          '--remote',
          '--file',
          snapshot.filePath,
          '--content-type',
          SNAPSHOT_CONTENT_TYPE,
        ],
        cwd: WORKER_DIR,
        stdio: 'inherit',
      }, deps);
    }

    return {
      key: `sites/${DEFAULT_SNAPSHOT_WORKSPACE_ID}/launcher/${versionId}/index.html`,
      versionId,
    };
  } finally {
    rmSync(tempHome, { recursive: true, force: true });
  }
}

async function fetchWithDefaults(
  url: string,
  fetchImpl: typeof fetch,
  init?: RequestInit,
): Promise<Response> {
  const signal = init?.signal ?? AbortSignal.timeout(REQUEST_TIMEOUT_MS);
  return fetchImpl(url, {
    ...init,
    signal,
    headers: {
      'user-agent': 'consuelo-os-release-operator/1.0',
      ...(init?.headers ?? {}),
    },
  });
}

function requestFailureMessage(error: unknown): string {
  const errorName = error instanceof Error ? error.name : '';
  const errorMessage = error instanceof Error ? error.message : String(error);
  return errorName === 'TimeoutError' || errorName === 'AbortError'
    ? `timed out after ${REQUEST_TIMEOUT_MS}ms`
    : errorMessage;
}

async function readJson(
  url: string,
  fetchImpl: typeof fetch,
  init?: RequestInit,
): Promise<HealthResponse> {
  try {
    const response = await fetchWithDefaults(url, fetchImpl, init);
    const json = await response.json() as Record<string, unknown>;
    return { status: response.status, json };
  } catch (error: unknown) {
    throw new Error(`Device authority request failed: ${requestFailureMessage(error)}`);
  }
}

async function readText(
  url: string,
  fetchImpl: typeof fetch,
  init?: RequestInit,
): Promise<{ status: number; text: string }> {
  try {
    const response = await fetchWithDefaults(url, fetchImpl, init);
    return { status: response.status, text: await response.text() };
  } catch (error: unknown) {
    throw new Error(`Device authority request failed: ${requestFailureMessage(error)}`);
  }
}

export function assertDeviceAuthorityHealth(health: HealthResponse): void {
  if (health.status !== 200 || health.json.ok !== true) {
    throw new Error(`Device authority health check failed: status=${health.status}`);
  }
  if (health.json.connector_provisioning_configured !== true) {
    throw new Error('Device authority connector provisioning is not configured');
  }
}

async function verifyDeviceAuthority(deps: ReleaseDependencies): Promise<void> {
  try {
    const health = await readJson(HEALTH_URL, deps.fetchImpl);
    assertDeviceAuthorityHealth(health);
    deps.writeOut(`Verified ${HEALTH_URL}`);

    const devicePage = await readText(DEVICE_PAGE_URL, deps.fetchImpl);
    const expectedGoogleStartHref = 'href="https://os.consuelohq.com/login/google/start?user_code=RELSMOKE"';
    if (devicePage.status !== 200 || !devicePage.text.includes(expectedGoogleStartHref)) {
      throw new Error(`Device authority Google approval page check failed: status=${devicePage.status}`);
    }
    deps.writeOut('Verified Google approval entrypoint on os.consuelohq.com');

    const missingKey = await readJson(DEVICE_CODE_URL, deps.fetchImpl, {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: 'consuelo-os-release-smoke',
        workspace_name: 'release-smoke',
        workspace_slug: 'release-smoke',
        workspace_host: 'release-smoke.consuelohq.com',
      }),
    });

    if (missingKey.status !== 400 || missingKey.json.error !== 'device_public_key_required') {
      throw new Error(`Device authority hardening check failed: status=${missingKey.status}`);
    }
    deps.writeOut('Verified device_public_key_required hardening contract');
  } catch (error: unknown) {
    throw new Error(
      `Device authority verification failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

async function runDeviceAuthorityRelease(
  argv: string[],
  deps: ReleaseDependencies,
): Promise<void> {
  const options = parseArgs(argv);
  if (options.help) {
    deps.writeOut(helpText());
    return;
  }

  if (!options.verifyOnly) {
    assertRemoteWorkerReleaseReadiness(deps);
  }

  deps.writeOut(`workerDir=${WORKER_DIR}`);
  deps.writeOut(`worker=${WORKER_NAME}`);
  deps.writeOut('route=os.consuelohq.com/*');

  if (!options.verifyOnly) {
    const defaultSiteSnapshot = releaseDefaultSiteSnapshots(options.dryRun, deps);
    deps.writeOut(`defaultSiteSnapshotKey=${defaultSiteSnapshot.key}`);
    deps.writeOut(`defaultSiteSnapshotVersion=${defaultSiteSnapshot.versionId}`);

    const deployArgs = [
      'deploy',
      '--keep-vars',
      '--var',
      `OS_DEVICE_AUTH_DEFAULT_SITE_SNAPSHOT_KEY:${defaultSiteSnapshot.key}`,
      '--var',
      `OS_DEVICE_AUTH_DEFAULT_SITE_SNAPSHOT_VERSION_ID:${defaultSiteSnapshot.versionId}`,
    ];
    if (options.dryRun) deployArgs.push('--dry-run');
    runCommand({
      command: 'wrangler',
      args: deployArgs,
      cwd: WORKER_DIR,
      stdio: 'inherit',
    }, deps);
  }

  if (!options.dryRun && !options.noVerify) {
    await verifyDeviceAuthority(deps);
  }
}

export async function runDeviceAuthorityReleaseCli(
  argv: string[],
  overrides: ReleaseDependencyOverrides = {},
): Promise<number> {
  const deps = dependencies(overrides);
  try {
    await runDeviceAuthorityRelease(argv, deps);
    return 0;
  } catch (error: unknown) {
    deps.writeErr(error instanceof Error ? error.message : String(error));
    return 1;
  }
}

if (import.meta.main) {
  process.exitCode = await runDeviceAuthorityReleaseCli(process.argv.slice(2));
}
