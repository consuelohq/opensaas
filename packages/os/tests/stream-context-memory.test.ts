import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { Database } from 'bun:sqlite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { readLocalStreamDecisions } from '../scripts/lib/stream-memory';

let fixtureRoot: string;
let consueloHome: string;

beforeEach(() => {
  fixtureRoot = mkdtempSync(join(tmpdir(), 'consuelo-stream-memory-'));
  consueloHome = join(fixtureRoot, 'consuelo-home');
  mkdirSync(join(consueloHome, 'node', 'db'), { recursive: true });
});

afterEach(() => {
  rmSync(fixtureRoot, { recursive: true, force: true });
});

describe('stream context local memory', () => {
  it('reads stream decisions from the local Consuelo memory database', () => {
    const db = new Database(join(consueloHome, 'node', 'db', 'consuelo.db'), { create: true });
    try {
      db.exec(`
        CREATE TABLE memories (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          title TEXT NOT NULL,
          category TEXT NOT NULL,
          content TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
      `);
      const insert = db.query('INSERT INTO memories(title, category, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?)');
      insert.run('os: canonical memory', 'stream-decision', 'use local memory', '2026-07-21T01:00:00.000Z', '2026-07-21T01:00:00.000Z');
      insert.run('website: unrelated', 'stream-decision', 'ignore', '2026-07-21T02:00:00.000Z', '2026-07-21T02:00:00.000Z');
    } finally {
      db.close();
    }

    expect(readLocalStreamDecisions('os', { env: { CONSUELO_HOME: consueloHome } })).toEqual([
      { title: 'os: canonical memory', date: '2026-07-21' },
    ]);
  });
});
