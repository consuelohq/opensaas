import type { HazardEstimate, TimingModelStore } from '../types.js';

const MIN_SAMPLE_SIZE_PER_SEGMENT = 50;

export class CallTimingModel {
  constructor(private readonly timingModelStore: TimingModelStore) {}

  async getBestTimeToCall(params: {
    segmentId: string;
    attemptNumber: number;
  }): Promise<{ hour: number; dayOfWeek: number } | null> {
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
  }

  rankHazardEstimates(hazardEstimates: HazardEstimate[]): HazardEstimate[] {
    return [...hazardEstimates].sort((left, right) => {
      if (right.answerRate !== left.answerRate) {
        return right.answerRate - left.answerRate;
      }

      return right.sampleSize - left.sampleSize;
    });
  }
}

export { MIN_SAMPLE_SIZE_PER_SEGMENT };
