import { createState } from '@/ui/utilities/state/utils/createState';

export const settingsRoleIdsState = createState<string[]>({
  key: 'settings.settingsRoleIdsState',
  defaultValue: [],
});
