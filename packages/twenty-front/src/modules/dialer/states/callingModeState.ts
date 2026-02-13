import { atom } from 'recoil';

import { type CallingMode } from '@/dialer/types/dialer';
import { localStorageEffect } from '~/utils/recoil/localStorageEffect';

export const callingModeState = atom<CallingMode>({
  key: 'dialerCallingModeState',
  default: 'browser',
  effects: [localStorageEffect()],
});
