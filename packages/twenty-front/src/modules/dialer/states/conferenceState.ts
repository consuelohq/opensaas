import { createState } from '@/ui/utilities/state/utils/createState';

/** Conference SID for the active call — set after TwiML webhook fires */
export const conferenceSidState = createState<string | null>({
  key: 'dialerConferenceSidState',
  defaultValue: null,
});
