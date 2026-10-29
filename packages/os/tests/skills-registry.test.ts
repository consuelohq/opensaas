import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { buildSkillsRegistry, generateSkillsRegistry } from '../scripts/generate-skills-registry';
import { provisionManagedComponentIndexes } from '../scripts/lib/managed-component-install';
import { readSteeringSkillCatalog } from '../scripts/lib/steering-skills';
import { getDefaultSelectedSkillNames } from '../scripts/lib/onboarding-skills';

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

const osRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const mediaSourceRoot = join(osRoot, 'skills', 'media');
const mediaRegistryPath = join(osRoot, 'skills', 'skills.json');
const mediaRequiredFiles = [
  'SKILL.md',
  'skill.json',
  'tooling.md',
  join('memes', 'SKILL.md'),
  join('memes', 'compose.py'),
  join('memes', 'examples', 'record-store.example.json'),
  join('memes', 'tests', 'test_compose.py'),
];

function installMediaFromBundle() {
  const home = join(fixtureRoot, 'runtime');
  const userRoot = join(fixtureRoot, 'user', 'Consuelo');
  mkdirSync(home, { recursive: true });
  const actions = provisionManagedComponentIndexes({
    home,
    userRoot,
    selectedSkills: ['media'],
    dryRun: false,
    generatedAt: '2026-10-28T22:35:00.000Z',
  });
  return { home, userRoot, actions };
}

describe('bundled OS Media / Memes skill', () => {
  it('registers Media as a first-class OS skill with a resolvable Memes subskill', () => {
    const registry = buildSkillsRegistry();
    expect(registry.skills.find((skill) => skill.name === 'media')).toMatchObject({
      name: 'media',
      title: 'Media',
      entrypoint: 'SKILL.md',
      load: { type: 'resource', path: 'skills/media/SKILL.md' },
      permission: 'guidance',
      requiresApproval: false,
      status: 'active',
      subskills: ['memes'],
      tools: ['os.get_steering', 'os.call'],
    });
    for (const relativePath of mediaRequiredFiles) {
      expect(existsSync(join(mediaSourceRoot, relativePath)), relativePath).toBe(true);
    }
    const persisted = JSON.parse(readFileSync(mediaRegistryPath, 'utf8')) as {
      skills: Array<{ name: string; subskills?: string[]; load?: { path?: string } }>;
    };
    expect(persisted.skills).toEqual(registry.skills);
    expect(persisted.skills.find((skill) => skill.name === 'media')).toMatchObject({
      subskills: ['memes'],
      load: { path: 'skills/media/SKILL.md' },
    });
    expect(getDefaultSelectedSkillNames()).toContain('media');
  });

  it('installs the full nested Media/Memes tree and exposes portable steering metadata', () => {
    const { home, userRoot, actions } = installMediaFromBundle();
    const installed = join(userRoot, 'Skills', 'media');
    for (const relativePath of mediaRequiredFiles) {
      expect(existsSync(join(installed, relativePath)), relativePath).toBe(true);
      // The installer canonically rewrites only skill.json's load.path.
      if (relativePath !== 'skill.json') {
        expect(readFileSync(join(installed, relativePath))).toEqual(
          readFileSync(join(mediaSourceRoot, relativePath))
        );
      }
    }
    const installedMeta = JSON.parse(readFileSync(join(installed, 'skill.json'), 'utf8'));
    expect(installedMeta.load.path).toBe('skills/media/SKILL.md');
    const index = JSON.parse(readFileSync(join(home, 'components', 'installed-skills.json'), 'utf8'));
    expect(index.selected).toEqual([expect.objectContaining({
      id: 'media',
      kind: 'skill',
      ownership: 'bundled-managed',
      subskills: ['memes'],
    })]);
    const steering = readSteeringSkillCatalog({ home, packageRoot: osRoot });
    expect(steering.source).toBe('installed-selected');
    expect(steering.skills.find((skill) => skill.name === 'media')).toMatchObject({
      subskills: ['memes'],
      load: { path: 'skills/media/SKILL.md' },
    });
    expect(actions.some((action) => action.type === 'seed_skill'
      && action.path === installed
      && action.status === 'created')).toBe(true);
  });

  it('preserves a pre-existing user-owned Media skill rather than overwriting it', () => {
    const installed = join(fixtureRoot, 'user', 'Consuelo', 'Skills', 'media');
    mkdirSync(installed, { recursive: true });
    writeFileSync(join(installed, 'SKILL.md'), '# User-owned Media\n');
    writeFileSync(join(installed, 'skill.json'), JSON.stringify({
      name: 'media', title: 'Local Media', entrypoint: 'SKILL.md',
    }) + '\n');
    installMediaFromBundle();
    expect(readFileSync(join(installed, 'SKILL.md'), 'utf8')).toBe('# User-owned Media\n');
    expect(JSON.parse(readFileSync(join(installed, 'skill.json'), 'utf8')).title).toBe('Local Media');
  });
});
