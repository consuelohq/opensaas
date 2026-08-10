import { Effect } from 'effect';

import {
  DialerConflictError,
  DialerNotFoundError,
  DialerRequestError,
} from '../errors/dialer-errors.js';
import {
  ParallelCompatibilityRuntime,
  type ParallelDialCommand,
  type ParallelDialBody,
  type MarkParallelAgentReadyCommand,
  type MarkParallelAgentReadyResult,
  type ParallelAgentTwimlInput,
  type ParallelGroupStatusResult,
  type ParallelTwimlInput,
  type TerminateParallelGroupCommand,
  type ValidateParallelDialCommand,
} from '../ports/parallel-compatibility.js';
import type { NumberPool } from '../services/local-presence.js';
import type { ParallelDialResult, ProfileKey } from '../types.js';
import { isTerminalCallStatus } from '../domain/parallel-call.js';
import { processParallelCallback } from './process-parallel-callback.js';

const requestError = (code: string, message: string, details?: unknown) =>
  new DialerRequestError({ code, message, details, retryable: false });

const isProfileKey = (value: unknown): value is ProfileKey =>
  value === 'balanced' || value === 'aggressive' || value === 'conservative';

const readRequiredString = (value: unknown, fieldName: string): string => {
  const parsed = typeof value === 'string' ? value.trim() : '';
  if (!parsed)
    throw requestError('INVALID_REQUEST', `${fieldName} is required`);
  return parsed;
};

const readOptionalString = (value: unknown): string | undefined =>
  typeof value === 'string' && value.length > 0 ? value : undefined;

const readOptionalStringArray = (value: unknown): string[] | undefined =>
  Array.isArray(value) ? value.map((item) => String(item)) : undefined;

const readOptionalNumber = (value: unknown): number | undefined => {
  if (typeof value !== 'string' && typeof value !== 'number') return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const readCustomerNumbers = (body: ParallelDialBody) =>
  Effect.gen(function* () {
    if (
      !Array.isArray(body.customerNumbers) ||
      body.customerNumbers.length === 0
    ) {
      return yield* Effect.fail(
        requestError(
          'MISSING_CUSTOMER_NUMBERS',
          'Requires customerNumbers and a queueId',
        ),
      );
    }
    const runtime = yield* ParallelCompatibilityRuntime;
    const normalized: string[] = [];
    for (const value of body.customerNumbers) {
      normalized.push(yield* runtime.normalizeCustomerNumber(value));
    }
    return normalized;
  });

const releaseLocks = (fromNumbers: string[]) =>
  Effect.gen(function* () {
    const runtime = yield* ParallelCompatibilityRuntime;
    if (fromNumbers.length > 0) {
      yield* runtime.releaseCallerIdLocks(fromNumbers);
    }
  });

export const initiateParallelDial = (command: ParallelDialCommand) =>
  Effect.gen(function* () {
    const runtime = yield* ParallelCompatibilityRuntime;
    const body = command.body as ParallelDialBody;
    const customerNumbers = yield* readCustomerNumbers(body);
    const queueId = readRequiredString(body.queueId, 'queueId');
    const contactIds = readOptionalStringArray(body.contactIds);
    const campaignSegment = readOptionalString(body.campaignSegment);
    const recentAnswerRate = readOptionalNumber(body.recentAnswerRate);
    const profileId = isProfileKey(body.profileId) ? body.profileId : undefined;
    const strategy = yield* runtime.resolveStrategy({
      queueId,
      workspaceId: command.workspaceId,
      campaignSegment,
      recentAnswerRate,
      profileId,
    });

    if (customerNumbers.length !== strategy.profile.fanout) {
      return yield* Effect.fail(
        requestError(
          'FANOUT_MISMATCH',
          `Profile ${strategy.profile.id} requires exactly ${strategy.profile.fanout} customerNumbers`,
        ),
      );
    }

    const accountNumbers = yield* runtime.listNumbers();
    const pool: NumberPool = {
      numbers: accountNumbers,
      primaryNumber: accountNumbers[0],
    };
    const fromNumbers: string[] = [];
    for (const customerNumber of customerNumbers) {
      fromNumbers.push(
        yield* runtime.resolveCallerId({ customerNumber, pool }),
      );
    }

    const lockable = Array.from(new Set(fromNumbers.filter(Boolean)));
    const acquired: string[] = [];
    for (const [index, phoneNumber] of lockable.entries()) {
      const pendingCallSid = `parallel-${queueId}-${index}`;
      const locked = yield* runtime.acquireCallerIdLock({
        phoneNumber,
        userId: command.userId,
        callSid: pendingCallSid,
      });
      if (!locked) {
        yield* releaseLocks(acquired);
        return yield* Effect.fail(
          new DialerConflictError({
            code: 'CALLER_ID_LOCKED',
            message: 'Caller ID is in use',
            retryAfterMs: 5000,
            retryable: false,
          }),
        );
      }
      acquired.push(phoneNumber);
    }

    const create = Effect.gen(function* () {
      const result = yield* runtime.initiateGroup({
        workspaceId: command.workspaceId,
        customerNumbers,
        queueId,
        contactIds,
        userId: command.userId,
        fromNumbers,
        statusCallbackUrl: `${command.callbackBaseUrl}/api/v1/calls/parallel/status-callback`,
        customerTwimlUrl: `${command.callbackBaseUrl}/api/v1/calls/parallel/customer-twiml`,
        profile: strategy.profile,
        campaignSegment,
      });

      for (const [index, phoneNumber] of acquired.entries()) {
        const call = result.calls.find(
          (candidate) => candidate.fromNumber === phoneNumber,
        );
        const transferred =
          call !== undefined &&
          (yield* runtime.transferCallerIdLock({
            phoneNumber,
            expectedCallSid: `parallel-${queueId}-${index}`,
            callSid: call.callSid,
          }));
        if (!transferred) {
          yield* runtime.terminateGroup(result.groupId);
          return yield* Effect.fail(
            requestError(
              'CALLER_ID_LOCK_TRANSFER_FAILED',
              'Caller ID lock transfer failed after call creation',
            ),
          );
        }
      }

      return result;
    });

    return yield* create.pipe(Effect.tapError(() => releaseLocks(acquired)));
  }).pipe(
    Effect.withSpan('dialer.initiate_parallel_dial'),
    Effect.annotateLogs({ workspaceId: command.workspaceId }),
  );

export const validateParallelDial = (command: ValidateParallelDialCommand) =>
  Effect.gen(function* () {
    const runtime = yield* ParallelCompatibilityRuntime;
    const profileId = isProfileKey(command.query.profileId)
      ? command.query.profileId
      : undefined;
    const strategy = yield* runtime.resolveStrategy({
      queueId: command.query.queueId ?? 'default',
      workspaceId: command.workspaceId,
      campaignSegment: command.query.campaignSegment,
      recentAnswerRate: readOptionalNumber(command.query.recentAnswerRate),
      profileId,
    });
    const numbers = yield* runtime.listNumbers();
    return {
      ...runtime.validateRequirements(numbers.length, strategy.profile.fanout),
      profile: strategy.profile,
      strategyReason: strategy.reason,
    };
  });

export const getParallelGroupStatus = (input: {
  groupId: string;
  workspaceId: string;
}) =>
  Effect.gen(function* () {
    const runtime = yield* ParallelCompatibilityRuntime;
    const group = yield* runtime.getGroupForWorkspace(
      input.groupId,
      input.workspaceId,
    );
    if (!group) {
      return yield* Effect.fail(
        new DialerNotFoundError({
          code: 'PARALLEL_GROUP_NOT_FOUND',
          message: 'Parallel group not found',
          retryable: false,
        }),
      );
    }
    const winner = group.winnerSid
      ? (group.calls.find((call) => call.callSid === group.winnerSid) ?? null)
      : null;
    return {
      groupId: group.groupId,
      conferenceName: group.conferenceName,
      status: group.status,
      winnerSid: group.winnerSid,
      winner,
      calls: group.calls.map((call) => ({
        callSid: call.callSid,
        customerNumber: call.customerNumber,
        position: call.position,
        status: call.status,
        amdResult: call.amdResult,
        contactId: call.contactId,
      })),
    } satisfies ParallelGroupStatusResult;
  });

export const terminateParallelGroup = (
  command: TerminateParallelGroupCommand,
) =>
  Effect.gen(function* () {
    const runtime = yield* ParallelCompatibilityRuntime;
    const group = yield* runtime.getGroupForWorkspace(
      command.groupId,
      command.workspaceId,
    );
    if (!group) {
      return yield* Effect.fail(
        new DialerNotFoundError({
          code: 'PARALLEL_GROUP_NOT_FOUND',
          message: 'Parallel group not found',
          retryable: false,
        }),
      );
    }
    yield* runtime.releaseCallerIdLocks(
      Array.from(
        new Set(group.calls.map((call) => call.fromNumber).filter(Boolean)),
      ),
    );
    const terminated = yield* runtime.terminateGroupForWorkspace(
      command.groupId,
      command.workspaceId,
    );
    if (!terminated) {
      return yield* Effect.fail(
        new DialerNotFoundError({
          code: 'PARALLEL_GROUP_NOT_FOUND',
          message: 'Parallel group not found',
          retryable: false,
        }),
      );
    }
    return { groupId: command.groupId, status: 'completed' as const };
  });

const refreshCallerIdLockForCall = (callSid: string) =>
  Effect.gen(function* () {
    const runtime = yield* ParallelCompatibilityRuntime;
    const groupId = yield* runtime.getGroupIdForCall(callSid);
    if (!groupId) return;
    const group = yield* runtime.getGroup(groupId);
    const call = group?.calls.find(
      (candidate) => candidate.callSid === callSid,
    );
    if (!call || isTerminalCallStatus(call.status)) return;
    yield* runtime.refreshCallerIdLock(call);
  });

export const generateParallelCustomerTwiml = (input: ParallelTwimlInput) =>
  Effect.gen(function* () {
    const runtime = yield* ParallelCompatibilityRuntime;
    if (!input.callSid) {
      return yield* Effect.fail(
        requestError('MISSING_CALL_SID', 'Missing CallSid'),
      );
    }
    if (input.answeredBy) {
      yield* processParallelCallback({
        callSid: input.callSid,
        callStatus: input.callStatus ?? 'in-progress',
        answeredBy: input.answeredBy,
        callDuration: input.callDuration,
        dialCallDuration: input.dialCallDuration,
      });
    } else {
      yield* refreshCallerIdLockForCall(input.callSid);
    }
    const twiml = yield* runtime.generateCustomerTwiml(input.callSid);
    if (!twiml) {
      return yield* Effect.fail(
        new DialerNotFoundError({
          code: 'PARALLEL_GROUP_NOT_FOUND',
          message: 'No parallel group for this call',
          retryable: false,
        }),
      );
    }
    return twiml;
  });

export type { ParallelDialResult };

const escapeXml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

export const generateParallelAgentTwiml = (input: ParallelAgentTwimlInput) =>
  Effect.gen(function* () {
    const runtime = yield* ParallelCompatibilityRuntime;
    const sessionId = readRequiredString(input.sessionId, 'SessionId');
    const clientIdentity = readRequiredString(
      input.clientIdentity,
      'client identity',
    );
    const group = yield* runtime.getGroup(sessionId);
    if (!group || clientIdentity !== `user_${group.userId}`) {
      return yield* Effect.fail(
        new DialerNotFoundError({
          code: 'PARALLEL_GROUP_NOT_FOUND',
          message: 'Parallel group not found',
          retryable: false,
        }),
      );
    }
    if (group.status === 'completed' || group.status === 'failed') {
      return '<?xml version="1.0" encoding="UTF-8"?><Response><Hangup /></Response>';
    }
    return [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<Response>',
      '<Dial>',
      `<Conference beep="false" startConferenceOnEnter="true" endConferenceOnExit="true" waitUrl="" participantLabel="agent">${escapeXml(group.conferenceName)}</Conference>`,
      '</Dial>',
      '</Response>',
    ].join('');
  });

const AGENT_READY_CLEANUP_RETRY_LIMIT = 6;
const AGENT_READY_CLEANUP_RETRY_DELAY_MS = 100;

export const markParallelAgentReady = (
  command: MarkParallelAgentReadyCommand,
) =>
  Effect.gen(function* () {
    const runtime = yield* ParallelCompatibilityRuntime;
    const group = yield* runtime.getGroupForWorkspace(
      command.groupId,
      command.workspaceId,
    );
    if (!group) {
      return yield* Effect.fail(
        new DialerNotFoundError({
          code: 'PARALLEL_GROUP_NOT_FOUND',
          message: 'Parallel group not found',
          retryable: false,
        }),
      );
    }
    let cleanup = { retried: 0, remaining: group.cleanupFailures.length };
    for (let attempt = 0; attempt < AGENT_READY_CLEANUP_RETRY_LIMIT; attempt += 1) {
      cleanup = yield* runtime.retryPendingCleanup(command.groupId);
      if (
        cleanup.remaining === 0 ||
        cleanup.retried === 0 ||
        attempt === AGENT_READY_CLEANUP_RETRY_LIMIT - 1
      ) {
        break;
      }
      yield* Effect.sleep(AGENT_READY_CLEANUP_RETRY_DELAY_MS);
    }
    const refreshed = yield* runtime.getGroupForWorkspace(
      command.groupId,
      command.workspaceId,
    );
    return {
      groupId: command.groupId,
      status: refreshed?.status ?? group.status,
      remainingCleanup: cleanup.remaining,
    } satisfies MarkParallelAgentReadyResult;
  }).pipe(Effect.withSpan('dialer.mark_parallel_agent_ready'));
