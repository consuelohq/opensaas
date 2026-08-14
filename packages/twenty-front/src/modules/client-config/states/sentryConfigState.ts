import { type Sentry } from '@/client-config/types/ClientConfig';
import { createState } from '@/ui/utilities/state/utils/createState';

export const sentryConfigState = createState<Sentry | null>({
  key: 'sentryConfigState',
  defaultValue: null,
});
