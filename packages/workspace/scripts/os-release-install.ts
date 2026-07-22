#!/usr/bin/env bun

import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const REPO_ROOT = resolve(import.meta.dir, '..', '..', '..');
const DEFAULT_BOOTSTRAP_PATH = 'packages/os/scripts/bootstrap.sh';
const DEFAULT_WORKER_NAME = 'consuelo-os-install';
const DEFAULT_DOMAIN = 'install.consuelohq.com';
const DEFAULT_PATHNAME = '/os';
const DEFAULT_COMPATIBILITY_DATE = '2026-06-02';


function writeOut(message = ''): void {
  process.stdout.write(`${message}\n`);
}

function writeErr(message = ''): void {
  process.stderr.write(`${message}\n`);
}

type Options = {
  scriptPath: string;
  workerName: string;
  domain: string;
  pathname: string;
  compatibilityDate: string;
  dryRun: boolean;
  verifyOnly: boolean;
  noDeploy: boolean;
  noVerify: boolean;
  keepTemp: boolean;
  verifyAttempts: number;
  verifyDelayMs: number;
};

function printHelp() {
  writeOut(`Usage: bun run os:release-install -- [options]

Release the Consuelo OS curl installer to Cloudflare Workers.

This is an operator-only script. It reads the public bootstrap source from
packages/os/scripts/bootstrap.sh, generates a tiny Worker, deploys it with
wrangler, then verifies the public install URL.

Options:
  --script-path <path>          Bootstrap source path. Default: ${DEFAULT_BOOTSTRAP_PATH}
  --worker-name <name>          Cloudflare Worker name. Default: ${DEFAULT_WORKER_NAME}
  --domain <domain>             Worker custom domain. Default: ${DEFAULT_DOMAIN}
  --pathname <path>             Installer path on domain. Default: ${DEFAULT_PATHNAME}
  --compatibility-date <date>   Worker compatibility date. Default: ${DEFAULT_COMPATIBILITY_DATE}
  --dry-run                     Generate and run wrangler deploy --dry-run only
  --verify-only                 Skip deploy and verify the current public URL
  --no-deploy                   Generate Worker but skip wrangler deploy
  --no-verify                   Skip public URL verification after deploy
  --keep-temp                   Keep generated temporary Worker file
  --verify-attempts <n>         Verification attempts after deploy. Default: 12
  --verify-delay-ms <n>         Delay between verification attempts. Default: 5000
  --help                        Show this help

Examples:
  bun run os:release-install -- --dry-run
  bun run os:release-install
  bun run os:release-install -- --verify-only
`);
}

function parseArgs(argv: string[]): Options {
  const options: Options = {
    scriptPath: DEFAULT_BOOTSTRAP_PATH,
    workerName: DEFAULT_WORKER_NAME,
    domain: DEFAULT_DOMAIN,
    pathname: DEFAULT_PATHNAME,
    compatibilityDate: DEFAULT_COMPATIBILITY_DATE,
    dryRun: false,
    verifyOnly: false,
    noDeploy: false,
    noVerify: false,
    keepTemp: false,
    verifyAttempts: 12,
    verifyDelayMs: 5_000,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    switch (arg) {
      case '--help':
      case '-h':
        printHelp();
        process.exit(0);
      case '--script-path':
        options.scriptPath = requireValue(argv, ++index, arg);
        break;
      case '--worker-name':
        options.workerName = requireValue(argv, ++index, arg);
        break;
      case '--domain':
        options.domain = requireValue(argv, ++index, arg);
        break;
      case '--pathname':
        options.pathname = normalizePathname(requireValue(argv, ++index, arg));
        break;
      case '--compatibility-date':
        options.compatibilityDate = requireValue(argv, ++index, arg);
        break;
      case '--dry-run':
        options.dryRun = true;
        break;
      case '--verify-only':
        options.verifyOnly = true;
        break;
      case '--no-deploy':
        options.noDeploy = true;
        break;
      case '--no-verify':
        options.noVerify = true;
        break;
      case '--keep-temp':
        options.keepTemp = true;
        break;
      case '--verify-attempts':
        options.verifyAttempts = parsePositiveInteger(requireValue(argv, ++index, arg), arg);
        break;
      case '--verify-delay-ms':
        options.verifyDelayMs = parsePositiveInteger(requireValue(argv, ++index, arg), arg);
        break;
      default:
        throw new Error(`Unknown option: ${arg}`);
    }
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

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizePathname(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return DEFAULT_PATHNAME;
  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
}

function run(command: string, args: string[], options: { allowFailure?: boolean } = {}) {
  writeOut(`$ ${[command, ...args].join(' ')}`);
  const result = spawnSync(command, args, {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);

  if (result.status !== 0 && !options.allowFailure) {
    throw new Error(`${command} ${args.join(' ')} failed with exit code ${result.status}`);
  }

  return result;
}

function buildWorkerSource(bootstrap: string, options: Options, sha256: string): string {
  const bootstrapLiteral = JSON.stringify(bootstrap);
  const pathLiteral = JSON.stringify(options.pathname);
  const shaLiteral = JSON.stringify(sha256);

  return `const BOOTSTRAP = ${bootstrapLiteral};
const INSTALL_PATH = ${pathLiteral};
const BOOTSTRAP_SHA256 = ${shaLiteral};

export default {
  async fetch(request) {
    const url = new URL(request.url);

    if (url.pathname === '/') {
      return Response.redirect(new URL(INSTALL_PATH, url.origin), 302);
    }

    if (url.pathname !== INSTALL_PATH) {
      return new Response('Not found\\n', {
        status: 404,
        headers: {
          'content-type': 'text/plain; charset=utf-8',
          'x-content-type-options': 'nosniff',
        },
      });
    }

    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return new Response('Method not allowed\\n', {
        status: 405,
        headers: {
          allow: 'GET, HEAD',
          'content-type': 'text/plain; charset=utf-8',
          'x-content-type-options': 'nosniff',
        },
      });
    }

    return new Response(request.method === 'HEAD' ? null : BOOTSTRAP, {
      status: 200,
      headers: {
        'cache-control': 'public, max-age=300',
        'content-type': 'text/x-shellscript; charset=utf-8',
        'x-consuelo-os-bootstrap-sha256': BOOTSTRAP_SHA256,
        'x-content-type-options': 'nosniff',
      },
    });
  },
};
`;
}

async function verifyInstallUrl(
  url: string,
  expectedSha256: string,
  options: Pick<Options, 'verifyAttempts' | 'verifyDelayMs'>,
) {
  let lastError: unknown = null;

  for (let attempt = 1; attempt <= options.verifyAttempts; attempt += 1) {
    writeOut(`Verifying ${url} (attempt ${attempt}/${options.verifyAttempts})`);

    try {
      const response = await fetch(url, {
        headers: {
          'user-agent': 'consuelo-os-release-operator/1.0',
        },
      });

      const text = await response.text();
      const contentType = response.headers.get('content-type') || '';
      const actualSha256 = createHash('sha256').update(text).digest('hex');

      if (!response.ok) {
        throw new Error(`Installer URL returned ${response.status}: ${text.slice(0, 300)}`);
      }
      if (!contentType.includes('text/x-shellscript') && !text.startsWith('#!')) {
        throw new Error(`Installer URL did not look like a shell script. content-type=${contentType}`);
      }
      if (actualSha256 !== expectedSha256) {
        throw new Error(`Installer SHA mismatch. expected=${expectedSha256} actual=${actualSha256}`);
      }

      writeOut(`Verified ${url}`);
      writeOut(`sha256=${actualSha256}`);
      return;
    } catch (error: unknown) {
      lastError = error;
      const message = error instanceof Error ? error.message : String(error);
      if (attempt === options.verifyAttempts) break;
      writeErr(`Verification not ready: ${message}`);
      await sleep(options.verifyDelayMs);
    }
  }

  const message = lastError instanceof Error ? lastError.message : String(lastError);
  throw new Error(`Installer verification failed after ${options.verifyAttempts} attempts: ${message}`);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  options.pathname = normalizePathname(options.pathname);

  const bootstrapPath = resolve(REPO_ROOT, options.scriptPath);
  const bootstrap = readFileSync(bootstrapPath, 'utf8');
  const sha256 = createHash('sha256').update(bootstrap).digest('hex');
  const installUrl = `https://${options.domain}${options.pathname}`;

  writeOut(`bootstrap=${options.scriptPath}`);
  writeOut(`sha256=${sha256}`);
  writeOut(`installUrl=${installUrl}`);

  if (options.verifyOnly) {
    await verifyInstallUrl(installUrl, sha256, options);
    return;
  }

  const tempDir = mkdtempSync(join(tmpdir(), 'consuelo-os-install-worker-'));
  const workerPath = join(tempDir, 'worker.js');
  writeFileSync(workerPath, buildWorkerSource(bootstrap, options, sha256));
  writeOut(`generated=${workerPath}`);

  try {
    if (!options.noDeploy) {
      const deployArgs = [
        'deploy',
        workerPath,
        '--name',
        options.workerName,
        '--compatibility-date',
        options.compatibilityDate,
        '--domain',
        options.domain,
        '--message',
        `release ${options.workerName} ${sha256.slice(0, 12)}`,
        '--keep-vars',
      ];

      if (options.dryRun) deployArgs.push('--dry-run');

      run('wrangler', deployArgs);
    }

    if (!options.dryRun && !options.noDeploy && !options.noVerify) {
      await verifyInstallUrl(installUrl, sha256, options);
    }
  } finally {
    if (options.keepTemp) {
      writeOut(`kept temp dir: ${tempDir}`);
    } else {
      rmSync(tempDir, { recursive: true, force: true });
    }
  }
}

main().catch((error) => {
  writeErr(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
