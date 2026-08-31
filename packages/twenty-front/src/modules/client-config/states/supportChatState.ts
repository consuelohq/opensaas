import { createState } from '@/ui/utilities/state/utils/createState';
import {
  type Support,
  SupportDriver,
} from '@/client-config/types/ClientConfig';

export const supportChatState = createState<Support>({
  key: 'supportChatState',
  defaultValue: {
    supportDriver: SupportDriver.NONE,
    supportFrontChatId: null,
  },
});
