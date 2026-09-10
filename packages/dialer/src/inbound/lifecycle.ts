import {
  decodeInboundEvent,
  type InboundEvent,
  type InboundKind,
  type InboundSnapshot,
} from './contracts';

type Lifecycle = {
  initial: string;
  edges: Readonly<Record<string, readonly string[]>>;
};
const lifecycles: Record<InboundKind, Lifecycle> = {
  request: {
    initial: 'created',
    edges: {
      created: ['queued', 'rejected', 'provider_failure'],
      queued: [
        'offering',
        'abandoned',
        'callback_requested',
        'voicemail',
        'overflowed',
        'provider_failure',
      ],
      offering: [
        'queued',
        'bridging',
        'abandoned',
        'callback_requested',
        'provider_failure',
      ],
      bridging: ['queued', 'connected', 'abandoned', 'provider_failure'],
      connected: ['completed', 'provider_failure'],
    },
  },
  leg: {
    initial: 'ringing',
    edges: {
      ringing: ['answered', 'ended', 'failed'],
      answered: ['joined', 'ended', 'failed'],
      joined: ['reconnecting', 'ended', 'failed'],
      reconnecting: ['joined', 'ended', 'failed'],
    },
  },
  assignment: {
    initial: 'offering',
    edges: {
      offering: ['accepted', 'declined', 'expired', 'cancelled'],
      accepted: ['connecting', 'cancelled'],
      connecting: ['connected', 'unknown', 'failed'],
      unknown: ['connected', 'failed'],
      connected: ['ended'],
    },
  },
  bridge: {
    initial: 'pending',
    edges: {
      pending: ['connecting', 'cancelled'],
      connecting: ['connected', 'unknown', 'failed'],
      unknown: ['connected', 'failed'],
      connected: ['ended'],
    },
  },
  callback: {
    initial: 'requested',
    edges: {
      requested: ['scheduled', 'cancelled', 'expired'],
      scheduled: ['offering', 'cancelled', 'expired'],
      offering: ['scheduled', 'dialing', 'cancelled', 'expired'],
      dialing: ['connected', 'unknown', 'retry_due', 'exhausted'],
      unknown: ['connected', 'retry_due', 'exhausted', 'cancelled'],
      retry_due: ['scheduled', 'cancelled', 'expired'],
      connected: ['fulfilled'],
    },
  },
  capacity: {
    initial: 'available',
    edges: {
      available: ['reserved', 'unavailable'],
      unavailable: ['available'],
      reserved: ['connecting', 'available'],
      connecting: ['connected', 'unknown', 'available'],
      unknown: ['connected', 'available'],
      connected: ['wrap_up'],
      wrap_up: ['available', 'unavailable'],
    },
  },
};

export class InboundContractError extends Error {
  readonly _tag = 'InboundContractError';
}

const invalid = (message: string): never => {
  throw new InboundContractError(message);
};

export const applyInboundEvent = (
  previous: InboundSnapshot | null,
  input: InboundEvent,
): { snapshot: InboundSnapshot; applied: boolean } => {
  const event = decodeInboundEvent(input);
  const lifecycle = lifecycles[event.kind];
  const states = new Set([
    lifecycle.initial,
    ...Object.keys(lifecycle.edges),
    ...Object.values(lifecycle.edges).flat(),
  ]);
  if (!states.has(event.to)) invalid('Unknown lifecycle state');
  if (event.occurredAt > event.observedAt)
    invalid('Fact occurs after its observation');
  if (event.workspaceId !== previous?.workspaceId && previous)
    invalid('Tenant mismatch');
  if (
    previous &&
    (event.entityId !== previous.entityId ||
      event.kind !== previous.identity.kind)
  )
    invalid('Entity mismatch');
  if (event.expectedVersion !== (previous?.version ?? 0))
    invalid('State version conflict');
  if (!previous) {
    if (
      !event.identity ||
      event.identity.kind !== event.kind ||
      event.to !== lifecycle.initial
    )
      invalid('Invalid creation');
    const identity = event.identity!;
    if (identity.kind === 'request' && identity.enteredAt > event.occurredAt)
      invalid('Queue entry is in the future');
    if (
      identity.kind === 'assignment' &&
      identity.offerExpiresAt <= event.occurredAt
    )
      invalid('Offer already expired');
    if (
      identity.kind === 'callback' &&
      (identity.originalEnteredAt > event.occurredAt ||
        identity.dueAt > identity.deadlineAt ||
        identity.deadlineAt < event.occurredAt)
    )
      invalid('Invalid callback window');
    return {
      applied: true,
      snapshot: {
        schemaVersion: 1,
        workspaceId: event.workspaceId,
        entityId: event.entityId,
        identity,
        state: event.to,
        version: 1,
        createdAt: event.occurredAt,
        updatedAt: event.observedAt,
        lastOccurredAt: event.occurredAt,
      },
    };
  }
  if (event.identity) invalid('Identity is immutable');
  // Late terminal facts remain in history but cannot create another transition or command.
  if (!lifecycle.edges[previous.state] || event.to === previous.state)
    return { snapshot: previous, applied: false };
  if (
    event.observedAt < previous.updatedAt ||
    event.occurredAt < previous.lastOccurredAt
  )
    invalid('Contradictory transition time');
  if (!lifecycle.edges[previous.state]?.includes(event.to))
    invalid('Illegal lifecycle transition');
  if (
    previous.identity.kind === 'assignment' &&
    event.to === 'accepted' &&
    event.observedAt >= previous.identity.offerExpiresAt
  )
    invalid('Offer expired before acceptance');
  if (event.to === 'connected' && event.evidence !== 'participants_confirmed')
    invalid('Connection needs participant evidence');
  if (
    (event.kind === 'capacity' &&
      event.to === 'available' &&
      ['connecting', 'unknown'].includes(previous.state)) ||
    (previous.state === 'unknown' &&
      ['failed', 'retry_due', 'exhausted', 'cancelled'].includes(event.to)) ||
    (event.kind === 'assignment' &&
      previous.state === 'accepted' &&
      event.to === 'cancelled')
  ) {
    if (
      event.evidence !== 'reconciled_no_effect' &&
      event.evidence !== 'reconciled_ended'
    )
      invalid('Unknown effects require reconciliation');
  }
  return {
    applied: true,
    snapshot: {
      ...previous,
      state: event.to,
      version: previous.version + 1,
      updatedAt: event.observedAt,
      lastOccurredAt: event.occurredAt,
    },
  };
};

export const replayInboundEvents = (
  events: readonly InboundEvent[],
): InboundSnapshot | null =>
  events.reduce<InboundSnapshot | null>(
    (state, event) => applyInboundEvent(state, event).snapshot,
    null,
  );
