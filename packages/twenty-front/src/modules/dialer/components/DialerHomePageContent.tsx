import { DialerHomeLivePanel } from '@/dialer/components/DialerHomeLivePanel';
import { DialerHomePrep } from '@/dialer/components/DialerHomePrep';
import { callStateAtom } from '@/dialer/states/callStateAtom';
import { useRecoilValue } from 'recoil';

export const DialerHomePageContent = () => {
  const callState = useRecoilValue(callStateAtom);

  if (callState.status === 'active' || callState.status === 'ended') {
    return <DialerHomeLivePanel />;
  }

  return <DialerHomePrep />;
};
