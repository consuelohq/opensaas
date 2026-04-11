import type { BetaSampler, PosteriorStore, ProfilePosterior } from '../types';

import { ParallelStrategyResolver } from './parallel-strategy-resolver';

describe('ParallelStrategyResolver', () => {
  describe('explicit profile selection', () => {
    it('should use explicit profileId when provided and bypass sampling', async () => {
      const mockSampler: BetaSampler = {
        sample: jest.fn().mockReturnValue(0.5),
      };

      const mockStore: PosteriorStore = {
        loadPosteriors: jest.fn().mockResolvedValue([]),
        updatePosterior: jest.fn().mockResolvedValue(undefined),
      };

      const resolver = new ParallelStrategyResolver(mockStore, mockSampler);

      const result = await resolver.resolve({
        queueId: 'q1',
        profileId: 'conservative',
      });

      expect(result.profile.id).toBe('conservative');
      expect(result.reason).toBe('explicit-profile-id');
      expect(mockStore.loadPosteriors).not.toHaveBeenCalled();
      expect(mockSampler.sample).not.toHaveBeenCalled();
    });
  });

  describe('thompson sampling', () => {
    it('should deterministically pick aggressive when it samples highest', async () => {
      const mockSampler: BetaSampler = {
        sample: jest
          .fn()
          .mockReturnValueOnce(0.5)
          .mockReturnValueOnce(0.9)
          .mockReturnValueOnce(0.1),
      };

      const mockStore: PosteriorStore = {
        loadPosteriors: jest.fn().mockResolvedValue([
          { profileId: 'balanced', alpha: 10, beta: 10 },
          { profileId: 'aggressive', alpha: 10, beta: 10 },
          { profileId: 'conservative', alpha: 10, beta: 10 },
        ]),
        updatePosterior: jest.fn().mockResolvedValue(undefined),
      };

      const resolver = new ParallelStrategyResolver(mockStore, mockSampler);

      const result = await resolver.resolve({ queueId: 'q1' });

      expect(result.profile.id).toBe('aggressive');
      expect(result.reason).toBe('thompson-sampling-global');
    });

    it('should use informed default priors on cold start when no posteriors are returned', async () => {
      const mockSampler: BetaSampler = {
        sample: jest.fn().mockReturnValue(0.5),
      };

      const mockStore: PosteriorStore = {
        loadPosteriors: jest.fn().mockResolvedValue([]),
        updatePosterior: jest.fn().mockResolvedValue(undefined),
      };

      const resolver = new ParallelStrategyResolver(mockStore, mockSampler);

      await expect(resolver.resolve({ queueId: 'q1' })).resolves.toMatchObject({
        reason: 'thompson-sampling-global',
        scope: 'global',
      });

      expect(mockSampler.sample).toHaveBeenCalledTimes(3);
      expect((mockSampler.sample as jest.Mock).mock.calls).toEqual(
        expect.arrayContaining([[11, 11], [9, 13], [13, 9]]),
      );
    });

    it('should merge loaded posterior values instead of using defaults', async () => {
      const mockSampler: BetaSampler = {
        sample: jest.fn().mockReturnValue(0.2),
      };

      const loadedPosteriors: ProfilePosterior[] = [
        { profileId: 'balanced', alpha: 15, beta: 15 },
        { profileId: 'aggressive', alpha: 50, beta: 10 },
        { profileId: 'conservative', alpha: 7, beta: 20 },
      ];

      const mockStore: PosteriorStore = {
        loadPosteriors: jest.fn().mockResolvedValue(loadedPosteriors),
        updatePosterior: jest.fn().mockResolvedValue(undefined),
      };

      const resolver = new ParallelStrategyResolver(mockStore, mockSampler);

      await resolver.resolve({ queueId: 'q1' });

      expect(mockSampler.sample).toHaveBeenCalledTimes(3);
      expect((mockSampler.sample as jest.Mock).mock.calls).toEqual(
        expect.arrayContaining([[15, 15], [50, 10], [7, 20]]),
      );
    });

    it('should sample all profiles exactly once when no explicit profileId is set', async () => {
      const mockSampler: BetaSampler = {
        sample: jest.fn().mockReturnValue(0.4),
      };

      const mockStore: PosteriorStore = {
        loadPosteriors: jest.fn().mockResolvedValue([]),
        updatePosterior: jest.fn().mockResolvedValue(undefined),
      };

      const resolver = new ParallelStrategyResolver(mockStore, mockSampler);

      await resolver.resolve({ queueId: 'q1' });

      expect(mockSampler.sample).toHaveBeenCalledTimes(3);
    });
  });

  describe('fallback behavior', () => {
    it('should fallback to balanced when posterior loading fails without throwing', async () => {
      const mockSampler: BetaSampler = {
        sample: jest.fn().mockReturnValue(0.1),
      };

      const failingStore: PosteriorStore = {
        loadPosteriors: jest.fn().mockRejectedValue(new Error('load failed')),
        updatePosterior: jest.fn().mockResolvedValue(undefined),
      };

      const resolver = new ParallelStrategyResolver(failingStore, mockSampler);

      await expect(resolver.resolve({ queueId: 'q1' })).resolves.toMatchObject({
        profile: { id: 'balanced' },
        reason: 'thompson-sampling-fallback',
        scope: 'fallback',
      });
    });
  });

  describe('profile lookup APIs', () => {
    const resolver = new ParallelStrategyResolver(
      {
        loadPosteriors: jest.fn().mockResolvedValue([]),
        updatePosterior: jest.fn().mockResolvedValue(undefined),
      },
      { sample: jest.fn().mockReturnValue(0.5) },
    );

    it('should return profile by id', () => {
      expect(resolver.getProfile('balanced')).toMatchObject({
        id: 'balanced',
        fanout: 3,
        staggerMs: 500,
        amdPolicy: 'human-or-unknown',
      });

      expect(resolver.getProfile('aggressive')).toMatchObject({
        id: 'aggressive',
        fanout: 4,
        staggerMs: 250,
        amdPolicy: 'human-only',
      });

      expect(resolver.getProfile('conservative')).toMatchObject({
        id: 'conservative',
        fanout: 2,
        staggerMs: 900,
        amdPolicy: 'human-or-unknown',
      });
    });

    it('should return all profiles', () => {
      const profiles = resolver.listProfiles();

      expect(profiles).toHaveLength(3);
      expect(profiles).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: 'balanced' }),
          expect.objectContaining({ id: 'aggressive' }),
          expect.objectContaining({ id: 'conservative' }),
        ]),
      );
    });
  });
});
