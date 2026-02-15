import { useEffect, useState } from 'react';
import { useRecoilValue } from 'recoil';

import { callStateAtom } from '@/dialer/states/callStateAtom';

// returns live call duration in seconds, ticking every second
export const useCallDuration = (): number => {
  const { startedAt, status } = useRecoilValue(callStateAtom);
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    if (!startedAt || status !== 'active') {
      setSeconds(0);
      return;
    }

    const tick = () =>
      setSeconds(Math.floor((Date.now() - startedAt.getTime()) / 1000));

    tick();
    const id = setInterval(tick, 1_000);
    return () => clearInterval(id);
  }, [startedAt, status]);

  return seconds;
};
