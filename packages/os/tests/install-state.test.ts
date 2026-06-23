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

  it('reports existing generated security assets as existing on reprovision', () => {
    JSON.parse(runBunEval(`
      const { provisionLocalOs } = await import('./scripts/lib/install-state.ts');
      const result = provisionLocalOs({ mode: 'local' });
      process.stdout.write(JSON.stringify(result));
    `));

    const result = JSON.parse(runBunEval(`
      const { provisionLocalOs } = await import('./scripts/lib/install-state.ts');
      const result = provisionLocalOs({ mode: 'local' });
      process.stdout.write(JSON.stringify(result));
    `));

    for (const expectedPath of [
      join('security', 'generated'),
      join('security', 'overrides'),
      join('security', 'generated', 'auth.json'),
      join('security', 'generated', 'Caddyfile'),
    ]) {
      expect(result.actions.some((action: { path: string; status: string }) => action.path.endsWith(expectedPath) && action.status === 'preserved')).toBe(true);
    }
  });

  it('creates the approved local home shape and preserves existing config', () => {
    const first = JSON.parse(runBunEval(`
      const { provisionLocalOs } = await import('./scripts/lib/install-state.ts');
      const result = provisionLocalOs({ mode: 'local' });
      process.stdout.write(JSON.stringify(result));
    `));

    for (const dir of [
      'agents',
      'skills',
      'tools',
      'scripts',
      'src',
      'tooling',
      'manifests',
      'artifacts',
      'pages',
      'sites',
      'logs',
      'runs',
      'cache',
      'runtime',
      'steering',
      'bin',
      'tmp',
    ]) {
      expect(existsSync(join(tempHome, dir))).toBe(true);
    }
    for (const file of ['package.json', 'bun.lock', 'config.json', 'consuelo.db']) {
      expect(existsSync(join(tempHome, file))).toBe(true);
    }
    expect(existsSync(join(tempHome, 'source'))).toBe(false);
    expect(existsSync(join(tempHome, 'source', 'tools'))).toBe(false);
    expect(existsSync(join(tempHome, 'source', 'skills'))).toBe(false);
    expect(existsSync(join(tempHome, 'source', 'package.json'))).toBe(false);
    expect(existsSync(join(tempHome, 'scripts', 'server.ts'))).toBe(true);
    expect(existsSync(join(tempHome, 'scripts', 'server.js'))).toBe(true);
    expect(existsSync(join(tempHome, 'skills', 'task', 'SKILL.md'))).toBe(true);
    expect(existsSync(join(tempHome, 'skills', 'task', '.consuelo-skill.json'))).toBe(true);
    expect(existsSync(join(tempHome, 'skills', 'skills.json'))).toBe(true);
    expect(existsSync(join(tempHome, 'tools', 'tools.json'))).toBe(true);
    expect(existsSync(join(tempHome, 'tools', 'status', 'tool.json'))).toBe(true);
    expect(existsSync(join(tempHome, 'tools', 'status', '.consuelo-tool.json'))).toBe(true);
    expect(existsSync(join(tempHome, 'tools', 'browser.open', '.consuelo-tool.json'))).toBe(true);
    expect(existsSync(join(tempHome, 'bin', 'status'))).toBe(true);
    expect(existsSync(join(tempHome, 'operator', 'operator.ts'))).toBe(true);
    expect(existsSync(join(tempHome, 'operator', 'prompts', 'review.md'))).toBe(true);
    expect(existsSync(join(tempHome, 'hooks', 'intent.js'))).toBe(true);
    expect(existsSync(join(tempHome, 'hooks', 'dispatcher.js'))).toBe(true);
    expect(existsSync(join(tempHome, 'hooks', 'task', 'workflow.js'))).toBe(true);
    expect(existsSync(join(tempHome, 'hooks', 'task', 'guidance.js'))).toBe(true);
    expect(existsSync(join(tempHome, 'bin', 'browser.open'))).toBe(true);
    expect(existsSync(join(tempHome, 'steering', 'system_prompt.md'))).toBe(true);
    expect(existsSync(join(tempHome, 'steering', 'decision.md'))).toBe(true);
    expect(existsSync(join(tempHome, 'steering', 'STEERING.md'))).toBe(false);
    expect(existsSync(join(tempHome, 'steering', 'steering.md'))).toBe(false);
    expect(readFileSync(join(tempHome, 'steering', 'system_prompt.md'), 'utf8')).toContain('# System Prompt');
    expect(readFileSync(join(tempHome, 'steering', 'decision.md'), 'utf8')).toContain('# decision process');
    expect(first.actions.some((action: { type: string; path: string; status: string }) => action.type === 'seed_steering' && action.path.endsWith(join('steering', 'system_prompt.md')) && action.status === 'created')).toBe(true);
    expect(first.actions.some((action: { type: string; path: string; status: string }) => action.type === 'seed_steering' && action.path.endsWith(join('steering', 'decision.md')) && action.status === 'created')).toBe(true);
    expect(first.actions.some((action: { type: string; path: string; status: string }) => action.type === 'seed_skill' && action.path.endsWith(join('skills', 'task')) && action.status === 'created')).toBe(true);
    expect(first.actions.some((action: { type: string; path: string; status: string }) => action.type === 'seed_tool' && action.path.endsWith(join('tools', 'status')) && action.status === 'created')).toBe(true);
    expect(first.actions.some((action: { type: string; path: string; status: string }) => action.type === 'seed_operator' && action.path.endsWith('operator') && action.status === 'created')).toBe(true);
    expect(first.actions.some((action: { path: string; status: string }) => action.path.endsWith('config.json') && action.status === 'created')).toBe(true);
    const installedTaskSkill = JSON.parse(readFileSync(join(tempHome, 'skills', 'task', 'skill.json'), 'utf8'));
    expect(installedTaskSkill.load.path).toBe('skills/task/SKILL.md');
    const installedTaskMetadata = JSON.parse(readFileSync(join(tempHome, 'skills', 'task', '.consuelo-skill.json'), 'utf8'));
    expect(installedTaskMetadata).toMatchObject({ name: 'task', source: 'bundled' });
    const installedRegistry = JSON.parse(readFileSync(join(tempHome, 'skills', 'skills.json'), 'utf8'));
    expect(installedRegistry.skills.some((skill: { name: string }) => skill.name === 'task')).toBe(true);

    const sitesIndexPath = join(tempHome, 'sites', 'index.html');
    const officeSiteIndexPath = join(tempHome, 'sites', 'office', 'index.html');
    const officeSiteDataPath = join(tempHome, 'sites', 'office', 'data', 'artifacts.json');
    const tracesIndexPath = join(tempHome, 'sites', 'traces', 'index.html');
    const diffsIndexPath = join(tempHome, 'sites', 'diffs', 'index.html');
    expect(existsSync(sitesIndexPath)).toBe(true);
    expect(existsSync(officeSiteIndexPath)).toBe(true);
    expect(existsSync(officeSiteDataPath)).toBe(true);
    expect(existsSync(tracesIndexPath)).toBe(true);
    expect(existsSync(diffsIndexPath)).toBe(true);
    expect(existsSync(join(tempHome, 'sites', 'github', 'index.html'))).toBe(false);
    expect(existsSync(join(tempHome, 'pages', 'office', 'index.html'))).toBe(false);

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
    expect(installedToolNames).toContain('code.call');
    const fullCodeCall = fullToolManifest.tools.find((tool: { name: string }) => tool.name === 'code.call');
    const coreCodeCall = coreToolManifest.tools.find((tool: { name: string }) => tool.name === 'code.call');
    expect(fullCodeCall?.core).toBe(true);
    expect(coreCodeCall?.core).toBe(true);
    expect(existsSync(join(tempHome, 'tools', 'code.call', 'tool.json'))).toBe(true);
    expect(existsSync(join(tempHome, 'tools', 'code.call', '.consuelo-tool.json'))).toBe(true);
    const codeCallWrapper = readFileSync(join(tempHome, 'bin', 'code.call'), 'utf8');
    expect(codeCallWrapper).toContain('scripts/tool-runner.ts');
    expect(codeCallWrapper).toContain('code.call');
    const statusWrapper = readFileSync(join(tempHome, 'bin', 'status'), 'utf8');
    expect(statusWrapper).toContain('scripts/tool-runner.ts');
    expect(statusWrapper).toContain('status');
    expect(statusWrapper).toContain('OS_HOME=');
    expect(statusWrapper).toContain('cd "$OS_HOME"');
    expect(statusWrapper).toContain('./scripts/tool-runner.ts');
    expect(statusWrapper).toContain('if [ "$#" -gt 0 ]; then');
    expect(statusWrapper).toContain("INPUT='{}'");
    expect(statusWrapper).not.toContain('INPUT="${1:-{}}"');
    expect(statusWrapper).not.toContain('CONSUELO_OS_SOURCE_DIR');
    expect(statusWrapper).not.toContain('$OS_HOME/source');
    expect(statusWrapper).not.toContain('$OS_HOME/../../source/opensaas');
    expect(statusWrapper).not.toContain('~/.consuelo/source/opensaas');
    expect(statusWrapper).not.toContain('/Users/kokayi/Dev/opensaas');
    expect(statusWrapper).not.toContain('packages/os');
    const installedStatusMetadata = JSON.parse(readFileSync(join(tempHome, 'tools', 'status', '.consuelo-tool.json'), 'utf8'));
    expect(installedStatusMetadata.sourcePath).toBe('manifests/tool.manifest.json');
    writeFileSync(join(tempHome, 'steering', 'system_prompt.md'), '# User system prompt\n\nuser-owned system prompt\n');
    writeFileSync(join(tempHome, 'steering', 'decision.md'), '# User decision\n\nuser-owned decision\n');

    const second = JSON.parse(runBunEval(`
      const { provisionLocalOs } = await import('./scripts/lib/install-state.ts');
      const result = provisionLocalOs({ mode: 'local' });
      process.stdout.write(JSON.stringify(result));
    `));
    expect(second.actions.some((action: { path: string; status: string }) => action.path.endsWith('config.json') && action.status === 'preserved')).toBe(true);
    expect(second.actions.some((action: { type: string; path: string; status: string }) => action.type === 'seed_steering' && action.path.endsWith(join('steering', 'system_prompt.md')) && action.status === 'preserved')).toBe(true);
    expect(second.actions.some((action: { type: string; path: string; status: string }) => action.type === 'seed_steering' && action.path.endsWith(join('steering', 'decision.md')) && action.status === 'preserved')).toBe(true);
    expect(readFileSync(join(tempHome, 'steering', 'system_prompt.md'), 'utf8')).toContain('user-owned system prompt');
    expect(readFileSync(join(tempHome, 'steering', 'decision.md'), 'utf8')).toContain('user-owned decision');
  });


  it('writes an OpenCode MCP config that exposes Consuelo OS tools', () => {
    mkdirSync(join(tempUserHome, '.config', 'opencode'), { recursive: true });
    writeFileSync(
      join(tempUserHome, '.config', 'opencode', 'opencode.json'),
      `${JSON.stringify({ theme: 'system', mcp: { existing: { type: 'local', command: ['existing'], enabled: true } } }, null, 2)}\n`,
    );

    const result = JSON.parse(runBunEval(`
      const { provisionLocalOs } = await import('./scripts/lib/install-state.ts');
      const result = provisionLocalOs({ mode: 'local', connectAgents: ['opencode'] });
      process.stdout.write(JSON.stringify(result));
    `));

    const opencodeConfigPath = join(tempUserHome, '.config', 'opencode', 'opencode.json');
    const opencodeConfig = JSON.parse(readFileSync(opencodeConfigPath, 'utf8'));
    expect(opencodeConfig.theme).toBe('system');
    expect(opencodeConfig.mcp.existing).toMatchObject({ type: 'local', enabled: true });
    expect(opencodeConfig.mcp['consuelo-os']).toMatchObject({
      type: 'local',
      enabled: true,
      cwd: tempHome,
      environment: { CONSUELO_HOME: tempHome },
    });
    expect(opencodeConfig.mcp['consuelo-os'].command).toEqual([
      'bun',
      join(tempHome, 'scripts', 'mcp-stdio.ts'),
    ]);
    expect(existsSync(join(tempHome, 'scripts', 'mcp-stdio.ts'))).toBe(true);
    expect(result.actions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'connect_agent',
          path: opencodeConfigPath,
          message: expect.stringMatching(/OpenCode MCP/i),
        }),
      ]),
    );
  });

  it('materializes the local Office site from persisted artifacts', () => {
    const result = JSON.parse(runBunEval(`
      const { provisionLocalOs } = await import('./scripts/lib/install-state.ts');
      const { createWorkspaceArtifact } = await import('./scripts/lib/artifacts.ts');
      provisionLocalOs({ mode: 'local' });
      const artifact = createWorkspaceArtifact({
        traceId: 'trc_office_site_test',
        workspaceId: 'workspace-id',
        createdByUserId: 'user-id',
        skillName: 'daily-revenue-brief',
        title: 'Quarterly Pipeline Brief',
        fileName: 'quarterly-pipeline-brief.json',
        type: 'brief',
        format: 'json',
        content: { summary: 'pipeline is healthy' },
        inputSummary: { source: 'sites-test' },
      });
      provisionLocalOs({ mode: 'local' });
      process.stdout.write(JSON.stringify({ artifact }));
    `)) as { artifact: { id: string; localPath: string; path: string } };

    const sitesIndexPath = join(tempHome, 'sites', 'index.html');
    const officeSiteIndexPath = join(tempHome, 'sites', 'office', 'index.html');
    const officeSiteDataPath = join(tempHome, 'sites', 'office', 'data', 'artifacts.json');
    const officeSiteAssetsPath = join(tempHome, 'sites', 'office', 'assets');
    expect(existsSync(sitesIndexPath)).toBe(true);
    expect(existsSync(officeSiteIndexPath)).toBe(true);
    expect(existsSync(officeSiteDataPath)).toBe(true);
    expect(existsSync(officeSiteAssetsPath)).toBe(true);
    for (const site of ['traces', 'diffs']) {
      expect(existsSync(join(tempHome, 'sites', site))).toBe(true);
      expect(existsSync(join(tempHome, 'sites', site, 'index.html'))).toBe(true);
    }
    expect(existsSync(join(tempHome, 'sites', 'github', 'index.html'))).toBe(false);
    expect(existsSync(join(tempHome, 'pages', 'office', 'index.html'))).toBe(false);

    const sitesIndex = readFileSync(sitesIndexPath, 'utf8');
    expect(sitesIndex).toContain('Sites');
    expect(sitesIndex).toContain('Office');
    expect(sitesIndex).toContain('Tracing');
    expect(sitesIndex).toContain('Diffs');
    expect(sitesIndex).not.toContain('GitHub Workflows');

    const officeSitePage = readFileSync(officeSiteIndexPath, 'utf8');
    expect(officeSitePage).toContain('Office');
    expect(officeSitePage).toContain('Quarterly Pipeline Brief');

    const officeSiteData = JSON.parse(readFileSync(officeSiteDataPath, 'utf8')) as {
      artifacts: Array<{
        id: string;
        title: string;
        traceId: string;
        storageMode: string;
        path: string;
        localPath: string;
      }>;
    };
    expect(officeSiteData.artifacts).toEqual([
      expect.objectContaining({
        id: result.artifact.id,
        title: 'Quarterly Pipeline Brief',
        traceId: 'trc_office_site_test',
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


  it('migrates existing Office skill selections to Sites', () => {
    mkdirSync(tempHome, { recursive: true });
    writeFileSync(join(tempHome, 'config.json'), `${JSON.stringify({
      version: 1,
      mode: 'local',
      home: tempHome,
      port: 48761,
      artifactStorage: 'local',
      selectedSkills: ['office', 'task'],
      agents: [],
      createdAt: '2026-06-09T00:00:00.000Z',
      updatedAt: '2026-06-09T00:00:00.000Z',
    }, null, 2)}\n`);

    JSON.parse(runBunEval(`
      const { provisionLocalOs } = await import('./scripts/lib/install-state.ts');
      const result = provisionLocalOs({ mode: 'local' });
      process.stdout.write(JSON.stringify(result));
    `));

    const config = JSON.parse(readFileSync(join(tempHome, 'config.json'), 'utf8'));
    expect(config.selectedSkills).toContain('sites');
    expect(config.selectedSkills).toContain('task');
    expect(config.selectedSkills).not.toContain('office');
    expect(existsSync(join(tempHome, 'skills', 'sites', 'SKILL.md'))).toBe(true);
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
    expect(existsSync(join(tempHome, 'skills', 'office-landing-page', 'skill.json'))).toBe(false);

    const config = JSON.parse(readFileSync(join(tempHome, 'config.json'), 'utf8'));
    expect(config.selectedSkills).toContain('senior-engineer');
    expect(config.selectedSkills).toContain('research-ingest');
    expect(config.selectedSkills).not.toContain('office-landing-page');
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

  it('reports intent and task hook runtime modules in doctor checks', () => {
    const result = JSON.parse(runBunEval(`
      const { provisionLocalOs, runDoctor } = await import('./scripts/lib/install-state.ts');
      provisionLocalOs({ mode: 'local' });
      const result = await runDoctor();
      process.stdout.write(JSON.stringify(result));
    `)) as { checks: Array<{ name: string; status: string; message: string }> };

    const intentCheck = result.checks.find((check) => check.name === 'runtime:intent');
    const taskHookCheck = result.checks.find((check) => check.name === 'runtime:task-hook');
    expect(intentCheck).toMatchObject({ status: 'connected' });
    expect(intentCheck?.message).toContain('hooks/intent.js');
    expect(taskHookCheck).toMatchObject({ status: 'connected' });
    expect(taskHookCheck?.message).toContain('hooks/task/guidance.js');
  });

  it('validates bundled skill metadata against the manifest', () => {
    const issues = JSON.parse(runBunEval(`
      const { validateBundledSkills } = await import('./scripts/lib/skills.ts');
      process.stdout.write(JSON.stringify(validateBundledSkills()));
    `));

    expect(issues).toEqual([]);
  });
});
