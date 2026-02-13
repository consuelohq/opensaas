import { createState } from '@/ui/utilities/state/utils/createState';

export const deviceErrorState = createState<string | null>({
  key: 'dialerDeviceErrorState',
  defaultValue: null,
});
