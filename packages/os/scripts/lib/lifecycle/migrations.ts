import { spawn } from 'node:child_process';
import {
  closeSync,
  existsSync,
  fsyncSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';

import { isPathWithin } from './paths';
import type { LifecycleMigrationRunner } from './types';

type MigrationJournal = {
  schemaVersion: 1;
  applied: string[];
};

function loadJournal(path: string): MigrationJournal {
  if (!existsSync(path)) return { schemaVersion: 1, applied: [] };
  const value = JSON.parse(readFileSync(path, 'utf8')) as Partial<MigrationJournal>;
  if (value.schemaVersion !== 1 || !Array.isArray(value.applied)) {
    throw new Error('lifecycle migration journal is invalid');
  }
  return {
    schemaVersion: 1,
    applied: value.applied.filter((entry): entry is string => typeof entry === 'string'),
  };
}

function writeJournal(path: string, journal: MigrationJournal): void {
  const temporaryPath = `${path}.${process.pid}.${crypto.randomUUID()}.tmp`;
  mkdirSync(dirname(path), { recursive: true });
  try {
    const descriptor = openSync(temporaryPath, 'wx', 0o600);
    try {
      writeFileSync(descriptor, `${JSON.stringify(journal, null, 2)}
`, 'utf8');
      fsyncSync(descriptor);
    } finally {
      closeSync(descriptor);
    }
    renameSync(temporaryPath, path);
  } finally {
    rmSync(temporaryPath, { force: true });
  }
}

async function runMigration(path: string, home: string, releasePath: string): Promise<void> {
  let result: { exitCode: number; stdout: string; stderr: string };
  try {
    result = await new Promise((resolveResult, reject) => {
      const child = spawn(process.execPath, [path, home], {
        cwd: releasePath,
        env: { ...process.env, CONSUELO_HOME: home },
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      let stdout = '';
      let stderr = '';
      child.stdout.setEncoding('utf8');
      child.stderr.setEncoding('utf8');
      child.stdout.on('data', (chunk: string) => { stdout += chunk; });
      child.stderr.on('data', (chunk: string) => { stderr += chunk; });
      child.once('error', reject);
      child.once('close', (exitCode) => resolveResult({ exitCode: exitCode ?? 1, stdout, stderr }));
    });
  } catch (error: unknown) {
    throw new Error(`failed to start runtime migration: ${error instanceof Error ? error.message : String(error)}`, {
      cause: error,
    });
  }
  if (result.exitCode !== 0) {
    throw new Error(
      result.stderr.trim() || result.stdout.trim() || `runtime migration exited ${result.exitCode}`,
    );
  }
}

export const defaultLifecycleMigrationRunner: LifecycleMigrationRunner = {
  async run(input) {
    try {
      const journalPath = join(input.home, 'runtime', 'migrations.json');
      const journal = loadJournal(journalPath);
      const applied = new Set(journal.applied);

      for (const migration of input.manifest.migrations) {
        if (applied.has(migration.id)) continue;
        if (!migration.path) {
          applied.add(migration.id);
          writeJournal(journalPath, { schemaVersion: 1, applied: [...applied] });
          continue;
        }
        const migrationPath = resolve(input.releasePath, migration.path);
        if (!isPathWithin(input.releasePath, migrationPath) || !existsSync(migrationPath)) {
          throw new Error(`runtime migration is missing or escapes the release: ${migration.id}`);
        }
        await runMigration(migrationPath, input.home, input.releasePath);
        applied.add(migration.id);
        writeJournal(journalPath, { schemaVersion: 1, applied: [...applied] });
      }
    } catch (error: unknown) {
      throw new Error(
        `runtime migration execution failed: ${error instanceof Error ? error.message : String(error)}`,
        { cause: error },
      );
    }
  },
};

// Kept as a compatibility export for callers introduced with the initial lifecycle engine.
export const noOpLifecycleMigrationRunner = defaultLifecycleMigrationRunner;
