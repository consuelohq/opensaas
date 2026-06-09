import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

type SitesCommandResult = {
  ok: boolean;
  command: string;
  home: string;
  sitesDir: string;
  indexPath: string;
  officeIndexPath: string;
  officeDataPath: string;
  officeAssetsDir: string;
  tracesIndexPath: string;
  diffsIndexPath: string;
  url: string;
  artifacts: number;
  generatedAt: string | null;
  indexExists: boolean;
  officeIndexExists: boolean;
  officeDataExists: boolean;
  tracesIndexExists: boolean;
  diffsIndexExists: boolean;
  message: string;
};

let tempHome: string;

beforeEach(() => {
  tempHome = mkdtempSync(join(tmpdir(), 'consuelo-os-sites-cli-'));
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

function runSitesCommand(args: string[]): SitesCommandResult {
  return JSON.parse(runBunEval(`
    const { runSitesCommand } = await import('./scripts/os.ts');
    const result = await runSitesCommand(${JSON.stringify(args)}, { home: ${JSON.stringify(tempHome)}, openUrl: false });
    process.stdout.write(JSON.stringify(result));
  `)) as SitesCommandResult;
}

describe('Sites CLI', () => {
  it('prints, refreshes, opens, and reports the local Sites paths', () => {
    const pathResult = runSitesCommand(['path', '--json']);

    expect(pathResult.ok).toBe(true);
    expect(pathResult.command).toBe('path');
    expect(pathResult.sitesDir).toBe(join(tempHome, 'sites'));
    expect(pathResult.indexPath).toBe(join(tempHome, 'sites', 'index.html'));
    expect(pathResult.officeIndexPath).toBe(join(tempHome, 'sites', 'office', 'index.html'));
    expect(pathResult.officeDataPath).toBe(join(tempHome, 'sites', 'office', 'data', 'artifacts.json'));
    expect(pathResult.tracesIndexPath).toBe(join(tempHome, 'sites', 'traces', 'index.html'));
    expect(pathResult.diffsIndexPath).toBe(join(tempHome, 'sites', 'diffs', 'index.html'));
    expect(pathResult).not.toHaveProperty('githubIndexPath');
    expect(pathResult.url.startsWith('file:')).toBe(true);

    const refreshResult = runSitesCommand(['refresh', '--json']);

    expect(refreshResult.ok).toBe(true);
    expect(refreshResult.artifacts).toBe(0);
    expect(existsSync(refreshResult.indexPath)).toBe(true);
    expect(existsSync(refreshResult.officeIndexPath)).toBe(true);
    expect(existsSync(refreshResult.officeDataPath)).toBe(true);
    expect(existsSync(refreshResult.tracesIndexPath)).toBe(true);
    expect(existsSync(refreshResult.diffsIndexPath)).toBe(true);
    expect(existsSync(join(tempHome, 'sites', 'github', 'index.html'))).toBe(false);
    expect(existsSync(join(tempHome, 'pages', 'office', 'index.html'))).toBe(false);
    expect(JSON.parse(readFileSync(refreshResult.officeDataPath, 'utf8')).artifacts).toEqual([]);

    const statusResult = runSitesCommand(['status', '--json']);

    expect(statusResult).toMatchObject({
      ok: true,
      command: 'status',
      indexExists: true,
      officeIndexExists: true,
      officeDataExists: true,
      tracesIndexExists: true,
      diffsIndexExists: true,
      artifacts: 0,
    });

    const cliStatus = JSON.parse(execFileSync('bun', ['./scripts/os.ts', 'sites', 'status', '--json'], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        CONSUELO_HOME: tempHome,
        CONSUELO_GRAPHQL_URL: '',
        CONSUELO_INTERNAL_GRAPHQL_API_KEY: '',
      },
      encoding: 'utf8',
    })) as SitesCommandResult;
    expect(cliStatus).toMatchObject({
      ok: true,
      command: 'status',
      indexPath: join(tempHome, 'sites', 'index.html'),
      officeDataPath: join(tempHome, 'sites', 'office', 'data', 'artifacts.json'),
    });
    expect(cliStatus).not.toHaveProperty('githubIndexPath');

    const openResult = runSitesCommand(['open', '--json']);
    expect(openResult).toMatchObject({ ok: true, command: 'open' });
  });
});
