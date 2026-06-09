import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { executeGetSteering, executeRefreshSteering } from '../scripts/os';

const homes: string[] = [];

function makeHome(): string {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'consuelo-os-steering-'));
  homes.push(home);
  process.env.CONSUELO_HOME = home;
  return home;
}

function readExecutions(home: string): Array<Record<string, unknown>> {
  const result = spawnSync('sqlite3', [
    '-json',
    path.join(home, 'consuelo.db'),
    'SELECT name, status, input_json, output_json, duration_ms FROM skill_executions ORDER BY started_at',
  ], { encoding: 'utf8' });
  expect(result.status).toBe(0);
  return JSON.parse(result.stdout || '[]') as Array<Record<string, unknown>>;
}

function readExecution(home: string): Record<string, unknown> {
  const rows = readExecutions(home);
  expect(rows.length).toBe(1);
  return rows[0] ?? {};
}

afterEach(() => {
  delete process.env.CONSUELO_HOME;
  for (const home of homes.splice(0)) fs.rmSync(home, { recursive: true, force: true });
});

describe('OS steering execution recording', () => {
  it('records get-steering with metadata and full steering body', () => {
    const home = makeHome();
    const steering = executeGetSteering(() => 'os steering payload '.repeat(40));

    expect(steering).toContain('os steering payload');

    const row = readExecution(home);
    expect(row.name).toBe('get_steering');
    expect(row.status).toBe('succeeded');
    expect(JSON.parse(String(row.input_json))).toEqual({});
    const output = JSON.parse(String(row.output_json)) as { result: { chars: number; content: string } };
    expect(output.result.chars).toBe(40 * 'os steering payload '.length);
    expect(output.result).toMatchObject({ content: steering });
    expect(Number(row.duration_ms)).toBeGreaterThanOrEqual(0);
  });

  it('guards repeated get-steering calls and only builds steering once', () => {
    const home = makeHome();
    let now = 1_000_000;
    let builds = 0;
    const buildSteering = () => {
      builds += 1;
      return 'os steering payload';
    };
    const options = { callerKey: 'agent-loop', now: () => now };

    const first = executeGetSteering(buildSteering, options);
    const second = executeGetSteering(buildSteering, options);
    const third = executeGetSteering(buildSteering, options);
    const fourth = executeGetSteering(buildSteering, options);

    expect(first).toBe('os steering payload');
    expect(second).toContain('GET_STEERING_LOOP_GUARD');
    expect(second).toContain('packages/os/STEERING.md');
    expect(third).toContain('GET_STEERING_RATE_LIMITED');
    expect(fourth).toContain('GET_STEERING_COOLDOWN');
    expect(builds).toBe(1);

    const rows = readExecutions(home);
    expect(rows.map((row) => JSON.parse(String(row.output_json)).result.decision)).toEqual([
      'full',
      'soft_guard',
      'hard_guard',
      'cooldown',
    ]);
  });

  it('rate limits explicit refresh-steering break-glass calls', () => {
    makeHome();
    let now = 2_000_000;
    let builds = 0;
    const buildSteering = () => {
      builds += 1;
      return `forced steering ${builds}`;
    };
    const options = { callerKey: 'agent-force', now: () => now };

    const noReason = executeRefreshSteering('', buildSteering, options);
    const first = executeRefreshSteering('fresh context required', buildSteering, options);
    const second = executeRefreshSteering('retrying', buildSteering, options);
    now += 301_000;
    const third = executeRefreshSteering('later context refresh', buildSteering, options);

    expect(noReason).toContain('REFRESH_STEERING_REASON_REQUIRED');
    expect(first).toBe('forced steering 1');
    expect(second).toContain('REFRESH_STEERING_RATE_LIMITED');
    expect(third).toBe('forced steering 2');
    expect(builds).toBe(2);
  });
});
