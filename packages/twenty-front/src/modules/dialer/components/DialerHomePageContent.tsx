import { useRecoilValue } from 'recoil';

import { DialerHomeLivePanel } from '@/dialer/components/DialerHomeLivePanel';
import { DialerHomePrep } from '@/dialer/components/DialerHomePrep';
import { useCoaching } from '@/dialer/hooks/useCoaching';
import { useResetCoachingState } from '@/dialer/hooks/useResetCoachingState';
import { useTranscript } from '@/dialer/hooks/useTranscript';
import { callStateAtom } from '@/dialer/states/callStateAtom';

export const DialerHomePageContent = () => {
  useResetCoachingState();
  useCoaching();
  useTranscript();

  const { status: callStatus } = useRecoilValue(callStateAtom);

  if (callStatus === 'active' || callStatus === 'ended') {
    return <DialerHomeLivePanel />;
  }

  return <DialerHomePrep />;
};
