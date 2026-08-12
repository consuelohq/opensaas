import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { buildSkillsRegistry, generateSkillsRegistry } from '../scripts/generate-skills-registry';

let fixtureRoot: string;

beforeEach(() => {
  fixtureRoot = mkdtempSync(join(tmpdir(), 'consuelo-os-skills-registry-'));
});

afterEach(() => {
  rmSync(fixtureRoot, { recursive: true, force: true });
});

function writeSkill(name: string, metadata: Record<string, unknown>, entrypointContent = '---\nname: fixture\n---\n# Fixture\n'): void {
  const skillDir = join(fixtureRoot, name);
  mkdirSync(skillDir, { recursive: true });
  const entrypoint = typeof metadata.entrypoint === 'string' ? metadata.entrypoint : 'SKILL.md';
  writeFileSync(join(skillDir, entrypoint), entrypointContent);
  writeFileSync(join(skillDir, 'skill.json'), `${JSON.stringify(metadata, null, 2)}\n`);
}

function validSkill(name: string, overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    name,
    title: name,
    description: `${name} description`,
    trigger: `Invoke ${name}`,
    entrypoint: 'SKILL.md',
    load: {
      type: 'resource',
      path: 'SKILL.md',
    },
    permission: 'guidance',
    requiresApproval: false,
    status: 'active',
    capabilities: ['test'],
    tools: ['workspace.call'],
    subskills: [{ name: `${name}-sub`, title: 'Subskill' }],
    ...overrides,
  };
}

describe('skills registry generator', () => {
  it('includes the active task and OS skills', () => {
    const registry = buildSkillsRegistry();
    const names = registry.skills.map((skill) => skill.name);

    expect(names).toContain('branch');
    expect(names).toContain('task');
    expect(names).toContain('artifacts');
    expect(names).toContain('senior-engineer');
  });

  it('uses the canonical public titles for Branch and Task', () => {
    const registry = buildSkillsRegistry();
    expect(registry.skills.find((skill) => skill.name === 'branch')?.title).toBe('Branch');
    expect(registry.skills.find((skill) => skill.name === 'task')?.title).toBe('Task');
  });

  it('sorts skills by name', () => {
    writeSkill('zulu', validSkill('zulu'));
    writeSkill('alpha', validSkill('alpha'));

    const registry = buildSkillsRegistry({ skillsRoot: fixtureRoot });

    expect(registry.skills.map((skill) => skill.name)).toEqual(['alpha', 'zulu']);
  });

  it('does not inline markdown bodies', () => {
    writeSkill('task', validSkill('task'), '---\nname: task\n---\n# Task\nLong markdown body');

    const registry = buildSkillsRegistry({ skillsRoot: fixtureRoot });

    expect(JSON.stringify(registry)).not.toContain('Long markdown body');
    expect(registry.skills[0]).toMatchObject({ entrypoint: 'SKILL.md' });
  });

  it('writes skills.json with compact metadata', () => {
    writeSkill('task', validSkill('task', { script: 'scripts/task.ts', artifactTypes: ['report'] }));
    const outputPath = join(fixtureRoot, 'skills.json');

    generateSkillsRegistry({ skillsRoot: fixtureRoot, outputPath });
    const registry = JSON.parse(readFileSync(outputPath, 'utf8')) as { version: number; skills: Array<Record<string, unknown>> };

    expect(registry.version).toBe(1);
    expect(registry.skills[0].name).toBe('task');
    expect(registry.skills[0].script).toBeUndefined();
    expect(registry.skills[0].artifactTypes).toBeUndefined();
    expect(registry.skills[0].load).toEqual({
      type: 'resource',
      path: 'skills/task/SKILL.md',
    });
  });

  it('fails on missing required fields', () => {
    writeSkill('broken', validSkill('broken', { trigger: undefined }));

    expect(() => buildSkillsRegistry({ skillsRoot: fixtureRoot })).toThrow('missing required field trigger');
  });

  it('fails on missing entrypoint', () => {
    const skillDir = join(fixtureRoot, 'broken');
    mkdirSync(skillDir, { recursive: true });
    writeFileSync(join(skillDir, 'skill.json'), `${JSON.stringify(validSkill('broken'), null, 2)}\n`);

    expect(() => buildSkillsRegistry({ skillsRoot: fixtureRoot })).toThrow('entrypoint does not exist');
  });

  it('fails on missing load path', () => {
    writeSkill('broken', validSkill('broken', { load: { type: 'resource', path: 'missing.md' } }));

    expect(() => buildSkillsRegistry({ skillsRoot: fixtureRoot })).toThrow('load.path does not exist');
  });

  it('bundles Sites as the active top-level local surface skill', () => {
    const bundledRegistry = JSON.parse(readFileSync(join(process.cwd(), 'skills', 'skills.json'), 'utf8')) as {
      skills: Array<{
        name: string;
        title: string;
        status: string;
        load?: { path?: string };
        capabilities?: string[];
      }>;
    };
    const skillNames = bundledRegistry.skills.map((skill) => skill.name);
    const sitesSkill = bundledRegistry.skills.find((skill) => skill.name === 'sites');

    expect(skillNames).toContain('sites');
    expect(sitesSkill).toMatchObject({
      name: 'sites',
      title: 'Sites',
      status: 'active',
      load: { path: 'skills/sites/SKILL.md' },
    });
    expect(sitesSkill?.capabilities).toEqual([
      'sites',
      'artifact-delivery',
      'local-pages',
      'edge-snapshots',
    ]);
  });
});
