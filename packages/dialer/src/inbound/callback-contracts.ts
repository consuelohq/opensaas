import { Schema } from 'effect';

const id = Schema.String.pipe(Schema.pattern(/^[A-Za-z0-9_.:-]{1,160}$/));
const duration = Schema.Number.pipe(
  Schema.int(),
  Schema.nonNegative(),
  Schema.lessThanOrEqualTo(2_147_483_647),
);
const timestamp = Schema.String.pipe(
  Schema.filter(
    (value) =>
      value.length === 24 &&
      Number.isFinite(Date.parse(value)) &&
      new Date(value).toISOString() === value,
  ),
);
const timezone = Schema.String.pipe(
  Schema.maxLength(100),
  Schema.filter((value) => {
    try {
      new Intl.DateTimeFormat('en-US', { timeZone: value }).format();
      return true;
    } catch {
      return false;
    }
  }),
);

export const CallbackPolicySchema = Schema.Struct({
  schemaVersion: Schema.Literal(1),
  policyVersion: id,
  activationReference: id,
  disclosure: Schema.String.pipe(Schema.minLength(1), Schema.maxLength(500)),
  maxAttempts: duration.pipe(Schema.positive(), Schema.lessThanOrEqualTo(10)),
  retryDelaysMilliseconds: Schema.Array(
    duration.pipe(Schema.positive(), Schema.lessThanOrEqualTo(86_400_000)),
  ).pipe(Schema.maxItems(9)),
  immediateWindowMilliseconds: duration.pipe(
    Schema.greaterThanOrEqualTo(60_000),
    Schema.lessThanOrEqualTo(86_400_000),
  ),
  recipientRetentionMilliseconds: duration.pipe(
    Schema.greaterThanOrEqualTo(60_000),
    Schema.lessThanOrEqualTo(30 * 86_400_000),
  ),
  customerRingSeconds: duration.pipe(
    Schema.greaterThanOrEqualTo(5),
    Schema.lessThanOrEqualTo(60),
  ),
});
export type CallbackPolicy = typeof CallbackPolicySchema.Type;

export const CallbackBookingRequestSchema = Schema.Struct({
  workspaceId: id,
  callbackId: id,
  revision: duration.pipe(Schema.positive()),
  timezone,
  windowStart: timestamp,
  windowEnd: timestamp,
});
export type CallbackBookingRequest = typeof CallbackBookingRequestSchema.Type;

export const CallbackBookingResultSchema = Schema.Struct({
  status: Schema.Literal('unavailable', 'requested', 'confirmed', 'cancelled'),
  providerReference: Schema.NullOr(id),
  evidenceReference: Schema.NullOr(id),
});
export type CallbackBookingResult = typeof CallbackBookingResultSchema.Type;

export const CallbackConsentRequestSchema = Schema.Struct({
  workspaceId: id,
  callbackId: id,
  consentReference: id,
  activationReference: id,
  requestedAt: timestamp,
});
export type CallbackConsentRequest = typeof CallbackConsentRequestSchema.Type;
export type CallbackConsentDecision = {
  readonly allowed: boolean;
  readonly evidenceReference: string | null;
  readonly reason: 'allowed' | 'missing' | 'expired' | 'policy_unavailable';
};

export const decodeCallbackPolicy = (raw: unknown): CallbackPolicy => {
  const policy = Schema.decodeUnknownSync(CallbackPolicySchema, {
    onExcessProperty: 'error',
  })(raw);
  if (policy.retryDelaysMilliseconds.length !== policy.maxAttempts - 1)
    throw new Error('Callback retry schedule must match the attempt limit');
  if (policy.recipientRetentionMilliseconds < policy.immediateWindowMilliseconds)
    throw new Error('Callback recipient retention must cover the service window');
  return policy;
};
export const decodeCallbackBookingRequest = Schema.decodeUnknownSync(
  CallbackBookingRequestSchema,
  { onExcessProperty: 'error' },
);
export const decodeCallbackBookingResult = Schema.decodeUnknownSync(
  CallbackBookingResultSchema,
  { onExcessProperty: 'error' },
);
