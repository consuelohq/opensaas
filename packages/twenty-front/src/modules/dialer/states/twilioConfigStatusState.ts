import { type TwilioConfigStatus } from '@/dialer/types/dialer';
import { createState } from '@/ui/utilities/state/utils/createState';

export const twilioConfigStatusState = createState<TwilioConfigStatus | null>({
  key: 'dialerTwilioConfigStatus',
  defaultValue: null,
});
