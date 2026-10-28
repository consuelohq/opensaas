import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { Effect } from 'effect';
import { afterEach, describe, expect, it } from 'vitest';

import { classifyRuntimeBundlePath } from '../../scripts/lib/distribution/runtime-bundle';
import {
  cloudflareDeploymentProviderAdapter,
  cloudflareRunnerPath,
} from './cloudflare';
import { runCloudflareRunner } from './cloudflare-runner';
import { ProviderError } from './errors';
import { createDeploymentProviderService } from './service';
import {
  createFakeProviderProcess,
  providerProcessResult,
} from './testing';

const temporaryDirectories: string[] = [];

const temporaryDirectory = (): string => {
  const directory = mkdtempSync(join(tmpdir(), 'cloudflare-provider-'));
  temporaryDirectories.push(directory);
  return directory;
};

const expectProviderError = async (
  effect: Effect.Effect<unknown, ProviderError>,
  code: ProviderError['code'],
): Promise<ProviderError> => {
  const result = await Effect.runPromise(Effect.either(effect));
  expect(result._tag).toBe('Left');
  if (result._tag !== 'Left') throw new Error(`expected provider error ${code}`);
  expect(result.left.code).toBe(code);
  return result.left;
};

const createService = (outputs: Array<ReturnType<typeof providerProcessResult>>) => {
  const fake = createFakeProviderProcess(outputs);
  return {
    fake,
    service: createDeploymentProviderService(cloudflareDeploymentProviderAdapter, {
      process: fake.process,
      cwd: '/customer/workspace',
      env: { PATH: '/customer/bin' },
    }),
  };
};

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe('Cloudflare deployment provider adapter', () => {
  it('targets Wrangler 4 and advertises only the shared provider capabilities', async () => {
    expect(cloudflareDeploymentProviderAdapter).toMatchObject({
      provider: 'cloudflare',
      executable: 'wrangler',
      capabilities: [
        'detect',
        'auth.status',
        'context.current',
        'project.list',
        'deployment.list',
        'deployment.status',
        'logs.read',
        'deploy',
        'redeploy',
        'environment.listNames',
        'environment.set',
        'raw',
      ],
    });

    const { fake, service } = createService([
      providerProcessResult({ stdout: '4.74.0\n' }),
    ]);
    await expect(Effect.runPromise(service.detect())).resolves.toEqual({
      provider: 'cloudflare',
      executable: 'wrangler',
      version: { raw: '4.74.0', major: 4, minor: 74, patch: 0 },
    });
    expect(fake.requests[0].args).toEqual(['--version']);

    const unsupported = createService([
      providerProcessResult({ stdout: '3.99.0\n' }),
    ]);
    await expectProviderError(unsupported.service.detect(), 'UNSUPPORTED_VERSION');
  });

  it('normalizes auth and a single account context without token permissions', async () => {
    const whoami = JSON.stringify({
      loggedIn: true,
      authType: 'OAuth Token',
      email: 'ko@example.test',
      accounts: [{ id: 'account_customer', name: 'Customer Account' }],
      tokenPermissions: ['workers:write'],
    });
    const { fake, service } = createService([
      providerProcessResult({ stdout: whoami }),
      providerProcessResult({ stdout: whoami }),
    ]);

    await expect(Effect.runPromise(service.authStatus())).resolves.toEqual({
      authenticated: true,
      identity: 'ko@example.test',
      source: 'cli',
    });
    await expect(Effect.runPromise(service.contextCurrent())).resolves.toEqual({
      project: { id: 'account:account_customer', name: 'Customer Account' },
    });
    expect(fake.requests.map((request) => request.args)).toEqual([
      ['whoami', '--json'],
      ['whoami', '--json'],
    ]);
    expect(JSON.stringify(await Effect.runPromise(service.authStatus().pipe(Effect.catchAll(() => Effect.succeed(null)))))).not.toContain('workers:write');
  });

  it('does not select an account when Wrangler reports an ambiguous account set', async () => {
    const { service } = createService([
      providerProcessResult({
        stdout: JSON.stringify({
          loggedIn: true,
          email: 'ko@example.test',
          accounts: [
            { id: 'account_one', name: 'One' },
            { id: 'account_two', name: 'Two' },
          ],
        }),
      }),
    ]);

    await expect(Effect.runPromise(service.contextCurrent())).resolves.toEqual({});
  });

  it('lists Pages projects because Wrangler has no stable Worker application-list command', async () => {
    const { fake, service } = createService([
      providerProcessResult({
        stdout: JSON.stringify([
          { name: 'docs-site', subdomain: 'docs-site.pages.dev' },
          { name: 'marketing-site', subdomain: 'marketing-site.pages.dev' },
        ]),
      }),
    ]);

    await expect(Effect.runPromise(service.projectList())).resolves.toEqual({
      projects: [
        { id: 'pages:docs-site', name: 'docs-site' },
        { id: 'pages:marketing-site', name: 'marketing-site' },
      ],
    });
    expect(fake.requests[0].args).toEqual(['pages', 'project', 'list', '--json']);
  });

  it('lists Worker and Pages deployments from explicit project references', async () => {
    const worker = createService([
      providerProcessResult({
        stdout: JSON.stringify([
          {
            id: 'deployment_worker_1',
            created_on: '2026-07-23T10:00:00.000Z',
            source: 'wrangler',
            versions: [{ version_id: 'version_worker_1', percentage: 100 }],
          },
        ]),
      }),
    ]);
    await expect(Effect.runPromise(worker.service.deploymentList({
      projectId: 'worker:customer-api',
    }))).resolves.toEqual({
      deployments: [{
        id: 'deployment_worker_1',
        status: 'active',
        createdAt: '2026-07-23T10:00:00.000Z',
        serviceId: 'version_worker_1',
      }],
    });
    expect(worker.fake.requests[0].args).toEqual([
      'deployments', 'list', '--name', 'customer-api', '--json',
    ]);

    const pages = createService([
      providerProcessResult({
        stdout: JSON.stringify([
          {
            id: 'deployment_pages_1',
            project_name: 'docs-site',
            environment: 'preview',
            url: 'https://deployment_pages_1.docs-site.pages.dev',
            created_on: '2026-07-23T11:00:00.000Z',
            latest_stage: { status: 'success' },
          },
        ]),
      }),
    ]);
    await expect(Effect.runPromise(pages.service.deploymentList({
      projectId: 'pages:docs-site',
      environment: 'preview',
    }))).resolves.toEqual({
      deployments: [{
        id: 'deployment_pages_1',
        status: 'success',
        url: 'https://deployment_pages_1.docs-site.pages.dev',
        createdAt: '2026-07-23T11:00:00.000Z',
        projectId: 'pages:docs-site',
        environment: 'preview',
      }],
    });
    expect(pages.fake.requests[0].args).toEqual([
      'pages', 'deployment', 'list', '--project-name', 'docs-site',
      '--environment', 'preview', '--json',
    ]);
  });

  it('reads Worker version status from a composite customer reference', async () => {
    const { fake, service } = createService([
      providerProcessResult({
        stdout: JSON.stringify({
          id: 'version_worker_1',
          created_on: '2026-07-23T10:00:00.000Z',
          annotations: { 'workers/message': 'release' },
        }),
      }),
    ]);

    await expect(Effect.runPromise(service.deploymentStatus({
      deploymentId: 'worker:customer-api:version_worker_1',
    }))).resolves.toEqual({
      id: 'version_worker_1',
      status: 'available',
      createdAt: '2026-07-23T10:00:00.000Z',
    });
    expect(fake.requests[0].args).toEqual([
      'versions', 'view', 'version_worker_1', '--name', 'customer-api', '--json',
    ]);
  });

  it('deploys Workers and Pages only from explicit customer targets and sources', async () => {
    const worker = createService([
      providerProcessResult({
        stdout: 'Uploaded customer-api\nCurrent Version ID: version_worker_2\nhttps://customer-api.customer.workers.dev\n',
      }),
    ]);
    await expect(Effect.runPromise(worker.service.deploy({
      target: 'worker:customer-api',
      source: '/customer/workspace/wrangler.toml',
      approval: { approved: true, reason: 'Customer approved Worker deploy' },
    }))).resolves.toEqual({
      deploymentId: 'version_worker_2',
      status: 'deployed',
      url: 'https://customer-api.customer.workers.dev',
    });
    expect(worker.fake.requests[0].args).toEqual([
      'deploy', '--config', '/customer/workspace/wrangler.toml',
      '--name', 'customer-api', '--strict',
    ]);

    const pages = createService([
      providerProcessResult({
        stdout: 'Success! Uploaded files\nhttps://deployment_pages_2.docs-site.pages.dev\n',
      }),
    ]);
    await expect(Effect.runPromise(pages.service.deploy({
      target: 'pages:docs-site',
      source: '/customer/workspace/dist',
      approval: { approved: true, reason: 'Customer approved Pages deploy' },
    }))).resolves.toEqual({
      deploymentId: 'https://deployment_pages_2.docs-site.pages.dev',
      status: 'deployed',
      url: 'https://deployment_pages_2.docs-site.pages.dev',
    });
    expect(pages.fake.requests[0].args).toEqual([
      'pages', 'deploy', '/customer/workspace/dist', '--project-name', 'docs-site',
    ]);
  });

  it('redeploys an explicit Worker version through Wrangler rollback', async () => {
    const { fake, service } = createService([
      providerProcessResult({
        stdout: 'Current Version ID: version_worker_1\n',
      }),
    ]);

    await expect(Effect.runPromise(service.redeploy({
      deploymentId: 'worker:customer-api:version_worker_1',
      approval: { approved: true, reason: 'Customer approved rollback' },
    }))).resolves.toEqual({
      deploymentId: 'version_worker_1',
      status: 'deployed',
    });
    expect(fake.requests[0].args).toEqual([
      'rollback', 'version_worker_1', '--name', 'customer-api', '--yes',
    ]);
  });

  it('lists secret names and sends secret values only through stdin', async () => {
    const listed = createService([
      providerProcessResult({
        stdout: JSON.stringify([
          { name: 'DATABASE_URL', type: 'secret_text' },
          { name: 'API_KEY', type: 'secret_text' },
        ]),
      }),
    ]);
    await expect(Effect.runPromise(listed.service.environmentListNames({
      projectId: 'worker:customer-api',
      environment: 'preview',
    }))).resolves.toEqual([
      { name: 'API_KEY', scopes: [], present: true },
      { name: 'DATABASE_URL', scopes: [], present: true },
    ]);
    expect(listed.fake.requests[0].args).toEqual([
      'secret', 'list', '--name', 'customer-api', '--env', 'preview', '--format', 'json',
    ]);

    const secret = 'stdin-only-cloudflare-secret';
    const changed = createService([
      providerProcessResult({
        stdout: JSON.stringify({
          name: 'API_KEY', scopes: ['worker:customer-api:preview'], updated: true,
        }),
      }),
    ]);
    await expect(Effect.runPromise(changed.service.environmentSet({
      name: 'API_KEY',
      value: secret,
      scope: 'worker:customer-api:preview',
      approval: { approved: true, reason: 'Customer approved secret update' },
    }))).resolves.toEqual({
      name: 'API_KEY', scopes: ['worker:customer-api:preview'], updated: true,
    });
    expect(changed.fake.requests[0].command).toBe(process.execPath);
    expect(changed.fake.requests[0].args).toEqual([
      cloudflareRunnerPath,
      'secret-put',
      '--wrangler', 'wrangler',
      '--kind', 'worker',
      '--target', 'customer-api',
      '--name', 'API_KEY',
      '--environment', 'preview',
    ]);
    expect(changed.fake.requests[0].stdin).toBe(secret);
    expect(changed.fake.requests[0].args.join(' ')).not.toContain(secret);
  });

  it('uses the bounded runner for Worker and Pages log tails', async () => {
    const { fake, service } = createService([
      providerProcessResult({
        stdout: JSON.stringify([
          { timestamp: '2026-07-23T12:00:00.000Z', level: 'log', message: ['ready'] },
        ]),
      }),
    ]);

    await expect(Effect.runPromise(service.logsRead({
      serviceId: 'worker:customer-api',
      deploymentId: 'version_worker_2',
      limit: 25,
      timeoutMs: 5_000,
    }))).resolves.toEqual({
      entries: [{
        timestamp: '2026-07-23T12:00:00.000Z',
        level: 'log',
        message: 'ready',
      }],
    });
    expect(fake.requests[0].command).toBe(process.execPath);
    expect(fake.requests[0].args).toEqual([
      cloudflareRunnerPath,
      'tail',
      '--wrangler', 'wrangler',
      '--kind', 'worker',
      '--target', 'customer-api',
      '--deployment-id', 'version_worker_2',
      '--limit', '25',
      '--duration-ms', '4500',
    ]);
  });

  it('bounds the real runner by entry count and forwards secret stdin without argv exposure', async () => {
    const root = temporaryDirectory();
    const executable = join(root, 'fake-wrangler');
    writeFileSync(executable, `#!/bin/sh\nif [ "$1" = "tail" ]; then\n  printf '%s\\n' '{"timestamp":"one","message":["first"]}'\n  printf '%s\\n' '{"timestamp":"two","message":["second"]}'\n  sleep 2\n  exit 0\nfi\nread value\nprintf 'received:%s\\n' "${'#'}{value}" >&2\nexit 0\n`, 'utf8');
    chmodSync(executable, 0o755);

    const stdout: string[] = [];
    const stderr: string[] = [];
    const tailCode = await runCloudflareRunner([
      'tail', '--wrangler', executable, '--kind', 'worker', '--target', 'customer-api',
      '--limit', '2', '--duration-ms', '1000',
    ], {
      stdin: '',
      stdout: (value) => stdout.push(value),
      stderr: (value) => stderr.push(value),
    });
    expect(tailCode, JSON.stringify({ stdout, stderr })).toBe(0);
    expect(JSON.parse(stdout.join(''))).toHaveLength(2);

    const secret = 'runner-secret-value';
    stdout.length = 0;
    stderr.length = 0;
    const putCode = await runCloudflareRunner([
      'secret-put', '--wrangler', executable, '--kind', 'worker',
      '--target', 'customer-api', '--name', 'API_KEY',
    ], {
      stdin: secret,
      stdout: (value) => stdout.push(value),
      stderr: (value) => stderr.push(value),
    });
    expect(putCode).toBe(0);
    expect(JSON.parse(stdout.join(''))).toEqual({
      name: 'API_KEY', scopes: ['worker:customer-api'], updated: true,
    });
    expect(stderr.join('')).not.toContain(secret);
  });

  it('rejects operator-owned references before invoking Wrangler', async () => {
    for (const args of [
      ['deploy', '--config', 'packages/os/cloudflare/workspace-edge/wrangler.toml'],
      ['d1', 'execute', 'consuelo-workspace-edge'],
      ['whoami', '--account', 'consuelohq.com'],
      ['secret', 'put', 'CLOUDFLARE_OS_TEST_API_TOKEN'],
    ]) {
      const { fake, service } = createService([]);
      await expectProviderError(service.raw({
        args,
        approval: { approved: true, reason: 'Boundary test' },
      }), 'MALFORMED_OUTPUT');
      expect(fake.requests).toHaveLength(0);
    }
  });

  it('ships the customer adapter while excluding operator Cloudflare modules', () => {
    expect(classifyRuntimeBundlePath('tools/deployment-provider/cloudflare.ts')).toBe('customer-provider');
    expect(classifyRuntimeBundlePath('tools/deployment-provider/cloudflare-runner.ts')).toBe('customer-provider');
    expect(classifyRuntimeBundlePath('tools/deployment-provider/cloudflare.test.ts')).toBe('test-only');
    expect(classifyRuntimeBundlePath('cloudflare/workspace-edge/wrangler.toml')).toBe('operator-only');
    expect(classifyRuntimeBundlePath('scripts/lib/workspace-cloudflare-provisioning.ts')).toBe('operator-only');
  });

  it('contains no platform imports, domains, account IDs, or zone IDs', () => {
    const adapterSource = readFileSync(new URL('./cloudflare.ts', import.meta.url), 'utf8');
    const runnerSource = readFileSync(new URL('./cloudflare-runner.ts', import.meta.url), 'utf8');
    const shippedSource = `${adapterSource}\n${runnerSource}`;

    for (const forbidden of [
      'workspace-cloudflare-',
      'platform-cloudflare-provisioning',
      'packages/os/cloudflare',
      'consuelohq.com',
      '90b2c5a70d57f13b0cc7a80d45776eb0',
      '3787d389edc70cbf28e27f3d334aa9e6',
      'CLOUDFLARE_OS_TEST_API_TOKEN',
    ]) {
      expect(shippedSource).not.toContain(forbidden);
    }
  });
});
