import { createState } from '@/ui/utilities/state/utils/createState';

export const dialerSidebarOpenState = createState<boolean>({
  key: 'dialerSidebarOpenState',
  defaultValue: false,
});
