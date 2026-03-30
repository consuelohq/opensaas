import { type CoachingScript } from '@/dialer/types/coachingScript';
import { createState } from '@/ui/utilities/state/utils/createState';
import { localStorageEffect } from '~/utils/recoil/localStorageEffect';

export const coachingScriptsState = createState<CoachingScript[]>({
  key: 'dialerCoachingScriptsState',
  defaultValue: [],
  effects: [localStorageEffect()],
});
