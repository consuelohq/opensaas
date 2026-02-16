import { createState } from '@/ui/utilities/state/utils/createState';

export const phoneNumberState = createState<string>({
  key: 'dialerPhoneNumberState',
  defaultValue: '',
});
