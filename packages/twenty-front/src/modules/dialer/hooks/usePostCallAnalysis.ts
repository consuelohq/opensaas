import { useCallback, useEffect, useRef } from 'react';
import { captureException } from '@sentry/react';
import { useRecoilValue, useSetRecoilState } from 'recoil';

import { REACT_APP_SERVER_BASE_URL } from '~/config';
import {
  analysisErrorState,
  isAnalyzingState,
  postCallAnalysisState,
  transcriptState,
} from '@/dialer/states/coachingState';
import { callStateAtom } from '@/dialer/states/callStateAtom';
import { authenticatedFetch } from '@/dialer/utils/authenticatedFetch';
import {
  type CallAnalytics,
  type TranscriptEntry,
} from '@/dialer/types/coaching';

const isValidCallAnalytics = (
  data: unknown,
): data is CallAnalytics => {
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
};

const isTranscriptEntry = (
  data: unknown,
): data is TranscriptEntry => {
  if (!data || typeof data !== 'object') return false;

  const entry = data as Record<string, unknown>;

  return (
    typeof entry.id === 'string' &&
    (entry.speaker === 'agent' || entry.speaker === 'customer') &&
    typeof entry.text === 'string' &&
    typeof entry.timestamp === 'number' &&
    typeof entry.confidence === 'number'
  );
};

interface UsePostCallAnalysisReturn {
  postCallAnalysis: CallAnalytics | null;
  isAnalyzing: boolean;
  analysisError: string | null;
  analyze: (callId: string, transcript: TranscriptEntry[]) => Promise<void>;
  retry: () => void;
}

export const usePostCallAnalysis = (): UsePostCallAnalysisReturn => {
  const callState = useRecoilValue(callStateAtom);
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

  const fetchPersistedTranscript = useCallback(
    async (callId: string, fallbackEntries: TranscriptEntry[]) => {
      try {
        const response = await authenticatedFetch(
          `${REACT_APP_SERVER_BASE_URL}/v1/calls/${callId}/transcript`,
          {
            method: 'GET',
            signal: abortControllerRef.current?.signal,
          },
        );

        if (!response.ok) {
          return fallbackEntries;
        }

        const json = (await response.json()) as { entries?: unknown };
        const persistedEntries = Array.isArray(json.entries)
          ? json.entries.filter(isTranscriptEntry)
          : [];

        return persistedEntries.length > 0 ? persistedEntries : fallbackEntries;
      } catch (error: unknown) {
        if (error instanceof Error && error.name === 'AbortError') {
          throw error;
        }

        captureException(error, {
          extra: { context: 'fetchPersistedTranscript', callId },
        });
        return fallbackEntries;
      }
    },
    [],
  );

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
        const transcriptEntries = await fetchPersistedTranscript(callId, entries);

        if (transcriptEntries.length === 0) {
          throw new Error('No transcript available for analysis');
        }

        const messages = transcriptEntries.map((entry) => ({
          role: entry.speaker === 'agent' ? 'sales_rep' : 'customer',
          content: entry.text,
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
          throw new Error('Invalid postCallAnalysis response format');
        }

        lastCallSidRef.current = callId;
        lastTranscriptRef.current = transcriptEntries;
        setAnalysis(data);

        const persistResponse = await authenticatedFetch(
          `${REACT_APP_SERVER_BASE_URL}/v1/calls/${callId}/analysis`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
          },
        );

        if (!persistResponse.ok) {
          throw new Error(`Persist analysis API error: ${persistResponse.status}`);
        }
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
    [fetchPersistedTranscript, setAnalysis, setIsAnalyzing, setError],
  );

  useEffect(() => {
    if (callState.status === 'active' && callState.callSid) {
      lastCallSidRef.current = callState.callSid;
      lastTranscriptRef.current = transcript;
    }
  }, [callState.status, callState.callSid, transcript]);

  useEffect(() => {
    const prev = prevStatusRef.current;
    prevStatusRef.current = callState.status;

    if (
      prev === 'active' &&
      callState.status === 'ended' &&
      callState.callSid
    ) {
      void analyze(callState.callSid, lastTranscriptRef.current);
    }
  }, [callState.status, callState.callSid, analyze]);

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

  const retry = useCallback(() => {
    if (lastCallSidRef.current && lastTranscriptRef.current.length > 0) {
      analyzedCallsRef.current.delete(lastCallSidRef.current);
      void analyze(lastCallSidRef.current, lastTranscriptRef.current);
    }
  }, [analyze]);

  return { postCallAnalysis, isAnalyzing, analysisError, analyze, retry };
};
