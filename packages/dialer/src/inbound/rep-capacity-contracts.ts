import { Schema } from 'effect';

const id = Schema.String.pipe(Schema.pattern(/^[A-Za-z0-9_.:-]{1,160}$/));
const count = Schema.Number.pipe(
  Schema.int(),
  Schema.nonNegative(),
  Schema.lessThanOrEqualTo(Number.MAX_SAFE_INTEGER),
);
const duration = count.pipe(Schema.lessThanOrEqualTo(2_147_483_647));
const timestamp = Schema.String.pipe(
  Schema.filter(
    (value) =>
      Number.isFinite(Date.parse(value)) &&
      new Date(value).toISOString() === value &&
      value.length === 24,
  ),
);
export const RepCapacityPolicySchema = Schema.Struct({
  offerMilliseconds: duration.pipe(Schema.positive()),
  presenceMilliseconds: duration.pipe(Schema.positive()),
  wrapUpMilliseconds: duration,
  cooldownMilliseconds: duration,
  escalationMilliseconds: duration.pipe(Schema.positive()),
});
export type RepCapacityPolicy = typeof RepCapacityPolicySchema.Type;
const endpoint = Schema.Struct({
  endpointId: id,
  kind: Schema.Literal('browser', 'phone'),
  healthy: Schema.Boolean,
});
const fence = { assignmentId: id, generation: count.pipe(Schema.positive()) };
export const RepCapacityActionSchema = Schema.Union(
  Schema.Struct({
    type: Schema.Literal('register'),
    repId: id,
    policy: RepCapacityPolicySchema,
  }),
  Schema.Struct({
    type: Schema.Literal('readiness'),
    ready: Schema.Boolean,
    endpoints: Schema.Array(endpoint).pipe(Schema.maxItems(8)),
  }),
  Schema.Struct({
    type: Schema.Literal('offer'),
    assignmentId: id,
    requestId: id,
    direction: Schema.Literal('inbound', 'outbound'),
    endpointIds: Schema.Array(id).pipe(Schema.minItems(1), Schema.maxItems(8)),
  }),
  Schema.Struct({
    type: Schema.Literal('accept', 'decline'),
    ...fence,
    endpointId: id,
  }),
  Schema.Struct({ type: Schema.Literal('dispatch'), ...fence, commandId: id }),
  Schema.Struct({
    type: Schema.Literal('expire', 'cancel', 'unknown', 'escalate'),
    ...fence,
  }),
  Schema.Struct({
    type: Schema.Literal('reconcile'),
    ...fence,
    outcome: Schema.Literal('no_effect', 'ended', 'connected'),
    evidenceId: id,
  }),
  Schema.Struct({
    type: Schema.Literal('finish_wrap_up'),
    ...fence,
    manual: Schema.Boolean,
  }),
);
export type RepCapacityAction = typeof RepCapacityActionSchema.Type;
export const RepCapacityInputSchema = Schema.Struct({
  workspaceId: id,
  capacityId: id,
  operationId: id,
  expectedVersion: count,
  action: RepCapacityActionSchema,
});
export type RepCapacityInput = typeof RepCapacityInputSchema.Type;
export const RepCapacityEventSchema = Schema.Struct({
  ...RepCapacityInputSchema.fields,
  schemaVersion: Schema.Literal(1),
  at: timestamp,
  generationFloor: Schema.optional(count),
});
export type RepCapacityEvent = typeof RepCapacityEventSchema.Type;
export type RepCapacityOwner = {
  readonly assignmentId: string;
  readonly requestId: string;
  readonly direction: 'inbound' | 'outbound';
  readonly generation: number;
  readonly phase:
    | 'offering'
    | 'connecting'
    | 'connected'
    | 'unknown'
    | 'wrap_up';
  readonly offerExpiresAt: string;
  readonly endpoints: readonly {
    readonly endpointId: string;
    readonly kind: 'browser' | 'phone';
    readonly status: 'offered' | 'declined' | 'cancelled' | 'accepted';
  }[];
  readonly winnerEndpointId: string | null;
  readonly externalStarted: boolean;
  readonly connectedAt: string | null;
  readonly unknownSince: string | null;
  readonly escalatedAt: string | null;
  readonly wrapUpUntil: string | null;
};
export type RepCapacityState = {
  readonly schemaVersion: 1;
  readonly workspaceId: string;
  readonly capacityId: string;
  readonly repId: string;
  readonly version: number;
  readonly generation: number;
  readonly policy: RepCapacityPolicy;
  readonly ready: boolean;
  readonly endpoints: readonly (typeof endpoint.Type)[];
  readonly presenceAt: string;
  readonly updatedAt: string;
  readonly cooldownUntil: string | null;
  readonly idleSince: string;
  readonly owner: RepCapacityOwner | null;
};
export const decodeRepCapacityInput = Schema.decodeUnknownSync(
  RepCapacityInputSchema,
  { onExcessProperty: 'error' },
);
export const decodeRepCapacityEvent = Schema.decodeUnknownSync(
  RepCapacityEventSchema,
  { onExcessProperty: 'error' },
);
