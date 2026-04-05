import { ParallelStrategyResolver } from './parallel-strategy-resolver';

describe('ParallelStrategyResolver', () => {
  const resolver = new ParallelStrategyResolver();

  it('should use explicit profile id when provided', () => {
    const strategy = resolver.resolve({
      queueId: 'queue-1',
      profileId: 'conservative',
    });
    expect(strategy.profile.id).toBe('conservative');
    expect(strategy.reason).toBe('explicit-profile-id');
  });

  it('should choose aggressive profile for low answer rate', () => {
    const strategy = resolver.resolve({
      queueId: 'queue-1',
      recentAnswerRate: 0.08,
    });
    expect(strategy.profile.id).toBe('aggressive');
    expect(strategy.reason).toBe('low-answer-rate');
  });

  it('should choose conservative profile for vip segment', () => {
    const strategy = resolver.resolve({
      queueId: 'vip-inbound',
    });
    expect(strategy.profile.id).toBe('conservative');
  });
});
