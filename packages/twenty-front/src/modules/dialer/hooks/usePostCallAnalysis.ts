import { useCallback, useEffect, useRef } from 'react';
import { useRecoilValue, useSetRecoilState } from 'recoil';

import { REACT_APP_SERVER_BASE_URL } from '~/config';
import { callStateAtom } from '@/dialer/states/callStateAtom';
import {
  isAnalyzingState,
  postCallAnalysisState,
  transcriptState,
} from '@/dialer/states/coachingState';
import { type CallAnalytics, type TranscriptEntry } from '@/dialer/types/coaching';

interface UsePostCallAnalysisReturn {
  analysis: CallAnalytics | null;
  isAnalyzing: boolean;
  analyze: (callId: string, transcript: TranscriptEntry[]) => Promise<void>;
}

export const usePostCallAnalysis = (): UsePostCallAnalysisReturn => {
  const callState = useRecoilValue(callStateAtom);
  const transcript = useRecoilValue(transcriptState);
  const setAnalysis = useSetRecoilState(postCallAnalysisState);
  const setIsAnalyzing = useSetRecoilState(isAnalyzingState);
  const analysis = useRecoilValue(postCallAnalysisState);
  const isAnalyzing = useRecoilValue(isAnalyzingState);

  const prevStatusRef = useRef(callState.status);
  const analyzedCallsRef = useRef<Set<string>>(new Set());

  const analyze = useCallback(
    async (callId: string, entries: TranscriptEntry[]) => {
      if (analyzedCallsRef.current.has(callId)) return;
      analyzedCallsRef.current.add(callId);
      setIsAnalyzing(true);

      try {
        // get analysis from coaching backend
        const messages = entries.map((e) => ({
          role: e.speaker === 'agent' ? 'sales_rep' : 'customer',
          content: e.text,
        }));

        const res = await fetch(
          `${REACT_APP_SERVER_BASE_URL}/v1/coaching/analyze`,
          {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ messages, callSid: callId }),
          },
        );

        if (!res.ok) {
          throw new Error(`Analysis API error: ${res.status}`);
        }

        const data = (await res.json()) as CallAnalytics;
        setAnalysis(data);

        // persist to call record (fire-and-forget)
        fetch(`${REACT_APP_SERVER_BASE_URL}/v1/calls/${callId}/analysis`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        }).catch(() => {
          // persistence failure is non-blocking
        });
      } catch {
        // analysis failure is non-blocking — coaching panel still works
        analyzedCallsRef.current.delete(callId);
      } finally {
        setIsAnalyzing(false);
      }
    },
    [setAnalysis, setIsAnalyzing],
  );

  // auto-trigger when call transitions from active → ended
  useEffect(() => {
    const prev = prevStatusRef.current;
    prevStatusRef.current = callState.status;

    if (prev === 'active' && callState.status === 'ended' && callState.callSid) {
      void analyze(callState.callSid, transcript);
    }
  }, [callState.status, callState.callSid, transcript, analyze]);

  // clear analysis when a new call starts
  useEffect(() => {
    if (callState.status === 'idle') {
      setAnalysis(null);
    }
  }, [callState.status, setAnalysis]);

  return { analysis, isAnalyzing, analyze };
};
