#!/usr/bin/env bun

import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const REPO_ROOT = resolve(import.meta.dir, '..', '..', '..');
const WORKER_DIR = resolve(REPO_ROOT, 'packages/os/cloudflare/os-device-authority');
const HEALTH_URL = 'https://os.consuelohq.com/health';
const DEVICE_PAGE_URL = 'https://os.consuelohq.com/login/device?user_code=RELSMOKE';
const DEVICE_CODE_URL = 'https://os.consuelohq.com/login/device/code';
const REQUEST_TIMEOUT_MS = 30_000;

type Options = {
  dryRun: boolean;
  verifyOnly: boolean;
  noVerify: boolean;
};

function writeOut(message = ''): void {
  process.stdout.write(`${message}\n`);
}

function writeErr(message = ''): void {
  process.stderr.write(`${message}\n`);
}

function printHelp(): void {
  writeOut(`Usage: bun run os:release-device-auth -- [options]

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
  bun run os:release-device-auth -- --no-verify
`);
}

function parseArgs(argv: string[]): Options {
  const options: Options = {
    dryRun: false,
    verifyOnly: false,
    noVerify: false,
  };

  for (const arg of argv) {
    switch (arg) {
      case '--help':
      case '-h':
        printHelp();
        process.exit(0);
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

function run(command: string, args: string[], options: { cwd?: string } = {}): void {
  writeOut(`$ ${[command, ...args].join(' ')}`);
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? REPO_ROOT,
    stdio: 'inherit',
  });

  if (result.error) {
    throw new Error(`Failed to spawn ${command}: ${result.error.message}`);
  }
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} failed with exit code ${result.status ?? 'unknown'}`);
  }
}

async function readJson(url: string, init?: RequestInit): Promise<{ status: number; json: Record<string, unknown> }> {
  try {
    const signal = init?.signal ?? AbortSignal.timeout(REQUEST_TIMEOUT_MS);
    const response = await fetch(url, {
      ...init,
      signal,
      headers: {
        'user-agent': 'consuelo-os-release-operator/1.0',
        ...(init?.headers ?? {}),
      },
    });

    const json = await response.json() as Record<string, unknown>;
    return { status: response.status, json };
  } catch (error: unknown) {
    const errorName = error instanceof Error ? error.name : '';
    const errorMessage = error instanceof Error ? error.message : String(error);
    const suffix = errorName === 'TimeoutError' || errorName === 'AbortError'
      ? `timed out after ${REQUEST_TIMEOUT_MS}ms`
      : errorMessage;
    throw new Error(`Device authority request failed: ${suffix}`);
  }
}

async function readText(url: string, init?: RequestInit): Promise<{ status: number; text: string }> {
  try {
    const signal = init?.signal ?? AbortSignal.timeout(REQUEST_TIMEOUT_MS);
    const response = await fetch(url, {
      ...init,
      signal,
      headers: {
        'user-agent': 'consuelo-os-release-operator/1.0',
        ...(init?.headers ?? {}),
      },
    });
    return { status: response.status, text: await response.text() };
  } catch (error: unknown) {
    const errorName = error instanceof Error ? error.name : '';
    const errorMessage = error instanceof Error ? error.message : String(error);
    const suffix = errorName === 'TimeoutError' || errorName === 'AbortError'
      ? `timed out after ${REQUEST_TIMEOUT_MS}ms`
      : errorMessage;
    throw new Error(`Device authority request failed: ${suffix}`);
  }
}

async function verifyDeviceAuthority(): Promise<void> {
  try {
    const health = await readJson(HEALTH_URL);
    if (health.status !== 200 || health.json.ok !== true) {
      throw new Error(`Device authority health check failed: status=${health.status}`);
    }

    writeOut(`Verified ${HEALTH_URL}`);

    const devicePage = await readText(DEVICE_PAGE_URL);
    if (
      devicePage.status !== 200 ||
      !devicePage.text.includes('/login/google/start') ||
      devicePage.text.includes('app.consuelohq.com')
    ) {
      throw new Error(`Device authority Google approval page check failed: status=${devicePage.status}`);
    }

    writeOut('Verified Google approval entrypoint on os.consuelohq.com');

    const missingKey = await readJson(DEVICE_CODE_URL, {
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

    writeOut('Verified device_public_key_required hardening contract');
  } catch (error: unknown) {
    throw new Error(`Device authority verification failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));

  writeOut(`workerDir=${WORKER_DIR}`);
  writeOut('worker=consuelo-os-device-authority');
  writeOut('route=os.consuelohq.com/*');

  if (!options.verifyOnly) {
    const deployArgs = ['deploy'];
    if (options.dryRun) deployArgs.push('--dry-run');
    run('wrangler', deployArgs, { cwd: WORKER_DIR });
  }

  if (!options.dryRun && !options.noVerify) {
    await verifyDeviceAuthority();
  }
}

main().catch((error) => {
  writeErr(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
