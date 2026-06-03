import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

type Replacement = {
  from: string;
  to: string;
};

const root = process.cwd();
const workspaceTaskSkillPath = join(root, 'tests', 'fixtures', 'skills', 'task-workspace.SKILL.md');
const replacementsPath = join(root, 'tests', 'fixtures', 'skills', 'task-os-replacements.json');
const osTaskSkillPath = join(root, 'skills', 'task', 'SKILL.md');

function applyReplacements(source: string, replacements: Replacement[]): string {
  return replacements.reduce((current, replacement) => current.split(replacement.from).join(replacement.to), source);
}

describe('skill migration guardrails', () => {
  it('keeps the OS task skill identical except for approved workspace-to-os replacements', () => {
    const source = readFileSync(workspaceTaskSkillPath, 'utf8');
    expect(source).not.toContain('PLACEHOLDER:');

    const replacements = JSON.parse(readFileSync(replacementsPath, 'utf8')) as Replacement[];
    const expected = applyReplacements(source, replacements);
    const actual = readFileSync(osTaskSkillPath, 'utf8');

    expect(actual).toBe(expected);
  });
});
