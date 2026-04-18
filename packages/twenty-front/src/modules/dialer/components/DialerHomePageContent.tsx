import { useRecoilValue } from 'recoil';

import { DialerHomeLivePanel } from '@/dialer/components/DialerHomeLivePanel';
import { DialerHomePrep } from '@/dialer/components/DialerHomePrep';
import { useCoaching } from '@/dialer/hooks/useCoaching';
import { usePostCallAnalysis } from '@/dialer/hooks/usePostCallAnalysis';
import { useResetCoachingState } from '@/dialer/hooks/useResetCoachingState';
import { useTranscript } from '@/dialer/hooks/useTranscript';
import { callStateAtom } from '@/dialer/states/callStateAtom';

export const DialerHomePageContent = () => {
  useResetCoachingState();
  useCoaching();
  useTranscript();
  usePostCallAnalysis();

  const callState = useRecoilValue(callStateAtom);

  if (callState.status === 'active' || callState.status === 'ended') {
    return <DialerHomeLivePanel />;
  }

  return <DialerHomePrep />;
};
