import { createState } from '@/ui/utilities/state/utils/createState';
import { localStorageEffect } from '~/utils/recoil/localStorageEffect';

export const parallelLineCountState = createState<number>({
  key: 'dialerParallelLineCountState',
  defaultValue: 1,
  effects: [localStorageEffect()],
});
