import { useCallback, useEffect, useRef } from 'react';
import { useRecoilValue, useSetRecoilState } from 'recoil';
import { captureException } from '@sentry/react';

import { REACT_APP_SERVER_BASE_URL } from '~/config';
import { authenticatedFetch } from '@/dialer/utils/authenticatedFetch';
import { callStateAtom } from '@/dialer/states/callStateAtom';
import {
  coachingErrorState,
  coachingLoadingState,
  talkingPointsState,
  transcriptState,
} from '@/dialer/states/coachingState';
import {
  type TalkingPoints,
  type TranscriptEntry,
} from '@/dialer/types/coaching';
import { type DialerContact } from '@/dialer/types/dialer';

// W3: periodic coaching refresh constants
const COACHING_REFRESH_INTERVAL_MS = 30_000;
const MAX_COACHING_REFRESHES = 10;
const MIN_NEW_WORDS_THRESHOLD = 50;

const countWords = (entries: TranscriptEntry[]): number =>
  entries.reduce((sum, entry) => sum + entry.text.split(/\s+/).filter(Boolean).length, 0);

// B6/W17: only send non-PII context — no name, phone, or email
function buildContactContext(contact: DialerContact | null): string {
  if (!contact) return 'No contact information available.';
  const parts: string[] = [];
  if (contact.company) parts.push(`Company: ${contact.company}`);
  if (contact.tags?.length) parts.push(`Tags: ${contact.tags.join(', ')}`);
  return parts.length > 0
    ? parts.join('\n')
    : 'Contact information available (details redacted).';
}

function isValidTalkingPoints(data: unknown): data is TalkingPoints {
  if (!data || typeof data !== 'object') return false;
  const obj = data as Record<string, unknown>;
  return (
    Array.isArray(obj.details) &&
    (obj.clarifying_questions === null ||
      obj.clarifying_questions === undefined ||
      Array.isArray(obj.clarifying_questions))
  );
}

interface UseCoachingReturn {
  isLoading: boolean;
  talkingPoints: TalkingPoints | null;
  error: string | null;
  retry: () => void;
}

export const useCoaching = (): UseCoachingReturn => {
  const callState = useRecoilValue(callStateAtom);
  const transcript = useRecoilValue(transcriptState);
  const setLoading = useSetRecoilState(coachingLoadingState);
  const setTalkingPoints = useSetRecoilState(talkingPointsState);
  const setError = useSetRecoilState(coachingErrorState);
  const isLoading = useRecoilValue(coachingLoadingState);
  const talkingPoints = useRecoilValue(talkingPointsState);
  const error = useRecoilValue(coachingErrorState);

  const cache = useRef<Map<string, TalkingPoints>>(new Map());
  const lastCallSid = useRef<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // W3: periodic refresh tracking
  const refreshCount = useRef(0);
  const lastRefreshTime = useRef(0);
  const lastRefreshWordCount = useRef(0);
  const lastRefreshIndex = useRef(0);

  const fetchCoaching = useCallback(
    async (callSid: string, contact: DialerContact | null) => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      abortControllerRef.current = new AbortController();

      const cached = cache.current.get(callSid);
      if (cached) {
        setTalkingPoints(cached);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const res = await authenticatedFetch(
          `${REACT_APP_SERVER_BASE_URL}/v1/coaching`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: abortControllerRef.current.signal,
            body: JSON.stringify({
              messages: [
                {
                  role: 'system',
                  content: `CONTEXT: ${buildContactContext(contact)}`,
                },
              ],
            }),
          },
        );

        if (!res.ok) {
          throw new Error(`Coaching API error: ${res.status}`);
        }

        const json = (await res.json()) as { data: unknown };
        const data = json.data;

        if (!isValidTalkingPoints(data)) {
          throw new Error('Invalid coaching response format');
        }

        cache.current.set(callSid, data);
        setTalkingPoints(data);
      } catch (err: unknown) {
        if (err instanceof Error && err.name === 'AbortError') return;
        captureException(err, { extra: { context: 'fetchCoaching', callSid } });
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

  // W3: periodic coaching refresh with transcript delta
  const refreshCoaching = useCallback(
    async (callSid: string, delta: TranscriptEntry[]) => {
      if (refreshCount.current >= MAX_COACHING_REFRESHES) return;

      const messages = delta.map((entry) => ({
        role: entry.speaker === 'agent' ? 'sales_rep' : 'customer',
        content: entry.text,
      }));

      try {
        const res = await authenticatedFetch(
          `${REACT_APP_SERVER_BASE_URL}/v1/coaching/realtime`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ messages }),
          },
        );
        if (res.ok) {
          // W10: unwrap { data } response from backend
          const json = (await res.json()) as { data: unknown };
          const data = json.data;
          if (isValidTalkingPoints(data)) {
            setTalkingPoints(data);
          }
        }
      } catch (error: unknown) {
        captureException(error);
        // graceful degradation — coaching still works via initial REST fetch
      }
    },
    [setTalkingPoints],
  );

  // W3: interval-based refresh effect
  useEffect(() => {
    if (callState.status !== 'active' || !callState.callSid) return;

    const interval = setInterval(() => {
      if (refreshCount.current >= MAX_COACHING_REFRESHES) return;

      const currentWordCount = countWords(transcript);
      if (
        currentWordCount - lastRefreshWordCount.current <
        MIN_NEW_WORDS_THRESHOLD
      )
        return;

      // W7: send only delta (new entries since last refresh)
      const delta = transcript.slice(lastRefreshIndex.current);
      if (delta.length === 0) return;

      // callSid is guaranteed non-null by the guard at the top of this effect
      void refreshCoaching(callState.callSid as string, delta);

      refreshCount.current += 1;
      lastRefreshTime.current = Date.now();
      lastRefreshWordCount.current = currentWordCount;
      lastRefreshIndex.current = transcript.length;
    }, COACHING_REFRESH_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [callState.status, callState.callSid, transcript, refreshCoaching]);

  // clear state when call ends or goes idle — also clear cache (N8)
  useEffect(() => {
    if (callState.status === 'idle' || callState.status === 'ended') {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
      setTalkingPoints(null);
      setError(null);
      setLoading(false);
      lastCallSid.current = null;
      cache.current.clear();
      // W3: reset refresh tracking
      refreshCount.current = 0;
      lastRefreshTime.current = 0;
      lastRefreshWordCount.current = 0;
      lastRefreshIndex.current = 0;
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
