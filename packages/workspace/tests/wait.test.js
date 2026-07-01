import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { WaitInput } from '../scripts/lib/facade/schemas';

describe('wait tool schema', () => {
  it('preserves detached long-wait inputs for non-blocking sleeps', () => {
    const parsed = WaitInput.safeParse({
      duration: '24h',
      detached: true,
      reason: 'sleep until Ko asks me to wake up',
    });

    expect(parsed.success).toBe(true);
    expect(parsed.data).toMatchObject({
      duration: '24h',
      detached: true,
      reason: 'sleep until Ko asks me to wake up',
    });
  });
});

describe('wait detached jobs', () => {
  function runWait(args, waitHome) {
    return execFileSync('bun', ['scripts/wait.js', ...args], {
      cwd: process.cwd(),
      env: { ...process.env, WORKSPACE_WAIT_HOME: waitHome },
      encoding: 'utf8',
    });
  }

  it('creates a 24h detached wait and reports pending/complete status without blocking', () => {
    const waitHome = mkdtempSync(join(tmpdir(), 'workspace-wait-'));
    try {
      mkdirSync(waitHome, { recursive: true });
      const createOutput = runWait([
        '--detach',
        '--duration',
        '24h',
        '--reason',
        'external job can run overnight',
      ], waitHome);
      const created = JSON.parse(createOutput);

      expect(created.ok).toBe(true);
      expect(created.wait.status).toBe('pending');
      expect(created.wait.durationSeconds).toBe(86400);
      expect(created.wait.reason).toBe('external job can run overnight');
      expect(created.wait.remainingSeconds).toBeGreaterThan(86000);

      const pending = JSON.parse(runWait(['--status', created.wait.id], waitHome));
      expect(pending.status).toBe('pending');
      expect(pending.ok).toBe(true);

      const jobPath = join(waitHome, `${created.wait.id}.json`);
      const job = JSON.parse(readFileSync(jobPath, 'utf8'));
      job.wakeAt = new Date(Date.now() - 1000).toISOString();
      writeFileSync(jobPath, `${JSON.stringify(job, null, 2)}\n`);

      const complete = JSON.parse(runWait(['--status', created.wait.id], waitHome));
      expect(complete.status).toBe('complete');
      expect(complete.remainingSeconds).toBe(0);
      expect(complete.message).toBe('wait is complete');
    } finally {
      rmSync(waitHome, { recursive: true, force: true });
    }
  });
});
