import { DialerTransitionError } from '../errors/dialer-errors.js';
import type { ParallelGroup } from '../types.js';
import {
  applyProviderCallStatus,
  isTerminalCallStatus,
} from './parallel-call.js';
import {
  cloneParallelGroup,
  completeGroupIfResolved,
} from './parallel-group.js';
import { isHumanLikeAnswer } from './parallel-profile.js';

export type ProviderCallbackEvent = {
  callSid: string;
  callStatus: string;
  answeredBy?: string;
  occurredAt: string;
};

export type ParallelTransitionAction =
  | { type: 'claim-winner'; callSid: string }
  | { type: 'terminate-call'; callSid: string }
  | { type: 'unmute-winner'; callSid: string };

export type ParallelTransitionPlan = {
  group: ParallelGroup;
  actions: ParallelTransitionAction[];
};

export type ParallelTransitionResult =
  | { ok: true; plan: ParallelTransitionPlan }
  | { ok: false; error: DialerTransitionError };

const transitionError = (
  group: ParallelGroup,
  callSid: string,
  message: string,
): ParallelTransitionResult => ({
  ok: false,
  error: new DialerTransitionError({
    groupId: group.groupId,
    callSid,
    message,
    retryable: false,
  }),
});

export const planProviderCallbackTransition = (
  sourceGroup: ParallelGroup,
  event: ProviderCallbackEvent,
): ParallelTransitionResult => {
  let group = cloneParallelGroup(sourceGroup);
  const callIndex = group.calls.findIndex(
    (candidate) => candidate.callSid === event.callSid,
  );
  if (callIndex < 0) {
    return transitionError(
      group,
      event.callSid,
      'Parallel call is not in group',
    );
  }

  const previousCall = group.calls[callIndex];
  if (isTerminalCallStatus(previousCall.status)) {
    return { ok: true, plan: { group, actions: [] } };
  }

  const call = applyProviderCallStatus(previousCall, event);
  group.calls[callIndex] = call;
  const actions: ParallelTransitionAction[] = [];
  const humanLike = isHumanLikeAnswer(group.profile, call.amdResult);

  if (event.callStatus === 'in-progress' && humanLike) {
    if (group.winnerSid === event.callSid) {
      group = {
        ...group,
        status: 'connected',
        connectedAt: group.connectedAt ?? call.answeredAt ?? event.occurredAt,
      };
    } else if (group.winnerSid) {
      actions.push({ type: 'terminate-call', callSid: event.callSid });
    } else {
      actions.push({ type: 'claim-winner', callSid: event.callSid });
    }
  } else if (
    event.callStatus === 'in-progress' &&
    call.amdResult !== undefined &&
    !humanLike
  ) {
    actions.push({ type: 'terminate-call', callSid: event.callSid });
  }

  group = completeGroupIfResolved(group, event.occurredAt);
  return { ok: true, plan: { group, actions } };
};

export type WinnerClaimResolution =
  | { outcome: 'won' }
  | { outcome: 'lost'; winnerSid: string | null };

export const resolveWinnerClaim = (
  sourceGroup: ParallelGroup,
  callSid: string,
  resolution: WinnerClaimResolution,
  occurredAt: string,
): ParallelTransitionResult => {
  const group = cloneParallelGroup(sourceGroup);
  const call = group.calls.find((candidate) => candidate.callSid === callSid);
  if (!call) {
    return transitionError(group, callSid, 'Winner candidate is not in group');
  }

  if (resolution.outcome === 'lost') {
    return {
      ok: true,
      plan: {
        group: { ...group, winnerSid: resolution.winnerSid },
        actions: [{ type: 'terminate-call', callSid }],
      },
    };
  }

  const actions: ParallelTransitionAction[] = [];
  if (group.profile.terminationPolicy === 'winner-take-all') {
    for (const candidate of group.calls) {
      if (
        candidate.callSid !== callSid &&
        !isTerminalCallStatus(candidate.status)
      ) {
        actions.push({ type: 'terminate-call', callSid: candidate.callSid });
      }
    }
  }
  actions.push({ type: 'unmute-winner', callSid });

  return {
    ok: true,
    plan: {
      group: {
        ...group,
        winnerSid: callSid,
        status: 'connected',
        connectedAt: call.answeredAt ?? occurredAt,
      },
      actions,
    },
  };
};
