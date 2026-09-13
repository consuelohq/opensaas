import { Schema } from 'effect';
import type { RepCapacityState } from './rep-capacity-contracts.js';

const id = Schema.String.pipe(Schema.pattern(/^[A-Za-z0-9_.:-]{1,160}$/));
const count = Schema.Number.pipe(
  Schema.int(),
  Schema.nonNegative(),
  Schema.lessThanOrEqualTo(2_147_483_647),
);
const time = Schema.String.pipe(
  Schema.filter(
    (value) =>
      value.length === 24 &&
      Number.isFinite(Date.parse(value)) &&
      new Date(value).toISOString() === value,
  ),
);
export const InboundQueuePolicySchema = Schema.Struct({
  schemaVersion: Schema.Literal(1),
  policyVersion: id,
  workspaceId: id,
  queueId: id,
  timezone: Schema.String.pipe(
    Schema.maxLength(100),
    Schema.filter((value) => {
      try {
        new Intl.DateTimeFormat('en-US', { timeZone: value }).format();
        return true;
      } catch {
        return false;
      }
    }),
  ),
  weekly: Schema.Array(
    Schema.Struct({
      day: count.pipe(Schema.lessThanOrEqualTo(6)),
      startMinute: count.pipe(Schema.lessThan(1440)),
      endMinute: count.pipe(Schema.positive(), Schema.lessThanOrEqualTo(1440)),
    }),
  ).pipe(Schema.maxItems(50)),
  closedDates: Schema.Array(
    Schema.String.pipe(
      Schema.pattern(/^\d{4}-\d{2}-\d{2}$/),
      Schema.filter((value) => {
        const parsed = Date.parse(value + 'T00:00:00.000Z');
        return (
          Number.isFinite(parsed) &&
          new Date(parsed).toISOString().slice(0, 10) === value
        );
      }),
    ),
  ).pipe(Schema.maxItems(1000)),
  emergencyClosed: Schema.Boolean,
  maxWaitMilliseconds: count.pipe(Schema.positive()),
  maxOffers: count.pipe(Schema.positive(), Schema.lessThanOrEqualTo(100)),
  reofferMilliseconds: count.pipe(Schema.positive()),
  profiles: Schema.Array(
    Schema.Struct({
      repId: id,
      skills: Schema.Array(id).pipe(Schema.maxItems(64)),
    }),
  ).pipe(Schema.maxItems(1000)),
});
export type InboundQueuePolicy = typeof InboundQueuePolicySchema.Type;
export const RoutingRequestMetadataSchema = Schema.Struct({
  requiredSkills: Schema.Array(id).pipe(Schema.maxItems(64)),
  ownerRepId: Schema.NullOr(id),
  ownerStatus: Schema.Literal('known', 'missing', 'unavailable', 'ambiguous'),
  kind: Schema.Literal('live', 'callback'),
  notBefore: Schema.NullOr(time),
  deadline: Schema.NullOr(time),
});
export type RoutingRequestMetadata = typeof RoutingRequestMetadataSchema.Type;
export type RoutingAttempt = {
  readonly capacityId: string;
  readonly repId: string;
  readonly offeredAt: string;
  readonly retryAfter: string;
};
export type InboundRoutingRequest = RoutingRequestMetadata & {
  readonly workspaceId: string;
  readonly requestId: string;
  readonly queueId: string;
  readonly state: string;
  readonly version: number;
  readonly enteredAt: string;
  readonly attempts: readonly RoutingAttempt[];
};
export type InboundRoutingFrame = {
  readonly policy: InboundQueuePolicy;
  readonly at: string;
  readonly requests: readonly InboundRoutingRequest[];
  readonly capacities: readonly RepCapacityState[];
};
export type RoutingExclusion =
  | 'tenant'
  | 'queue'
  | 'skill'
  | 'busy'
  | 'away'
  | 'stale_presence'
  | 'device'
  | 'cooldown'
  | 'repeat';
export type RoutingCandidateEvidence = {
  readonly capacityId: string;
  readonly repId: string;
  readonly version: number;
  readonly eligible: boolean;
  readonly reasons: readonly RoutingExclusion[];
  readonly idleSince: string;
  readonly ownerPreferred: boolean;
};
export type InboundRoutingEvaluation = {
  readonly schemaVersion: 2;
  readonly policyVersion: string;
  readonly decidedAt: string;
  readonly queueOpen: boolean;
  readonly requestId: string | null;
  readonly action: 'offer' | 'fallback' | 'wait';
  readonly reason:
    | 'owner'
    | 'longest_idle'
    | 'closed'
    | 'max_wait'
    | 'max_offers'
    | 'deadline'
    | 'no_capacity'
    | 'not_due'
    | 'empty';
  readonly proposedCapacityId: string | null;
  readonly candidates: readonly RoutingCandidateEvidence[];
  readonly considered: readonly {
    requestId: string;
    reason: string;
    waitingMilliseconds: number;
  }[];
};
export const decodeInboundQueuePolicy = Schema.decodeUnknownSync(
  InboundQueuePolicySchema,
  { onExcessProperty: 'error' },
);
export const decodeRoutingRequestMetadata = Schema.decodeUnknownSync(
  RoutingRequestMetadataSchema,
  { onExcessProperty: 'error' },
);
