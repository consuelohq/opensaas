#!/usr/bin/env bun

import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { assertRequiredDeviceAuthorityWorkerSecrets } from '../../os/scripts/lib/device-authority-release-readiness';
import { fetchGoogleCloudPublicPricingRuntime } from '../../os/scripts/lib/google-cloud-public-pricing-refresh';
import { createDefaultManagedCloudPricingRuntime, type DefaultManagedCloudPricingRuntime } from '../../os/scripts/lib/managed-cloud-public-pricing';
import { getSitesPaths, materializeSites } from '../../os/scripts/lib/sites';
import { WORKSPACE_RELEASE_MANAGED_SITE_SNAPSHOT_IDS } from '../../os/scripts/lib/workspace-edge-route-seed';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(SCRIPT_DIR, '..', '..', '..');
const WORKER_DIR = resolve(REPO_ROOT, 'packages/os/cloudflare/os-device-authority');
const WORKER_NAME = 'consuelo-os-device-authority';
const HEALTH_URL = 'https://os.consuelohq.com/health';
const RELEASE_SITE_REFRESH_URL = 'https://os.consuelohq.com/internal/release/site-snapshots/refresh';
const DEVICE_PAGE_URL = 'https://os.consuelohq.com/login/device?user_code=RELSMOKE';
const DEVICE_CODE_URL = 'https://os.consuelohq.com/login/device/code';
const REQUEST_TIMEOUT_MS = 30_000;
const DEFAULT_VERIFY_ATTEMPTS = 12;
const DEFAULT_VERIFY_DELAY_MS = 5_000;
const RELEASE_SITE_REFRESH_ATTEMPTS = 12;
const RELEASE_SITE_REFRESH_RETRY_MS = 1_000;
const SNAPSHOT_BUCKET = 'consuelo-sites-snapshots';
const DEFAULT_SNAPSHOT_WORKSPACE_ID = 'workspace_testing';
const SNAPSHOT_CONTENT_TYPE = 'text/html; charset=utf-8';

type Options = {
  dryRun: boolean;
  verifyOnly: boolean;
  noVerify: boolean;
  verifyAttempts: number;
  verifyDelayMs: number;
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
  sleepImpl: (ms: number) => Promise<void>;
  managedCloudPricingLoader: () => Promise<DefaultManagedCloudPricingRuntime>;
};

type ReleaseDependencyOverrides = Partial<ReleaseDependencies>;

type DefaultSiteSnapshot = {
  key: string;
  versionId: string;
  siteContentHashes: Record<string, string>;
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

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
  const fetchImpl = overrides.fetchImpl ?? fetch;
  return {
    commandRunner: overrides.commandRunner ?? defaultCommandRunner,
    writeOut: overrides.writeOut ?? defaultWriteOut,
    writeErr: overrides.writeErr ?? defaultWriteErr,
    fetchImpl,
    sleepImpl: overrides.sleepImpl ?? defaultSleep,
    managedCloudPricingLoader:
      overrides.managedCloudPricingLoader ??
      (() => fetchGoogleCloudPublicPricingRuntime({ fetchImpl })),
  };
}

function helpText(): string {
  return `Usage: bun run os:release-device-auth -- [options]

Release the Consuelo OS device approval authority Worker to os.consuelohq.com.

Options:
  --dry-run       Run wrangler deploy --dry-run only
  --verify-only   Skip deploy and verify the current live Worker
  --no-verify     Skip live verification after deploy
  --verify-attempts <n>  Verification attempts after deploy. Default: ${DEFAULT_VERIFY_ATTEMPTS}
  --verify-delay-ms <n>  Delay between verification attempts. Default: ${DEFAULT_VERIFY_DELAY_MS}
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
    verifyAttempts: DEFAULT_VERIFY_ATTEMPTS,
    verifyDelayMs: DEFAULT_VERIFY_DELAY_MS,
    help: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
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
      case '--verify-attempts':
        options.verifyAttempts = parsePositiveInteger(
          requireValue(argv, ++index, arg),
          arg,
        );
        break;
      case '--verify-delay-ms':
        options.verifyDelayMs = parsePositiveInteger(
          requireValue(argv, ++index, arg),
          arg,
        );
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

function requireValue(argv: string[], index: number, flag: string): string {
  const value = argv[index];
  if (!value || value.startsWith('--')) {
    throw new Error(`${flag} requires a value`);
  }
  return value;
}

function parsePositiveInteger(value: string, flag: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error(`${flag} requires a positive integer`);
  }
  return parsed;
}

function snapshotVersionId(html: string): string {
  return `sha256-${createHash('sha256').update(html).digest('hex').slice(0, 16)}`;
}

function commandForLog(input: ReleaseCommand): string {
  const args = input.args.map((arg, index) => {
    if (input.args[index - 1] !== '--var') return arg;
    if (!arg.startsWith('OS_MANAGED_CLOUD_')) return arg;
    const separator = arg.indexOf(':');
    return separator < 0
      ? '<managed-cloud-pricing>'
      : `${arg.slice(0, separator)}:<redacted-pricing>`;
  });
  return [input.command, ...args].join(' ');
}

function runCommand(
  input: ReleaseCommand,
  deps: ReleaseDependencies,
  options: { announce?: boolean } = {},
): ReleaseCommandResult {
  if (options.announce !== false) {
    deps.writeOut(`$ ${commandForLog(input)}`);
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

function releaseManagedRouteRefreshSecret(): string {
  const secret = process.env.OS_MANAGED_CLOUD_PROVISIONER_SECRET?.trim();
  if (!secret) {
    throw new Error(
      'OS_MANAGED_CLOUD_PROVISIONER_SECRET is required to refresh release-managed workspace routes',
    );
  }
  return secret;
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
      workspaceHost: null,
    });
    const paths = getSitesPaths(tempHome);
    const snapshots = [
      { siteId: 'launcher', filePath: paths.indexPath },
      { siteId: 'artifacts', filePath: paths.artifactsIndexPath },
      { siteId: 'traces', filePath: paths.tracesIndexPath },
      { siteId: 'diffs', filePath: paths.diffsIndexPath },
      { siteId: 'docs', filePath: paths.docsIndexPath },
      { siteId: 'configuration', filePath: paths.configurationIndexPath },
      { siteId: 'tools', filePath: paths.toolsIndexPath },
      { siteId: 'nodes', filePath: paths.nodesIndexPath },
      { siteId: 'environments', filePath: paths.environmentsIndexPath },
      { siteId: 'secrets', filePath: paths.secretsIndexPath },
    ];
    const siteContentHashes = Object.fromEntries(
      snapshots.map((snapshot) => [
        snapshot.siteId,
        createHash('sha256')
          .update(readFileSync(snapshot.filePath, 'utf8'))
          .digest('hex'),
      ]),
    ) as Record<string, string>;
    const snapshotFingerprint = JSON.stringify(
      snapshots.map((snapshot) => ({
        siteId: snapshot.siteId,
        sha256: siteContentHashes[snapshot.siteId],
      })),
    );
    const versionId = snapshotVersionId(snapshotFingerprint);

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
      siteContentHashes,
    };
  } finally {
    rmSync(tempHome, { recursive: true, force: true });
  }
}

async function refreshReleaseManagedWorkspaceSiteRoutes(
  snapshot: DefaultSiteSnapshot,
  dryRun: boolean,
  deps: ReleaseDependencies,
): Promise<void> {
  if (dryRun) {
    deps.writeOut(
      `plannedRouteRefresh=workspace_route_registry:${snapshot.versionId}`,
    );
    return;
  }
  const releaseRouteSecret = releaseManagedRouteRefreshSecret();
  const requestInit: RequestInit = {
    method: 'POST',
    headers: {
      authorization: `Bearer ${releaseRouteSecret}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      versionId: snapshot.versionId,
      snapshotWorkspaceId: DEFAULT_SNAPSHOT_WORKSPACE_ID,
      siteContentHashes: Object.fromEntries(
        WORKSPACE_RELEASE_MANAGED_SITE_SNAPSHOT_IDS.map((siteId) => [
          siteId,
          snapshot.siteContentHashes[siteId],
        ]),
      ),
    }),
  };
  for (let attempt = 1; attempt <= RELEASE_SITE_REFRESH_ATTEMPTS; attempt += 1) {
    deps.writeOut(
      `Refreshing ${RELEASE_SITE_REFRESH_URL} (attempt ${attempt}/${RELEASE_SITE_REFRESH_ATTEMPTS})`,
    );
    let response: Response;
    try {
      response = await fetchWithDefaults(RELEASE_SITE_REFRESH_URL, deps.fetchImpl, requestInit);
    } catch (error: unknown) {
      if (attempt < RELEASE_SITE_REFRESH_ATTEMPTS) {
        await deps.sleepImpl(RELEASE_SITE_REFRESH_RETRY_MS);
        continue;
      }
      throw new Error(
        `workspace route refresh request failed: ${requestFailureMessage(error)}`,
        { cause: error },
      );
    }
    if (response.ok) {
      deps.writeOut(`refreshedRoutes=workspace_route_registry:${snapshot.versionId}`);
      return;
    }
    const detail = (await response.text()).trim();
    const transient = response.status === 404
      || response.status === 408
      || response.status === 425
      || response.status === 429
      || response.status >= 500;
    if (transient && attempt < RELEASE_SITE_REFRESH_ATTEMPTS) {
      await deps.sleepImpl(RELEASE_SITE_REFRESH_RETRY_MS);
      continue;
    }
    throw new Error(
      `workspace route refresh failed with HTTP ${response.status}${detail ? `: ${detail}` : ''}`,
    );
  }
  throw new Error('workspace route refresh attempts exhausted');
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

async function verifyDeviceAuthorityAttempt(
  deps: ReleaseDependencies,
): Promise<void> {
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
    if (error instanceof Error) throw error;
    throw new Error(String(error));
  }
}

async function verifyDeviceAuthority(
  options: Pick<Options, 'verifyAttempts' | 'verifyDelayMs'>,
  deps: ReleaseDependencies,
): Promise<void> {
  let lastError: unknown = null;

  for (let attempt = 1; attempt <= options.verifyAttempts; attempt += 1) {
    deps.writeOut(
      `Verifying ${HEALTH_URL} (attempt ${attempt}/${options.verifyAttempts})`,
    );

    try {
      await verifyDeviceAuthorityAttempt(deps);
      return;
    } catch (error: unknown) {
      lastError = error;
      if (attempt === options.verifyAttempts) break;
      const message = error instanceof Error ? error.message : String(error);
      deps.writeOut(`Verification not ready: ${message}`);
      await deps.sleepImpl(options.verifyDelayMs);
    }
  }

  const message = lastError instanceof Error ? lastError.message : String(lastError);
  throw new Error(
    `Device authority verification failed after ${options.verifyAttempts} attempts: ${message}`,
  );
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
    if (!options.dryRun) releaseManagedRouteRefreshSecret();
  }

  deps.writeOut(`workerDir=${WORKER_DIR}`);
  deps.writeOut(`worker=${WORKER_NAME}`);
  deps.writeOut('route=os.consuelohq.com/*');

  if (!options.verifyOnly) {
    const defaultSiteSnapshot = releaseDefaultSiteSnapshots(options.dryRun, deps);
    deps.writeOut(`defaultSiteSnapshotKey=${defaultSiteSnapshot.key}`);
    deps.writeOut(`defaultSiteSnapshotVersion=${defaultSiteSnapshot.versionId}`);
    let managedCloudPricing: DefaultManagedCloudPricingRuntime;
    try {
      managedCloudPricing = options.dryRun
        ? createDefaultManagedCloudPricingRuntime()
        : await deps.managedCloudPricingLoader();
    } catch (error: unknown) {
      throw new Error(
        `managed cloud pricing refresh failed: ${error instanceof Error ? error.message : String(error)}`,
        { cause: error },
      );
    }
    deps.writeOut(`managedCloudPricingVersion=${managedCloudPricing.policy.pricingVersion}`);

    const deployArgs = [
      'deploy',
      '--keep-vars',
      '--var',
      `OS_DEVICE_AUTH_DEFAULT_SITE_SNAPSHOT_KEY:${defaultSiteSnapshot.key}`,
      '--var',
      `OS_DEVICE_AUTH_DEFAULT_SITE_SNAPSHOT_VERSION_ID:${defaultSiteSnapshot.versionId}`,
      '--var',
      `OS_MANAGED_CLOUD_PRICING_POLICY_JSON:${JSON.stringify(managedCloudPricing.policy)}`,
      '--var',
      `OS_MANAGED_CLOUD_RATE_CARDS_JSON:${JSON.stringify(managedCloudPricing.rateCards)}`,
    ];
    if (options.dryRun) deployArgs.push('--dry-run');
    runCommand({
      command: 'wrangler',
      args: deployArgs,
      cwd: WORKER_DIR,
      stdio: 'inherit',
    }, deps);
    await refreshReleaseManagedWorkspaceSiteRoutes(
      defaultSiteSnapshot,
      options.dryRun,
      deps,
    );
  }

  if (!options.dryRun && !options.noVerify) {
    await verifyDeviceAuthority(options, deps);
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
