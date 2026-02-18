import { useCallback } from 'react';
import { useRecoilValue } from 'recoil';

import { activeCallState } from '@/dialer/states/activeCallState';
import { type DTMFKey } from '@/dialer/types/dialer';

export const useDTMF = () => {
  const activeCall = useRecoilValue(activeCallState);

  const sendDigit = useCallback(
    (digit: DTMFKey) => {
      if (!activeCall) return;
      activeCall.sendDigits(digit);
    },
    [activeCall],
  );

  return { sendDigit };
};
