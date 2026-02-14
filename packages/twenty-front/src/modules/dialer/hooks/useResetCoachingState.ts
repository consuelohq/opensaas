import { useEffect, useRef } from 'react';
import { useRecoilCallback, useRecoilValue } from 'recoil';

import { callStateAtom } from '@/dialer/states/callStateAtom';
import {
  analysisErrorState,
  coachingErrorState,
  coachingLoadingState,
  isAnalyzingState,
  postCallAnalysisState,
  talkingPointsState,
  transcriptConnectedState,
  transcriptErrorState,
  transcriptState,
} from '@/dialer/states/coachingState';

export const useResetCoachingState = () => {
  const callState = useRecoilValue(callStateAtom);
  const prevStatusRef = useRef(callState.status);

  const resetAll = useRecoilCallback(
    ({ set }) =>
      () => {
        set(coachingLoadingState, false);
        set(talkingPointsState, null);
        set(coachingErrorState, null);
        set(transcriptState, []);
        set(transcriptConnectedState, false);
        set(postCallAnalysisState, null);
        set(isAnalyzingState, false);
        set(transcriptErrorState, null);
        set(analysisErrorState, null);
      },
    [],
  );

  useEffect(() => {
    const prev = prevStatusRef.current;
    prevStatusRef.current = callState.status;

    if (prev !== 'connecting' && callState.status === 'connecting') {
      resetAll();
    }
  }, [callState.status, resetAll]);
};
