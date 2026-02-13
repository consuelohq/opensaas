import { createState } from '@/ui/utilities/state/utils/createState';

export const selectedMicState = createState<string | null>({
  key: 'dialerSelectedMicState',
  defaultValue: null,
});
