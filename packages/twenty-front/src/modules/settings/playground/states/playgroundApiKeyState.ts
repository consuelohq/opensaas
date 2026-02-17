import { localStorageEffect } from '~/utils/recoil/localStorageEffect';
import { createState } from '@/ui/utilities/state/utils/createState';

export const playgroundApiKeyState = createState<string | null>({
  key: 'settings.playgroundApiKeyState',
  defaultValue: null,
  effects: [localStorageEffect()],
});
