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

// B6/W17: only send non-PII context — no name, phone, or email
function buildContactContext(contact: DialerContact | null): string {
  if (!contact) return 'No contact information available.';
  const parts: string[] = [];
  if (contact.company) parts.push(`Company: ${contact.company}`);
  if (contact.tags?.length) parts.push(`Tags: ${contact.tags.join(', ')}`);
  return parts.length > 0 ? parts.join('\n') : 'Contact information available (details redacted).';
}

// W16: basic runtime validation for TalkingPoints shape
function isValidTalkingPoints(data: unknown): data is TalkingPoints {
  if (!data || typeof data !== 'object') return false;
  const obj = data as Record<string, unknown>;
  return Array.isArray(obj.details) && Array.isArray(obj.clarifying_questions) && Array.isArray(obj.objection_responses);
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

        // W10: unwrap { data } from backend response
        const json = (await res.json()) as { data: unknown };
        const data = json.data;

        // W16: validate LLM response shape
        if (!isValidTalkingPoints(data)) {
          throw new Error('Invalid coaching response format');
        }

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

  // clear state when call ends or goes idle — also clear cache (N8)
  useEffect(() => {
    if (callState.status === 'idle' || callState.status === 'ended') {
      setTalkingPoints(null);
      setError(null);
      setLoading(false);
      lastCallSid.current = null;
      cache.current.clear();
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
