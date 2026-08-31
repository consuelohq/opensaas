import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const read = (path: string) => readFileSync(join(root, path), 'utf8');
const codeCallExampleContaining = (guidance: string, needle: string) => {
  const examples = guidance
    .split('await os.call({')
    .slice(1)
    .map((example) => `await os.call({${example}`);
  const example = examples.find((candidate) => candidate.includes(needle));

  if (!example) {
    throw new Error(`No code.call example contains ${JSON.stringify(needle)}`);
  }

  return example;
};

describe('session integration guidance', () => {
  it('teaches session.start(kind=task) as canonical while retaining task.start compatibility', () => {
    const taskSkill = read('packages/os/skills/task/SKILL.md');
    const seniorEngineer = read('packages/workspace/senior-engineer.md');
    const steering = read('packages/os/steering/system_prompt.md');

    const canonicalTaskStart = 'session.start({ kind: "task" })';
    const compatibilityAlias = '`task.start` remains a compatibility alias';
    expect(taskSkill).toContain(canonicalTaskStart);
    expect(taskSkill).toContain(compatibilityAlias);
    expect(seniorEngineer).toContain(canonicalTaskStart);
    expect(seniorEngineer).toContain(compatibilityAlias);
    expect(steering).toContain('call `session.start({ kind: "task" })` directly');
    expect(steering).toContain('`task.start` is a compatibility alias');
    expect(taskSkill).toContain('session.start({ kind: "work", path })');
    expect(taskSkill).toContain('must never be used to edit the managed default repository or a registered task worktree');
  });

  it('uses a shell language for literal package commands', () => {
    const taskSkill = read('packages/os/skills/task/SKILL.md');
    const literalPackageCommand = 'code: \"bun --cwd packages/workspace test\"';
    const example = codeCallExampleContaining(taskSkill, literalPackageCommand);

    expect(example).toContain('language: \"bash\"');
    expect(example).not.toContain('language: \"bun\"');
  });

  it('expresses OS call timeouts in milliseconds', () => {
    const taskSkill = read('packages/os/skills/task/SKILL.md');
    const streamListExample = codeCallExampleContaining(taskSkill, 'tool: \"stream.list\"');
    const focusedRedExample = codeCallExampleContaining(taskSkill, 'phase: \"red\"');

    expect(streamListExample).toContain('timeout: 120_000,');
    expect(streamListExample).not.toMatch(/^\s*timeout: \d{1,3},$/m);
    expect(focusedRedExample).toContain('timeout: 600_000,');
    expect(focusedRedExample).not.toMatch(/^\s*timeout: \d{1,3},$/m);
  });

  it('keeps validation wrappers nonzero when spawned processes exit by signal', () => {
    const guidanceCopies = [
      read('packages/os/skills/task/SKILL.md'),
      read('packages/workspace/task.md'),
      read('packages/os/tests/fixtures/skills/task-workspace.SKILL.md'),
    ];

    for (const guidance of guidanceCopies) {
      expect(guidance).not.toContain('process.exit(proc.exitCode)');
      expect(guidance).toContain('process.exit(proc.exitCode ?? 1)');
    }
  });
});
