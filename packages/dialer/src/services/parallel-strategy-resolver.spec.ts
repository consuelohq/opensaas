import { ParallelStrategyResolver } from './parallel-strategy-resolver';

describe('ParallelStrategyResolver', () => {
  const resolver = new ParallelStrategyResolver();

  describe('explicit profile selection', () => {
    it('should use explicit profileId when provided', () => {
      const result = resolver.resolve({ queueId: 'q1', profileId: 'conservative' });
      expect(result.profile.id).toBe('conservative');
      expect(result.reason).toBe('explicit-profile-id');
    });

    it('should use aggressive profile when explicitly requested', () => {
      const result = resolver.resolve({ queueId: 'q1', profileId: 'aggressive' });
      expect(result.profile.id).toBe('aggressive');
      expect(result.profile.fanout).toBe(4);
    });

    it('should fall through to rules when profileId is unknown', () => {
      const result = resolver.resolve({ queueId: 'q1', profileId: 'nonexistent' });
      // unknown profileId → no match → falls through to default balanced
      expect(result.profile.id).toBe('balanced');
      expect(result.reason).toBe('default-balanced');
    });
  });

  describe('VIP segment detection', () => {
    it('should choose conservative for vip campaignSegment', () => {
      const result = resolver.resolve({ queueId: 'q1', campaignSegment: 'vip' });
      expect(result.profile.id).toBe('conservative');
      expect(result.reason).toBe('segment-vip');
    });

    it('should choose conservative when queueId contains vip', () => {
      const result = resolver.resolve({ queueId: 'vip-inbound' });
      expect(result.profile.id).toBe('conservative');
      expect(result.reason).toBe('segment-vip');
    });

    it('should choose conservative when queueId contains VIP (case insensitive)', () => {
      const result = resolver.resolve({ queueId: 'VIP-QUEUE' });
      expect(result.profile.id).toBe('conservative');
    });
  });

  describe('answer rate thresholds', () => {
    it('should choose aggressive for answer rate below 0.12', () => {
      const result = resolver.resolve({ queueId: 'q1', recentAnswerRate: 0.08 });
      expect(result.profile.id).toBe('aggressive');
      expect(result.reason).toBe('low-answer-rate');
    });

    it('should NOT choose aggressive at exactly 0.12 (boundary)', () => {
      const result = resolver.resolve({ queueId: 'q1', recentAnswerRate: 0.12 });
      // 0.12 is NOT < 0.12, so falls through to default
      expect(result.profile.id).toBe('balanced');
      expect(result.reason).toBe('default-balanced');
    });

    it('should choose aggressive at 0.119', () => {
      const result = resolver.resolve({ queueId: 'q1', recentAnswerRate: 0.119 });
      expect(result.profile.id).toBe('aggressive');
    });

    it('should choose aggressive at 0 answer rate', () => {
      const result = resolver.resolve({ queueId: 'q1', recentAnswerRate: 0 });
      expect(result.profile.id).toBe('aggressive');
    });
  });

  describe('cold/new-leads segments', () => {
    it('should choose aggressive for cold segment', () => {
      const result = resolver.resolve({ queueId: 'q1', campaignSegment: 'cold' });
      expect(result.profile.id).toBe('aggressive');
      expect(result.reason).toBe('cold-segment');
    });

    it('should choose aggressive for new-leads segment', () => {
      const result = resolver.resolve({ queueId: 'q1', campaignSegment: 'new-leads' });
      expect(result.profile.id).toBe('aggressive');
      expect(result.reason).toBe('cold-segment');
    });
  });

  describe('default fallback', () => {
    it('should choose balanced when no special conditions match', () => {
      const result = resolver.resolve({ queueId: 'regular-queue' });
      expect(result.profile.id).toBe('balanced');
      expect(result.reason).toBe('default-balanced');
    });

    it('should choose balanced with undefined optional fields', () => {
      const result = resolver.resolve({
        queueId: 'q1',
        campaignSegment: undefined,
        recentAnswerRate: undefined,
        profileId: undefined,
      });
      expect(result.profile.id).toBe('balanced');
    });
  });

  describe('profile properties', () => {
    it('balanced profile should have fanout 3 and human-or-unknown AMD', () => {
      const result = resolver.resolve({ queueId: 'q1' });
      expect(result.profile.fanout).toBe(3);
      expect(result.profile.staggerMs).toBe(500);
      expect(result.profile.amdPolicy).toBe('human-or-unknown');
      expect(result.profile.terminationPolicy).toBe('winner-take-all');
    });

    it('aggressive profile should have fanout 4 and human-only AMD', () => {
      const result = resolver.resolve({ queueId: 'q1', profileId: 'aggressive' });
      expect(result.profile.fanout).toBe(4);
      expect(result.profile.staggerMs).toBe(250);
      expect(result.profile.amdPolicy).toBe('human-only');
    });

    it('conservative profile should have fanout 2', () => {
      const result = resolver.resolve({ queueId: 'q1', profileId: 'conservative' });
      expect(result.profile.fanout).toBe(2);
      expect(result.profile.staggerMs).toBe(900);
    });
  });

  describe('getProfile', () => {
    it('should return profile by id', () => {
      expect(resolver.getProfile('balanced')).toMatchObject({ id: 'balanced' });
    });

    it('should return null for unknown profile', () => {
      expect(resolver.getProfile('nonexistent')).toBeNull();
    });
  });

  describe('listProfiles', () => {
    it('should return all 3 profiles', () => {
      const profiles = resolver.listProfiles();
      expect(profiles).toHaveLength(3);
      const ids = profiles.map((p) => p.id).sort();
      expect(ids).toEqual(['aggressive', 'balanced', 'conservative']);
    });
  });

  describe('priority order — VIP beats low answer rate', () => {
    it('should choose conservative for vip even with low answer rate', () => {
      const result = resolver.resolve({
        queueId: 'q1',
        campaignSegment: 'vip',
        recentAnswerRate: 0.05,
      });
      // VIP check comes before answer rate check
      expect(result.profile.id).toBe('conservative');
      expect(result.reason).toBe('segment-vip');
    });
  });
});
