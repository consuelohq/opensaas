import { createState } from '@/ui/utilities/state/utils/createState';

export const localPresenceEnabledState = createState<boolean>({
  key: 'dialerLocalPresenceEnabledState',
  defaultValue: false,
});
