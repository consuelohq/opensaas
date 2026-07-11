import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { describe, expect, it } from 'vitest';

type WorkerSecretMetadata = Array<{ name: string; type?: string }>;

type ReadinessModule = {
  REQUIRED_DEVICE_AUTHORITY_WORKER_SECRETS: readonly string[];
  assertRequiredDeviceAuthorityWorkerSecrets: (secrets: WorkerSecretMetadata | string) => void;
};

type ReleaseCommand = {
  command: string;
  args: string[];
  cwd?: string;
  stdio?: 'inherit' | 'pipe';
};

type ReleaseCommandResult = {
  status: number | null;
  stdout: string;
  stderr: string;
  error?: Error;
};

type ReleaseModule = {
  runDeviceAuthorityReleaseCli: (
    argv: string[],
    dependencies: {
      commandRunner: (command: ReleaseCommand) => ReleaseCommandResult;
      writeOut: (message?: string) => void;
      writeErr: (message?: string) => void;
      fetchImpl?: typeof fetch;
      sleepImpl?: (ms: number) => Promise<void>;
    },
  ) => Promise<number>;
  assertDeviceAuthorityHealth: (health: {
    status: number;
    json: Record<string, unknown>;
  }) => void;
};

const workerConfigPath = join(
  process.cwd(),
  'cloudflare',
  'os-device-authority',
  'wrangler.toml',
);
const releaseScriptPath = resolve(
  process.cwd(),
  '..',
  'workspace',
  'scripts',
  'os-release-device-auth.ts',
);
const readinessModulePath = resolve(
  process.cwd(),
  'scripts',
  'lib',
  'device-authority-release-readiness.ts',
);

function readWorkerConfig(): Record<string, unknown> {
  const config: Record<string, Record<string, unknown>> = {};
  let section = '';
  for (const rawLine of readFileSync(workerConfigPath, 'utf8').split('\n')) {
    const line = rawLine.replace(/\s+#.*$/, '').trim();
    if (!line) continue;
    const sectionMatch = /^\[\[?([^\]]+)\]\]?$/.exec(line);
    if (sectionMatch) {
      section = sectionMatch[1];
      config[section] ??= {};
      continue;
    }
    const assignment = /^([A-Za-z0-9_]+)\s*=\s*(.+)$/.exec(line);
    if (!assignment || !section) continue;
    const [, key, rawValue] = assignment;
    if (rawValue.startsWith('[')) {
      config[section][key] = [...rawValue.matchAll(/"([^"]+)"/g)].map((match) => match[1]);
    } else {
      config[section][key] = JSON.parse(rawValue);
    }
  }
  return config;
}

async function loadReadinessModule(): Promise<ReadinessModule> {
  return await import(pathToFileURL(readinessModulePath).href) as ReadinessModule;
}

async function loadReleaseModule(): Promise<ReleaseModule> {
  return await import(pathToFileURL(releaseScriptPath).href) as ReleaseModule;
}

describe('OS device authority release contract', () => {
  it('should declare deterministic connector provisioning configuration when Worker config loads', () => {
    const config = readWorkerConfig();
    const vars = config.vars as Record<string, unknown>;

    expect(vars).toMatchObject({
      CLOUDFLARE_ACCOUNT_ID: '90b2b9dfeefcad97b9e2325b2b2e7a96',
      CLOUDFLARE_ZONE_ID: '3787f63d39977227bc1cb346e0d67dc9',
      OS_DEVICE_AUTH_BASE_DOMAIN: 'consuelohq.com',
      OS_DEVICE_AUTH_WORKSPACE_EDGE_HOSTNAME: 'workspace-edge.consuelohq.com',
      OS_DEVICE_AUTH_CONNECTOR_LOCAL_SERVICE_URL: 'http://127.0.0.1:8960',
    });
  });

  it('should declare the required server-side Cloudflare secret when Worker config loads', () => {
    const config = readWorkerConfig();

    expect(config.secrets).toEqual({
      required: ['CLOUDFLARE_API_TOKEN'],
    });
    expect(JSON.stringify(config)).not.toMatch(/CLOUDFLARE_API_TOKEN\s*[:=]\s*[^\]"}]+/);
  });

  it('should accept release readiness when required Worker secrets exist', async () => {
    const {
      REQUIRED_DEVICE_AUTHORITY_WORKER_SECRETS,
      assertRequiredDeviceAuthorityWorkerSecrets,
    } = await loadReadinessModule();

    expect(REQUIRED_DEVICE_AUTHORITY_WORKER_SECRETS).toEqual([
      'CLOUDFLARE_API_TOKEN',
    ]);
    expect(() => assertRequiredDeviceAuthorityWorkerSecrets([
      { name: 'GOOGLE_OAUTH_CLIENT_ID', type: 'secret_text' },
      { name: 'GOOGLE_OAUTH_CLIENT_SECRET', type: 'secret_text' },
      { name: 'CLOUDFLARE_API_TOKEN', type: 'secret_text' },
    ])).not.toThrow();
  });

  it('should reject release readiness when the Worker secret is missing', async () => {
    const { assertRequiredDeviceAuthorityWorkerSecrets } = await loadReadinessModule();

    expect(() => assertRequiredDeviceAuthorityWorkerSecrets([
      { name: 'GOOGLE_OAUTH_CLIENT_ID', type: 'secret_text' },
      { name: 'GOOGLE_OAUTH_CLIENT_SECRET', type: 'secret_text' },
    ])).toThrowError(
      'Device authority secret CLOUDFLARE_API_TOKEN is not configured',
    );
  });

  it('should stop release before remote mutation when readiness fails', async () => {
    const { runDeviceAuthorityReleaseCli } = await loadReleaseModule();
    const commands: ReleaseCommand[] = [];
    const errors: string[] = [];

    const exitCode = await runDeviceAuthorityReleaseCli([], {
      commandRunner(command) {
        commands.push(command);
        if (
          command.command === 'wrangler' &&
          command.args.join(' ') ===
            'secret list --name consuelo-os-device-authority --format json'
        ) {
          return {
            status: 0,
            stdout: JSON.stringify([
              { name: 'GOOGLE_OAUTH_CLIENT_ID', type: 'secret_text' },
              { name: 'GOOGLE_OAUTH_CLIENT_SECRET', type: 'secret_text' },
            ]),
            stderr: '',
          };
        }
        throw new Error(`unexpected release mutation: ${command.command} ${command.args.join(' ')}`);
      },
      writeOut() {},
      writeErr(message = '') {
        errors.push(message);
      },
    });

    expect(exitCode).toBe(1);
    expect(commands).toHaveLength(1);
    expect(commands[0]).toMatchObject({
      command: 'wrangler',
      args: [
        'secret',
        'list',
        '--name',
        'consuelo-os-device-authority',
        '--format',
        'json',
      ],
      stdio: 'pipe',
    });
    expect(errors).toEqual([
      'Device authority secret CLOUDFLARE_API_TOKEN is not configured',
    ]);
    expect(errors.join('\n')).not.toMatch(/\n\s*at\s|Bun v\d|\.ts:\d+:\d+/);
    expect(commands.some((command) => command.args[0] === 'deploy')).toBe(false);
    expect(commands.some((command) => command.args[0] === 'r2')).toBe(false);
  });

  it('should reject release health when connector provisioning is unavailable', async () => {
    const { assertDeviceAuthorityHealth } = await loadReleaseModule();

    expect(() => assertDeviceAuthorityHealth({
      status: 200,
      json: { status: 'ok', ok: true, connector_provisioning_configured: false },
    })).toThrow(/connector provisioning/i);
    expect(() => assertDeviceAuthorityHealth({
      status: 200,
      json: { status: 'ok', ok: true, connector_provisioning_configured: true },
    })).not.toThrow();
  });

  it('should retry verification until connector provisioning is ready', async () => {
    const { runDeviceAuthorityReleaseCli } = await loadReleaseModule();
    const output: string[] = [];
    const errors: string[] = [];
    const delays: number[] = [];
    let healthAttempts = 0;

    const exitCode = await runDeviceAuthorityReleaseCli([
      '--verify-only',
      '--verify-attempts',
      '3',
      '--verify-delay-ms',
      '1',
    ], {
      commandRunner(command) {
        throw new Error(`unexpected command: ${command.command}`);
      },
      async fetchImpl(input) {
        const url = String(input);
        if (url === 'https://os.consuelohq.com/health') {
          healthAttempts += 1;
          return Response.json({
            ok: true,
            connector_provisioning_configured: healthAttempts > 1,
          });
        }
        if (url.startsWith('https://os.consuelohq.com/login/device?')) {
          return new Response(
            '<a href="https://os.consuelohq.com/login/google/start?user_code=RELSMOKE">Continue</a>',
          );
        }
        if (url === 'https://os.consuelohq.com/login/device/code') {
          return Response.json(
            { error: 'device_public_key_required' },
            { status: 400 },
          );
        }
        throw new Error(`unexpected request: ${url}`);
      },
      async sleepImpl(ms) {
        delays.push(ms);
      },
      writeOut(message = '') {
        output.push(message);
      },
      writeErr(message = '') {
        errors.push(message);
      },
    });

    expect(exitCode).toBe(0);
    expect(healthAttempts).toBe(2);
    expect(delays).toEqual([1]);
    expect(errors).toEqual([]);
    expect(output).toContain(
      'Verifying https://os.consuelohq.com/health (attempt 1/3)',
    );
    expect(output).toContain(
      'Verifying https://os.consuelohq.com/health (attempt 2/3)',
    );
  });

  it('should report one concise error when asynchronous verification fails', async () => {
    const { runDeviceAuthorityReleaseCli } = await loadReleaseModule();
    const errors: string[] = [];

    const exitCode = await runDeviceAuthorityReleaseCli([
      '--verify-only',
      '--verify-attempts',
      '2',
      '--verify-delay-ms',
      '1',
    ], {
      commandRunner(command) {
        throw new Error(`unexpected command: ${command.command}`);
      },
      async fetchImpl() {
        throw new Error('controlled asynchronous health failure');
      },
      async sleepImpl() {},
      writeOut() {},
      writeErr(message = '') {
        errors.push(message);
      },
    });

    expect(exitCode).toBe(1);
    expect(errors).toEqual([
      'Device authority verification failed after 2 attempts: Device authority request failed: controlled asynchronous health failure',
    ]);
    expect(errors.join('\n')).not.toMatch(/\n\s*at\s|Bun v\d|\.ts:\d+:\d+/);
  });
});
