import { describe, expect, it } from 'bun:test';
import {
  applyRepCapacityAction,
  isRepCapacityEligible,
  replayRepCapacityEvents,
} from './rep-capacity.js';
import type {
  RepCapacityAction,
  RepCapacityEvent,
  RepCapacityState,
} from './rep-capacity-contracts.js';

const policy = {
  offerMilliseconds: 12_000,
  presenceMilliseconds: 60_000,
  wrapUpMilliseconds: 30_000,
  cooldownMilliseconds: 5_000,
  escalationMilliseconds: 20_000,
};
const at = (seconds: number) =>
  new Date(Date.UTC(2026, 8, 10, 12, 0, seconds)).toISOString();
const events: RepCapacityEvent[] = [];
const apply = (
  state: RepCapacityState | null,
  action: RepCapacityAction,
  seconds = 0,
) => {
  const event: RepCapacityEvent = {
    schemaVersion: 1,
    workspaceId: 'tenant',
    capacityId: 'slot',
    operationId: 'op' + events.length,
    expectedVersion: state?.version ?? 0,
    at: at(seconds),
    action,
  };
  events.push(event);
  return applyRepCapacityAction(state, event);
};
const ready = () => {
  let state = apply(null, { type: 'register', repId: 'alice', policy });
  state = apply(state, {
    type: 'readiness',
    ready: true,
    endpoints: [
      { endpointId: 'web', kind: 'browser', healthy: true },
      { endpointId: 'phone', kind: 'phone', healthy: true },
    ],
  });
  return state;
};
const offer = (state = ready()) =>
  apply(
    state,
    {
      type: 'offer',
      assignmentId: 'assignment-a',
      requestId: 'request-a',
      direction: 'inbound',
      endpointIds: ['web', 'phone'],
    },
    1,
  );
const fence = { assignmentId: 'assignment-a', generation: 1 };

describe('shared rep capacity authority', () => {
  it('prevents an outbound assignment from taking an inbound reservation', () => {
    const state = offer();
    expect(() =>
      apply(
        state,
        {
          type: 'offer',
          assignmentId: 'outbound',
          requestId: 'request-b',
          direction: 'outbound',
          endpointIds: ['web'],
        },
        2,
      ),
    ).toThrow();
    expect(isRepCapacityEligible(state, at(2))).toBe(false);
  });
  it('commits one endpoint and invalidates every losing endpoint', () => {
    const state = apply(
      offer(),
      { type: 'accept', ...fence, endpointId: 'web' },
      2,
    );
    expect(state.owner?.winnerEndpointId).toBe('web');
    expect(state.owner?.phase).toBe('connecting');
    expect(
      state.owner?.endpoints.find((e) => e.endpointId === 'phone')?.status,
    ).toBe('cancelled');
    expect(() =>
      apply(state, { type: 'accept', ...fence, endpointId: 'phone' }, 3),
    ).toThrow();
  });
  it('rejects stale generation and exact-deadline accepts', () => {
    expect(() =>
      apply(
        offer(),
        { type: 'accept', ...fence, generation: 2, endpointId: 'web' },
        2,
      ),
    ).toThrow();
    expect(() =>
      apply(offer(), { type: 'accept', ...fence, endpointId: 'web' }, 13),
    ).toThrow();
  });
  it('retains capacity after an escaped offer times out and escalates without freeing it', () => {
    let state = apply(
      offer(),
      { type: 'dispatch', ...fence, commandId: 'offer-command' },
      2,
    );
    state = apply(state, { type: 'expire', ...fence }, 13);
    expect(state.owner?.phase).toBe('unknown');
    state = apply(state, { type: 'escalate', ...fence }, 33);
    expect(state.owner?.escalatedAt).toBe(at(33));
    expect(isRepCapacityEligible(state, at(90))).toBe(false);
    state = apply(
      state,
      {
        type: 'reconcile',
        ...fence,
        outcome: 'no_effect',
        evidenceId: 'provider-query',
      },
      34,
    );
    expect(state.owner).toBeNull();
  });
  it('releases only safe offers and advances the fencing generation on reassignment', () => {
    let state = apply(offer(), { type: 'expire', ...fence }, 13);
    expect(state.owner).toBeNull();
    state = apply(
      state,
      {
        type: 'offer',
        assignmentId: 'assignment-b',
        requestId: 'request-b',
        direction: 'outbound',
        endpointIds: ['web'],
      },
      20,
    );
    expect(state.generation).toBe(2);
    expect(() =>
      apply(state, { type: 'accept', ...fence, endpointId: 'web' }, 21),
    ).toThrow();
  });
  it('keeps wrap-up occupied and preserves manual away after it ends', () => {
    let state = apply(
      offer(),
      { type: 'accept', ...fence, endpointId: 'phone' },
      2,
    );
    state = apply(
      state,
      { type: 'dispatch', ...fence, commandId: 'bridge-command' },
      3,
    );
    state = apply(
      state,
      {
        type: 'reconcile',
        ...fence,
        outcome: 'connected',
        evidenceId: 'participants',
      },
      4,
    );
    expect(() =>
      apply(
        state,
        {
          type: 'reconcile',
          ...fence,
          outcome: 'no_effect',
          evidenceId: 'incorrect',
        },
        5,
      ),
    ).toThrow();
    state = apply(
      state,
      {
        type: 'reconcile',
        ...fence,
        outcome: 'ended',
        evidenceId: 'all-legs-ended',
      },
      6,
    );
    expect(state.owner?.phase).toBe('wrap_up');
    expect(() =>
      apply(state, { type: 'finish_wrap_up', ...fence, manual: false }, 7),
    ).toThrow();
    state = apply(state, { type: 'readiness', ready: false, endpoints: [] }, 8);
    state = apply(
      state,
      { type: 'finish_wrap_up', ...fence, manual: false },
      36,
    );
    expect(state.owner).toBeNull();
    expect(isRepCapacityEligible(state, at(36))).toBe(false);
  });
  it('does not equate presence with capacity or accept a declined endpoint', () => {
    let state = apply(
      offer(),
      { type: 'decline', ...fence, endpointId: 'phone' },
      2,
    );
    expect(() =>
      apply(state, { type: 'accept', ...fence, endpointId: 'phone' }, 3),
    ).toThrow();
    state = apply(state, { type: 'readiness', ready: false, endpoints: [] }, 3);
    expect(() =>
      apply(state, { type: 'accept', ...fence, endpointId: 'web' }, 4),
    ).toThrow();
    expect(isRepCapacityEligible(ready(), at(60))).toBe(false);
  });
  it('replays versioned history without creating effects and rejects cross-tenant events', () => {
    const start = events.length;
    const state = offer();
    expect(replayRepCapacityEvents(events.slice(start))).toEqual(state);
    expect(() =>
      applyRepCapacityAction(state, {
        ...events[start]!,
        workspaceId: 'other',
        expectedVersion: state.version,
      }),
    ).toThrow();
  });
});
