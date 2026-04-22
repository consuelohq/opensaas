import { localStorageEffect } from '~/utils/recoil/localStorageEffect';
import { createState } from '@/ui/utilities/state/utils/createState';

export const lastVisitedPagePathState = createState<string | null>({
  key: 'lastVisitedPagePathState',
  defaultValue: null,
  effects: [localStorageEffect()],
});
