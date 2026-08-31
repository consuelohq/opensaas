#!/usr/bin/env bun

import { Pool } from 'pg';

import { migrateDialerDatabase } from '../src/database/migrations';

const connectionString = process.env.DATABASE_URL?.trim();
if (!connectionString) {
  throw new Error('DATABASE_URL is required');
}

const pool = new Pool({ connectionString });

try {
  await migrateDialerDatabase({
    query: <T>(text: string, values?: readonly unknown[]) =>
      pool.query<T>(text, values as unknown[] | undefined),
  });
  process.stdout.write('[dialer-server] database migrations complete\n');
} finally {
  await pool.end();
}
