import { createState } from '@/ui/utilities/state/utils/createState';

import type { GHLImportProgress } from '@/settings/integrations/types/ghl';

export const ghlImportProgressState = createState<GHLImportProgress>({
  key: 'ghlImportProgress',
  defaultValue: {
    status: 'idle',
    progress: 0,
    message: '',
  },
});
