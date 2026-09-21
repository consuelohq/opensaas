import { type Billing } from '@/client-config/types/ClientConfig';
import { createState } from '@/ui/utilities/state/utils/createState';

export const billingState = createState<Billing | null>({
  key: 'billingState',
  defaultValue: null,
});
