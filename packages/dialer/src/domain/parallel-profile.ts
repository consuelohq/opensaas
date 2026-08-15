import type { AmdResult, ParallelDialProfile } from '../types.js';

export const isHumanLikeAnswer = (
  profile: ParallelDialProfile,
  amdResult: AmdResult | undefined,
): boolean =>
  amdResult === 'human' ||
  (profile.amdPolicy === 'human-or-unknown' && amdResult === 'unknown');
