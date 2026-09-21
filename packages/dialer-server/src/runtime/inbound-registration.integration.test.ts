import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { migrateDialerDatabase } from '../database/migrations';
import { createPostgresInboundJournal } from '../inbound/postgres-journal';
import { createPostgresRepCapacity } from '../inbound/rep-capacity';
import { createInboundRuntime, reconcileConfiguredRepCapacity } from './inbound';

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

  it('starts with a disabled retired number without claiming its workspace or polling its deleted queue', async () => {
    const runtime = await createInboundRuntime({
      DIALER_INBOUND_ENABLED: 'true',
      DATABASE_URL: `postgresql://postgres@127.0.0.1:${port}/${database}`,
      TWILIO_ACCOUNT_SID: 'AC' + '0'.repeat(32),
      TWILIO_AUTH_TOKEN: 'fixture-token',
      DIALER_SERVER_PUBLIC_URL: 'https://voice.example',
      DIALER_INBOUND_CONFIG_JSON: JSON.stringify({
        schemaVersion: 1,
        numbers: [{ numberId: 'retired', workspaceId: 'retired-workspace',
          queueId: 'removed-queue', did: syntheticPhone, enabled: false,
          maxActiveRequests: 1 }],
        endpoints: [],
      }),
    });
    try {
      expect(runtime?.ownsWorkspace('retired-workspace')).toBe(false);
      expect(await runtime?.tick()).toMatchObject({ failures: 0 });
    } finally { await runtime?.close(); }
  });

  it('keeps shared capacity authority while a disabled number still has a live session', async () => {
    await pool.query(
      `INSERT INTO dialer_telephony_sessions(
         workspace_id,request_id,number_id,queue_id,caller_sid,conference_name,mode
       ) VALUES('draining-workspace','draining-request','draining-number','removed-queue','CA-draining','draining-conference','waiting')`,
    );
    const runtime = await createInboundRuntime({
      DIALER_INBOUND_ENABLED: 'true',
      DATABASE_URL: `postgresql://postgres@127.0.0.1:${port}/${database}`,
      TWILIO_ACCOUNT_SID: 'AC' + '0'.repeat(32),
      TWILIO_AUTH_TOKEN: 'fixture-token',
      DIALER_SERVER_PUBLIC_URL: 'https://voice.example',
      DIALER_INBOUND_CONFIG_JSON: JSON.stringify({
        schemaVersion: 1,
        numbers: [{ numberId: 'draining-number', workspaceId: 'draining-workspace',
          queueId: 'removed-queue', did: syntheticPhone, enabled: false,
          maxActiveRequests: 1 }],
        endpoints: [],
      }),
    });
    try {
      expect(runtime?.ownsWorkspace('draining-workspace')).toBe(true);
    } finally { await runtime?.close(); }
  });

  it('requires fresh readiness after restarting with a replacement rep endpoint', async () => {
    const original = [{ workspaceId: 'device-workspace', repId: 'rep',
      endpointId: 'old-browser', kind: 'browser' as const, address: 'old-device' }];
    await reconcileConfiguredRepCapacity(pool, original);
    const authority = createPostgresRepCapacity(pool);
    const registered = (await authority.read('device-workspace', 'rep'))!;
    await authority.execute({ workspaceId: 'device-workspace', capacityId: 'rep',
      expectedVersion: registered.version, operationId: 'device-ready',
      action: { type: 'readiness', ready: true,
        endpoints: [{ endpointId: 'old-browser', kind: 'browser', healthy: true }] } });
    await reconcileConfiguredRepCapacity(pool, [{ ...original[0]!,
      endpointId: 'new-browser', address: 'new-device' }]);
    const restarted = (await authority.read('device-workspace', 'rep'))!;
    expect(restarted.ready).toBe(false);
    expect(restarted.endpoints.some((endpoint) => endpoint.healthy)).toBe(false);
    await reconcileConfiguredRepCapacity(pool, [{ ...original[0]!,
      endpointId: 'new-browser', address: 'new-device' }]);
    expect((await authority.read('device-workspace', 'rep'))?.version).toBe(restarted.version);
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
