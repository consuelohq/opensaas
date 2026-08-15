import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { createGatewaySecurityConfig } from '../scripts/lib/security-gateway';

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

type BunServerResponse = {
  status: number;
  headers: Record<string, string>;
  body: string;
};

function requestThroughBun(input: {
  home: string;
  authConfig: string;
  method: string;
  path: string;
}): BunServerResponse {
  const output = execFileSync('bun', ['-e', `
    process.env.CONSUELO_HOME = ${JSON.stringify(input.home)};
    process.env.CONSUELO_OS_HOME = ${JSON.stringify(input.home)};
    process.env.CONSUELO_OS_AUTH_CONFIG = ${JSON.stringify(input.authConfig)};
    const { handleRequest } = await import('./scripts/server/app.ts');
    const response = await handleRequest(new Request(
      ${JSON.stringify(`http://127.0.0.1:46321${input.path}`)},
      { method: ${JSON.stringify(input.method)} },
    ));
    process.stdout.write(JSON.stringify({
      status: response.status,
      headers: Object.fromEntries(response.headers.entries()),
      body: await response.text(),
    }));
  `], {
    cwd: osRoot,
    encoding: 'utf8',
  });
  return JSON.parse(output) as BunServerResponse;
}

afterEach(() => {
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

    for (const route of ['health', 'artifacts', 'mcp', 'settings', 'steering', 'call', 'traces']) {
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
    expect(appSource).toContain("app.route('/', createArtifactRoutes");
    expect(appSource).toContain("app.route('/', createMcpRoutes");

    const mainSource = source('scripts/server/main.ts');
    expect(mainSource).toContain('Bun.serve({');
    expect(mainSource).toContain("hostname: '127.0.0.1'");
    expect(mainSource).toContain('fetch: app.fetch');
  });

  it('should point managed process entrypoints at the supervisor and keep worker smoke direct', () => {
    const packageJson = JSON.parse(source('package.json')) as {
      scripts: Record<string, string>;
    };
    expect(packageJson.scripts['server:run']).toBe('bun ./scripts/server/supervisor.ts');
    expect(packageJson.scripts['smoke:server']).toBe('bun ./scripts/server/main.ts');

    const daemon = source('scripts/start-consuelo-daemon.sh');
    expect(daemon).toContain(
      'exec "$bun_bin" "$root_dir/scripts/server/supervisor.ts"',
    );
    expect(daemon).not.toContain('scripts/server.ts');
    expect(existsSync(resolve(osRoot, 'scripts/start-brain-daemon.sh'))).toBe(false);
    expect(existsSync(resolve(osRoot, 'scripts/start-brain.sh'))).toBe(false);

    expect(source('scripts/server.js')).toContain(
      "path.join(WORKSPACE_DIR, 'scripts', 'lifecycle.ts')",
    );
    expect(source('scripts/server.js')).toContain(
      "path.join(WORKSPACE_DIR, 'scripts', 'consuelo-reload.js')",
    );
    expect(source('scripts/consuelo-reload.js')).toContain(
      'packages/os/scripts/server/supervisor.ts|scripts/server/supervisor.ts|packages/os/scripts/server/main.ts|scripts/server/main.ts',
    );
    expect(source('Dockerfile')).toContain(
      'CMD ["bun", "./scripts/server/supervisor.ts"]',
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
      { method: 'GET', path: '/ready', trust: 'public' },
      { method: 'GET', path: '/artifacts', trust: 'public' },
      { method: 'GET', path: '/artifacts/*', trust: 'public' },
      { method: 'GET', path: '/gateway/artifacts', trust: 'signed' },
      { method: 'GET', path: '/gateway/artifacts/:artifactId', trust: 'signed' },
      { method: 'GET', path: '/gateway/artifacts/:artifactId/versions', trust: 'signed' },
      { method: 'GET', path: '/traces', trust: 'signed' },
      { method: 'GET', path: '/traces/assets/trace.css', trust: 'signed' },
      { method: 'GET', path: '/traces/assets/trace.js', trust: 'signed' },
      { method: 'GET', path: '/gateway/traces/recent', trust: 'signed' },
      { method: 'GET', path: '/gateway/traces/summary', trust: 'signed' },
      { method: 'GET', path: '/gateway/traces/aggregates', trust: 'signed' },
      { method: 'GET', path: '/gateway/traces/events', trust: 'signed' },
      { method: 'GET', path: '/gateway/configuration/snapshot', trust: 'signed' },
      { method: 'POST', path: '/gateway/configuration/overlay', trust: 'signed' },
      { method: 'GET', path: '/gateway/settings/snapshot', trust: 'signed' },
      { method: 'POST', path: '/gateway/settings/overlay', trust: 'signed' },
      { method: 'GET', path: '/gateway/environments/snapshot', trust: 'signed' },
      { method: 'POST', path: '/gateway/environments/upsert', trust: 'signed' },
      { method: 'POST', path: '/gateway/environments/delete', trust: 'signed' },
      { method: 'GET', path: '/gateway/secrets/bindings', trust: 'signed' },
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
    { name: 'worker readiness', method: 'GET', path: '/ready', status: 200 },
    { name: 'trace read route', method: 'GET', path: '/gateway/traces/recent', status: 401, code: 'AUTH_CONFIG_REQUIRED' },
    { name: 'trace HEAD fallback', method: 'HEAD', path: '/gateway/traces/recent', status: 404, code: 'NOT_FOUND' },
    { name: 'trace write fallback', method: 'POST', path: '/gateway/traces/recent', status: 404, code: 'NOT_FOUND' },
    { name: 'unknown route with explicit auth path', method: 'GET', path: '/unknown', status: 404, code: 'NOT_FOUND' },
    { name: 'call method fallback', method: 'GET', path: '/call', status: 404, code: 'NOT_FOUND' },
    { name: 'steering method fallback', method: 'PUT', path: '/get_steering', status: 404, code: 'NOT_FOUND' },
    { name: 'steering HEAD fallback', method: 'HEAD', path: '/get_steering', status: 404, code: 'NOT_FOUND' },
  ])('should preserve $name behavior', async (testCase) => {
    const home = temporaryHome();
    const response = requestThroughBun({
      home,
      authConfig: join(home, 'missing-auth.json'),
      method: testCase.method,
      path: testCase.path,
    });

    expect(response.status).toBe(testCase.status);
    expect(response.headers['content-type']).toBe(
      'application/json; charset=utf-8',
    );
    if (testCase.code && testCase.method !== 'HEAD') {
      expect(JSON.parse(response.body)).toMatchObject({
        error: { code: testCase.code },
      });
    }
  });

  it('should preserve the MCP OAuth discovery challenge before method rejection', async () => {
    const home = temporaryHome();
    const response = requestThroughBun({
      home,
      authConfig: join(home, 'missing-auth.json'),
      method: 'GET',
      path: '/mcp',
    });

    expect(response.status).toBe(401);
    expect(response.headers['www-authenticate']).toBe(
      'Bearer realm="Consuelo OS MCP", resource_metadata="https://os.consuelohq.com/.well-known/oauth-protected-resource"',
    );
    expect(JSON.parse(response.body)).toMatchObject({
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
    const response = requestThroughBun({
      home,
      authConfig: config.generatedAuthPath,
      method: 'GET',
      path: '/unknown',
    });

    expect(response.status).toBe(404);
    expect(JSON.parse(response.body)).toEqual({
      error: { code: 'NOT_FOUND', message: 'Route not found' },
    });
  });
});
