import { createState } from '@/ui/utilities/state/utils/createState';

export const userCallbackPhoneState = createState<string | null>({
  key: 'dialerUserCallbackPhoneState',
  defaultValue: null,
});
