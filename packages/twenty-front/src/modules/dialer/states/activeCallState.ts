import { createState } from '@/ui/utilities/state/utils/createState';
import type { Call } from '@twilio/voice-sdk';

export const activeCallState = createState<Call | null>({
  key: 'dialerActiveCallState',
  defaultValue: null,
});
