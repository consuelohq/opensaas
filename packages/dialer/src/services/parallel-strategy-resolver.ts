import type {
  ParallelDialProfile,
  ParallelStrategyContext,
  ParallelStrategyResolution,
} from '../types.js';

const PROFILE_REGISTRY: Record<string, ParallelDialProfile> = {
  balanced: {
    id: 'balanced',
    fanout: 3,
    staggerMs: 500,
    amdPolicy: 'human-or-unknown',
    terminationPolicy: 'winner-take-all',
  },
  aggressive: {
    id: 'aggressive',
    fanout: 4,
    staggerMs: 250,
    amdPolicy: 'human-only',
    terminationPolicy: 'winner-take-all',
  },
  conservative: {
    id: 'conservative',
    fanout: 2,
    staggerMs: 900,
    amdPolicy: 'human-or-unknown',
    terminationPolicy: 'winner-take-all',
  },
};

export class ParallelStrategyResolver {
  resolve(context: ParallelStrategyContext): ParallelStrategyResolution {
    const requested = context.profileId ? PROFILE_REGISTRY[context.profileId] : undefined;

    if (requested) {
      return {
        profile: requested,
        reason: 'explicit-profile-id',
      };
    }

    if (context.campaignSegment === 'vip' || context.queueId.toLowerCase().includes('vip')) {
      return {
        profile: PROFILE_REGISTRY.conservative,
        reason: 'segment-vip',
      };
    }

    if (context.recentAnswerRate !== undefined && context.recentAnswerRate < 0.12) {
      return {
        profile: PROFILE_REGISTRY.aggressive,
        reason: 'low-answer-rate',
      };
    }

    if (context.campaignSegment === 'cold' || context.campaignSegment === 'new-leads') {
      return {
        profile: PROFILE_REGISTRY.aggressive,
        reason: 'cold-segment',
      };
    }

    return {
      profile: PROFILE_REGISTRY.balanced,
      reason: 'default-balanced',
    };
  }

  getProfile(profileId: string): ParallelDialProfile | null {
    return PROFILE_REGISTRY[profileId] ?? null;
  }

  listProfiles(): ParallelDialProfile[] {
    return Object.values(PROFILE_REGISTRY);
  }
}
