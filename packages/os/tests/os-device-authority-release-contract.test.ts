import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { describe, expect, it } from 'vitest';

import { createOsDeviceAuthorityHandler } from '../cloudflare/os-device-authority/src/app';
import { createMemoryDeviceGrantStore } from '../cloudflare/os-device-authority/src/stores';

type WorkerSecretMetadata = Array<{ name: string; type?: string }>;

type ReadinessModule = {
  REQUIRED_DEVICE_AUTHORITY_WORKER_SECRETS: readonly string[];
  OPTIONAL_DEVICE_AUTHORITY_SYNTHETIC_STRIPE_SECRETS: readonly string[];
  OPTIONAL_DEVICE_AUTHORITY_SYNTHETIC_STRIPE_ALLOWLISTS: readonly string[];
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
      OS_DEVICE_AUTH_CONNECTOR_LOCAL_SERVICE_URL: 'http://127.0.0.1:46320',
    });
  });

  it('should not use unsupported Wrangler secret declaration sections', () => {
    const config = readWorkerConfig();

    expect(config).not.toHaveProperty('secrets');
    expect(JSON.stringify(config)).not.toMatch(/CLOUDFLARE_API_TOKEN\s*[:=]\s*[^\]"}]+/);
  });

  it('should accept release readiness when required Worker secrets exist', async () => {
    const {
      REQUIRED_DEVICE_AUTHORITY_WORKER_SECRETS,
      assertRequiredDeviceAuthorityWorkerSecrets,
    } = await loadReadinessModule();

    expect(REQUIRED_DEVICE_AUTHORITY_WORKER_SECRETS).toEqual([
      'CLOUDFLARE_API_TOKEN',
      'WORKSPACE_EDGE_INTERNAL_SIGNING_SECRET',
      'OS_MANAGED_CLOUD_PROVISIONER_SECRET',
      'OS_MANAGED_CLOUD_ENROLLMENT_SECRET',
    ]);
    expect(() => assertRequiredDeviceAuthorityWorkerSecrets([
      { name: 'GOOGLE_OAUTH_CLIENT_ID', type: 'secret_text' },
      { name: 'GOOGLE_OAUTH_CLIENT_SECRET', type: 'secret_text' },
      { name: 'CLOUDFLARE_API_TOKEN', type: 'secret_text' },
      { name: 'WORKSPACE_EDGE_INTERNAL_SIGNING_SECRET', type: 'secret_text' },
              { name: 'OS_MANAGED_CLOUD_PROVISIONER_SECRET', type: 'secret_text' },
              { name: 'OS_MANAGED_CLOUD_ENROLLMENT_SECRET', type: 'secret_text' },
    ])).not.toThrow();
  });

  it('should accept Stripe billing as either fully absent or fully configured', async () => {
    const {
      OPTIONAL_DEVICE_AUTHORITY_STRIPE_SECRETS,
      assertRequiredDeviceAuthorityWorkerSecrets,
    } = await loadReadinessModule();
    const required = [
      { name: 'CLOUDFLARE_API_TOKEN', type: 'secret_text' },
      { name: 'WORKSPACE_EDGE_INTERNAL_SIGNING_SECRET', type: 'secret_text' },
      { name: 'OS_MANAGED_CLOUD_PROVISIONER_SECRET', type: 'secret_text' },
      { name: 'OS_MANAGED_CLOUD_ENROLLMENT_SECRET', type: 'secret_text' },
    ];

    expect(OPTIONAL_DEVICE_AUTHORITY_STRIPE_SECRETS).toEqual([
      'OS_STRIPE_SECRET_KEY',
      'OS_STRIPE_WEBHOOK_SECRET',
    ]);
    expect(() => assertRequiredDeviceAuthorityWorkerSecrets(required)).not.toThrow();
    expect(() => assertRequiredDeviceAuthorityWorkerSecrets([
      ...required,
      { name: 'OS_STRIPE_SECRET_KEY', type: 'secret_text' },
      { name: 'OS_STRIPE_WEBHOOK_SECRET', type: 'secret_text' },
    ])).not.toThrow();
  });

  it('should accept synthetic Stripe testing as either fully absent or fully configured', async () => {
    const {
      OPTIONAL_DEVICE_AUTHORITY_SYNTHETIC_STRIPE_ALLOWLISTS,
      OPTIONAL_DEVICE_AUTHORITY_SYNTHETIC_STRIPE_SECRETS,
      assertRequiredDeviceAuthorityWorkerSecrets,
    } = await loadReadinessModule();
    const required = [
      { name: 'CLOUDFLARE_API_TOKEN', type: 'secret_text' },
      { name: 'WORKSPACE_EDGE_INTERNAL_SIGNING_SECRET', type: 'secret_text' },
      { name: 'OS_MANAGED_CLOUD_PROVISIONER_SECRET', type: 'secret_text' },
      { name: 'OS_MANAGED_CLOUD_ENROLLMENT_SECRET', type: 'secret_text' },
    ];

    expect(OPTIONAL_DEVICE_AUTHORITY_SYNTHETIC_STRIPE_SECRETS).toEqual([
      'OS_STRIPE_SYNTHETIC_SECRET_KEY',
      'OS_STRIPE_SYNTHETIC_WEBHOOK_SECRET',
    ]);
    expect(OPTIONAL_DEVICE_AUTHORITY_SYNTHETIC_STRIPE_ALLOWLISTS).toEqual([
      'OS_STRIPE_SYNTHETIC_ACCOUNT_IDS',
      'OS_STRIPE_SYNTHETIC_WORKSPACE_IDS',
    ]);
    expect(() => assertRequiredDeviceAuthorityWorkerSecrets(required)).not.toThrow();
    expect(() => assertRequiredDeviceAuthorityWorkerSecrets([
      ...required,
      { name: 'OS_STRIPE_SYNTHETIC_SECRET_KEY', type: 'secret_text' },
      { name: 'OS_STRIPE_SYNTHETIC_WEBHOOK_SECRET', type: 'secret_text' },
      { name: 'OS_STRIPE_SYNTHETIC_ACCOUNT_IDS', type: 'secret_text' },
    ])).not.toThrow();
    expect(() => assertRequiredDeviceAuthorityWorkerSecrets([
      ...required,
      { name: 'OS_STRIPE_SYNTHETIC_SECRET_KEY', type: 'secret_text' },
      { name: 'OS_STRIPE_SYNTHETIC_WEBHOOK_SECRET', type: 'secret_text' },
      { name: 'OS_STRIPE_SYNTHETIC_WORKSPACE_IDS', type: 'secret_text' },
    ])).not.toThrow();
  });

  it('should reject partial synthetic Stripe configuration', async () => {
    const { assertRequiredDeviceAuthorityWorkerSecrets } = await loadReadinessModule();
    const required = [
      { name: 'CLOUDFLARE_API_TOKEN', type: 'secret_text' },
      { name: 'WORKSPACE_EDGE_INTERNAL_SIGNING_SECRET', type: 'secret_text' },
      { name: 'OS_MANAGED_CLOUD_PROVISIONER_SECRET', type: 'secret_text' },
      { name: 'OS_MANAGED_CLOUD_ENROLLMENT_SECRET', type: 'secret_text' },
    ];
    expect(() => assertRequiredDeviceAuthorityWorkerSecrets([
      ...required,
      { name: 'OS_STRIPE_SYNTHETIC_SECRET_KEY', type: 'secret_text' },
      { name: 'OS_STRIPE_SYNTHETIC_WEBHOOK_SECRET', type: 'secret_text' },
    ])).toThrowError(
      'Device authority synthetic Stripe testing requires both Stripe secrets and at least one allowlist: OS_STRIPE_SYNTHETIC_ACCOUNT_IDS or OS_STRIPE_SYNTHETIC_WORKSPACE_IDS',
    );
  });

  it('should reject a half-configured Stripe billing secret pair', async () => {
    const { assertRequiredDeviceAuthorityWorkerSecrets } = await loadReadinessModule();
    const required = [
      { name: 'CLOUDFLARE_API_TOKEN', type: 'secret_text' },
      { name: 'WORKSPACE_EDGE_INTERNAL_SIGNING_SECRET', type: 'secret_text' },
      { name: 'OS_MANAGED_CLOUD_PROVISIONER_SECRET', type: 'secret_text' },
      { name: 'OS_MANAGED_CLOUD_ENROLLMENT_SECRET', type: 'secret_text' },
    ];
    expect(() => assertRequiredDeviceAuthorityWorkerSecrets([
      ...required,
      { name: 'OS_STRIPE_SECRET_KEY', type: 'secret_text' },
    ])).toThrowError(
      'Device authority Stripe billing secrets must be configured together: OS_STRIPE_SECRET_KEY, OS_STRIPE_WEBHOOK_SECRET',
    );
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

  it('should stop release before remote mutation when the Hono route-refresh credential is unavailable', async () => {
    const { runDeviceAuthorityReleaseCli } = await loadReleaseModule();
    const commands: ReleaseCommand[] = [];
    const errors: string[] = [];
    const previousProvisionerSecret = process.env.OS_MANAGED_CLOUD_PROVISIONER_SECRET;
    delete process.env.OS_MANAGED_CLOUD_PROVISIONER_SECRET;
    try {
      const exitCode = await runDeviceAuthorityReleaseCli([], {
        commandRunner(command) {
          commands.push(command);
          if (
            command.command === 'wrangler'
            && command.args.join(' ') ===
              'secret list --name consuelo-os-device-authority --format json'
          ) {
            return {
              status: 0,
              stdout: JSON.stringify([
                { name: 'CLOUDFLARE_API_TOKEN', type: 'secret_text' },
                { name: 'WORKSPACE_EDGE_INTERNAL_SIGNING_SECRET', type: 'secret_text' },
                { name: 'OS_MANAGED_CLOUD_PROVISIONER_SECRET', type: 'secret_text' },
                { name: 'OS_MANAGED_CLOUD_ENROLLMENT_SECRET', type: 'secret_text' },
              ]),
              stderr: '',
            };
          }
          throw new Error(`unexpected release mutation: ${command.command} ${command.args.join(' ')}`);
        },
        writeOut() {},
        writeErr(message = '') { errors.push(message); },
      });

      expect(exitCode).toBe(1);
      expect(errors).toEqual([
        'OS_MANAGED_CLOUD_PROVISIONER_SECRET is required to refresh release-managed workspace routes',
      ]);
      expect(commands).toHaveLength(1);
      expect(commands.some((command) => command.args[0] === 'r2')).toBe(false);
      expect(commands.some((command) => command.args[0] === 'deploy')).toBe(false);
    } finally {
      if (previousProvisionerSecret === undefined) {
        delete process.env.OS_MANAGED_CLOUD_PROVISIONER_SECRET;
      } else {
        process.env.OS_MANAGED_CLOUD_PROVISIONER_SECRET = previousProvisionerSecret;
      }
    }
  });

  it('should materialize and bundle a valid default workspace during dry-run without remote uploads', async () => {
    const { runDeviceAuthorityReleaseCli } = await loadReleaseModule();
    const commands: ReleaseCommand[] = [];
    const output: string[] = [];
    const errors: string[] = [];

    const exitCode = await runDeviceAuthorityReleaseCli(['--dry-run'], {
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
              { name: 'CLOUDFLARE_API_TOKEN', type: 'secret_text' },
              { name: 'WORKSPACE_EDGE_INTERNAL_SIGNING_SECRET', type: 'secret_text' },
              { name: 'OS_MANAGED_CLOUD_PROVISIONER_SECRET', type: 'secret_text' },
              { name: 'OS_MANAGED_CLOUD_ENROLLMENT_SECRET', type: 'secret_text' },
            ]),
            stderr: '',
          };
        }
        if (
          command.command === 'wrangler' &&
          command.args[0] === 'deploy' &&
          command.args.includes('--dry-run')
        ) {
          return { status: 0, stdout: '', stderr: '' };
        }
        throw new Error(
          `unexpected release mutation: ${command.command} ${command.args.join(' ')}`,
        );
      },
      writeOut(message = '') {
        output.push(message);
      },
      writeErr(message = '') {
        errors.push(message);
      },
    });

    expect(exitCode).toBe(0);
    expect(errors).toEqual([]);
    expect(output.filter((line) => line.startsWith('plannedSnapshot='))).toHaveLength(10);
    for (const siteId of [
      'launcher',
      'artifacts',
      'traces',
      'diffs',
      'docs',
      'configuration',
      'tools',
      'nodes',
      'environments',
      'secrets',
    ]) {
      expect(output).toContainEqual(
        expect.stringMatching(
          new RegExp(`^plannedSnapshot=r2://consuelo-sites-snapshots/sites/workspace_testing/${siteId}/sha256-[a-f0-9]{16}/index\\.html$`),
        ),
      );
    }
    expect(output).toContainEqual(
      expect.stringMatching(
        /^defaultSiteSnapshotKey=sites\/workspace_testing\/launcher\/sha256-[a-f0-9]{16}\/index\.html$/,
      ),
    );
    expect(output).toContainEqual(
      expect.stringMatching(
        /^plannedRouteRefresh=workspace_route_registry:sha256-[a-f0-9]{16}$/,
      ),
    );
    expect(commands.some((command) => command.args[0] === 'r2')).toBe(false);
    expect(commands.some((command) => command.args[0] === 'd1')).toBe(false);
    expect(commands.at(-1)).toMatchObject({
      command: 'wrangler',
      args: expect.arrayContaining(['deploy', '--dry-run']),
    });
  });

  it('deploys Device Authority before refreshing release-managed workspace site routes through the Hono D1 binding', async () => {
    const { runDeviceAuthorityReleaseCli } = await loadReleaseModule();
    const commands: ReleaseCommand[] = [];
    const requests: Array<{ url: string; init?: RequestInit }> = [];
    const output: string[] = [];
    const errors: string[] = [];
    const delays: number[] = [];
    let routeRefreshAttempts = 0;
    const previousProvisionerSecret = process.env.OS_MANAGED_CLOUD_PROVISIONER_SECRET;
    process.env.OS_MANAGED_CLOUD_PROVISIONER_SECRET = 'release-route-secret';

    const exitCode = await runDeviceAuthorityReleaseCli([], {
      commandRunner(command) {
        commands.push(command);
        if (
          command.command === 'wrangler'
          && command.args.join(' ') ===
            'secret list --name consuelo-os-device-authority --format json'
        ) {
          return {
            status: 0,
            stdout: JSON.stringify([
              { name: 'CLOUDFLARE_API_TOKEN', type: 'secret_text' },
              { name: 'WORKSPACE_EDGE_INTERNAL_SIGNING_SECRET', type: 'secret_text' },
              { name: 'OS_MANAGED_CLOUD_PROVISIONER_SECRET', type: 'secret_text' },
              { name: 'OS_MANAGED_CLOUD_ENROLLMENT_SECRET', type: 'secret_text' },
            ]),
            stderr: '',
          };
        }
        if (command.command === 'wrangler' && ['r2', 'deploy'].includes(command.args[0] ?? '')) {
          return { status: 0, stdout: '', stderr: '' };
        }
        throw new Error(
          'unexpected release mutation: ' + command.command + ' ' + command.args.join(' '),
        );
      },
      async fetchImpl(input, init) {
        const url = String(input);
        requests.push({ url, init });
        if (url === 'https://os.consuelohq.com/internal/release/site-snapshots/refresh') {
          routeRefreshAttempts += 1;
          if (routeRefreshAttempts === 1) throw new Error('edge connection reset');
          if (routeRefreshAttempts === 2) return new Response('Not found', { status: 404 });
          if (routeRefreshAttempts === 3) return new Response('Rate limited', { status: 429 });
          if (routeRefreshAttempts === 4) return new Response('Unavailable', { status: 503 });
          return Response.json({ ok: true, updated: true });
        }
        if (url === 'https://os.consuelohq.com/health') {
          return Response.json({ ok: true, connector_provisioning_configured: true });
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
        throw new Error('unexpected request: ' + url);
      },
      async sleepImpl(ms) { delays.push(ms); },
      writeOut(message = '') { output.push(message); },
      writeErr(message = '') { errors.push(message); },
    });
    if (previousProvisionerSecret === undefined) delete process.env.OS_MANAGED_CLOUD_PROVISIONER_SECRET;
    else process.env.OS_MANAGED_CLOUD_PROVISIONER_SECRET = previousProvisionerSecret;

    expect(exitCode).toBe(0);
    expect(errors).toEqual([]);
    const deployIndex = commands.findIndex(
      (command) => command.command === 'wrangler' && command.args[0] === 'deploy',
    );
    const routeRefreshIndex = requests.findIndex(
      (request) => request.url === 'https://os.consuelohq.com/internal/release/site-snapshots/refresh',
    );
    expect(deployIndex).toBeGreaterThan(0);
    expect(routeRefreshIndex).toBeGreaterThanOrEqual(0);
    expect(routeRefreshAttempts).toBe(5);
    expect(delays).toEqual([1_000, 1_000, 1_000, 1_000]);
    expect(commands.some((command) => command.args[0] === 'd1')).toBe(false);
    const routeRefresh = requests[routeRefreshIndex];
    expect(routeRefresh.init?.method).toBe('POST');
    expect(new Headers(routeRefresh.init?.headers).get('authorization')).toBe(
      'Bearer release-route-secret',
    );
    const payload = JSON.parse(String(routeRefresh.init?.body)) as {
      versionId: string;
      snapshotWorkspaceId: string;
      siteContentHashes: Record<string, string>;
    };
    expect(payload.snapshotWorkspaceId).toBe('workspace_testing');
    expect(payload.versionId).toMatch(/^sha256-[a-f0-9]{16}$/);
    for (const siteId of [
      'launcher', 'traces', 'configuration', 'tools', 'nodes', 'environments', 'secrets',
    ]) {
      expect(payload.siteContentHashes[siteId]).toMatch(/^[a-f0-9]{64}$/);
    }
    expect(payload.siteContentHashes).not.toHaveProperty('artifacts');
    expect(payload.siteContentHashes).not.toHaveProperty('docs');
    expect(output).toContain('Verified https://os.consuelohq.com/health');
  });

  it('does not retry permanent authorization failures while refreshing release-managed workspace routes', async () => {
    const { runDeviceAuthorityReleaseCli } = await loadReleaseModule();
    const errors: string[] = [];
    const delays: number[] = [];
    let routeRefreshAttempts = 0;
    const previousProvisionerSecret = process.env.OS_MANAGED_CLOUD_PROVISIONER_SECRET;
    process.env.OS_MANAGED_CLOUD_PROVISIONER_SECRET = 'release-route-secret';

    try {
      const exitCode = await runDeviceAuthorityReleaseCli(['--no-verify'], {
        commandRunner(command) {
          if (
            command.command === 'wrangler'
            && command.args.join(' ') ===
              'secret list --name consuelo-os-device-authority --format json'
          ) {
            return {
              status: 0,
              stdout: JSON.stringify([
                { name: 'CLOUDFLARE_API_TOKEN', type: 'secret_text' },
                { name: 'WORKSPACE_EDGE_INTERNAL_SIGNING_SECRET', type: 'secret_text' },
                { name: 'OS_MANAGED_CLOUD_PROVISIONER_SECRET', type: 'secret_text' },
                { name: 'OS_MANAGED_CLOUD_ENROLLMENT_SECRET', type: 'secret_text' },
              ]),
              stderr: '',
            };
          }
          if (command.command === 'wrangler' && ['r2', 'deploy'].includes(command.args[0] ?? '')) {
            return { status: 0, stdout: '', stderr: '' };
          }
          throw new Error(
            'unexpected release mutation: ' + command.command + ' ' + command.args.join(' '),
          );
        },
        async fetchImpl(input) {
          const url = String(input);
          if (url === 'https://os.consuelohq.com/internal/release/site-snapshots/refresh') {
            routeRefreshAttempts += 1;
            return new Response('Unauthorized', { status: 401 });
          }
          throw new Error('unexpected request: ' + url);
        },
        async sleepImpl(ms) { delays.push(ms); },
        writeOut() {},
        writeErr(message = '') { errors.push(message); },
      });

      expect(exitCode).toBe(1);
      expect(routeRefreshAttempts).toBe(1);
      expect(delays).toEqual([]);
      expect(errors).toEqual([
        'workspace route refresh failed with HTTP 401: Unauthorized',
      ]);
    } finally {
      if (previousProvisionerSecret === undefined) delete process.env.OS_MANAGED_CLOUD_PROVISIONER_SECRET;
      else process.env.OS_MANAGED_CLOUD_PROVISIONER_SECRET = previousProvisionerSecret;
    }
  });

  it('refreshes release-managed site routes through an authenticated Device Authority Hono endpoint', async () => {
    let executedSql = '';
    const handler = createOsDeviceAuthorityHandler({
      store: createMemoryDeviceGrantStore(),
      origin: 'https://os.consuelohq.com',
      managedCloudProvisionerSecret: 'release-route-secret',
      workspaceRouteRegistry: {
        async exec(sql) {
          executedSql = sql;
          return { success: true };
        },
      },
    });
    const body = JSON.stringify({
      versionId: 'sha256-release123456',
      snapshotWorkspaceId: 'workspace_testing',
      siteContentHashes: Object.fromEntries([
        'launcher', 'traces', 'configuration', 'tools', 'nodes', 'environments', 'secrets',
      ].map((siteId) => [siteId, 'a'.repeat(64)])),
    });

    const denied = await handler(new Request(
      'https://os.consuelohq.com/internal/release/site-snapshots/refresh',
      { method: 'POST', headers: { 'content-type': 'application/json' }, body },
    ));
    expect(denied.status).toBe(401);
    expect(executedSql).toBe('');

    const response = await handler(new Request(
      'https://os.consuelohq.com/internal/release/site-snapshots/refresh',
      {
        method: 'POST',
        headers: {
          authorization: 'Bearer release-route-secret',
          'content-type': 'application/json',
        },
        body,
      },
    ));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true, updated: true });
    expect(executedSql).toContain('UPDATE workspace_route_registry SET');
    expect(executedSql).toContain('sha256-release123456');
    expect(executedSql).toContain('traces');
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
