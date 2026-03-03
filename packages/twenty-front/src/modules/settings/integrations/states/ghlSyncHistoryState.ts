import { createState } from '@/ui/utilities/state/utils/createState';

import type { GHLSyncLogEntry } from '@/settings/integrations/types/ghl';

export const ghlSyncHistoryState = createState<GHLSyncLogEntry[]>({
  key: 'ghlSyncHistory',
  defaultValue: [],
});
