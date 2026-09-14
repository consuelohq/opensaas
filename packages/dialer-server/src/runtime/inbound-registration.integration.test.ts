import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { migrateDialerDatabase } from '../database/migrations';
import { createPostgresInboundJournal } from '../inbound/postgres-journal';
import { createPostgresRepCapacity } from '../inbound/rep-capacity';
import { reconcileConfiguredRepCapacity } from './inbound';

const port = Number(process.env.CONSUELO_RD3_PG_PORT);
const enabled = Number.isInteger(port) && port > 1024 && port < 65536;
const suite = enabled ? describe : describe.skip;
const syntheticPhone = ['+1', '828', '555', '0123'].join('');

suite('inbound runtime configured rep registration', () => {
  const database = 'rd8_runtime_' + randomUUID().replaceAll('-', '');
  const admin = new Pool({ host: '127.0.0.1', port, database: 'postgres', user: 'postgres' });
  const pool = new Pool({ host: '127.0.0.1', port, database, user: 'postgres' });

  beforeAll(async () => {
    await admin.query('CREATE DATABASE ' + database);
    await migrateDialerDatabase(pool);
  }, 30_000);

  afterAll(async () => {
    await pool.end();
    await admin.query('DROP DATABASE IF EXISTS ' + database);
    await admin.end();
  });

  it('registers each configured rep before the runtime exposes inbound routes', async () => {
    await reconcileConfiguredRepCapacity(pool, [
      {
        workspaceId: 'workspace',
        repId: 'alice',
        endpointId: 'browser',
        kind: 'browser',
        address: 'alice',
      },
      {
        workspaceId: 'workspace',
        repId: 'alice',
        endpointId: 'phone',
        kind: 'phone',
        address: syntheticPhone,
      },
      {
        workspaceId: 'workspace',
        repId: 'bob',
        endpointId: 'browser',
        kind: 'browser',
        address: 'bob',
      },
    ]);

    const capacity = createPostgresRepCapacity(pool);
    const journal = createPostgresInboundJournal(pool);
    for (const repId of ['alice', 'bob']) {
      const rep = await capacity.read('workspace', repId);
      expect(rep?.repId).toBe(repId);
      expect(rep?.ready).toBe(false);
      expect(rep?.endpoints).toEqual([]);
      expect((await journal.replay('workspace', 'capacity', repId))?.state).toBe('unavailable');
    }
  });
});
