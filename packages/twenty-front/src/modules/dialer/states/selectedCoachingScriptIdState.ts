import { createState } from '@/ui/utilities/state/utils/createState';
import { localStorageEffect } from '~/utils/recoil/localStorageEffect';

export const selectedCoachingScriptIdState = createState<string | null>({
  key: 'dialerSelectedCoachingScriptIdState',
  defaultValue: null,
  effects: [localStorageEffect()],
});
