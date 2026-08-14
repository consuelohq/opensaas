#!/usr/bin/env bun

import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const REPO_ROOT = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  '..',
);
const DEFAULT_BOOTSTRAP_PATH = 'packages/os/scripts/bootstrap.sh';
const DEFAULT_WORKER_NAME = 'consuelo-os-install';
const DEFAULT_DOMAIN = 'install.consuelohq.com';
const DEFAULT_PATHNAME = '/os';
const DEFAULT_COMPATIBILITY_DATE = '2026-06-02';
const RELEASE_KEYS_PLACEHOLDER = '__CONSUELO_RELEASE_PUBLIC_KEYS_BASE64__';


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

function requiredEnvironmentValue(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

export function trustedReleaseKeysJson(
  env: NodeJS.ProcessEnv = process.env,
): string {
  const keyId = env.CONSUELO_OS_RELEASE_SIGNING_KEY_ID?.trim();
  const publicKey = env.CONSUELO_OS_RELEASE_SIGNING_PUBLIC_KEY?.trim();
  const encoded = env.CONSUELO_OS_RELEASE_TRUSTED_PUBLIC_KEYS?.trim();
  let keys: Record<string, string> = {};
  if (encoded) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(encoded) as unknown;
    } catch (error: unknown) {
      throw new Error(
        'CONSUELO_OS_RELEASE_TRUSTED_PUBLIC_KEYS is not valid JSON',
        { cause: error },
      );
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error(
        'CONSUELO_OS_RELEASE_TRUSTED_PUBLIC_KEYS must be a JSON object',
      );
    }
    keys = Object.fromEntries(
      Object.entries(parsed as Record<string, unknown>).map(([id, value]) => {
        if (typeof value !== 'string' || !value.trim()) {
          throw new Error(`trusted release key ${id} must be a PEM string`);
        }
        return [id, value];
      }),
    );
  }
  if (keyId && publicKey) keys[keyId] = publicKey;
  if (Object.keys(keys).length === 0) {
    throw new Error(
      'CONSUELO_OS_RELEASE_TRUSTED_PUBLIC_KEYS or the current signing key is required',
    );
  }
  return JSON.stringify(keys);
}

export function materializeHostedBootstrap(
  bootstrap: string,
  env: NodeJS.ProcessEnv = process.env,
): string {
  if (!bootstrap.includes(RELEASE_KEYS_PLACEHOLDER)) {
    throw new Error('bootstrap release-key placeholder is missing');
  }
  const encoded = Buffer.from(trustedReleaseKeysJson(env), 'utf8').toString(
    'base64',
  );
  return bootstrap.replaceAll(RELEASE_KEYS_PLACEHOLDER, encoded);
}

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

export function buildWorkerSource(
  bootstrap: string,
  options: Pick<Options, 'pathname'>,
  sha256: string,
): string {
  const bootstrapLiteral = JSON.stringify(bootstrap);
  const pathLiteral = JSON.stringify(options.pathname);
  const shaLiteral = JSON.stringify(sha256);

  return `const BOOTSTRAP = ${bootstrapLiteral};
const INSTALL_PATH = ${pathLiteral};
const RELEASE_PATH = \`\${INSTALL_PATH}/releases/\`;
const BOOTSTRAP_SHA256 = ${shaLiteral};

export default {
  async fetch(request, env) {
    try {
      const url = new URL(request.url);

      if (url.pathname === '/') {
        return Response.redirect(new URL(INSTALL_PATH, url.origin), 302);
      }

      if (url.pathname.startsWith(RELEASE_PATH)) {
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
        const key = url.pathname.slice(RELEASE_PATH.length);
        const allowed = /^channels\\/(?:dev|canary|beta|stable|nightly)\\.json$/.test(key) ||
          /^bundles\\/sha256:[a-f0-9]{64}\\/[A-Za-z0-9._+-]+\\.tar\\.gz(?:\\.sig)?$/.test(key);
        if (!allowed || key.includes('..')) {
          return new Response('Not found\\n', {
            status: 404,
            headers: {
              'content-type': 'text/plain; charset=utf-8',
              'x-content-type-options': 'nosniff',
            },
          });
        }
        const object = await env.CONSUELO_OS_RELEASES.get(key);
        if (!object) {
          return new Response('Not found\\n', {
            status: 404,
            headers: {
              'content-type': 'text/plain; charset=utf-8',
              'x-content-type-options': 'nosniff',
            },
          });
        }
        const headers = new Headers();
        object.writeHttpMetadata(headers);
        headers.set(
          'cache-control',
          key.startsWith('bundles/')
            ? 'public, max-age=31536000, immutable'
            : 'public, max-age=60, must-revalidate',
        );
        headers.set(
          'content-type',
          key.endsWith('.json')
            ? 'application/json; charset=utf-8'
            : 'application/gzip',
        );
        headers.set('etag', object.httpEtag);
        headers.set('x-content-type-options', 'nosniff');
        return new Response(request.method === 'HEAD' ? null : object.body, {
          status: 200,
          headers,
        });
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
    } catch {
      return new Response('Internal error\\n', {
        status: 500,
        headers: {
          'content-type': 'text/plain; charset=utf-8',
          'x-content-type-options': 'nosniff',
        },
      });
    }
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
  const bootstrap = materializeHostedBootstrap(
    readFileSync(bootstrapPath, 'utf8'),
  );
  const sha256 = createHash('sha256').update(bootstrap).digest('hex');
  const installUrl = `https://${options.domain}${options.pathname}`;

  writeOut(`bootstrap=${options.scriptPath}`);
  writeOut(`sha256=${sha256}`);
  writeOut(`installUrl=${installUrl}`);

  if (options.verifyOnly) {
    try {
      await verifyInstallUrl(installUrl, sha256, options);
    } catch (error: unknown) {
      throw new Error(
        `Hosted installer verification failed for ${installUrl}`,
        { cause: error },
      );
    }
    return;
  }

  const tempDir = mkdtempSync(join(tmpdir(), 'consuelo-os-install-worker-'));
  const workerPath = join(tempDir, 'worker.js');
  const wranglerPath = join(tempDir, 'wrangler.toml');
  writeFileSync(workerPath, buildWorkerSource(bootstrap, options, sha256));
  const releaseBucket = requiredEnvironmentValue(
    'CONSUELO_OS_RELEASE_R2_BUCKET',
  );
  writeFileSync(
    wranglerPath,
    [
      `name = ${JSON.stringify(options.workerName)}`,
      `main = ${JSON.stringify(workerPath)}`,
      `compatibility_date = ${JSON.stringify(options.compatibilityDate)}`,
      `routes = [{ pattern = ${JSON.stringify(options.domain)}, custom_domain = true }]`,
      '',
      '[[r2_buckets]]',
      'binding = "CONSUELO_OS_RELEASES"',
      `bucket_name = ${JSON.stringify(releaseBucket)}`,
      '',
    ].join('\n'),
  );
  writeOut(`generated=${workerPath}`);

  try {
    if (!options.noDeploy) {
      const deployArgs = [
        'deploy',
        '--config',
        wranglerPath,
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

if (import.meta.main) {
  main().catch((error) => {
    writeErr(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
