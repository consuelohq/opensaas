import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

const homes: string[] = [];
const userHomes: string[] = [];

function makeHome(): string {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'consuelo-os-steering-'));
  const userHome = fs.mkdtempSync(path.join(os.tmpdir(), 'consuelo-os-steering-user-'));
  homes.push(home);
  userHomes.push(userHome);
  process.env.CONSUELO_HOME = home;
  process.env.CONSUELO_USER_HOME = userHome;
  return home;
}

function runOsSnippet<TOutput>(home: string, code: string): TOutput {
  const result = spawnSync('bun', ['--eval', code], {
    cwd: process.cwd(),
    encoding: 'utf8',
    env: {
      ...process.env,
      CONSUELO_HOME: home,
      CONSUELO_USER_HOME: process.env.CONSUELO_USER_HOME,
    },
  });

  if (result.status !== 0) {
    throw new Error(`OS Bun snippet failed:\n${result.stderr || result.stdout}`);
  }

  return JSON.parse(result.stdout || 'null') as TOutput;
}

function readExecutions(home: string): Array<Record<string, unknown>> {
  const result = spawnSync('sqlite3', [
    '-json',
    path.join(home, 'node', 'db', 'consuelo.db'),
    'SELECT name, status, input_json, output_json, duration_ms FROM skill_executions ORDER BY started_at',
  ], { encoding: 'utf8' });
  expect(result.status).toBe(0);
  return JSON.parse(result.stdout || '[]') as Array<Record<string, unknown>>;
}

function readExecution(home: string): Record<string, unknown> {
  const rows = readExecutions(home);
  expect(rows.length).toBe(1);
  return rows[0] ?? {};
}

afterEach(() => {
  delete process.env.CONSUELO_HOME;
  delete process.env.CONSUELO_USER_HOME;
  delete process.env.CONSUELO_WORKSPACE_ID;
  delete process.env.CONSUELO_USER_ID;
  for (const home of homes.splice(0)) fs.rmSync(home, { recursive: true, force: true });
  for (const home of userHomes.splice(0)) fs.rmSync(home, { recursive: true, force: true });
});

describe('OS steering execution recording', () => {
  it('projects authoritative installed workspace and node identity instead of stale env identity', () => {
    const home = makeHome();
    fs.writeFileSync(path.join(home, 'config.json'), `${JSON.stringify({
      version: 1,
      mode: 'local',
      home,
      port: 46321,
      artifactStorage: 'local',
      workspace: {
        id: 'workspace_authoritative',
        slug: 'authoritative',
        host: 'authoritative.consuelohq.com',
      },
      agents: [],
      createdAt: '2026-08-12T00:00:00.000Z',
      updatedAt: '2026-08-12T00:00:00.000Z',
    }, null, 2)}\n`);
    fs.mkdirSync(path.join(home, 'node'), { recursive: true });
    fs.writeFileSync(path.join(home, 'node', 'node.yaml'), [
      'version: 1',
      'node:',
      '  id: node_authoritative',
      '  name: Cloud Node',
      '  role: home',
      'capabilities:',
      '  - local-runtime',
      'workspaces:',
      '  - id: workspace_authoritative',
      '    state: workspaces/workspace_authoritative/state',
      '',
    ].join('\n'));
    process.env.CONSUELO_WORKSPACE_ID = 'workspace_stale_env';
    process.env.CONSUELO_USER_ID = 'user_stale_env';

    const { steering } = runOsSnippet<{ steering: string }>(home, `
      const { getSteering } = await import('./scripts/os.ts');
      process.stdout.write(JSON.stringify({ steering: getSteering() }));
    `);

    expect(steering).toContain('"workspace"');
    expect(steering).toContain('"id": "workspace_authoritative"');
    expect(steering).toContain('"node"');
    expect(steering).toContain('"id": "node_authoritative"');
    expect(steering).toContain('"name": "Cloud Node"');
    expect(steering).not.toContain('workspace_stale_env');
    expect(steering).not.toContain('user_stale_env');
    expect(steering).not.toContain('"userId"');
  });

  it('projects central default and available nodes without replacing the installed node identity', () => {
    const home = makeHome();
    fs.writeFileSync(path.join(home, 'config.json'), `${JSON.stringify({
      version: 1,
      mode: 'local',
      home,
      port: 46321,
      artifactStorage: 'local',
      workspace: {
        id: 'workspace_nodes',
        slug: 'nodes',
        host: 'nodes.consuelohq.com',
      },
      agents: [],
      createdAt: '2026-08-12T00:00:00.000Z',
      updatedAt: '2026-08-12T00:00:00.000Z',
    }, null, 2)}\n`);
    fs.mkdirSync(path.join(home, 'node'), { recursive: true });
    fs.writeFileSync(path.join(home, 'node', 'node.yaml'), [
      'version: 1',
      'node:',
      '  id: node_local',
      '  name: Local Node',
      '  role: member',
      'capabilities:',
      '  - local-runtime',
      'workspaces:',
      '  - id: workspace_nodes',
      '    state: workspaces/workspace_nodes/state',
      '',
    ].join('\n'));

    const { steering } = runOsSnippet<{ steering: string }>(home, `
      const { getSteering } = await import('./scripts/os.ts');
      process.stdout.write(JSON.stringify({
        steering: getSteering({
          nodeRouting: {
            version: 1,
            workspaceId: 'workspace_nodes',
            currentNodeId: 'node_local',
            defaultNodeId: 'node_cloud',
            routeSource: 'explicit',
            nodes: [
              { nodeId: 'node_local', displayName: 'Local Node', role: 'member', presence: 'online' },
              { nodeId: 'node_cloud', displayName: 'Cloud Node', role: 'home', platform: 'linux', presence: 'online' },
            ],
          },
        }),
      }));
    `);

    expect(steering).toContain('"id": "node_local"');
    expect(steering).toContain('"defaultNodeId": "node_cloud"');
    expect(steering).toContain('"routeSource": "explicit"');
    expect(steering).toContain('"displayName": "Cloud Node"');
    expect(steering).toContain('"presence": "online"');
  });

  it('appends installed skill metadata without inlining skill bodies', () => {
    const home = makeHome();
    const skillsDir = path.join(home, 'skills');
    const customSkillDir = path.join(skillsDir, 'custom-branch-planner');
    fs.mkdirSync(customSkillDir, { recursive: true });
    fs.writeFileSync(path.join(customSkillDir, 'SKILL.md'), '# Secret body\n\nbody-only-marker-must-not-appear\n');
    fs.writeFileSync(path.join(skillsDir, 'skills.json'), `${JSON.stringify({
      version: 1,
      skills: [{
        name: 'custom-branch-planner',
        title: 'Custom Branch Planner',
        description: 'Plan large work into aligned branch stacks.',
        trigger: 'Invoke when a large project needs collaborative decomposition.',
        entrypoint: 'SKILL.md',
        load: { type: 'resource', path: 'skills/custom-branch-planner/SKILL.md' },
        permission: 'guidance',
        requiresApproval: false,
        status: 'active',
        capabilities: ['planning'],
        tools: ['os.get_steering', 'os.call'],
      }],
    }, null, 2)}\n`);

    const { steering } = runOsSnippet<{ steering: string }>(home, `
      const { getSteering } = await import('./scripts/os.ts');
      process.stdout.write(JSON.stringify({ steering: getSteering() }));
    `);

    expect(steering).toContain('## Installed skills');
    expect(steering).toContain('"name": "custom-branch-planner"');
    expect(steering).toContain('Plan large work into aligned branch stacks.');
    expect(steering).toContain('Invoke when a large project needs collaborative decomposition.');
    expect(steering).not.toContain('body-only-marker-must-not-appear');
  });

  it('prefers the current selected-skill index over legacy or bundled catalogs', () => {
    const home = makeHome();
    const componentsDir = path.join(home, 'components');
    const legacySkillsDir = path.join(home, 'skills');
    fs.mkdirSync(componentsDir, { recursive: true });
    fs.mkdirSync(legacySkillsDir, { recursive: true });
    fs.writeFileSync(path.join(componentsDir, 'installed-skills.json'), `${JSON.stringify({
      schemaVersion: 1,
      kind: 'consuelo-installed-skill-index',
      sourceBundle: { bundleId: 'sha256:fixture', version: '0.0.0-test' },
      selected: [{
        id: 'selected-branch-planner',
        kind: 'skill',
        ownership: 'bundled-managed',
        sourcePath: 'skills/selected-branch-planner',
        contentHash: 'fixture',
        name: 'selected-branch-planner',
        title: 'Selected Branch Planner',
        description: 'Selected skill should be advertised.',
        trigger: 'Invoke for selected branch planning.',
        entrypoint: 'SKILL.md',
        load: { type: 'resource', path: 'skills/selected-branch-planner/SKILL.md' },
        permission: 'guidance',
        requiresApproval: false,
        status: 'active',
        capabilities: ['planning'],
        tools: ['os.get_steering', 'os.call'],
      }],
      legacyCustom: [],
    }, null, 2)}\n`);
    fs.writeFileSync(path.join(legacySkillsDir, 'skills.json'), `${JSON.stringify({
      version: 1,
      skills: [{
        name: 'legacy-fallback-must-not-appear',
        title: 'Legacy fallback',
        description: 'Legacy fallback must not be advertised when the current index exists.',
        trigger: 'Never.',
        entrypoint: 'SKILL.md',
        load: { type: 'resource', path: 'skills/legacy-fallback-must-not-appear/SKILL.md' },
        status: 'active',
      }],
    }, null, 2)}\n`);

    const { steering } = runOsSnippet<{ steering: string }>(home, `
      const { getSteering } = await import('./scripts/os.ts');
      process.stdout.write(JSON.stringify({ steering: getSteering() }));
    `);

    expect(steering).toContain('"name": "selected-branch-planner"');
    expect(steering).not.toContain('legacy-fallback-must-not-appear');
  });

  it('omits skills disabled by the manifest overlay', () => {
    const home = makeHome();
    const skillsDir = path.join(home, 'skills');
    const overridesDir = path.join(home, 'security', 'overrides');
    fs.mkdirSync(skillsDir, { recursive: true });
    fs.mkdirSync(overridesDir, { recursive: true });
    fs.writeFileSync(path.join(skillsDir, 'skills.json'), `${JSON.stringify({
      version: 1,
      skills: [
        {
          name: 'enabled-branch-planner',
          title: 'Enabled Branch Planner',
          description: 'Enabled skill should remain visible.',
          trigger: 'Invoke for enabled planning.',
          entrypoint: 'SKILL.md',
          load: { type: 'resource', path: 'skills/enabled-branch-planner/SKILL.md' },
          status: 'active',
        },
        {
          name: 'disabled-branch-planner',
          title: 'Disabled Branch Planner',
          description: 'Disabled skill must not be advertised.',
          trigger: 'Never advertise this disabled skill.',
          entrypoint: 'SKILL.md',
          load: { type: 'resource', path: 'skills/disabled-branch-planner/SKILL.md' },
          status: 'active',
        },
      ],
    }, null, 2)}\n`);
    fs.writeFileSync(path.join(overridesDir, 'manifest.overlay.json'), `${JSON.stringify({
      version: 1,
      disabledSkills: ['disabled-branch-planner'],
      disabledTools: [],
      disabledWorkflows: [],
      updatedAt: '2026-08-11T00:00:00.000Z',
    }, null, 2)}\n`);

    const { first, second } = runOsSnippet<{ first: string; second: string }>(home, `
      const fs = (await import('node:fs')).default;
      const { getSteering } = await import('./scripts/os.ts');
      const overlayPath = ${JSON.stringify(path.join(overridesDir, 'manifest.overlay.json'))};
      const first = getSteering();
      const overlay = JSON.parse(fs.readFileSync(overlayPath, 'utf8'));
      overlay.disabledSkills = [];
      overlay.updatedAt = '2026-08-11T00:01:00.000Z';
      fs.writeFileSync(overlayPath, JSON.stringify(overlay, null, 2) + '\\n');
      const second = getSteering();
      process.stdout.write(JSON.stringify({ first, second }));
    `);

    expect(first).toContain('"name": "enabled-branch-planner"');
    expect(first).not.toContain('disabled-branch-planner');
    expect(second).toContain('"name": "disabled-branch-planner"');
  });

  it('includes preserved custom skills from the current installed index', () => {
    const home = makeHome();
    const componentsDir = path.join(home, 'components');
    const customDir = path.join(home, 'skills', 'custom-local-planner');
    fs.mkdirSync(componentsDir, { recursive: true });
    fs.mkdirSync(customDir, { recursive: true });
    fs.writeFileSync(path.join(customDir, 'skill.json'), `${JSON.stringify({
      name: 'custom-local-planner',
      title: 'Custom Local Planner',
      description: 'User-owned custom planning skill.',
      trigger: 'Invoke for local custom planning.',
      entrypoint: 'SKILL.md',
      load: { type: 'resource', path: 'skills/custom-local-planner/SKILL.md' },
      permission: 'guidance',
      requiresApproval: false,
      status: 'active',
      capabilities: ['planning'],
    }, null, 2)}\n`);
    fs.writeFileSync(path.join(componentsDir, 'installed-skills.json'), `${JSON.stringify({
      schemaVersion: 1,
      kind: 'consuelo-installed-skill-index',
      sourceBundle: { bundleId: 'sha256:fixture', version: '0.0.0-test' },
      selected: [],
      legacyCustom: [{
        id: 'custom-local-planner',
        kind: 'skill',
        ownership: 'custom',
        legacyPath: 'skills/custom-local-planner',
        migrationRequired: true,
      }],
    }, null, 2)}\n`);

    const { steering } = runOsSnippet<{ steering: string }>(home, `
      const { getSteering } = await import('./scripts/os.ts');
      process.stdout.write(JSON.stringify({ steering: getSteering() }));
    `);

    expect(steering).toContain('"name": "custom-local-planner"');
    expect(steering).toContain('User-owned custom planning skill.');
    expect(steering).toContain('Invoke for local custom planning.');
  });

  it('loads supported local steering files while excluding decision and legacy steering', () => {
    const home = makeHome();
    const steeringDir = path.join(
      String(process.env.CONSUELO_USER_HOME),
      'Consuelo',
      'Steering',
    );
    fs.mkdirSync(steeringDir, { recursive: true });
    fs.writeFileSync(path.join(steeringDir, 'system_prompt.md'), '# Local system prompt\n\nlocal system body\n');
    fs.writeFileSync(path.join(steeringDir, 'decision.md'), '# Local decision\n\nlocal decision body\n');
    fs.writeFileSync(path.join(steeringDir, 'operator-notes.md'), '# Operator notes\n\noperator notes body\n');
    fs.writeFileSync(path.join(steeringDir, 'dialer-AGENTS.md'), '# Consuelo Dialer agent instructions\n\nunique dialer steering marker\n');
    fs.writeFileSync(path.join(steeringDir, 'steering.md'), '# Legacy steering\n\nlegacy body must be ignored\n');

    const { first, second } = runOsSnippet<{ first: string; second: string }>(home, `
      const fs = await import('node:fs');
      const path = await import('node:path');
      const { getSteering } = await import('./scripts/os.ts');
      const first = getSteering();
      fs.writeFileSync(path.join(process.env.CONSUELO_USER_HOME, 'Consuelo', 'Steering', 'system_prompt.md'), '# Local system prompt\\n\\nupdated system body\\n');
      const second = getSteering();
      process.stdout.write(JSON.stringify({ first, second }));
    `);

    expect(first).toContain('# system_prompt.md');
    expect(first).toContain('local system body');
    expect(first).toContain('# operator-notes.md');
    expect(first).toContain('operator notes body');
    expect(first).toContain('# dialer-AGENTS.md');
    expect(first.match(/unique dialer steering marker/g)).toHaveLength(1);
    expect(first).not.toContain('# decision.md');
    expect(first).not.toContain('local decision body');
    expect(first).not.toContain('legacy body must be ignored');
    expect(first.indexOf('# system_prompt.md')).toBeLessThan(first.indexOf('# operator-notes.md'));
    expect(second).toContain('updated system body');
    expect(second).not.toContain('local system body');
  });

  it('reuses an unchanged steering snapshot without rereading authoritative sources', () => {
    const home = makeHome();
    const userSteeringDir = path.join(
      String(process.env.CONSUELO_USER_HOME),
      'Consuelo',
      'Steering',
    );
    const skillsDir = path.join(home, 'skills');
    const overridesDir = path.join(home, 'security', 'overrides');
    fs.mkdirSync(userSteeringDir, { recursive: true });
    fs.mkdirSync(skillsDir, { recursive: true });
    fs.mkdirSync(overridesDir, { recursive: true });
    fs.writeFileSync(path.join(userSteeringDir, 'system_prompt.md'), '# Cached local steering\n\ncache-source-marker\n');
    fs.writeFileSync(path.join(skillsDir, 'skills.json'), `${JSON.stringify({
      version: 1,
      skills: [{
        name: 'cached-skill',
        title: 'Cached Skill',
        description: 'Skill catalog cache marker.',
        trigger: 'Invoke for cache tests.',
        entrypoint: 'SKILL.md',
        load: { type: 'resource', path: 'skills/cached-skill/SKILL.md' },
        status: 'active',
      }],
    }, null, 2)}\n`);
    fs.writeFileSync(path.join(overridesDir, 'manifest.overlay.json'), `${JSON.stringify({
      version: 1,
      disabledSkills: [],
      disabledTools: [],
      disabledWorkflows: [],
      updatedAt: '2026-08-11T00:00:00.000Z',
    }, null, 2)}\n`);

    const result = runOsSnippet<{ same: boolean; reads: string[] }>(home, `
      const fs = (await import('node:fs')).default;
      const path = await import('node:path');
      const { getSteering } = await import('./scripts/os.ts');
      const { getPackageRoot } = await import('./scripts/lib/manifest.ts');
      const first = getSteering();
      const packageRoot = getPackageRoot();
      const targets = new Set([
        path.resolve(packageRoot, 'steering', 'system_prompt.md'),
        path.resolve(process.env.CONSUELO_USER_HOME, 'Consuelo', 'Steering', 'system_prompt.md'),
        path.resolve(process.env.CONSUELO_HOME, 'skills', 'skills.json'),
        path.resolve(process.env.CONSUELO_HOME, 'security', 'overrides', 'manifest.overlay.json'),
        path.resolve(packageRoot, 'manifests', 'generated', 'core.manifest.json'),
      ]);
      const originalReadFileSync = fs.readFileSync;
      const reads = [];
      fs.readFileSync = function(filePath, ...args) {
        const resolved = path.resolve(String(filePath));
        if (targets.has(resolved)) reads.push(resolved);
        return originalReadFileSync.call(fs, filePath, ...args);
      };
      const second = getSteering();
      fs.readFileSync = originalReadFileSync;
      process.stdout.write(JSON.stringify({ same: first === second, reads }));
    `);

    expect(result.same).toBe(true);
    expect(result.reads).toEqual([]);
  });

  it('invalidates the snapshot when the selected skill index changes', () => {
    const home = makeHome();
    const componentsDir = path.join(home, 'components');
    fs.mkdirSync(componentsDir, { recursive: true });
    const installedPath = path.join(componentsDir, 'installed-skills.json');
    const writeIndex = (name: string, description: string) => {
      fs.writeFileSync(installedPath, `${JSON.stringify({
        schemaVersion: 1,
        kind: 'consuelo-installed-skill-index',
        sourceBundle: { bundleId: 'sha256:fixture', version: '0.0.0-test' },
        selected: [{
          id: name,
          kind: 'skill',
          ownership: 'bundled-managed',
          sourcePath: `skills/${name}`,
          contentHash: `fixture-${name}`,
          name,
          title: name,
          description,
          trigger: `Invoke ${name}.`,
          entrypoint: 'SKILL.md',
          load: { type: 'resource', path: `skills/${name}/SKILL.md` },
          status: 'active',
        }],
        legacyCustom: [],
      }, null, 2)}\n`);
    };
    writeIndex('selected-skill-v1', 'selected skill first revision');

    const result = runOsSnippet<{ first: string; second: string }>(home, `
      const fs = (await import('node:fs')).default;
      const { getSteering } = await import('./scripts/os.ts');
      const first = getSteering();
      const installedPath = ${JSON.stringify(installedPath)};
      const next = JSON.parse(fs.readFileSync(installedPath, 'utf8'));
      next.selected = [{
        ...next.selected[0],
        id: 'selected-skill-v2',
        name: 'selected-skill-v2',
        title: 'selected-skill-v2',
        sourcePath: 'skills/selected-skill-v2',
        contentHash: 'fixture-selected-skill-v2',
        description: 'selected skill second revision',
        trigger: 'Invoke selected-skill-v2.',
        load: { type: 'resource', path: 'skills/selected-skill-v2/SKILL.md' },
      }];
      fs.writeFileSync(installedPath, JSON.stringify(next, null, 2) + '\\n');
      const second = getSteering();
      process.stdout.write(JSON.stringify({ first, second }));
    `);

    expect(result.first).toContain('selected-skill-v1');
    expect(result.second).toContain('selected-skill-v2');
    expect(result.second).not.toContain('selected-skill-v1');
  });

  it('invalidates the snapshot when custom skill metadata changes', () => {
    const home = makeHome();
    const componentsDir = path.join(home, 'components');
    const customDir = path.join(home, 'skills', 'custom-cache-skill');
    fs.mkdirSync(componentsDir, { recursive: true });
    fs.mkdirSync(customDir, { recursive: true });
    const customMetadataPath = path.join(customDir, 'skill.json');
    fs.writeFileSync(customMetadataPath, `${JSON.stringify({
      name: 'custom-cache-skill',
      title: 'Custom Cache Skill',
      description: 'custom metadata revision one',
      trigger: 'Invoke custom cache skill.',
      entrypoint: 'SKILL.md',
      load: { type: 'resource', path: 'skills/custom-cache-skill/SKILL.md' },
      status: 'active',
    }, null, 2)}\n`);
    fs.writeFileSync(path.join(componentsDir, 'installed-skills.json'), `${JSON.stringify({
      schemaVersion: 1,
      kind: 'consuelo-installed-skill-index',
      sourceBundle: { bundleId: 'sha256:fixture', version: '0.0.0-test' },
      selected: [],
      legacyCustom: [{
        id: 'custom-cache-skill',
        kind: 'skill',
        ownership: 'custom',
        legacyPath: 'skills/custom-cache-skill',
        migrationRequired: true,
      }],
    }, null, 2)}\n`);

    const result = runOsSnippet<{ first: string; second: string }>(home, `
      const fs = (await import('node:fs')).default;
      const { getSteering } = await import('./scripts/os.ts');
      const first = getSteering();
      const customMetadataPath = ${JSON.stringify(customMetadataPath)};
      const next = JSON.parse(fs.readFileSync(customMetadataPath, 'utf8'));
      next.description = 'custom metadata revision two';
      fs.writeFileSync(customMetadataPath, JSON.stringify(next, null, 2) + '\\n');
      const second = getSteering();
      process.stdout.write(JSON.stringify({ first, second }));
    `);

    expect(result.first).toContain('custom metadata revision one');
    expect(result.second).toContain('custom metadata revision two');
    expect(result.second).not.toContain('custom metadata revision one');
  });

  it('forces an authoritative snapshot rebuild for refresh-steering', () => {
    const home = makeHome();
    const steeringDir = path.join(String(process.env.CONSUELO_USER_HOME), 'Consuelo', 'Steering');
    fs.mkdirSync(steeringDir, { recursive: true });
    fs.writeFileSync(path.join(steeringDir, 'system_prompt.md'), '# Refresh cache test\n\nrefresh-cache-marker\n');

    const result = runOsSnippet<{ same: boolean; reads: string[] }>(home, `
      const fs = (await import('node:fs')).default;
      const path = await import('node:path');
      const { executeRefreshSteering, getSteering } = await import('./scripts/os.ts');
      const first = getSteering();
      const target = path.resolve(process.env.CONSUELO_USER_HOME, 'Consuelo', 'Steering', 'system_prompt.md');
      const originalReadFileSync = fs.readFileSync;
      const reads = [];
      fs.readFileSync = function(filePath, ...args) {
        if (path.resolve(String(filePath)) === target) reads.push(target);
        return originalReadFileSync.call(fs, filePath, ...args);
      };
      const refreshed = executeRefreshSteering(
        'authoritative cache refresh required',
        undefined,
        { callerKey: 'cache-refresh-test', now: () => 4_000_000 },
      );
      fs.readFileSync = originalReadFileSync;
      process.stdout.write(JSON.stringify({ same: first === refreshed, reads }));
    `);

    expect(result.same).toBe(true);
    expect(result.reads.length).toBeGreaterThan(0);
  });

  it('keeps the bundled skills registry as the final steering fallback', () => {
    const home = makeHome();
    const { steering } = runOsSnippet<{ steering: string }>(home, `
      const { getSteering } = await import('./scripts/os.ts');
      process.stdout.write(JSON.stringify({ steering: getSteering() }));
    `);

    expect(steering).toContain('"source": "bundled"');
    expect(steering).toContain('"name": "branch"');
  });

  it('does not poison the cache when a snapshot build fails', () => {
    const home = makeHome();
    const steeringDir = path.join(String(process.env.CONSUELO_USER_HOME), 'Consuelo', 'Steering');
    const systemPromptPath = path.join(steeringDir, 'system_prompt.md');
    fs.mkdirSync(systemPromptPath, { recursive: true });

    const result = runOsSnippet<{ failed: boolean; second: string }>(home, `
      const fs = (await import('node:fs')).default;
      const { getSteering } = await import('./scripts/os.ts');
      const systemPromptPath = ${JSON.stringify(systemPromptPath)};
      let failed = false;
      try {
        getSteering();
      } catch {
        failed = true;
      }
      fs.rmdirSync(systemPromptPath);
      fs.writeFileSync(systemPromptPath, '# Recovered steering\\n\\nrecovered-steering-marker\\n');
      const second = getSteering();
      process.stdout.write(JSON.stringify({ failed, second }));
    `);

    expect(result.failed).toBe(true);
    expect(result.second).toContain('recovered-steering-marker');
  });

  it('isolates cached snapshots by runtime home and visible steering root', () => {
    const homeA = makeHome();
    const userHomeA = String(process.env.CONSUELO_USER_HOME);
    const homeB = fs.mkdtempSync(path.join(os.tmpdir(), 'consuelo-os-steering-'));
    const userHomeB = fs.mkdtempSync(path.join(os.tmpdir(), 'consuelo-os-steering-user-'));
    homes.push(homeB);
    userHomes.push(userHomeB);
    const steeringA = path.join(userHomeA, 'Consuelo', 'Steering');
    const steeringB = path.join(userHomeB, 'Consuelo', 'Steering');
    fs.mkdirSync(steeringA, { recursive: true });
    fs.mkdirSync(steeringB, { recursive: true });
    fs.writeFileSync(path.join(steeringA, 'system_prompt.md'), '# A\n\nworkspace-a-marker\n');
    fs.writeFileSync(path.join(steeringB, 'system_prompt.md'), '# B\n\nworkspace-b-marker\n');

    const result = runOsSnippet<{ first: string; second: string }>(homeA, `
      const { getSteering } = await import('./scripts/os.ts');
      process.env.CONSUELO_HOME = ${JSON.stringify(homeA)};
      process.env.CONSUELO_USER_HOME = ${JSON.stringify(userHomeA)};
      const first = getSteering();
      process.env.CONSUELO_HOME = ${JSON.stringify(homeB)};
      process.env.CONSUELO_USER_HOME = ${JSON.stringify(userHomeB)};
      const second = getSteering();
      process.stdout.write(JSON.stringify({ first, second }));
    `);

    expect(result.first).toContain('workspace-a-marker');
    expect(result.first).not.toContain('workspace-b-marker');
    expect(result.second).toContain('workspace-b-marker');
    expect(result.second).not.toContain('workspace-a-marker');
  });

  it('records get-steering with metadata and full steering body', () => {
    const home = makeHome();
    const { steering } = runOsSnippet<{ steering: string }>(home, `
      const { executeGetSteering } = await import('./scripts/os.ts');
      const steering = executeGetSteering(() => 'os steering payload '.repeat(40));
      process.stdout.write(JSON.stringify({ steering }));
    `);

    expect(steering).toContain('os steering payload');

    const row = readExecution(home);
    expect(row.name).toBe('get_steering');
    expect(row.status).toBe('succeeded');
    expect(JSON.parse(String(row.input_json))).toEqual({});
    const output = JSON.parse(String(row.output_json)) as { result: { chars: number; content: string } };
    expect(output.result.chars).toBe(40 * 'os steering payload '.length);
    expect(output.result).toMatchObject({ content: steering });
    expect(Number(row.duration_ms)).toBeGreaterThanOrEqual(0);
  });

  it('guards repeated get-steering calls and only builds steering once', () => {
    const home = makeHome();
    const result = runOsSnippet<{
      first: string;
      second: string;
      third: string;
      fourth: string;
      builds: number;
    }>(home, `
      const { executeGetSteering } = await import('./scripts/os.ts');
      let now = 1_000_000;
      let builds = 0;
      const buildSteering = () => {
        builds += 1;
        return 'os steering payload';
      };
      const options = { callerKey: 'agent-loop', now: () => now };
      const first = executeGetSteering(buildSteering, options);
      const second = executeGetSteering(buildSteering, options);
      const third = executeGetSteering(buildSteering, options);
      const fourth = executeGetSteering(buildSteering, options);
      process.stdout.write(JSON.stringify({ first, second, third, fourth, builds }));
    `);

    expect(result.first).toBe('os steering payload');
    expect(result.second).toContain('GET_STEERING_LOOP_GUARD');
    expect(result.second).toContain('~/Consuelo/Steering/*.md');
    expect(result.second).not.toContain('$CONSUELO_HOME/steering/decision.md');
    expect(result.third).toContain('GET_STEERING_RATE_LIMITED');
    expect(result.fourth).toContain('GET_STEERING_COOLDOWN');
    expect(result.builds).toBe(1);

    const rows = readExecutions(home);
    expect(rows.map((row) => JSON.parse(String(row.output_json)).result.decision)).toEqual([
      'full',
      'soft_guard',
      'hard_guard',
      'cooldown',
    ]);
  });

  it('rate limits explicit refresh-steering break-glass calls', () => {
    const home = makeHome();
    const result = runOsSnippet<{
      noReason: string;
      first: string;
      second: string;
      third: string;
      builds: number;
    }>(home, `
      const { executeRefreshSteering } = await import('./scripts/os.ts');
      let now = 2_000_000;
      let builds = 0;
      const buildSteering = () => {
        builds += 1;
        return 'forced steering ' + builds;
      };
      const options = { callerKey: 'agent-force', now: () => now };
      const noReason = executeRefreshSteering('', buildSteering, options);
      const first = executeRefreshSteering('fresh context required', buildSteering, options);
      const second = executeRefreshSteering('retrying', buildSteering, options);
      now += 301_000;
      const third = executeRefreshSteering('later context refresh', buildSteering, options);
      process.stdout.write(JSON.stringify({ noReason, first, second, third, builds }));
    `);

    expect(result.noReason).toContain('REFRESH_STEERING_REASON_REQUIRED');
    expect(result.first).toBe('forced steering 1');
    expect(result.second).toContain('REFRESH_STEERING_RATE_LIMITED');
    expect(result.third).toBe('forced steering 2');
    expect(result.builds).toBe(2);
  });
});
