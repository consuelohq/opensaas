import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

let tempHome: string;

beforeEach(() => {
  tempHome = mkdtempSync(join(tmpdir(), 'consuelo-os-runtime-state-'));
});

afterEach(() => {
  rmSync(tempHome, { recursive: true, force: true });
});

function runBun(args: string[]): string {
  return execFileSync('bun', args, {
    cwd: process.cwd(),
    env: { ...process.env, CONSUELO_HOME: tempHome },
    encoding: 'utf8',
  });
}


async function runConcurrentBun(code: string, count: number): Promise<string[]> {
  const gatePath = join(tempHome, `gate-${Date.now()}-${Math.random()}`);
  const runs = Array.from({ length: count }, (_, index) => new Promise<string>((resolve, reject) => {
    const child = spawn('bun', ['-e', code], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        CONSUELO_HOME: tempHome,
        CONSUELO_TEST_GATE: gatePath,
        CONSUELO_TEST_WORKER: String(index),
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('error', reject);
    child.on('exit', (exitCode) => {
      if (exitCode === 0) resolve(stdout);
      else reject(new Error(`child ${index} exited ${exitCode}: ${stderr}`));
    });
  }));

  writeFileSync(gatePath, 'go');
  return Promise.all(runs);
}

describe('runtime steering guard state', () => {
  it('ignores guard events created after the lookup time', () => {
    const output = runBun(['-e', `
      const { readSteeringGuardDecisions, recordSteeringGuardEvent } = await import('./scripts/lib/runtime-state.ts');

      recordSteeringGuardEvent({
        callerKey: 'agent-run-1',
        tool: 'get_steering',
        decision: 'allowed',
        traceId: 'trc_current_event',
        nowMs: 1_000,
      });
      recordSteeringGuardEvent({
        callerKey: 'agent-run-1',
        tool: 'get_steering',
        decision: 'blocked',
        traceId: 'trc_future_event',
        nowMs: 5_000,
      });

      const decisions = readSteeringGuardDecisions({
        callerKey: 'agent-run-1',
        tool: 'get_steering',
        nowMs: 2_000,
        windowMs: 2_000,
      });

      process.stdout.write(JSON.stringify(decisions));
    `]);

    expect(JSON.parse(output)).toEqual(['allowed']);
  });

  it('atomically advances steering guard decisions across worker processes', async () => {
    const outputs = await runConcurrentBun(`
      const { existsSync } = await import('node:fs');
      const { claimSteeringGuardDecision } = await import('./scripts/lib/runtime-state.ts');
      while (!existsSync(process.env.CONSUELO_TEST_GATE)) await Bun.sleep(1);
      const worker = process.env.CONSUELO_TEST_WORKER;
      const result = claimSteeringGuardDecision({
        callerKey: 'principal-shared',
        tool: 'get_steering',
        traceId: 'trc_worker_' + worker,
        nowMs: 10_000,
        windowMs: 60_000,
        decisions: ['full', 'soft_guard', 'hard_guard', 'cooldown'],
      });
      process.stdout.write(JSON.stringify(result));
    `, 2);

    const results = outputs.map((output) => JSON.parse(output) as { decision: string; attempt: number });
    expect(results.map((result) => result.attempt).sort()).toEqual([1, 2]);
    expect(results.map((result) => result.decision).sort()).toEqual(['full', 'soft_guard']);
  });

  it('atomically admits a gateway nonce only once across worker processes', async () => {
    const outputs = await runConcurrentBun(`
      const { existsSync } = await import('node:fs');
      const { claimGatewayReplayNonce } = await import('./scripts/lib/runtime-state.ts');
      while (!existsSync(process.env.CONSUELO_TEST_GATE)) await Bun.sleep(1);
      const claimed = claimGatewayReplayNonce({
        scope: 'machine:token-shared',
        nonce: 'nonce-shared',
        nowMs: 10_000,
        windowMs: 60_000,
      });
      process.stdout.write(JSON.stringify(claimed));
    `, 2);

    expect(outputs.map((output) => JSON.parse(output)).sort()).toEqual([false, true]);
  });
});
