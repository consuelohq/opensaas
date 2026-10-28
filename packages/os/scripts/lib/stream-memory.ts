import { Database } from 'bun:sqlite';
import { existsSync } from 'node:fs';

import { resolveConsueloHomeLayout } from './consuelo-home';

export type StreamDecision = {
  title: string;
  date: string;
};

export type ReadLocalStreamDecisionsOptions = {
  env?: NodeJS.ProcessEnv;
  limit?: number;
};

export function readLocalStreamDecisions(
  area: string,
  options: ReadLocalStreamDecisionsOptions = {},
): StreamDecision[] {
  const env = options.env ?? process.env;
  const home = env.CONSUELO_HOME ?? env.CONSUELO_OS_HOME;
  const dbPath = resolveConsueloHomeLayout(home).nodeDbPath;
  if (!existsSync(dbPath)) return [];

  const limit = Math.max(1, Math.min(options.limit ?? 10, 100));
  const db = new Database(dbPath, { readonly: true });
  try {
    const memoriesTable = db.query(
      "SELECT 1 AS present FROM sqlite_master WHERE type = 'table' AND name = 'memories' LIMIT 1",
    ).get() as { present?: number } | null;
    if (!memoriesTable?.present) return [];

    const rows = db.query(
      'SELECT title, created_at FROM memories WHERE category = ? AND lower(title) LIKE lower(?) ORDER BY created_at DESC, id DESC LIMIT ?',
    ).all('stream-decision', `%${area}%`, limit) as Array<{ title: string; created_at: string }>;

    return rows.map((row) => ({
      title: row.title,
      date: row.created_at ? row.created_at.slice(0, 10) : '',
    }));
  } finally {
    db.close();
  }
}
