import { createState } from '@/ui/utilities/state/utils/createState';

export const ghlErrorState = createState<string | null>({
  key: 'ghlError',
  defaultValue: null,
});
