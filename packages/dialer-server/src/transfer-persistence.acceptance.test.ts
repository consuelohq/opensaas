import { describe, expect, it, mock } from 'bun:test';

import {
  createPostgresTransferRepository,
  type TransferDatabase,
} from './transfers/persistence';

const row = {
  workspace_id: 'workspace-one',
  session_id: 'session-one',
  event_type: 'transfer_consulting',
  metadata: {
    transferId: 'transfer-one',
    groupId: 'group-one',
    type: 'warm',
    target: '+15550100111',
    status: 'consulting',
    conferenceSid: 'CF_one',
    transferCallSid: 'CA_transfer',
  },
};

describe('transfer persistence', () => {
  it('writes idempotent call-history events with bound metadata and reads the latest scoped transfer', async () => {
    const query = mock(async (sql: string, values: readonly unknown[] = []) => {
      if (sql.includes('INSERT INTO dialer_call_events')) {
        return { rows: [], rowCount: 1 };
      }
      if (sql.includes('workspace_id = $1') && sql.includes('session_id = $2')) {
        return { rows: [row], rowCount: 1 };
      }
      throw new Error('Unexpected query: ' + sql + JSON.stringify(values));
    });
    const repository = createPostgresTransferRepository({
      query: query as unknown as TransferDatabase['query'],
    });

    await repository.recordEvent({
      id: 'transfer-one:transfer_consulting',
      workspaceId: 'workspace-one',
      sessionId: 'session-one',
      transferId: 'transfer-one',
      groupId: 'group-one',
      type: 'warm',
      target: '+15550100111',
      status: 'consulting',
      conferenceSid: 'CF_one',
      transferCallSid: 'CA_transfer',
      eventType: 'transfer_consulting',
    });
    expect(query.mock.calls[0]?.[1]).toEqual([
      'transfer-one:transfer_consulting',
      'workspace-one',
      'session-one',
      'transfer_consulting',
      JSON.stringify(row.metadata),
    ]);

    await expect(
      repository.getTransfer({
        workspaceId: 'workspace-one',
        sessionId: 'session-one',
        transferId: 'transfer-one',
      }),
    ).resolves.toEqual({
      workspaceId: 'workspace-one',
      sessionId: 'session-one',
      transferId: 'transfer-one',
      groupId: 'group-one',
      type: 'warm',
      target: '+15550100111',
      status: 'consulting',
      conferenceSid: 'CF_one',
      transferCallSid: 'CA_transfer',
    });
    expect(query.mock.calls[1]?.[1]).toEqual([
      'workspace-one',
      'session-one',
      'transfer-one',
    ]);
  });

  it('finds a globally unique transfer for signed provider callbacks without trusting callback tenant fields', async () => {
    const query = mock(async (_sql: string, values: readonly unknown[] = []) => ({
      rows: [row],
      rowCount: 1,
      values,
    }));
    const repository = createPostgresTransferRepository({
      query: query as unknown as TransferDatabase['query'],
    });
    await expect(repository.getTransferById('transfer-one')).resolves.toMatchObject({
      workspaceId: 'workspace-one',
      sessionId: 'session-one',
      transferId: 'transfer-one',
    });
    expect(query.mock.calls[0]?.[1]).toEqual(['transfer-one']);
  });
});
