import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
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
});
