import type {
  PredictiveModelStore,
  RetryDecisionInput,
  RetryDecisionResult,
} from '../types.js';

import {
  MIN_SAMPLE_SIZE_PER_SEGMENT,
  rankHazardEstimates,
} from './call-timing-model.service.js';
import { evaluateStoppingThreshold } from './stopping-model.js';

const noRetry = (
  reason: 'answered' | 'max_attempts_reached' | 'expected_value_below_attempt_cost',
  nextAttemptNumber: number | null,
): RetryDecisionResult => ({
  shouldRetry: false,
  nextAttemptNumber,
  reason,
  preferredWindow: null,
  timingSource: 'none',
});

export class RetryDecisionModel {
  constructor(private readonly store: PredictiveModelStore) {}

  async evaluate(input: RetryDecisionInput): Promise<RetryDecisionResult> {
    try {
      if (input.outcome === 'human_answered') {
        return noRetry('answered', null);
      }

      if (input.attemptsUsed >= input.maxAttempts) {
        return noRetry('max_attempts_reached', null);
      }

      const nextAttemptNumber = Math.max(Math.trunc(input.attemptsUsed), 0) + 1;
      const [answerProbabilities, economics] = await Promise.all([
        this.store.getAnswerProbabilities({
          workspaceId: input.workspaceId,
          segmentId: input.segmentId,
        }),
        this.store.getWorkspaceEconomics(input.workspaceId),
      ]);
      const observedProbability = answerProbabilities.find(
        (item) => item.attemptNumber === nextAttemptNumber,
      );
      const stoppingThreshold = evaluateStoppingThreshold({
        segmentId: input.segmentId,
        attemptNumber: nextAttemptNumber,
        answerProbability: observedProbability?.probability,
        answerProbabilityUpperBound: observedProbability?.upperBound,
        valuePerConnection: economics.valuePerConnection,
        costPerAttempt: economics.costPerAttempt,
      });

      if (stoppingThreshold?.shouldStop) {
        return noRetry(
          'expected_value_below_attempt_cost',
          nextAttemptNumber,
        );
      }

      const hazards = (
        await this.store.getHazardEstimates({
          workspaceId: input.workspaceId,
          segmentId: input.segmentId,
          attemptNumbers: [nextAttemptNumber],
        })
      ).filter(
        (estimate) =>
          estimate.segmentId === input.segmentId &&
          estimate.attemptNumber === nextAttemptNumber,
      );
      const timingSampleSize = hazards.reduce(
        (total, estimate) =>
          total + Math.max(estimate.trials ?? estimate.sampleSize, 0),
        0,
      );
      const bestHazard =
        timingSampleSize >= MIN_SAMPLE_SIZE_PER_SEGMENT
          ? rankHazardEstimates(hazards)[0]
          : undefined;

      return {
        shouldRetry: true,
        nextAttemptNumber,
        reason:
          observedProbability === undefined
            ? 'insufficient_stopping_data'
            : 'positive_expected_value',
        preferredWindow: bestHazard
          ? { hour: bestHazard.hourOfDay, dayOfWeek: bestHazard.dayOfWeek }
          : null,
        timingSource: bestHazard
          ? 'learned_hazard'
          : 'insufficient_hazard_data',
      };
    } catch (cause: unknown) {
      throw new Error('Failed to evaluate predictive retry decision', { cause });
    }
  }
}
