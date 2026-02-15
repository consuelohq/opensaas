import { createState } from '@/ui/utilities/state/utils/createState';

export const reconnectingState = createState<boolean>({
  key: 'dialerReconnectingState',
  defaultValue: false,
});
