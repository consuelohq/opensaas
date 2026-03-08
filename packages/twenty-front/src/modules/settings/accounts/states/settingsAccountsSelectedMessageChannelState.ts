import { type MessageChannel } from '@/accounts/types/MessageChannel';
import { createState } from '@/ui/utilities/state/utils/createState';

export const settingsAccountsSelectedMessageChannelState =
  createState<MessageChannel | null>({
    key: 'settingsAccountsSelectedMessageChannelState',
    defaultValue: null,
  });
