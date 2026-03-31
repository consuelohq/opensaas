import { createState } from '@/ui/utilities/state/utils/createState';
import { localStorageEffect } from '~/utils/recoil/localStorageEffect';

export type DialingMode = 'single' | 'parallel';

export const dialingModeState = createState<DialingMode>({
  key: 'dialerDialingModeState',
  defaultValue: 'parallel',
  effects: [localStorageEffect()],
});
