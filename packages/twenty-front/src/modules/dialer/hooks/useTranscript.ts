import { useCallback, useEffect } from 'react';
import { useLingui } from '@lingui/react/macro';
import { captureException } from '@sentry/react';
import { useRecoilValue, useSetRecoilState } from 'recoil';

import { REACT_APP_SERVER_BASE_URL } from '~/config';
import { usePostCallAnalysis } from '@/dialer/hooks/usePostCallAnalysis';
import { cookieStorage } from '~/utils/cookie-storage';
import { callStateAtom } from '@/dialer/states/callStateAtom';
import {
  coachingErrorState,
  coachingLoadingState,
  talkingPointsState,
  transcriptConnectedState,
  transcriptErrorState,
  transcriptState,
} from '@/dialer/states/coachingState';
import {
  type CoachingStreamMessage,
  type TalkingPoints,
  type TranscriptEntry,
} from '@/dialer/types/coaching';
import { type CallStatus } from '@/dialer/types/dialer';

const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_BASE_DELAY_MS = 1000;

type TranscriptSocketState = {
  socket: WebSocket | null;
  reconnectAttempts: number;
  reconnectTimer: ReturnType<typeof setTimeout> | null;
  lastCallSid: string | null;
  callStatus: CallStatus;
};

const transcriptSocketState: TranscriptSocketState = {
  socket: null,
  reconnectAttempts: 0,
  reconnectTimer: null,
  lastCallSid: null,
  callStatus: 'idle',
};

const getAuthToken = (): string | null => {
  try {
    const tokenPairStr = cookieStorage.getItem('tokenPair');
    if (tokenPairStr === null) return null;
    const tokenPair = JSON.parse(tokenPairStr ?? '{}') as {
      accessOrWorkspaceAgnosticToken?: { token: string };
    };

    return tokenPair.accessOrWorkspaceAgnosticToken?.token ?? null;
  } catch {
    return null;
  }
};

const toWsUrl = (httpUrl: string): string => httpUrl.replace(/^http/, 'ws');

const isTranscriptEntry = (value: unknown): value is TranscriptEntry => {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const entry = value as Record<string, unknown>;

  return (
    typeof entry.id === 'string' &&
    (entry.speaker === 'agent' || entry.speaker === 'customer') &&
    typeof entry.text === 'string' &&
    typeof entry.timestamp === 'number' &&
    typeof entry.confidence === 'number'
  );
};

const isTalkingPoints = (value: unknown): value is TalkingPoints => {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const talkingPoints = value as Record<string, unknown>;

  return (
    (typeof talkingPoints.product_or_option_name === 'string' ||
      talkingPoints.product_or_option_name === null ||
      talkingPoints.product_or_option_name === undefined) &&
    Array.isArray(talkingPoints.details) &&
    talkingPoints.details.every((entry) => typeof entry === 'string') &&
    Array.isArray(talkingPoints.clarifying_questions) &&
    talkingPoints.clarifying_questions.every(
      (entry) => typeof entry === 'string',
    ) &&
    Array.isArray(talkingPoints.objection_responses) &&
    talkingPoints.objection_responses.every(
      (entry) =>
        typeof entry === 'object' &&
        entry !== null &&
        typeof (entry as { objection?: unknown }).objection === 'string' &&
        typeof (entry as { response?: unknown }).response === 'string',
    )
  );
};

const isCoachingStreamMessage = (
  value: unknown,
): value is CoachingStreamMessage => {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const message = value as Record<string, unknown>;

  if (message.type === 'transcript') {
    return isTranscriptEntry(message.entry);
  }

  if (message.type === 'coaching') {
    return isTalkingPoints(message.talkingPoints);
  }

  if (message.type === 'coaching_error') {
    return typeof message.message === 'string';
  }

  if (message.type === 'snapshot') {
    return (
      Array.isArray(message.entries) &&
      message.entries.every((entry) => isTranscriptEntry(entry)) &&
      (message.talkingPoints === null ||
        message.talkingPoints === undefined ||
        isTalkingPoints(message.talkingPoints))
    );
  }

  return false;
};

const clearReconnectTimer = (): void => {
  if (transcriptSocketState.reconnectTimer === null) {
    return;
  }

  clearTimeout(transcriptSocketState.reconnectTimer);
  transcriptSocketState.reconnectTimer = null;
};

interface UseTranscriptReturn {
  transcript: TranscriptEntry[];
  transcriptConnected: boolean;
  connect: (callId: string) => void;
  disconnect: () => void;
}

export const useTranscript = (): UseTranscriptReturn => {
  usePostCallAnalysis();
  const { t } = useLingui();
  const { status: callStatus, callSid } = useRecoilValue(callStateAtom);
  const transcript = useRecoilValue(transcriptState);
  const transcriptConnected = useRecoilValue(transcriptConnectedState);
  const setTranscript = useSetRecoilState(transcriptState);
  const setTranscriptConnected = useSetRecoilState(transcriptConnectedState);
  const setTranscriptError = useSetRecoilState(transcriptErrorState);
  const setTalkingPoints = useSetRecoilState(talkingPointsState);
  const setCoachingLoading = useSetRecoilState(coachingLoadingState);
  const setCoachingError = useSetRecoilState(coachingErrorState);

  useEffect(() => {
    transcriptSocketState.callStatus = callStatus;
  }, [callStatus]);

  const disconnect = useCallback(() => {
    clearReconnectTimer();
    transcriptSocketState.reconnectAttempts = 0;
    if (transcriptSocketState.socket !== null) {
      transcriptSocketState.socket.close();
      transcriptSocketState.socket = null;
    }
    setTranscriptConnected(false);
  }, [setTranscriptConnected]);

  const connect = useCallback(
    (nextCallSid: string) => {
      disconnect();
      setTranscriptError(null);
      setCoachingError(null);
      setCoachingLoading(true);

      const token = getAuthToken();
      const baseUrl = `${toWsUrl(REACT_APP_SERVER_BASE_URL)}/v1/coaching/stream?callId=${encodeURIComponent(nextCallSid)}`;
      const wsUrl =
        token !== null
          ? `${baseUrl}&token=${encodeURIComponent(token)}`
          : baseUrl;
      const socket = new WebSocket(wsUrl);
      const currentSocket = socket;
      transcriptSocketState.socket = currentSocket;

      currentSocket.onopen = () => {
        if (transcriptSocketState.socket !== currentSocket) {
          return;
        }
        setTranscriptConnected(true);
        transcriptSocketState.reconnectAttempts = 0;
      };

      currentSocket.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data as string) as unknown;
          if (!isCoachingStreamMessage(parsed)) {
            return;
          }

          if (parsed.type === 'snapshot') {
            setTranscript(parsed.entries);
            setTalkingPoints(parsed.talkingPoints ?? null);
            setCoachingLoading(false);
            return;
          }

          if (parsed.type === 'transcript') {
            setTranscript((previousTranscript) => [
              ...previousTranscript,
              parsed.entry,
            ]);
            return;
          }

          if (parsed.type === 'coaching_error') {
            setCoachingError(parsed.message);
            setCoachingLoading(false);
            return;
          }

          setCoachingError(null);
          setTalkingPoints(parsed.talkingPoints);
          setCoachingLoading(false);
        } catch (error: unknown) {
          captureException(error, {
            extra: { context: 'dialerTranscriptWsMessage' },
          });
        }
      };

      currentSocket.onclose = () => {
        if (transcriptSocketState.socket !== currentSocket) {
          return;
        }

        setTranscriptConnected(false);
        transcriptSocketState.socket = null;

        if (
          transcriptSocketState.reconnectAttempts < MAX_RECONNECT_ATTEMPTS &&
          transcriptSocketState.callStatus === 'active'
        ) {
          const jitter = 0.5 + Math.random();
          const delay =
            RECONNECT_BASE_DELAY_MS *
            Math.pow(transcriptSocketState.reconnectAttempts + 1, 2) *
            jitter;
          transcriptSocketState.reconnectAttempts += 1;
          transcriptSocketState.reconnectTimer = setTimeout(() => {
            connect(nextCallSid);
          }, delay);
        }
      };

      currentSocket.onerror = () => {
        if (transcriptSocketState.socket !== currentSocket) {
          return;
        }
        setTranscriptError(t`WebSocket connection failed`);
        setCoachingLoading(false);
      };
    },
    [
      disconnect,
      setCoachingError,
      setCoachingLoading,
      setTalkingPoints,
      setTranscript,
      setTranscriptConnected,
      setTranscriptError,
      t,
    ],
  );

  useEffect(() => {
    if (
      callStatus === 'active' &&
      typeof callSid === 'string' &&
      callSid.length > 0 &&
      callSid !== transcriptSocketState.lastCallSid
    ) {
      transcriptSocketState.lastCallSid = callSid;
      setTranscript([]);
      setTalkingPoints(null);
      connect(callSid);
    }
  }, [callSid, callStatus, connect, setTalkingPoints, setTranscript]);

  useEffect(() => {
    if (callStatus === 'idle' || callStatus === 'ended') {
      disconnect();
      setTranscript([]);
      setTranscriptError(null);
      setCoachingError(null);
      setTalkingPoints(null);
      setCoachingLoading(false);
      transcriptSocketState.lastCallSid = null;
    }
  }, [
    callStatus,
    disconnect,
    setCoachingError,
    setCoachingLoading,
    setTalkingPoints,
    setTranscript,
    setTranscriptError,
  ]);

  useEffect(() => {
    return () => {
      clearReconnectTimer();
      if (transcriptSocketState.socket !== null) {
        transcriptSocketState.socket.close();
        transcriptSocketState.socket = null;
      }
    };
  }, []);

  return { transcript, transcriptConnected, connect, disconnect };
};
