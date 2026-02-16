import { useCallback, useEffect, useRef } from 'react';
import { useRecoilValue, useSetRecoilState } from 'recoil';

import { REACT_APP_SERVER_BASE_URL } from '~/config';
import { callStateAtom } from '@/dialer/states/callStateAtom';
import {
  analysisErrorState,
  isAnalyzingState,
  postCallAnalysisState,
  transcriptState,
} from '@/dialer/states/coachingState';
import { type CallAnalytics, type TranscriptEntry } from '@/dialer/types/coaching';

// W16: basic runtime validation for CallAnalytics shape
function isValidCallAnalytics(data: unknown): data is CallAnalytics {
  if (!data || typeof data !== 'object') return false;
  const obj = data as Record<string, unknown>;
  return (
    typeof obj.summary === 'string' &&
    typeof obj.performanceScore === 'number' &&
    Array.isArray(obj.keyMoments) &&
    Array.isArray(obj.nextSteps) &&
    obj.sentiment !== null &&
    typeof obj.sentiment === 'object'
  );
}

interface UsePostCallAnalysisReturn {
  analysis: CallAnalytics | null;
  isAnalyzing: boolean;
  error: string | null;
  analyze: (callId: string, transcript: TranscriptEntry[]) => Promise<void>;
  retry: () => void;
}

export const usePostCallAnalysis = (): UsePostCallAnalysisReturn => {
  const callState = useRecoilValue(callStateAtom);
  const transcript = useRecoilValue(transcriptState);
  const setAnalysis = useSetRecoilState(postCallAnalysisState);
  const setIsAnalyzing = useSetRecoilState(isAnalyzingState);
  const setError = useSetRecoilState(analysisErrorState);
  const analysis = useRecoilValue(postCallAnalysisState);
  const isAnalyzing = useRecoilValue(isAnalyzingState);
  const error = useRecoilValue(analysisErrorState);

  const prevStatusRef = useRef(callState.status);
  const analyzedCallsRef = useRef<Set<string>>(new Set());
  const lastCallSidRef = useRef<string | null>(null);
  const lastTranscriptRef = useRef<TranscriptEntry[]>([]);

  const analyze = useCallback(
    async (callId: string, entries: TranscriptEntry[]) => {
      if (analyzedCallsRef.current.has(callId)) return;
      analyzedCallsRef.current.add(callId);
      setIsAnalyzing(true);
      setError(null);

      try {
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

        // W10: unwrap { data } from backend response
        const json = (await res.json()) as { data: unknown };
        const data = json.data;

        // W16: validate LLM response shape
        if (!isValidCallAnalytics(data)) {
          throw new Error('Invalid analysis response format');
        }

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
      } catch (err: unknown) {
        // W9: set error state so UI can show failure + retry
        const message = err instanceof Error ? err.message : 'Analysis failed';
        setError(message);
        analyzedCallsRef.current.delete(callId);
      } finally {
        setIsAnalyzing(false);
      }
    },
    [setAnalysis, setIsAnalyzing, setError],
  );

  // auto-trigger when call transitions from active → ended
  useEffect(() => {
    const prev = prevStatusRef.current;
    prevStatusRef.current = callState.status;

    if (prev === 'active' && callState.status === 'ended' && callState.callSid) {
      lastCallSidRef.current = callState.callSid;
      lastTranscriptRef.current = transcript;
      void analyze(callState.callSid, transcript);
    }
  }, [callState.status, callState.callSid, transcript, analyze]);

  // clear analysis when a new call starts
  useEffect(() => {
    if (callState.status === 'idle') {
      setAnalysis(null);
      setError(null);
    }
  }, [callState.status, setAnalysis, setError]);

  // W9: retry with last known callSid + transcript
  const retry = useCallback(() => {
    if (lastCallSidRef.current && lastTranscriptRef.current.length > 0) {
      analyzedCallsRef.current.delete(lastCallSidRef.current);
      void analyze(lastCallSidRef.current, lastTranscriptRef.current);
    }
  }, [analyze]);

  return { analysis, isAnalyzing, error, analyze, retry };
};
