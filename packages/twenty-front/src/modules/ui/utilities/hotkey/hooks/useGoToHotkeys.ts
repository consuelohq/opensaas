import { type Keys } from 'react-hotkeys-hook/dist/types';
import { useNavigate } from 'react-router-dom';

import { useGlobalHotkeysSequence } from '@/ui/utilities/hotkey/hooks/useGlobalHotkeysSequence';

type GoToHotkeysProps = {
  key: Keys;
  location: string;
  preNavigateFunction?: () => void;
  enabled?: boolean;
};

export const useGoToHotkeys = ({
  key,
  location,
  preNavigateFunction,
  enabled = true,
}: GoToHotkeysProps) => {
  const navigate = useNavigate();

  useGlobalHotkeysSequence(
    'g',
    key,
    () => {
      if (!enabled) return;
      preNavigateFunction?.();
      navigate(location);
    },
    {
      enableOnContentEditable: true,
      enableOnFormTags: true,
      preventDefault: true,
    },
    [navigate, enabled],
  );
};
