import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { Effect } from 'effect';
import { describe, expect, it } from 'vitest';

import { runRuntimeEffect } from '../scripts/lib/code-call/process';

describe('code.call process regressions', () => {
  it('handles stdin pipe closure when the child exits before consuming input', async () => {
    const root = mkdtempSync(join(tmpdir(), 'consuelo-code-call-process-'));
    try {
      const result = await Effect.runPromise(
        runRuntimeEffect(process.execPath, ['-e', 'process.exit(0)'], {
          cwd: root,
          env: process.env,
          stdin: 'x'.repeat(8 * 1024 * 1024),
          timeoutMs: 5_000,
        }),
      );

      expect(result.exitCode).toBe(0);
      expect(result.timedOut).toBe(false);
      expect(result.runtimeMissing).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
