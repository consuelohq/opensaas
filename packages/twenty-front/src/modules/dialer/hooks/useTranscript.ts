import { useCallback, useEffect, useRef } from 'react';
import { useRecoilValue, useSetRecoilState } from 'recoil';

import { REACT_APP_SERVER_BASE_URL } from '~/config';
import { callStateAtom } from '@/dialer/states/callStateAtom';
import {
  talkingPointsState,
  transcriptConnectedState,
  transcriptState,
} from '@/dialer/states/coachingState';
import { type TranscriptEntry } from '@/dialer/types/coaching';

const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_BASE_DELAY_MS = 1000;
const COACHING_REFRESH_INTERVAL_MS = 30_000;
const MAX_COACHING_REFRESHES = 10;

// converts http(s) base url to ws(s)
function toWsUrl(httpUrl: string): string {
  return httpUrl.replace(/^http/, 'ws');
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
  const setTalkingPoints = useSetRecoilState(talkingPointsState);
  const transcript = useRecoilValue(transcriptState);
  const isConnected = useRecoilValue(transcriptConnectedState);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttempts = useRef(0);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastRefreshTime = useRef(0);
  const refreshCount = useRef(0);
  const lastCallSid = useRef<string | null>(null);

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

      lastRefreshTime.current = now;
      refreshCount.current += 1;

      // send recent transcript to realtime coaching endpoint
      const messages = entries.slice(-20).map((entry) => ({
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
          const data = await res.json();
          setTalkingPoints(data);
        }
      } catch {
        // graceful degradation — coaching still works via initial REST fetch
      }
    },
    [setTalkingPoints],
  );

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
          setTranscript((prev) => {
            const next = [...prev, entry];
            // trigger coaching refresh check
            void refreshCoaching(next);
            return next;
          });
        } catch {
          // ignore malformed messages
        }
      };

      ws.onclose = () => {
        setConnected(false);
        wsRef.current = null;

        // reconnect if call is still active
        if (
          reconnectAttempts.current < MAX_RECONNECT_ATTEMPTS &&
          callState.status === 'active'
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
    [
      disconnect,
      setConnected,
      setTranscript,
      refreshCoaching,
      callState.status,
    ],
  );

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
      setTranscript([]);
      connect(callState.callSid);
    }
  }, [callState.status, callState.callSid, connect, setTranscript]);

  // disconnect + clear on call end
  useEffect(() => {
    if (callState.status === 'idle' || callState.status === 'ended') {
      disconnect();
      setTranscript([]);
      lastCallSid.current = null;
    }
  }, [callState.status, disconnect, setTranscript]);

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
