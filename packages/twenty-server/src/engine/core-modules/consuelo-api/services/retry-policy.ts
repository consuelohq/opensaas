import {
  type CallTimingModel,
  StoppingModelService,
  type StoppingModelStore,
} from '@consuelo/dialer';

export type RetryStrategy = 'none' | 'double-dial-no-answer';

export type RetryPolicyInput = {
  workspaceId: string;
  segmentId: string;
  outcome: string | null;
  isHighPriority: boolean;
  attemptsUsed: number;
  maxAttempts: number;
  localTimezone: string;
  timingModel?: CallTimingModel;
  evaluatedAt?: Date;
};

export type RetryPolicyDecision = {
  shouldRetry: boolean;
  delaySeconds: number;
  strategy: RetryStrategy;
  reason: string;
  retryStrategy: RetryStrategy;
  retryScheduledAt: string | null;
  retryReason: string | null;
};

const STOPPING_MODEL_CACHE = new WeakMap<
  StoppingModelStore,
  StoppingModelService
>();

const createRetryDecision = (
  input: {
    shouldRetry: boolean;
    delaySeconds: number;
    strategy: RetryStrategy;
    reason: string;
    retryReason: string;
  },
  evaluatedAt: Date,
): RetryPolicyDecision => {
  const retryScheduledAt = input.shouldRetry
    ? new Date(evaluatedAt.getTime() + input.delaySeconds * 1000).toISOString()
    : null;

  return {
    shouldRetry: input.shouldRetry,
    delaySeconds: input.delaySeconds,
    strategy: input.strategy,
    reason: input.reason,
    retryStrategy: input.strategy,
    retryScheduledAt,
    retryReason: input.retryReason,
  };
};

const getStoppingModelService = (
  store: StoppingModelStore,
): StoppingModelService => {
  if (!STOPPING_MODEL_CACHE.has(store)) {
    STOPPING_MODEL_CACHE.set(store, new StoppingModelService(store));
  }
  return STOPPING_MODEL_CACHE.get(store)!;
};

export const evaluateRetryPolicy = async (
  input: RetryPolicyInput,
  stoppingModelStore: StoppingModelStore,
): Promise<RetryPolicyDecision> => {
  const evaluatedAt = input.evaluatedAt ?? new Date();

  if (input.outcome === 'answered') {
    return createRetryDecision(
      {
        shouldRetry: false,
        delaySeconds: 0,
        strategy: 'none',
        reason: 'Call was answered',
        retryReason: 'answered',
      },
      evaluatedAt,
    );
  }

  if (input.attemptsUsed >= input.maxAttempts) {
    return createRetryDecision(
      {
        shouldRetry: false,
        delaySeconds: 0,
        strategy: 'none',
        reason: `Maximum attempts (${input.maxAttempts}) reached`,
        retryReason: 'max_attempts_reached',
      },
      evaluatedAt,
    );
  }

  const nextAttempt = input.attemptsUsed + 1;
  const stoppingModel = getStoppingModelService(stoppingModelStore);
  const threshold = await stoppingModel.getThresholdForAttempt({
    workspaceId: input.workspaceId,
    segmentId: input.segmentId,
    attemptNumber: nextAttempt,
    maxAttempts: input.maxAttempts,
  });

  if (threshold === null) {
    const capFallback = input.maxAttempts;
    if (nextAttempt <= capFallback) {
      const baseDelay = 30;
      const jitter = Math.random() * 10;
      return createRetryDecision(
        {
          shouldRetry: true,
          delaySeconds: baseDelay + jitter,
          strategy: 'double-dial-no-answer',
          reason: `Insufficient data for attempt ${nextAttempt}, using cap fallback`,
          retryReason: 'insufficient_data_cap_fallback',
        },
        evaluatedAt,
      );
    }
    return createRetryDecision(
      {
        shouldRetry: false,
        delaySeconds: 0,
        strategy: 'none',
        reason: 'Insufficient data and beyond fallback cap',
        retryReason: 'insufficient_data_beyond_cap',
      },
      evaluatedAt,
    );
  }

  if (threshold.shouldStop) {
    return createRetryDecision(
      {
        shouldRetry: false,
        delaySeconds: 0,
        strategy: 'none',
        reason: `Optimal stopping: expected value (${threshold.expectedValue.toFixed(2)}) < cost per attempt for attempt ${nextAttempt}`,
        retryReason: 'expected_value_below_attempt_cost',
      },
      evaluatedAt,
    );
  }

  const baseDelay = 30;
  const jitter = Math.random() * 10;
  return createRetryDecision(
    {
      shouldRetry: true,
      delaySeconds: baseDelay + jitter,
      strategy: 'double-dial-no-answer',
      reason: `Threshold check passed for attempt ${nextAttempt}`,
      retryReason: 'threshold_check_passed',
    },
    evaluatedAt,
  );
};
