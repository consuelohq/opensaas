import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { runLifecycleCli } from '../scripts/lifecycle';
import { provisionLocalOs } from '../scripts/lib/install-state';
import { readManagedComponentState } from '../scripts/lib/managed-components';
import { readSteeringSkillCatalog } from '../scripts/lib/steering-skills';

let home: string;
let userHome: string;
let visibleUserRoot: string;

beforeEach(() => {
  home = mkdtempSync(join(tmpdir(), 'consuelo-skill-cli-home-'));
  userHome = mkdtempSync(join(tmpdir(), 'consuelo-skill-cli-user-'));
  visibleUserRoot = join(userHome, 'Consuelo');
});

afterEach(() => {
  rmSync(home, { recursive: true, force: true });
  rmSync(userHome, { recursive: true, force: true });
});

function provision(selectedSkills: string[]): void {
  provisionLocalOs({
    home,
    userHome,
    mode: 'local',
    selectedSkills,
  });
}

function selectedConfigSkills(): string[] {
  return JSON.parse(readFileSync(join(home, 'config.json'), 'utf8')).selectedSkills;
}

function indexedSkills(): string[] {
  const index = JSON.parse(
    readFileSync(join(home, 'components', 'installed-skills.json'), 'utf8'),
  ) as { selected: Array<{ id: string }> };
  return index.selected.map((skill) => skill.id);
}

function installedSkillIndex(): {
  selected: Array<{ id: string; load?: { type?: string; path?: string } }>;
} {
  return JSON.parse(
    readFileSync(join(home, 'components', 'installed-skills.json'), 'utf8'),
  );
}

async function runSkillCommand(
  args: string[],
  overrides: Record<string, unknown> = {},
): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  const stdout: string[] = [];
  const stderr: string[] = [];
  const exitCode = await runLifecycleCli([...args, '--home', home], {
    visibleUserRoot,
    stdout: (value) => stdout.push(value),
    stderr: (value) => stderr.push(value),
    ...overrides,
  } as never);
  return { exitCode, stdout: stdout.join(''), stderr: stderr.join('') };
}

describe('consuelo skill selection CLI', () => {
  it('adds branch through config, managed index, visible Skills, and steering discovery', async () => {
    provision([]);

    const result = await runSkillCommand(['add', 'skill', 'branch']);

    expect(result.exitCode).toBe(0);
    expect(selectedConfigSkills()).toContain('branch');
    expect(indexedSkills()).toContain('branch');
    expect(existsSync(join(visibleUserRoot, 'Skills', 'branch', 'SKILL.md'))).toBe(true);
    expect(
      installedSkillIndex().selected.find((skill) => skill.id === 'branch')?.load,
    ).toEqual({ type: 'resource', path: 'skills/branch/SKILL.md' });
    expect(
      JSON.parse(
        readFileSync(
          join(visibleUserRoot, 'Skills', 'branch', 'skill.json'),
          'utf8',
        ),
      ).load,
    ).toEqual({ type: 'resource', path: 'skills/branch/SKILL.md' });
    const visibleCatalog = JSON.parse(
      readFileSync(join(visibleUserRoot, 'Skills', 'skills.json'), 'utf8'),
    ) as { skills: Array<{ name: string; load?: { type?: string; path?: string } }> };
    expect(
      visibleCatalog.skills.find((skill) => skill.name === 'branch')?.load,
    ).toEqual({ type: 'resource', path: 'skills/branch/SKILL.md' });

    const catalog = readSteeringSkillCatalog({
      home,
      packageRoot: resolve(import.meta.dirname, '..'),
    });
    expect(catalog.source).toBe('installed-selected');
    expect(catalog.skills.map((skill) => skill.name)).toContain('branch');
  });

  it('removes a clean bundled skill from config, managed index, visible Skills, and steering discovery', async () => {
    provision(['branch']);

    const result = await runSkillCommand(['remove', 'skill', 'branch']);

    expect(result.exitCode).toBe(0);
    expect(selectedConfigSkills()).not.toContain('branch');
    expect(indexedSkills()).not.toContain('branch');
    expect(existsSync(join(visibleUserRoot, 'Skills', 'branch'))).toBe(false);

    const catalog = readSteeringSkillCatalog({
      home,
      packageRoot: resolve(import.meta.dirname, '..'),
    });
    expect(catalog.skills.map((skill) => skill.name)).not.toContain('branch');
  });

  it('deselects but preserves a locally modified bundled skill for explicit review', async () => {
    provision(['branch']);
    const instructions = join(visibleUserRoot, 'Skills', 'branch', 'SKILL.md');
    writeFileSync(
      instructions,
      `${readFileSync(instructions, 'utf8')}\nLocal customization.\n`,
    );

    const result = await runSkillCommand(['remove', 'skill', 'branch']);

    expect(result.exitCode).toBe(0);
    expect(selectedConfigSkills()).not.toContain('branch');
    expect(indexedSkills()).not.toContain('branch');
    expect(existsSync(instructions)).toBe(true);
    expect(
      readManagedComponentState(home).plan.items.find(
        (item) => item.kind === 'skill' && item.id === 'branch',
      ),
    ).toMatchObject({ action: 'remove-upstream', requiresReview: true });
  });

  it('interactive add offers only unselected bundled skills and uses skill names as labels', async () => {
    provision(['task']);
    let candidates: string[] = [];

    const result = await runSkillCommand(['add', 'skill'], {
      selectSkills: async (input: { candidates: string[] }) => {
        candidates = input.candidates;
        return ['branch'];
      },
    });

    expect(result.exitCode).toBe(0);
    expect(candidates).toContain('branch');
    expect(candidates).not.toContain('task');
    expect(selectedConfigSkills()).toEqual(expect.arrayContaining(['task', 'branch']));
  });

  it('interactive remove offers only selected bundled skills', async () => {
    provision(['task', 'branch']);
    let candidates: string[] = [];

    const result = await runSkillCommand(['remove', 'skill'], {
      selectSkills: async (input: { candidates: string[] }) => {
        candidates = input.candidates;
        return ['branch'];
      },
    });

    expect(result.exitCode).toBe(0);
    expect(candidates.sort()).toEqual(['branch', 'task']);
    expect(selectedConfigSkills()).toEqual(['task']);
  });
});
