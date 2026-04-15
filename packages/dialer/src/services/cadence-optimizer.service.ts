import type { AgeBucket, CadencePolicy, HazardEstimate } from '../types.js';

const HOURS_TO_FRESH_BUCKET = 48;
const DEFAULT_MIN_SAMPLE_SIZE = 50;
const MINUTES_PER_HOUR = 60;
const DOUBLE_DIAL_MINUTES_SINCE_LAST_ATTEMPT = 30;

export const FRESH_DEFAULTS: Pick<
  CadencePolicy,
  'maxAttemptsPerDay' | 'minSpacingMinutes'
> = {
  maxAttemptsPerDay: 2,
  minSpacingMinutes: 240,
};

export const AGED_DEFAULTS: Pick<
  CadencePolicy,
  'maxAttemptsPerDay' | 'minSpacingMinutes'
> = {
  maxAttemptsPerDay: 4,
  minSpacingMinutes: 120,
};

export class CadenceOptimizerService {
  computeCadencePolicy(params: {
    segmentId: string;
    ageBucket: AgeBucket;
    hazardEstimates: HazardEstimate[];
    economics: { valuePerConnection: number; costPerAttempt: number };
    minSampleSize?: number;
  }): CadencePolicy {
    const minSampleSize = params.minSampleSize ?? DEFAULT_MIN_SAMPLE_SIZE;
    const totalSampleSize = params.hazardEstimates.reduce(
      (accumulator, estimate) => accumulator + estimate.sampleSize,
      0,
    );

    if (totalSampleSize < minSampleSize) {
      return {
        ...this.getAgeBucketDefaults(params.ageBucket),
        segmentId: params.segmentId,
        ageBucket: params.ageBucket,
        doubleDial: this.getDefaultDoubleDialPolicy(),
        source: 'static_fallback',
      };
    }

    const threshold =
      params.economics.valuePerConnection > 0
        ? params.economics.costPerAttempt / params.economics.valuePerConnection
        : Number.POSITIVE_INFINITY;

    const answerRateByAttempt = this.computeAnswerRateByAttempt(
      params.hazardEstimates,
    );

    const profitableAttempts = answerRateByAttempt
      .filter((attemptEstimate) => attemptEstimate.answerRate > threshold)
      .map((attemptEstimate) => attemptEstimate.attemptNumber)
      .sort((left, right) => left - right);

    const maxAttemptsPerDay = this.boundAttemptsByAgeBucket(
      params.ageBucket,
      profitableAttempts.at(-1) ?? 1,
    );

    const minSpacingMinutes = this.computeMinSpacingMinutes({
      hazardEstimates: params.hazardEstimates,
      profitableAttempts,
      ageBucket: params.ageBucket,
    });

    return {
      segmentId: params.segmentId,
      ageBucket: params.ageBucket,
      maxAttemptsPerDay,
      minSpacingMinutes,
      doubleDial: this.getDefaultDoubleDialPolicy(),
      source: 'learned',
    };
  }

  classifyAgeBucket(contactCreatedAt: Date, now = new Date()): AgeBucket {
    const ageMilliseconds = now.getTime() - contactCreatedAt.getTime();
    const ageHours = ageMilliseconds / (1000 * 60 * 60);

    return ageHours < HOURS_TO_FRESH_BUCKET ? 'fresh' : 'aged';
  }

  shouldDoubleDial(params: {
    outcome: string;
    callDurationSeconds: number;
    minutesSinceLastAttempt: number;
    doubleDialsThisSession: number;
    policy: CadencePolicy;
  }): boolean {
    const normalizedOutcome = params.outcome.toLowerCase();

    if (!params.policy.doubleDial.enabled) {
      return false;
    }

    if (!params.policy.doubleDial.triggerOutcomes.includes(normalizedOutcome)) {
      return false;
    }

    if (params.callDurationSeconds >= params.policy.doubleDial.maxCallDuration) {
      return false;
    }

    if (params.minutesSinceLastAttempt <= DOUBLE_DIAL_MINUTES_SINCE_LAST_ATTEMPT) {
      return false;
    }

    return params.doubleDialsThisSession < params.policy.doubleDial.maxPerSession;
  }

  private computeAnswerRateByAttempt(hazardEstimates: HazardEstimate[]) {
    const grouped = new Map<
      number,
      { weightedRateTotal: number; sampleSizeTotal: number }
    >();

    for (const estimate of hazardEstimates) {
      const current = grouped.get(estimate.attemptNumber) ?? {
        weightedRateTotal: 0,
        sampleSizeTotal: 0,
      };

      current.weightedRateTotal += estimate.answerRate * estimate.sampleSize;
      current.sampleSizeTotal += estimate.sampleSize;
      grouped.set(estimate.attemptNumber, current);
    }

    return [...grouped.entries()].map(([attemptNumber, stats]) => ({
      attemptNumber,
      answerRate:
        stats.sampleSizeTotal === 0
          ? 0
          : stats.weightedRateTotal / stats.sampleSizeTotal,
    }));
  }

  private computeMinSpacingMinutes(params: {
    hazardEstimates: HazardEstimate[];
    profitableAttempts: number[];
    ageBucket: AgeBucket;
  }): number {
    if (params.profitableAttempts.length < 2) {
      return this.getAgeBucketDefaults(params.ageBucket).minSpacingMinutes;
    }

    const peakHours: number[] = [];

    for (const attemptNumber of params.profitableAttempts.slice(0, 3)) {
      const attemptRows = params.hazardEstimates.filter(
        (estimate) => estimate.attemptNumber === attemptNumber,
      );

      if (attemptRows.length === 0) {
        continue;
      }

      const peak = attemptRows.reduce((best, estimate) => {
        if (estimate.answerRate > best.answerRate) {
          return estimate;
        }

        if (
          estimate.answerRate === best.answerRate &&
          estimate.sampleSize > best.sampleSize
        ) {
          return estimate;
        }

        return best;
      });

      peakHours.push(peak.hourOfDay);
    }

    if (peakHours.length < 2) {
      return this.getAgeBucketDefaults(params.ageBucket).minSpacingMinutes;
    }

    const hourGaps: number[] = [];

    for (let index = 1; index < peakHours.length; index += 1) {
      const hourDelta = Math.abs(peakHours[index] - peakHours[index - 1]);
      const wrappedHourDelta = Math.min(hourDelta, 24 - hourDelta);
      hourGaps.push(wrappedHourDelta);
    }

    const averageHourGap =
      hourGaps.reduce((accumulator, value) => accumulator + value, 0) /
      hourGaps.length;

    return Math.max(10, Math.round(averageHourGap * MINUTES_PER_HOUR));
  }

  private getAgeBucketDefaults(ageBucket: AgeBucket) {
    return ageBucket === 'fresh' ? FRESH_DEFAULTS : AGED_DEFAULTS;
  }

  private boundAttemptsByAgeBucket(ageBucket: AgeBucket, attempts: number) {
    if (ageBucket === 'fresh') {
      return Math.max(1, Math.min(attempts, FRESH_DEFAULTS.maxAttemptsPerDay));
    }

    return Math.max(1, Math.min(attempts, AGED_DEFAULTS.maxAttemptsPerDay));
  }

  private getDefaultDoubleDialPolicy(): CadencePolicy['doubleDial'] {
    return {
      enabled: true,
      windowSeconds: 10,
      maxPerSession: 1,
      triggerOutcomes: ['no-answer', 'voicemail'],
      maxCallDuration: 15,
    };
  }
}
