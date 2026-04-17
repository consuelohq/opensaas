import { useCallback, useEffect } from 'react';
import { useLingui } from '@lingui/react/macro';
import * as Sentry from '@sentry/react';
import { useRecoilValue, useSetRecoilState } from 'recoil';

import { REACT_APP_SERVER_BASE_URL } from '~/config';
import { authenticatedFetch } from '@/dialer/utils/authenticatedFetch';
import { callStateAtom } from '@/dialer/states/callStateAtom';
import {
  coachingErrorState,
  coachingLoadingState,
  talkingPointsState,
} from '@/dialer/states/coachingState';
import { type TalkingPoints } from '@/dialer/types/coaching';

const isValidTalkingPoints = (data: unknown): data is TalkingPoints => {
  if (!data || typeof data !== 'object') return false;
  const value = data as Record<string, unknown>;

  return (
    Array.isArray(value.details) &&
    Array.isArray(value.clarifying_questions) &&
    Array.isArray(value.objection_responses)
  );
};

interface UseCoachingReturn {
  coachingLoading: boolean;
  talkingPoints: TalkingPoints | null;
  coachingError: string | null;
  retry: () => void;
}

export const useCoaching = (): UseCoachingReturn => {
  const { t } = useLingui();
  const { callSid, status: callStatus } = useRecoilValue(callStateAtom);
  const coachingLoading = useRecoilValue(coachingLoadingState);
  const talkingPoints = useRecoilValue(talkingPointsState);
  const coachingError = useRecoilValue(coachingErrorState);
  const setCoachingLoading = useSetRecoilState(coachingLoadingState);
  const setTalkingPoints = useSetRecoilState(talkingPointsState);
  const setCoachingError = useSetRecoilState(coachingErrorState);

  const refresh = useCallback(async () => {
    if (
      typeof callSid !== 'string' ||
      callSid.length === 0 ||
      callStatus !== 'active'
    ) {
      return;
    }

    setCoachingLoading(true);
    setCoachingError(null);

    try {
      const response = await authenticatedFetch(
        `${REACT_APP_SERVER_BASE_URL}/v1/coaching/refresh`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ callId: callSid }),
        },
      );

      if (!response.ok) {
        const httpError = new Error(t`Coaching refresh failed`);
        Sentry.captureException(httpError, {
          extra: {
            context: 'dialerCoachingRefreshHttp',
            callSid,
            status: response.status,
          },
        });
        throw httpError;
      }

      const payload = (await response.json()) as { data: unknown };
      if (!isValidTalkingPoints(payload.data)) {
        setTalkingPoints(null);
        return;
      }

      setTalkingPoints(payload.data);
    } catch (error: unknown) {
      Sentry.captureException(error, {
        extra: { context: 'dialerCoachingRefresh', callSid },
      });
      const message =
        error instanceof Error ? error.message : t`Failed to refresh coaching`;
      setCoachingError(message);
    } finally {
      setCoachingLoading(false);
    }
  }, [
    callSid,
    callStatus,
    setCoachingError,
    setCoachingLoading,
    setTalkingPoints,
    t,
  ]);

  useEffect(() => {
    if (
      callStatus !== 'active' ||
      typeof callSid !== 'string' ||
      callSid.length === 0
    ) {
      setCoachingLoading(false);
      setCoachingError(null);
      if (callStatus === 'idle' || callStatus === 'ended') {
        setTalkingPoints(null);
      }
      return;
    }

    if (talkingPoints === null) {
      void refresh();
    }
  }, [
    callSid,
    callStatus,
    refresh,
    setCoachingError,
    setCoachingLoading,
    setTalkingPoints,
    talkingPoints,
  ]);

  const retry = useCallback(() => {
    void refresh();
  }, [refresh]);

  return { coachingLoading, talkingPoints, coachingError, retry };
};
