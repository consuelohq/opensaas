import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

const homes: string[] = [];

function makeHome(): string {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'consuelo-os-steering-'));
  homes.push(home);
  process.env.CONSUELO_HOME = home;
  return home;
}

function runOsSnippet<TOutput>(home: string, code: string): TOutput {
  const result = spawnSync('bun', ['--eval', code], {
    cwd: process.cwd(),
    encoding: 'utf8',
    env: { ...process.env, CONSUELO_HOME: home },
  });

  if (result.status !== 0) {
    throw new Error(`OS Bun snippet failed:\n${result.stderr || result.stdout}`);
  }

  return JSON.parse(result.stdout || 'null') as TOutput;
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
  it('loads local steering folder files and ignores legacy steering.md', () => {
    const home = makeHome();
    const steeringDir = path.join(home, 'steering');
    fs.mkdirSync(steeringDir, { recursive: true });
    fs.writeFileSync(path.join(steeringDir, 'system_prompt.md'), '# Local system prompt\n\nlocal system body\n');
    fs.writeFileSync(path.join(steeringDir, 'decision.md'), '# Local decision\n\nlocal decision body\n');
    fs.writeFileSync(path.join(steeringDir, 'steering.md'), '# Legacy steering\n\nlegacy body must be ignored\n');

    const { first, second } = runOsSnippet<{ first: string; second: string }>(home, `
      const fs = await import('node:fs');
      const path = await import('node:path');
      const { getSteering } = await import('./scripts/os.ts');
      const first = getSteering();
      fs.writeFileSync(path.join(process.env.CONSUELO_HOME, 'steering', 'system_prompt.md'), '# Local system prompt\\n\\nupdated system body\\n');
      const second = getSteering();
      console.log(JSON.stringify({ first, second }));
    `);

    expect(first).toContain('# system_prompt.md');
    expect(first).toContain('local system body');
    expect(first).toContain('# decision.md');
    expect(first).toContain('local decision body');
    expect(first).not.toContain('legacy body must be ignored');
    expect(first.indexOf('# system_prompt.md')).toBeLessThan(first.indexOf('# decision.md'));
    expect(second).toContain('updated system body');
    expect(second).not.toContain('local system body');
  });

  it('records get-steering with metadata and full steering body', () => {
    const home = makeHome();
    const { steering } = runOsSnippet<{ steering: string }>(home, `
      const { executeGetSteering } = await import('./scripts/os.ts');
      const steering = executeGetSteering(() => 'os steering payload '.repeat(40));
      console.log(JSON.stringify({ steering }));
    `);

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
    const result = runOsSnippet<{
      first: string;
      second: string;
      third: string;
      fourth: string;
      builds: number;
    }>(home, `
      const { executeGetSteering } = await import('./scripts/os.ts');
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
      console.log(JSON.stringify({ first, second, third, fourth, builds }));
    `);

    expect(result.first).toBe('os steering payload');
    expect(result.second).toContain('GET_STEERING_LOOP_GUARD');
    expect(result.second).toContain('$CONSUELO_HOME/steering/system_prompt.md');
    expect(result.third).toContain('GET_STEERING_RATE_LIMITED');
    expect(result.fourth).toContain('GET_STEERING_COOLDOWN');
    expect(result.builds).toBe(1);

    const rows = readExecutions(home);
    expect(rows.map((row) => JSON.parse(String(row.output_json)).result.decision)).toEqual([
      'full',
      'soft_guard',
      'hard_guard',
      'cooldown',
    ]);
  });

  it('rate limits explicit refresh-steering break-glass calls', () => {
    const home = makeHome();
    const result = runOsSnippet<{
      noReason: string;
      first: string;
      second: string;
      third: string;
      builds: number;
    }>(home, `
      const { executeRefreshSteering } = await import('./scripts/os.ts');
      let now = 2_000_000;
      let builds = 0;
      const buildSteering = () => {
        builds += 1;
        return 'forced steering ' + builds;
      };
      const options = { callerKey: 'agent-force', now: () => now };
      const noReason = executeRefreshSteering('', buildSteering, options);
      const first = executeRefreshSteering('fresh context required', buildSteering, options);
      const second = executeRefreshSteering('retrying', buildSteering, options);
      now += 301_000;
      const third = executeRefreshSteering('later context refresh', buildSteering, options);
      console.log(JSON.stringify({ noReason, first, second, third, builds }));
    `);

    expect(result.noReason).toContain('REFRESH_STEERING_REASON_REQUIRED');
    expect(result.first).toBe('forced steering 1');
    expect(result.second).toContain('REFRESH_STEERING_RATE_LIMITED');
    expect(result.third).toBe('forced steering 2');
    expect(result.builds).toBe(2);
  });
});
