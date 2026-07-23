import { Effect } from 'effect';
import { describe, expect, it } from 'vitest';

import { ProviderError } from './errors';
import {
  vercelDeploymentInspectionFixture,
  vercelDeploymentListFixture,
  vercelDomainListFixture,
  vercelEnvironmentListFixture,
  vercelProjectInspectionFixture,
  vercelProjectListFixture,
  vercelRuntimeLogsFixture,
  vercelVersionFixture,
} from './fixtures/vercel';
import { createDeploymentProviderService } from './service';
import {
  createFakeProviderProcess,
  providerProcessResult,
} from './testing';
import {
  createVercelProviderAdapter,
  vercelOperationCatalog,
} from './vercel';

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

describe('Vercel deployment provider adapter', () => {
  it('detects Vercel CLI 50 and rejects missing or incompatible versions', async () => {
    const supported = createFakeProviderProcess([
      providerProcessResult(vercelVersionFixture),
    ]);
    const service = createDeploymentProviderService(createVercelProviderAdapter(), {
      process: supported.process,
    });

    await expect(Effect.runPromise(service.detect())).resolves.toEqual({
      provider: 'vercel',
      executable: 'vercel',
      version: { raw: '50.1.3', major: 50, minor: 1, patch: 3 },
    });
    expect(supported.requests[0].args).toEqual(['--version']);

    const missing = createDeploymentProviderService(createVercelProviderAdapter(), {
      process: createFakeProviderProcess([
        providerProcessResult({ runtimeMissing: true, stderr: 'ENOENT' }),
      ]).process,
    });
    await expectProviderError(missing.detect(), 'CLI_MISSING');

    const incompatible = createDeploymentProviderService(createVercelProviderAdapter(), {
      process: createFakeProviderProcess([
        providerProcessResult({ stdout: '51.0.0' }),
      ]).process,
    });
    await expectProviderError(incompatible.detect(), 'UNSUPPORTED_VERSION');
  });

  it('reports CLI authentication and linked team, project, and scope without credentials', async () => {
    const fake = createFakeProviderProcess([
      providerProcessResult({ stdout: 'ko-user' }),
      providerProcessResult({ stdout: vercelProjectInspectionFixture }),
    ]);
    const service = createDeploymentProviderService(createVercelProviderAdapter(), {
      process: fake.process,
    });

    const auth = await Effect.runPromise(service.authStatus());
    expect(auth).toEqual({
      authenticated: true,
      identity: 'ko-user',
      source: 'cli',
    });
    expect(JSON.stringify(auth)).not.toContain('token');
    await expect(Effect.runPromise(service.contextCurrent())).resolves.toEqual({
      project: { id: 'prj_123', name: 'consuelo' },
      team: { id: 'team_123', name: 'acme' },
      scope: { id: 'acme', name: 'acme' },
    });
    expect(fake.requests.map((request) => request.args)).toEqual([
      ['whoami', '--no-color'],
      ['project', 'inspect', '--yes', '--no-color'],
    ]);
  });

  it('maps unauthenticated and unlinked CLI failures to typed errors', async () => {
    const auth = createDeploymentProviderService(createVercelProviderAdapter(), {
      process: createFakeProviderProcess([
        providerProcessResult({ exitCode: 1, stderr: 'Error: Not authenticated. Log in with vercel login' }),
      ]).process,
    });
    await expectProviderError(auth.authStatus(), 'UNAUTHENTICATED');

    const context = createDeploymentProviderService(createVercelProviderAdapter(), {
      process: createFakeProviderProcess([
        providerProcessResult({ exitCode: 1, stderr: 'Error: Your codebase is not linked to a project' }),
      ]).process,
    });
    await expectProviderError(context.contextCurrent(), 'NO_CONTEXT');
  });

  it('links a selected project with explicit approval and argv-safe project, scope, and cwd', async () => {
    const fake = createFakeProviderProcess([
      providerProcessResult({ stdout: 'Linked to acme/consuelo (created .vercel)' }),
    ]);
    const service = createDeploymentProviderService(createVercelProviderAdapter(), {
      process: fake.process,
      cwd: '/workspace',
    });

    await expectProviderError(service.projectLink({
      project: 'consuelo; touch pwned',
      scope: 'acme team',
      path: '/workspace/app',
    }), 'APPROVAL_REQUIRED');

    await expect(Effect.runPromise(service.projectLink({
      project: 'consuelo; touch pwned',
      scope: 'acme team',
      path: '/workspace/app',
      approval: { approved: true, reason: 'Link this checkout' },
    }))).resolves.toEqual({
      project: { id: 'consuelo', name: 'consuelo' },
      scope: { id: 'acme', name: 'acme' },
      linked: true,
    });
    expect(fake.requests[0]).toMatchObject({
      cwd: '/workspace/app',
      args: [
        'link',
        '--project',
        'consuelo; touch pwned',
        '--scope',
        'acme team',
        '--yes',
        '--no-color',
      ],
    });
  });

  it('publishes distinct preview and production deployment approval consequences', () => {
    const service = createDeploymentProviderService(createVercelProviderAdapter(), {
      process: createFakeProviderProcess([]).process,
    });

    expect(service.policy('deploy', { target: 'preview' }).approval).toEqual({
      required: true,
      consequence: 'Creates a Vercel preview deployment without assigning production domains.',
    });
    expect(service.policy('deploy', { target: 'production' }).approval).toEqual({
      required: true,
      consequence: 'Creates a Vercel production deployment and may reassign customer-facing domains.',
    });
    expect(vercelOperationCatalog.map((operation) => operation.name)).toContain('vercel.deploy.preview');
    expect(vercelOperationCatalog.map((operation) => operation.name)).toContain('vercel.deploy.production');
    expect(vercelOperationCatalog.map((operation) => operation.name)).toEqual(expect.arrayContaining([
      'vercel.project.configuration',
      'vercel.domain.list',
      'vercel.deployment.list',
      'vercel.deployment.status',
      'vercel.logs.read',
      'vercel.redeploy',
    ]));
    expect(vercelOperationCatalog.find((operation) => operation.name === 'vercel.deploy.production')?.approval).toEqual({
      required: true,
      consequence: 'Creates a Vercel production deployment and may reassign customer-facing domains.',
    });
  });

  it('normalizes project, deployment, status, and runtime-log inspection', async () => {
    const fake = createFakeProviderProcess([
      providerProcessResult({
        stdout: JSON.stringify(vercelProjectListFixture),
      }),
      providerProcessResult({ stdout: vercelDeploymentListFixture }),
      providerProcessResult({
        stdout: JSON.stringify(vercelDeploymentInspectionFixture),
      }),
      providerProcessResult({
        stdout: vercelRuntimeLogsFixture.map((entry) => JSON.stringify(entry)).join('\n'),
      }),
    ]);
    const service = createDeploymentProviderService(createVercelProviderAdapter(), {
      process: fake.process,
    });

    await expect(Effect.runPromise(service.projectList())).resolves.toEqual({
      projects: [
        { id: 'prj_1', name: 'alpha' },
        { id: 'prj_2', name: 'beta' },
      ],
      cursor: `vercel:${Buffer.from('1720000000000').toString('base64url')}`,
    });
    await expect(Effect.runPromise(service.deploymentList({
      projectId: 'consuelo',
      environment: 'production',
      cursor: '123',
    }))).resolves.toEqual({
      deployments: [
        {
          id: 'https://dep-one.vercel.app',
          url: 'https://dep-one.vercel.app',
          status: 'READY',
          environment: 'production',
        },
        {
          id: 'https://dep-two.vercel.app',
          url: 'https://dep-two.vercel.app',
          status: 'ERROR',
          environment: 'preview',
        },
      ],
    });
    await expect(Effect.runPromise(service.deploymentStatus({ deploymentId: 'dpl_123' }))).resolves.toEqual({
      id: 'dpl_123',
      url: 'https://dep-one.vercel.app',
      status: 'READY',
      createdAt: '2024-07-03T09:46:40.000Z',
      projectId: 'prj_1',
      environment: 'production',
    });
    await expect(Effect.runPromise(service.logsRead({ deploymentId: 'dpl_123' }))).resolves.toEqual({
      entries: [
        {
          message: 'started',
          timestamp: '2024-07-03T09:46:40.000Z',
          level: 'info',
          stream: 'lambda',
        },
        {
          message: 'complete',
          timestamp: '2026-07-23T12:00:00.000Z',
          level: 'warning',
          stream: 'edge',
        },
      ],
    });
    expect(fake.requests.map((request) => request.args)).toEqual([
      ['project', 'list', '--json', '--no-color'],
      ['list', 'consuelo', '--environment', 'production', '--next', '123', '--no-color'],
      ['inspect', 'dpl_123', '--json', '--no-color'],
      ['logs', 'dpl_123', '--json', '--no-color'],
    ]);
  });

  it('uses explicit deploy, redeploy, and promote semantics with approval', async () => {
    const fake = createFakeProviderProcess([
      providerProcessResult({ stdout: 'https://preview-one.vercel.app' }),
      providerProcessResult({ stdout: 'https://preview-two.vercel.app' }),
      providerProcessResult({ stdout: 'Promoted https://preview-two.vercel.app to production' }),
    ]);
    const service = createDeploymentProviderService(createVercelProviderAdapter(), {
      process: fake.process,
    });
    const approval = { approved: true, reason: 'Operator approved deployment mutation' };

    await expect(Effect.runPromise(service.deploy({ target: 'preview', source: './app', approval }))).resolves.toEqual({
      deploymentId: 'https://preview-one.vercel.app',
      url: 'https://preview-one.vercel.app',
      status: 'QUEUED',
    });
    await expect(Effect.runPromise(service.redeploy({ deploymentId: 'dpl_123', target: 'preview', approval }))).resolves.toEqual({
      deploymentId: 'https://preview-two.vercel.app',
      url: 'https://preview-two.vercel.app',
      status: 'QUEUED',
    });
    await expect(Effect.runPromise(service.deploymentPromote({ deploymentId: 'dpl_123', approval }))).resolves.toEqual({
      deploymentId: 'dpl_123',
      status: 'PROMOTED',
    });
    expect(fake.requests.map((request) => request.args)).toEqual([
      ['deploy', './app', '--target', 'preview', '--yes', '--no-color'],
      ['redeploy', 'dpl_123', '--target', 'preview', '--no-color'],
      ['promote', 'dpl_123', '--yes', '--no-color'],
    ]);
  });

  it('lists environment names and scopes and sets or deletes without exposing values', async () => {
    const secret = 'postgres://user:password@example.test/db?token=do-not-return';
    const fake = createFakeProviderProcess([
      providerProcessResult({ stdout: vercelEnvironmentListFixture }),
      providerProcessResult({ stdout: 'Added Environment Variable DATABASE_URL to Project consuelo' }),
      providerProcessResult({ stdout: 'Removed Environment Variable DATABASE_URL from Project consuelo' }),
    ]);
    const service = createDeploymentProviderService(createVercelProviderAdapter(), {
      process: fake.process,
    });
    const approval = { approved: true, reason: 'Operator approved environment mutation' };

    const listed = await Effect.runPromise(service.environmentListNames({ environment: 'production' }));
    expect(listed).toEqual([
      { name: 'DATABASE_URL', scopes: ['production'], present: true },
      { name: 'FEATURE_FLAG', scopes: ['preview', 'development'], present: true },
    ]);
    const set = await Effect.runPromise(service.environmentSet({
      name: 'DATABASE_URL',
      value: secret,
      scope: 'production',
      approval,
    }));
    expect(set).toEqual({ name: 'DATABASE_URL', scopes: ['production'], updated: true });
    const deleted = await Effect.runPromise(service.environmentDelete({
      name: 'DATABASE_URL',
      scope: 'production',
      approval,
    }));
    expect(deleted).toEqual({ name: 'DATABASE_URL', scopes: ['production'], deleted: true });
    expect(fake.requests.map((request) => request.args)).toEqual([
      ['env', 'list', 'production', '--no-color'],
      ['env', 'add', 'DATABASE_URL', 'production', '--force', '--no-color'],
      ['env', 'remove', 'DATABASE_URL', 'production', '--yes', '--no-color'],
    ]);
    expect(fake.requests[1].stdin).toBe(secret);
    expect(fake.requests.flatMap((request) => request.args).join(' ')).not.toContain(secret);
    expect(JSON.stringify({ listed, set, deleted })).not.toContain(secret);
  });

  it('returns read-only project configuration and domain inventory', async () => {
    const fake = createFakeProviderProcess([
      providerProcessResult({ stdout: vercelProjectInspectionFixture }),
      providerProcessResult({ stdout: vercelDomainListFixture }),
    ]);
    const service = createDeploymentProviderService(createVercelProviderAdapter(), {
      process: fake.process,
    });

    await expect(Effect.runPromise(service.projectConfiguration({ projectId: 'consuelo' }))).resolves.toEqual({
      id: 'prj_123',
      name: 'consuelo',
      framework: 'Next.js',
      nodeVersion: '22.x',
      rootDirectory: 'packages/app',
      team: { id: 'team_123', name: 'acme' },
      scope: { id: 'acme', name: 'acme' },
      domains: ['consuelo.vercel.app', 'consuelohq.com'],
    });
    await expect(Effect.runPromise(service.domainList())).resolves.toEqual({
      domains: [
        { name: 'consuelohq.com', registrar: 'Vercel', nameservers: 'Vercel' },
        { name: 'example.net', registrar: 'Third Party', nameservers: 'Third Party' },
      ],
    });
    expect(fake.requests.map((request) => request.args)).toEqual([
      ['project', 'inspect', 'consuelo', '--yes', '--no-color'],
      ['domains', 'list', '--no-color'],
    ]);
  });

  it('preserves raw argv, redacts credential-bearing URLs, and propagates bounded-output metadata', async () => {
    const malicious = '$(touch pwned); value with spaces';
    const fake = createFakeProviderProcess([
      providerProcessResult({
        stdout: `https://example.test/path?token=super-secret ${malicious}`,
        stdoutTruncated: true,
      }),
    ]);
    const service = createDeploymentProviderService(createVercelProviderAdapter(), {
      process: fake.process,
    });

    const result = await Effect.runPromise(service.raw({
      args: ['inspect', malicious],
      approval: { approved: true, reason: 'Raw read inspection approved' },
    }));
    expect(fake.requests[0].args).toEqual(['inspect', malicious]);
    expect(result.stdout).toContain('REDACTED');
    expect(result.stdout).not.toContain('super-secret');
    expect(result.stdoutTruncated).toBe(true);
  });

  it('fails closed on version and output drift instead of guessing', async () => {
    const malformedVersion = createDeploymentProviderService(createVercelProviderAdapter(), {
      process: createFakeProviderProcess([
        providerProcessResult({ stdout: 'Vercel CLI next' }),
      ]).process,
    });
    await expectProviderError(malformedVersion.detect(), 'MALFORMED_OUTPUT');

    const malformedProjects = createDeploymentProviderService(createVercelProviderAdapter(), {
      process: createFakeProviderProcess([
        providerProcessResult({ stdout: JSON.stringify({ items: [{ slug: 'unexpected' }] }) }),
      ]).process,
    });
    const error = await expectProviderError(malformedProjects.projectList(), 'MALFORMED_OUTPUT');
    expect(error.message).toContain('project.list');
  });
});
