import { useCallback, useEffect, useState } from 'react';
import * as Sentry from '@sentry/react';
import { t } from '@lingui/core/macro';
import { useRecoilValue, useSetRecoilState } from 'recoil';

import { REACT_APP_SERVER_BASE_URL } from '~/config';
import {
  analysisErrorState,
  isAnalyzingState,
  postCallAnalysisState,
} from '@/dialer/states/coachingState';
import { callStateAtom } from '@/dialer/states/callStateAtom';
import { authenticatedFetch } from '@/dialer/utils/authenticatedFetch';
import { type CallAnalytics } from '@/dialer/types/coaching';

const isValidCallAnalytics = (data: unknown): data is CallAnalytics => {
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

type AnalyzeOptions = {
  force?: boolean;
};

interface UsePostCallAnalysisReturn {
  postCallAnalysis: CallAnalytics | null;
  isAnalyzing: boolean;
  analysisError: string | null;
  analyze: (callId: string, options?: AnalyzeOptions) => Promise<void>;
  retry: () => void;
}

export const usePostCallAnalysis = (): UsePostCallAnalysisReturn => {
  const { status: callStatus, callSid } = useRecoilValue(callStateAtom);
  const setAnalysis = useSetRecoilState(postCallAnalysisState);
  const setIsAnalyzing = useSetRecoilState(isAnalyzingState);
  const setError = useSetRecoilState(analysisErrorState);
  const postCallAnalysis = useRecoilValue(postCallAnalysisState);
  const isAnalyzing = useRecoilValue(isAnalyzingState);
  const analysisError = useRecoilValue(analysisErrorState);

  const [analyzedCallIds, setAnalyzedCallIds] = useState<string[]>([]);
  const [lastCallSid, setLastCallSid] = useState<string | null>(null);
  const [abortController, setAbortController] =
    useState<AbortController | null>(null);

  const clearAnalyzedCall = useCallback((callId: string) => {
    setAnalyzedCallIds((previousCallIds) =>
      previousCallIds.filter((existingCallId) => existingCallId !== callId),
    );
  }, []);

  const markAnalyzedCall = useCallback((callId: string) => {
    setAnalyzedCallIds((previousCallIds) =>
      previousCallIds.includes(callId)
        ? previousCallIds
        : [...previousCallIds, callId],
    );
  }, []);

  const fetchPersistedAnalysis = useCallback(
    async (callId: string, signal?: AbortSignal) => {
      try {
        const response = await authenticatedFetch(
          `${REACT_APP_SERVER_BASE_URL}/v1/calls/${callId}`,
          {
            method: 'GET',
            signal,
          },
        );

        if (!response.ok) {
          const error = new Error(`Call fetch API error: ${response.status}`);
          Sentry.captureException(error, {
            extra: { context: 'fetchPersistedAnalysisHttp', callId },
          });
          return null;
        }

        const json = (await response.json()) as { analysis?: unknown };

        return isValidCallAnalytics(json.analysis) ? json.analysis : null;
      } catch (error: unknown) {
        if (error instanceof Error && error.name === 'AbortError') {
          throw error;
        }

        Sentry.captureException(error, {
          extra: { context: 'fetchPersistedAnalysis', callId },
        });
        return null;
      }
    },
    [],
  );

  const analyze = useCallback(
    async (callId: string, options?: AnalyzeOptions) => {
      if (analyzedCallIds.includes(callId) && options?.force !== true) {
        return;
      }

      abortController?.abort();
      const nextAbortController = new AbortController();
      setAbortController(nextAbortController);

      markAnalyzedCall(callId);
      setIsAnalyzing(true);
      setError(null);

      try {
        const persistedAnalysis = await fetchPersistedAnalysis(
          callId,
          nextAbortController.signal,
        );

        if (persistedAnalysis !== null && options?.force !== true) {
          setLastCallSid(callId);
          setAnalysis(persistedAnalysis);
          return;
        }

        const query = options?.force === true ? '?force=true' : '';
        const response = await authenticatedFetch(
          `${REACT_APP_SERVER_BASE_URL}/v1/calls/${callId}/analysis${query}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: nextAbortController.signal,
          },
        );

        if (!response.ok) {
          const error = new Error(`Analysis API error: ${response.status}`);
          Sentry.captureException(error, {
            extra: { context: 'analyzeHttp', callId },
          });
          throw error;
        }

        const json = (await response.json()) as { data: unknown };
        const data = json.data;

        if (!isValidCallAnalytics(data)) {
          throw new Error(t`Invalid post-call analysis response format`);
        }

        setLastCallSid(callId);
        setAnalysis(data);
      } catch (error: unknown) {
        if (error instanceof Error && error.name === 'AbortError') {
          return;
        }

        Sentry.captureException(error, {
          extra: { context: 'analyze', callId },
        });
        const message =
          error instanceof Error ? error.message : t`Analysis failed`;
        setError(message);
        clearAnalyzedCall(callId);
      } finally {
        setIsAnalyzing(false);
        setAbortController((currentAbortController) =>
          currentAbortController === nextAbortController
            ? null
            : currentAbortController,
        );
      }
    },
    [
      abortController,
      analyzedCallIds,
      clearAnalyzedCall,
      fetchPersistedAnalysis,
      markAnalyzedCall,
      setAnalysis,
      setError,
      setIsAnalyzing,
    ],
  );

  useEffect(() => {
    if (callStatus === 'active' && callSid !== null) {
      setLastCallSid(callSid);
    }
  }, [callSid, callStatus]);

  useEffect(() => {
    if (
      callStatus === 'ended' &&
      callSid !== null &&
      lastCallSid === callSid &&
      !analyzedCallIds.includes(callSid) &&
      !isAnalyzing
    ) {
      void analyze(callSid);
    }
  }, [analyze, analyzedCallIds, callSid, callStatus, isAnalyzing, lastCallSid]);

  useEffect(() => {
    if (callStatus === 'idle') {
      abortController?.abort();
      setAbortController(null);
      setAnalyzedCallIds([]);
      setLastCallSid(null);
      setAnalysis(null);
      setError(null);
    }
  }, [abortController, callStatus, setAnalysis, setError]);

  const retry = useCallback(() => {
    if (lastCallSid !== null) {
      clearAnalyzedCall(lastCallSid);
      void analyze(lastCallSid, { force: true });
    }
  }, [analyze, clearAnalyzedCall, lastCallSid]);

  return { postCallAnalysis, isAnalyzing, analysisError, analyze, retry };
};
