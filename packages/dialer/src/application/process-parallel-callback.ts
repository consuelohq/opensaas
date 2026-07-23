import { Effect } from 'effect';

import { isTerminalCallStatus } from '../domain/parallel-call.js';
import { computeParallelTelemetry } from '../domain/telemetry.js';
import {
  ParallelCompatibilityRuntime,
  type ParallelCallbackInput,
  type ParallelCallbackResult,
} from '../ports/parallel-compatibility.js';
import type { ParallelGroup } from '../types.js';

const MIN_SUCCESS_DURATION_SECONDS = 30;

const uniqueFromNumbers = (group: ParallelGroup): string[] =>
  Array.from(
    new Set(group.calls.map((call) => call.fromNumber).filter(Boolean)),
  );

const parseDurationSeconds = (input: ParallelCallbackInput): number | null => {
  const raw = input.callDuration ?? input.dialCallDuration;
  if (!raw) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : null;
};

export const isSuccessfulParallelCompletion = (
  group: ParallelGroup,
  input: ParallelCallbackInput,
  callbackReceivedAt: Date,
): boolean => {
  if (!group.winnerSid) return false;
  const winner = group.calls.find((call) => call.callSid === group.winnerSid);
  if (!winner) return false;
  const humanLike =
    winner.amdResult === 'human' ||
    (group.profile.amdPolicy === 'human-or-unknown' &&
      winner.amdResult === 'unknown');
  if (!humanLike) return false;

  const duration = parseDurationSeconds(input);
  if (duration !== null) return duration >= MIN_SUCCESS_DURATION_SECONDS;
  if (!group.connectedAt || !isTerminalCallStatus(input.callStatus))
    return false;
  const connectedAtMs = new Date(group.connectedAt).getTime();
  if (!Number.isFinite(connectedAtMs)) return false;
  return (
    Math.max(
      0,
      Math.floor((callbackReceivedAt.getTime() - connectedAtMs) / 1000),
    ) >= MIN_SUCCESS_DURATION_SECONDS
  );
};

export const processParallelCallback = (input: ParallelCallbackInput) =>
  Effect.gen(function* () {
    const runtime = yield* ParallelCompatibilityRuntime;
    yield* runtime.handleStatusCallback({
      callSid: input.callSid,
      callStatus: input.callStatus,
      answeredBy: input.answeredBy,
    });

    const groupId = yield* runtime.getGroupIdForCall(input.callSid);
    if (!groupId) {
      return { received: true, groupId: null } satisfies ParallelCallbackResult;
    }
    const group = yield* runtime.getGroup(groupId);
    if (!group) {
      return { received: true, groupId } satisfies ParallelCallbackResult;
    }

    const call = group.calls.find(
      (candidate) => candidate.callSid === input.callSid,
    );
    if (call && !isTerminalCallStatus(call.status)) {
      yield* runtime.refreshCallerIdLock(call);
    }

    const terminalCallback = isTerminalCallStatus(input.callStatus);
    const winnerCallback = input.callSid === group.winnerSid;
    const shouldReleaseAll =
      group.status === 'completed' ||
      (terminalCallback && winnerCallback && group.winnerSid !== null);

    if (shouldReleaseAll) {
      yield* runtime.releaseCallerIdLocks(uniqueFromNumbers(group));
    } else if (group.status === 'connected') {
      yield* runtime.releaseCallerIdLocks(runtime.getReleasableNumbers(group));
    }

    if (terminalCallback && winnerCallback && group.winnerSid !== null) {
      const claimed = yield* runtime.claimTelemetryEmission(groupId);
      if (claimed) {
        yield* runtime.recordTelemetry({
          group,
          telemetry: computeParallelTelemetry(group),
          success: isSuccessfulParallelCompletion(group, input, new Date()),
        });
      }
    }

    return { received: true, groupId } satisfies ParallelCallbackResult;
  }).pipe(
    Effect.withSpan('dialer.process_parallel_callback'),
    Effect.annotateLogs({ callSid: input.callSid }),
  );
