import { describe, expect, it } from 'bun:test';
import { applyRepCapacityAction } from './rep-capacity.js';
import {
  evaluateInboundRouting,
  isInboundQueueOpen,
} from './routing-policy.js';
import type { InboundQueuePolicy } from './routing-contracts.js';

const at = (seconds: number) =>
  new Date(Date.UTC(2026, 8, 13, 12, 0, seconds)).toISOString();
const capacity = (repId: string) => {
  const registered = applyRepCapacityAction(null, {
    schemaVersion: 1,
    workspaceId: 'tenant',
    capacityId: repId,
    operationId: 'register',
    expectedVersion: 0,
    at: at(0),
    action: {
      type: 'register',
      repId,
      policy: {
        offerMilliseconds: 12000,
        presenceMilliseconds: 60000,
        wrapUpMilliseconds: 30000,
        cooldownMilliseconds: 5000,
        escalationMilliseconds: 20000,
      },
    },
  });
  return applyRepCapacityAction(registered, {
    schemaVersion: 1,
    workspaceId: 'tenant',
    capacityId: repId,
    operationId: 'ready',
    expectedVersion: 1,
    at: at(0),
    action: {
      type: 'readiness',
      ready: true,
      endpoints: [{ endpointId: 'web', kind: 'browser', healthy: true }],
    },
  });
};
const policy: InboundQueuePolicy = {
  schemaVersion: 1 as const,
  policyVersion: 'fifo-owner-v1',
  workspaceId: 'tenant',
  queueId: 'sales',
  timezone: 'UTC',
  weekly: [{ day: 0, startMinute: 0, endMinute: 1440 }],
  closedDates: [],
  emergencyClosed: false,
  maxWaitMilliseconds: 120000,
  maxOffers: 3,
  reofferMilliseconds: 10000,
  profiles: [
    { repId: 'alice', skills: ['spanish'] },
    { repId: 'bob', skills: [] },
  ],
};
const request = (requestId: string, entered = 1) => ({
  workspaceId: 'tenant',
  requestId,
  queueId: 'sales',
  state: 'queued',
  version: 2,
  enteredAt: at(entered),
  requiredSkills: [] as string[],
  ownerRepId: null as string | null,
  ownerStatus: 'missing' as 'missing' | 'known',
  kind: 'live' as const,
  notBefore: null,
  deadline: null,
  attempts: [],
});
describe('inbound deterministic routing', () => {
  it('serves the oldest eligible caller and tries its available owner first', () => {
    const result = evaluateInboundRouting({
      policy,
      at: at(10),
      requests: [
        request('later', 2),
        { ...request('oldest'), ownerRepId: 'bob', ownerStatus: 'known' },
      ],
      capacities: [capacity('alice'), capacity('bob')],
    });
    expect(result.requestId).toBe('oldest');
    expect(result.proposedCapacityId).toBe('bob');
    expect(result.reason).toBe('owner');
    expect(result.action).toBe('offer');
  });
});

describe('routing boundaries and deterministic replay', () => {
  const run = (
    requests: Parameters<typeof evaluateInboundRouting>[0]['requests'],
    capacities = [capacity('alice'), capacity('bob')],
    override: Partial<InboundQueuePolicy> = {},
    seconds = 10,
  ) =>
    evaluateInboundRouting({
      policy: { ...policy, ...override },
      at: at(seconds),
      requests,
      capacities,
    });
  it('does not wait for a busy owner or bypass skills', () => {
    const busy = applyRepCapacityAction(capacity('bob'), {
      schemaVersion: 1,
      workspaceId: 'tenant',
      capacityId: 'bob',
      operationId: 'occupied',
      expectedVersion: 2,
      at: at(2),
      action: {
        type: 'offer',
        requestId: 'another',
        assignmentId: 'busy',
        direction: 'outbound',
        endpointIds: ['web'],
      },
    });
    expect(
      run(
        [{ ...request('caller'), ownerRepId: 'bob', ownerStatus: 'known' }],
        [capacity('alice'), busy],
      ).proposedCapacityId,
    ).toBe('alice');
    expect(
      run([
        {
          ...request('caller'),
          requiredSkills: ['spanish'],
          ownerRepId: 'bob',
          ownerStatus: 'known',
        },
      ]).proposedCapacityId,
    ).toBe('alice');
  });
  it('moves to the wider team after an owner attempt and respects cooldown', () => {
    const caller = {
      ...request('retry'),
      ownerRepId: 'alice',
      ownerStatus: 'known' as const,
      attempts: [
        {
          repId: 'alice',
          capacityId: 'alice',
          offeredAt: at(2),
          retryAfter: at(20),
        },
      ],
    };
    const result = run([caller]);
    expect(result.proposedCapacityId).toBe('bob');
    expect(
      result.candidates.find((c) => c.repId === 'alice')?.reasons,
    ).toContain('repeat');
    expect(run([caller], undefined, {}, 21).reason).toBe('longest_idle');
  });
  it('skips unserviceable head callers without weakening a scarce skill gate', () => {
    const result = run([
      { ...request('old'), requiredSkills: ['french'] },
      { ...request('spanish', 2), requiredSkills: ['spanish'] },
    ]);
    expect(result.requestId).toBe('spanish');
    expect(result.proposedCapacityId).toBe('alice');
    expect(result.considered[0]?.reason).toBe('no_capacity');
  });
  it('uses original age and stable IDs independent of input order', () => {
    const a = request('a'),
      b = request('b');
    const first = run([b, a]);
    const second = run([a, b], [capacity('bob'), capacity('alice')]);
    expect(first).toEqual(second);
    expect(first.requestId).toBe('a');
    expect(first.proposedCapacityId).toBe('alice');
    expect(
      run([
        request('old'),
        { ...request('vip', 2), ownerRepId: 'bob', ownerStatus: 'known' },
      ]).requestId,
    ).toBe('old');
  });
  it('uses due callback original age but never reserves before its window', () => {
    const callback = {
      ...request('callback'),
      kind: 'callback' as const,
      notBefore: at(20),
      deadline: at(50),
    };
    expect(run([callback, request('live', 2)]).requestId).toBe('live');
    expect(
      run([callback, request('live', 2)], undefined, {}, 20).requestId,
    ).toBe('callback');
    expect(run([callback], undefined, {}, 50).reason).toBe('deadline');
  });
  it('bounds age and attempts without silently creating callbacks', () => {
    expect(
      run([request('wait')], undefined, { maxWaitMilliseconds: 9000 }).reason,
    ).toBe('max_wait');
    const attempts = [
      {
        repId: 'alice',
        capacityId: 'alice',
        offeredAt: at(2),
        retryAfter: at(4),
      },
    ];
    const result = run([{ ...request('attempted'), attempts }], undefined, {
      maxOffers: 1,
    });
    expect(result.action).toBe('fallback');
    expect(result.reason).toBe('max_offers');
    expect(result.proposedCapacityId).toBeNull();
  });
  it('fails closed for stale readiness, away, bad device and foreign capacity', () => {
    const capacities = [
      { ...capacity('alice'), ready: false },
      { ...capacity('bob'), workspaceId: 'other' },
    ];
    expect(run([request('caller')], capacities).action).toBe('wait');
    expect(
      run([request('caller')], [capacity('alice')], {}, 60).candidates[0]
        ?.reasons,
    ).toContain('stale_presence');
    expect(
      run([request('caller')], [{ ...capacity('alice'), endpoints: [] }])
        .candidates[0]?.reasons,
    ).toContain('device');
  });
  it('respects timezone windows, closure and holidays', () => {
    expect(
      run([request('caller')], undefined, { emergencyClosed: true }).reason,
    ).toBe('closed');
    expect(
      run([request('caller')], undefined, { closedDates: ['2026-09-13'] })
        .reason,
    ).toBe('closed');
    expect(
      run([request('caller')], undefined, {
        timezone: 'America/New_York',
        weekly: [{ day: 0, startMinute: 480, endMinute: 540 }],
      }).action,
    ).toBe('offer');
    expect(
      run([request('caller')], undefined, {
        weekly: [{ day: 0, startMinute: 0, endMinute: 720 }],
      }).reason,
    ).toBe('closed');
  });
  it('protects an unknown owner even after the caller wait budget', () => {
    const owned = applyRepCapacityAction(capacity('alice'), {
      schemaVersion: 1,
      workspaceId: 'tenant',
      capacityId: 'alice',
      operationId: 'offered',
      expectedVersion: 2,
      at: at(2),
      action: {
        type: 'offer',
        requestId: 'caller',
        assignmentId: 'uncertain',
        direction: 'inbound',
        endpointIds: ['web'],
      },
    });
    const external = applyRepCapacityAction(owned, {
      schemaVersion: 1,
      workspaceId: 'tenant',
      capacityId: 'alice',
      operationId: 'sent',
      expectedVersion: 3,
      at: at(3),
      action: {
        type: 'dispatch',
        assignmentId: 'uncertain',
        generation: 1,
        commandId: 'offer',
      },
    });
    const unknown = applyRepCapacityAction(external, {
      schemaVersion: 1,
      workspaceId: 'tenant',
      capacityId: 'alice',
      operationId: 'unknown',
      expectedVersion: 4,
      at: at(4),
      action: { type: 'unknown', assignmentId: 'uncertain', generation: 1 },
    });
    const result = run([request('caller')], [unknown], {
      maxWaitMilliseconds: 1,
    });
    expect(result.action).toBe('wait');
    expect(result.considered[0]?.reason).toBe('owned');
  });
  it('rejects invalid windows, ambiguous owners, oversized or future snapshots', () => {
    expect(() =>
      run([request('caller')], undefined, {
        weekly: [{ day: 0, startMinute: 900, endMinute: 100 }],
      }),
    ).toThrow();
    expect(() =>
      run([{ ...request('caller'), ownerRepId: 'alice' }]),
    ).toThrow();
    expect(() => run([request('future', 20)])).toThrow();
    expect(() =>
      run(
        [],
        Array.from({ length: 1001 }, () => capacity('alice')),
      ),
    ).toThrow();
  });
});

it('applies wall-clock business hours across repeated and skipped DST hours', () => {
  const localPolicy = {
    ...policy,
    timezone: 'America/New_York',
    weekly: [{ day: 0, startMinute: 60, endMinute: 120 }],
  };
  expect(isInboundQueueOpen(localPolicy, '2026-11-01T05:30:00.000Z')).toBe(
    true,
  );
  expect(isInboundQueueOpen(localPolicy, '2026-11-01T06:30:00.000Z')).toBe(
    true,
  );
  expect(isInboundQueueOpen(localPolicy, '2026-11-01T07:00:00.000Z')).toBe(
    false,
  );
  expect(isInboundQueueOpen(localPolicy, '2026-03-08T06:59:00.000Z')).toBe(
    true,
  );
  expect(isInboundQueueOpen(localPolicy, '2026-03-08T07:00:00.000Z')).toBe(
    false,
  );
  expect(() =>
    evaluateInboundRouting({
      policy: { ...policy, closedDates: ['2026-02-30'] },
      at: at(10),
      requests: [],
      capacities: [],
    }),
  ).toThrow();
});
