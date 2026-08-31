import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const read = (path: string) => readFileSync(join(root, path), 'utf8');

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
});
