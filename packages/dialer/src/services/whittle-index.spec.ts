import { WhittleIndexService } from './whittle-index.service';

describe('WhittleIndexService', () => {
  it('should increase index as answer rate increases', () => {
    const service = new WhittleIndexService();

    const lower = service.computeIndex({
      answerRate: 0.1,
      valuePerConnection: 100,
      costPerAttempt: 1,
      hoursRemainingInWindow: 4,
      segmentSampleSize: 100,
    });
    const higher = service.computeIndex({
      answerRate: 0.6,
      valuePerConnection: 100,
      costPerAttempt: 1,
      hoursRemainingInWindow: 4,
      segmentSampleSize: 100,
    });

    expect(higher.index).toBeGreaterThan(lower.index);
  });

  it('should increase urgency bonus as callable window closes', () => {
    const service = new WhittleIndexService();

    const farWindow = service.computeIndex({
      answerRate: 0.2,
      valuePerConnection: 100,
      costPerAttempt: 1,
      hoursRemainingInWindow: 10,
      segmentSampleSize: 100,
    });
    const nearWindow = service.computeIndex({
      answerRate: 0.2,
      valuePerConnection: 100,
      costPerAttempt: 1,
      hoursRemainingInWindow: 1,
      segmentSampleSize: 100,
    });

    expect(nearWindow.components.urgencyBonus).toBeGreaterThan(
      farWindow.components.urgencyBonus,
    );
  });

  it('should increase exploration bonus when segment sample size is low', () => {
    const service = new WhittleIndexService();

    const denseSegment = service.computeIndex({
      answerRate: 0.2,
      valuePerConnection: 100,
      costPerAttempt: 1,
      hoursRemainingInWindow: 3,
      segmentSampleSize: 10_000,
    });
    const sparseSegment = service.computeIndex({
      answerRate: 0.2,
      valuePerConnection: 100,
      costPerAttempt: 1,
      hoursRemainingInWindow: 3,
      segmentSampleSize: 1,
    });

    expect(sparseSegment.components.explorationBonus).toBeGreaterThan(
      denseSegment.components.explorationBonus,
    );
  });

  it('should reduce index as cost per attempt increases', () => {
    const service = new WhittleIndexService();

    const lowerCost = service.computeIndex({
      answerRate: 0.3,
      valuePerConnection: 100,
      costPerAttempt: 1,
      hoursRemainingInWindow: 4,
      segmentSampleSize: 100,
    });
    const higherCost = service.computeIndex({
      answerRate: 0.3,
      valuePerConnection: 100,
      costPerAttempt: 10,
      hoursRemainingInWindow: 4,
      segmentSampleSize: 100,
    });

    expect(higherCost.index).toBeLessThan(lowerCost.index);
  });

  it('should rank candidates by index descending and position ascending for ties', () => {
    const service = new WhittleIndexService();

    const ranked = service.rankCandidates([
      {
        contactId: 'second',
        position: 2,
        input: {
          answerRate: 0.5,
          valuePerConnection: 100,
          costPerAttempt: 1,
          hoursRemainingInWindow: 2,
          segmentSampleSize: 100,
        },
      },
      {
        contactId: 'first',
        position: 1,
        input: {
          answerRate: 0.5,
          valuePerConnection: 100,
          costPerAttempt: 1,
          hoursRemainingInWindow: 2,
          segmentSampleSize: 100,
        },
      },
      {
        contactId: 'winner',
        position: 3,
        input: {
          answerRate: 0.7,
          valuePerConnection: 100,
          costPerAttempt: 1,
          hoursRemainingInWindow: 2,
          segmentSampleSize: 100,
        },
      },
    ]);

    expect(ranked.map((candidate) => candidate.contactId)).toEqual([
      'winner',
      'first',
      'second',
    ]);
  });

  it('should apply max urgency bonus when zero hours remain in window', () => {
    const service = new WhittleIndexService();

    const result = service.computeIndex({
      answerRate: 0,
      valuePerConnection: 100,
      costPerAttempt: 0,
      hoursRemainingInWindow: 0,
      segmentSampleSize: 1,
    });

    expect(result.components.urgencyBonus).toBe(100);
  });

  it('should produce near zero exploration bonus with very high sample size', () => {
    const service = new WhittleIndexService();

    const result = service.computeIndex({
      answerRate: 0,
      valuePerConnection: 100,
      costPerAttempt: 0,
      hoursRemainingInWindow: 10,
      segmentSampleSize: 10_000,
    });

    expect(result.components.explorationBonus).toBeCloseTo(0.1, 5);
  });

  it('should set index to negative cost when all positive components are zero', () => {
    const service = new WhittleIndexService();

    const result = service.computeIndex({
      answerRate: 0,
      valuePerConnection: 0,
      costPerAttempt: 0.03,
      hoursRemainingInWindow: 10,
      segmentSampleSize: 10,
    });

    expect(result.index).toBeCloseTo(-0.03, 5);
  });

  it('should allow negative index values when cost exceeds reward', () => {
    const service = new WhittleIndexService();

    const result = service.computeIndex({
      answerRate: 0.01,
      valuePerConnection: 1,
      costPerAttempt: 10,
      hoursRemainingInWindow: 10,
      segmentSampleSize: 10_000,
    });

    expect(result.index).toBeLessThan(0);
  });
});
