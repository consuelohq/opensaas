import { describe, expect, it } from 'vitest';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { executeTool } from '../scripts/lib/facade/executor';
import type {
  CommandPlan,
  ToolRunner,
} from '../scripts/lib/facade/types';

const TEST_UUID = 'abc123def4567890abc123def4567890';
const RUNTIME_PACKAGE_ROOT = dirname(
  fileURLToPath(new URL('../package.json', import.meta.url)),
);

const successfulRunner = (plans: CommandPlan[]): ToolRunner =>
  async (plan) => {
    plans.push(plan);
    return {
      stdout: JSON.stringify({ value: 'ok' }),
      stderr: '',
      exitCode: 0,
    };
  };

const options = (plans: CommandPlan[]) => ({
  cwd: '/tmp/not-a-repo',
  runner: successfulRunner(plans),
  now: () => 1000,
  randomUUID: () => TEST_UUID,
});

describe('lifecycle facade', () => {
  it('routes status through the canonical lifecycle CLI', async () => {
    const plans: CommandPlan[] = [];
    const result = await executeTool('lifecycle.status', {}, options(plans));

    expect(result.ok).toBe(true);
    expect(result.code).toBe('OK');
    expect(plans).toHaveLength(1);
    expect(plans[0]).toMatchObject({
      command: 'bun',
      args: ['run', 'lifecycle', '--', 'status', '--json'],
      cwd: RUNTIME_PACKAGE_ROOT,
    });
  });

  it('routes update and its release channel through the same lifecycle CLI', async () => {
    const plans: CommandPlan[] = [];
    const result = await executeTool(
      'lifecycle.update',
      { channel: 'canary' },
      options(plans),
    );

    expect(result.ok).toBe(true);
    expect(result.code).toBe('OK');
    expect(plans).toHaveLength(1);
    expect(plans[0]).toMatchObject({
      command: 'bun',
      args: [
        'run',
        'lifecycle',
        '--',
        'update',
        '--channel',
        'canary',
        '--json',
      ],
      cwd: RUNTIME_PACKAGE_ROOT,
    });
  });

  it('can require the exact immutable release version during update', async () => {
    const plans: CommandPlan[] = [];
    const result = await executeTool(
      'lifecycle.update',
      { channel: 'canary', version: '1.2.3' },
      options(plans),
    );

    expect(result.ok).toBe(true);
    expect(plans[0]).toMatchObject({
      command: 'bun',
      args: [
        'run',
        'lifecycle',
        '--',
        'update',
        '--channel',
        'canary',
        '--version',
        '1.2.3',
        '--json',
      ],
      cwd: RUNTIME_PACKAGE_ROOT,
    });
  });

  it('rejects an invalid release channel before running a command', async () => {
    const plans: CommandPlan[] = [];
    const result = await executeTool(
      'lifecycle.update',
      { channel: 'made-up' },
      options(plans),
    );

    expect(result.ok).toBe(false);
    expect(result.code).toBe('VALIDATION_ERROR');
    expect(plans).toHaveLength(0);
  });

  it('uses synthetic dry-run for update instead of invoking the updater', async () => {
    const plans: CommandPlan[] = [];
    const result = await executeTool(
      'lifecycle.update',
      { channel: 'canary', dryRun: true },
      options(plans),
    );

    expect(result.ok).toBe(true);
    expect(result.code).toBe('DRY_RUN');
    expect(plans).toHaveLength(0);
  });
});
