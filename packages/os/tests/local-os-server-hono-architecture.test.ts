import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { createGatewaySecurityConfig } from '../scripts/lib/security-gateway';
import { handleRequest } from '../scripts/server/app';

const osRoot = resolve(import.meta.dirname, '..');
const serverRoot = resolve(osRoot, 'scripts/server');
const temporaryHomes: string[] = [];

function source(path: string): string {
  return readFileSync(resolve(osRoot, path), 'utf8');
}

function temporaryHome(): string {
  const home = mkdtempSync(join(tmpdir(), 'consuelo-local-server-hono-'));
  temporaryHomes.push(home);
  return home;
}

async function jsonBody(response: Response): Promise<Record<string, unknown>> {
  return await response.json() as Record<string, unknown>;
}

afterEach(() => {
  delete process.env.CONSUELO_HOME;
  delete process.env.CONSUELO_OS_HOME;
  delete process.env.CONSUELO_OS_AUTH_CONFIG;
  for (const home of temporaryHomes.splice(0)) {
    rmSync(home, { recursive: true, force: true });
  }
});

describe('local OS Hono server architecture', () => {
  it('should use a dedicated Bun entrypoint and remove the flat server module', () => {
    expect(existsSync(resolve(serverRoot, 'main.ts'))).toBe(true);
    expect(existsSync(resolve(serverRoot, 'app.ts'))).toBe(true);
    expect(existsSync(resolve(serverRoot, 'env.ts'))).toBe(true);
    expect(existsSync(resolve(osRoot, 'scripts/server.ts'))).toBe(false);

    for (const route of ['health', 'mcp', 'settings', 'steering', 'call', 'traces']) {
      expect(existsSync(resolve(serverRoot, 'routes', `${route}.ts`)), route).toBe(true);
    }

    for (const middleware of ['auth', 'dangerous-material', 'errors']) {
      expect(
        existsSync(resolve(serverRoot, 'middleware', `${middleware}.ts`)),
        middleware,
      ).toBe(true);
    }

    const appSource = source('scripts/server/app.ts');
    expect(appSource).toContain("from 'hono'");
    expect(appSource).toContain('createLocalOsApp');
    expect(appSource).toContain("app.route('/', createHealthRoutes");
    expect(appSource).toContain("app.route('/', createMcpRoutes");

    const mainSource = source('scripts/server/main.ts');
    expect(mainSource).toContain('Bun.serve({');
    expect(mainSource).toContain("hostname: '127.0.0.1'");
    expect(mainSource).toContain('fetch: app.fetch');
  });

  it('should point every supported process entrypoint at server/main.ts', () => {
    const packageJson = JSON.parse(source('package.json')) as {
      scripts: Record<string, string>;
    };
    expect(packageJson.scripts['server:run']).toBe('bun ./scripts/server/main.ts');
    expect(packageJson.scripts['smoke:server']).toBe('bun ./scripts/server/main.ts');

    const daemon = source('scripts/start-consuelo-daemon.sh');
    expect(daemon).toContain(
      'exec "$bun_bin" "$root_dir/scripts/server/main.ts"',
    );
    expect(daemon).not.toContain('scripts/server.ts');
    expect(existsSync(resolve(osRoot, 'scripts/start-brain-daemon.sh'))).toBe(false);
    expect(existsSync(resolve(osRoot, 'scripts/start-brain.sh'))).toBe(false);

    expect(source('scripts/server.js')).toContain(
      "path.join(WORKSPACE_DIR, 'scripts', 'server', 'main.ts')",
    );
    expect(source('scripts/consuelo-reload.js')).toContain(
      'packages/os/scripts/server/main.ts|scripts/server/main.ts',
    );
    expect(source('Dockerfile')).toContain(
      'CMD ["bun", "./scripts/server/main.ts"]',
    );
  });

  it('should keep method, path, and trust policy explicit', async () => {
    const policyPath = resolve(serverRoot, 'route-policies.ts');
    expect(existsSync(policyPath)).toBe(true);
    if (!existsSync(policyPath)) return;

    const { LOCAL_OS_ROUTE_POLICIES } = await import(
      '../scripts/server/route-policies'
    );
    expect(LOCAL_OS_ROUTE_POLICIES).toEqual([
      { method: 'ANY', path: '/health', trust: 'public' },
      { method: 'GET', path: '/gateway/traces/recent', trust: 'signed' },
      { method: 'GET', path: '/gateway/traces/summary', trust: 'signed' },
      { method: 'GET', path: '/gateway/traces/aggregates', trust: 'signed' },
      { method: 'GET', path: '/gateway/traces/events', trust: 'signed' },
      { method: 'GET', path: '/gateway/settings/snapshot', trust: 'signed' },
      { method: 'POST', path: '/gateway/settings/overlay', trust: 'signed' },
      { method: 'ANY', path: '/mcp', trust: 'signed-or-oauth' },
      { method: 'GET', path: '/get_steering', trust: 'signed' },
      { method: 'POST', path: '/get_steering', trust: 'signed' },
      { method: 'POST', path: '/call', trust: 'signed' },
      { method: 'ANY', path: '*', trust: 'signed-fallback' },
    ]);
  });

  it.each([
    { name: 'health GET', method: 'GET', path: '/health', status: 200 },
    { name: 'health POST', method: 'POST', path: '/health', status: 200 },
    { name: 'trace read route', method: 'GET', path: '/gateway/traces/recent', status: 401, code: 'AUTH_CONFIG_REQUIRED' },
    { name: 'trace HEAD fallback', method: 'HEAD', path: '/gateway/traces/recent', status: 404, code: 'NOT_FOUND' },
    { name: 'trace write fallback', method: 'POST', path: '/gateway/traces/recent', status: 404, code: 'NOT_FOUND' },
    { name: 'unknown route with explicit auth path', method: 'GET', path: '/unknown', status: 404, code: 'NOT_FOUND' },
    { name: 'call method fallback', method: 'GET', path: '/call', status: 404, code: 'NOT_FOUND' },
    { name: 'steering method fallback', method: 'PUT', path: '/get_steering', status: 404, code: 'NOT_FOUND' },
    { name: 'steering HEAD fallback', method: 'HEAD', path: '/get_steering', status: 404, code: 'NOT_FOUND' },
  ])('should preserve $name behavior', async (testCase) => {
    const home = temporaryHome();
    process.env.CONSUELO_HOME = home;
    process.env.CONSUELO_OS_HOME = home;
    process.env.CONSUELO_OS_AUTH_CONFIG = join(home, 'missing-auth.json');

    const response = await handleRequest(new Request(
      `http://127.0.0.1:46321${testCase.path}`,
      { method: testCase.method },
    ));

    expect(response.status).toBe(testCase.status);
    expect(response.headers.get('content-type')).toBe(
      'application/json; charset=utf-8',
    );
    if (testCase.code && testCase.method !== 'HEAD') {
      await expect(jsonBody(response)).resolves.toMatchObject({
        error: { code: testCase.code },
      });
    }
  });

  it('should preserve the MCP OAuth discovery challenge before method rejection', async () => {
    const home = temporaryHome();
    process.env.CONSUELO_HOME = home;
    process.env.CONSUELO_OS_HOME = home;
    process.env.CONSUELO_OS_AUTH_CONFIG = join(home, 'missing-auth.json');

    const response = await handleRequest(
      new Request('http://127.0.0.1:46321/mcp', { method: 'GET' }),
    );

    expect(response.status).toBe(401);
    expect(response.headers.get('www-authenticate')).toBe(
      'Bearer realm="Consuelo OS MCP", resource_metadata="https://os.consuelohq.com/.well-known/oauth-protected-resource"',
    );
    await expect(jsonBody(response)).resolves.toMatchObject({
      error: { code: 'MISSING_BEARER' },
    });
  });

  it('should return not found only after generated auth exists', async () => {
    const home = temporaryHome();
    const config = createGatewaySecurityConfig({
      home,
      workspaceId: 'workspace_hono_architecture',
      workspaceSlug: 'hono-architecture',
      workspaceHost: 'hono-architecture.consuelohq.com',
    });
    process.env.CONSUELO_HOME = home;
    process.env.CONSUELO_OS_HOME = home;
    process.env.CONSUELO_OS_AUTH_CONFIG = config.generatedAuthPath;

    const response = await handleRequest(
      new Request('http://127.0.0.1:46321/unknown'),
    );

    expect(response.status).toBe(404);
    await expect(jsonBody(response)).resolves.toEqual({
      error: { code: 'NOT_FOUND', message: 'Route not found' },
    });
  });
});
