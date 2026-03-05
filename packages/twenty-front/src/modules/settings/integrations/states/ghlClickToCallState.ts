import { createState } from '@/ui/utilities/state/utils/createState';

import type { GHLClickToCallContact } from '@/settings/integrations/types/ghl';

export type GHLClickToCallState = {
  pendingContact: GHLClickToCallContact | null;
  autoDial: boolean;
};

export const ghlClickToCallState = createState<GHLClickToCallState>({
  key: 'ghlClickToCall',
  defaultValue: {
    pendingContact: null,
    autoDial: false,
  },
});
