import { type UserLookup } from '@/settings/admin-panel/types/UserLookup';
import { createState } from '@/ui/utilities/state/utils/createState';

export const userLookupResultState = createState<UserLookup | null>({
  key: 'settings.userLookupResultState',
  defaultValue: null,
});
