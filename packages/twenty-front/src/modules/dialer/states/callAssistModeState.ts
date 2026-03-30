import { type CallAssistMode } from '@/dialer/types/coachingScript';
import { createState } from '@/ui/utilities/state/utils/createState';
import { localStorageEffect } from '~/utils/recoil/localStorageEffect';

export const callAssistModeState = createState<CallAssistMode>({
  key: 'dialerCallAssistModeState',
  defaultValue: 'ai',
  effects: [localStorageEffect()],
});
