import { describe, expect, it } from 'bun:test';
import {
  applyCallbackAction,
  evaluateCallbackSchedule,
  type CallbackObligationState,
} from './callback-scheduler.js';

const at = (minute: number) =>
  new Date(Date.parse('2026-11-01T05:00:00.000Z') + minute * 60_000).toISOString();

const obligation = (
  overrides: Partial<CallbackObligationState> = {},
): CallbackObligationState => ({
  schemaVersion: 1,
  workspaceId: 'workspace-1',
  callbackId: 'callback-1',
  requestId: 'request-callback-1',
  sourceRequestId: 'request-live-1',
  queueId: 'queue-1',
  originalEnteredAt: at(-30),
  consentReference: 'consent-1',
  recipientReference: 'recipient-1',
  timezone: 'America/New_York',
  notBefore: at(10),
  deadline: at(40),
  revision: 1,
  version: 1,
  status: 'scheduled',
  attempts: [],
  updatedAt: at(0),
  ...overrides,
});

describe('RD6 callback scheduler', () => {
  it('never routes or reserves a callback before its not-before time', () => {
    expect(evaluateCallbackSchedule(obligation(), at(9), 3)).toEqual({
      action: 'wait',
      reason: 'not_due',
      nextAt: at(10),
    });
  });

  it('routes one due callback while preserving original queue entry evidence', () => {
    const current = obligation();
    expect(evaluateCallbackSchedule(current, at(10), 3)).toEqual({
      action: 'route',
      reason: 'due',
      nextAt: null,
    });
    expect(current.originalEnteredAt).toBe(at(-30));
  });

  it('deduplicates the same attempt operation instead of creating a second dial', () => {
    const action = {
      type: 'record_attempt' as const,
      operationId: 'attempt-once',
      attemptId: 'attempt-1',
      assignmentId: 'assignment-1',
      capacityId: 'capacity-1',
      generation: 1,
      at: at(10),
    };
    const first = applyCallbackAction(obligation(), action);
    const duplicate = applyCallbackAction(first, action);
    expect(duplicate).toEqual(first);
    expect(duplicate.attempts).toHaveLength(1);
  });

  it('reschedules the service window without mutating original entry or prior attempts', () => {
    const attempted = applyCallbackAction(obligation(), {
      type: 'record_attempt',
      operationId: 'attempt-1',
      attemptId: 'attempt-1',
      assignmentId: 'assignment-1',
      capacityId: 'capacity-1',
      generation: 1,
      at: at(10),
    });
    const retryDue = applyCallbackAction(attempted, {
      type: 'attempt_result',
      operationId: 'result-before-reschedule',
      attemptId: 'attempt-1',
      at: at(12),
      outcome: 'no_answer',
      nextEligibleAt: at(20),
      reconciled: false,
    });
    const rescheduled = applyCallbackAction(retryDue, {
      type: 'reschedule',
      operationId: 'reschedule-1',
      at: at(20),
      timezone: 'America/New_York',
      notBefore: at(50),
      deadline: at(80),
    });
    expect(rescheduled.originalEnteredAt).toBe(at(-30));
    expect(rescheduled.attempts).toEqual(retryDue.attempts);
    expect(rescheduled.revision).toBe(2);
    expect(rescheduled.notBefore).toBe(at(50));
  });

  it('releases a no-answer attempt into a bounded retry rather than calling it connected', () => {
    const routed = applyCallbackAction(obligation(), {
      type: 'record_attempt',
      operationId: 'attempt-1',
      attemptId: 'attempt-1',
      assignmentId: 'assignment-1',
      capacityId: 'capacity-1',
      generation: 1,
      at: at(10),
    });
    const noAnswer = applyCallbackAction(routed, {
      type: 'attempt_result',
      operationId: 'result-1',
      attemptId: 'attempt-1',
      at: at(12),
      outcome: 'no_answer',
      nextEligibleAt: at(20),
      reconciled: false,
    });
    expect(noAnswer.status).toBe('retry_due');
    expect(noAnswer.attempts[0]?.outcome).toBe('no_answer');
    expect(evaluateCallbackSchedule(noAnswer, at(19), 3).action).toBe('wait');
    expect(evaluateCallbackSchedule(noAnswer, at(20), 3).action).toBe('route');
  });

  it('persists cancellation intent before finalizing even when no attempt exists', () => {
    const pending = applyCallbackAction(obligation(), {
      type: 'cancel',
      operationId: 'cancel-requested-before-offer',
      at: at(5),
      reconciled: false,
    });
    expect(pending.status).toBe('cancel_pending');
    expect(evaluateCallbackSchedule(pending, at(6), 3).action).toBe('reconcile');
    const cancelled = applyCallbackAction(pending, {
      type: 'cancel',
      operationId: 'cancel-final-before-offer',
      at: at(6),
      reconciled: true,
    });
    expect(cancelled.status).toBe('cancelled');
  });

  it('protects an uncertain escaped dial until reconciliation', () => {
    const routed = applyCallbackAction(obligation(), {
      type: 'record_attempt',
      operationId: 'attempt-1',
      attemptId: 'attempt-1',
      assignmentId: 'assignment-1',
      capacityId: 'capacity-1',
      generation: 1,
      at: at(10),
    });
    const unknown = applyCallbackAction(routed, {
      type: 'attempt_result',
      operationId: 'unknown-1',
      attemptId: 'attempt-1',
      at: at(11),
      outcome: 'unknown',
      nextEligibleAt: null,
      reconciled: false,
    });
    expect(unknown.status).toBe('unknown');
    expect(evaluateCallbackSchedule(unknown, at(50), 3)).toEqual({
      action: 'reconcile',
      reason: 'unknown_effect',
      nextAt: null,
    });
    const cancelPending = applyCallbackAction(unknown, {
      type: 'cancel',
      operationId: 'cancel-requested',
      at: at(12),
      reconciled: false,
    });
    expect(cancelPending.status).toBe('cancel_pending');
    expect(evaluateCallbackSchedule(cancelPending, at(50), 3)).toEqual({
      action: 'reconcile',
      reason: 'unknown_effect',
      nextAt: null,
    });
    const cancelled = applyCallbackAction(cancelPending, {
      type: 'cancel',
      operationId: 'cancel-reconciled',
      at: at(13),
      reconciled: true,
    });
    expect(cancelled.status).toBe('cancelled');
  });

  it('keeps repeated-hour DST windows deterministic because service bounds are absolute instants', () => {
    const repeatedHour = obligation({
      timezone: 'America/New_York',
      notBefore: '2026-11-01T05:30:00.000Z',
      deadline: '2026-11-01T07:00:00.000Z',
      updatedAt: '2026-11-01T05:00:00.000Z',
    });
    expect(
      evaluateCallbackSchedule(repeatedHour, '2026-11-01T05:29:59.000Z', 3),
    ).toEqual({
      action: 'wait',
      reason: 'not_due',
      nextAt: '2026-11-01T05:30:00.000Z',
    });
    expect(
      evaluateCallbackSchedule(repeatedHour, '2026-11-01T06:30:00.000Z', 3).action,
    ).toBe('route');
    expect(repeatedHour.timezone).toBe('America/New_York');
  });

  it('expires missed windows and bounds exhausted retries distinctly', () => {
    expect(evaluateCallbackSchedule(obligation(), at(40), 3).action).toBe(
      'expire',
    );
    expect(evaluateCallbackSchedule(obligation(), at(41), 3).action).toBe(
      'expire',
    );
    const exhausted = obligation({
      status: 'retry_due',
      attempts: [1, 2, 3].map((attempt) => ({
        attemptId: `attempt-${attempt}`,
        assignmentId: `assignment-${attempt}`,
        capacityId: `capacity-${attempt}`,
        generation: attempt,
        startedAt: at(10 + attempt),
        finishedAt: at(11 + attempt),
        outcome: 'no_answer' as const,
        nextEligibleAt: at(20 + attempt),
      })),
    });
    expect(evaluateCallbackSchedule(exhausted, at(25), 3)).toEqual({
      action: 'exhaust',
      reason: 'attempt_limit',
      nextAt: null,
    });
  });
});
