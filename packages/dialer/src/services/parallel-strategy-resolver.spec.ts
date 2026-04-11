import type { BetaSampler, PosteriorStore, ProfilePosterior } from '../types';

import { ParallelStrategyResolver } from './parallel-strategy-resolver';

class MockPosteriorStore implements PosteriorStore {
  constructor(private readonly posteriors: ProfilePosterior[] = []) {}

  async loadPosteriors(): Promise<ProfilePosterior[]> {
    return this.posteriors;
  }

  async updatePosterior(): Promise<void> {
    return;
  }
}

describe('ParallelStrategyResolver', () => {
  describe('explicit profile selection', () => {
    it('should use explicit profileId when provided', async () => {
      const resolver = new ParallelStrategyResolver(
        new MockPosteriorStore(),
        { sample: () => 0.5 },
      );

      const result = await resolver.resolve({ queueId: 'q1', profileId: 'conservative' });

      expect(result.profile.id).toBe('conservative');
      expect(result.reason).toBe('explicit-profile-id');
    });
  });

  describe('thompson sampling', () => {
    it('should choose the profile with the highest sampled value', async () => {
      const sampleByAlpha = new Map<number, number>([
        [2, 0.2],
        [3, 0.9],
        [4, 0.1],
      ]);
      const deterministicSampler: BetaSampler = {
        sample(alpha) {
          return sampleByAlpha.get(alpha) ?? 0;
        },
      };

      const resolver = new ParallelStrategyResolver(
        new MockPosteriorStore([
          { profileId: 'balanced', alpha: 2, beta: 2 },
          { profileId: 'aggressive', alpha: 3, beta: 2 },
          { profileId: 'conservative', alpha: 4, beta: 2 },
        ]),
        deterministicSampler,
      );

      const result = await resolver.resolve({ queueId: 'q1' });

      expect(result.profile.id).toBe('aggressive');
      expect(result.reason).toBe('thompson-sampling-global');
      expect(result.scope).toBe('global');
    });

    it('should merge uninformed posteriors with default priors', async () => {
      const capturedAlphaBeta: Array<{ alpha: number; beta: number }> = [];
      const deterministicSampler: BetaSampler = {
        sample(alpha, beta) {
          capturedAlphaBeta.push({ alpha, beta });
          return alpha / (alpha + beta);
        },
      };

      const resolver = new ParallelStrategyResolver(
        new MockPosteriorStore([
          { profileId: 'balanced', alpha: 1, beta: 1 },
          { profileId: 'aggressive', alpha: 1, beta: 1 },
          { profileId: 'conservative', alpha: 1, beta: 1 },
        ]),
        deterministicSampler,
      );

      await resolver.resolve({ queueId: 'q1' });

      expect(capturedAlphaBeta).toEqual(
        expect.arrayContaining([
          { alpha: 11, beta: 11 },
          { alpha: 9, beta: 13 },
          { alpha: 13, beta: 9 },
        ]),
      );
    });

    it('should initialize missing profiles in memory with default priors', async () => {
      const capturedAlphaBeta: Array<{ alpha: number; beta: number }> = [];
      const deterministicSampler: BetaSampler = {
        sample(alpha, beta) {
          capturedAlphaBeta.push({ alpha, beta });
          return 0.5;
        },
      };

      const resolver = new ParallelStrategyResolver(
        new MockPosteriorStore([{ profileId: 'balanced', alpha: 20, beta: 10 }]),
        deterministicSampler,
      );

      await resolver.resolve({ queueId: 'q1' });

      expect(capturedAlphaBeta).toEqual(
        expect.arrayContaining([
          { alpha: 20, beta: 10 },
          { alpha: 9, beta: 13 },
          { alpha: 13, beta: 9 },
        ]),
      );
    });
  });

  describe('fallback behavior', () => {
    it('should fallback to balanced when posterior loading fails', async () => {
      const failingStore: PosteriorStore = {
        async loadPosteriors(): Promise<ProfilePosterior[]> {
          throw new Error('load failed');
        },
        async updatePosterior(): Promise<void> {
          return;
        },
      };
      const resolver = new ParallelStrategyResolver(failingStore, {
        sample: () => 0.1,
      });

      const result = await resolver.resolve({ queueId: 'q1' });

      expect(result.profile.id).toBe('balanced');
      expect(result.reason).toBe('thompson-sampling-fallback');
      expect(result.scope).toBe('fallback');
    });
  });

  describe('profile lookup APIs', () => {
    const resolver = new ParallelStrategyResolver(new MockPosteriorStore(), {
      sample: () => 0.1,
    });

    it('should return profile by id', () => {
      expect(resolver.getProfile('balanced')).toMatchObject({ id: 'balanced' });
    });

    it('should return all profiles', () => {
      const profiles = resolver.listProfiles();
      expect(profiles).toHaveLength(3);
    });
  });
});
