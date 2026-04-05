import { evaluateRetryPolicy } from './retry-policy.js';

// helper: 2026-03-29 15:00 UTC = 11:00 AM ET (daytime)
const daytimeET = new Date('2026-03-29T15:00:00.000Z');
// 2026-03-29 06:00 UTC = 2:00 AM ET (nighttime)
const nighttimeET = new Date('2026-03-29T06:00:00.000Z');

const baseInput = {
  outcome: 'no-answer' as string | null,
  isHighPriority: true,
  attemptsUsed: 1,
  attemptCap: 2,
  localTimezone: 'America/New_York',
  evaluatedAt: daytimeET,
};

describe('evaluateRetryPolicy', () => {
  describe('happy path — should retry', () => {
    it('should schedule retry when all conditions pass', () => {
      const result = evaluateRetryPolicy(baseInput);
      expect(result.shouldRetry).toBe(true);
      expect(result.retryStrategy).toBe('double-dial-no-answer');
      expect(result.retryReason).toBe(
        'no_answer_high_priority_local_daytime_under_cap',
      );
      expect(result.retryScheduledAt).toBe('2026-03-29T15:05:00.000Z');
    });

    it('should retry on first attempt (attemptsUsed=0)', () => {
      const result = evaluateRetryPolicy({ ...baseInput, attemptsUsed: 0 });
      expect(result.shouldRetry).toBe(true);
    });

    it('should schedule retry exactly 5 minutes later', () => {
      const result = evaluateRetryPolicy(baseInput);
      const scheduled = new Date(result.retryScheduledAt!);
      const diff = scheduled.getTime() - daytimeET.getTime();
      expect(diff).toBe(5 * 60 * 1000);
    });
  });

  describe('outcome checks', () => {
    it('should not retry when outcome is connected', () => {
      const result = evaluateRetryPolicy({ ...baseInput, outcome: 'connected' });
      expect(result.shouldRetry).toBe(false);
      expect(result.retryReason).toBe('outcome_not_no_answer');
    });

    it('should not retry when outcome is busy', () => {
      const result = evaluateRetryPolicy({ ...baseInput, outcome: 'busy' });
      expect(result.shouldRetry).toBe(false);
      expect(result.retryReason).toBe('outcome_not_no_answer');
    });

    it('should not retry when outcome is null', () => {
      const result = evaluateRetryPolicy({ ...baseInput, outcome: null });
      expect(result.shouldRetry).toBe(false);
      expect(result.retryReason).toBe('outcome_not_no_answer');
    });

    it('should not retry when outcome is empty string', () => {
      const result = evaluateRetryPolicy({ ...baseInput, outcome: '' });
      expect(result.shouldRetry).toBe(false);
      expect(result.retryReason).toBe('outcome_not_no_answer');
    });
  });

  describe('priority checks', () => {
    it('should not retry when not high priority', () => {
      const result = evaluateRetryPolicy({ ...baseInput, isHighPriority: false });
      expect(result.shouldRetry).toBe(false);
      expect(result.retryReason).toBe('not_high_priority');
    });
  });

  describe('daytime boundary checks', () => {
    it('should not retry outside local daytime (nighttime)', () => {
      const result = evaluateRetryPolicy({ ...baseInput, evaluatedAt: nighttimeET });
      expect(result.shouldRetry).toBe(false);
      expect(result.retryReason).toBe('outside_local_daytime');
    });

    it('should retry at exactly hour 9 (start of daytime)', () => {
      // 2026-03-29 13:00 UTC = 9:00 AM ET
      const hour9 = new Date('2026-03-29T13:00:00.000Z');
      const result = evaluateRetryPolicy({ ...baseInput, evaluatedAt: hour9 });
      expect(result.shouldRetry).toBe(true);
    });

    it('should not retry at exactly hour 18 (end of daytime)', () => {
      // 2026-03-29 22:00 UTC = 6:00 PM ET
      const hour18 = new Date('2026-03-29T22:00:00.000Z');
      const result = evaluateRetryPolicy({ ...baseInput, evaluatedAt: hour18 });
      expect(result.shouldRetry).toBe(false);
      expect(result.retryReason).toBe('outside_local_daytime');
    });

    it('should retry at hour 17 (last valid hour)', () => {
      // 2026-03-29 21:00 UTC = 5:00 PM ET
      const hour17 = new Date('2026-03-29T21:00:00.000Z');
      const result = evaluateRetryPolicy({ ...baseInput, evaluatedAt: hour17 });
      expect(result.shouldRetry).toBe(true);
    });

    it('should not retry with invalid timezone', () => {
      const result = evaluateRetryPolicy({
        ...baseInput,
        localTimezone: 'Invalid/Timezone',
      });
      expect(result.shouldRetry).toBe(false);
      expect(result.retryReason).toBe('outside_local_daytime');
    });
  });

  describe('attempt cap checks', () => {
    it('should not retry when attempt cap is reached', () => {
      const result = evaluateRetryPolicy({ ...baseInput, attemptsUsed: 2, attemptCap: 2 });
      expect(result.shouldRetry).toBe(false);
      expect(result.retryReason).toBe('attempt_cap_reached');
    });

    it('should not retry when attempts exceed cap', () => {
      const result = evaluateRetryPolicy({ ...baseInput, attemptsUsed: 5, attemptCap: 2 });
      expect(result.shouldRetry).toBe(false);
      expect(result.retryReason).toBe('attempt_cap_reached');
    });

    it('should retry when one attempt remains', () => {
      const result = evaluateRetryPolicy({ ...baseInput, attemptsUsed: 1, attemptCap: 2 });
      expect(result.shouldRetry).toBe(true);
    });
  });

  describe('no-retry decision shape', () => {
    it('should return consistent shape for no-retry', () => {
      const result = evaluateRetryPolicy({ ...baseInput, outcome: 'connected' });
      expect(result.shouldRetry).toBe(false);
      expect(result.retryStrategy).toBe('none');
      expect(result.retryScheduledAt).toBeNull();
      expect(result.retryReason).toEqual(expect.any(String));
    });
  });
});
