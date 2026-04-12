import type { CallTimingModel } from '@consuelo/dialer';

import {
  DEFAULT_RETRY_DELAY_MINUTES,
  evaluateRetryPolicy,
} from 'src/engine/core-modules/consuelo-api/services/retry-policy';

describe('evaluateRetryPolicy', () => {
  it('should keep default retry delay when hazard model has no confident estimate', async () => {
    const evaluatedAt = new Date('2026-04-10T15:00:00.000Z');
    const timingModel = {
      getBestTimeToCall: jest.fn().mockResolvedValue(null),
    } as unknown as CallTimingModel;

    const decision = await evaluateRetryPolicy({
      outcome: 'no-answer',
      isHighPriority: true,
      attemptsUsed: 0,
      attemptCap: 2,
      localTimezone: 'America/New_York',
      segmentId: 'all',
      timingModel,
      evaluatedAt,
    });

    expect(decision.shouldRetry).toBe(true);
    expect(decision.retryReason).toBe(
      'no_answer_high_priority_local_daytime_under_cap',
    );
    expect(decision.retryScheduledAt).toBe(
      new Date(
        evaluatedAt.getTime() + DEFAULT_RETRY_DELAY_MINUTES * 60 * 1000,
      ).toISOString(),
    );
  });

  it('should use hazard optimized time when model returns optimal window', async () => {
    const evaluatedAt = new Date('2026-04-10T15:00:00.000Z');
    const timingModel = {
      getBestTimeToCall: jest.fn().mockResolvedValue({
        hour: 11,
        dayOfWeek: 1,
      }),
    } as unknown as CallTimingModel;

    const decision = await evaluateRetryPolicy({
      outcome: 'no-answer',
      isHighPriority: true,
      attemptsUsed: 1,
      attemptCap: 3,
      localTimezone: 'America/New_York',
      segmentId: 'all',
      timingModel,
      evaluatedAt,
    });

    expect(decision.shouldRetry).toBe(true);
    expect(decision.retryReason).toBe(
      'no_answer_high_priority_local_daytime_hazard_optimized_under_cap',
    );
    expect(decision.retryScheduledAt).not.toBeNull();
  });
});
