import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
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
    expect(existsSync(join(tempHome, 'skills', 'task', 'SKILL.md'))).toBe(true);
    expect(existsSync(join(tempHome, 'skills', 'task', '.consuelo-skill.json'))).toBe(true);
    expect(existsSync(join(tempHome, 'skills', 'skills.json'))).toBe(true);
    expect(first.actions.some((action: { type: string; path: string; status: string }) => action.type === 'seed_skill' && action.path.endsWith(join('skills', 'task')) && action.status === 'created')).toBe(true);
    expect(first.actions.some((action: { path: string; status: string }) => action.path.endsWith('config.json') && action.status === 'created')).toBe(true);

    const installedTaskSkill = JSON.parse(readFileSync(join(tempHome, 'skills', 'task', 'skill.json'), 'utf8'));
    expect(installedTaskSkill.load.path).toBe('skills/task/SKILL.md');
    const installedTaskMetadata = JSON.parse(readFileSync(join(tempHome, 'skills', 'task', '.consuelo-skill.json'), 'utf8'));
    expect(installedTaskMetadata).toMatchObject({ name: 'task', source: 'bundled' });
    const installedRegistry = JSON.parse(readFileSync(join(tempHome, 'skills', 'skills.json'), 'utf8'));
    expect(installedRegistry.skills.some((skill: { name: string }) => skill.name === 'task')).toBe(true);

    const second = JSON.parse(runBunEval(`
      const { provisionLocalOs } = await import('./scripts/lib/install-state.ts');
      const result = provisionLocalOs({ mode: 'local' });
      process.stdout.write(JSON.stringify(result));
    `));
    expect(second.actions.some((action: { path: string; status: string }) => action.path.endsWith('config.json') && action.status === 'preserved')).toBe(true);
  });


  it('preserves local user skills while refreshing the installed registry', () => {
    const localSkillDir = join(tempHome, 'skills', 'local-research');
    mkdirSync(localSkillDir, { recursive: true });
    writeFileSync(join(localSkillDir, 'SKILL.md'), 'local skill body\n');
    writeFileSync(join(localSkillDir, 'skill.json'), `${JSON.stringify({
      name: 'local-research',
      title: 'Local Research',
      description: 'User-owned local research skill.',
      trigger: 'Invoke for local research experiments.',
      entrypoint: 'SKILL.md',
      load: { type: 'resource', path: 'skills/local-research/SKILL.md' },
      permission: 'read',
      requiresApproval: false,
      status: 'active',
    }, null, 2)}\n`);

    const result = JSON.parse(runBunEval(`
      const { provisionLocalOs } = await import('./scripts/lib/install-state.ts');
      const result = provisionLocalOs({ mode: 'local' });
      process.stdout.write(JSON.stringify(result));
    `));

    expect(readFileSync(join(localSkillDir, 'SKILL.md'), 'utf8')).toBe('local skill body\n');
    expect(result.actions.some((action: { path: string; status: string; message: string }) => action.path.endsWith(join('skills', 'local-research')) && action.status === 'skipped' && action.message === 'local skill preserved')).toBe(true);
    const installedRegistry = JSON.parse(readFileSync(join(tempHome, 'skills', 'skills.json'), 'utf8'));
    expect(installedRegistry.skills.some((skill: { name: string }) => skill.name === 'local-research')).toBe(true);
    expect(installedRegistry.skills.some((skill: { name: string }) => skill.name === 'task')).toBe(true);
  });

  it('materializes only selected bundled skills on fresh install', () => {
    const result = JSON.parse(runBunEval(`
      const { provisionLocalOs } = await import('./scripts/lib/install-state.ts');
      const result = provisionLocalOs({ mode: 'local', selectedSkills: ['task', 'senior-engineer'] });
      process.stdout.write(JSON.stringify(result));
    `));

    expect(existsSync(join(tempHome, 'skills', 'task', 'SKILL.md'))).toBe(true);
    expect(existsSync(join(tempHome, 'skills', 'senior-engineer', 'SKILL.md'))).toBe(true);
    expect(existsSync(join(tempHome, 'skills', 'research-ingest', 'SKILL.md'))).toBe(false);
    expect(result.actions.some((action: { path: string; status: string; message: string }) => action.path.endsWith(join('skills', 'research-ingest')) && action.status === 'skipped' && action.message === 'bundled skill not selected')).toBe(true);

    const installedRegistry = JSON.parse(readFileSync(join(tempHome, 'skills', 'skills.json'), 'utf8'));
    const installedNames = installedRegistry.skills.map((skill: { name: string }) => skill.name);
    expect(installedNames).toContain('task');
    expect(installedNames).toContain('senior-engineer');
    expect(installedNames).not.toContain('research-ingest');
  });

  it('uses default selected bundled skills when no selectedSkills option is provided', () => {
    JSON.parse(runBunEval(`
      const { provisionLocalOs } = await import('./scripts/lib/install-state.ts');
      const result = provisionLocalOs({ mode: 'local' });
      process.stdout.write(JSON.stringify(result));
    `));

    expect(existsSync(join(tempHome, 'skills', 'senior-engineer', 'SKILL.md'))).toBe(true);
    expect(existsSync(join(tempHome, 'skills', 'research-ingest', 'SKILL.md'))).toBe(true);
    expect(existsSync(join(tempHome, 'skills', 'consuelo-design-landing-page', 'skill.json'))).toBe(false);

    const config = JSON.parse(readFileSync(join(tempHome, 'config.json'), 'utf8'));
    expect(config.selectedSkills).toContain('senior-engineer');
    expect(config.selectedSkills).toContain('research-ingest');
    expect(config.selectedSkills).not.toContain('consuelo-design-landing-page');
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
