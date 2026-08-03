import type { ParallelGroup } from '../types';
import {
  planProviderCallbackTransition,
  resolveWinnerClaim,
} from './parallel-transition';

const baseGroup = (): ParallelGroup => ({
  groupId: 'pg_test',
  conferenceName: 'pg_test_queue-1',
  status: 'dialing',
  winnerSid: null,
  calls: [
    {
      callSid: 'CA_first',
      customerNumber: '+15551111111',
      fromNumber: '+15552222222',
      position: 1,
      status: 'dialing',
      dialStartedAt: '2026-07-23T12:00:00.000Z',
    },
    {
      callSid: 'CA_second',
      customerNumber: '+15553333333',
      fromNumber: '+15554444444',
      position: 2,
      status: 'dialing',
      dialStartedAt: '2026-07-23T12:00:00.000Z',
    },
  ],
  workspaceId: 'workspace-1',
  queueId: 'queue-1',
  userId: 'user-1',
  createdAt: '2026-07-23T12:00:00.000Z',
  profile: {
    id: 'balanced',
    fanout: 2,
    staggerMs: 0,
    amdPolicy: 'human-or-unknown',
    terminationPolicy: 'winner-take-all',
  },
  resolverReason: 'route-resolved',
  cleanupFailures: [],
});

const now = '2026-07-23T12:00:05.000Z';

describe('parallel provider callback transition', () => {
  it('plans a winner claim without reading a provider or store', () => {
    const result = planProviderCallbackTransition(baseGroup(), {
      callSid: 'CA_first',
      callStatus: 'in-progress',
      answeredBy: 'human',
      occurredAt: now,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.plan.group.winnerSid).toBeNull();
    expect(result.plan.group.calls[0]).toEqual(
      expect.objectContaining({
        status: 'in-progress',
        amdResult: 'human',
        answeredAt: now,
      }),
    );
    expect(result.plan.actions).toEqual([
      { type: 'claim-winner', callSid: 'CA_first' },
    ]);
  });

  it('resolves a won claim into exact winner-take-all conference actions', () => {
    const planned = planProviderCallbackTransition(baseGroup(), {
      callSid: 'CA_first',
      callStatus: 'in-progress',
      answeredBy: 'human',
      occurredAt: now,
    });
    if (!planned.ok) throw planned.error;

    const result = resolveWinnerClaim(
      planned.plan.group,
      'CA_first',
      { outcome: 'won' },
      now,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.plan.group).toEqual(
      expect.objectContaining({
        winnerSid: 'CA_first',
        status: 'connected',
        connectedAt: now,
      }),
    );
    expect(result.plan.actions).toEqual([
      { type: 'terminate-call', callSid: 'CA_second' },
      { type: 'unmute-winner', callSid: 'CA_first' },
    ]);
  });

  it('completes the group and clears stale winner unmute when the winner becomes terminal', () => {
    const group = baseGroup();
    group.winnerSid = 'CA_first';
    group.status = 'connected';
    group.connectedAt = now;
    group.calls[0] = {
      ...group.calls[0],
      status: 'in-progress',
      amdResult: 'human',
      answeredAt: now,
    };
    group.cleanupFailures = [
      {
        action: 'unmute-winner',
        callSid: 'CA_first',
        message: 'Active conference not found',
        attempts: 1,
        firstFailedAt: now,
        lastFailedAt: now,
        retryable: true,
      },
    ];
    const completedAt = '2026-07-23T12:01:00.000Z';

    const result = planProviderCallbackTransition(group, {
      callSid: 'CA_first',
      callStatus: 'completed',
      occurredAt: completedAt,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.plan.group).toEqual(
      expect.objectContaining({
        status: 'completed',
        completedAt,
      }),
    );
    expect(result.plan.group.calls[0]).toEqual(
      expect.objectContaining({ status: 'completed', terminatedAt: completedAt }),
    );
    expect(result.plan.group.cleanupFailures).toEqual([]);
    expect(result.plan.actions).toEqual([
      { type: 'terminate-call', callSid: 'CA_second' },
    ]);
  });

  it('plans machine termination without selecting a winner', () => {
    const result = planProviderCallbackTransition(baseGroup(), {
      callSid: 'CA_first',
      callStatus: 'in-progress',
      answeredBy: 'machine_start',
      occurredAt: now,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.plan.group.winnerSid).toBeNull();
    expect(result.plan.actions).toEqual([
      { type: 'terminate-call', callSid: 'CA_first' },
    ]);
  });

  it('ignores an answered callback after the leg is terminal', () => {
    const group = baseGroup();
    group.calls[0].status = 'completed';
    group.calls[0].terminatedAt = now;

    const result = planProviderCallbackTransition(group, {
      callSid: 'CA_first',
      callStatus: 'in-progress',
      answeredBy: 'human',
      occurredAt: '2026-07-23T12:00:10.000Z',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.plan.group).toEqual(group);
    expect(result.plan.actions).toEqual([]);
  });

  it('returns a typed non-retryable transition error for an unknown leg', () => {
    const result = planProviderCallbackTransition(baseGroup(), {
      callSid: 'CA_unknown',
      callStatus: 'in-progress',
      answeredBy: 'human',
      occurredAt: now,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;

    expect(result.error).toEqual(
      expect.objectContaining({
        _tag: 'DialerTransitionError',
        retryable: false,
        groupId: 'pg_test',
        callSid: 'CA_unknown',
      }),
    );
  });
});
