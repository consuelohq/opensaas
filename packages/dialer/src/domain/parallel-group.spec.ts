import type { ParallelGroup } from '../types';
import { hydrateParallelGroup } from './parallel-group';

const createGroup = (): ParallelGroup => ({
  groupId: 'group-1',
  conferenceName: 'conference-1',
  status: 'dialing',
  winnerSid: null,
  calls: [],
  workspaceId: 'workspace-1',
  queueId: 'queue-1',
  userId: 'user-1',
  createdAt: '2026-08-03T16:20:39.000Z',
  profile: {
    id: 'balanced',
    fanout: 1,
    staggerMs: 0,
    amdPolicy: 'human-or-unknown',
    terminationPolicy: 'winner-take-all',
  },
  resolverReason: 'test',
  cleanupFailures: [],
});

describe('hydrateParallelGroup', () => {
  it('normalizes a Redis Lua empty-object cleanupFailures value', () => {
    const persisted = {
      ...createGroup(),
      cleanupFailures: {},
    } as unknown as ParallelGroup;

    expect(hydrateParallelGroup(persisted).cleanupFailures).toEqual([]);
  });

  it('preserves valid cleanup failures without sharing mutable entries', () => {
    const persisted = createGroup();
    persisted.cleanupFailures = [
      {
        action: 'terminate-call',
        callSid: 'call-1',
        message: 'provider unavailable',
        attempts: 1,
        firstFailedAt: '2026-08-03T16:20:49.000Z',
        lastFailedAt: '2026-08-03T16:20:49.000Z',
        retryable: true,
      },
    ];

    const hydrated = hydrateParallelGroup(persisted);

    expect(hydrated.cleanupFailures).toEqual(persisted.cleanupFailures);
    expect(hydrated.cleanupFailures).not.toBe(persisted.cleanupFailures);
    expect(hydrated.cleanupFailures[0]).not.toBe(persisted.cleanupFailures[0]);
  });
});
