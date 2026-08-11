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
  for (const home of homes.splice(0)) fs.rmSync(home, { recursive: true, force: true });
  for (const home of userHomes.splice(0)) fs.rmSync(home, { recursive: true, force: true });
});

describe('OS steering execution recording', () => {
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

    const { steering } = runOsSnippet<{ steering: string }>(home, `
      const { getSteering } = await import('./scripts/os.ts');
      process.stdout.write(JSON.stringify({ steering: getSteering() }));
    `);

    expect(steering).toContain('"name": "enabled-branch-planner"');
    expect(steering).not.toContain('disabled-branch-planner');
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
