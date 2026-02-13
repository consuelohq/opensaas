import { type ParallelGroup } from '@/dialer/types/dialer';
import { createState } from '@/ui/utilities/state/utils/createState';

export const parallelGroupState = createState<ParallelGroup | null>({
  key: 'dialerParallelGroupState',
  defaultValue: null,
});
