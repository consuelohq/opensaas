import { createState } from '@/ui/utilities/state/utils/createState';

import type { GHLPushSettings } from '@/settings/integrations/types/ghl';

export const ghlPushSettingsState = createState<GHLPushSettings>({
  key: 'ghlPushSettings',
  defaultValue: {
    callOutcomes: false,
    contactUpdates: false,
    tags: false,
    notes: false,
  },
});
