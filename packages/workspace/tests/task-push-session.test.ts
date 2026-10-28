import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const taskPushScript = fileURLToPath(new URL('../scripts/task-push.js', import.meta.url));

describe('task push task-session routing', () => {
  it('accepts the facade-provided task-session flag', () => {
    const result = spawnSync('bun', [
      taskPushScript,
      '--task-session',
      'tsk_e398fbe000ba',
      '--help',
    ], {
      encoding: 'utf8',
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('usage: bun run task:push');
    expect(result.stderr).not.toContain('unknown flag: --task-session');
  });
});
