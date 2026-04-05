import { evaluateRetryPolicy } from './retry-policy.js';

describe('evaluateRetryPolicy', () => {
  it('should schedule retry when all explicit rules pass', () => {
    const result = evaluateRetryPolicy({
      outcome: 'no-answer',
      isHighPriority: true,
      attemptsUsed: 1,
      attemptCap: 2,
      localTimezone: 'America/New_York',
      evaluatedAt: new Date('2026-03-29T15:00:00.000Z'),
    });

    expect(result.shouldRetry).toBe(true);
    expect(result.retryStrategy).toBe('double-dial-no-answer');
    expect(result.retryReason).toBe(
      'no_answer_high_priority_local_daytime_under_cap',
    );
    expect(result.retryScheduledAt).toBe('2026-03-29T15:05:00.000Z');
  });

  it('should not retry when outcome is not no-answer', () => {
    const result = evaluateRetryPolicy({
      outcome: 'connected',
      isHighPriority: true,
      attemptsUsed: 1,
      attemptCap: 2,
      localTimezone: 'America/New_York',
      evaluatedAt: new Date('2026-03-29T15:00:00.000Z'),
    });

    expect(result.shouldRetry).toBe(false);
    expect(result.retryReason).toBe('outcome_not_no_answer');
  });

  it('should not retry when attempt cap is reached', () => {
    const result = evaluateRetryPolicy({
      outcome: 'no-answer',
      isHighPriority: true,
      attemptsUsed: 2,
      attemptCap: 2,
      localTimezone: 'America/New_York',
      evaluatedAt: new Date('2026-03-29T15:00:00.000Z'),
    });

    expect(result.shouldRetry).toBe(false);
    expect(result.retryReason).toBe('attempt_cap_reached');
  });
});
