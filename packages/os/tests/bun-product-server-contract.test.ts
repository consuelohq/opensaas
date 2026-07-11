import { existsSync, readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const osRoot = resolve(import.meta.dirname, '..');
const require = createRequire(import.meta.url);

function source(path: string): string {
  return readFileSync(resolve(osRoot, path), 'utf8');
}

describe('Bun product server contract', () => {
  it('should use Bun and TypeScript for every supported OS server entrypoint', () => {
    const packageJson = JSON.parse(source('package.json')) as {
      scripts: Record<string, string>;
    };

    expect(packageJson.scripts['server:run']).toBe('bun ./scripts/server.ts');
    expect(packageJson.scripts['smoke:server']).toBe('bun ./scripts/server.ts');

    const daemon = source('scripts/start-consuelo-daemon.sh');
    expect(daemon).toContain('exec "$bun_bin" "$root_dir/scripts/server.ts"');
    expect(daemon).not.toMatch(/\bpython(?:3)?\b|server\.py/);

    const setup = source('setup.sh');
    expect(setup).toContain('bun "$root_dir/scripts/install.ts"');
    expect(setup).not.toMatch(/\bpython(?:3)?\b|server\.py/);

    const manager = source('scripts/server.js');
    expect(manager).toContain(
      "const SERVER_TS = path.join(WORKSPACE_DIR, 'scripts', 'server.ts');",
    );
    expect(manager).toContain("spawn('bun', [SERVER_TS]");
    expect(manager).not.toContain('server.py');

    const server = source('scripts/server.ts');
    expect(server).toContain('Bun.serve({');
    expect(server).toContain("hostname: '127.0.0.1'");

    const workspaceState = source('scripts/lib/workspace-state.js');
    expect(workspaceState).toContain(
      "process.env.CONSUELO_OS_PORT || process.env.PORT || '8960'",
    );
    expect(workspaceState).toContain(
      '`http://127.0.0.1:${port}/health`',
    );
    expect(workspaceState).not.toContain('localhost:8850');
  });

  it('should probe the configured Bun server port on loopback', async () => {
    const server = createServer((_request, response) => {
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ runtime: 'bun', status: 'ok' }));
    });
    await new Promise<void>((resolveListen) => {
      server.listen(0, '127.0.0.1', resolveListen);
    });

    const address = server.address();
    if (!address || typeof address === 'string') {
      server.close();
      throw new Error('test server did not expose a TCP port');
    }

    const previousPort = process.env.CONSUELO_OS_PORT;
    process.env.CONSUELO_OS_PORT = String(address.port);

    try {
      const { getWorkspaceServerHealth } = require(
        '../scripts/lib/workspace-state.js',
      ) as {
        getWorkspaceServerHealth(timeout?: number): Promise<{
          ok: boolean;
          statusCode: number | null;
          body?: { runtime?: string; status?: string };
        }>;
      };

      await expect(getWorkspaceServerHealth(1000)).resolves.toMatchObject({
        ok: true,
        statusCode: 200,
        body: { runtime: 'bun', status: 'ok' },
      });
    } finally {
      if (previousPort === undefined) delete process.env.CONSUELO_OS_PORT;
      else process.env.CONSUELO_OS_PORT = previousPort;
      await new Promise<void>((resolveClose) => server.close(() => resolveClose()));
    }
  });

  it('should remove obsolete Python product-server surfaces without banning optional Python utilities', () => {
    for (const path of [
      'server.py',
      'requirements.txt',
      'tests/os_server_steering_test.py',
      'tests/server_call_test.py',
    ]) {
      expect(existsSync(resolve(osRoot, path)), path).toBe(false);
    }

    expect(existsSync(resolve(osRoot, 'scripts/media-svg.py'))).toBe(true);
    expect(existsSync(resolve(osRoot, 'tools/brain.py'))).toBe(true);
  });

  it('should document the Bun-only product server and current local port', () => {
    const readme = source('README.md');
    const runtimeDocs = source('docs/runtime-surfaces.md');
    const contributing = source('CONTRIBUTING.md');
    const dockerfile = source('Dockerfile');

    for (const activeDoc of [readme, runtimeDocs, contributing]) {
      expect(activeDoc).not.toMatch(
        /legacy Python server|temporary compatibility|local virtualenv/i,
      );
    }

    expect(readme).toContain('The server listens on `127.0.0.1:8960` by default.');
    expect(runtimeDocs).toContain('The default local port is `8960`.');
    expect(contributing).toContain('bun run typecheck');

    expect(dockerfile).toContain('FROM oven/bun:');
    expect(dockerfile).toContain('EXPOSE 8960');
    expect(dockerfile).toContain('CMD ["bun", "./scripts/server.ts"]');
    expect(dockerfile).not.toContain('server.py');
  });
});
