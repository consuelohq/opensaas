import { createState } from '@/ui/utilities/state/utils/createState';

import { type MessageChannel } from '@/accounts/types/MessageChannel';

export const settingsAccountsSelectedMessageChannelState =
  createState<MessageChannel | null>({
    key: 'settingsAccountsSelectedMessageChannelState',
    defaultValue: null,
  });
