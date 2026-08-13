import { describe, expect, it, mock } from 'bun:test';
import type { ParallelGroup, TransferOptions, TransferResult } from '@consuelo/dialer';
import { Effect } from 'effect';

import {
  createTransferApplication,
  type TransferRepository,
} from './transfers/application';

const group: ParallelGroup = {
  groupId: 'group-one',
  dialerSessionId: 'session-one',
  conferenceName: 'conference-one',
  status: 'connected' as const,
  winnerSid: 'CA_customer',
  calls: [
    {
      callSid: 'CA_customer',
      customerNumber: '+15550100001',
      fromNumber: '+15550100002',
      position: 1,
      status: 'in-progress' as const,
      dialStartedAt: '2026-08-04T00:00:00.000Z',
    },
  ],
  workspaceId: 'workspace-one',
  queueId: 'queue-one',
  userId: 'user-one',
  createdAt: '2026-08-04T00:00:00.000Z',
  profile: {
    id: 'balanced',
    fanout: 1,
    staggerMs: 0,
    amdPolicy: 'human-only' as const,
    terminationPolicy: 'winner-take-all' as const,
  },
  resolverReason: 'test',
  cleanupFailures: [],
};

const createRuntime = () => {
  const events: Array<Record<string, unknown>> = [];
  const initiateTransfer = mock<(input: TransferOptions) => Promise<TransferResult>>(async () => ({
    success: true,
    transferId: 'transfer-one',
    transferCallSid: 'CA_transfer',
    conferenceSid: 'CF_one',
  }));
  const completeTransfer = mock<(conferenceSid: string, agentCallSid: string) => Promise<TransferResult>>(async () => ({
    success: true,
    conferenceSid: 'CF_one',
  }));
  const cancelTransfer = mock<(conferenceSid: string, transferCallSid: string) => Promise<TransferResult>>(async () => ({
    success: true,
    conferenceSid: 'CF_one',
  }));
  const holdParticipant = mock(async () => undefined);
  const dialer = {
    findConferenceSid: mock(async () => 'CF_one'),
    listParticipants: mock(async () => [
      {
        callSid: 'CA_agent',
        conferenceSid: 'CF_one',
        label: 'agent',
        hold: false,
        muted: false,
        status: 'connected',
      },
      {
        callSid: 'CA_customer',
        conferenceSid: 'CF_one',
        label: 'customer',
        hold: false,
        muted: false,
        status: 'connected',
      },
    ]),
    initiateTransfer,
    completeTransfer,
    cancelTransfer,
    holdParticipant,
  };
  const repository = {
    recordEvent: mock(async (event: Record<string, unknown>) => {
      events.push(event);
    }),
    getTransfer: mock(async () => ({
      workspaceId: 'workspace-one',
      sessionId: 'session-one',
      transferId: 'transfer-one',
      groupId: 'group-one',
      type: 'warm' as const,
      target: '+15550100111',
      status: 'consulting' as const,
      conferenceSid: 'CF_one',
      transferCallSid: 'CA_transfer',
    })),
    getTransferById: mock<TransferRepository['getTransferById']>(async () => null),
  };
  const application = createTransferApplication({
    loadGroup: mock(async () => group),
    selectDialer: mock(async () => dialer),
    repository,
    publicUrl: 'https://dialer.test',
    generateId: () => 'transfer-one',
  });
  return {
    application,
    dialer,
    repository,
    events,
    initiateTransfer,
    completeTransfer,
    cancelTransfer,
    holdParticipant,
  };
};

describe('server-authoritative transfer application', () => {
  it('derives conference, agent leg, caller ID, callback URL, and history session from the owned group for warm transfer', async () => {
    const runtime = createRuntime();
    const result = await Effect.runPromise(
      runtime.application.initiate({
        workspaceId: 'workspace-one',
        userId: 'user-one',
        sessionId: 'group-one',
        type: 'warm',
        to: '+15550100111',
      }),
    );

    expect(result).toEqual({
      success: true,
      transferId: 'transfer-one',
      transferCallSid: 'CA_transfer',
      conferenceSid: 'CF_one',
      status: 'initiating',
    });
    expect(runtime.initiateTransfer).toHaveBeenCalledWith({
      callSid: 'CA_agent',
      conferenceName: 'conference-one',
      to: '+15550100111',
      from: '+15550100002',
      type: 'warm',
      userId: 'user-one',
      statusCallbackUrl: 'https://dialer.test/webhooks/twilio/transfer-status',
      transferId: 'transfer-one',
    });
    expect(runtime.events.map((event) => event.eventType)).toEqual([
      'transfer_initiated',
      'transfer_dialing',
    ]);
    expect(runtime.events[0]).toMatchObject({
      workspaceId: 'workspace-one',
      sessionId: 'session-one',
      transferId: 'transfer-one',
      groupId: 'group-one',
    });
  });

  it('returns the latest tenant-scoped status without touching the provider', async () => {
    const runtime = createRuntime();
    const status = await Effect.runPromise(
      runtime.application.getStatus({
        workspaceId: 'workspace-one',
        userId: 'user-one',
        sessionId: 'group-one',
        transferId: 'transfer-one',
      }),
    );

    expect(status).toEqual({
      success: true,
      transferId: 'transfer-one',
      transferCallSid: 'CA_transfer',
      conferenceSid: 'CF_one',
      status: 'consulting',
    });
    expect(runtime.repository.getTransfer).toHaveBeenCalledWith({
      workspaceId: 'workspace-one',
      sessionId: 'session-one',
      transferId: 'transfer-one',
    });
    expect(runtime.initiateTransfer).not.toHaveBeenCalled();
    expect(runtime.completeTransfer).not.toHaveBeenCalled();
    expect(runtime.cancelTransfer).not.toHaveBeenCalled();
  });

  it('completes cold transfer immediately and records provider failure without inventing success', async () => {
    const cold = createRuntime();
    const completed = await Effect.runPromise(
      cold.application.initiate({
        workspaceId: 'workspace-one',
        userId: 'user-one',
        sessionId: 'group-one',
        type: 'cold',
        to: '+15550100111',
      }),
    );
    expect(completed.status).toBe('completed');
    expect(cold.events.map((event) => event.eventType)).toEqual([
      'transfer_initiated',
      'transfer_completed',
    ]);

    const failed = createRuntime();
    failed.initiateTransfer.mockImplementation(async () => ({
      success: false,
      error: 'provider unavailable',
    }));
    const failure = await Effect.runPromise(
      failed.application.initiate({
        workspaceId: 'workspace-one',
        userId: 'user-one',
        sessionId: 'group-one',
        type: 'warm',
        to: '+15550100111',
      }),
    );
    expect(failure).toEqual({
      success: false,
      transferId: 'transfer-one',
      status: 'failed',
      error: 'provider unavailable',
    });
    expect(failed.events.at(-1)).toMatchObject({ eventType: 'transfer_failed' });
  });

  it('completes or cancels only the persisted warm transfer and resolves the live agent participant server-side', async () => {
    const runtime = createRuntime();
    const completed = await Effect.runPromise(
      runtime.application.complete({
        workspaceId: 'workspace-one',
        userId: 'user-one',
        sessionId: 'group-one',
        transferId: 'transfer-one',
      }),
    );
    expect(completed).toMatchObject({
      success: true,
      transferId: 'transfer-one',
      status: 'completed',
    });
    expect(runtime.completeTransfer).toHaveBeenCalledWith('CF_one', 'CA_agent');

    const cancelled = await Effect.runPromise(
      runtime.application.cancel({
        workspaceId: 'workspace-one',
        userId: 'user-one',
        sessionId: 'group-one',
        transferId: 'transfer-one',
      }),
    );
    expect(cancelled).toMatchObject({
      success: true,
      transferId: 'transfer-one',
      status: 'cancelled',
    });
    expect(runtime.cancelTransfer).toHaveBeenCalledWith(
      'CF_one',
      'CA_transfer',
    );
    expect(runtime.events.slice(-2).map((event) => event.eventType)).toEqual([
      'transfer_completed',
      'transfer_cancelled',
    ]);
  });

  it('recovers the held customer on a signed failed warm-transfer callback and rejects mismatched provider call ids', async () => {
    const runtime = createRuntime();
    runtime.repository.getTransferById.mockImplementation(async () => ({
      workspaceId: 'workspace-one',
      sessionId: 'session-one',
      transferId: 'transfer-one',
      groupId: 'group-one',
      type: 'warm',
      target: '+15550100111',
      status: 'consulting',
      conferenceSid: 'CF_one',
      transferCallSid: 'CA_transfer',
    }));
    runtime.dialer.listParticipants.mockImplementation(async () => [
      {
        callSid: 'CA_agent',
        conferenceSid: 'CF_one',
        label: 'agent',
        hold: false,
        muted: false,
        status: 'connected',
      },
      {
        callSid: 'CA_customer',
        conferenceSid: 'CF_one',
        label: 'customer',
        hold: true,
        muted: false,
        status: 'connected',
      },
    ]);

    await expect(
      Effect.runPromise(
        runtime.application.processStatusCallback({
          transferId: 'transfer-one',
          callSid: 'CA_wrong',
          callStatus: 'no-answer',
        }),
      ),
    ).rejects.toThrow('provider call');

    await expect(
      Effect.runPromise(
        runtime.application.processStatusCallback({
          transferId: 'transfer-one',
          callSid: 'CA_transfer',
          callStatus: 'no-answer',
        }),
      ),
    ).resolves.toEqual({ received: true, status: 'failed' });
    expect(runtime.holdParticipant).toHaveBeenCalledWith(
      'CF_one',
      'CA_customer',
      false,
    );
    expect(runtime.events.at(-1)).toMatchObject({
      eventType: 'transfer_failed',
      status: 'failed',
    });
  });

  it('rejects missing, cross-user, non-connected, or unpersisted groups before provider operations', async () => {
    for (const invalid of [
      null,
      { ...group, userId: 'other-user' },
      { ...group, status: 'completed' as const },
      { ...group, dialerSessionId: undefined },
    ]) {
      const runtime = createRuntime();
      runtime.application = createTransferApplication({
        loadGroup: async () => invalid,
        selectDialer: async () => runtime.dialer,
        repository: runtime.repository,
        publicUrl: 'https://dialer.test',
        generateId: () => 'transfer-one',
      });
      await expect(
        Effect.runPromise(
          runtime.application.initiate({
            workspaceId: 'workspace-one',
            userId: 'user-one',
            sessionId: 'group-one',
            type: 'warm',
            to: '+15550100111',
          }),
        ),
      ).rejects.toThrow();
      expect(runtime.initiateTransfer).not.toHaveBeenCalled();
    }
  });
});
