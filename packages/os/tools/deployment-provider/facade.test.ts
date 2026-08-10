import { Effect } from 'effect';
import { describe, expect, it } from 'vitest';

import { ProviderError } from './errors';
import {
  deploymentToolNames,
  executeDeploymentFacade,
  type DeploymentFacadeServiceResolver,
} from './facade';
import { createDeploymentProviderService } from './service';
import {
  createFakeDeploymentProviderAdapter,
  createFakeProviderProcess,
  providerProcessResult,
} from './testing';

const resolver = (
  provider: 'railway' | 'vercel' | 'cloudflare',
  results: ReturnType<typeof providerProcessResult>[],
): { resolve: DeploymentFacadeServiceResolver; requests: ReturnType<typeof createFakeProviderProcess>['requests'] } => {
  const fake = createFakeProviderProcess(results);
  const service = createDeploymentProviderService(
    createFakeDeploymentProviderAdapter({ provider, executable: `${provider}-cli` }),
    { process: fake.process },
  );
  return {
    resolve: (selected) => {
      expect(selected).toBe(provider);
      return service;
    },
    requests: fake.requests,
  };
};

const expectProviderError = async (
  effect: Effect.Effect<unknown, ProviderError>,
  code: ProviderError['code'],
): Promise<ProviderError> => {
  const result = await Effect.runPromise(Effect.either(effect));
  expect(result._tag).toBe('Left');
  if (result._tag !== 'Left') throw new Error(`expected ${code}`);
  expect(result.left.code).toBe(code);
  return result.left;
};

describe('customer deployment facade', () => {
  it('publishes one provider-neutral eight-tool surface', () => {
    expect(deploymentToolNames).toEqual([
      'deployment.detect',
      'deployment.context',
      'deployment.list',
      'deployment.status',
      'deployment.logs',
      'deployment.deploy',
      'deployment.environment',
      'deployment.raw',
    ]);
  });

  it('selects the requested provider and runs reads without write approval', async () => {
    const railway = resolver('railway', [
      providerProcessResult({ stdout: JSON.stringify({ projects: [{ id: 'project-1', name: 'Customer App' }] }) }),
    ]);

    await expect(Effect.runPromise(executeDeploymentFacade({
      tool: 'deployment.list',
      provider: 'railway',
      resource: 'projects',
    }, { resolveService: railway.resolve }))).resolves.toEqual({
      projects: [{ id: 'project-1', name: 'Customer App' }],
    });
    expect(railway.requests).toHaveLength(1);
  });

  it('fails closed before provider execution when a deployment mutation lacks approval', async () => {
    const vercel = resolver('vercel', []);
    const error = await expectProviderError(executeDeploymentFacade({
      tool: 'deployment.deploy',
      provider: 'vercel',
      action: 'deploy',
      target: 'production',
    }, { resolveService: vercel.resolve }), 'APPROVAL_REQUIRED');

    expect(error.approval?.required).toBe(true);
    expect(vercel.requests).toHaveLength(0);
  });

  it('returns environment metadata without provider secret values', async () => {
    const secret = 'cf-secret-value-never-return';
    const cloudflare = resolver('cloudflare', [
      providerProcessResult({ stdout: JSON.stringify([
        { name: 'API_TOKEN', scopes: ['production'], present: true, value: secret },
      ]) }),
    ]);

    const result = await Effect.runPromise(executeDeploymentFacade({
      tool: 'deployment.environment',
      provider: 'cloudflare',
      action: 'list',
    }, { resolveService: cloudflare.resolve }));
    expect(result).toEqual([{ name: 'API_TOKEN', scopes: ['production'], present: true }]);
    expect(JSON.stringify(result)).not.toContain(secret);
  });

  it.each([
    ['railway', 'npm install -g @railway/cli', 'railway login'],
    ['vercel', 'npm install -g vercel', 'vercel login'],
    ['cloudflare', 'npm install -g wrangler', 'wrangler login'],
  ] as const)('adds credential-safe recovery guidance for %s capability failures', async (
    provider,
    installCommand,
    loginCommand,
  ) => {
    const missing = resolver(provider, [
      providerProcessResult({ runtimeMissing: true, stderr: 'ENOENT' }),
    ]);
    const missingError = await expectProviderError(executeDeploymentFacade({
      tool: 'deployment.detect',
      provider,
    }, { resolveService: missing.resolve }), 'CLI_MISSING');
    expect(missingError.recovery).toEqual(expect.objectContaining({
      action: 'install_cli',
      command: installCommand,
    }));

    const unauthenticated = resolver(provider, [
      providerProcessResult({ exitCode: 1, stderr: 'not authenticated; login required' }),
    ]);
    const authError = await expectProviderError(executeDeploymentFacade({
      tool: 'deployment.context',
      provider,
      action: 'auth',
    }, { resolveService: unauthenticated.resolve }), 'UNAUTHENTICATED');
    expect(authError.recovery).toEqual(expect.objectContaining({
      action: 'authenticate_cli',
      command: loginCommand,
    }));
    expect(JSON.stringify(authError)).not.toMatch(/token|password|secret/i);
  });
});
