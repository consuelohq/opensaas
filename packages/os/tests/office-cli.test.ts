import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

let tempHome: string;

beforeEach(() => {
  tempHome = mkdtempSync(join(tmpdir(), 'consuelo-os-office-cli-'));
});

afterEach(() => {
  rmSync(tempHome, { recursive: true, force: true });
});

function runBunEval(code: string): string {
  return execFileSync('bun', ['-e', code], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      CONSUELO_HOME: tempHome,
      CONSUELO_GRAPHQL_URL: '',
      CONSUELO_INTERNAL_GRAPHQL_API_KEY: '',
    },
    encoding: 'utf8',
  });
}

function runOfficeCommand(args: string[]): Record<string, any> {
  return JSON.parse(runBunEval(`
    const { runOfficeCommand } = await import('./scripts/os.ts');
    const result = await runOfficeCommand(${JSON.stringify(args)}, { home: '${tempHome}', openUrl: false });
    process.stdout.write(JSON.stringify(result));
  `));
}

describe('Office CLI', () => {
  it('prints, refreshes, and reports the local Office page paths', () => {
    const pathResult = runOfficeCommand(['path', '--json']);

    expect(pathResult.ok).toBe(true);
    expect(pathResult.indexPath).toBe(join(tempHome, 'pages', 'office', 'index.html'));
    expect(pathResult.dataPath).toBe(join(tempHome, 'pages', 'office', 'data', 'artifacts.json'));
    expect(pathResult.url.startsWith('file:')).toBe(true);

    const refreshResult = runOfficeCommand(['refresh', '--json']);

    expect(refreshResult.ok).toBe(true);
    expect(refreshResult.artifacts).toBe(0);
    expect(existsSync(refreshResult.indexPath)).toBe(true);
    expect(existsSync(refreshResult.dataPath)).toBe(true);
    expect(JSON.parse(readFileSync(refreshResult.dataPath, 'utf8')).artifacts).toEqual([]);

    const statusResult = runOfficeCommand(['status', '--json']);

    expect(statusResult).toMatchObject({
      ok: true,
      indexExists: true,
      dataExists: true,
      artifacts: 0,
    });
  });
});
