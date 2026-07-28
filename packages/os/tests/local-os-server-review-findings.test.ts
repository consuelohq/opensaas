import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import type { GatewaySecurityConfig } from '../scripts/lib/security-gateway';
import { loadLocalOsServerConfig } from '../scripts/server/env';
import {
  internalError,
  invalidRequest,
} from '../scripts/server/middleware/errors';
import { authorizeConsueloOAuthMcpRequest } from '../scripts/server/services/oauth-introspection';

const ORIGINAL_CONSUELO_OS_PORT = process.env.CONSUELO_OS_PORT;
const ORIGINAL_PORT = process.env.PORT;

function restoreEnv(name: 'CONSUELO_OS_PORT' | 'PORT', value: string | undefined): void {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}

async function responseJson(response: Response): Promise<Record<string, unknown>> {
  return await response.json() as Record<string, unknown>;
}

afterEach(() => {
  restoreEnv('CONSUELO_OS_PORT', ORIGINAL_CONSUELO_OS_PORT);
  restoreEnv('PORT', ORIGINAL_PORT);
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.resetModules();
  vi.doUnmock('../scripts/server/middleware/auth');
  vi.doUnmock('../scripts/server/services/call-service');
});

describe('local OS server review findings', () => {
  it('installs package-local OS dependencies before CI contract tests', () => {
    const workflow = readFileSync(
      resolve(import.meta.dirname, '../../../.github/workflows/consuelo-ci.yaml'),
      'utf8',
    );
    const installStep = [
      '      - name: Install OS dependencies',
      "        if: needs.consuelo-changes.outputs.os_contracts == 'true'",
      '        working-directory: packages/os',
      '        run: bun install --frozen-lockfile',
    ].join('\n');

    expect(workflow).toContain(installStep);
    expect(workflow.indexOf(installStep)).toBeLessThan(
      workflow.indexOf('      - name: Run OS contract tests'),
    );
  });

  it('preserves the default port when both port variables are unset', () => {
    delete process.env.CONSUELO_OS_PORT;
    delete process.env.PORT;

    expect(loadLocalOsServerConfig().port).toBe(46321);
  });

  it.each(['', '   ', 'not-a-port', '1.5', '0', '-1', '65536'])(
    'rejects invalid configured port %j',
    (port) => {
      process.env.CONSUELO_OS_PORT = port;
      delete process.env.PORT;

      expect(() => loadLocalOsServerConfig()).toThrow(/valid integer between 1 and 65535/i);
    },
  );

  it('returns generic internal errors and writes redacted structured diagnostics', async () => {
    const writes: string[] = [];
    vi.spyOn(process.stderr, 'write').mockImplementation((chunk) => {
      writes.push(String(chunk));
      return true;
    });

    const response = internalError(
      new Error('Bearer secret-access-token-123456 caused a database failure'),
    );
    const body = await responseJson(response);
    const log = writes.join('');

    expect(response.status).toBe(500);
    expect(body).toEqual({
      ok: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'OS request failed.',
      },
    });
    expect(log).toContain('local_os.internal_error');
    expect(log).toContain('[REDACTED_SECRET]');
    expect(log).not.toContain('secret-access-token-123456');
    expect(() => JSON.parse(log.trim())).not.toThrow();
  });

  it('returns generic invalid-request errors and safely logs circular unknown values', async () => {
    const writes: string[] = [];
    vi.spyOn(process.stderr, 'write').mockImplementation((chunk) => {
      writes.push(String(chunk));
      return true;
    });
    const circular: Record<string, unknown> = {};
    circular.self = circular;

    const response = invalidRequest(circular);
    const body = await responseJson(response);
    const log = writes.join('');

    expect(response.status).toBe(400);
    expect(body).toEqual({
      ok: false,
      error: {
        code: 'INVALID_REQUEST',
        message: 'Invalid request.',
      },
    });
    expect(log).toContain('local_os.invalid_request');
    expect(log).toContain('[REDACTED_CIRCULAR]');
    expect(() => JSON.parse(log.trim())).not.toThrow();
  });

  it('bounds OAuth introspection with a five-second abort signal', async () => {
    const timeoutSignal = new AbortController().signal;
    const timeoutSpy = vi
      .spyOn(AbortSignal, 'timeout')
      .mockReturnValue(timeoutSignal);
    let observedSignal: AbortSignal | null | undefined;
    vi.stubGlobal('fetch', async (_input: RequestInfo | URL, init?: RequestInit) => {
      observedSignal = init?.signal;
      return new Response(JSON.stringify({
        active: true,
        workspace_host: 'review-test.consuelohq.com',
        scopes: ['route:/mcp:read'],
      }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    });

    const response = await authorizeConsueloOAuthMcpRequest({
      config: {
        workspaceHost: 'review-test.consuelohq.com',
      } as GatewaySecurityConfig,
      bearerToken: 'test-oauth-token',
      requiredScope: 'route:/mcp:read',
    });

    expect(response).toBeNull();
    expect(timeoutSpy).toHaveBeenCalledWith(5_000);
    expect(observedSignal).toBe(timeoutSignal);
  });

  it('should authorize an ordinary write tool when the active token grants mcp:call', async () => {
    vi.stubGlobal('fetch', async () => new Response(JSON.stringify({
      active: true,
      workspace_host: 'review-test.consuelohq.com',
      scopes: ['mcp:read', 'mcp:call', 'tool:*:read'],
    }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }));

    const response = await authorizeConsueloOAuthMcpRequest({
      config: {
        workspaceHost: 'review-test.consuelohq.com',
      } as GatewaySecurityConfig,
      bearerToken: 'test-oauth-token',
      requiredScope: 'tool:mac.process:write',
    });

    expect(response).toBeNull();
  });

  it.each([
    {
      condition: 'the token has only route read access for a dangerous tool',
      scopes: ['mcp:read'],
      requiredScope: 'tool:task.push:dangerous',
    },
    {
      condition: 'the token has only read grants for an ordinary write tool',
      scopes: ['mcp:read', 'tool:*:read'],
      requiredScope: 'tool:mac.process:write',
    },
  ])(
    'should return MISSING_SCOPE when $condition',
    async ({ scopes, requiredScope }) => {
      vi.stubGlobal('fetch', async () => new Response(JSON.stringify({
        active: true,
        workspace_host: 'review-test.consuelohq.com',
        scopes,
      }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }));

      const response = await authorizeConsueloOAuthMcpRequest({
        config: {
          workspaceHost: 'review-test.consuelohq.com',
        } as GatewaySecurityConfig,
        bearerToken: 'test-oauth-token',
        requiredScope,
      });

      expect(response?.status).toBe(403);
      await expect(responseJson(response as Response)).resolves.toMatchObject({
        error: { code: 'MISSING_SCOPE' },
      });
    },
  );

  it('should return UNKNOWN_TOKEN when OAuth introspection reports an inactive token', async () => {
    vi.stubGlobal('fetch', async () => new Response(JSON.stringify({
      active: false,
    }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }));

    const response = await authorizeConsueloOAuthMcpRequest({
      config: {
        workspaceHost: 'review-test.consuelohq.com',
      } as GatewaySecurityConfig,
      bearerToken: 'test-oauth-token',
      requiredScope: 'tool:mac.process:write',
    });

    expect(response?.status).toBe(401);
    await expect(responseJson(response as Response)).resolves.toMatchObject({
      error: { code: 'UNKNOWN_TOKEN' },
    });
  });

  it('clears a rejected OS runtime import so a later call can retry', async () => {
    const runtimeModule = await import('../scripts/server/services/os-runtime');
    const createLoader = (
      runtimeModule as typeof runtimeModule & {
        createOsRuntimeLoader?: (
          importer: () => Promise<typeof import('../scripts/os')>,
        ) => () => Promise<typeof import('../scripts/os')>;
      }
    ).createOsRuntimeLoader;

    expect(createLoader).toBeTypeOf('function');
    if (!createLoader) return;

    const runtime = {} as typeof import('../scripts/os');
    let attempts = 0;
    const loadRuntime = createLoader(async () => {
      attempts += 1;
      if (attempts === 1) throw new Error('temporary import failure');
      return runtime;
    });

    await expect(loadRuntime()).rejects.toThrow('temporary import failure');
    await expect(loadRuntime()).resolves.toBe(runtime);
    await expect(loadRuntime()).resolves.toBe(runtime);
    expect(attempts).toBe(2);
  });

  it('logs MCP execution exceptions while preserving OS_EXECUTION_FAILED', async () => {
    const writes: string[] = [];
    vi.spyOn(process.stderr, 'write').mockImplementation((chunk) => {
      writes.push(String(chunk));
      return true;
    });
    const { logLocalOsServerError } = await import('../scripts/server/logger');

    logLocalOsServerError(
      'local_os.mcp_tool_execution_failed',
      new Error('Bearer mcp-secret-token-123456 failed during execution'),
      { code: 'OS_EXECUTION_FAILED', route: '/mcp', toolName: 'status' },
    );

    const log = writes.join('');
    expect(log).toContain('local_os.mcp_tool_execution_failed');
    expect(log).toContain('OS_EXECUTION_FAILED');
    expect(log).toContain('[REDACTED_SECRET]');
    expect(log).not.toContain('mcp-secret-token-123456');
  });
});
