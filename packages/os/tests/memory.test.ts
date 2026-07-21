import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { Database } from 'bun:sqlite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const packageRoot = join(import.meta.dirname, '..');
const memoryScript = join(packageRoot, 'scripts', 'memory.js');

let fixtureRoot: string;
let consueloHome: string;

beforeEach(() => {
  fixtureRoot = mkdtempSync(join(tmpdir(), 'consuelo-os-memory-'));
  consueloHome = join(fixtureRoot, 'consuelo-home');
});

afterEach(() => {
  rmSync(fixtureRoot, { recursive: true, force: true });
});

function cleanEnv(): NodeJS.ProcessEnv {
  const {
    SUPABASE_URL: _supabaseUrl,
    SUPABASE_KEY: _supabaseKey,
    SUPABASE_ANON_KEY: _supabaseAnonKey,
    ...rest
  } = process.env;
  return { ...rest, CONSUELO_HOME: consueloHome };
}

function runMemory(args: string[], input?: string) {
  return spawnSync('bun', [memoryScript, ...args], {
    cwd: packageRoot,
    encoding: 'utf8',
    env: cleanEnv(),
    input,
  });
}

describe('OS memory runtime', () => {
  it('classifies memory.js as the canonical high-risk OS runtime', () => {
    const classifications = JSON.parse(readFileSync(
      join(packageRoot, 'tooling', 'script-parity-classifications.json'),
      'utf8',
    ));

    expect(classifications.scripts['scripts/memory.js']).toMatchObject({
      status: 'os-only-intentional',
    });
    expect(classifications.scripts).not.toHaveProperty('scripts/context.js');
    expect(classifications.highRiskScripts).toContain('scripts/memory.js');
    expect(classifications.highRiskScripts).not.toContain('scripts/context.js');
  });

  it('persists and retrieves memories from the Consuelo runtime database without Supabase', () => {
    const sourcePath = join(fixtureRoot, 'handoff.md');
    writeFileSync(sourcePath, 'tags: architecture, sqlite\nThe memory runtime uses the Consuelo database.\n');

    const saved = runMemory(['save', 'Architecture handoff', sourcePath, '--category', 'handoff', '--json']);
    expect(saved.status, saved.stderr).toBe(0);
    expect(saved.stderr).not.toContain('SUPABASE');
    expect(JSON.parse(saved.stdout)).toMatchObject({
      title: 'Architecture handoff',
      category: 'handoff',
    });

    const dbPath = join(consueloHome, 'node', 'db', 'consuelo.db');
    expect(existsSync(dbPath)).toBe(true);

    const searched = runMemory(['search', 'Consuelo database', '--json']);
    expect(searched.status, searched.stderr).toBe(0);
    expect(JSON.parse(searched.stdout)).toEqual([
      expect.objectContaining({ title: 'Architecture handoff', category: 'handoff' }),
    ]);

    const found = runMemory(['find', 'Architecture', '--json']);
    expect(found.status, found.stderr).toBe(0);
    expect(JSON.parse(found.stdout)).toHaveLength(1);

    const listed = runMemory(['list', 'handoff', '--json']);
    expect(listed.status, listed.stderr).toBe(0);
    expect(JSON.parse(listed.stdout)).toEqual([
      expect.objectContaining({ title: 'Architecture handoff', category: 'handoff' }),
    ]);

    const fetched = runMemory(['get', '1', 'Architecture', '--by-title', '--json']);
    expect(fetched.status, fetched.stderr).toBe(0);
    expect(JSON.parse(fetched.stdout)).toMatchObject({
      title: 'Architecture handoff',
      content: expect.stringContaining('Consuelo database'),
    });

    const categories = runMemory(['categories', '--json']);
    expect(categories.status, categories.stderr).toBe(0);
    expect(JSON.parse(categories.stdout)).toEqual(['handoff']);
  });

  it('queries an explicit local trace database through memory trace', () => {
    const traceDbPath = join(fixtureRoot, 'traces.db');
    const db = new Database(traceDbPath, { create: true });
    try {
      db.exec(`
        CREATE TABLE tool_traces (
          id TEXT PRIMARY KEY,
          ts TEXT NOT NULL,
          trace_id TEXT NOT NULL,
          mcp_trace_id TEXT,
          source TEXT NOT NULL,
          tool TEXT NOT NULL,
          task_session TEXT,
          branch TEXT,
          worktree TEXT,
          status TEXT NOT NULL,
          ok INTEGER NOT NULL,
          code TEXT,
          exit_code INTEGER,
          duration_ms INTEGER,
          input_json TEXT,
          resolved_input_json TEXT,
          result_json TEXT,
          stderr TEXT,
          input_tokens INTEGER,
          output_tokens INTEGER,
          total_tokens INTEGER
        );
      `);
      db.query('INSERT INTO tool_traces (id, ts, trace_id, source, tool, status, ok, code, duration_ms, total_tokens) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
        .run('row-1', '2026-07-21T00:00:00.000Z', 'trc_memory_001', 'mcp', 'memory', 'error', 0, 'COMMAND_FAILED', 12, 45);
    } finally {
      db.close();
    }

    const traced = runMemory(['trace', '--db', traceDbPath, '--status', 'error', '--json']);
    expect(traced.status, traced.stderr).toBe(0);
    expect(JSON.parse(traced.stdout)).toMatchObject({
      dbPath: traceDbPath,
      count: 1,
      rows: [expect.objectContaining({ traceId: 'trc_memory_001', tool: 'memory', status: 'error' })],
    });
  });
});
