import { StoppingModelService, type StoppingModelStore } from '@consuelo/dialer';
import type { CallTimingModel } from '@consuelo/dialer';

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
};

const STOPPING_MODEL_CACHE = new Map<string, StoppingModelService>();

function getStoppingModelService(store: StoppingModelStore): StoppingModelService {
  const key = 'default';
  if (!STOPPING_MODEL_CACHE.has(key)) {
    STOPPING_MODEL_CACHE.set(key, new StoppingModelService(store));
  }
  return STOPPING_MODEL_CACHE.get(key)!;
}

export async function evaluateRetryPolicy(
  input: RetryPolicyInput,
  stoppingModelStore: StoppingModelStore,
): Promise<RetryPolicyDecision> {
  if (input.outcome === 'answered') {
    return {
      shouldRetry: false,
      delaySeconds: 0,
      strategy: 'none',
      reason: 'Call was answered',
    };
  }

  if (input.attemptsUsed >= input.maxAttempts) {
    return {
      shouldRetry: false,
      delaySeconds: 0,
      strategy: 'none',
      reason: `Maximum attempts (${input.maxAttempts}) reached`,
    };
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
      return {
        shouldRetry: true,
        delaySeconds: baseDelay + jitter,
        strategy: 'double-dial-no-answer',
        reason: `Insufficient data for attempt ${nextAttempt}, using cap fallback`,
      };
    }
    return {
      shouldRetry: false,
      delaySeconds: 0,
      strategy: 'none',
      reason: 'Insufficient data and beyond fallback cap',
    };
  }

  if (threshold.shouldStop) {
    return {
      shouldRetry: false,
      delaySeconds: 0,
      strategy: 'none',
      reason: `Optimal stopping: expected value (${threshold.expectedValue.toFixed(2)}) < cost per attempt for attempt ${nextAttempt}`,
    };
  }

  const baseDelay = 30;
  const jitter = Math.random() * 10;
  return {
    shouldRetry: true,
    delaySeconds: baseDelay + jitter,
    strategy: 'double-dial-no-answer',
    reason: `Threshold check passed for attempt ${nextAttempt}`,
  };
}
