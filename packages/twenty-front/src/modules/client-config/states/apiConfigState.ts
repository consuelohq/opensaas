import { type ApiConfig } from '@/client-config/types/ClientConfig';
import { createState } from '@/ui/utilities/state/utils/createState';

export const apiConfigState = createState<ApiConfig | null>({
  key: 'apiConfigState',
  defaultValue: null,
});
