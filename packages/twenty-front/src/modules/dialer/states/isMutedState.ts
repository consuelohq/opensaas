import { createState } from '@/ui/utilities/state/utils/createState';

export const isMutedState = createState<boolean>({
  key: 'dialerIsMutedState',
  defaultValue: false,
});
