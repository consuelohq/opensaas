import { createState } from '@/ui/utilities/state/utils/createState';

import type { GHLSyncConfig } from '@/settings/integrations/types/ghl';

export const ghlSyncConfigState = createState<GHLSyncConfig>({
  key: 'ghlSyncConfig',
  defaultValue: {
    direction: 'bidirectional',
    conflictResolution: 'newest',
    autoSyncEnabled: false,
    autoSyncMinutes: 15,
  },
});
