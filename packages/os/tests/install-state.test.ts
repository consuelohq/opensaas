import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

let tempHome: string;
let tempUserHome: string;

beforeEach(() => {
  tempHome = mkdtempSync(join(tmpdir(), 'consuelo-os-install-'));
  tempUserHome = mkdtempSync(join(tmpdir(), 'consuelo-user-home-'));
});

afterEach(() => {
  rmSync(tempHome, { recursive: true, force: true });
  rmSync(tempUserHome, { recursive: true, force: true });
});

function runBunEval(code: string): string {
  return execFileSync('bun', ['-e', code], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      CONSUELO_HOME: tempHome,
      HOME: tempUserHome,
      CONSUELO_GRAPHQL_URL: '',
      CONSUELO_INTERNAL_GRAPHQL_API_KEY: '',
    },
    encoding: 'utf8',
  });
}

describe('local OS install state', () => {
  it('plans a dry run without creating files', () => {
    const result = JSON.parse(runBunEval(`
      const { provisionLocalOs } = await import('./scripts/lib/install-state.ts');
      const result = provisionLocalOs({ dryRun: true });
      process.stdout.write(JSON.stringify(result));
    `));

    expect(result.home).toBe(tempHome);
    expect(result.actions.some((action: { status: string }) => action.status === 'planned')).toBe(true);
    expect(existsSync(join(tempHome, 'config.json'))).toBe(false);
  });

  it('creates the approved local home shape and preserves existing config', () => {
    const first = JSON.parse(runBunEval(`
      const { provisionLocalOs } = await import('./scripts/lib/install-state.ts');
      const result = provisionLocalOs({ mode: 'local' });
      process.stdout.write(JSON.stringify(result));
    `));

    for (const dir of ['agents', 'skills', 'scripts', 'artifacts', 'logs', 'runs', 'cache', 'runtime', 'bin', 'tmp']) {
      expect(existsSync(join(tempHome, dir))).toBe(true);
    }
    expect(existsSync(join(tempHome, 'config.json'))).toBe(true);
    expect(existsSync(join(tempHome, 'consuelo.db'))).toBe(true);
    expect(first.actions.some((action: { path: string; status: string }) => action.path.endsWith('config.json') && action.status === 'created')).toBe(true);

    const second = JSON.parse(runBunEval(`
      const { provisionLocalOs } = await import('./scripts/lib/install-state.ts');
      const result = provisionLocalOs({ mode: 'local' });
      process.stdout.write(JSON.stringify(result));
    `));
    expect(second.actions.some((action: { path: string; status: string }) => action.path.endsWith('config.json') && action.status === 'preserved')).toBe(true);
  });

  it('records detected agent connections without editing unknown config files', () => {
    mkdirSync(join(tempUserHome, '.codex'), { recursive: true });

    const result = JSON.parse(runBunEval(`
      const { provisionLocalOs } = await import('./scripts/lib/install-state.ts');
      const result = provisionLocalOs({ connectAgents: ['codex'] });
      process.stdout.write(JSON.stringify(result));
    `));

    const sidecarPath = join(tempUserHome, '.codex', 'consuelo-os.json');
    expect(existsSync(sidecarPath)).toBe(true);
    expect(JSON.parse(readFileSync(sidecarPath, 'utf8'))).toMatchObject({ name: 'codex', osHome: tempHome });
    expect(result.agents.some((agent: { name: string; connected: boolean }) => agent.name === 'codex' && agent.connected)).toBe(true);
  });

  it('validates bundled skill metadata against the manifest', () => {
    const issues = JSON.parse(runBunEval(`
      const { validateBundledSkills } = await import('./scripts/lib/skills.ts');
      process.stdout.write(JSON.stringify(validateBundledSkills()));
    `));

    expect(issues).toEqual([]);
  });
});
