import { expect, it } from 'bun:test';
import { resolve } from 'node:path';
import { runBoundedQaProcess } from './bounded-qa-process';
it('does not claim an unapplied component seed, and keeps seeded schedules in the service-backed lane', async () => {
  const script = resolve(import.meta.dir, '../../scripts/launch-scenarios.ts');
  const env = { PATH: process.env.PATH! };
  const rejected = await runBoundedQaProcess(
    [
      process.execPath,
      '--no-env-file',
      script,
      'run',
      'S01',
      '--seed',
      '42',
      '--dry-run',
    ],
    env,
    5000,
  );
  expect(rejected.exitCode).not.toBe(0);
  expect(rejected.stderr).toContain(
    'Component tests use their own fixed fixtures',
  );
  const dry = await runBoundedQaProcess(
    [process.execPath, '--no-env-file', script, 'run', 'S01', '--dry-run'],
    env,
    5000,
  );
  expect(dry.exitCode).toBe(0);
  expect(dry.stdout).toContain('--no-env-file test');
  expect(dry.stdout).not.toContain('seed=');
});
