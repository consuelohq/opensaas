import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { buildSkillsRegistry } from '../scripts/generate-skills-registry';

const repoRoot = join(import.meta.dirname, '..', '..', '..');

function read(relativePath: string): string {
  return readFileSync(join(repoRoot, relativePath), 'utf8');
}

describe('OS senior engineer skill', () => {
  it('tracks the current Workspace engineering guidance with memory tool references', () => {
    const workspaceSource = read('packages/workspace/senior-engineer.md');
    const workspaceFixture = read('packages/os/tests/fixtures/skills/senior-engineer-workspace.SKILL.md');
    const osSkill = read('packages/os/skills/senior-engineer/SKILL.md');

    expect(workspaceFixture).toBe(workspaceSource);
    expect(osSkill).toContain('`memory` with `operation: "search"`');
    expect(osSkill).not.toMatch(/\b(?:context|memory)\.(search|find|get|list|save|categories|trace)\b/);
  });

  it('does not publish pseudo memory subtools in active OS skills', () => {
    const registry = buildSkillsRegistry();
    for (const skill of registry.skills) {
      const body = read(skill.load.path);
      expect(body, skill.name).not.toMatch(/\bmemory\.(search|find|get|list|save|categories|trace)\b/);
    }
  });

  it('is included in the generated skills registry from skill.json metadata', () => {
    const registry = buildSkillsRegistry();
    const skill = registry.skills.find((entry) => entry.name === 'senior-engineer');

    expect(skill).toMatchObject({
      name: 'senior-engineer',
      title: 'Senior Engineer',
      entrypoint: 'SKILL.md',
      status: 'active',
      load: { path: 'packages/os/skills/senior-engineer/SKILL.md' },
    });
  });
});
