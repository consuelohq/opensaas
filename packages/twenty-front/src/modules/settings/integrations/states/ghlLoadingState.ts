import { createState } from '@/ui/utilities/state/utils/createState';

import type { GHLLoadingState } from '@/settings/integrations/types/ghl';

export const ghlLoadingState = createState<GHLLoadingState>({
  key: 'ghlLoading',
  defaultValue: 'idle',
});
