import type { StoppingModelStore } from '../types';

import { StoppingModelService } from './stopping-model';

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

  it('should include zero probability for attempts without historical data', async () => {
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

    expect(threshold).toMatchObject({
      attemptNumber: 2,
      answerProbability: 0,
      expectedValue: 0,
      shouldStop: false,
    });
  });
});
