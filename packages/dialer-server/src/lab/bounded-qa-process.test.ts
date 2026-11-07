import { expect, it } from 'bun:test';
import { runBoundedQaProcess } from './bounded-qa-process';
it('retains a normally completed child result and cancels its deadline', async () => {
  const r = await runBoundedQaProcess(
    [
      process.execPath,
      '--no-env-file',
      '-e',
      "process.stdout.write('proof');process.stderr.write('diagnostic');process.exit(3)",
    ],
    {},
    1000,
  );
  expect(r).toEqual({
    stdout: 'proof',
    stderr: 'diagnostic',
    exitCode: 3,
    timedOut: false,
    recoveredPostgres: 0,
  });
});
it('kills a blocked child within a bounded deadline, retaining its partial evidence', async () => {
  const start = performance.now();
  const r = await runBoundedQaProcess(
    [
      process.execPath,
      '--no-env-file',
      '-e',
      "process.stdout.write('started');setInterval(()=>{},1000)",
    ],
    {},
    500,
  );
  expect(r.timedOut).toBe(true);
  expect(r.exitCode).toBe(124);
  expect(r.stdout).toBe('started');
  expect(performance.now() - start).toBeLessThan(5000);
});
