import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { Effect } from 'effect';
import { describe, expect, expectTypeOf, it } from 'vitest';

import { ProviderError } from '../deployment-provider/errors';
import {
  createFakeProviderProcess,
  providerProcessResult,
} from '../deployment-provider/testing';
import type {
  ProviderContext,
  ProviderDeploymentList,
  ProviderEnvironmentDeleteResult,
  ProviderEnvironmentSetResult,
  ProviderLogResult,
  ProviderProjectList,
  ProviderServiceList,
} from '../deployment-provider/types';
import { createRailwayAdapter } from './adapter';
import {
  parseRailwayLogsArgs,
  parseRailwayRedeployArgs,
  runRailwayRedeployCli,
} from './cli';
import { toolPackage } from './manifest';
import { createRailwayService } from './service';

const expectProviderError = async (
  effect: Effect.Effect<unknown, ProviderError>,
  code: ProviderError['code'],
): Promise<ProviderError> => {
  const result = await Effect.runPromise(Effect.either(effect));
  expect(result._tag).toBe('Left');
  if (result._tag !== 'Left') throw new Error(`expected provider error ${code}`);
  expect(result.left).toBeInstanceOf(ProviderError);
  expect(result.left.code).toBe(code);
  return result.left;
};

const deployment = (
  id: string,
  status: string,
  overrides: Record<string, unknown> = {},
): Record<string, unknown> => ({
  id,
  status,
  createdAt: '2026-07-23T12:00:00.000Z',
  serviceId: 'svc-api',
  ...overrides,
});

describe('Railway provider adapter', () => {
  it('uses the canonical package boundary without publishing public tools before Worker 12', () => {
    expect(toolPackage.domain).toBe('railway');
    expect(toolPackage.sourcePath).toBe('packages/os/tools/railway/manifest.ts');
    expect(toolPackage.definitions).toEqual([]);
    expect(toolPackage.handlers).toEqual([]);
    expect(toolPackage.schemas).toEqual([]);
  });

  it('exposes provider-neutral typed results for the Railway operations', () => {
    const service = createRailwayService({
      process: createFakeProviderProcess([]).process,
    });

    expectTypeOf(service.contextCurrent()).toEqualTypeOf<Effect.Effect<ProviderContext, ProviderError>>();
    expectTypeOf(service.projectList()).toEqualTypeOf<Effect.Effect<ProviderProjectList, ProviderError>>();
    expectTypeOf(service.serviceList()).toEqualTypeOf<Effect.Effect<ProviderServiceList, ProviderError>>();
    expectTypeOf(service.deploymentList()).toEqualTypeOf<Effect.Effect<ProviderDeploymentList, ProviderError>>();
    expectTypeOf(service.logsRead({ serviceId: 'api' })).toEqualTypeOf<Effect.Effect<ProviderLogResult, ProviderError>>();
    expectTypeOf(service.environmentSet({
      name: 'FEATURE_FLAG',
      value: 'enabled',
      serviceId: 'api',
    })).toEqualTypeOf<Effect.Effect<ProviderEnvironmentSetResult, ProviderError>>();
    expectTypeOf(service.environmentDelete({
      name: 'FEATURE_FLAG',
      serviceId: 'api',
    })).toEqualTypeOf<Effect.Effect<ProviderEnvironmentDeleteResult, ProviderError>>();
  });

  it('detects supported Railway CLI versions and maps a missing executable', async () => {
    const supported = createFakeProviderProcess([
      providerProcessResult({ stdout: 'railway 5.28.0' }),
    ]);
    const service = createRailwayService({ process: supported.process });

    await expect(Effect.runPromise(service.detect())).resolves.toEqual({
      provider: 'railway',
      executable: 'railway',
      version: { raw: '5.28.0', major: 5, minor: 28, patch: 0 },
    });
    expect(supported.requests[0]).toMatchObject({
      command: 'railway',
      args: ['--version'],
    });

    const missing = createFakeProviderProcess([
      providerProcessResult({ runtimeMissing: true, stderr: 'ENOENT' }),
    ]);
    const missingService = createRailwayService({ process: missing.process });
    const error = await expectProviderError(missingService.detect(), 'CLI_MISSING');
    expect(error.message).toContain('railway');
  });

  it('reports CLI authentication without returning credential-shaped fields', async () => {
    const fake = createFakeProviderProcess([
      providerProcessResult({
        stdout: JSON.stringify({
          id: 'usr_123',
          email: 'customer@example.test',
          token: 'must-not-return',
        }),
      }),
    ]);
    const service = createRailwayService({ process: fake.process });

    const result = await Effect.runPromise(service.authStatus());
    expect(result).toEqual({
      authenticated: true,
      identity: 'customer@example.test',
      source: 'cli',
    });
    expect(JSON.stringify(result)).not.toContain('must-not-return');
    expect(fake.requests[0].args).toEqual(['whoami', '--json']);
  });

  it('maps unauthenticated and unlinked CLI states to actionable typed errors', async () => {
    const unauthenticated = createFakeProviderProcess([
      providerProcessResult({ exitCode: 1, stderr: 'Not logged in. Run railway login.' }),
    ]);
    const unauthenticatedService = createRailwayService({ process: unauthenticated.process });
    const authError = await expectProviderError(
      unauthenticatedService.authStatus(),
      'UNAUTHENTICATED',
    );
    expect(authError.message).toContain('railway login');

    const unlinked = createFakeProviderProcess([
      providerProcessResult({ exitCode: 1, stderr: 'No project linked to this directory' }),
    ]);
    const unlinkedService = createRailwayService({ process: unlinked.process });
    const contextError = await expectProviderError(
      unlinkedService.contextCurrent(),
      'NO_CONTEXT',
    );
    expect(contextError.message).toContain('railway link');
  });

  it('normalizes linked workspace, project, environment, and service context', async () => {
    const fake = createFakeProviderProcess([
      providerProcessResult({
        stdout: JSON.stringify({
          workspace: { id: 'ws_123', name: 'Acme' },
          project: { id: 'prj_123', name: 'Customer App' },
          environment: { id: 'env_123', name: 'production' },
          service: { id: 'svc_123', name: 'api' },
        }),
      }),
    ]);
    const service = createRailwayService({ process: fake.process });

    await expect(Effect.runPromise(service.contextCurrent())).resolves.toEqual({
      workspace: { id: 'ws_123', name: 'Acme' },
      project: { id: 'prj_123', name: 'Customer App' },
      environment: { id: 'env_123', name: 'production' },
      service: { id: 'svc_123', name: 'api' },
    });
    expect(fake.requests[0].args).toEqual(['status', '--json']);
  });

  it('lists projects and multiple services without a hidden service default', async () => {
    const fake = createFakeProviderProcess([
      providerProcessResult({
        stdout: JSON.stringify([
          { id: 'prj_1', name: 'One', workspace: { id: 'ws_1', name: 'Acme' } },
          { id: 'prj_2', name: 'Two', workspace: { id: 'ws_1', name: 'Acme' } },
        ]),
      }),
      providerProcessResult({
        stdout: JSON.stringify([
          { id: 'svc_api', name: 'api', status: 'SUCCESS' },
          { id: 'svc_worker', name: 'worker', status: 'SLEEPING' },
        ]),
      }),
    ]);
    const service = createRailwayService({ process: fake.process });

    await expect(Effect.runPromise(service.projectList())).resolves.toEqual({
      projects: [
        { id: 'prj_1', name: 'One', workspace: { id: 'ws_1', name: 'Acme' } },
        { id: 'prj_2', name: 'Two', workspace: { id: 'ws_1', name: 'Acme' } },
      ],
    });
    await expect(Effect.runPromise(service.serviceList())).resolves.toEqual({
      services: [
        { id: 'svc_api', name: 'api', status: 'SUCCESS' },
        { id: 'svc_worker', name: 'worker', status: 'SLEEPING' },
      ],
    });
    expect(fake.requests.map((request) => request.args)).toEqual([
      ['list', '--json'],
      ['service', 'status', '--all', '--json'],
    ]);
    expect(fake.requests.flatMap((request) => request.args)).not.toContain('opensaas');
  });

  it('lists deployments and resolves an explicit deployment status using structured CLI output', async () => {
    const rows = [
      deployment('dep_2', 'SUCCESS', { url: 'https://customer.example.test' }),
      deployment('dep_1', 'FAILED'),
    ];
    const fake = createFakeProviderProcess([
      providerProcessResult({ stdout: JSON.stringify(rows) }),
      providerProcessResult({ stdout: JSON.stringify(rows) }),
    ]);
    const service = createRailwayService({ process: fake.process });

    await expect(Effect.runPromise(service.deploymentList({
      serviceId: 'api',
      environment: 'production',
      limit: 25,
    }))).resolves.toEqual({
      deployments: [
        {
          id: 'dep_2',
          status: 'SUCCESS',
          url: 'https://customer.example.test',
          createdAt: '2026-07-23T12:00:00.000Z',
          serviceId: 'svc-api',
        },
        {
          id: 'dep_1',
          status: 'FAILED',
          createdAt: '2026-07-23T12:00:00.000Z',
          serviceId: 'svc-api',
        },
      ],
    });
    await expect(Effect.runPromise(service.deploymentStatus({
      deploymentId: 'dep_1',
      serviceId: 'api',
      environment: 'production',
    }))).resolves.toMatchObject({ id: 'dep_1', status: 'FAILED' });

    expect(fake.requests[0].args).toEqual([
      'deployment', 'list',
      '--service', 'api',
      '--environment', 'production',
      '--limit', '25',
      '--json',
    ]);
    expect(fake.requests[1].args).toEqual([
      'deployment', 'list',
      '--service', 'api',
      '--environment', 'production',
      '--limit', '1000',
      '--json',
    ]);
  });

  it('reads bounded structured runtime and build logs with filters and truncation metadata', async () => {
    const output = [
      JSON.stringify({ timestamp: '2026-07-23T12:00:00Z', message: 'build started', level: 'info' }),
      JSON.stringify({ timestamp: '2026-07-23T12:00:01Z', message: 'build failed', severity: 'error' }),
    ].join('\n');
    const fake = createFakeProviderProcess([
      providerProcessResult({ stdout: output, stdoutTruncated: true }),
      providerProcessResult({ stdout: output }),
    ]);
    const service = createRailwayService({ process: fake.process });

    await expect(Effect.runPromise(service.logsRead({
      deploymentId: 'dep_2',
      serviceId: 'api',
      environment: 'production',
      kind: 'build',
      filter: '@level:error',
      limit: 50,
      since: '1h',
      until: '10m',
      latest: true,
    }))).resolves.toEqual({
      kind: 'build',
      requestedLimit: 50,
      returned: 2,
      truncated: true,
      entries: [
        { message: 'build started', timestamp: '2026-07-23T12:00:00Z', level: 'info', stream: 'build' },
        { message: 'build failed', timestamp: '2026-07-23T12:00:01Z', level: 'error', stream: 'build' },
      ],
    });
    await Effect.runPromise(service.logsRead({ serviceId: 'api', kind: 'runtime', limit: 20 }));

    expect(fake.requests[0].args).toEqual([
      'logs', 'dep_2',
      '--service', 'api',
      '--environment', 'production',
      '--build',
      '--json',
      '--lines', '50',
      '--filter', '@level:error',
      '--since', '1h',
      '--until', '10m',
      '--latest',
    ]);
    expect(fake.requests[1].args).toEqual([
      'logs',
      '--service', 'api',
      '--deployment',
      '--json',
      '--lines', '20',
    ]);
  });

  it('returns only variable names and scopes, never Railway variable values', async () => {
    const secret = 'postgres://user:password@example.test/database';
    const fake = createFakeProviderProcess([
      providerProcessResult({
        stdout: JSON.stringify({ DATABASE_URL: secret, PUBLIC_FLAG: 'enabled' }),
      }),
    ]);
    const service = createRailwayService({ process: fake.process });

    const result = await Effect.runPromise(service.environmentListNames({
      serviceId: 'api',
      environment: 'production',
    }));
    expect(result).toEqual([
      {
        name: 'DATABASE_URL',
        scopes: ['service:api', 'environment:production'],
        present: true,
      },
      {
        name: 'PUBLIC_FLAG',
        scopes: ['service:api', 'environment:production'],
        present: true,
      },
    ]);
    expect(JSON.stringify(result)).not.toContain(secret);
    expect(fake.requests[0].args).toEqual([
      'variables',
      '--service', 'api',
      '--environment', 'production',
      '--json',
    ]);
  });

  it('suppresses variable command output from malformed-output diagnostics', async () => {
    const secret = 'railway-secret-value-that-must-not-escape';
    const fake = createFakeProviderProcess([
      providerProcessResult({ stdout: secret }),
    ]);
    const service = createRailwayService({ process: fake.process });

    const error = await expectProviderError(service.environmentListNames({
      serviceId: 'api',
    }), 'MALFORMED_OUTPUT');
    expect(JSON.stringify(error)).not.toContain(secret);
    expect(error.diagnostics?.stdout).toBe('');
  });

  it('sets variables through stdin and deletes them only with explicit approval', async () => {
    const secret = 'stdin-only-secret';
    const fake = createFakeProviderProcess([
      providerProcessResult({ stdout: 'Variable set' }),
      providerProcessResult({ stdout: 'Variable deleted' }),
    ]);
    const service = createRailwayService({ process: fake.process });

    await expectProviderError(service.environmentSet({
      name: 'DATABASE_URL',
      value: secret,
      serviceId: 'api',
      environment: 'production',
    }), 'APPROVAL_REQUIRED');
    expect(fake.requests).toHaveLength(0);

    await expect(Effect.runPromise(service.environmentSet({
      name: 'DATABASE_URL',
      value: secret,
      serviceId: 'api',
      environment: 'production',
      skipDeploys: true,
      approval: { approved: true, reason: 'Customer approved variable update' },
    }))).resolves.toEqual({
      name: 'DATABASE_URL',
      scopes: ['service:api', 'environment:production'],
      updated: true,
    });

    await expect(Effect.runPromise(service.environmentDelete({
      name: 'DATABASE_URL',
      serviceId: 'api',
      environment: 'production',
      skipDeploys: true,
      approval: { approved: true, reason: 'Customer approved variable deletion' },
    }))).resolves.toEqual({
      name: 'DATABASE_URL',
      scopes: ['service:api', 'environment:production'],
      deleted: true,
    });

    expect(fake.requests[0].stdin).toBe(secret);
    expect(fake.requests[0].args).toEqual([
      'variables',
      '--service', 'api',
      '--environment', 'production',
      '--set-from-stdin', 'DATABASE_URL',
      '--skip-deploys',
    ]);
    expect(fake.requests[0].args.join(' ')).not.toContain(secret);
    expect(fake.requests[1].args).toEqual([
      'variable', 'delete', 'DATABASE_URL',
      '--service', 'api',
      '--environment', 'production',
      '--yes',
      '--skip-deploys',
    ]);
  });

  it('maps an older CLI without variable deletion to unsupported capability', async () => {
    const fake = createFakeProviderProcess([
      providerProcessResult({
        exitCode: 1,
        stderr: "error: unrecognized subcommand 'variable'",
      }),
    ]);
    const service = createRailwayService({ process: fake.process });

    await expectProviderError(service.environmentDelete({
      name: 'FEATURE_FLAG',
      serviceId: 'api',
      approval: { approved: true, reason: 'Compatibility test' },
    }), 'UNSUPPORTED_CAPABILITY');
  });

  it('redeploys only an explicitly selected service and optionally waits for a bounded terminal status', async () => {
    const oldDeployment = deployment('dep_old', 'SUCCESS');
    const newBuilding = deployment('dep_new', 'BUILDING');
    const newSuccess = deployment('dep_new', 'SUCCESS');
    const fake = createFakeProviderProcess([
      providerProcessResult({ stdout: JSON.stringify([oldDeployment]) }),
      providerProcessResult({ stdout: 'Redeploying service' }),
      providerProcessResult({ stdout: JSON.stringify([newBuilding, oldDeployment]) }),
      providerProcessResult({ stdout: JSON.stringify([newSuccess, oldDeployment]) }),
    ]);
    const service = createRailwayService({
      process: fake.process,
      sleep: () => Promise.resolve(),
      now: (() => {
        let value = 0;
        return () => (value += 100);
      })(),
      pollIntervalMs: 1,
    });

    await expectProviderError(service.redeploy({
      serviceId: 'api',
      wait: true,
    }), 'APPROVAL_REQUIRED');
    expect(fake.requests).toHaveLength(0);

    await expect(Effect.runPromise(service.redeploy({
      serviceId: 'api',
      wait: true,
      timeoutMs: 5_000,
      approval: { approved: true, reason: 'Customer approved redeploy' },
    }))).resolves.toEqual({
      deploymentId: 'dep_new',
      serviceId: 'api',
      status: 'SUCCESS',
      waited: true,
    });

    expect(fake.requests.map((request) => request.args)).toEqual([
      ['deployment', 'list', '--service', 'api', '--limit', '20', '--json'],
      ['redeploy', '--service', 'api', '--yes'],
      ['deployment', 'list', '--service', 'api', '--limit', '20', '--json'],
      ['deployment', 'list', '--service', 'api', '--limit', '20', '--json'],
    ]);
  });

  it('returns immediately after a successful redeploy when wait is false', async () => {
    const fake = createFakeProviderProcess([
      providerProcessResult({ stdout: 'Redeploying service' }),
    ]);
    const service = createRailwayService({ process: fake.process });

    await expect(Effect.runPromise(service.redeploy({
      serviceId: 'api',
      wait: false,
      approval: { approved: true, reason: 'Customer approved non-waiting redeploy' },
    }))).resolves.toEqual({
      deploymentId: 'latest',
      serviceId: 'api',
      status: 'triggered',
      waited: false,
    });

    expect(fake.requests.map((request) => request.args)).toEqual([
      ['redeploy', '--service', 'api', '--yes'],
    ]);
  });

  it('keeps the non-waiting compatibility CLI fire-and-forget', async () => {
    const fake = createFakeProviderProcess([
      providerProcessResult({ stdout: 'Redeploying service' }),
    ]);
    const service = createRailwayService({ process: fake.process });
    const stdout: string[] = [];
    const stderr: string[] = [];

    await expect(runRailwayRedeployCli([
      '--service', 'api',
      '--yes',
      '--quiet',
    ], {
      service,
      io: {
        stdout: (message) => stdout.push(message),
        stderr: (message) => stderr.push(message),
      },
    })).resolves.toBe(0);

    expect(stdout).toEqual(['api: triggered (latest)']);
    expect(stderr).toEqual([]);
    expect(fake.requests.map((request) => request.args)).toEqual([
      ['redeploy', '--service', 'api', '--yes'],
    ]);
  });

  it('keeps wait tracking pinned when a poll temporarily omits the new deployment', async () => {
    const oldDeployment = deployment('dep_old', 'SUCCESS');
    const newBuilding = deployment('dep_new', 'BUILDING');
    const competingSuccess = deployment('dep_competing', 'SUCCESS');
    const newSuccess = deployment('dep_new', 'SUCCESS');
    const fake = createFakeProviderProcess([
      providerProcessResult({ stdout: JSON.stringify([oldDeployment]) }),
      providerProcessResult({ stdout: 'Redeploying service' }),
      providerProcessResult({ stdout: JSON.stringify([newBuilding, oldDeployment]) }),
      providerProcessResult({ stdout: JSON.stringify([competingSuccess, oldDeployment]) }),
      providerProcessResult({ stdout: JSON.stringify([newSuccess, competingSuccess, oldDeployment]) }),
    ]);
    const service = createRailwayService({
      process: fake.process,
      sleep: () => Promise.resolve(),
      now: (() => {
        let value = 0;
        return () => (value += 100);
      })(),
      pollIntervalMs: 1,
    });

    await expect(Effect.runPromise(service.redeploy({
      serviceId: 'api',
      wait: true,
      timeoutMs: 5_000,
      approval: { approved: true, reason: 'Pinned deployment tracking test' },
    }))).resolves.toMatchObject({
      deploymentId: 'dep_new',
      status: 'SUCCESS',
      waited: true,
    });
    expect(fake.requests).toHaveLength(5);
  });

  it('treats redeploy environment as an assertion against linked context', async () => {
    const oldDeployment = deployment('dep_old', 'SUCCESS');
    const newBuilding = deployment('dep_new', 'BUILDING');
    const newSuccess = deployment('dep_new', 'SUCCESS');
    const fake = createFakeProviderProcess([
      providerProcessResult({
        stdout: JSON.stringify({
          project: { id: 'prj_123', name: 'Customer App' },
          environment: { id: 'env_prod', name: 'production' },
          service: { id: 'svc_api', name: 'api' },
        }),
      }),
      providerProcessResult({ stdout: JSON.stringify([oldDeployment]) }),
      providerProcessResult({ stdout: 'Redeploying service' }),
      providerProcessResult({ stdout: JSON.stringify([newBuilding, oldDeployment]) }),
      providerProcessResult({ stdout: JSON.stringify([newSuccess, oldDeployment]) }),
    ]);
    const service = createRailwayService({
      process: fake.process,
      sleep: () => Promise.resolve(),
      now: (() => {
        let value = 0;
        return () => (value += 100);
      })(),
      pollIntervalMs: 1,
    });

    await expect(Effect.runPromise(service.redeploy({
      serviceId: 'api',
      environment: 'production',
      wait: true,
      timeoutMs: 5_000,
      approval: { approved: true, reason: 'Linked environment assertion test' },
    }))).resolves.toMatchObject({
      deploymentId: 'dep_new',
      status: 'SUCCESS',
    });

    expect(fake.requests.map((request) => request.args)).toEqual([
      ['status', '--json'],
      ['deployment', 'list', '--service', 'api', '--limit', '20', '--json'],
      ['redeploy', '--service', 'api', '--yes'],
      ['deployment', 'list', '--service', 'api', '--limit', '20', '--json'],
      ['deployment', 'list', '--service', 'api', '--limit', '20', '--json'],
    ]);
  });

  it('rejects a redeploy environment that does not match linked context', async () => {
    const fake = createFakeProviderProcess([
      providerProcessResult({
        stdout: JSON.stringify({
          project: { id: 'prj_123', name: 'Customer App' },
          environment: { id: 'env_stage', name: 'staging' },
          service: { id: 'svc_api', name: 'api' },
        }),
      }),
    ]);
    const service = createRailwayService({ process: fake.process });

    const error = await expectProviderError(service.redeploy({
      serviceId: 'api',
      environment: 'production',
      wait: false,
      approval: { approved: true, reason: 'Mismatched environment test' },
    }), 'INVALID_INPUT');
    expect(error.message).toContain('linked Railway environment');
    expect(fake.requests.map((request) => request.args)).toEqual([
      ['status', '--json'],
    ]);
  });

  it('rejects direct adapter redeploy environment selection', () => {
    const adapter = createRailwayAdapter();
    expect(() => adapter.operations.redeploy.command({
      serviceId: 'api',
      environment: 'production',
      approval: { approved: true, reason: 'Direct adapter environment test' },
    })).toThrow(/linked Railway environment/);
  });

  it('fails closed when a redeploy wait exceeds its bound', async () => {
    const oldDeployment = deployment('dep_old', 'SUCCESS');
    const newBuilding = deployment('dep_new', 'BUILDING');
    const fake = createFakeProviderProcess([
      providerProcessResult({ stdout: JSON.stringify([oldDeployment]) }),
      providerProcessResult({ stdout: 'Redeploying service' }),
      providerProcessResult({ stdout: JSON.stringify([newBuilding, oldDeployment]) }),
      providerProcessResult({ stdout: JSON.stringify([newBuilding, oldDeployment]) }),
    ]);
    const service = createRailwayService({
      process: fake.process,
      sleep: () => Promise.resolve(),
      now: (() => {
        let value = 0;
        return () => (value += 1_000);
      })(),
      pollIntervalMs: 1,
    });

    await expectProviderError(service.redeploy({
      serviceId: 'api',
      wait: true,
      timeoutMs: 1_500,
      approval: { approved: true, reason: 'Timeout behavior test' },
    }), 'TIMEOUT');
  });

  it.each([
    ['service', 'api; touch /tmp/pwned'],
    ['service', '$(touch /tmp/pwned)'],
    ['service', '--environment'],
    ['filter', '@level:error; curl attacker.test'],
    ['filter', '$(curl attacker.test)'],
  ] as const)('rejects unsafe %s input before process execution', async (kind, value) => {
    const fake = createFakeProviderProcess([]);
    const service = createRailwayService({ process: fake.process });
    const effect = kind === 'service'
      ? service.deploymentList({ serviceId: value })
      : service.logsRead({ serviceId: 'api', filter: value });

    const error = await expectProviderError(effect, 'INVALID_INPUT');
    expect(error.message).toContain(kind);
    expect(fake.requests).toHaveLength(0);
  });

  it('preserves supported Railway filter syntax as one argv value', async () => {
    const fake = createFakeProviderProcess([
      providerProcessResult({ stdout: '' }),
    ]);
    const service = createRailwayService({ process: fake.process });
    const filter = '@level:error AND "rate limit" OR timeout';

    await Effect.runPromise(service.logsRead({
      serviceId: 'api',
      filter,
      limit: 10,
    }));

    expect(fake.requests[0].args).toContain(filter);
    expect(fake.requests[0].args.filter((argument) => argument === filter)).toHaveLength(1);
  });

  it('keeps raw flags as separate argv values while rejecting shell syntax', async () => {
    const fake = createFakeProviderProcess([
      providerProcessResult({ stdout: JSON.stringify({ ok: true }) }),
    ]);
    const service = createRailwayService({ process: fake.process });

    await Effect.runPromise(service.raw({
      args: ['status', '--json'],
      approval: { approved: true, reason: 'Raw argv preservation test' },
    }));
    expect(fake.requests[0].args).toEqual(['status', '--json']);

    await expectProviderError(service.raw({
      args: ['status; touch /tmp/pwned'],
      approval: { approved: true, reason: 'Raw argv rejection test' },
    }), 'INVALID_INPUT');
  });

  it('requires explicit service and approval flags in the legacy command wrappers', () => {
    expect(() => parseRailwayLogsArgs([])).toThrow(/--service/);
    expect(() => parseRailwayRedeployArgs(['--service', 'api'])).toThrow(/--yes/);
    expect(parseRailwayLogsArgs([
      '--service', 'api',
      '--build',
      '--filter', '@level:error',
      '--lines', '25',
      '--json',
      '--quiet',
    ])).toMatchObject({
      serviceId: 'api',
      kind: 'build',
      filter: '@level:error',
      limit: 25,
      json: true,
      quiet: true,
    });
    expect(parseRailwayRedeployArgs([
      '--service', 'api',
      '--wait',
      '--timeout', '10m',
      '--yes',
      '--json',
      '--quiet',
    ])).toMatchObject({
      serviceId: 'api',
      wait: true,
      timeoutMs: 600_000,
      approved: true,
      json: true,
      quiet: true,
    });
  });

  it('contains no Consuelo resource defaults, token-file reads, private API calls, shell execution, or browser scraping', () => {
    const root = join(import.meta.dirname, '../..');
    const files = [
      join(import.meta.dirname, 'adapter.ts'),
      join(import.meta.dirname, 'service.ts'),
      join(import.meta.dirname, 'cli.ts'),
      join(root, 'scripts/railway-logs.js'),
      join(root, 'scripts/railway-redeploy.js'),
      join(root, '../workspace/scripts/railway-logs.js'),
      join(root, '../workspace/scripts/railway-redeploy.js'),
    ];
    const content = files.map((file) => readFileSync(file, 'utf8')).join('\n');
    const forbidden = [
      "DEFAULT_SERVICE = 'opensaas'",
      "DEFAULT_SERVICES = ['opensaas']",
      'twenty-worker',
      'a3e618e2-9685-401f-b924-a125b0fb9123',
      '85b58812-5bc2-4a99-a1ca-aa64a0a213b5',
      '6de4fa99-b047-4587-b003-69f78b650aa1',
      '.railway/config.json',
      'backboard.railway.com/graphql',
      'agent-browser',
      'execSync(',
    ];
    for (const value of forbidden) expect(content).not.toContain(value);
  });

  it('declares the complete Railway capability set on the shared provider core', () => {
    const adapter = createRailwayAdapter();
    expect(adapter.capabilities).toEqual([
      'detect',
      'auth.status',
      'context.current',
      'project.list',
      'service.list',
      'deployment.list',
      'deployment.status',
      'logs.read',
      'redeploy',
      'environment.listNames',
      'environment.set',
      'environment.delete',
      'raw',
    ]);
    expect(adapter.capabilities).not.toContain('deploy');
  });
});
