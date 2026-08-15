import { Effect } from 'effect';

import {
  planProviderCallbackTransition,
  resolveWinnerClaim,
  type ProviderCallbackEvent,
} from '../domain/parallel-transition.js';
import { CallProvider } from '../ports/call-provider.js';
import { DialerClock } from '../ports/clock.js';
import { ParallelStateStore } from '../ports/parallel-state-store.js';
import { ACTIVE_CALL_TTL_SECONDS } from '../services/caller-id.js';
import { executeCleanupActions } from './cleanup-actions.js';

export type ProcessProviderCallbackInput = Omit<
  ProviderCallbackEvent,
  'occurredAt'
> & {
  occurredAt?: string;
};

export const processProviderCallback = (input: ProcessProviderCallbackInput) =>
  Effect.gen(function* () {
    yield* Effect.logDebug('Processing provider callback');
    const provider = yield* CallProvider;
    const state = yield* ParallelStateStore;
    const clock = yield* DialerClock;
    const groupId = yield* state.getGroupIdForCall(input.callSid);
    if (!groupId) return;

    const occurredAt = input.occurredAt ?? (yield* clock.now).toISOString();

    const locked = Effect.gen(function* () {
      const sourceGroup = yield* state.getGroup(groupId);
      if (!sourceGroup) return;

      const transition = planProviderCallbackTransition(sourceGroup, {
        ...input,
        occurredAt,
      });
      if (!transition.ok) return yield* Effect.fail(transition.error);

      let group = transition.plan.group;
      let actions = transition.plan.actions;
      const claim = actions.find((action) => action.type === 'claim-winner');
      if (claim) {
        const won = yield* state.claimWinner(
          groupId,
          claim.callSid,
          ACTIVE_CALL_TTL_SECONDS,
        );
        const winnerSid = won ? claim.callSid : yield* state.getWinner(groupId);
        const resolution = resolveWinnerClaim(
          group,
          claim.callSid,
          won ? { outcome: 'won' } : { outcome: 'lost', winnerSid },
          occurredAt,
        );
        if (!resolution.ok) return yield* Effect.fail(resolution.error);
        group = resolution.plan.group;
        actions = resolution.plan.actions;
      }

      group = yield* executeCleanupActions(
        group,
        actions,
        provider,
        occurredAt,
      );
      yield* state.setGroup(group, ACTIVE_CALL_TTL_SECONDS);
    });

    yield* state.withGroupLock(groupId, locked);
  }).pipe(
    Effect.withSpan('dialer.process_provider_callback'),
    Effect.annotateLogs({ callSid: input.callSid }),
  );
