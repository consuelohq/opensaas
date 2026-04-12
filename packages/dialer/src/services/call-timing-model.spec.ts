import type { TimingModelStore } from '../types';

import { CallTimingModel } from './call-timing-model';

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
});
