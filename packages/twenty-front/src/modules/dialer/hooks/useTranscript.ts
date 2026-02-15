import { useCallback, useEffect, useRef } from 'react';
import { useRecoilValue, useSetRecoilState } from 'recoil';

import { REACT_APP_SERVER_BASE_URL } from '~/config';
import { callStateAtom } from '@/dialer/states/callStateAtom';
import {
  talkingPointsState,
  transcriptConnectedState,
  transcriptErrorState,
  transcriptState,
} from '@/dialer/states/coachingState';
import { type TranscriptEntry } from '@/dialer/types/coaching';

const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_BASE_DELAY_MS = 1000;
const COACHING_REFRESH_INTERVAL_MS = 30_000;
const MAX_COACHING_REFRESHES = 10;
// W3: minimum new words before triggering a coaching refresh
const MIN_NEW_WORDS_THRESHOLD = 50;

// converts http(s) base url to ws(s)
function toWsUrl(httpUrl: string): string {
  return httpUrl.replace(/^http/, 'ws');
}

// W3: count words in transcript entries
function countWords(entries: TranscriptEntry[]): number {
  return entries.reduce((sum, e) => sum + e.text.split(' ').length, 0);
}

interface UseTranscriptReturn {
  transcript: TranscriptEntry[];
  isConnected: boolean;
  connect: (callId: string) => void;
  disconnect: () => void;
}

export const useTranscript = (): UseTranscriptReturn => {
  const callState = useRecoilValue(callStateAtom);
  const setTranscript = useSetRecoilState(transcriptState);
  const setConnected = useSetRecoilState(transcriptConnectedState);
  const setTranscriptError = useSetRecoilState(transcriptErrorState);
  const setTalkingPoints = useSetRecoilState(talkingPointsState);
  const transcript = useRecoilValue(transcriptState);
  const isConnected = useRecoilValue(transcriptConnectedState);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttempts = useRef(0);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastRefreshTime = useRef(0);
  const refreshCount = useRef(0);
  const lastCallSid = useRef<string | null>(null);
  // W7: track last sent index for delta-only refreshes
  const lastRefreshIndex = useRef(0);
  // W3: track word count at last refresh
  const lastRefreshWordCount = useRef(0);
  // W14: ref for callState.status to avoid stale closure in ws.onclose
  const callStatusRef = useRef(callState.status);

  // W14: keep ref in sync with current status
  useEffect(() => {
    callStatusRef.current = callState.status;
  }, [callState.status]);

  const clearReconnectTimer = useCallback(() => {
    if (reconnectTimer.current) {
      clearTimeout(reconnectTimer.current);
      reconnectTimer.current = null;
    }
  }, []);

  const disconnect = useCallback(() => {
    clearReconnectTimer();
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setConnected(false);
  }, [clearReconnectTimer, setConnected]);

  // refresh coaching with transcript context
  const refreshCoaching = useCallback(
    async (entries: TranscriptEntry[]) => {
      if (refreshCount.current >= MAX_COACHING_REFRESHES) return;
      const now = Date.now();
      if (now - lastRefreshTime.current < COACHING_REFRESH_INTERVAL_MS) return;

      // W3: skip if transcript hasn't grown enough since last refresh
      const currentWordCount = countWords(entries);
      if (currentWordCount - lastRefreshWordCount.current < MIN_NEW_WORDS_THRESHOLD) return;

      lastRefreshTime.current = now;
      refreshCount.current += 1;
      lastRefreshWordCount.current = currentWordCount;

      // W7: send only delta (new entries since last refresh)
      const delta = entries.slice(lastRefreshIndex.current);
      lastRefreshIndex.current = entries.length;

      if (delta.length === 0) return;

      const messages = delta.map((entry) => ({
        role: entry.speaker === 'agent' ? 'sales_rep' : 'customer',
        content: entry.text,
      }));

      try {
        const res = await fetch(
          `${REACT_APP_SERVER_BASE_URL}/v1/coaching/realtime`,
          {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ messages }),
          },
        );
        if (res.ok) {
          // W10: unwrap { data } response from backend
          const json = (await res.json()) as { data: unknown };
          setTalkingPoints(json.data as Parameters<typeof setTalkingPoints>[0]);
        }
      } catch {
        // graceful degradation — coaching still works via initial REST fetch
      }
    },
    [setTalkingPoints],
  );

  // W15: pending entry ref to trigger coaching refresh outside state updater
  const pendingEntryRef = useRef<TranscriptEntry | null>(null);

  const connect = useCallback(
    (callId: string) => {
      disconnect();
      reconnectAttempts.current = 0;

      const wsUrl = `${toWsUrl(REACT_APP_SERVER_BASE_URL)}/v1/coaching/stream?callId=${encodeURIComponent(callId)}`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setConnected(true);
        reconnectAttempts.current = 0;
      };

      ws.onmessage = (event) => {
        try {
          const entry = JSON.parse(event.data as string) as TranscriptEntry;
          // W15: pure state updater — no side effects inside
          setTranscript((prev) => [...prev, entry]);
          // store pending entry so useEffect can trigger refresh
          pendingEntryRef.current = entry;
        } catch {
          // ignore malformed messages
        }
      };

      ws.onclose = () => {
        setConnected(false);
        wsRef.current = null;

        // W14: use ref instead of closure-captured callState.status
        if (
          reconnectAttempts.current < MAX_RECONNECT_ATTEMPTS &&
          callStatusRef.current === 'active'
        ) {
          const delay =
            RECONNECT_BASE_DELAY_MS *
            Math.pow(2, reconnectAttempts.current);
          reconnectAttempts.current += 1;
          reconnectTimer.current = setTimeout(() => connect(callId), delay);
        }
      };

      ws.onerror = () => {
        // onclose fires after onerror — reconnect handled there
      };
    },
    [disconnect, setConnected, setTranscript],
  );

  // W15: trigger coaching refresh outside state updater, watching transcript length
  useEffect(() => {
    if (transcript.length > 0 && pendingEntryRef.current) {
      pendingEntryRef.current = null;
      void refreshCoaching(transcript);
    }
  }, [transcript, refreshCoaching]);

  // auto-connect when call becomes active
  useEffect(() => {
    if (
      callState.status === 'active' &&
      callState.callSid &&
      callState.callSid !== lastCallSid.current
    ) {
      lastCallSid.current = callState.callSid;
      refreshCount.current = 0;
      lastRefreshTime.current = 0;
      lastRefreshIndex.current = 0;
      lastRefreshWordCount.current = 0;
      setTranscript([]);
      connect(callState.callSid);
    }
  }, [callState.status, callState.callSid, connect, setTranscript]);

  // disconnect + clear on call end
  useEffect(() => {
    if (callState.status === 'idle' || callState.status === 'ended') {
      disconnect();
      setTranscript([]);
      setTranscriptError(null);
      lastCallSid.current = null;
    }
  }, [callState.status, disconnect, setTranscript, setTranscriptError]);

  // cleanup on unmount
  useEffect(() => {
    return () => {
      clearReconnectTimer();
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [clearReconnectTimer]);

  return { transcript, isConnected, connect, disconnect };
};
