import { useRecoilValue } from 'recoil';

import { DialerHomeLivePanel } from '@/dialer/components/DialerHomeLivePanel';
import { DialerHomePrep } from '@/dialer/components/DialerHomePrep';

export const DialerHomePageContent = () => {
  const callStateAtom = useRecoilValue(callStateAtom);

  if (callState.status === 'active' || callState.status === 'ended') {
    return <DialerHomeLivePanel />;
  }

  return <DialerHomePrep />;
};
