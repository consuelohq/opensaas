import assert from 'node:assert/strict';
import type { Pool } from 'pg';
import type { InboundEvent, InboundSnapshot } from '@consuelo/dialer';
import { createPostgresInboundJournal } from '../inbound/postgres-journal';
import type { LabWorkerTrace } from './inbound-process-runner';
import type { createSimulatedCarrier } from './inbound-simulator';

export const capture = async (pool: Pool, workspaceId: string) => {
  try {
    const [entities, events, commands, outcomes] = await Promise.all([
      pool.query<{ snapshot: InboundSnapshot }>(
        'SELECT snapshot FROM dialer_inbound_entities WHERE workspace_id=$1 ORDER BY kind,entity_id',
        [workspaceId],
      ),
      pool.query<{ event: InboundEvent; applied: boolean }>(
        'SELECT event,applied FROM dialer_inbound_events WHERE workspace_id=$1 ORDER BY sequence',
        [workspaceId],
      ),
      pool.query<{ command_id: string; status: string; version: number }>(
        'SELECT command_id,status,version FROM dialer_inbound_commands WHERE workspace_id=$1 ORDER BY command_id',
        [workspaceId],
      ),
      pool.query<{ command_id: string; status: string; version: number }>(
        'SELECT command_id,status,version FROM dialer_inbound_command_events WHERE workspace_id=$1 ORDER BY command_id,version',
        [workspaceId],
      ),
    ]);
    return {
      entities: entities.rows.map((row) => row.snapshot),
      events: events.rows,
      commands: commands.rows,
      outcomes: outcomes.rows,
    };
  } catch (cause: unknown) {
    throw new Error('Inbound lab evidence capture failed', { cause });
  }
};

export const createSimulationEvidence = (pool: Pool) => {
  const cases: {
    name: string;
    workers: LabWorkerTrace[];
    carrier: ReturnType<ReturnType<typeof createSimulatedCarrier>['evidence']>;
    durable: Awaited<ReturnType<typeof capture>>;
  }[] = [];
  const record = async (
    name: string,
    workspaceId: string,
    carrier: ReturnType<typeof createSimulatedCarrier>,
    workers: LabWorkerTrace[],
  ) => {
    try {
      cases.push({
        name,
        workers,
        carrier: carrier.evidence(),
        durable: await capture(pool, workspaceId),
      });
    } catch (cause: unknown) {
      throw new Error('Inbound lab scenario recording failed', { cause });
    }
  };
  const proofReplay = async (workspaceId: string) => {
    try {
      const before = await capture(pool, workspaceId);
      const recovered = createPostgresInboundJournal(pool);
      for (const snapshot of before.entities)
        assert.deepEqual(
          await recovered.replay(
            workspaceId,
            snapshot.identity.kind,
            snapshot.entityId,
          ),
          snapshot,
        );
      assert.deepEqual(
        await capture(pool, workspaceId),
        before,
        'Replay must not append events or effects',
      );
    } catch (cause: unknown) {
      throw new Error('Inbound lab replay proof failed', { cause });
    }
  };
  return { cases, record, proofReplay };
};
