import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

let tempHome: string;

beforeEach(() => {
  tempHome = mkdtempSync(join(tmpdir(), 'consuelo-os-doctor-logs-'));
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

function seedExecutions(): void {
  runBun(['-e', `
    const { executeCall } = await import('./scripts/os.ts');
    await executeCall({ name: 'missing-skill', traceId: 'trc_doctor_missing' });
    await executeCall({ name: 'daily-revenue-brief', traceId: 'trc_doctor_success', input: { source: 'doctor-test' } });
  `]);
}

describe('Doctor execution log scripts', () => {
  it('prints execution rows from the OS database', () => {
    seedExecutions();
    const output = runBun(['./scripts/doctor-watch.ts', '--once', '--limit', '10']);

    expect(output).toContain('Doctor watch:');
    expect(output).toContain('missing-skill');
    expect(output).toContain('daily-revenue-brief');
    expect(output).toContain('trc_doctor_missing');
    expect(output).toContain('trc_doctor_success');
  });

  it('prints failed executions as JSON lines', () => {
    seedExecutions();
    const output = runBun(['./scripts/doctor-errors.ts', '--json', '--limit', '10']);
    const rows = output.trim().split('\n').map((line) => JSON.parse(line) as { traceId: string; status: string; errorCode: string });

    expect(rows).toContainEqual(expect.objectContaining({
      traceId: 'trc_doctor_missing',
      status: 'failed',
      errorCode: 'SKILL_NOT_FOUND',
    }));
  });

  it('summarizes execution analytics', () => {
    seedExecutions();
    const output = JSON.parse(runBun(['./scripts/doctor-analytics.ts', '--json'])) as {
      executions: Array<{ name: string; status: string; count: number }>;
      errors: Array<{ error_code: string; count: number }>;
    };

    expect(output.executions).toContainEqual(expect.objectContaining({
      name: 'daily-revenue-brief',
      status: 'succeeded',
      count: 1,
    }));
    expect(output.errors).toContainEqual(expect.objectContaining({
      error_code: 'SKILL_NOT_FOUND',
      count: 1,
    }));
  });
});
