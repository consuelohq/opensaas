import { Effect } from 'effect';

export type ProviderCompletion = {
  workspaceId: string;
  userId: string;
  seatId: string;
  sessionId: string;
  providerCallId: string;
  customerConnectedSeconds: number;
  agentConnectedSeconds: number;
  providerCostMicros: number;
  occurredAt: string;
  billingPeriod: { start: string; end: string };
};

export const createUsageEventFromProviderCompletion = (
  input: ProviderCompletion,
) => ({
  workspaceId: input.workspaceId,
  userId: input.userId,
  seatId: input.seatId,
  sessionId: input.sessionId,
  metric: 'connected_minutes' as const,
  quantity: Math.ceil(Math.max(0, input.customerConnectedSeconds) / 60),
  providerCostMicros: Math.max(0, input.providerCostMicros),
  sourceType: 'twilio.call.completed' as const,
  sourceId: input.providerCallId,
  occurredAt: input.occurredAt,
  billingPeriod: input.billingPeriod,
});

export const recordFinalProviderUsage = (input: {
  completion: ProviderCompletion;
  repository: {
    claimSource: (
      workspaceId: string,
      sourceId: string,
    ) => Effect.Effect<boolean, unknown>;
    completeSource: (
      workspaceId: string,
      sourceId: string,
    ) => Effect.Effect<void, unknown>;
    failSource: (
      workspaceId: string,
      sourceId: string,
      errorCode: string,
    ) => Effect.Effect<void, unknown>;
    insertUsageEvent: (
      event: ReturnType<typeof createUsageEventFromProviderCompletion>,
    ) => Effect.Effect<void, unknown>;
  };
  releaseResources: () => Effect.Effect<void, unknown>;
}) =>
  Effect.gen(function* () {
    const claimed = yield* input.repository.claimSource(
      input.completion.workspaceId,
      input.completion.providerCallId,
    );
    if (claimed) {
      yield* input.repository
        .insertUsageEvent(
          createUsageEventFromProviderCompletion(input.completion),
        )
        .pipe(
          Effect.tap(() =>
            input.repository.completeSource(
              input.completion.workspaceId,
              input.completion.providerCallId,
            ),
          ),
          Effect.tapError(() =>
            input.repository.failSource(
              input.completion.workspaceId,
              input.completion.providerCallId,
              'USAGE_PERSISTENCE_FAILED',
            ),
          ),
        );
    }
    yield* input.releaseResources();
    return { duplicate: !claimed };
  });
