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
  retryStrategy: RetryStrategy;
  retryReason: string | null;
  retryScheduledAt: string | null;
};

export const DEFAULT_RETRY_DELAY_MINUTES = 5;
export const LOCAL_DAYTIME_START_HOUR = 9;
export const LOCAL_DAYTIME_END_HOUR = 18;

const getLocalDateParts = (
  date: Date,
  timeZone: string,
): { hour: number; dayOfWeek: number } | null => {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      hour: '2-digit',
      hour12: false,
      weekday: 'short',
      timeZone,
    }).formatToParts(date);

    const hourPart = parts.find((p) => p.type === 'hour');
    const dayPart = parts.find((p) => p.type === 'weekday');

    if (!hourPart || !dayPart) {
      return null;
    }

    const hour = Number(hourPart.value);
    const dayMap: Record<string, number> = {
      Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
    };
    const dayOfWeek = dayMap[dayPart.value] ?? 0;

    return Number.isFinite(hour) ? { hour, dayOfWeek } : null;
  } catch {
    return null;
  }
};

const isLocalDaytime = (date: Date, timeZone: string): boolean => {
  const localDateParts = getLocalDateParts(date, timeZone);

  if (!localDateParts) {
    return false;
  }

  return (
    localDateParts.hour >= LOCAL_DAYTIME_START_HOUR &&
    localDateParts.hour < LOCAL_DAYTIME_END_HOUR
  );
};

const buildNoRetryDecision = (reason: string): RetryPolicyDecision => ({
  shouldRetry: false,
  retryStrategy: 'none',
  retryReason: reason,
  retryScheduledAt: null,
});

const estimateRetryDateFromHazardWindow = (
  evaluatedAt: Date,
  localTimezone: string,
  hazardWindow: { hour: number; dayOfWeek: number },
): Date | null => {
  for (let hoursOffset = 1; hoursOffset <= 14 * 24; hoursOffset += 1) {
    const candidate = new Date(evaluatedAt.getTime() + hoursOffset * 60 * 60 * 1000);
    const currentLocalParts = getLocalDateParts(candidate, localTimezone);

    if (!currentLocalParts) {
      return null;
    }

    const hasMatchingDay = currentLocalParts.dayOfWeek === hazardWindow.dayOfWeek;
    const hasMatchingHour = currentLocalParts.hour === hazardWindow.hour;

    if (hasMatchingDay && hasMatchingHour) {
      return candidate;
    }
  }

  return null;
};

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

  // stopping model: should we retry at all? (expected value check)
  const nextAttempt = input.attemptsUsed + 1;
  const stoppingModel = new StoppingModelService(stoppingModelStore);
  const threshold = await stoppingModel.getThresholdForAttempt({
    workspaceId: input.workspaceId,
    segmentId: input.segmentId,
    attemptNumber: nextAttempt,
    maxAttempts: input.maxAttempts,
  });

  if (threshold === null) {
    // insufficient data — fall back to default delay
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

  // timing model: WHEN should we retry? (hazard-optimized scheduling)
  let retryScheduledAt = new Date(
    evaluatedAt.getTime() + DEFAULT_RETRY_DELAY_MINUTES * 60 * 1000,
  );
  let retryReason = 'no_answer_high_priority_local_daytime_positive_expected_value';

  if (input.timingModel && input.segmentId) {
    try {
      const optimalHazardWindow = await input.timingModel.getBestTimeToCall({
        segmentId: input.segmentId,
        attemptNumber: nextAttempt,
      });

      if (optimalHazardWindow) {
        const modelRetryDate = estimateRetryDateFromHazardWindow(
          evaluatedAt,
          input.localTimezone,
          optimalHazardWindow,
        );

        if (modelRetryDate) {
          retryScheduledAt = modelRetryDate;
          retryReason =
            'no_answer_high_priority_local_daytime_hazard_optimized_positive_ev';
        }
      }
    } catch {
      // timing model failure — fall back to default delay silently
    }
  }

  return {
    shouldRetry: true,
    retryStrategy: 'double-dial-no-answer',
    retryReason,
    retryScheduledAt: retryScheduledAt.toISOString(),
  };
};
