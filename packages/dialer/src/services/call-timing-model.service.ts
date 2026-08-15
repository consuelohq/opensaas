import type { HazardEstimate, TimingModelStore } from '../types.js';

const MIN_SAMPLE_SIZE_PER_SEGMENT = 50;

export const rankHazardEstimates = (
  hazardEstimates: HazardEstimate[],
): HazardEstimate[] =>
  [...hazardEstimates].sort((left, right) => {
    const leftEvidence = left.lowerBound ?? left.answerRate;
    const rightEvidence = right.lowerBound ?? right.answerRate;

    if (rightEvidence !== leftEvidence) {
      return rightEvidence - leftEvidence;
    }

    if (right.sampleSize !== left.sampleSize) {
      return right.sampleSize - left.sampleSize;
    }

    return right.answerRate - left.answerRate;
  });

export class CallTimingModel {
  constructor(private readonly timingModelStore: TimingModelStore) {}

  async getBestTimeToCall(params: {
    segmentId: string;
    attemptNumber: number;
  }): Promise<{ hour: number; dayOfWeek: number } | null> {
    try {
      const hazardEstimates = await this.timingModelStore.getHazardEstimates(
        params.segmentId,
        params.attemptNumber,
      );

      const segmentSampleSize = hazardEstimates.reduce(
        (sampleSize, estimate) => sampleSize + estimate.sampleSize,
        0,
      );

      if (segmentSampleSize < MIN_SAMPLE_SIZE_PER_SEGMENT) {
        return null;
      }

      return await this.timingModelStore.getOptimalRetryTime(
        params.segmentId,
        params.attemptNumber,
      );
    } catch (cause: unknown) {
      throw new Error('Failed to resolve predictive call timing', { cause });
    }
  }

  rankHazardEstimates(hazardEstimates: HazardEstimate[]): HazardEstimate[] {
    return rankHazardEstimates(hazardEstimates);
  }
}

export { MIN_SAMPLE_SIZE_PER_SEGMENT };
