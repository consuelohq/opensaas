import { StoppingModelService, type StoppingModelStore } from '@consuelo/dialer';

export type RetryStrategy = 'none' | 'double-dial-no-answer';

export type RetryPolicyInput = {
  workspaceId: string;
  segmentId: string;
  outcome: string | null;
  isHighPriority: boolean;
  attemptsUsed: number;
  maxAttempts: number;
  localTimezone: string;
  evaluatedAt?: Date;
};

export type RetryPolicyDecision = {
  shouldRetry: boolean;
  retryStrategy: RetryStrategy;
  retryReason: string | null;
  retryScheduledAt: string | null;
};

const DEFAULT_RETRY_DELAY_MINUTES = 5;
const LOCAL_DAYTIME_START_HOUR = 9;
const LOCAL_DAYTIME_END_HOUR = 18;

const getLocalHour = (date: Date, timeZone: string): number | null => {
  try {
    const localHour = new Intl.DateTimeFormat('en-US', {
      hour: '2-digit',
      hour12: false,
      timeZone,
    }).format(date);
    const parsed = Number(localHour);

    return Number.isFinite(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

const isLocalDaytime = (date: Date, timeZone: string): boolean => {
  const localHour = getLocalHour(date, timeZone);

  if (localHour === null) {
    return false;
  }

  return (
    localHour >= LOCAL_DAYTIME_START_HOUR && localHour < LOCAL_DAYTIME_END_HOUR
  );
};

const buildNoRetryDecision = (reason: string): RetryPolicyDecision => ({
  shouldRetry: false,
  retryStrategy: 'none',
  retryReason: reason,
  retryScheduledAt: null,
});

export const evaluateRetryPolicy = async (
  input: RetryPolicyInput,
  stoppingModelStore: StoppingModelStore,
): Promise<RetryPolicyDecision> => {
  const evaluatedAt = input.evaluatedAt ?? new Date();

  if (input.outcome !== 'no-answer') {
    return buildNoRetryDecision('outcome_not_no_answer');
  }

  if (!input.isHighPriority) {
    return buildNoRetryDecision('not_high_priority');
  }

  if (!isLocalDaytime(evaluatedAt, input.localTimezone)) {
    return buildNoRetryDecision('outside_local_daytime');
  }

  if (input.attemptsUsed >= input.maxAttempts) {
    return buildNoRetryDecision('attempt_cap_reached');
  }

  const nextAttempt = input.attemptsUsed + 1;
  const stoppingModel = new StoppingModelService(stoppingModelStore);
  const threshold = await stoppingModel.getThresholdForAttempt({
    workspaceId: input.workspaceId,
    segmentId: input.segmentId,
    attemptNumber: nextAttempt,
    maxAttempts: input.maxAttempts,
  });

  if (threshold === null) {
    const retryScheduledAt = new Date(
      evaluatedAt.getTime() + DEFAULT_RETRY_DELAY_MINUTES * 60 * 1000,
    );

    return {
      shouldRetry: true,
      retryStrategy: 'double-dial-no-answer',
      retryReason: 'insufficient_stopping_data_fallback_to_attempt_cap',
      retryScheduledAt: retryScheduledAt.toISOString(),
    };
  }

  if (threshold.shouldStop) {
    return buildNoRetryDecision('expected_value_below_attempt_cost');
  }

  const retryScheduledAt = new Date(
    evaluatedAt.getTime() + DEFAULT_RETRY_DELAY_MINUTES * 60 * 1000,
  );

  return {
    shouldRetry: true,
    retryStrategy: 'double-dial-no-answer',
    retryReason: 'no_answer_high_priority_local_daytime_positive_expected_value',
    retryScheduledAt: retryScheduledAt.toISOString(),
  };
};
