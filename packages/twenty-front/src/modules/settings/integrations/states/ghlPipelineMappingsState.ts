import { createState } from '@/ui/utilities/state/utils/createState';

import type { GHLPipelineStageMapping } from '@/settings/integrations/types/ghl';

export const ghlPipelineMappingsState = createState<GHLPipelineStageMapping[]>({
  key: 'ghlPipelineMappings',
  defaultValue: [],
});
