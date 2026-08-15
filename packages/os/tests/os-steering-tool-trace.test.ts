import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

const homes: string[] = [];

function makeHome(): string {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'consuelo-steering-tool-trace-'));
  homes.push(home);
  return home;
}

function runOsSnippet(home: string, code: string): void {
  const traceDb = path.join(home, 'node', 'db', 'traces.db');
  const result = spawnSync('bun', ['--eval', code], {
    cwd: process.cwd(),
    encoding: 'utf8',
    env: {
      ...process.env,
      CONSUELO_HOME: home,
      CONSUELO_OS_HOME: home,
      CONSUELO_USER_HOME: home,
      CONSUELO_TRACE_DB: traceDb,
      TRACE_DB: traceDb,
    },
  });
  if (result.status !== 0) {
    throw new Error(`OS Bun snippet failed:\n${result.stderr || result.stdout}`);
  }
}

function readToolTraces(home: string): Array<Record<string, unknown>> {
  const result = spawnSync('sqlite3', [
    '-json',
    path.join(home, 'node', 'db', 'traces.db'),
    [
      'SELECT tool, status, code, input_json, result_json, input_tokens, output_tokens, total_tokens',
      'FROM tool_traces',
      "WHERE tool IN ('get_steering', 'refresh_steering')",
      'ORDER BY rowid',
    ].join(' '),
  ], { encoding: 'utf8' });
  expect(result.status).toBe(0);
  return JSON.parse(result.stdout || '[]') as Array<Record<string, unknown>>;
}

afterEach(() => {
  for (const home of homes.splice(0)) fs.rmSync(home, { recursive: true, force: true });
});

describe('steering canonical trace persistence', () => {
  it('records full and guarded get_steering calls with token estimates but without steering content', () => {
    const home = makeHome();
    runOsSnippet(home, `
      const { executeGetSteering } = await import('./scripts/os.ts');
      let builds = 0;
      const buildSteering = () => {
        builds += 1;
        return 'private steering body '.repeat(80);
      };
      const options = { callerKey: 'trace-loop-test', now: () => 1_000_000 };
      executeGetSteering(buildSteering, options);
      executeGetSteering(buildSteering, options);
      executeGetSteering(buildSteering, options);
      executeGetSteering(buildSteering, options);
    `);

    const rows = readToolTraces(home);
    expect(rows).toHaveLength(4);
    expect(rows.map((row) => row.tool)).toEqual([
      'get_steering',
      'get_steering',
      'get_steering',
      'get_steering',
    ]);
    const results = rows.map((row) => JSON.parse(String(row.result_json))) as Array<Record<string, unknown>>;
    expect(results.map((result) => result.decision)).toEqual([
      'full',
      'soft_guard',
      'hard_guard',
      'cooldown',
    ]);
    for (const [index, row] of rows.entries()) {
      expect(row.status).toBe('succeeded');
      expect(Number(row.input_tokens)).toBe(0);
      expect(Number(row.output_tokens)).toBeGreaterThan(0);
      expect(Number(row.total_tokens)).toBe(Number(row.output_tokens));
      expect(results[index]).not.toHaveProperty('content');
      expect(JSON.stringify(results[index])).not.toContain('private steering body');
    }
  });

  it('records refresh_steering decisions and safe reasons without persisting the steering body', () => {
    const home = makeHome();
    runOsSnippet(home, `
      const { executeRefreshSteering } = await import('./scripts/os.ts');
      const options = { callerKey: 'refresh-trace-test', now: () => 2_000_000 };
      executeRefreshSteering('', () => 'must not persist', options);
      executeRefreshSteering('context changed', () => 'fresh private steering '.repeat(20), options);
      executeRefreshSteering('retry', () => 'must not rebuild', options);
    `);

    const rows = readToolTraces(home);
    expect(rows).toHaveLength(3);
    expect(rows.map((row) => row.tool)).toEqual([
      'refresh_steering',
      'refresh_steering',
      'refresh_steering',
    ]);
    const inputs = rows.map((row) => JSON.parse(String(row.input_json))) as Array<Record<string, unknown>>;
    const results = rows.map((row) => JSON.parse(String(row.result_json))) as Array<Record<string, unknown>>;
    expect(results.map((result) => result.decision)).toEqual([
      'reason_required',
      'forced_refresh',
      'refresh_rate_limited',
    ]);
    expect(inputs[1]).toMatchObject({ reason: 'context changed' });
    expect(JSON.stringify(results)).not.toContain('fresh private steering');
    expect(rows.every((row) => Number(row.total_tokens) > 0)).toBe(true);
  });
});
