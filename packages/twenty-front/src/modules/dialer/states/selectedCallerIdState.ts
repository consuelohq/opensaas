import { createState } from '@/ui/utilities/state/utils/createState';

export const selectedCallerIdState = createState<string | null>({
  key: 'dialerSelectedCallerIdState',
  defaultValue: null,
});
