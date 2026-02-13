import { type TransferRecord } from '@/dialer/types/dialer';
import { createState } from '@/ui/utilities/state/utils/createState';

export const activeTransferState = createState<TransferRecord | null>({
  key: 'dialerActiveTransferState',
  defaultValue: null,
});
