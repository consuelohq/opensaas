import {
  mkdtempSync,
  readFileSync,
  rmSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { provisionLocalOs } from '../scripts/lib/install-state';
import { loadLocalOsServerConfig } from '../scripts/server/env';

const osRoot = resolve(import.meta.dirname, '..');
const repoRoot = resolve(osRoot, '..', '..');
const originalConsueloPort = process.env.CONSUELO_OS_PORT;
const originalPort = process.env.PORT;
const temporaryHomes: string[] = [];

function source(relativePath: string): string {
  return readFileSync(resolve(osRoot, relativePath), 'utf8');
}

function restoreEnv(
  name: 'CONSUELO_OS_PORT' | 'PORT',
  value: string | undefined,
): void {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}

afterEach(() => {
  restoreEnv('CONSUELO_OS_PORT', originalConsueloPort);
  restoreEnv('PORT', originalPort);
  for (const home of temporaryHomes.splice(0)) {
    rmSync(home, { recursive: true, force: true });
  }
});

describe('prelaunch local OS port cutover', () => {
  it('should use 46321 by default while preserving port override precedence', () => {
    delete process.env.CONSUELO_OS_PORT;
    delete process.env.PORT;
    expect(loadLocalOsServerConfig().port).toBe(46_321);

    process.env.PORT = '47002';
    expect(loadLocalOsServerConfig().port).toBe(47_002);

    process.env.CONSUELO_OS_PORT = '47001';
    expect(loadLocalOsServerConfig().port).toBe(47_001);
  });

  it('should generate install state and gateway configuration for 46321 by default', () => {
    const home = mkdtempSync(join(tmpdir(), 'consuelo-port-cutover-'));
    temporaryHomes.push(home);

    provisionLocalOs({ home, mode: 'local' });

    const config = JSON.parse(
      readFileSync(join(home, 'config.json'), 'utf8'),
    ) as { port: number };
    const caddy = readFileSync(
      join(home, 'node', 'caddy', 'Caddyfile'),
      'utf8',
    );
    const chatgptMcp = JSON.parse(
      readFileSync(
        join(home, 'node', 'security', 'generated', 'chatgpt-mcp.json'),
        'utf8',
      ),
    ) as { localUrl: string };

    expect(config.port).toBe(46_321);
    expect(caddy).toContain('reverse_proxy 127.0.0.1:46321');
    expect(caddy).not.toContain('127.0.0.1:8960');
    expect(chatgptMcp.localUrl).toBe('http://127.0.0.1:46321/mcp');
  });

  it('should declare 46321 across every active default-port surface', () => {
    const contracts: Array<[path: string, expected: string]> = [
      ['Dockerfile', 'EXPOSE 46321'],
      ['.env.example', 'CONSUELO_OS_PORT=46321'],
      ['scripts/server.js', "process.env.PORT || '46321'"],
      [
        'scripts/consuelo-reload.js',
        "process.env.WORKSPACE_DAEMON_PORT || '46321'",
      ],
      ['scripts/start-consuelo-daemon.sh', 'PORT:-46321'],
      ['scripts/start-brain-daemon.sh', 'PORT:-46321'],
      ['scripts/start-brain.sh', 'PORT:-46321'],
      ['scripts/workspace-watchdog.sh', 'PORT:-46321'],
      ['scripts/install-system-daemons.sh', 'http://127.0.0.1:46321/health'],
      ['scripts/bootstrap.sh', 'http://127.0.0.1:46321'],
      ['scripts/lib/workspace-state.js', "process.env.PORT || '46321'"],
      [
        'scripts/lib/trace-sites-live-smoke.ts',
        'http://127.0.0.1:46321/gateway/traces/recent',
      ],
      [
        'cloudflare/os-device-authority/src/constants.ts',
        'http://127.0.0.1:46321',
      ],
      [
        'cloudflare/os-device-authority/wrangler.toml',
        'http://127.0.0.1:46321',
      ],
      ['README.md', '127.0.0.1:46321'],
      ['SCRIPTS.md', '127.0.0.1:46321'],
      ['docs/runtime-surfaces.md', 'default local port is `46321`'],
      ['docs/installer-runtime-release-checklist.md', '127.0.0.1:46321'],
    ];

    for (const [path, expected] of contracts) {
      const contents = source(path);
      expect(contents, path).toContain(expected);
      expect(contents, path).not.toContain('8960');
    }
  });

  it('should leave the independent workspace runtime on its explicit 8850 default', () => {
    expect(
      readFileSync(
        resolve(repoRoot, 'packages/workspace/.env.example'),
        'utf8',
      ),
    ).toContain('PORT=8850');
    expect(
      readFileSync(resolve(repoRoot, 'packages/workspace/setup.sh'), 'utf8'),
    ).toContain('PORT:-8850');
  });
});
