import { type DialerContact } from '@/dialer/types/dialer';
import { createState } from '@/ui/utilities/state/utils/createState';

export const selectedContactState = createState<DialerContact | null>({
  key: 'dialerSelectedContactState',
  defaultValue: null,
});
