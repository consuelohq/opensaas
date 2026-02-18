import type { Pool } from 'pg';

let defaultPool: Pool | null = null;
let filesPool: Pool | null = null;
let knowledgePool: Pool | null = null;

async function createPool(
  connectionString: string,
  max?: number,
): Promise<Pool> {
  const pg = await import('pg');
  const PoolClass =
    pg.Pool ??
    (pg as unknown as { default: { Pool: typeof Pool } }).default.Pool;
  return new PoolClass({
    connectionString,
    ...(max !== undefined ? { max } : {}),
  });
}

export async function getSharedPool(): Promise<Pool> {
  try {
    if (defaultPool === null) {
      const connectionString = process.env.DATABASE_URL;
      if (!connectionString) {
        throw new Error('DATABASE_URL environment variable is required');
      }
      defaultPool = await createPool(connectionString);
    }
    return defaultPool!;
  } catch (err: unknown) {
    defaultPool = null;
    throw err;
  }
}

export async function getFilesPool(): Promise<Pool> {
  try {
    if (filesPool === null) {
      const connectionString =
        process.env.FILES_DATABASE_URL ?? process.env.DATABASE_URL;
      if (!connectionString) {
        throw new Error('DATABASE_URL environment variable is required');
      }
      filesPool = await createPool(connectionString);
    }
    return filesPool!;
  } catch (err: unknown) {
    filesPool = null;
    throw err;
  }
}

export async function getKnowledgePool(): Promise<Pool> {
  try {
    if (knowledgePool === null) {
      const connectionString =
        process.env.KNOWLEDGE_DATABASE_URL ?? process.env.DATABASE_URL;
      if (!connectionString) {
        throw new Error('DATABASE_URL environment variable is required');
      }
      knowledgePool = await createPool(connectionString, 5);
    }
    return knowledgePool!;
  } catch (err: unknown) {
    knowledgePool = null;
    throw err;
  }
}
