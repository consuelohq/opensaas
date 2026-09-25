import { Effect } from 'effect';

import { createParallelGroup } from '../domain/parallel-group.js';
import {
  DialerStateError,
  DialerTimeoutError,
  type DialerApplicationError,
} from '../errors/dialer-errors.js';
import { CallProvider } from '../ports/call-provider.js';
import { DialerClock } from '../ports/clock.js';
import { DialerIdGenerator } from '../ports/id-generator.js';
import { ParallelStateStore } from '../ports/parallel-state-store.js';
import { ACTIVE_CALL_TTL_SECONDS } from '../services/caller-id.js';
import type {
  ParallelCall,
  ParallelDialOptions,
  ParallelDialResult,
  ParallelGroup,
} from '../types.js';
import { executeCleanupActions } from './cleanup-actions.js';

export type StartParallelSessionOptions = {
  providerTimeoutMs?: number;
};

const DEFAULT_PROVIDER_TIMEOUT_MS = 30_000;

const findUniqueGroupId = Effect.gen(function* () {
  const state = yield* ParallelStateStore;
  const ids = yield* DialerIdGenerator;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const groupId = yield* ids.generateParallelGroupId;
    const existing = yield* state.getGroup(groupId);
    if (!existing) return groupId;
  }

  return yield* Effect.fail(
    new DialerStateError({
      operation: 'generate-group-id',
      message: 'Failed to generate unique group ID after 3 attempts',
      retryable: true,
    }),
  );
});

const failInitializingGroup = (
  groupId: string,
): Effect.Effect<
  void,
  DialerApplicationError,
  | typeof ParallelStateStore.Service
  | typeof CallProvider.Service
  | typeof DialerClock.Service
> =>
  Effect.gen(function* () {
    const state = yield* ParallelStateStore;
    const provider = yield* CallProvider;
    const clock = yield* DialerClock;
    const group = yield* state.getGroup(groupId);
    if (!group) return;

    const now = (yield* clock.now).toISOString();
    const actions = group.calls
      .filter(
        (call) =>
          !['completed', 'failed', 'busy', 'no-answer', 'canceled'].includes(
            call.status,
          ),
      )
      .map((call) => ({
        type: 'terminate-call' as const,
        callSid: call.callSid,
      }));
    const cleaned = yield* executeCleanupActions(group, actions, provider, now);
    const failed: ParallelGroup = {
      ...cleaned,
      status: 'failed',
      completedAt: now,
    };
    yield* state.setGroup(failed, ACTIVE_CALL_TTL_SECONDS);
  });

export const startParallelSession = (
  input: ParallelDialOptions,
  options: StartParallelSessionOptions = {},
) =>
  Effect.gen(function* () {
    yield* Effect.logDebug('Starting parallel dial session');
    const provider = yield* CallProvider;
    const state = yield* ParallelStateStore;
    const clock = yield* DialerClock;
    const groupId = yield* findUniqueGroupId;
    const createdAt = (yield* clock.now).toISOString();
    const group = createParallelGroup(groupId, input, createdAt);
    yield* state.setGroup(group, ACTIVE_CALL_TTL_SECONDS);

    const providerTimeoutMs =
      options.providerTimeoutMs ?? DEFAULT_PROVIDER_TIMEOUT_MS;

    const createCalls = Effect.gen(function* () {
      const calls: ParallelCall[] = [];
      for (let index = 0; index < input.customerNumbers.length; index += 1) {
        if (index > 0) yield* clock.sleep(input.profile.staggerMs);

        const created = yield* provider
          .createCall({
            to: input.customerNumbers[index],
            from: input.fromNumbers[index],
            customerTwimlUrl: input.customerTwimlUrl,
            statusCallbackUrl: input.statusCallbackUrl,
          })
          .pipe(
            Effect.timeoutFail({
              duration: providerTimeoutMs,
              onTimeout: () =>
                new DialerTimeoutError({
                  operation: 'create-call',
                  timeoutMs: providerTimeoutMs,
                  message: `Provider call creation timed out after ${providerTimeoutMs}ms`,
                  retryable: true,
                }),
            }),
          );
        const dialStartedAt = (yield* clock.now).toISOString();
        const call: ParallelCall = {
          callSid: created.callSid,
          customerNumber: input.customerNumbers[index],
          fromNumber: input.fromNumbers[index],
          position: index + 1,
          status: 'dialing',
          contactId: input.contactIds?.[index],
          dialStartedAt,
          predictiveDecisionId:
            input.predictiveDecisionIds?.[index] ?? undefined,
          decisionContext: input.decisionContexts?.[index] ?? undefined,
        };
        calls.push(call);
        yield* state.registerCall(groupId, call, ACTIVE_CALL_TTL_SECONDS);
      }

      const result: ParallelDialResult = {
        groupId,
        conferenceName: group.conferenceName,
        profileId: input.profile.id,
        calls: calls.map((call) => ({
          callSid: call.callSid,
          customerNumber: call.customerNumber,
          fromNumber: call.fromNumber,
          position: call.position,
          status: 'dialing',
        })),
      };
      return result;
    });

    return yield* createCalls.pipe(
      Effect.catchAll((error) =>
        failInitializingGroup(groupId).pipe(
          Effect.catchAll(() => Effect.void),
          Effect.zipRight(Effect.fail(error)),
        ),
      ),
      Effect.onInterrupt(() =>
        failInitializingGroup(groupId).pipe(Effect.catchAll(() => Effect.void)),
      ),
    );
  }).pipe(
    Effect.withSpan('dialer.start_parallel_session'),
    Effect.annotateLogs({ workspaceId: input.workspaceId }),
  );
