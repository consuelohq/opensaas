import { Effect } from 'effect';

import { isStaleDialingGroup } from '../domain/parallel-group.js';
import { DialerClock } from '../ports/clock.js';
import { ParallelStateStore } from '../ports/parallel-state-store.js';
import { terminateCallSession } from './terminate-call-session.js';

const GROUP_DIALING_TIMEOUT_MS = 60_000;

export const getCallSession = (groupId: string) =>
  Effect.gen(function* () {
    const state = yield* ParallelStateStore;
    const clock = yield* DialerClock;
    const group = yield* state.getGroup(groupId);
    if (!group) return null;

    const now = yield* clock.now;
    if (!isStaleDialingGroup(group, now, GROUP_DIALING_TIMEOUT_MS)) {
      return group;
    }

    yield* terminateCallSession(groupId);
    return yield* state.getGroup(groupId);
  }).pipe(Effect.withSpan('dialer.get_call_session'));

export const getCallSessionForWorkspace = (
  groupId: string,
  workspaceId: string,
) =>
  Effect.gen(function* () {
    const group = yield* getCallSession(groupId);
    return group?.workspaceId === workspaceId ? group : null;
  });
