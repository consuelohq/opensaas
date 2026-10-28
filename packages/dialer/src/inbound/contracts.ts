import { Schema } from 'effect';

const id = Schema.String.pipe(Schema.pattern(/^[A-Za-z0-9_.:-]{1,160}$/));
const integer = Schema.Number.pipe(
  Schema.int(),
  Schema.nonNegative(),
  Schema.lessThanOrEqualTo(Number.MAX_SAFE_INTEGER),
);
const timestamp = Schema.String.pipe(
  Schema.filter(
    (value) =>
      /^\d{4}-\d{2}-\d{2}T/.test(value) &&
      Number.isFinite(Date.parse(value)) &&
      new Date(value).toISOString() === value,
  ),
);
export const InboundKindSchema = Schema.Literal(
  'request',
  'leg',
  'assignment',
  'bridge',
  'callback',
  'capacity',
);
export type InboundKind = typeof InboundKindSchema.Type;
export const InboundIdentitySchema = Schema.Union(
  Schema.Struct({
    kind: Schema.Literal('request'),
    queueId: id,
    enteredAt: timestamp,
  }),
  Schema.Struct({
    kind: Schema.Literal('leg'),
    requestId: id,
    role: Schema.Literal('caller', 'rep', 'consultant'),
  }),
  Schema.Struct({
    kind: Schema.Literal('assignment'),
    requestId: id,
    capacityId: id,
    generation: integer.pipe(Schema.positive()),
    offerExpiresAt: timestamp,
  }),
  Schema.Struct({
    kind: Schema.Literal('bridge'),
    requestId: id,
    assignmentId: id,
    callerLegId: id,
    repLegId: id,
  }),
  Schema.Struct({
    kind: Schema.Literal('callback'),
    requestId: id,
    originalEnteredAt: timestamp,
    dueAt: timestamp,
    deadlineAt: timestamp,
    consentReference: id,
  }),
  Schema.Struct({
    kind: Schema.Literal('capacity'),
    repId: id,
    slot: Schema.Literal(0),
  }),
);
export type InboundIdentity = typeof InboundIdentitySchema.Type;

export const InboundEventSchema = Schema.Struct({
  schemaVersion: Schema.Literal(1),
  eventId: id,
  workspaceId: id,
  entityId: id,
  kind: InboundKindSchema,
  expectedVersion: integer,
  occurredAt: timestamp,
  observedAt: timestamp,
  to: id,
  identity: Schema.optional(InboundIdentitySchema),
  evidence: Schema.Literal(
    'none',
    'reconciled_no_effect',
    'participants_confirmed',
    'reconciled_ended',
  ),
});
export type InboundEvent = typeof InboundEventSchema.Type;
export type InboundSnapshot = {
  readonly schemaVersion: 1;
  readonly workspaceId: string;
  readonly entityId: string;
  readonly identity: InboundIdentity;
  readonly state: string;
  readonly version: number;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly lastOccurredAt: string;
};
export const InboundCommandSchema = Schema.Struct({
  commandId: id,
  eventId: id,
  entityId: id,
  kind: InboundKindSchema,
  type: Schema.Literal(
    'offer',
    'bridge',
    'terminate_leg',
    'start_callback',
    'reconcile',
    'notify',
  ),
});
export type InboundCommand = typeof InboundCommandSchema.Type;
export const RoutingDecisionSchema = Schema.Struct({
  schemaVersion: Schema.Literal(1),
  decisionId: id,
  requestId: id,
  policyVersion: id,
  decidedAt: timestamp,
  queueId: id,
  queueVersion: integer,
  requestState: id,
  requestVersion: integer,
  waitingMilliseconds: integer,
  candidates: Schema.Array(
    Schema.Struct({
      repId: id,
      capacityId: id,
      capacityVersion: integer,
      capacityState: id,
      eligible: Schema.Boolean,
      reasons: Schema.Array(
        Schema.Literal(
          'available',
          'busy',
          'away',
          'skill',
          'queue',
          'cooldown',
          'device',
          'owner',
        ),
      ).pipe(Schema.maxItems(8)),
    }),
  ).pipe(Schema.maxItems(1000)),
  proposedCapacityId: Schema.NullOr(id),
});
export type RoutingDecision = typeof RoutingDecisionSchema.Type;

// Facts contain normalized identifiers and classifications, never raw provider payloads.
export const InboundCommitSchema = Schema.Struct({
  workspaceId: id,
  fact: Schema.Struct({
    source: id,
    eventKey: id,
    providerCallId: Schema.optional(id),
    occurredAt: timestamp,
    classification: id,
  }),
  events: Schema.Array(InboundEventSchema).pipe(
    Schema.minItems(1),
    Schema.maxItems(100),
  ),
  commands: Schema.Array(InboundCommandSchema).pipe(Schema.maxItems(100)),
  decision: Schema.optional(RoutingDecisionSchema),
});
export type InboundCommit = typeof InboundCommitSchema.Type;
export type InboundCommitResult = {
  readonly duplicate: boolean;
  readonly snapshots: readonly InboundSnapshot[];
};
export type InboundCommandStatus =
  | 'pending'
  | 'dispatched'
  | 'unknown'
  | 'succeeded'
  | 'failed';
export type InboundStoredCommand = {
  readonly workspaceId: string;
  readonly command: InboundCommand;
  readonly version: number;
  readonly status: InboundCommandStatus;
};
export const decodeInboundCommit = Schema.decodeUnknownSync(
  InboundCommitSchema,
  { onExcessProperty: 'error' },
);
export const decodeInboundEvent = Schema.decodeUnknownSync(InboundEventSchema, {
  onExcessProperty: 'error',
});
