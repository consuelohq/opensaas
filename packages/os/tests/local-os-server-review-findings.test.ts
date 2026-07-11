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
  it('preserves the default port when both port variables are unset', () => {
    delete process.env.CONSUELO_OS_PORT;
    delete process.env.PORT;

    expect(loadLocalOsServerConfig().port).toBe(8960);
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
    vi.doMock('../scripts/server/middleware/auth', () => ({
      authPreflight: () => null,
      authorizeBearerMcpRequest: async () => null,
      authorizeSignedRequest: async () => null,
      hasGeneratedAuthConfig: () => true,
      hasSignedGatewayHeaders: () => false,
      loadAuthConfigForRequest: () => ({
        workspaceId: 'workspace_review_test',
        workspaceHost: 'review-test.consuelohq.com',
      }),
      requestHeaders: () => ({}),
    }));
    vi.doMock('../scripts/server/services/call-service', () => ({
      executeLocalOsCall: async () => {
        throw new Error('Bearer mcp-secret-token-123456 failed during execution');
      },
      parseCallInput: () => ({ name: 'get_raw_steering' }),
    }));

    const { createLocalOsApp } = await import(
      '../scripts/server/app.ts?review-mcp-execution-log'
    );
    const response = await createLocalOsApp().fetch(new Request(
      'http://127.0.0.1:8960/mcp',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 'review-failure',
          method: 'tools/call',
          params: { name: 'get_raw_steering', arguments: {} },
        }),
      },
    ));
    const body = await responseJson(response);
    const serialized = JSON.stringify(body);
    const log = writes.join('');

    expect(response.status).toBe(200);
    expect(serialized).toContain('OS_EXECUTION_FAILED');
    expect(serialized).not.toContain('mcp-secret-token-123456');
    expect(log).toContain('local_os.mcp_tool_execution_failed');
    expect(log).toContain('[REDACTED_SECRET]');
    expect(log).not.toContain('mcp-secret-token-123456');
  });
});
