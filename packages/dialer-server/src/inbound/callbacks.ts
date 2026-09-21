import { createHash, randomUUID } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import {
  applyCallbackAction,
  decodeCallbackBookingResult,
  decodeCallbackPolicy,
  decodeRoutingRequestMetadata,
  evaluateCallbackSchedule,
  isInboundQueueOpen,
  type CallbackAction,
  type CallbackBookingRequest,
  type CallbackBookingResult,
  type CallbackConsentDecision,
  type CallbackConsentRequest,
  type CallbackObligationState,
  type CallbackPolicy,
  type InboundEvent,
  type InboundQueuePolicy,
  type RoutingRequestMetadata,
} from '@consuelo/dialer';
import {
  commitInboundFactOnClient,
  readInboundSnapshot,
  withInboundTransaction,
} from './postgres-journal';
import { createPostgresInboundRouting } from './routing';
import { routingTime } from './routing-store';
import { createPostgresRepCapacity } from './rep-capacity';
import { moveTelephonyEntity, telephonyId } from './telephony-store';
import type { CallbackRecipientCipher } from './callback-recipient-cipher';

const id = (value: string, label: string) => {
  if (!/^[A-Za-z0-9_.:-]{1,160}$/.test(value))
    throw new Error(`Invalid ${label}`);
  return value;
};
const e164 = (value: string) => {
  if (!/^\+[1-9]\d{7,14}$/.test(value))
    throw new Error('Callback recipient must use canonical E.164');
  return value;
};
const timestamp = (value: string, label: string) => {
  if (
    value.length !== 24 ||
    !Number.isFinite(Date.parse(value)) ||
    new Date(value).toISOString() !== value
  )
    throw new Error(`Invalid ${label}`);
  return value;
};
const digestId = (...parts: string[]) =>
  'cb:' + createHash('sha256').update(JSON.stringify(parts)).digest('hex');

export type CallbackRoutingMetadata = Pick<
  RoutingRequestMetadata,
  'requiredSkills' | 'ownerRepId' | 'ownerStatus'
>;

export type CallbackRequestInput = {
  readonly operationId: string;
  readonly workspaceId: string;
  readonly callbackId: string;
  readonly requestId: string;
  readonly sourceRequestId: string | null;
  readonly numberId: string;
  readonly queueId: string;
  readonly originalEnteredAt: string;
  readonly consentReference: string;
  readonly recipient: string;
  readonly timezone: string;
  readonly notBefore: string;
  readonly deadline: string;
  readonly metadata: CallbackRoutingMetadata;
  readonly policy: CallbackPolicy;
};

type StoredCallback = {
  workspace_id: string;
  callback_id: string;
  request_id: string;
  source_request_id: string | null;
  queue_id: string;
  number_id: string;
  version: number;
  state: CallbackObligationState;
  policy: CallbackPolicy;
  recipient_ciphertext: string | null;
  recipient_expires_at: Date;
};

export type CallbackRead = {
  readonly state: CallbackObligationState;
  readonly policy: CallbackPolicy;
  readonly numberId: string;
  readonly recipientRetained: boolean;
  readonly recipientExpiresAt: string;
};

export type CallbackBookingRead =
  | CallbackBookingResult
  | {
      readonly status: 'cancel_pending';
      readonly providerReference: string;
      readonly evidenceReference: null;
    };

export type CallbackCalendarAdapter = {
  readonly book: (input: CallbackBookingRequest) => Promise<CallbackBookingResult>;
  readonly cancel: (
    input: CallbackBookingRequest & { readonly providerReference: string },
  ) => Promise<CallbackBookingResult>;
};
export type CallbackConsentAdapter = (
  input: CallbackConsentRequest,
) => Promise<CallbackConsentDecision>;

export type CallbackStoreOptions = {
  readonly pool: Pool;
  readonly recipientCipher: CallbackRecipientCipher;
  readonly clock?: () => string;
  readonly consent?: CallbackConsentAdapter;
  readonly calendar?: CallbackCalendarAdapter;
};

export const cancelConfirmedCallbackBooking = async (input: {
  readonly booking: CallbackBookingResult;
  readonly request: CallbackBookingRequest;
  readonly calendar?: CallbackCalendarAdapter;
}): Promise<CallbackBookingResult> => {
  try {
    if (input.booking.status !== 'confirmed') return input.booking;
    if (!input.booking.providerReference)
      throw new Error('Confirmed callback booking is missing its provider reference');
    if (!input.calendar)
      throw new Error('Confirmed callback booking requires a calendar adapter');
    const result = decodeCallbackBookingResult(
      await input.calendar.cancel({
        ...input.request,
        providerReference: input.booking.providerReference,
      }),
    );
    if (result.status !== 'cancelled')
      throw new Error('Callback provider booking was not confirmed cancelled');
    return {
      ...result,
      providerReference: result.providerReference ?? input.booking.providerReference,
    };
  } catch (cause: unknown) {
    if (cause instanceof Error) throw cause;
    throw new Error('Callback provider booking cancellation rejected with a non-Error cause', {
      cause,
    });
  }
};

const eventId = (operationId: string, suffix: string) =>
  digestId(operationId, suffix);
const recipientReference = (callbackId: string) => digestId(callbackId, 'recipient');

const callbackRoutingMetadata = (
  input: Pick<
    CallbackRequestInput,
    'metadata' | 'notBefore' | 'deadline'
  >,
) =>
  decodeRoutingRequestMetadata({
    ...input.metadata,
    kind: 'callback',
    notBefore: input.notBefore,
    deadline: input.deadline,
  });

const loadCallback = async (
  client: Pool | PoolClient,
  workspaceId: string,
  callbackId: string,
  lock = false,
): Promise<StoredCallback | null> => {
  try {
  const row = await client.query<StoredCallback>(
    `SELECT * FROM dialer_callback_obligations
     WHERE workspace_id=$1 AND callback_id=$2${lock ? ' FOR UPDATE' : ''}`,
    [workspaceId, callbackId],
  );
  return row.rows[0] ?? null;

  } catch (cause: unknown) {
    if (cause instanceof Error) throw cause;
    throw new Error('Async operation rejected with a non-Error cause', { cause });
  }
};

const readQueuePolicy = async (
  client: Pool | PoolClient,
  workspaceId: string,
  queueId: string,
) => {
  try {
  const row = await client.query<{ policy: InboundQueuePolicy }>(
    'SELECT policy FROM dialer_routing_queues WHERE workspace_id=$1 AND queue_id=$2',
    [workspaceId, queueId],
  );
  if (!row.rows[0]) throw new Error('Callback queue is not configured');
  return row.rows[0].policy;

  } catch (cause: unknown) {
    if (cause instanceof Error) throw cause;
    throw new Error('Async operation rejected with a non-Error cause', { cause });
  }
};

const createEvents = (
  input: CallbackRequestInput,
  at: string,
): InboundEvent[] => [
  {
    schemaVersion: 1,
    eventId: eventId(input.operationId, 'request-created'),
    workspaceId: input.workspaceId,
    entityId: input.requestId,
    kind: 'request',
    expectedVersion: 0,
    occurredAt: at,
    observedAt: at,
    to: 'created',
    evidence: 'none',
    identity: {
      kind: 'request',
      queueId: input.queueId,
      enteredAt: input.originalEnteredAt,
    },
  },
  {
    schemaVersion: 1,
    eventId: eventId(input.operationId, 'request-queued'),
    workspaceId: input.workspaceId,
    entityId: input.requestId,
    kind: 'request',
    expectedVersion: 1,
    occurredAt: at,
    observedAt: at,
    to: 'queued',
    evidence: 'none',
  },
  {
    schemaVersion: 1,
    eventId: eventId(input.operationId, 'callback-requested'),
    workspaceId: input.workspaceId,
    entityId: input.callbackId,
    kind: 'callback',
    expectedVersion: 0,
    occurredAt: at,
    observedAt: at,
    to: 'requested',
    evidence: 'none',
    identity: {
      kind: 'callback',
      requestId: input.requestId,
      originalEnteredAt: input.originalEnteredAt,
      dueAt: input.notBefore,
      deadlineAt: input.deadline,
      consentReference: input.consentReference,
    },
  },
  {
    schemaVersion: 1,
    eventId: eventId(input.operationId, 'callback-scheduled'),
    workspaceId: input.workspaceId,
    entityId: input.callbackId,
    kind: 'callback',
    expectedVersion: 1,
    occurredAt: at,
    observedAt: at,
    to: 'scheduled',
    evidence: 'none',
  },
];

const updateRoutingWindow = async (
  client: PoolClient,
  row: StoredCallback,
  notBefore: string,
  deadline: string,
) => {
  try {
  const current = await client.query<{
    version: number;
    metadata: RoutingRequestMetadata;
  }>(
    'SELECT version,metadata FROM dialer_routing_entries WHERE workspace_id=$1 AND request_id=$2',
    [row.workspace_id, row.request_id],
  );
  if (!current.rows[0]) throw new Error('Callback routing entry is missing');
  const metadata = decodeRoutingRequestMetadata({
    ...current.rows[0].metadata,
    kind: 'callback',
    notBefore,
    deadline,
  });
  await client.query(
    `UPDATE dialer_routing_entries
       SET version=$3,metadata=$4,routing_state='waiting',fallback_decision_id=NULL
     WHERE workspace_id=$1 AND request_id=$2`,
    [
      row.workspace_id,
      row.request_id,
      current.rows[0].version + 1,
      JSON.stringify(metadata),
    ],
  );

  } catch (cause: unknown) {
    if (cause instanceof Error) throw cause;
    throw new Error('Async operation rejected with a non-Error cause', { cause });
  }
};

const terminal = (status: CallbackObligationState['status']) =>
  ['fulfilled', 'cancelled', 'exhausted', 'expired'].includes(status);

export const createPostgresCallbacks = (options: CallbackStoreOptions) => {
  const { pool } = options;
  const routing = createPostgresInboundRouting(pool, { clock: options.clock });
  const capacity = createPostgresRepCapacity(pool, { clock: options.clock });

  const operationAlreadyApplied = async (workspaceId: string, operationId: string) => {
    try {
      const result = await pool.query(
        `SELECT 1 FROM dialer_callback_events
         WHERE workspace_id=$1 AND operation_id=$2 LIMIT 1`,
        [workspaceId, operationId],
      );
      return Boolean(result.rowCount);
    } catch (cause: unknown) {
      if (cause instanceof Error) throw cause;
      throw new Error('Callback operation lookup rejected with a non-Error cause', {
        cause,
      });
    }
  };

  const readBookingForRevision = async (
    workspaceId: string,
    callbackId: string,
    revision: number,
  ): Promise<CallbackBookingRead | null> => {
    try {
      const existing = await pool.query<{
        status: CallbackBookingResult['status'];
        provider_reference: string | null;
        evidence_reference: string | null;
      }>(
        `SELECT status,provider_reference,evidence_reference
         FROM dialer_callback_bookings
         WHERE workspace_id=$1 AND callback_id=$2 AND revision=$3`,
        [workspaceId, callbackId, revision],
      );
      const stored = existing.rows[0];
      if (!stored) return null;
      if (stored.status !== 'confirmed')
        return {
          status: stored.status,
          providerReference: stored.provider_reference,
          evidenceReference: stored.evidence_reference,
        };

      const events = await pool.query<{
        event_kind: 'cancel_dispatched' | 'cancelled';
        provider_reference: string;
        evidence_reference: string | null;
      }>(
        `SELECT event_kind,provider_reference,evidence_reference
         FROM dialer_callback_booking_events
         WHERE workspace_id=$1 AND callback_id=$2 AND revision=$3`,
        [workspaceId, callbackId, revision],
      );
      const cancelled = events.rows.find((event) => event.event_kind === 'cancelled');
      if (cancelled)
        return {
          status: 'cancelled',
          providerReference: cancelled.provider_reference,
          evidenceReference: cancelled.evidence_reference,
        };
      if (events.rows.some((event) => event.event_kind === 'cancel_dispatched'))
        return {
          status: 'cancel_pending',
          providerReference: stored.provider_reference!,
          evidenceReference: null,
        };
      return {
        status: stored.status,
        providerReference: stored.provider_reference,
        evidenceReference: stored.evidence_reference,
      };
    } catch (cause: unknown) {
      if (cause instanceof Error) throw cause;
      throw new Error('Callback booking lookup rejected with a non-Error cause', {
        cause,
      });
    }
  };

  const cancelConfirmedBookingForRevision = async (row: StoredCallback) => {
    try {
      const stored = await readBookingForRevision(
        row.workspace_id,
        row.callback_id,
        row.state.revision,
      );
      if (stored?.status === 'cancel_pending')
        throw new Error('Callback provider booking cancellation outcome is unknown');
      if (!stored || stored.status !== 'confirmed') return;
      if (!stored.providerReference)
        throw new Error('Confirmed callback booking is missing its provider reference');
      if (!options.calendar)
        throw new Error('Confirmed callback booking requires a calendar adapter');
      const request: CallbackBookingRequest = {
        workspaceId: row.workspace_id,
        callbackId: row.callback_id,
        revision: row.state.revision,
        timezone: row.state.timezone,
        windowStart: row.state.notBefore,
        windowEnd: row.state.deadline,
      };
      const dispatched = await pool.query(
        `INSERT INTO dialer_callback_booking_events(
           workspace_id,callback_id,revision,event_kind,provider_reference,evidence_reference
         ) VALUES($1,$2,$3,'cancel_dispatched',$4,NULL)
         ON CONFLICT DO NOTHING RETURNING event_kind`,
        [
          row.workspace_id,
          row.callback_id,
          row.state.revision,
          stored.providerReference,
        ],
      );
      if (dispatched.rowCount !== 1) {
        const current = await readBookingForRevision(
          row.workspace_id,
          row.callback_id,
          row.state.revision,
        );
        if (current?.status === 'cancelled') return;
        throw new Error('Callback provider booking cancellation outcome is unknown');
      }
      const cancelled = await cancelConfirmedCallbackBooking({
        booking: stored,
        request,
        calendar: options.calendar,
      });
      if (!cancelled.providerReference || !cancelled.evidenceReference)
        throw new Error('Callback provider booking cancellation is missing durable evidence');
      await pool.query(
        `INSERT INTO dialer_callback_booking_events(
           workspace_id,callback_id,revision,event_kind,provider_reference,evidence_reference
         ) VALUES($1,$2,$3,'cancelled',$4,$5)
         ON CONFLICT DO NOTHING`,
        [
          row.workspace_id,
          row.callback_id,
          row.state.revision,
          cancelled.providerReference,
          cancelled.evidenceReference,
        ],
      );
      const current = await readBookingForRevision(
        row.workspace_id,
        row.callback_id,
        row.state.revision,
      );
      if (current?.status !== 'cancelled')
        throw new Error('Callback provider booking cancellation could not be persisted');
    } catch (cause: unknown) {
      if (cause instanceof Error) throw cause;
      throw new Error('Callback booking reconciliation rejected with a non-Error cause', {
        cause,
      });
    }
  };

  const projectAction = async (
    client: PoolClient,
    before: CallbackObligationState,
    after: CallbackObligationState,
    action: CallbackAction,
  ) => {
    try {
    const callback = await readInboundSnapshot(
      client,
      before.workspaceId,
      'callback',
      before.callbackId,
    );
    const request = await readInboundSnapshot(
      client,
      before.workspaceId,
      'request',
      before.requestId,
    );
    if (!callback || !request)
      throw new Error('Callback journal projection is missing');
    const callbackMove = (
      to: string,
      evidence: InboundEvent['evidence'] = 'none',
      command?: 'start_callback',
      commandId?: string,
    ) =>
      moveTelephonyEntity(
        client,
        before.workspaceId,
        'callback',
        before.callbackId,
        to,
        { evidence, command, commandId, clock: options.clock },
      );
    const requestMove = (
      to: string,
      evidence: InboundEvent['evidence'] = 'none',
    ) =>
      moveTelephonyEntity(
        client,
        before.workspaceId,
        'request',
        before.requestId,
        to,
        { evidence, clock: options.clock },
      );

    if (action.type === 'record_attempt') {
      if (callback.state === 'retry_due') await callbackMove('scheduled');
      await callbackMove('offering');
      if (request.state === 'queued') await requestMove('offering');
      return;
    }
    if (action.type === 'reschedule') {
      if (callback.state === 'retry_due') await callbackMove('scheduled');
      return;
    }
    if (action.type === 'attempt_result') {
      if (action.outcome === 'dialing') {
        const commandId = telephonyId(
          before.callbackId,
          action.attemptId,
          'start-callback',
        );
        await callbackMove('dialing', 'none', 'start_callback', commandId);
        if (request.state === 'offering') await requestMove('bridging');
        return;
      }
      if (action.outcome === 'unknown') {
        if (callback.state === 'dialing') await callbackMove('unknown');
        return;
      }
      if (action.outcome === 'connected') {
        await callbackMove('connected', 'participants_confirmed');
        if (request.state === 'bridging')
          await requestMove('connected', 'participants_confirmed');
        return;
      }
      if (action.outcome === 'no_answer' || action.outcome === 'failed') {
        const evidence =
          callback.state === 'unknown' ? 'reconciled_no_effect' : 'none';
        await callbackMove(after.status, evidence);
        const currentRequest = await readInboundSnapshot(
          client,
          before.workspaceId,
          'request',
          before.requestId,
        );
        if (currentRequest?.state === 'bridging' || currentRequest?.state === 'offering')
          await requestMove('queued');
        if (after.status === 'exhausted') await requestMove('overflowed');
        return;
      }
      return;
    }
    if (action.type === 'cancel') {
      if (after.status === 'cancel_pending') {
        if (callback.state === 'dialing') await callbackMove('unknown');
        return;
      }
      const currentCallback = await readInboundSnapshot(
        client,
        before.workspaceId,
        'callback',
        before.callbackId,
      );
      await callbackMove(
        'cancelled',
        currentCallback?.state === 'unknown' ? 'reconciled_ended' : 'none',
      );
      const currentRequest = await readInboundSnapshot(
        client,
        before.workspaceId,
        'request',
        before.requestId,
      );
      if (
        currentRequest &&
        ['created', 'queued', 'offering', 'bridging', 'connected'].includes(
          currentRequest.state,
        )
      )
        await requestMove('abandoned');
      return;
    }
    if (action.type === 'expire' || action.type === 'exhaust') {
      await callbackMove(after.status);
      const currentRequest = await readInboundSnapshot(
        client,
        before.workspaceId,
        'request',
        before.requestId,
      );
      if (currentRequest?.state === 'offering' || currentRequest?.state === 'bridging')
        await requestMove('queued');
      const queued = await readInboundSnapshot(
        client,
        before.workspaceId,
        'request',
        before.requestId,
      );
      if (queued?.state === 'queued') await requestMove('overflowed');
      return;
    }
    if (action.type === 'fulfill') {
      await callbackMove('fulfilled');
      if (request.state === 'connected') await requestMove('completed');
    }
  
    } catch (cause: unknown) {
      if (cause instanceof Error) throw cause;
      throw new Error('Async operation rejected with a non-Error cause', { cause });
    }
  };

  const applyOnClient = async (
    client: PoolClient,
    workspaceId: string,
    callbackId: string,
    action: CallbackAction,
  ) => {
    try {
    const duplicate = await client.query<{ snapshot: CallbackObligationState }>(
      'SELECT snapshot FROM dialer_callback_events WHERE workspace_id=$1 AND operation_id=$2',
      [workspaceId, action.operationId],
    );
    if (duplicate.rows[0])
      return { duplicate: true as const, state: duplicate.rows[0].snapshot };
    const row = await loadCallback(client, workspaceId, callbackId, true);
    if (!row) throw new Error('Callback obligation is missing');
    if (action.type === 'reschedule' && !row.recipient_ciphertext)
      throw new Error('Callback recipient has been purged');
    const before = row.state;
    const after = applyCallbackAction(before, action);
    await projectAction(client, before, after, action);
    let recipientExpiresAt = action.type === 'reschedule'
      ? new Date(Date.parse(after.deadline) + row.policy.recipientRetentionMilliseconds).toISOString()
      : row.recipient_expires_at.toISOString();
    if (terminal(after.status)) {
      recipientExpiresAt = new Date(
        Math.min(
          Date.parse(recipientExpiresAt),
          Date.parse(action.at) + row.policy.recipientRetentionMilliseconds,
        ),
      ).toISOString();
    }
    await client.query(
      `UPDATE dialer_callback_obligations
         SET version=$3,state=$4,recipient_expires_at=$5
       WHERE workspace_id=$1 AND callback_id=$2`,
      [workspaceId, callbackId, after.version, JSON.stringify(after), recipientExpiresAt],
    );
    await client.query(
      `INSERT INTO dialer_callback_events(
         workspace_id,callback_id,operation_id,version,action,snapshot
       ) VALUES($1,$2,$3,$4,$5,$6)`,
      [
        workspaceId,
        callbackId,
        action.operationId,
        after.version,
        JSON.stringify(action),
        JSON.stringify(after),
      ],
    );
    if (action.type === 'reschedule')
      await updateRoutingWindow(client, row, after.notBefore, after.deadline);
    if (
      action.type === 'attempt_result' &&
      after.status === 'retry_due' &&
      after.attempts[after.attempts.length - 1]?.nextEligibleAt
    )
      await updateRoutingWindow(
        client,
        row,
        after.attempts[after.attempts.length - 1]!.nextEligibleAt!,
        after.deadline,
      );
    if (terminal(after.status) || after.status === 'cancel_pending')
      await client.query(
        `UPDATE dialer_routing_entries SET routing_state='fallback'
         WHERE workspace_id=$1 AND request_id=$2`,
        [workspaceId, row.request_id],
      );
    return { duplicate: false as const, state: after };
  
    } catch (cause: unknown) {
      if (cause instanceof Error) throw cause;
      throw new Error('Async operation rejected with a non-Error cause', { cause });
    }
  };

  const authorize = async (input: CallbackRequestInput, at: string) => {
    try {
    if (!options.consent) throw new Error('Callback consent policy is unavailable');
    const decision = await options.consent({
      workspaceId: input.workspaceId,
      callbackId: input.callbackId,
      consentReference: input.consentReference,
      activationReference: input.policy.activationReference,
      requestedAt: at,
    });
    if (!decision.allowed || !decision.evidenceReference)
      throw new Error('Callback consent or eligibility was not proven');
    return decision.evidenceReference;
  
    } catch (cause: unknown) {
      if (cause instanceof Error) throw cause;
      throw new Error('Async operation rejected with a non-Error cause', { cause });
    }
  };

  const requestOnClient = async (
    client: PoolClient,
    raw: CallbackRequestInput,
    authorityAt?: string,
  ) => {
    try {
    const input = {
      ...raw,
      workspaceId: id(raw.workspaceId, 'callback workspace'),
      callbackId: id(raw.callbackId, 'callback identity'),
      requestId: id(raw.requestId, 'callback request identity'),
      sourceRequestId:
        raw.sourceRequestId === null
          ? null
          : id(raw.sourceRequestId, 'callback source request'),
      numberId: id(raw.numberId, 'callback number'),
      queueId: id(raw.queueId, 'callback queue'),
      consentReference: id(raw.consentReference, 'callback consent reference'),
      recipient: e164(raw.recipient),
      originalEnteredAt: timestamp(raw.originalEnteredAt, 'callback entry time'),
      notBefore: timestamp(raw.notBefore, 'callback not-before'),
      deadline: timestamp(raw.deadline, 'callback deadline'),
      policy: decodeCallbackPolicy(raw.policy),
    };
    const at = authorityAt ?? (await routingTime(client, options.clock));
    const priorOperation = await client.query<{ snapshot: CallbackObligationState }>(
      'SELECT snapshot FROM dialer_callback_events WHERE workspace_id=$1 AND operation_id=$2',
      [input.workspaceId, input.operationId],
    );
    if (priorOperation.rows[0])
      return { duplicate: true as const, state: priorOperation.rows[0].snapshot };
    if (await loadCallback(client, input.workspaceId, input.callbackId, true))
      throw new Error('Callback identity already exists with another operation');
    if (input.deadline <= at || input.notBefore > input.deadline)
      throw new Error('Callback service window is no longer fulfillable');
    const queuePolicy = await readQueuePolicy(client, input.workspaceId, input.queueId);
    if (queuePolicy.timezone !== input.timezone)
      throw new Error('Callback timezone must match the queue authority');
    if (!isInboundQueueOpen(queuePolicy, input.notBefore))
      throw new Error('Callback service window must begin during staffed hours');
    if (input.sourceRequestId) {
      const source = await readInboundSnapshot(
        client,
        input.workspaceId,
        'request',
        input.sourceRequestId,
      );
      if (
        source?.identity.kind !== 'request' ||
        source.identity.queueId !== input.queueId ||
        source.identity.enteredAt !== input.originalEnteredAt
      )
        throw new Error('Callback source request evidence does not match');
    }
    const state: CallbackObligationState = {
      schemaVersion: 1,
      workspaceId: input.workspaceId,
      callbackId: input.callbackId,
      requestId: input.requestId,
      sourceRequestId: input.sourceRequestId,
      queueId: input.queueId,
      originalEnteredAt: input.originalEnteredAt,
      consentReference: input.consentReference,
      recipientReference: recipientReference(input.callbackId),
      timezone: input.timezone,
      notBefore: input.notBefore,
      deadline: input.deadline,
      revision: 1,
      version: 1,
      status: 'scheduled',
      attempts: [],
      updatedAt: at,
      appliedOperations: [input.operationId],
    };
    evaluateCallbackSchedule(state, at, input.policy.maxAttempts);
    const metadata = callbackRoutingMetadata(input);
    await commitInboundFactOnClient(client, {
      workspaceId: input.workspaceId,
      fact: {
        source: 'callback-v1',
        eventKey: input.operationId,
        occurredAt: at,
        classification: 'scheduled',
      },
      events: createEvents(input, at),
      commands: [],
    });
    await client.query(
      `INSERT INTO dialer_routing_entries(
         workspace_id,request_id,queue_id,version,metadata
       ) VALUES($1,$2,$3,1,$4)`,
      [input.workspaceId, input.requestId, input.queueId, JSON.stringify(metadata)],
    );
    const ciphertext = options.recipientCipher.encrypt(
      input.workspaceId,
      input.recipient,
    );
    const recipientExpiresAt = new Date(
      Date.parse(input.deadline) + input.policy.recipientRetentionMilliseconds,
    ).toISOString();
    await client.query(
      `INSERT INTO dialer_callback_obligations(
        workspace_id,callback_id,request_id,source_request_id,queue_id,number_id,
        version,state,policy,recipient_ciphertext,recipient_expires_at
       ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [
        input.workspaceId,
        input.callbackId,
        input.requestId,
        input.sourceRequestId,
        input.queueId,
        input.numberId,
        state.version,
        JSON.stringify(state),
        JSON.stringify(input.policy),
        ciphertext,
        recipientExpiresAt,
      ],
    );
    await client.query(
      `INSERT INTO dialer_callback_events(
         workspace_id,callback_id,operation_id,version,action,snapshot
       ) VALUES($1,$2,$3,$4,$5,$6)`,
      [
        input.workspaceId,
        input.callbackId,
        input.operationId,
        state.version,
        JSON.stringify({ type: 'request', at }),
        JSON.stringify(state),
      ],
    );
    await client.query(
      `INSERT INTO dialer_telephony_sessions(
         workspace_id,request_id,number_id,queue_id,caller_sid,conference_name,mode
       ) VALUES($1,$2,$3,$4,$5,$6,'callback_requested')`,
      [
        input.workspaceId,
        input.requestId,
        input.numberId,
        input.queueId,
        telephonyId(input.callbackId, 'pending-customer'),
        telephonyId(input.callbackId, 'conference'),
      ],
    );
    return { duplicate: false as const, state };
  
    } catch (cause: unknown) {
      if (cause instanceof Error) throw cause;
      throw new Error('Async operation rejected with a non-Error cause', { cause });
    }
  };

  const request = async (raw: CallbackRequestInput) => {
    try {
    const authorityAt = options.clock?.() ?? new Date().toISOString();
    const policy = decodeCallbackPolicy(raw.policy);
    await authorize({ ...raw, policy }, authorityAt);
    return withInboundTransaction(pool, raw.workspaceId, (client) =>
      requestOnClient(client, { ...raw, policy }, undefined),
    );
  
    } catch (cause: unknown) {
      if (cause instanceof Error) throw cause;
      throw new Error('Async operation rejected with a non-Error cause', { cause });
    }
  };

  const read = async (
    workspaceId: string,
    callbackId: string,
  ): Promise<CallbackRead | null> => {
    try {
    const row = await loadCallback(pool, workspaceId, callbackId);
    if (!row) return null;
    return {
      state: row.state,
      policy: row.policy,
      numberId: row.number_id,
      recipientRetained: row.recipient_ciphertext !== null,
      recipientExpiresAt: row.recipient_expires_at.toISOString(),
    };
  
    } catch (cause: unknown) {
      if (cause instanceof Error) throw cause;
      throw new Error('Async operation rejected with a non-Error cause', { cause });
    }
  };

  const readRecipient = async (workspaceId: string, callbackId: string) => {
    try {
    const row = await loadCallback(pool, workspaceId, callbackId);
    if (!row?.recipient_ciphertext)
      throw new Error('Callback recipient has been purged');
    return options.recipientCipher.decrypt(workspaceId, row.recipient_ciphertext);
  
    } catch (cause: unknown) {
      if (cause instanceof Error) throw cause;
      throw new Error('Async operation rejected with a non-Error cause', { cause });
    }
  };

  const apply = (workspaceId: string, callbackId: string, action: CallbackAction) =>
    withInboundTransaction(pool, workspaceId, (client) =>
      applyOnClient(client, workspaceId, callbackId, action),
    );

  const reschedule = async (input: {
    workspaceId: string;
    callbackId: string;
    operationId: string;
    timezone: string;
    notBefore: string;
    deadline: string;
  }) => {
    try {
    const at = options.clock?.() ?? new Date().toISOString();
    const row = await loadCallback(pool, input.workspaceId, input.callbackId);
    if (!row) throw new Error('Callback obligation is missing');
    const queuePolicy = await readQueuePolicy(
      pool,
      input.workspaceId,
      row.queue_id,
    );
    if (queuePolicy.timezone !== input.timezone)
      throw new Error('Callback timezone must match the queue authority');
    if (input.deadline <= at || input.notBefore >= input.deadline)
      throw new Error('Callback reschedule window is no longer fulfillable');
    if (!isInboundQueueOpen(queuePolicy, input.notBefore))
      throw new Error('Callback reschedule must begin during staffed hours');
    if (!(await operationAlreadyApplied(input.workspaceId, input.operationId)))
      await cancelConfirmedBookingForRevision(row);
    return apply(input.workspaceId, input.callbackId, {
      type: 'reschedule',
      operationId: input.operationId,
      at,
      timezone: input.timezone,
      notBefore: input.notBefore,
      deadline: input.deadline,
    });
  
    } catch (cause: unknown) {
      if (cause instanceof Error) throw cause;
      throw new Error('Async operation rejected with a non-Error cause', { cause });
    }
  };

  const cancel = async (input: {
    workspaceId: string;
    callbackId: string;
    operationId: string;
    reconciled: boolean;
  }) => {
    try {
    const at = options.clock?.() ?? new Date().toISOString();
    const operationApplied = await operationAlreadyApplied(
      input.workspaceId,
      input.operationId,
    );
    if (!operationApplied) {
      const row = await loadCallback(pool, input.workspaceId, input.callbackId);
      if (!row) throw new Error('Callback obligation is missing');
      if (!terminal(row.state.status)) await cancelConfirmedBookingForRevision(row);
    }
    if (input.reconciled)
      return apply(input.workspaceId, input.callbackId, {
        type: 'cancel',
        operationId: input.operationId,
        at,
        reconciled: true,
      });

    const pending = await apply(input.workspaceId, input.callbackId, {
      type: 'cancel',
      operationId: input.operationId,
      at,
      reconciled: false,
    });
    if (pending.state.status !== 'cancel_pending') return pending;

    const row = await loadCallback(pool, input.workspaceId, input.callbackId);
    if (!row) throw new Error('Callback obligation is missing');
    const owned = await pool.query<{ snapshot: import('@consuelo/dialer').RepCapacityState }>(
      `SELECT snapshot FROM dialer_rep_capacity
       WHERE workspace_id=$1 AND snapshot->'owner'->>'requestId'=$2 LIMIT 2`,
      [input.workspaceId, row.request_id],
    );
    if (owned.rows.length > 1)
      throw new Error('Callback request owns more than one capacity slot');
    const state = owned.rows[0]?.snapshot;
    if (!state?.owner)
      return apply(input.workspaceId, input.callbackId, {
        type: 'cancel',
        operationId: digestId(input.operationId, 'cancel-final'),
        at,
        reconciled: true,
      });

    if (['offering', 'connecting'].includes(state.owner.phase)) {
      const cancelled = await capacity.execute({
        workspaceId: input.workspaceId,
        capacityId: state.capacityId,
        expectedVersion: state.version,
        operationId: digestId(input.operationId, 'capacity-cancel'),
        action: {
          type: 'cancel',
          assignmentId: state.owner.assignmentId,
          generation: state.owner.generation,
        },
      });
      if (!cancelled.state.owner)
        return apply(input.workspaceId, input.callbackId, {
          type: 'cancel',
          operationId: digestId(input.operationId, 'cancel-final'),
          at,
          reconciled: true,
        });
    }
    return pending;
  
    } catch (cause: unknown) {
      if (cause instanceof Error) throw cause;
      throw new Error('Async operation rejected with a non-Error cause', { cause });
    }
  };

  const recordAttemptResult = async (input: {
    workspaceId: string;
    callbackId: string;
    operationId: string;
    attemptId: string;
    outcome: 'connected' | 'no_answer' | 'failed' | 'unknown';
    reconciled: boolean;
  }) => {
    try {
    const at = options.clock?.() ?? new Date().toISOString();
    const row = await loadCallback(pool, input.workspaceId, input.callbackId);
    if (!row) throw new Error('Callback obligation is missing');
    let nextEligibleAt: string | null = null;
    if (input.outcome === 'no_answer' || input.outcome === 'failed') {
      const attemptNumber = row.state.attempts.length;
      if (attemptNumber < row.policy.maxAttempts) {
        const delay = row.policy.retryDelaysMilliseconds[attemptNumber - 1];
        if (delay === undefined)
          throw new Error('Callback retry policy is incomplete');
        const candidate = new Date(Date.parse(at) + delay).toISOString();
        if (candidate < row.state.deadline) nextEligibleAt = candidate;
      }
    }
    return apply(input.workspaceId, input.callbackId, {
      type: 'attempt_result',
      operationId: input.operationId,
      attemptId: input.attemptId,
      at,
      outcome: input.outcome,
      nextEligibleAt,
      reconciled: input.reconciled,
    });
  
    } catch (cause: unknown) {
      if (cause instanceof Error) throw cause;
      throw new Error('Async operation rejected with a non-Error cause', { cause });
    }
  };

  const releaseAttemptCapacity = async (input: {
    workspaceId: string;
    callbackId: string;
    operationId: string;
    outcome: 'no_effect' | 'ended';
  }) => {
    try {
    const row = await loadCallback(pool, input.workspaceId, input.callbackId);
    const attempt = row?.state.attempts[row.state.attempts.length - 1];
    if (!row || !attempt) throw new Error('Callback attempt is missing');
    const state = await capacity.read(input.workspaceId, attempt.capacityId);
    if (!state?.owner || state.owner.assignmentId !== attempt.assignmentId)
      return state;
    return (
      await capacity.execute({
        workspaceId: input.workspaceId,
        capacityId: state.capacityId,
        expectedVersion: state.version,
        operationId: input.operationId,
        action: {
          type: 'reconcile',
          assignmentId: attempt.assignmentId,
          generation: attempt.generation,
          outcome: input.outcome,
          evidenceId: digestId(input.callbackId, input.operationId, 'capacity-evidence'),
        },
      })
    ).state;
  
    } catch (cause: unknown) {
      if (cause instanceof Error) throw cause;
      throw new Error('Async operation rejected with a non-Error cause', { cause });
    }
  };

  const syncAccepted = async (
    client: PoolClient,
    row: StoredCallback,
    at: string,
  ) => {
    try {
    const capacityRow = await client.query<{
      snapshot: import('@consuelo/dialer').RepCapacityState;
    }>(
      `SELECT snapshot FROM dialer_rep_capacity
       WHERE workspace_id=$1 AND snapshot->'owner'->>'requestId'=$2 LIMIT 2`,
      [row.workspace_id, row.request_id],
    );
    if (capacityRow.rows.length > 1)
      throw new Error('Callback request owns more than one capacity slot');
    const rep = capacityRow.rows[0]?.snapshot;
    let state = (await loadCallback(client, row.workspace_id, row.callback_id, true))!
      .state;
    if (!rep?.owner) {
      if (state.status === 'connected')
        state = (
          await applyOnClient(client, row.workspace_id, row.callback_id, {
            type: 'fulfill',
            operationId: digestId(row.callback_id, state.version.toString(), 'fulfill'),
            at,
          })
        ).state;
      return state;
    }
    const owner = rep.owner;
    if (
      owner.phase === 'connecting' &&
      ['scheduled', 'retry_due'].includes(state.status)
    ) {
      const attemptId = digestId(
        row.callback_id,
        owner.assignmentId,
        String(owner.generation),
        'attempt',
      );
      state = (
        await applyOnClient(client, row.workspace_id, row.callback_id, {
          type: 'record_attempt',
          operationId: digestId(attemptId, 'record'),
          attemptId,
          assignmentId: owner.assignmentId,
          capacityId: rep.capacityId,
          generation: owner.generation,
          at,
        })
      ).state;
    }
    if (owner.phase === 'connecting' && state.status === 'offering') {
      const attempt = state.attempts[state.attempts.length - 1]!;
      state = (
        await applyOnClient(client, row.workspace_id, row.callback_id, {
          type: 'attempt_result',
          operationId: digestId(attempt.attemptId, 'dialing'),
          attemptId: attempt.attemptId,
          at,
          outcome: 'dialing',
          nextEligibleAt: null,
          reconciled: false,
        })
      ).state;
    }
    if (owner.phase === 'unknown' && state.status === 'dialing') {
      const attempt = state.attempts[state.attempts.length - 1]!;
      state = (
        await applyOnClient(client, row.workspace_id, row.callback_id, {
          type: 'attempt_result',
          operationId: digestId(attempt.attemptId, 'unknown'),
          attemptId: attempt.attemptId,
          at,
          outcome: 'unknown',
          nextEligibleAt: null,
          reconciled: false,
        })
      ).state;
    }
    if (
      owner.phase === 'connected' &&
      (state.status === 'dialing' || state.status === 'unknown')
    ) {
      const attempt = state.attempts[state.attempts.length - 1]!;
      state = (
        await applyOnClient(client, row.workspace_id, row.callback_id, {
          type: 'attempt_result',
          operationId: digestId(attempt.attemptId, 'connected'),
          attemptId: attempt.attemptId,
          at,
          outcome: 'connected',
          nextEligibleAt: null,
          reconciled: true,
        })
      ).state;
    }
    if (owner.phase === 'wrap_up' && state.status === 'connected')
      state = (
        await applyOnClient(client, row.workspace_id, row.callback_id, {
          type: 'fulfill',
          operationId: digestId(row.callback_id, state.version.toString(), 'fulfill'),
          at,
        })
      ).state;
    return state;
  
    } catch (cause: unknown) {
      if (cause instanceof Error) throw cause;
      throw new Error('Async operation rejected with a non-Error cause', { cause });
    }
  };

  const tick = async (input: {
    workspaceId: string;
    queueId: string;
    cycleId?: string;
  }) => {
    try {
    const at = options.clock?.() ?? new Date().toISOString();
    const rows = (
      await pool.query<StoredCallback>(
        `SELECT * FROM dialer_callback_obligations
         WHERE workspace_id=$1 AND queue_id=$2
           AND state->>'status' NOT IN ('fulfilled','cancelled','exhausted','expired')
         ORDER BY callback_id LIMIT 1001`,
        [input.workspaceId, input.queueId],
      )
    ).rows;
    if (rows.length > 1000) throw new Error('Callback scan bound exceeded');
    for (const row of rows) {
      const evaluation = evaluateCallbackSchedule(
        row.state,
        at,
        row.policy.maxAttempts,
      );
      if (evaluation.action === 'expire' || evaluation.action === 'exhaust')
        await apply(input.workspaceId, row.callback_id, {
          type: evaluation.action,
          operationId: digestId(
            row.callback_id,
            row.state.version.toString(),
            evaluation.action,
          ),
          at,
        });
    }
    const decision = await routing.tick({
      workspaceId: input.workspaceId,
      queueId: input.queueId,
      decisionId: digestId(
        input.workspaceId,
        input.queueId,
        input.cycleId ?? randomUUID(),
      ),
    });
    const evaluation = decision.evaluation;
    if (evaluation.action === 'fallback' && evaluation.requestId) {
      const row = rows.find((candidate) => candidate.request_id === evaluation.requestId);
      if (row && !terminal(row.state.status)) {
        if (evaluation.reason === 'deadline')
          await apply(input.workspaceId, row.callback_id, {
            type: 'expire',
            operationId: digestId(decision.decisionId, 'expire'),
            at,
          });
        else if (evaluation.reason === 'max_offers')
          await apply(input.workspaceId, row.callback_id, {
            type: 'exhaust',
            operationId: digestId(decision.decisionId, 'exhaust'),
            at,
          });
        else if (evaluation.reason === 'closed' && at < row.state.deadline)
          await pool.query(
            `UPDATE dialer_routing_entries
             SET routing_state='waiting',fallback_decision_id=NULL
             WHERE workspace_id=$1 AND request_id=$2`,
            [input.workspaceId, row.request_id],
          );
      }
    }
    const refreshed = (
      await pool.query<StoredCallback>(
        `SELECT * FROM dialer_callback_obligations
         WHERE workspace_id=$1 AND queue_id=$2
           AND state->>'status' NOT IN ('fulfilled','cancelled','exhausted','expired')
         ORDER BY callback_id LIMIT 1000`,
        [input.workspaceId, input.queueId],
      )
    ).rows;
    for (const row of refreshed)
      await withInboundTransaction(pool, input.workspaceId, (client) =>
        syncAccepted(client, row, at),
      );
    return decision;
  
    } catch (cause: unknown) {
      if (cause instanceof Error) throw cause;
      throw new Error('Async operation rejected with a non-Error cause', { cause });
    }
  };

  const book = async (workspaceId: string, callbackId: string) => {
    try {
    const row = await loadCallback(pool, workspaceId, callbackId);
    if (!row) throw new Error('Callback obligation is missing');
    const request: CallbackBookingRequest = {
      workspaceId,
      callbackId,
      revision: row.state.revision,
      timezone: row.state.timezone,
      windowStart: row.state.notBefore,
      windowEnd: row.state.deadline,
    };
    const existing = await readBookingForRevision(
      workspaceId,
      callbackId,
      row.state.revision,
    );
    if (existing?.status === 'cancel_pending')
      throw new Error('Callback provider booking cancellation outcome is unknown');
    if (existing) return existing;
    const result = decodeCallbackBookingResult(
      options.calendar
        ? await options.calendar.book(request)
        : {
            status: 'unavailable',
            providerReference: null,
            evidenceReference: null,
          },
    );
    await pool.query(
      `INSERT INTO dialer_callback_bookings(
         workspace_id,callback_id,revision,status,provider_reference,evidence_reference
       ) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING`,
      [
        workspaceId,
        callbackId,
        row.state.revision,
        result.status,
        result.providerReference,
        result.evidenceReference,
      ],
    );
    return result;
  
    } catch (cause: unknown) {
      if (cause instanceof Error) throw cause;
      throw new Error('Async operation rejected with a non-Error cause', { cause });
    }
  };

  const purgeRecipients = async (workspaceId: string) => {
    try {
    const at = options.clock?.() ?? new Date().toISOString();
    const result = await pool.query(
      `UPDATE dialer_callback_obligations
       SET recipient_ciphertext=NULL
       WHERE workspace_id=$1 AND recipient_ciphertext IS NOT NULL
         AND recipient_expires_at <= $2::timestamptz`,
      [workspaceId, at],
    );
    return result.rowCount ?? 0;
  
    } catch (cause: unknown) {
      if (cause instanceof Error) throw cause;
      throw new Error('Async operation rejected with a non-Error cause', { cause });
    }
  };

  return {
    request,
    requestOnClient,
    read,
    readBooking: readBookingForRevision,
    readRecipient,
    apply,
    reschedule,
    cancel,
    recordAttemptResult,
    releaseAttemptCapacity,
    tick,
    book,
    purgeRecipients,
  };
};
