import type { Pool } from 'pg';

let defaultPool: Pool | null = null;
let filesPool: Pool | null = null;
let knowledgePool: Pool | null = null;

export async function getSharedPool(): Promise<Pool> {
  try {
    if (defaultPool === null) {
      const { default: pg } = await import('pg');
      const connectionString = process.env.DATABASE_URL;
      if (!connectionString) {
        throw new Error('DATABASE_URL environment variable is required');
      }
      defaultPool = new pg.Pool({ connectionString });
    }
    return defaultPool;
  } catch (err: unknown) {
    defaultPool = null;
    throw err;
  }
}

export async function getFilesPool(): Promise<Pool> {
  try {
    if (filesPool === null) {
      const { default: pg } = await import('pg');
      const connectionString =
        process.env.FILES_DATABASE_URL ?? process.env.DATABASE_URL;
      if (!connectionString) {
        throw new Error('DATABASE_URL environment variable is required');
      }
      filesPool = new pg.Pool({ connectionString });
    }
    return filesPool;
  } catch (err: unknown) {
    filesPool = null;
    throw err;
  }
}

export async function getKnowledgePool(): Promise<Pool> {
  try {
    if (knowledgePool === null) {
      const { default: pg } = await import('pg');
      const connectionString =
        process.env.KNOWLEDGE_DATABASE_URL ?? process.env.DATABASE_URL;
      if (!connectionString) {
        throw new Error('DATABASE_URL environment variable is required');
      }
      knowledgePool = new pg.Pool({ connectionString, max: 5 });
    }
    return knowledgePool;
  } catch (err: unknown) {
    knowledgePool = null;
    throw err;
  }
}
