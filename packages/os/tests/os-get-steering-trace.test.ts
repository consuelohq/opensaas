import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { executeGetSteering } from '../scripts/os';

const homes: string[] = [];

function makeHome(): string {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'consuelo-os-steering-'));
  homes.push(home);
  process.env.CONSUELO_HOME = home;
  return home;
}

function readExecution(home: string): Record<string, unknown> {
  const result = spawnSync('sqlite3', [
    '-json',
    path.join(home, 'consuelo.db'),
    'SELECT name, status, input_json, output_json, duration_ms FROM skill_executions',
  ], { encoding: 'utf8' });
  expect(result.status).toBe(0);
  const rows = JSON.parse(result.stdout || '[]') as Array<Record<string, unknown>>;
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
    const output = JSON.parse(String(row.output_json)) as { result: { chars: number } };
    expect(output.result.chars).toBe(40 * 'os steering payload '.length);
    expect(output.result).toMatchObject({ content: steering });
    expect(Number(row.duration_ms)).toBeGreaterThanOrEqual(0);
  });
});
