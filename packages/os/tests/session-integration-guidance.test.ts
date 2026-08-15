import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), 'utf8');

describe('session integration guidance', () => {
  it('teaches session.start(kind=task) as canonical while retaining task.start compatibility', () => {
    const taskSkill = read('packages/os/skills/task/SKILL.md');
    const seniorEngineer = read('packages/workspace/senior-engineer.md');
    const steering = read('packages/os/steering/system_prompt.md');

    for (const source of [taskSkill, seniorEngineer, steering]) {
      expect(source).toContain('session.start');
      expect(source).toContain('kind');
      expect(source).toContain('task.start');
    }
    expect(taskSkill).toContain('compatibility alias');
    expect(seniorEngineer).toContain('compatibility alias');
  });


});
