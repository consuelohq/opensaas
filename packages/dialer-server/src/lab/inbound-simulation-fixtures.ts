import type {
  InboundCommit,
  InboundEvent,
  InboundIdentity,
} from '@consuelo/dialer';

export const LAB_INBOUND_TIME = '2026-09-10T00:00:00.000Z';

export const createLabEvent = (
  workspaceId: string,
  eventId: string,
  overrides: Partial<InboundEvent> = {},
): InboundEvent => ({
  schemaVersion: 1,
  workspaceId,
  eventId,
  entityId: 'request',
  kind: 'request',
  expectedVersion: 0,
  occurredAt: LAB_INBOUND_TIME,
  observedAt: LAB_INBOUND_TIME,
  to: 'created',
  evidence: 'none',
  identity: { kind: 'request', queueId: 'queue', enteredAt: LAB_INBOUND_TIME },
  ...overrides,
});

export const createLabCommit = (
  workspaceId: string,
  events: readonly InboundEvent[],
  commands: InboundCommit['commands'] = [],
): InboundCommit => ({
  workspaceId,
  fact: {
    source: 'rd2-simulator',
    eventKey: events[0]!.eventId,
    occurredAt: events[0]!.occurredAt,
    classification: 'synthetic',
  },
  events,
  commands,
});

// Legal RD1 lifecycle fixture, not an implementation of RD3 assignment authorization.
export const createLabBridgeCommit = (workspaceId: string): InboundCommit => {
  const events: InboundEvent[] = [];
  const entity = (
    entityId: string,
    identity: InboundIdentity,
    states: string[],
  ) => {
    states.forEach((to, index) =>
      events.push(
        createLabEvent(workspaceId, entityId + '-' + to, {
          kind: identity.kind,
          entityId,
          identity: index === 0 ? identity : undefined,
          expectedVersion: index,
          to,
        }),
      ),
    );
  };
  entity(
    'request',
    { kind: 'request', queueId: 'queue', enteredAt: LAB_INBOUND_TIME },
    ['created', 'queued', 'offering', 'bridging'],
  );
  entity('capacity', { kind: 'capacity', repId: 'rep', slot: 0 }, [
    'available',
    'reserved',
    'connecting',
  ]);
  entity('caller', { kind: 'leg', role: 'caller', requestId: 'request' }, [
    'ringing',
    'answered',
    'joined',
  ]);
  entity('rep-leg', { kind: 'leg', role: 'rep', requestId: 'request' }, [
    'ringing',
    'answered',
    'joined',
  ]);
  entity(
    'assignment',
    {
      kind: 'assignment',
      requestId: 'request',
      capacityId: 'capacity',
      generation: 1,
      offerExpiresAt: '2026-09-10T00:00:12.000Z',
    },
    ['offering', 'accepted', 'connecting'],
  );
  entity(
    'bridge',
    {
      kind: 'bridge',
      requestId: 'request',
      assignmentId: 'assignment',
      callerLegId: 'caller',
      repLegId: 'rep-leg',
    },
    ['pending', 'connecting'],
  );
  return createLabCommit(workspaceId, events, [
    {
      commandId: workspaceId + '-bridge',
      eventId: 'bridge-connecting',
      entityId: 'bridge',
      kind: 'bridge',
      type: 'bridge',
    },
  ]);
};
