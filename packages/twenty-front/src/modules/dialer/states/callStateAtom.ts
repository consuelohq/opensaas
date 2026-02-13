import { type CallState } from '@/dialer/types/dialer';
import { createState } from '@/ui/utilities/state/utils/createState';

export const callStateAtom = createState<CallState>({
  key: 'dialerCallState',
  defaultValue: {
    status: 'idle',
    callSid: null,
    duration: 0,
    startedAt: null,
    contact: null,
    callingMode: 'browser',
    fromNumber: null,
    parallelGroupId: null,
    transferId: null,
  },
});
