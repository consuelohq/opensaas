import type {
  HazardEstimate,
  PredictiveHazardSource,
  PredictiveModelStore,
  PredictiveRankedCandidate,
  PredictiveSelectionInput,
  PredictiveSelectionResult,
} from '../types.js';

import { rankHazardEstimates } from './call-timing-model.service.js';
import { PredictivePriorityService } from './predictive-priority.service.js';
import { evaluateStoppingThreshold } from './stopping-model.js';

const weekdayToNumber = (weekday: string) => {
  const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const index = weekdays.indexOf(weekday);
  return index >= 0 ? index : 0;
};

const localTimeParts = (evaluatedAt: Date, timeZone: string) => {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    hour: '2-digit',
    weekday: 'short',
  });
  const parts = formatter.formatToParts(evaluatedAt);

  return {
    hour: Number(parts.find((part) => part.type === 'hour')?.value ?? '0'),
    dayOfWeek: weekdayToNumber(
      parts.find((part) => part.type === 'weekday')?.value ?? 'Sun',
    ),
  };
};

const selectHazardEstimate = (params: {
  hazardEstimates: HazardEstimate[];
  segmentId: string;
  attemptNumber: number;
  hourOfDay: number;
  dayOfWeek: number;
}): { estimate: HazardEstimate | null; source: PredictiveHazardSource } => {
  const attemptHazards = params.hazardEstimates.filter(
    (estimate) =>
      estimate.segmentId === params.segmentId &&
      estimate.attemptNumber === params.attemptNumber,
  );
  const exactLocalSlot = rankHazardEstimates(
    attemptHazards.filter(
      (estimate) =>
        estimate.hourOfDay === params.hourOfDay &&
        estimate.dayOfWeek === params.dayOfWeek,
    ),
  )[0];

  if (exactLocalSlot) {
    return { estimate: exactLocalSlot, source: 'exact_local_slot' };
  }

  const attemptFallback = rankHazardEstimates(attemptHazards)[0];
  if (attemptFallback) {
    return { estimate: attemptFallback, source: 'attempt_fallback' };
  }

  return { estimate: null, source: 'missing' };
};

export class PredictiveSelectionModel {
  private readonly priorityService = new PredictivePriorityService();

  constructor(private readonly store: PredictiveModelStore) {}

  async rankCandidates(
    input: PredictiveSelectionInput,
  ): Promise<PredictiveSelectionResult> {
    try {
      if (input.candidates.length === 0) {
        return { ranked: [], suppressed: [] };
      }

      const evaluatedAt = input.evaluatedAt ?? new Date();
      const local = localTimeParts(evaluatedAt, input.localTimezone);
      const nextAttemptNumbers = [
        ...new Set(
          input.candidates.map(
            (candidate) => Math.max(Math.trunc(candidate.attemptsUsed), 0) + 1,
          ),
        ),
      ];
      const [hazardEstimates, answerProbabilities, economics] =
        await Promise.all([
          this.store.getHazardEstimates({
            workspaceId: input.workspaceId,
            segmentId: input.segmentId,
            attemptNumbers: nextAttemptNumbers,
          }),
          this.store.getAnswerProbabilities({
            workspaceId: input.workspaceId,
            segmentId: input.segmentId,
          }),
          this.store.getWorkspaceEconomics(input.workspaceId),
        ]);
      const probabilityByAttempt = new Map(
        answerProbabilities.map((item) => [item.attemptNumber, item]),
      );
      const ranked: PredictiveRankedCandidate[] = [];
      const suppressed: PredictiveSelectionResult['suppressed'] = [];

      for (const candidate of input.candidates) {
        const nextAttemptNumber =
          Math.max(Math.trunc(candidate.attemptsUsed), 0) + 1;
        const stoppingEvidence = probabilityByAttempt.get(nextAttemptNumber);
        const stoppingThreshold = evaluateStoppingThreshold({
          segmentId: input.segmentId,
          attemptNumber: nextAttemptNumber,
          answerProbability: stoppingEvidence?.probability,
          answerProbabilityUpperBound: stoppingEvidence?.upperBound,
          valuePerConnection: economics.valuePerConnection,
          costPerAttempt: economics.costPerAttempt,
        });

        if (stoppingThreshold?.shouldStop) {
          suppressed.push({
            contactId: candidate.contactId,
            position: candidate.position,
            nextAttemptNumber,
            reason: 'stopping_model',
          });
          continue;
        }

        const hazard = selectHazardEstimate({
          hazardEstimates,
          segmentId: input.segmentId,
          attemptNumber: nextAttemptNumber,
          hourOfDay: local.hour,
          dayOfWeek: local.dayOfWeek,
        });
        const answerProbability = hazard.estimate?.answerRate ?? 0;
        const answerProbabilityUpperBound =
          hazard.estimate?.upperBound ??
          (hazard.estimate ? hazard.estimate.answerRate : 1);
        const computed = this.priorityService.computePriority({
          answerProbability,
          answerProbabilityUpperBound,
          valuePerConnection: economics.valuePerConnection,
          costPerAttempt: economics.costPerAttempt,
        });

        ranked.push({
          contactId: candidate.contactId,
          position: candidate.position,
          nextAttemptNumber,
          score: computed.score,
          components: computed.components,
          hazardSource: hazard.source,
        });
      }

      ranked.sort((left, right) => {
        if (right.score !== left.score) {
          return right.score - left.score;
        }

        return left.position - right.position;
      });

      return { ranked, suppressed };
    } catch (cause: unknown) {
      throw new Error('Failed to rank predictive candidates', { cause });
    }
  }
}
