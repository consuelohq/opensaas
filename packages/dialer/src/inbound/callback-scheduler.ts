import { InboundContractError } from './lifecycle.js';

export type CallbackAttemptOutcome =
  | 'offering'
  | 'dialing'
  | 'connected'
  | 'no_answer'
  | 'failed'
  | 'unknown'
  | 'cancelled';

export type CallbackAttempt = {
  readonly attemptId: string;
  readonly assignmentId: string;
  readonly capacityId: string;
  readonly generation: number;
  readonly startedAt: string;
  readonly finishedAt: string | null;
  readonly outcome: CallbackAttemptOutcome;
  readonly nextEligibleAt: string | null;
};

export type CallbackObligationStatus =
  | 'scheduled'
  | 'offering'
  | 'dialing'
  | 'unknown'
  | 'retry_due'
  | 'connected'
  | 'fulfilled'
  | 'cancelled'
  | 'cancel_pending'
  | 'exhausted'
  | 'expired';

export type CallbackObligationState = {
  readonly schemaVersion: 1;
  readonly workspaceId: string;
  readonly callbackId: string;
  readonly requestId: string;
  readonly sourceRequestId: string | null;
  readonly queueId: string;
  readonly originalEnteredAt: string;
  readonly consentReference: string;
  readonly recipientReference: string;
  readonly timezone: string;
  readonly notBefore: string;
  readonly deadline: string;
  readonly revision: number;
  readonly version: number;
  readonly status: CallbackObligationStatus;
  readonly attempts: readonly CallbackAttempt[];
  readonly updatedAt: string;
  readonly appliedOperations?: readonly string[];
};

export type CallbackAction =
  | {
      readonly type: 'record_attempt';
      readonly operationId: string;
      readonly attemptId: string;
      readonly assignmentId: string;
      readonly capacityId: string;
      readonly generation: number;
      readonly at: string;
    }
  | {
      readonly type: 'attempt_result';
      readonly operationId: string;
      readonly attemptId: string;
      readonly at: string;
      readonly outcome: Exclude<CallbackAttemptOutcome, 'offering'>;
      readonly nextEligibleAt: string | null;
      readonly reconciled: boolean;
    }
  | {
      readonly type: 'reschedule';
      readonly operationId: string;
      readonly at: string;
      readonly timezone: string;
      readonly notBefore: string;
      readonly deadline: string;
    }
  | {
      readonly type: 'cancel';
      readonly operationId: string;
      readonly at: string;
      readonly reconciled: boolean;
    }
  | {
      readonly type: 'expire' | 'exhaust' | 'fulfill';
      readonly operationId: string;
      readonly at: string;
    };

export type CallbackScheduleEvaluation = {
  readonly action: 'wait' | 'route' | 'reconcile' | 'expire' | 'exhaust' | 'none';
  readonly reason:
    | 'not_due'
    | 'retry_backoff'
    | 'due'
    | 'active_attempt'
    | 'unknown_effect'
    | 'deadline'
    | 'attempt_limit'
    | 'terminal';
  readonly nextAt: string | null;
};

const reject = (message: string): never => {
  throw new InboundContractError(message);
};

const validTimestamp = (value: string) =>
  value.length === 24 &&
  Number.isFinite(Date.parse(value)) &&
  new Date(value).toISOString() === value;

const validTimezone = (value: string) => {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value }).format();
    return true;
  } catch {
    return false;
  }
};

const validateState = (state: CallbackObligationState) => {
  if (
    !validTimestamp(state.originalEnteredAt) ||
    !validTimestamp(state.notBefore) ||
    !validTimestamp(state.deadline) ||
    !validTimestamp(state.updatedAt)
  )
    reject('Invalid callback timestamp');
  if (!validTimezone(state.timezone)) reject('Invalid callback timezone');
  if (state.originalEnteredAt > state.deadline || state.notBefore > state.deadline)
    reject('Invalid callback service window');
  if (!Number.isSafeInteger(state.revision) || state.revision < 1)
    reject('Invalid callback revision');
  if (!Number.isSafeInteger(state.version) || state.version < 1)
    reject('Invalid callback version');
  for (const [index, attempt] of state.attempts.entries()) {
    if (
      !Number.isSafeInteger(attempt.generation) ||
      attempt.generation < 1 ||
      !validTimestamp(attempt.startedAt) ||
      (attempt.finishedAt !== null && !validTimestamp(attempt.finishedAt)) ||
      (attempt.nextEligibleAt !== null && !validTimestamp(attempt.nextEligibleAt))
    )
      reject('Invalid callback attempt');
    if (index > 0 && attempt.startedAt < state.attempts[index - 1]!.startedAt)
      reject('Callback attempts are out of order');
  }
};

const operationSeen = (state: CallbackObligationState, operationId: string) =>
  state.appliedOperations?.includes(operationId) ?? false;

const committed = (
  state: CallbackObligationState,
  operationId: string,
  change: Partial<CallbackObligationState>,
): CallbackObligationState => ({
  ...state,
  ...change,
  version: state.version + 1,
  appliedOperations: [...(state.appliedOperations ?? []), operationId],
});

export const evaluateCallbackSchedule = (
  state: CallbackObligationState,
  at: string,
  maxAttempts: number,
): CallbackScheduleEvaluation => {
  validateState(state);
  if (!validTimestamp(at)) reject('Invalid callback authority time');
  if (!Number.isSafeInteger(maxAttempts) || maxAttempts < 1 || maxAttempts > 100)
    reject('Invalid callback attempt limit');

  if (
    ['fulfilled', 'cancelled', 'exhausted', 'expired', 'connected'].includes(
      state.status,
    )
  )
    return { action: 'none', reason: 'terminal', nextAt: null };

  if (state.status === 'unknown' || state.status === 'cancel_pending')
    return { action: 'reconcile', reason: 'unknown_effect', nextAt: null };

  if (state.status === 'offering' || state.status === 'dialing')
    return { action: 'wait', reason: 'active_attempt', nextAt: null };

  if (at >= state.deadline)
    return { action: 'expire', reason: 'deadline', nextAt: null };

  if (state.attempts.length >= maxAttempts)
    return { action: 'exhaust', reason: 'attempt_limit', nextAt: null };

  if (at < state.notBefore)
    return { action: 'wait', reason: 'not_due', nextAt: state.notBefore };

  if (state.status === 'retry_due') {
    const next = state.attempts[state.attempts.length - 1]?.nextEligibleAt;
    const retryAt: string = next ?? reject('Retry has no next eligible time');
    if (at < retryAt)
      return { action: 'wait', reason: 'retry_backoff', nextAt: retryAt };
  }

  return { action: 'route', reason: 'due', nextAt: null };
};

export const applyCallbackAction = (
  state: CallbackObligationState,
  action: CallbackAction,
): CallbackObligationState => {
  validateState(state);
  if (!action.operationId || operationSeen(state, action.operationId)) return state;
  if (!validTimestamp(action.at) || action.at < state.updatedAt)
    reject('Callback clock moved backwards');

  if (action.type === 'record_attempt') {
    if (!['scheduled', 'retry_due'].includes(state.status))
      reject('Callback is not schedulable');
    if (action.at < state.notBefore || action.at > state.deadline)
      reject('Callback attempt is outside its service window');
    if (
      !Number.isSafeInteger(action.generation) ||
      action.generation < 1 ||
      state.attempts.some((attempt) => attempt.attemptId === action.attemptId)
    )
      reject('Invalid callback attempt identity');
    return committed(state, action.operationId, {
      status: 'offering',
      updatedAt: action.at,
      attempts: [
        ...state.attempts,
        {
          attemptId: action.attemptId,
          assignmentId: action.assignmentId,
          capacityId: action.capacityId,
          generation: action.generation,
          startedAt: action.at,
          finishedAt: null,
          outcome: 'offering',
          nextEligibleAt: null,
        },
      ],
    });
  }

  if (action.type === 'reschedule') {
    if (!['scheduled', 'retry_due'].includes(state.status))
      reject('Active callback attempt cannot be rescheduled');
    if (
      !validTimezone(action.timezone) ||
      !validTimestamp(action.notBefore) ||
      !validTimestamp(action.deadline) ||
      action.notBefore > action.deadline ||
      action.deadline < action.at
    )
      reject('Invalid callback reschedule window');
    return committed(state, action.operationId, {
      timezone: action.timezone,
      notBefore: action.notBefore,
      deadline: action.deadline,
      revision: state.revision + 1,
      status: 'scheduled',
      updatedAt: action.at,
    });
  }

  if (action.type === 'cancel') {
    if (['fulfilled', 'cancelled', 'exhausted', 'expired'].includes(state.status))
      return state;
    return committed(state, action.operationId, {
      status: action.reconciled ? 'cancelled' : 'cancel_pending',
      updatedAt: action.at,
    });
  }

  if (action.type === 'attempt_result') {
    const index = state.attempts.findIndex(
      (attempt) => attempt.attemptId === action.attemptId,
    );
    if (index < 0 || index !== state.attempts.length - 1)
      reject('Callback attempt is not current');
    const previous = state.attempts[index]!;
    if (!['offering', 'dialing', 'unknown'].includes(state.status))
      reject('Callback has no active attempt');
    if (state.status === 'unknown' && !action.reconciled)
      reject('Unknown callback effect requires reconciliation');
    if (action.outcome === 'connected' && !action.reconciled)
      reject('Callback connection needs participant evidence');
    if (
      action.nextEligibleAt !== null &&
      (!validTimestamp(action.nextEligibleAt) || action.nextEligibleAt <= action.at)
    )
      reject('Invalid callback retry time');
    if (
      action.outcome === 'unknown' &&
      (action.reconciled || action.nextEligibleAt !== null)
    )
      reject('Unknown callback effect cannot schedule a retry');
    const nextAttempt: CallbackAttempt = {
      ...previous,
      outcome: action.outcome,
      finishedAt: action.outcome === 'unknown' ? null : action.at,
      nextEligibleAt: action.nextEligibleAt,
    };
    let status: CallbackObligationStatus;
    if (action.outcome === 'unknown') status = 'unknown';
    else if (action.outcome === 'connected') status = 'connected';
    else if (action.outcome === 'dialing') status = 'dialing';
    else if (action.outcome === 'cancelled') status = 'cancelled';
    else status = action.nextEligibleAt ? 'retry_due' : 'exhausted';
    return committed(state, action.operationId, {
      status,
      updatedAt: action.at,
      attempts: state.attempts.map((attempt, candidate) =>
        candidate === index ? nextAttempt : attempt,
      ),
    });
  }

  if (action.type === 'expire') {
    if (!['scheduled', 'retry_due'].includes(state.status))
      reject('Active callback cannot expire without reconciliation');
    if (action.at < state.deadline) reject('Callback deadline has not passed');
    return committed(state, action.operationId, {
      status: 'expired',
      updatedAt: action.at,
    });
  }

  if (action.type === 'exhaust') {
    if (state.status !== 'retry_due') reject('Callback retries are not exhausted');
    return committed(state, action.operationId, {
      status: 'exhausted',
      updatedAt: action.at,
    });
  }

  if (state.status !== 'connected') reject('Callback is not connected');
  return committed(state, action.operationId, {
    status: 'fulfilled',
    updatedAt: action.at,
  });
};
