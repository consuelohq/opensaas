import { Effect } from 'effect';

import {
  clearCleanupFailure,
  recordCleanupFailure,
} from '../domain/parallel-group.js';
import { DialerCleanupError } from '../errors/dialer-errors.js';
import { CallProvider } from '../ports/call-provider.js';
import { DialerClock } from '../ports/clock.js';
import { ParallelStateStore } from '../ports/parallel-state-store.js';
import { ACTIVE_CALL_TTL_SECONDS } from '../services/caller-id.js';

export const retryPendingCleanup = (groupId: string) =>
  Effect.gen(function* () {
    const provider = yield* CallProvider;
    const state = yield* ParallelStateStore;
    const clock = yield* DialerClock;

    const locked = Effect.gen(function* () {
      const sourceGroup = yield* state.getGroup(groupId);
      if (!sourceGroup) {
        return { retried: 0, remaining: 0, errors: [] as DialerCleanupError[] };
      }
      const occurredAt = (yield* clock.now).toISOString();
      const pending = [...sourceGroup.cleanupFailures];
      const errors: DialerCleanupError[] = [];
      let retried = 0;
      let group = {
        ...sourceGroup,
        cleanupFailures: sourceGroup.cleanupFailures.filter(
          (failure) => failure.retryable === false,
        ),
      };

      for (const failure of pending) {
        if (failure.retryable === false) continue;
        retried += 1;
        const operation =
          failure.action === 'terminate-call'
            ? provider.terminateCall(failure.callSid)
            : provider.unmuteConferenceParticipant(
                group.conferenceName,
                failure.callSid,
              );
        const outcome = yield* Effect.either(operation);
        if (outcome._tag === 'Left') {
          errors.push(
            new DialerCleanupError({
              action: failure.action,
              callSid: failure.callSid,
              message: outcome.left.message,
              retryable: outcome.left.retryable,
              cause: outcome.left,
            }),
          );
          group = recordCleanupFailure(
            group,
            failure.action,
            failure.callSid,
            outcome.left.message,
            occurredAt,
            outcome.left.retryable,
            failure,
          );
          continue;
        }

        group = clearCleanupFailure(group, failure.action, failure.callSid);
        if (failure.action === 'terminate-call') {
          group = {
            ...group,
            calls: group.calls.map((call) =>
              call.callSid === failure.callSid
                ? { ...call, status: 'completed', terminatedAt: occurredAt }
                : call,
            ),
          };
        }
      }

      yield* state.setGroup(group, ACTIVE_CALL_TTL_SECONDS);
      return {
        retried,
        remaining: group.cleanupFailures.length,
        errors,
      };
    });

    return yield* state.withGroupLock(groupId, locked);
  }).pipe(Effect.withSpan('dialer.retry_pending_cleanup'));
