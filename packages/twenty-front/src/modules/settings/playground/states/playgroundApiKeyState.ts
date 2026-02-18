import { createState } from '@/ui/utilities/state/utils/createState';

export const playgroundApiKeyState = createState<string | null>({
  key: 'playgroundApiKeyState',
  defaultValue: null,
});
