import type { PoolClient } from 'pg';
import { InboundPersistenceError, type InboundCommand } from '@consuelo/dialer';

export const isManagedCapacityCommand = async (
  client: PoolClient,
  workspaceId: string,
  command: InboundCommand,
) => {
  try {
    if (!['offer', 'bridge'].includes(command.type)) return false;
    const installed = await client.query<{ installed: boolean }>(
      "SELECT to_regclass('dialer_rep_capacity') IS NOT NULL AS installed",
    );
    if (!installed.rows[0]?.installed) return false;
    const result = await client.query(
      `SELECT 1 FROM dialer_inbound_entities assignment JOIN dialer_rep_capacity capacity
       ON capacity.workspace_id=assignment.workspace_id
       AND capacity.capacity_id=assignment.snapshot->'identity'->>'capacityId'
     WHERE assignment.workspace_id=$1 AND assignment.kind='assignment'
       AND assignment.entity_id=CASE WHEN $2='offer' THEN $3 ELSE
         (SELECT snapshot->'identity'->>'assignmentId' FROM dialer_inbound_entities
          WHERE workspace_id=$1 AND kind='bridge' AND entity_id=$3) END LIMIT 1`,
      [workspaceId, command.type, command.entityId],
    );
    return Boolean(result.rowCount);
  } catch (cause: unknown) {
    throw new InboundPersistenceError('Managed command lookup failed', {
      cause,
    });
  }
};
export const settleCapacityCommands = async (
  client: PoolClient,
  workspaceId: string,
  assignmentId: string,
  requireSettled: boolean,
) => {
  try {
    const result = await client.query<{
      command_id: string;
      version: number;
      status: string;
    }>(
      `SELECT command_id,version,status FROM dialer_inbound_commands command
     WHERE workspace_id=$1 AND
       ((command->>'type'='offer' AND command->>'entityId'=$2) OR
        (command->>'type'='bridge' AND command->>'entityId' IN
          (SELECT entity_id FROM dialer_inbound_entities WHERE workspace_id=$1 AND kind='bridge'
            AND snapshot->'identity'->>'assignmentId'=$2)))`,
      [workspaceId, assignmentId],
    );
    if (
      requireSettled &&
      result.rows.some((row) => ['dispatched', 'unknown'].includes(row.status))
    )
      throw new InboundPersistenceError(
        'Reconcile command outcomes before releasing capacity',
      );
    for (const row of result.rows.filter((row) => row.status === 'pending')) {
      await client.query(
        'UPDATE dialer_inbound_commands SET status=$3,version=version+1 WHERE workspace_id=$1 AND command_id=$2',
        [workspaceId, row.command_id, 'failed'],
      );
      await client.query(
        'INSERT INTO dialer_inbound_command_events(workspace_id,command_id,version,status,reconciled) VALUES($1,$2,$3,$4,true)',
        [workspaceId, row.command_id, row.version + 1, 'failed'],
      );
    }
  } catch (cause: unknown) {
    throw new InboundPersistenceError('Capacity command settlement failed', {
      cause,
    });
  }
};
