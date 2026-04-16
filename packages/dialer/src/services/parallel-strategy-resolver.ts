import type {
  BetaSampler,
  ParallelDialProfile,
  ParallelStrategyContext,
  ParallelStrategyResolution,
  PosteriorStore,
  ProfileKey,
  ProfilePosterior,
} from '../types.js';

let logger:
  | {
      error: (message: string, meta?: Record<string, unknown>) => void;
    }
  | null = null;

const PROFILE_REGISTRY: Record<ProfileKey, ParallelDialProfile> = {
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

export const DEFAULT_PRIORS: Record<ProfileKey, { alpha: number; beta: number }> = {
  balanced: { alpha: 10, beta: 10 },
  aggressive: { alpha: 8, beta: 12 },
  conservative: { alpha: 12, beta: 8 },
};

const PROFILE_KEYS: ProfileKey[] = ['balanced', 'aggressive', 'conservative'];

export class ParallelStrategyResolver {
  constructor(
    private readonly posteriorStore: PosteriorStore,
    private readonly betaSampler: BetaSampler,
  ) {}

  async resolve(context: ParallelStrategyContext): Promise<ParallelStrategyResolution> {
    const requested = context.profileId ? PROFILE_REGISTRY[context.profileId] : undefined;

    if (requested) {
      return {
        profile: requested,
        reason: 'explicit-profile-id',
      };
    }

    try {
      const loadedPosteriors = await this.posteriorStore.loadPosteriors();
      const posteriorMap = this.buildPosteriorMap(loadedPosteriors);

      let winningProfile: ProfileKey = 'balanced';
      let winningSample = Number.NEGATIVE_INFINITY;

      for (const profileKey of PROFILE_KEYS) {
        const posterior = posteriorMap[profileKey];
        const sample = this.betaSampler.sample(posterior.alpha, posterior.beta);

        if (sample > winningSample) {
          winningSample = sample;
          winningProfile = profileKey;
        }
      }

      return {
        profile: PROFILE_REGISTRY[winningProfile],
        reason: 'thompson-sampling-global',
        scope: 'global',
      };
    } catch (error: unknown) {
      await this.logPosteriorLoadError(error, context);

      return {
        profile: PROFILE_REGISTRY.balanced,
        reason: 'thompson-sampling-fallback',
        scope: 'fallback',
      };
    }
  }

  getProfile(profileId: ProfileKey): ParallelDialProfile {
    return PROFILE_REGISTRY[profileId];
  }

  listProfiles(): ParallelDialProfile[] {
    return Object.values(PROFILE_REGISTRY);
  }

  private buildPosteriorMap(loadedPosteriors: ProfilePosterior[]): Record<ProfileKey, ProfilePosterior> {
    const posteriorMap = {} as Record<ProfileKey, ProfilePosterior>;

    for (const profileKey of PROFILE_KEYS) {
      const existingPosterior = loadedPosteriors.find(
        (posterior) => posterior.profileId === profileKey,
      );
      const normalizedPosterior = existingPosterior ?? {
        profileId: profileKey,
        alpha: 1,
        beta: 1,
      };

      const hasUninformedPosterior =
        normalizedPosterior.alpha === 1 && normalizedPosterior.beta === 1;
      const defaultPrior = DEFAULT_PRIORS[profileKey];

      posteriorMap[profileKey] = hasUninformedPosterior
        ? {
            profileId: profileKey,
            alpha: normalizedPosterior.alpha + defaultPrior.alpha,
            beta: normalizedPosterior.beta + defaultPrior.beta,
          }
        : normalizedPosterior;
    }

    return posteriorMap;
  }

  private async logPosteriorLoadError(
    error: unknown,
    context: ParallelStrategyContext,
  ): Promise<void> {
    try {
      if (!logger) {
        const { createLogger } = await import('@consuelo/logger');

        logger = createLogger('dialer:ParallelStrategyResolver');
      }

      if (logger) {
        logger.error(
          '[ParallelStrategyResolver] posterior load failed, using fallback',
          {
            queueId: context.queueId,
            error: error instanceof Error ? error.message : String(error),
          },
        );
      }
    } catch {
      // logger package is optional in some consumers
    }
  }
}
