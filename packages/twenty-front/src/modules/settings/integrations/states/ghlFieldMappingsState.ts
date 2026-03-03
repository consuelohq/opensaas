import { createState } from '@/ui/utilities/state/utils/createState';

import type { GHLFieldMapping } from '@/settings/integrations/types/ghl';

export const ghlFieldMappingsState = createState<GHLFieldMapping[]>({
  key: 'ghlFieldMappings',
  defaultValue: [],
});
