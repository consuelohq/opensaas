import { type CallingMode } from '@/dialer/types/dialer';
import { createState } from '@/ui/utilities/state/utils/createState';
import { localStorageEffect } from '~/utils/recoil/localStorageEffect';

export const callingModeState = createState<CallingMode>({
  key: 'dialerCallingModeState',
  defaultValue: 'browser',
  effects: [localStorageEffect()],
});
