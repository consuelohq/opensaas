import { createState } from '@/ui/utilities/state/utils/createState';

export const settingsRolesIsLoadingState = createState<boolean>({
  key: 'settingsRolesIsLoadingState',
  defaultValue: true,
});
