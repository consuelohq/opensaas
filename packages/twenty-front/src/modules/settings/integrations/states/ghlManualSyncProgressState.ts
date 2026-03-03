import { createState } from '@/ui/utilities/state/utils/createState';

import type { GHLManualSyncProgress } from '@/settings/integrations/types/ghl';

export const ghlManualSyncProgressState = createState<GHLManualSyncProgress>({
  key: 'ghlManualSyncProgress',
  defaultValue: {
    status: 'idle',
    progress: 0,
    message: '',
  },
});
