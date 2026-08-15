import type {
  HazardEstimate,
  PredictiveHazardSource,
  PredictiveModelStore,
  PredictiveRankedCandidate,
  PredictiveSelectionInput,
  PredictiveSelectionResult,
} from '../types.js';

import { rankHazardEstimates } from './call-timing-model.service.js';
import { evaluateStoppingThreshold } from './stopping-model.js';
import { WhittleIndexService } from './whittle-index.service.js';

const STALE_ATTEMPT_HOURS = 48;
const STALE_DECAY_FACTOR = 0.8;

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
  const attemptHazards = params.hazardEstimates
    .filter(
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

const staleDecayFactor = (lastAttemptAt: Date | null, evaluatedAt: Date) => {
  if (!lastAttemptAt || Number.isNaN(lastAttemptAt.getTime())) {
    return 1;
  }

  const hoursSinceLastAttempt =
    (evaluatedAt.getTime() - lastAttemptAt.getTime()) / (60 * 60 * 1_000);

  return hoursSinceLastAttempt > STALE_ATTEMPT_HOURS ? STALE_DECAY_FACTOR : 1;
};

export class PredictiveSelectionModel {
  private readonly whittleIndexService = new WhittleIndexService();

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
      const [hazardEstimates, answerProbabilities, economics] = await Promise.all([
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
        answerProbabilities.map((item) => [item.attemptNumber, item.probability]),
      );
      const hoursRemainingInWindow = Math.max(
        input.callableWindowEndHour - local.hour,
        0,
      );
      const ranked: PredictiveRankedCandidate[] = [];
      const suppressed: PredictiveSelectionResult['suppressed'] = [];

      for (const candidate of input.candidates) {
        const nextAttemptNumber =
          Math.max(Math.trunc(candidate.attemptsUsed), 0) + 1;
        const stoppingThreshold = evaluateStoppingThreshold({
          segmentId: input.segmentId,
          attemptNumber: nextAttemptNumber,
          answerProbability: probabilityByAttempt.get(nextAttemptNumber),
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
        const decayFactor = staleDecayFactor(candidate.lastAttemptAt, evaluatedAt);
        const computed = this.whittleIndexService.computeIndex({
          answerRate: Math.max(hazard.estimate?.answerRate ?? 0, 0) * decayFactor,
          valuePerConnection: economics.valuePerConnection,
          costPerAttempt: economics.costPerAttempt,
          hoursRemainingInWindow,
          segmentSampleSize: Math.max(hazard.estimate?.sampleSize ?? 1, 1),
        });

        ranked.push({
          contactId: candidate.contactId,
          position: candidate.position,
          nextAttemptNumber,
          index: computed.index,
          components: computed.components,
          hazardSource: hazard.source,
          staleDecayFactor: decayFactor,
        });
      }

      ranked.sort((left, right) => {
        if (right.index !== left.index) {
          return right.index - left.index;
        }

        return left.position - right.position;
      });

      return { ranked, suppressed };
    } catch (cause: unknown) {
      throw new Error('Failed to rank predictive dialer candidates', { cause });
    }
  }
}
