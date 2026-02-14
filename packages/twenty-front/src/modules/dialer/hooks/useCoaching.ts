import { useCallback, useEffect, useRef } from 'react';
import { useRecoilValue, useSetRecoilState } from 'recoil';

import { REACT_APP_SERVER_BASE_URL } from '~/config';
import { callStateAtom } from '@/dialer/states/callStateAtom';
import {
  coachingErrorState,
  coachingLoadingState,
  talkingPointsState,
} from '@/dialer/states/coachingState';
import { type TalkingPoints } from '@/dialer/types/coaching';
import { type DialerContact } from '@/dialer/types/dialer';

// builds a context message from contact info so the AI has something to work with
function buildContactContext(contact: DialerContact | null): string {
  if (!contact) return 'No contact information available.';
  const parts = [`Contact: ${contact.name ?? 'Unknown'}`];
  if (contact.company) parts.push(`Company: ${contact.company}`);
  if (contact.email) parts.push(`Email: ${contact.email}`);
  if (contact.phone) parts.push(`Phone: ${contact.phone}`);
  return parts.join('\n');
}

interface UseCoachingReturn {
  isLoading: boolean;
  talkingPoints: TalkingPoints | null;
  error: string | null;
  retry: () => void;
}

export const useCoaching = (): UseCoachingReturn => {
  const callState = useRecoilValue(callStateAtom);
  const setLoading = useSetRecoilState(coachingLoadingState);
  const setTalkingPoints = useSetRecoilState(talkingPointsState);
  const setError = useSetRecoilState(coachingErrorState);
  const isLoading = useRecoilValue(coachingLoadingState);
  const talkingPoints = useRecoilValue(talkingPointsState);
  const error = useRecoilValue(coachingErrorState);

  const cache = useRef<Map<string, TalkingPoints>>(new Map());
  const lastCallSid = useRef<string | null>(null);

  const fetchCoaching = useCallback(
    async (callSid: string, contact: DialerContact | null) => {
      const cached = cache.current.get(callSid);
      if (cached) {
        setTalkingPoints(cached);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const res = await fetch(`${REACT_APP_SERVER_BASE_URL}/v1/coaching`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: [
              { role: 'sales_rep', content: buildContactContext(contact) },
            ],
          }),
        });

        if (!res.ok) {
          throw new Error(`Coaching API error: ${res.status}`);
        }

        const data = (await res.json()) as TalkingPoints;
        cache.current.set(callSid, data);
        setTalkingPoints(data);
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : 'Failed to fetch coaching';
        setError(message);
      } finally {
        setLoading(false);
      }
    },
    [setLoading, setTalkingPoints, setError],
  );

  // auto-fetch when call becomes active
  useEffect(() => {
    if (
      callState.status === 'active' &&
      callState.callSid &&
      callState.callSid !== lastCallSid.current
    ) {
      lastCallSid.current = callState.callSid;
      void fetchCoaching(callState.callSid, callState.contact);
    }
  }, [callState.status, callState.callSid, callState.contact, fetchCoaching]);

  // clear state when call ends or goes idle
  useEffect(() => {
    if (callState.status === 'idle' || callState.status === 'ended') {
      setTalkingPoints(null);
      setError(null);
      setLoading(false);
      lastCallSid.current = null;
    }
  }, [callState.status, setTalkingPoints, setError, setLoading]);

  const retry = useCallback(() => {
    if (callState.callSid && callState.status === 'active') {
      cache.current.delete(callState.callSid);
      void fetchCoaching(callState.callSid, callState.contact);
    }
  }, [callState.callSid, callState.status, callState.contact, fetchCoaching]);

  return { isLoading, talkingPoints, error, retry };
};
