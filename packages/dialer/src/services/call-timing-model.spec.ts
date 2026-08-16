import type { HazardEstimate, TimingModelStore } from '../types';

import {
  CallTimingModel,
  rankHazardEstimates,
} from './call-timing-model.service';

describe('CallTimingModel', () => {
  it('should return null when segment has insufficient sample size', async () => {
    const timingModelStore: TimingModelStore = {
      getHazardEstimates: jest.fn().mockResolvedValue([
        {
          segmentId: 'high-value',
          hourOfDay: 10,
          dayOfWeek: 2,
          attemptNumber: 1,
          answerRate: 0.4,
          sampleSize: 20,
        },
      ]),
      getOptimalRetryTime: jest.fn().mockResolvedValue({
        hour: 10,
        dayOfWeek: 2,
      }),
    };

    const model = new CallTimingModel(timingModelStore);

    await expect(
      model.getBestTimeToCall({ segmentId: 'high-value', attemptNumber: 1 }),
    ).resolves.toBeNull();
    expect(timingModelStore.getOptimalRetryTime).not.toHaveBeenCalled();
  });

  it('should return optimal retry time when enough observations exist', async () => {
    const timingModelStore: TimingModelStore = {
      getHazardEstimates: jest.fn().mockResolvedValue([
        {
          segmentId: 'renewal',
          hourOfDay: 11,
          dayOfWeek: 3,
          attemptNumber: 2,
          answerRate: 0.61,
          sampleSize: 55,
        },
      ]),
      getOptimalRetryTime: jest.fn().mockResolvedValue({
        hour: 11,
        dayOfWeek: 3,
      }),
    };

    const model = new CallTimingModel(timingModelStore);

    await expect(
      model.getBestTimeToCall({ segmentId: 'renewal', attemptNumber: 2 }),
    ).resolves.toEqual({
      hour: 11,
      dayOfWeek: 3,
    });
  });

  it('prefers a timing bin with stronger lower-bound evidence over a lucky tiny raw rate', () => {
    const hazards: HazardEstimate[] = [
      {
        segmentId: 'segment-1',
        hourOfDay: 9,
        dayOfWeek: 1,
        attemptNumber: 1,
        answerRate: 0.8,
        sampleSize: 5,
        lowerBound: 0.37553463,
        upperBound: 0.96377589,
      },
      {
        segmentId: 'segment-1',
        hourOfDay: 14,
        dayOfWeek: 1,
        attemptNumber: 1,
        answerRate: 0.6,
        sampleSize: 100,
        lowerBound: 0.50200259,
        upperBound: 0.69059871,
      },
    ];

    expect(rankHazardEstimates(hazards)[0]?.hourOfDay).toBe(14);
  });
});
