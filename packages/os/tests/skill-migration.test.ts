import { existsSync, readFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

type Replacement = {
  from: string;
  to: string;
};
const root = dirname(dirname(fileURLToPath(import.meta.url)));
const fixturesRoot = join(root, 'tests', 'fixtures', 'skills');

function applyReplacements(source: string, replacements: Replacement[]): string {
  return replacements.reduce(
    (current, replacement) => current.split(replacement.from).join(replacement.to),
    source,
  );
}

const migrationCases = [
  'task',
  'senior-engineer',
  'research-ingest',
  'browser',
  'handoff',
  'skill-creator',
  'debugger',
  'teach',
];

describe('skill migration guardrails', () => {
  for (const skillName of migrationCases) {
    it(`keeps the OS ${skillName} skill identical except for approved replacements`, () => {
      const workspaceSkillPath = join(fixturesRoot, `${skillName}-workspace.SKILL.md`);
      const replacementsPath = join(fixturesRoot, `${skillName}-os-replacements.json`);
      const osSkillPath = join(root, 'skills', skillName, 'SKILL.md');

      expect(existsSync(workspaceSkillPath), `${basename(workspaceSkillPath)} is missing`).toBe(true);
      expect(existsSync(replacementsPath), `${basename(replacementsPath)} is missing`).toBe(true);
      expect(existsSync(osSkillPath), `${skillName}/SKILL.md is missing`).toBe(true);

      const source = readFileSync(workspaceSkillPath, 'utf8');
      expect(source).not.toContain('REPLACE WITH');
      expect(source).not.toContain('PLACEHOLDER:');

      const replacements = JSON.parse(readFileSync(replacementsPath, 'utf8')) as Replacement[];
      const expected = applyReplacements(source, replacements);
      const actual = readFileSync(osSkillPath, 'utf8');

      expect(actual).toBe(expected);
    });
  }
});
