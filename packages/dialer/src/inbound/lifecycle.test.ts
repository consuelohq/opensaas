import { describe, expect, it } from 'bun:test';
import { applyInboundEvent, replayInboundEvents } from './lifecycle.js';
import type { InboundEvent } from './contracts.js';

const at = '2026-09-10T00:00:00.000Z';
const event = (overrides: Partial<InboundEvent> = {}): InboundEvent => ({
  schemaVersion: 1,
  eventId: 'event-1',
  workspaceId: 'tenant-1',
  entityId: 'leg-1',
  kind: 'leg',
  expectedVersion: 0,
  occurredAt: at,
  observedAt: at,
  to: 'ringing',
  identity: { kind: 'leg', requestId: 'request-1', role: 'caller' },
  evidence: 'none',
  ...overrides,
});

describe('inbound lifecycle', () => {
  it('should reconstruct the same state without commands during replay', () => {
    const events = [
      event(),
      event({
        eventId: 'event-2',
        expectedVersion: 1,
        identity: undefined,
        to: 'answered',
      }),
    ];
    const first = applyInboundEvent(null, events[0]!);
    const second = applyInboundEvent(first.snapshot, events[1]!);
    expect(replayInboundEvents(events)).toEqual(second.snapshot);
    expect(second.snapshot.version).toBe(2);
  });

  it('should retain a terminated leg when an older answered fact arrives', () => {
    const created = applyInboundEvent(null, event()).snapshot;
    const ended = applyInboundEvent(
      created,
      event({
        eventId: 'ended',
        expectedVersion: 1,
        identity: undefined,
        to: 'ended',
      }),
    ).snapshot;
    const late = applyInboundEvent(
      ended,
      event({
        eventId: 'late',
        expectedVersion: 2,
        identity: undefined,
        to: 'answered',
      }),
    );
    expect(late.applied).toBe(false);
    expect(late.snapshot).toEqual(ended);
  });

  it('should reject stale writers and contradictory timestamps', () => {
    const created = applyInboundEvent(null, event()).snapshot;
    expect(() =>
      applyInboundEvent(created, event({ to: 'answered' })),
    ).toThrow();
    expect(() =>
      applyInboundEvent(
        null,
        event({
          observedAt: '2026-09-09T00:00:00.000Z',
        }),
      ),
    ).toThrow();
    expect(() =>
      applyInboundEvent(null, event({ schemaVersion: 2 as 1 })),
    ).toThrow();
  });

  it('should separate offer expiry from protected connecting capacity', () => {
    let snapshot = applyInboundEvent(
      null,
      event({
        kind: 'capacity',
        entityId: 'slot-1',
        identity: { kind: 'capacity', repId: 'rep-1', slot: 0 },
        to: 'available',
      }),
    ).snapshot;
    snapshot = applyInboundEvent(
      snapshot,
      event({
        kind: 'capacity',
        entityId: 'slot-1',
        expectedVersion: 1,
        identity: undefined,
        to: 'reserved',
      }),
    ).snapshot;
    snapshot = applyInboundEvent(
      snapshot,
      event({
        kind: 'capacity',
        entityId: 'slot-1',
        expectedVersion: 2,
        identity: undefined,
        to: 'connecting',
      }),
    ).snapshot;
    expect(() =>
      applyInboundEvent(
        snapshot,
        event({
          kind: 'capacity',
          entityId: 'slot-1',
          expectedVersion: 3,
          identity: undefined,
          to: 'available',
        }),
      ),
    ).toThrow();
    expect(
      applyInboundEvent(
        snapshot,
        event({
          kind: 'capacity',
          entityId: 'slot-1',
          expectedVersion: 3,
          identity: undefined,
          to: 'available',
          evidence: 'reconciled_no_effect',
        }),
      ).snapshot.state,
    ).toBe('available');
  });

  it('should require media evidence for a bridge success', () => {
    const created = applyInboundEvent(
      null,
      event({
        kind: 'bridge',
        entityId: 'bridge-1',
        identity: {
          kind: 'bridge',
          requestId: 'request-1',
          assignmentId: 'assignment-1',
          callerLegId: 'leg-1',
          repLegId: 'leg-2',
        },
        to: 'pending',
      }),
    ).snapshot;
    const connecting = applyInboundEvent(
      created,
      event({
        kind: 'bridge',
        entityId: 'bridge-1',
        expectedVersion: 1,
        identity: undefined,
        to: 'connecting',
      }),
    ).snapshot;
    expect(() =>
      applyInboundEvent(
        connecting,
        event({
          kind: 'bridge',
          entityId: 'bridge-1',
          expectedVersion: 2,
          identity: undefined,
          to: 'connected',
        }),
      ),
    ).toThrow();
  });

  it('should reject accepting an expired assignment', () => {
    const created = applyInboundEvent(
      null,
      event({
        kind: 'assignment',
        entityId: 'assignment-1',
        identity: {
          kind: 'assignment',
          requestId: 'request-1',
          capacityId: 'slot-1',
          generation: 1,
          offerExpiresAt: '2026-09-10T00:00:12.000Z',
        },
        to: 'offering',
      }),
    ).snapshot;
    expect(() =>
      applyInboundEvent(
        created,
        event({
          kind: 'assignment',
          entityId: 'assignment-1',
          expectedVersion: 1,
          identity: undefined,
          to: 'accepted',
          observedAt: '2026-09-10T00:00:13.000Z',
        }),
      ),
    ).toThrow();
  });

  it('should reject identity replacement and cross-tenant replay', () => {
    const created = applyInboundEvent(null, event()).snapshot;
    expect(() =>
      applyInboundEvent(
        created,
        event({
          expectedVersion: 1,
          identity: { kind: 'leg', requestId: 'other', role: 'rep' },
          to: 'answered',
        }),
      ),
    ).toThrow();
    expect(() =>
      replayInboundEvents([
        event(),
        event({
          workspaceId: 'other',
          expectedVersion: 1,
          identity: undefined,
          to: 'answered',
        }),
      ]),
    ).toThrow();
  });
});
