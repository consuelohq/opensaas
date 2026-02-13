import { createState } from '@/ui/utilities/state/utils/createState';

export const deviceReadyState = createState<boolean>({
  key: 'dialerDeviceReadyState',
  defaultValue: false,
});
