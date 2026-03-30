import { useEffect, useRef, useState } from 'react';
import { useRecoilValue } from 'recoil';

import { deviceReadyState } from '@/dialer/states/deviceReadyState';

const STORAGE_KEY = 'dialer_first_call_completed';
const CONGRATS_DURATION_MS = 4_000;

type FirstCallFlowState = 'prompt' | 'congrats' | 'hidden';

const isFirstCallCompleted = (): boolean => {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
};

const markFirstCallCompleted = (): void => {
  try {
    localStorage.setItem(STORAGE_KEY, 'true');
  } catch {
    // localStorage unavailable
  }
};

type UseFirstCallFlowReturn = {
  flowState: FirstCallFlowState;
};

export const useFirstCallFlow = (): UseFirstCallFlowReturn => {
  const callStateAtom = useRecoilValue(callStateAtom);
  const deviceReady = useRecoilValue(deviceReadyState);
  const previousStatusRef = useRef(callState.status);
  const [flowState, setFlowState] = useState<FirstCallFlowState>(() =>
    isFirstCallCompleted() ? 'hidden' : 'prompt',
  );

  // detect call completion: status transitions from active → ended
  useEffect(() => {
    const wasActive = previousStatusRef.current === 'active';
    const isEnded = callState.status === 'ended';

    if (wasActive && isEnded && flowState === 'prompt') {
      markFirstCallCompleted();
      setFlowState('congrats');
    }

    previousStatusRef.current = callState.status;
  }, [callState.status, flowState]);

  // auto-dismiss congrats after timeout
  useEffect(() => {
    if (flowState !== 'congrats') return;

    const timer = setTimeout(() => {
      setFlowState('hidden');
    }, CONGRATS_DURATION_MS);

    return () => clearTimeout(timer);
  }, [flowState]);

  // hide prompt if device isn't ready (twilio not configured)
  if (!deviceReady && flowState === 'prompt') {
    return { flowState: 'hidden' };
  }

  return { flowState };
};
