import { Effect } from 'effect';

import { isTerminalCallStatus } from '../domain/parallel-call.js';
import { CallProvider } from '../ports/call-provider.js';
import { DialerClock } from '../ports/clock.js';
import { ParallelStateStore } from '../ports/parallel-state-store.js';
import { ACTIVE_CALL_TTL_SECONDS } from '../services/caller-id.js';
import { executeCleanupActions } from './cleanup-actions.js';

export const terminateCallSession = (groupId: string) =>
  Effect.gen(function* () {
    const provider = yield* CallProvider;
    const state = yield* ParallelStateStore;
    const clock = yield* DialerClock;

    const locked = Effect.gen(function* () {
      const group = yield* state.getGroup(groupId);
      if (!group) return;
      const occurredAt = (yield* clock.now).toISOString();
      const actions = group.calls
        .filter((call) => !isTerminalCallStatus(call.status))
        .map((call) => ({
          type: 'terminate-call' as const,
          callSid: call.callSid,
        }));
      const cleaned = yield* executeCleanupActions(
        group,
        actions,
        provider,
        occurredAt,
      );
      yield* state.setGroup(
        {
          ...cleaned,
          status: cleaned.cleanupFailures.length > 0 ? 'failed' : 'completed',
          completedAt: occurredAt,
        },
        ACTIVE_CALL_TTL_SECONDS,
      );
    });

    yield* state.withGroupLock(groupId, locked);
  }).pipe(Effect.withSpan('dialer.terminate_call_session'));

export const terminateCallSessionForWorkspace = (
  groupId: string,
  workspaceId: string,
) =>
  Effect.gen(function* () {
    const state = yield* ParallelStateStore;
    const group = yield* state.getGroup(groupId);
    if (!group || group.workspaceId !== workspaceId) return false;
    yield* terminateCallSession(groupId);
    return true;
  });
