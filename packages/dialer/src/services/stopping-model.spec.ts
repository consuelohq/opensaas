import type { StoppingModelStore } from '../types';

import {
  evaluateStoppingThreshold,
  StoppingModelService,
} from './stopping-model';

describe('StoppingModelService', () => {
  it('should stop when expected value becomes lower than attempt cost after attempt 2', async () => {
    const store: StoppingModelStore = {
      getAnswerProbabilities: jest.fn().mockResolvedValue([
        { attemptNumber: 1, probability: 0.35 },
        { attemptNumber: 2, probability: 0.18 },
        { attemptNumber: 3, probability: 0.0001 },
      ]),
      getWorkspaceEconomics: jest.fn().mockResolvedValue({
        valuePerConnection: 100,
        costPerAttempt: 0.03,
      }),
    };

    const service = new StoppingModelService(store);
    const thresholds = await service.getStoppingThresholds({
      workspaceId: 'workspace-1',
      segmentId: 'segment-1',
      maxAttempts: 3,
    });

    expect(thresholds[0]?.shouldStop).toBe(false);
    expect(thresholds[1]?.shouldStop).toBe(false);
    expect(thresholds[2]).toMatchObject({
      attemptNumber: 3,
      shouldStop: true,
    });
  });

  it('should return no stopping threshold when an attempt has no historical data', async () => {
    const store: StoppingModelStore = {
      getAnswerProbabilities: jest
        .fn()
        .mockResolvedValue([{ attemptNumber: 1, probability: 0.25 }]),
      getWorkspaceEconomics: jest.fn().mockResolvedValue({
        valuePerConnection: 100,
        costPerAttempt: 0.03,
      }),
    };

    const service = new StoppingModelService(store);
    const threshold = await service.getThresholdForAttempt({
      workspaceId: 'workspace-1',
      segmentId: 'segment-1',
      attemptNumber: 2,
      maxAttempts: 3,
    });

    expect(threshold).toBeNull();
  });

  it('stops conservatively only when the upper confidence bound is economically unprofitable', () => {
    const uncertain = evaluateStoppingThreshold({
      segmentId: 'segment-1',
      attemptNumber: 3,
      answerProbability: 0.01,
      answerProbabilityUpperBound: 0.08,
      valuePerConnection: 1,
      costPerAttempt: 0.05,
    });
    const confidentlyUnprofitable = evaluateStoppingThreshold({
      segmentId: 'segment-1',
      attemptNumber: 3,
      answerProbability: 0.01,
      answerProbabilityUpperBound: 0.04,
      valuePerConnection: 1,
      costPerAttempt: 0.05,
    });

    expect(uncertain?.expectedValue).toBeCloseTo(0.01, 12);
    expect(uncertain?.shouldStop).toBe(false);
    expect(confidentlyUnprofitable?.shouldStop).toBe(true);
  });
});
