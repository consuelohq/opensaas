import { createState } from '@/ui/utilities/state/utils/createState';

export const isOnHoldState = createState<boolean>({
  key: 'dialerIsOnHoldState',
  defaultValue: false,
});
