import type { Pool } from 'pg';

let pool: Pool | null = null;

export async function getSharedPool(): Promise<Pool> {
  try {
    if (pool === null) {
      const { default: pg } = await import('pg');
      const connectionString = process.env.DATABASE_URL;
      if (!connectionString) {
        throw new Error('DATABASE_URL environment variable is required');
      }
      pool = new pg.Pool({ connectionString });
    }
    return pool;
  } catch (err: unknown) {
    pool = null;
    throw err;
  }
}
