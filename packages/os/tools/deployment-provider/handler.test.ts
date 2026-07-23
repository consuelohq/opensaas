import { chmodSync, existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { Effect } from 'effect';
import { afterEach, describe, expect, expectTypeOf, it } from 'vitest';

import { ProviderError } from './errors';
import { toolPackage } from './manifest';
import { createNodeProviderProcess } from './process';
import { createDeploymentProviderService } from './service';
import type {
  ProviderContext,
  ProviderDeployment,
  ProviderDeploymentList,
  ProviderDeploymentMutationResult,
  ProviderEnvironmentSetResult,
  ProviderLogResult,
  ProviderProjectList,
} from './types';
import {
  createFakeDeploymentProviderAdapter,
  createFakeProviderProcess,
  providerProcessResult,
} from './testing';

const temporaryDirectories: string[] = [];

const temporaryDirectory = (prefix: string): string => {
  const directory = mkdtempSync(join(tmpdir(), prefix));
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
  expect(result.left).toBeInstanceOf(ProviderError);
  expect(result.left.code).toBe(code);
  return result.left;
};

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe('deployment provider core', () => {
  it('exposes typed opinionated operation results for adapter consumers', () => {
    const service = createDeploymentProviderService(createFakeDeploymentProviderAdapter(), {
      process: createFakeProviderProcess([]).process,
    });

    expectTypeOf(service.contextCurrent()).toEqualTypeOf<Effect.Effect<ProviderContext, ProviderError>>();
    expectTypeOf(service.projectList()).toEqualTypeOf<Effect.Effect<ProviderProjectList, ProviderError>>();
    expectTypeOf(service.deploymentList()).toEqualTypeOf<Effect.Effect<ProviderDeploymentList, ProviderError>>();
    expectTypeOf(service.deploymentStatus({ deploymentId: 'dep_123' })).toEqualTypeOf<Effect.Effect<ProviderDeployment, ProviderError>>();
    expectTypeOf(service.logsRead({ deploymentId: 'dep_123' })).toEqualTypeOf<Effect.Effect<ProviderLogResult, ProviderError>>();
    expectTypeOf(service.deploy({ target: 'production' })).toEqualTypeOf<Effect.Effect<ProviderDeploymentMutationResult, ProviderError>>();
    expectTypeOf(service.environmentSet({ name: 'FEATURE_FLAG', value: 'enabled' })).toEqualTypeOf<Effect.Effect<ProviderEnvironmentSetResult, ProviderError>>();
  });

  it('keeps the provider-neutral package canonical without publishing tools early', () => {
    expect(toolPackage.domain).toBe('deployment-provider');
    expect(toolPackage.sourcePath).toBe('packages/os/tools/deployment-provider/manifest.ts');
    expect(toolPackage.definitions).toEqual([]);
    expect(toolPackage.handlers).toEqual([]);
    expect(toolPackage.schemas).toEqual([]);
  });

  it('detects the installed CLI, parses its version, and rejects unsupported versions', async () => {
    const supportedProcess = createFakeProviderProcess([
      providerProcessResult({ stdout: '{"version":"1.4.2"}' }),
    ]);
    const adapter = createFakeDeploymentProviderAdapter();
    const supportedService = createDeploymentProviderService(adapter, {
      process: supportedProcess.process,
    });

    await expect(Effect.runPromise(supportedService.detect())).resolves.toEqual({
      provider: 'fixture',
      executable: 'fixture-cli',
      version: { raw: '1.4.2', major: 1, minor: 4, patch: 2 },
    });
    expect(supportedProcess.requests[0]).toMatchObject({
      command: 'fixture-cli',
      args: ['version', '--json'],
    });

    const unsupportedProcess = createFakeProviderProcess([
      providerProcessResult({ stdout: '{"version":"9.0.0"}' }),
    ]);
    const unsupportedService = createDeploymentProviderService(adapter, {
      process: unsupportedProcess.process,
    });
    const error = await expectProviderError(unsupportedService.detect(), 'UNSUPPORTED_VERSION');
    expect(error.diagnostics).toMatchObject({ command: 'fixture-cli', exitCode: 0 });
  });

  it('maps a missing executable to the typed CLI-missing error', async () => {
    const fake = createFakeProviderProcess([
      providerProcessResult({ runtimeMissing: true, stderr: 'ENOENT' }),
    ]);
    const service = createDeploymentProviderService(createFakeDeploymentProviderAdapter(), {
      process: fake.process,
    });

    const error = await expectProviderError(service.detect(), 'CLI_MISSING');
    expect(error.message).toContain('fixture-cli');
    expect(error.diagnostics).toEqual({
      command: 'fixture-cli',
      exitCode: 1,
      timedOut: false,
      cancelled: false,
      stdout: '',
      stderr: 'ENOENT',
    });
  });

  it('finds provider CLIs from explicit background-service search paths without losing PATH', async () => {
    const root = temporaryDirectory('deployment-provider-path-');
    const executable = join(root, 'fixture-cli');
    writeFileSync(executable, '#!/bin/sh\nprintf \'{"version":"1.7.0"}\\n\'\n', 'utf8');
    chmodSync(executable, 0o755);

    const process = createNodeProviderProcess({ searchPaths: [root] });
    const service = createDeploymentProviderService(createFakeDeploymentProviderAdapter(), {
      process,
      env: { PATH: '/usr/bin:/bin', HOME: root },
    });

    await expect(Effect.runPromise(service.detect())).resolves.toMatchObject({
      executable: 'fixture-cli',
      version: { raw: '1.7.0' },
    });
  });

  it('normalizes authentication through CLI output without returning credential fields', async () => {
    const secret = 'provider-token-should-never-return';
    const fake = createFakeProviderProcess([
      providerProcessResult({
        stdout: JSON.stringify({ authenticated: true, account: 'ko@example.test', token: secret }),
      }),
    ]);
    const service = createDeploymentProviderService(createFakeDeploymentProviderAdapter(), {
      process: fake.process,
    });

    const result = await Effect.runPromise(service.authStatus());
    expect(result).toEqual({ authenticated: true, identity: 'ko@example.test', source: 'cli' });
    expect(JSON.stringify(result)).not.toContain(secret);
    expect(fake.requests[0].args).toEqual(['auth', 'status', '--json']);
  });

  it('fails explicitly when a provider lacks a requested capability', async () => {
    const fake = createFakeProviderProcess([]);
    const adapter = createFakeDeploymentProviderAdapter({
      capabilities: ['detect', 'auth.status'],
    });
    const service = createDeploymentProviderService(adapter, { process: fake.process });

    const error = await expectProviderError(
      service.logsRead({ deploymentId: 'dep_123' }),
      'UNSUPPORTED_CAPABILITY',
    );
    expect(error.operation).toBe('logs.read');
    expect(fake.requests).toHaveLength(0);
  });

  it('preserves raw argv exactly and never evaluates shell metacharacters', async () => {
    const root = temporaryDirectory('deployment-provider-argv-');
    const executable = join(root, 'fixture-cli');
    const pwned = join(root, 'pwned');
    writeFileSync(
      executable,
      '#!/bin/sh\nprintf \'%s\\n\' "$#"\nfor arg in "$@"; do printf \'<%s>\\n\' "$arg"; done\n',
      'utf8',
    );
    chmodSync(executable, 0o755);
    const malicious = '$(touch ./pwned); value with spaces';
    const process = createNodeProviderProcess({ searchPaths: [root] });
    const service = createDeploymentProviderService(
      createFakeDeploymentProviderAdapter({ executable: 'fixture-cli' }),
      { process, env: { PATH: '/usr/bin:/bin', HOME: root } },
    );

    const result = await Effect.runPromise(service.raw({ args: ['raw', '--value', malicious], approval: { approved: true, reason: 'Read-only argv safety test' } }));
    expect(result).toEqual({ stdout: `3\n<raw>\n<--value>\n<${malicious}>`, stderr: '', exitCode: 0 });
    expect(existsSync(pwned)).toBe(false);
  });

  it('returns distinct timeout and cancellation failures', async () => {
    const process = createNodeProviderProcess();
    const adapter = createFakeDeploymentProviderAdapter({
      executable: process.execPath,
      rawPrefixArgs: ['-e', 'setTimeout(() => {}, 5000)', '--'],
    });
    const service = createDeploymentProviderService(adapter, { process });

    await expectProviderError(
      service.raw({ args: ['slow'], timeoutMs: 20, approval: { approved: true, reason: 'Timeout contract test' } }),
      'TIMEOUT',
    );

    const controller = new AbortController();
    const cancellation = service.raw({ args: ['cancel'], timeoutMs: 5_000, signal: controller.signal, approval: { approved: true, reason: 'Cancellation contract test' } });
    setTimeout(() => controller.abort(), 20);
    await expectProviderError(cancellation, 'CANCELLED');
  });

  it('redacts bearer tokens, cookies, credential URLs, and sensitive assignments from failures', async () => {
    const fake = createFakeProviderProcess([
      providerProcessResult({
        exitCode: 1,
        stderr: 'Authorization: Bearer top-secret-token Cookie: session=cookie-secret https://user:pass@example.test/path?token=url-secret api_key=key-secret',
      }),
    ]);
    const service = createDeploymentProviderService(createFakeDeploymentProviderAdapter(), {
      process: fake.process,
    });

    const error = await expectProviderError(service.projectList(), 'COMMAND_FAILED');
    const serialized = JSON.stringify(error);
    for (const forbidden of ['top-secret-token', 'cookie-secret', 'user:pass', 'url-secret', 'key-secret']) {
      expect(serialized).not.toContain(forbidden);
    }
    expect(error.diagnostics).toMatchObject({ command: 'fixture-cli', exitCode: 1 });
    expect(serialized).not.toContain('project list --json');
  });

  it.each([
    ['not logged in; login required', 'UNAUTHENTICATED'],
    ['directory is not linked to a project', 'NO_CONTEXT'],
    ['permission denied by provider', 'PERMISSION_DENIED'],
    ['429 too many requests; rate limit exceeded', 'RATE_LIMITED'],
    ['503 temporarily unavailable', 'UNAVAILABLE'],
  ] as const)('maps provider command failures: %s', async (stderr, code) => {
    const fake = createFakeProviderProcess([
      providerProcessResult({ exitCode: 1, stderr }),
    ]);
    const service = createDeploymentProviderService(createFakeDeploymentProviderAdapter(), {
      process: fake.process,
    });

    await expectProviderError(service.projectList(), code);
  });

  it('sanitizes parser causes and rejects detect when the capability is absent', async () => {
    const secret = 'Bearer parser-secret-token';
    const fake = createFakeProviderProcess([
      providerProcessResult({ stdout: '{}' }),
    ]);
    const adapter = createFakeDeploymentProviderAdapter();
    adapter.operations['project.list'] = {
      capability: 'project.list',
      command: () => ({ args: ['project', 'list', '--json'] }),
      parse: () => { throw new Error(`parse failed with ${secret}`); },
    };
    const service = createDeploymentProviderService(adapter, { process: fake.process });
    const malformed = await expectProviderError(service.projectList(), 'MALFORMED_OUTPUT');
    expect(JSON.stringify(malformed)).not.toContain('parser-secret-token');
    expect(malformed.cause).toEqual({
      name: 'Error',
      message: 'parse failed with Bearer [REDACTED_SECRET]',
    });

    const unsupported = createDeploymentProviderService(
      createFakeDeploymentProviderAdapter({ capabilities: ['auth.status'] }),
      { process: createFakeProviderProcess([]).process },
    );
    await expectProviderError(unsupported.detect(), 'UNSUPPORTED_CAPABILITY');
  });

  it('normalizes environment mutation results without returning provider values', async () => {
    const secret = 'environment-set-secret-value';
    const fake = createFakeProviderProcess([
      providerProcessResult({
        stdout: JSON.stringify({
          name: 'FEATURE_FLAG',
          scopes: ['production'],
          updated: true,
          value: secret,
          token: 'also-secret',
        }),
      }),
    ]);
    const service = createDeploymentProviderService(createFakeDeploymentProviderAdapter(), {
      process: fake.process,
    });

    const result = await Effect.runPromise(service.environmentSet({
      name: 'FEATURE_FLAG',
      value: secret,
      scope: 'production',
      approval: { approved: true, reason: 'Security normalization contract test' },
    }));

    expect(result).toEqual({
      name: 'FEATURE_FLAG',
      scopes: ['production'],
      updated: true,
    });
    expect(JSON.stringify(result)).not.toContain(secret);
    expect(JSON.stringify(result)).not.toContain('also-secret');
  });

  it('maps thrown version parsers to sanitized malformed-output errors', async () => {
    const fake = createFakeProviderProcess([
      providerProcessResult({ stdout: '{"version":"unexpected"}' }),
    ]);
    const adapter = createFakeDeploymentProviderAdapter();
    adapter.version.parse = () => {
      throw new Error('version parser exposed Bearer version-secret-token');
    };
    const service = createDeploymentProviderService(adapter, { process: fake.process });

    const error = await expectProviderError(service.detect(), 'MALFORMED_OUTPUT');
    expect(error.message).toContain('version output');
    expect(error.cause).toEqual({
      name: 'Error',
      message: 'version parser exposed Bearer [REDACTED_SECRET]',
    });
    expect(JSON.stringify(error)).not.toContain('version-secret-token');
  });

  it('returns environment variable names, scopes, and presence without values', async () => {
    const secret = 'postgres://user:password@example.test/db';
    const fake = createFakeProviderProcess([
      providerProcessResult({
        stdout: JSON.stringify([
          { name: 'DATABASE_URL', scopes: ['production'], present: true, value: secret },
          { name: 'OPTIONAL_KEY', scope: 'preview', value: null },
        ]),
      }),
    ]);
    const service = createDeploymentProviderService(createFakeDeploymentProviderAdapter(), {
      process: fake.process,
    });

    const result = await Effect.runPromise(service.environmentListNames());
    expect(result).toEqual([
      { name: 'DATABASE_URL', scopes: ['production'], present: true },
      { name: 'OPTIONAL_KEY', scopes: ['preview'], present: false },
    ]);
    expect(JSON.stringify(result)).not.toContain(secret);
  });

  it('exposes consequence metadata and blocks mutations before process execution without approval', async () => {
    const fake = createFakeProviderProcess([
      providerProcessResult({ stdout: '{"deploymentId":"dep_new"}' }),
    ]);
    const service = createDeploymentProviderService(createFakeDeploymentProviderAdapter(), {
      process: fake.process,
    });

    expect(service.policy('deploy')).toEqual({
      operation: 'deploy',
      capability: 'deploy',
      readOnly: false,
      mutating: true,
      approval: {
        required: true,
        consequence: 'Creates a new deployment and may change customer-facing runtime behavior.',
      },
    });

    const error = await expectProviderError(
      service.deploy({ target: 'production' }),
      'APPROVAL_REQUIRED',
    );
    expect(error.approval).toEqual({
      required: true,
      consequence: 'Creates a new deployment and may change customer-facing runtime behavior.',
    });
    expect(fake.requests).toHaveLength(0);

    await expect(Effect.runPromise(service.deploy({
      target: 'production',
      approval: { approved: true, reason: 'Release approved by operator' },
    }))).resolves.toEqual({ deploymentId: 'dep_new' });
    expect(fake.requests).toHaveLength(1);
  });
});
