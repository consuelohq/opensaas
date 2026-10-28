import { Effect } from 'effect';

import {
  clearCleanupFailure,
  recordCleanupFailure,
} from '../domain/parallel-group.js';
import type { ParallelTransitionAction } from '../domain/parallel-transition.js';
import type { DialerProviderError } from '../errors/dialer-errors.js';
import type { CallProviderService } from '../ports/call-provider.js';
import type { ParallelGroup } from '../types.js';

const applySuccess = (
  group: ParallelGroup,
  action: Exclude<ParallelTransitionAction, { type: 'claim-winner' }>,
  occurredAt: string,
): ParallelGroup => {
  const cleared = clearCleanupFailure(group, action.type, action.callSid);
  if (action.type === 'unmute-winner') return cleared;

  return {
    ...cleared,
    calls: cleared.calls.map((call) =>
      call.callSid === action.callSid
        ? { ...call, status: 'completed', terminatedAt: occurredAt }
        : call,
    ),
  };
};

const applyFailure = (
  group: ParallelGroup,
  action: Exclude<ParallelTransitionAction, { type: 'claim-winner' }>,
  error: DialerProviderError,
  occurredAt: string,
): ParallelGroup =>
  recordCleanupFailure(
    group,
    action.type,
    action.callSid,
    error.message,
    occurredAt,
    error.retryable,
  );

export const executeCleanupActions = (
  sourceGroup: ParallelGroup,
  actions: ParallelTransitionAction[],
  provider: CallProviderService,
  occurredAt: string,
): Effect.Effect<ParallelGroup> =>
  Effect.gen(function* () {
    let group = sourceGroup;

    for (const action of actions) {
      if (action.type === 'claim-winner') continue;
      const operation =
        action.type === 'terminate-call'
          ? provider.terminateCall(action.callSid)
          : provider.unmuteConferenceParticipant(
              group.conferenceName,
              action.callSid,
            );
      const outcome = yield* Effect.either(operation);
      group =
        outcome._tag === 'Right'
          ? applySuccess(group, action, occurredAt)
          : applyFailure(group, action, outcome.left, occurredAt);
    }

    return group;
  });
