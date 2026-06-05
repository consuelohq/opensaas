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

    for (const dir of ['agents', 'skills', 'tools', 'scripts', 'artifacts', 'logs', 'runs', 'cache', 'runtime', 'bin', 'tmp']) {
      expect(existsSync(join(tempHome, dir))).toBe(true);
    }
    expect(existsSync(join(tempHome, 'config.json'))).toBe(true);
    expect(existsSync(join(tempHome, 'consuelo.db'))).toBe(true);
    expect(existsSync(join(tempHome, 'skills', 'task', 'SKILL.md'))).toBe(true);
    expect(existsSync(join(tempHome, 'skills', 'task', '.consuelo-skill.json'))).toBe(true);
    expect(existsSync(join(tempHome, 'skills', 'skills.json'))).toBe(true);
    expect(existsSync(join(tempHome, 'tools', 'tools.json'))).toBe(true);
    expect(existsSync(join(tempHome, 'tools', 'status', '.consuelo-tool.json'))).toBe(true);
    expect(existsSync(join(tempHome, 'tools', 'browser.open', '.consuelo-tool.json'))).toBe(true);
    expect(existsSync(join(tempHome, 'bin', 'status'))).toBe(true);
    expect(existsSync(join(tempHome, 'bin', 'browser.open'))).toBe(true);
    expect(first.actions.some((action: { type: string; path: string; status: string }) => action.type === 'seed_skill' && action.path.endsWith(join('skills', 'task')) && action.status === 'created')).toBe(true);
    expect(first.actions.some((action: { type: string; path: string; status: string }) => action.type === 'seed_tool' && action.path.endsWith(join('tools', 'status')) && action.status === 'created')).toBe(true);
    expect(first.actions.some((action: { path: string; status: string }) => action.path.endsWith('config.json') && action.status === 'created')).toBe(true);

    const installedTaskSkill = JSON.parse(readFileSync(join(tempHome, 'skills', 'task', 'skill.json'), 'utf8'));
    expect(installedTaskSkill.load.path).toBe('skills/task/SKILL.md');
    const installedTaskMetadata = JSON.parse(readFileSync(join(tempHome, 'skills', 'task', '.consuelo-skill.json'), 'utf8'));
    expect(installedTaskMetadata).toMatchObject({ name: 'task', source: 'bundled' });
    const installedRegistry = JSON.parse(readFileSync(join(tempHome, 'skills', 'skills.json'), 'utf8'));
    expect(installedRegistry.skills.some((skill: { name: string }) => skill.name === 'task')).toBe(true);

    const fullToolManifest = JSON.parse(readFileSync(join(process.cwd(), 'manifests', 'tool.manifest.json'), 'utf8'));
    const coreToolManifest = JSON.parse(readFileSync(join(process.cwd(), 'manifests', 'core.manifest.json'), 'utf8'));
    const installedToolRegistry = JSON.parse(readFileSync(join(tempHome, 'tools', 'tools.json'), 'utf8'));
    const installedToolNames = installedToolRegistry.tools.map((tool: { name: string }) => tool.name);
    expect(installedToolRegistry.tools).toHaveLength(fullToolManifest.tools.length);
    expect(installedToolRegistry.tools.length).toBeGreaterThan(coreToolManifest.tools.length);
    expect(installedToolNames).toContain('status');
    expect(installedToolNames).toContain('browser.open');
    expect(installedToolNames).toContain('railway.logs');
    expect(installedToolNames).toContain('get_raw_steering');
    const statusWrapper = readFileSync(join(tempHome, 'bin', 'status'), 'utf8');
    expect(statusWrapper).toContain('scripts/tool-runner.ts');
    expect(statusWrapper).toContain('status');

    const second = JSON.parse(runBunEval(`
      const { provisionLocalOs } = await import('./scripts/lib/install-state.ts');
      const result = provisionLocalOs({ mode: 'local' });
      process.stdout.write(JSON.stringify(result));
    `));
    expect(second.actions.some((action: { path: string; status: string }) => action.path.endsWith('config.json') && action.status === 'preserved')).toBe(true);
  });

  it('materializes the local Office page from persisted artifacts', () => {
    const result = JSON.parse(runBunEval(`
      const { provisionLocalOs } = await import('./scripts/lib/install-state.ts');
      const { createWorkspaceArtifact } = await import('./scripts/lib/artifacts.ts');
      provisionLocalOs({ mode: 'local' });
      const artifact = createWorkspaceArtifact({
        traceId: 'trc_office_page_test',
        workspaceId: 'workspace-id',
        createdByUserId: 'user-id',
        skillName: 'daily-revenue-brief',
        title: 'Quarterly Pipeline Brief',
        fileName: 'quarterly-pipeline-brief.json',
        type: 'brief',
        format: 'json',
        content: { summary: 'pipeline is healthy' },
        inputSummary: { source: 'office-test' },
      });
      provisionLocalOs({ mode: 'local' });
      process.stdout.write(JSON.stringify({ artifact }));
    `)) as { artifact: { id: string; localPath: string; path: string } };

    const officeIndexPath = join(tempHome, 'pages', 'office', 'index.html');
    const officeDataPath = join(tempHome, 'pages', 'office', 'data', 'artifacts.json');
    const officeAssetsPath = join(tempHome, 'pages', 'office', 'assets');

    expect(existsSync(officeIndexPath)).toBe(true);
    expect(existsSync(officeDataPath)).toBe(true);
    expect(existsSync(officeAssetsPath)).toBe(true);

    const officePage = readFileSync(officeIndexPath, 'utf8');
    expect(officePage).toContain('Office');
    expect(officePage).toContain('Quarterly Pipeline Brief');

    const officeData = JSON.parse(readFileSync(officeDataPath, 'utf8')) as {
      artifacts: Array<{
        id: string;
        title: string;
        traceId: string;
        storageMode: string;
        path: string;
        localPath: string;
      }>;
    };
    expect(officeData.artifacts).toEqual([
      expect.objectContaining({
        id: result.artifact.id,
        title: 'Quarterly Pipeline Brief',
        traceId: 'trc_office_page_test',
        storageMode: 'local',
        path: result.artifact.path,
        localPath: result.artifact.localPath,
      }),
    ]);
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

  it('installs every full-manifest tool even when only one skill is selected', () => {
    JSON.parse(runBunEval(`
      const { provisionLocalOs } = await import('./scripts/lib/install-state.ts');
      const result = provisionLocalOs({ mode: 'local', selectedSkills: ['task'] });
      process.stdout.write(JSON.stringify(result));
    `));

    expect(existsSync(join(tempHome, 'skills', 'task', 'SKILL.md'))).toBe(true);
    expect(existsSync(join(tempHome, 'skills', 'research-ingest', 'SKILL.md'))).toBe(false);

    const fullToolManifest = JSON.parse(readFileSync(join(process.cwd(), 'manifests', 'tool.manifest.json'), 'utf8'));
    const installedToolRegistry = JSON.parse(readFileSync(join(tempHome, 'tools', 'tools.json'), 'utf8'));
    const installedToolNames = installedToolRegistry.tools.map((tool: { name: string }) => tool.name);

    expect(installedToolRegistry.tools).toHaveLength(fullToolManifest.tools.length);
    expect(installedToolNames).toContain('task.start');
    expect(installedToolNames).toContain('browser.open');
    expect(installedToolNames).toContain('railway.logs');
    expect(installedToolNames).toContain('get_raw_steering');
  });

  it('preserves local user tools while refreshing the installed registry', () => {
    const localToolDir = join(tempHome, 'tools', 'local-tool');
    mkdirSync(localToolDir, { recursive: true });
    writeFileSync(join(localToolDir, 'tool.json'), `${JSON.stringify({
      name: 'local-tool',
      kind: 'local-tool',
      description: 'User-owned local tool.',
      source: 'local',
      core: false,
    }, null, 2)}\n`);

    const result = JSON.parse(runBunEval(`
      const { provisionLocalOs } = await import('./scripts/lib/install-state.ts');
      const result = provisionLocalOs({ mode: 'local' });
      process.stdout.write(JSON.stringify(result));
    `));

    expect(readFileSync(join(localToolDir, 'tool.json'), 'utf8')).toContain('User-owned local tool.');
    expect(result.actions.some((action: { path: string; status: string; message: string }) => action.path.endsWith(join('tools', 'local-tool')) && action.status === 'skipped' && action.message === 'local tool preserved')).toBe(true);

    const installedToolRegistry = JSON.parse(readFileSync(join(tempHome, 'tools', 'tools.json'), 'utf8'));
    const installedToolNames = installedToolRegistry.tools.map((tool: { name: string }) => tool.name);
    expect(installedToolNames).toContain('local-tool');
    expect(installedToolNames).toContain('status');
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
