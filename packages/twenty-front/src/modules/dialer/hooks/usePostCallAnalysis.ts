import { useCallback, useEffect, useRef } from 'react';
import { useRecoilValue, useSetRecoilState } from 'recoil';
import { captureException } from '@sentry/react';

import { REACT_APP_SERVER_BASE_URL } from '~/config';
import { authenticatedFetch } from '@/dialer/utils/authenticatedFetch';
import {
  analysisErrorState,
  isAnalyzingState,
  postCallAnalysisState,
  transcriptState,
} from '@/dialer/states/coachingState';
import {
  type CallAnalytics,
  type TranscriptEntry,
} from '@/dialer/types/coaching';

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
  const callStateAtom = useRecoilValue(callStateAtom);
  const transcript = useRecoilValue(transcriptState);
  const setAnalysis = useSetRecoilState(postCallAnalysisState);
  const setIsAnalyzing = useSetRecoilState(isAnalyzingState);
  const setError = useSetRecoilState(analysisErrorState);
  const postCallAnalysis = useRecoilValue(postCallAnalysisState);
  const isAnalyzing = useRecoilValue(isAnalyzingState);
  const analysisError = useRecoilValue(analysisErrorState);

  const prevStatusRef = useRef(callState.status);
  const analyzedCallsRef = useRef<Set<string>>(new Set());
  const lastCallSidRef = useRef<string | null>(null);
  const lastTranscriptRef = useRef<TranscriptEntry[]>([]);
  const abortControllerRef = useRef<AbortController | null>(null);

  const analyze = useCallback(
    async (callId: string, entries: TranscriptEntry[]) => {
      if (analyzedCallsRef.current.has(callId)) return;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      abortControllerRef.current = new AbortController();

      analyzedCallsRef.current.add(callId);
      setIsAnalyzing(true);
      setError(null);

      try {
        const messages = entries.map((e) => ({
          role: e.speaker === 'agent' ? 'sales_rep' : 'customer',
          content: e.text,
        }));

        const res = await authenticatedFetch(
          `${REACT_APP_SERVER_BASE_URL}/v1/coaching/analyze`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: abortControllerRef.current.signal,
            body: JSON.stringify({ messages, callSid: callId }),
          },
        );

        if (!res.ok) {
          throw new Error(`Analysis API error: ${res.status}`);
        }

        const json = (await res.json()) as { data: unknown };
        const data = json.data;

        if (!isValidCallAnalytics(data)) {
          throw new Error('Invalid analysis response format');
        }

        setAnalysis(data);

        authenticatedFetch(
          `${REACT_APP_SERVER_BASE_URL}/v1/calls/${callId}/analysis`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
          },
        ).catch((err: unknown) => {
          captureException(err, {
            extra: { context: 'persistAnalysis', callId },
          });
        });
      } catch (err: unknown) {
        if (err instanceof Error && err.name === 'AbortError') return;
        captureException(err, { extra: { context: 'analyze', callId } });
        const message = err instanceof Error ? err.message : 'Analysis failed';
        setError(message);
        analyzedCallsRef.current.delete(callId);
      } finally {
        setIsAnalyzing(false);
      }
    },
    [setAnalysis, setIsAnalyzing, setError],
  );

  // FIX: continuously capture transcript during active call to avoid race condition
  useEffect(() => {
    if (callState.status === 'active' && callState.callSid) {
      lastCallSidRef.current = callState.callSid;
      lastTranscriptRef.current = transcript;
    }
  }, [callState.status, callState.callSid, transcript]);

  // auto-trigger when call transitions from active → ended
  useEffect(() => {
    const prev = prevStatusRef.current;
    prevStatusRef.current = callState.status;

    if (
      prev === 'active' &&
      callState.status === 'ended' &&
      callState.callSid
    ) {
      // use the ref-captured transcript instead of current state
      void analyze(callState.callSid, lastTranscriptRef.current);
    }
  }, [callState.status, callState.callSid, analyze]);

  // clear analysis when a new call starts
  useEffect(() => {
    if (callState.status === 'idle') {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
      setAnalysis(null);
      setError(null);
    }
  }, [callState.status, setAnalysis, setError]);

  // retry with last known callSid + transcript
  const retry = useCallback(() => {
    if (lastCallSidRef.current && lastTranscriptRef.current.length > 0) {
      analyzedCallsRef.current.delete(lastCallSidRef.current);
      void analyze(lastCallSidRef.current, lastTranscriptRef.current);
    }
  }, [analyze]);

  return { analysis, isAnalyzing, error, analyze, retry };
};
