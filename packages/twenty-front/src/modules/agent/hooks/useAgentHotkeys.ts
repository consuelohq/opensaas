import { useGoToHotkeys } from '@/ui/utilities/hotkey/hooks/useGoToHotkeys';
import { AppPath } from 'twenty-shared/types';

export const useAgentHotkeys = () => {
  useGoToHotkeys({ key: 'a', location: AppPath.Agent });
};
