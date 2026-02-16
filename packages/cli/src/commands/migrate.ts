import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve, join, extname } from 'node:path';
import type { Command } from 'commander';
import { log, error, json, isJson } from '../output.js';
import { loadFullConfig } from '../config.js';
import { captureError } from '../sentry.js';

const MIGRATIONS_DIR = resolve('migrations');
const SEEDS_DIR = resolve('seeds');
const TABLE = '_consuelo_migrations';

interface MigrationRecord {
  id: number;
  name: string;
  checksum: string;
  applied_at: string;
}

const getDbUrl = (opts: { databaseUrl?: string }): string => {
  if (opts.databaseUrl) return opts.databaseUrl;
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const cfg = loadFullConfig('project');
  if (cfg.database?.url) return cfg.database.url;
  const globalCfg = loadFullConfig('global');
  if (globalCfg.database?.url) return globalCfg.database.url;
  throw new Error('no database url — set DATABASE_URL, --database-url, or database.url in config');
};

const connect = async (url: string): Promise<{ query: (text: string, values?: unknown[]) => Promise<{ rows: unknown[] }>; end: () => Promise<void> }> => {
  try {
    const pg = await import('pg');
    const client = new pg.Client({ connectionString: url });
    await client.connect();
    return {
      query: (text: string, values?: unknown[]) => client.query(text, values),
      end: () => client.end(),
    };
  } catch (err: unknown) {
    throw new Error('failed to connect to database: ' + (err instanceof Error ? err.message : String(err)));
  }
};

const ensureTable = async (db: Awaited<ReturnType<typeof connect>>): Promise<void> => {
  try {
    await db.query(
      'CREATE TABLE IF NOT EXISTS ' + TABLE + ' (' +
      'id SERIAL PRIMARY KEY, ' +
      'name VARCHAR(255) NOT NULL UNIQUE, ' +
      'checksum VARCHAR(64) NOT NULL, ' +
      'applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW())'
    );
  } catch (err: unknown) {
    throw new Error('failed to create migrations table: ' + (err instanceof Error ? err.message : String(err)));
  }
};

const checksum = (content: string): string =>
  createHash('md5').update(content).digest('hex');

const getMigrationFiles = (): Array<{ name: string; path: string; ext: string }> => {
  if (!existsSync(MIGRATIONS_DIR)) return [];
  return readdirSync(MIGRATIONS_DIR)
    .filter(f => /\.(ts|sql)$/.test(f))
    .sort()
    .map(f => ({ name: f.replace(/\.(ts|sql)$/, ''), path: join(MIGRATIONS_DIR, f), ext: extname(f) }));
};

const getApplied = async (db: Awaited<ReturnType<typeof connect>>): Promise<MigrationRecord[]> => {
  const result = await db.query('SELECT id, name, checksum, applied_at FROM ' + TABLE + ' ORDER BY id');
  return result.rows as MigrationRecord[];
};

const parseSqlMigration = (content: string): { up: string; down: string } => {
  const upMatch = content.match(/--\s*up\s*\n([\s\S]*?)(?=--\s*down|$)/i);
  const downMatch = content.match(/--\s*down\s*\n([\s\S]*?)$/i);
  return { up: upMatch?.[1]?.trim() ?? '', down: downMatch?.[1]?.trim() ?? '' };
};

const migrateUp = async (opts: { databaseUrl?: string; dryRun?: boolean }): Promise<void> => {
  const url = getDbUrl(opts);
  const db = await connect(url);
  try {
    await ensureTable(db);
    const applied = await getApplied(db);
    const appliedNames = new Set(applied.map(r => r.name));
    const files = getMigrationFiles();
    const pending = files.filter(f => !appliedNames.has(f.name));

    // checksum validation
    for (const rec of applied) {
      const file = files.find(f => f.name === rec.name);
      if (file) {
        const hash = checksum(readFileSync(file.path, 'utf-8'));
        if (hash !== rec.checksum) {
          throw new Error(`checksum mismatch for ${rec.name} — migration was modified after being applied`);
        }
      }
    }

    if (pending.length === 0) {
      if (isJson()) { json({ applied: 0, migrations: [] }); return; }
      log('no pending migrations');
      return;
    }

    if (opts.dryRun) {
      if (isJson()) { json({ dryRun: true, pending: pending.map(f => f.name) }); return; }
      log(`dry run — ${pending.length} migration(s) would run:`);
      for (const f of pending) log(`  ${f.name}`);
      return;
    }

    for (const file of pending) {
      const content = readFileSync(file.path, 'utf-8');
      if (file.ext === '.sql') {
        const { up } = parseSqlMigration(content);
        if (!up) throw new Error(`no -- up section in ${file.name}.sql`);
        await db.query(up);
      } else {
        const mod = await import(file.path);
        await mod.up(db);
      }
      await db.query('INSERT INTO ' + TABLE + ' (name, checksum) VALUES ($1, $2)', [file.name, checksum(content)]);
      log(`applied: ${file.name}`);
    }

    if (isJson()) json({ applied: pending.length, migrations: pending.map(f => f.name) });
    else log(`${pending.length} migration(s) applied`);
  } finally {
    await db.end();
  }
};

const migrateDown = async (opts: { databaseUrl?: string; steps?: string; target?: string; dryRun?: boolean }): Promise<void> => {
  const url = getDbUrl(opts);
  const db = await connect(url);
  try {
    await ensureTable(db);
    const applied = await getApplied(db);
    if (applied.length === 0) {
      if (isJson()) { json({ rolledBack: 0 }); return; }
      log('no migrations to roll back');
      return;
    }

    const files = getMigrationFiles();
    let toRollback: MigrationRecord[];

    if (opts.target) {
      const idx = applied.findIndex(r => r.name === opts.target);
      if (idx === -1) throw new Error(`migration ${opts.target} not found in applied list`);
      toRollback = applied.slice(idx + 1).reverse();
    } else {
      const steps = opts.steps ? parseInt(opts.steps, 10) : 1;
      toRollback = applied.slice(-steps).reverse();
    }

    if (opts.dryRun) {
      if (isJson()) { json({ dryRun: true, rollback: toRollback.map(r => r.name) }); return; }
      log(`dry run — ${toRollback.length} migration(s) would roll back:`);
      for (const r of toRollback) log(`  ${r.name}`);
      return;
    }

    for (const rec of toRollback) {
      const file = files.find(f => f.name === rec.name);
      if (!file) throw new Error(`migration file not found for ${rec.name}`);
      const content = readFileSync(file.path, 'utf-8');
      if (file.ext === '.sql') {
        const { down } = parseSqlMigration(content);
        if (!down) throw new Error(`no -- down section in ${rec.name}.sql`);
        await db.query(down);
      } else {
        const mod = await import(file.path);
        await mod.down(db);
      }
      await db.query('DELETE FROM ' + TABLE + ' WHERE name = $1', [rec.name]);
      log(`rolled back: ${rec.name}`);
    }

    if (isJson()) json({ rolledBack: toRollback.length, migrations: toRollback.map(r => r.name) });
    else log(`${toRollback.length} migration(s) rolled back`);
  } finally {
    await db.end();
  }
};

const migrateStatus = async (opts: { databaseUrl?: string }): Promise<void> => {
  const url = getDbUrl(opts);
  const db = await connect(url);
  try {
    await ensureTable(db);
    const applied = await getApplied(db);
    const files = getMigrationFiles();
    const appliedNames = new Set(applied.map(r => r.name));
    const pending = files.filter(f => !appliedNames.has(f.name));

    if (isJson()) {
      json({
        applied: applied.map(r => ({ name: r.name, appliedAt: r.applied_at })),
        pending: pending.map(f => f.name),
      });
      return;
    }

    if (applied.length > 0) {
      log('applied:');
      for (const r of applied) log(`  ✓ ${r.name} (${r.applied_at})`);
    }
    if (pending.length > 0) {
      log('pending:');
      for (const f of pending) log(`  ○ ${f.name}`);
    }
    if (applied.length === 0 && pending.length === 0) {
      log('no migrations found');
    }
  } finally {
    await db.end();
  }
};

const migrateGenerate = (name: string, opts: { sql?: boolean }): void => {
  mkdirSync(MIGRATIONS_DIR, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
  const slug = name.replace(/[^a-z0-9]/gi, '-').toLowerCase();

  if (opts.sql) {
    const filePath = join(MIGRATIONS_DIR, `${timestamp}-${slug}.sql`);
    writeFileSync(filePath, `-- up\n\n-- down\n`);
    if (isJson()) json({ file: filePath });
    else log(`created: ${filePath}`);
  } else {
    const filePath = join(MIGRATIONS_DIR, `${timestamp}-${slug}.ts`);
    writeFileSync(filePath, `// migration: ${slug}

interface DbClient {
  query: (text: string, values?: unknown[]) => Promise<{ rows: unknown[] }>;
}

export const up = async (db: DbClient): Promise<void> => {
  // add migration SQL here
};

export const down = async (db: DbClient): Promise<void> => {
  // add rollback SQL here
};
`);
    if (isJson()) json({ file: filePath });
    else log(`created: ${filePath}`);
  }
};

const migrateSeed = async (opts: { databaseUrl?: string; reset?: boolean; dryRun?: boolean }): Promise<void> => {
  if (!existsSync(SEEDS_DIR)) {
    if (isJson()) { json({ seeded: 0 }); return; }
    log('no seeds/ directory found');
    return;
  }

  const files = readdirSync(SEEDS_DIR).filter(f => /\.(ts|sql)$/.test(f)).sort();
  if (files.length === 0) {
    if (isJson()) { json({ seeded: 0 }); return; }
    log('no seed files found');
    return;
  }

  if (opts.dryRun) {
    if (isJson()) { json({ dryRun: true, seeds: files }); return; }
    log(`dry run — ${files.length} seed file(s):`);
    for (const f of files) log(`  ${f}`);
    return;
  }

  const url = getDbUrl(opts);
  const db = await connect(url);
  try {
    if (opts.reset) {
      log('clearing seed data...');
      // seeds handle their own cleanup in reset mode
    }
    for (const file of files) {
      const filePath = join(SEEDS_DIR, file);
      const content = readFileSync(filePath, 'utf-8');
      if (file.endsWith('.sql')) {
        await db.query(content);
      } else {
        const mod = await import(filePath);
        await mod.seed(db);
      }
      log(`seeded: ${file}`);
    }
    if (isJson()) json({ seeded: files.length, files });
    else log(`${files.length} seed file(s) run`);
  } finally {
    await db.end();
  }
};

const migrateReset = async (opts: { databaseUrl?: string; yes?: boolean; dryRun?: boolean }): Promise<void> => {
  if (!opts.yes && !opts.dryRun) {
    error('reset will drop all consuelo tables and re-run migrations. pass --yes to confirm.');
    process.exit(1);
  }

  const url = getDbUrl(opts);
  const db = await connect(url);
  try {
    if (opts.dryRun) {
      if (isJson()) { json({ dryRun: true, action: 'reset' }); return; }
      log('dry run — would drop _consuelo_migrations and re-run all migrations');
      return;
    }

    await db.query('DROP TABLE IF EXISTS ' + TABLE);
    log('dropped migration tracking table');
    await db.end();

    await migrateUp({ databaseUrl: url });
  } catch (err: unknown) {
    await db.end();
    throw err;
  }
};

export const registerMigrate = (program: Command): void => {
  const migrate = program
    .command('migrate')
    .description('database migrations and schema management')
    .option('--database-url <url>', 'database connection string')
    .option('--dry-run', 'show plan without executing', false)
    .option('--yes', 'skip confirmation prompts', false)
    .action(async (opts) => {
      try {
        await migrateUp(opts);
      } catch (err: unknown) {
        captureError(err, { command: 'migrate' });
        error(err instanceof Error ? err.message : 'migrate failed');
        process.exit(1);
      }
    });

  migrate
    .command('up')
    .description('run pending migrations')
    .action(async () => {
      try {
        await migrateUp(migrate.opts());
      } catch (err: unknown) {
        captureError(err, { command: 'migrate up' });
        error(err instanceof Error ? err.message : 'migrate up failed');
        process.exit(1);
      }
    });

  migrate
    .command('down')
    .description('rollback migrations')
    .option('--steps <n>', 'number of migrations to roll back')
    .option('--target <name>', 'roll back to specific migration')
    .action(async (opts) => {
      try {
        await migrateDown({ ...migrate.opts(), ...opts });
      } catch (err: unknown) {
        captureError(err, { command: 'migrate down' });
        error(err instanceof Error ? err.message : 'migrate down failed');
        process.exit(1);
      }
    });

  migrate
    .command('status')
    .description('show applied and pending migrations')
    .action(async () => {
      try {
        await migrateStatus(migrate.opts());
      } catch (err: unknown) {
        captureError(err, { command: 'migrate status' });
        error(err instanceof Error ? err.message : 'migrate status failed');
        process.exit(1);
      }
    });

  migrate
    .command('generate <name>')
    .description('create a new migration file')
    .option('--sql', 'generate SQL migration instead of TypeScript')
    .action((name: string, opts) => {
      try {
        migrateGenerate(name, opts);
      } catch (err: unknown) {
        captureError(err, { command: 'migrate generate' });
        error(err instanceof Error ? err.message : 'migrate generate failed');
        process.exit(1);
      }
    });

  migrate
    .command('seed')
    .description('run seed files')
    .option('--reset', 'clear data before seeding')
    .action(async (opts) => {
      try {
        await migrateSeed({ ...migrate.opts(), ...opts });
      } catch (err: unknown) {
        captureError(err, { command: 'migrate seed' });
        error(err instanceof Error ? err.message : 'migrate seed failed');
        process.exit(1);
      }
    });

  migrate
    .command('reset')
    .description('drop all consuelo tables and re-run migrations')
    .action(async () => {
      try {
        await migrateReset(migrate.opts());
      } catch (err: unknown) {
        captureError(err, { command: 'migrate reset' });
        error(err instanceof Error ? err.message : 'migrate reset failed');
        process.exit(1);
      }
    });
};
