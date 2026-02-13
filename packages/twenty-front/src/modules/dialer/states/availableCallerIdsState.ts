import { type CallerIdOption } from '@/dialer/types/dialer';
import { createState } from '@/ui/utilities/state/utils/createState';

export const availableCallerIdsState = createState<CallerIdOption[]>({
  key: 'dialerAvailableCallerIdsState',
  defaultValue: [],
});
