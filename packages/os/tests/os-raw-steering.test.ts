import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const packageRoot = import.meta.dirname.replace(/\/tests$/, '');

async function waitForHealth(port: number): Promise<Record<string, unknown>> {
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/health`);
      if (response.ok) return await response.json() as Record<string, unknown>;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  throw new Error('server did not become healthy');
}

describe('OS raw steering routing', () => {
  it('keeps only get_steering and call in the server-visible tool surface', async () => {
    const port = 19000 + Math.floor(Math.random() * 1000);
    const home = mkdtempSync(join(tmpdir(), 'consuelo-os-raw-steering-'));
    const server = spawn('bun', ['scripts/server.ts'], {
      cwd: packageRoot,
      env: {
        ...process.env,
        CONSUELO_HOME: home,
        CONSUELO_OS_HOME: home,
        CONSUELO_OS_AUTH_CONFIG: '',
        CONSUELO_OS_PORT: String(port),
        CONSUELO_OS_BEARER_TOKEN: '',
        MCP_BEARER_TOKEN: '',
      },
      stdio: 'ignore',
    });

    try {
      const body = await waitForHealth(port);
      const legacyPath = '/get_' + 'dev' + '_steering';
      const legacyResponse = await fetch(`http://127.0.0.1:${port}${legacyPath}`);

      expect(body.tools).toBe(2);
      expect(body.toolNames).toEqual(['get_steering', 'call']);
      expect(legacyResponse.status).toBe(401);
    } finally {
      server.kill('SIGTERM');
      rmSync(home, { recursive: true, force: true });
    }
  });

  it('returns raw full-manifest steering through the normal call path', () => {
    const result = spawnSync('bun', [
      'scripts/os.ts',
      'call',
      JSON.stringify({ name: 'get_raw_steering' }),
    ], {
      cwd: packageRoot,
      encoding: 'utf8',
    });

    expect(result.status).toBe(0);
    const output = JSON.parse(result.stdout) as {
      ok: boolean;
      name: string;
      permission: string;
      result?: { steering?: string };
    };

    expect(output.ok).toBe(true);
    expect(output.name).toBe('get_raw_steering');
    expect(output.permission).toBe('guidance');
    expect(output.result?.steering).toContain('# Consuelo OS raw/operator steering');
    expect(output.result?.steering).toContain('# canonical full tool manifest');
    expect(output.result?.steering).toContain('"codeFile"');
    expect(output.result?.steering).toContain('"codeFileSource"');
    expect(output.result?.steering).toContain('from pathlib import Path');
    expect(output.result?.steering).toContain('signatureAlgorithm');
  });
});
