import { useCallback, useEffect, useRef } from 'react';
import { Device, Call } from '@twilio/voice-sdk';
import { captureException } from '@sentry/react';
import { useRecoilState, useRecoilValue, useSetRecoilState } from 'recoil';

import { REACT_APP_SERVER_BASE_URL } from '~/config';
import { useCallPersistence } from '@/dialer/hooks/useCallPersistence';
import { deviceReadyState } from '@/dialer/states/deviceReadyState';
import { deviceErrorState } from '@/dialer/states/deviceErrorState';
import { activeCallState } from '@/dialer/states/activeCallState';
import { callStateAtom } from '@/dialer/states/callStateAtom';
import { reconnectingState } from '@/dialer/states/reconnectingState';
import { callErrorState } from '@/dialer/states/callErrorState';
import { TOKEN_REFRESH_INTERVAL } from '@/dialer/constants/dialerConstants';
import { selectedMicState } from '@/dialer/states/selectedMicState';
import { selectedSpeakerState } from '@/dialer/states/selectedSpeakerState';
import type { CallStatus } from '@/dialer/types/dialer';

const EDGES: string[] = [
  'ashburn',
  'umatilla',
  'dublin',
  'sydney',
  'singapore',
];
const DEVICE_RETRY_DELAY = 5_000;

interface UseTwilioDeviceReturn {
  device: Device | null;
  isReady: boolean;
  error: string | null;
  activeCall: Call | null;
  reconnecting: boolean;
  connect: (params: { To: string; From: string }) => Promise<Call>;
  disconnect: () => void;
  refreshToken: () => Promise<void>;
}

async function fetchVoiceToken(): Promise<string> {
  try {
    const res = await fetch(`${REACT_APP_SERVER_BASE_URL}/v1/voice/token`, {
      credentials: 'include',
    });
    if (!res.ok) {
      throw new Error(`Token fetch failed: ${res.status}`);
    }
    const data = (await res.json()) as { token?: string };
    if (!data.token) {
      throw new Error('No token in response');
    }
    return data.token;
  } catch (err: unknown) {
    captureException(err, { extra: { context: 'fetchVoiceToken' } });
    throw err;
  }
}

export const useTwilioDevice = (): UseTwilioDeviceReturn => {
  const [isReady, setIsReady] = useRecoilState(deviceReadyState);
  const [error, setError] = useRecoilState(deviceErrorState);
  const [activeCall, setActiveCall] = useRecoilState(activeCallState);
  const [reconnecting, setReconnecting] = useRecoilState(reconnectingState);
  const setCallState = useSetRecoilState(callStateAtom);
  const setCallError = useSetRecoilState(callErrorState);

  const { persistCurrentCall, clearPersistence, getConferenceNameByCallSid } =
    useCallPersistence();

  const deviceRef = useRef<Device | null>(null);
  const tokenTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const statusPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const selectedMic = useRecoilValue(selectedMicState);
  const selectedSpeaker = useRecoilValue(selectedSpeakerState);

  // request mic permission — returns true if granted
  const requestMicPermission = useCallback(async (): Promise<boolean> => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop());
      return true;
    } catch (err: unknown) {
      const name = err instanceof Error ? err.name : '';
      captureException(err, {
        extra: { context: 'requestMicPermission', errorName: name },
      });
      if (name === 'NotAllowedError') {
        setError(
          'Microphone permission denied. Enable it in browser settings.',
        );
      } else if (name === 'NotFoundError') {
        setError('No microphone found. Connect a mic and try again.');
      } else {
        setError('Microphone access failed.');
      }
      return false;
    }
  }, [setError]);

  const updateCallStatus = useCallback(
    (status: CallStatus) => {
      setCallState((prev) => ({ ...prev, status }));
    },
    [setCallState],
  );

  // poll call status for failure detection (DEV-816)
  const startStatusPolling = useCallback(
    (callSid: string) => {
      if (statusPollRef.current) clearInterval(statusPollRef.current);

      statusPollRef.current = setInterval(async () => {
        try {
          const res = await fetch(
            `${REACT_APP_SERVER_BASE_URL}/v1/calls/status/${callSid}`,
            { credentials: 'include' },
          );
          if (!res.ok) return;

          const data = (await res.json()) as { status?: string };
          if (
            data.status &&
            ['failed', 'busy', 'no-answer', 'canceled'].includes(data.status)
          ) {
            const reasonMap: Record<
              string,
              'failed' | 'busy' | 'no-answer' | 'canceled'
            > = {
              failed: 'failed',
              busy: 'busy',
              'no-answer': 'no-answer',
              canceled: 'canceled',
            };
            setCallError({
              reason: reasonMap[data.status] ?? 'unknown',
              message: `Call ${data.status === 'no-answer' ? 'was not answered' : data.status}`,
              occurredAt: new Date(),
            });
            if (statusPollRef.current) clearInterval(statusPollRef.current);
          }
        } catch {
          // polling failure is non-fatal
        }
      }, 3000);
    },
    [setCallError],
  );

  const stopStatusPolling = useCallback(() => {
    if (statusPollRef.current) {
      clearInterval(statusPollRef.current);
      statusPollRef.current = null;
    }
  }, []);

  // fetch token and refresh device
  const refreshToken = useCallback(async () => {
    try {
      const token = await fetchVoiceToken();
      if (deviceRef.current) {
        deviceRef.current.updateToken(token);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Token refresh failed';
      captureException(err, { extra: { context: 'refreshToken' } });
      setError(msg);
    }
  }, [setError]);

  // wire call-level events
  const bindCallEvents = useCallback(
    (call: Call) => {
      call.on('accept', async () => {
        try {
          setActiveCall(call);
          const callSid = call.parameters?.CallSid ?? null;
          setCallState((prev) => ({
            ...prev,
            status: 'active',
            callSid,
            startedAt: new Date(),
          }));
          if (callSid) {
            startStatusPolling(callSid);
            const conferenceName = await getConferenceNameByCallSid(callSid);
            if (conferenceName) {
              const toNumber = call.parameters?.To ?? '';
              const fromNumber = call.parameters?.From ?? '';
              persistCurrentCall(callSid, conferenceName, fromNumber, toNumber);
            }
          }
        } catch (err: unknown) {
          captureException(err, { extra: { context: 'call:accept' } });
        }
      });

      const handleEnd = () => {
        setActiveCall(null);
        stopStatusPolling();
        setCallError(null);
        updateCallStatus('ended');
        clearPersistence();
      };

      call.on('disconnect', handleEnd);
      call.on('cancel', handleEnd);
      call.on('reject', handleEnd);

      call.on('error', () => {
        setActiveCall(null);
        stopStatusPolling();
        updateCallStatus('failed');
      });

      call.on('reconnecting', () => {
        setReconnecting(true);
      });

      call.on('reconnected', () => {
        setReconnecting(false);
      });
    },
    [
      setActiveCall,
      setCallState,
      setReconnecting,
      setCallError,
      updateCallStatus,
      startStatusPolling,
      stopStatusPolling,
      persistCurrentCall,
      clearPersistence,
      getConferenceNameByCallSid,
    ],
  );

  // create + register device
  const initDevice = useCallback(async () => {
    try {
      setError(null);

      const micOk = await requestMicPermission();
      if (!micOk) return;

      const token = await fetchVoiceToken();

      const dev = new Device(token, {
        edge: EDGES,
        closeProtection: true,
      });

      dev.on('registered', () => {
        setIsReady(true);
        setError(null);
      });

      dev.on('unregistered', () => {
        setIsReady(false);
      });

      dev.on('error', (deviceError) => {
        setError(deviceError.message ?? 'Device error');
        setIsReady(false);

        // null out cached device on failure (error recovery pattern)
        if (deviceRef.current) {
          deviceRef.current.destroy();
          deviceRef.current = null;
        }

        // retry after delay
        retryTimerRef.current = setTimeout(() => {
          initDevice();
        }, DEVICE_RETRY_DELAY);
      });

      dev.on('incoming', (call: Call) => {
        bindCallEvents(call);
        updateCallStatus('ringing');
      });

      dev.on('tokenWillExpire', () => {
        refreshToken();
      });

      await dev.register();
      deviceRef.current = dev;

      // schedule periodic token refresh at 50 min
      if (tokenTimerRef.current) clearInterval(tokenTimerRef.current);
      tokenTimerRef.current = setInterval(refreshToken, TOKEN_REFRESH_INTERVAL);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Device init failed';
      captureException(err, { extra: { context: 'initDevice' } });
      setError(msg);

      // null out on failure
      if (deviceRef.current) {
        deviceRef.current.destroy();
        deviceRef.current = null;
      }

      // retry
      retryTimerRef.current = setTimeout(() => {
        initDevice();
      }, DEVICE_RETRY_DELAY);
    }
  }, [
    setError,
    setIsReady,
    requestMicPermission,
    bindCallEvents,
    updateCallStatus,
    refreshToken,
  ]);

  // connect outbound call
  const connect = useCallback(
    async (params: { To: string; From: string }): Promise<Call> => {
      if (!deviceRef.current) {
        throw new Error('Device not initialized');
      }
      if (deviceRef.current.state !== Device.State.Registered) {
        throw new Error(`Device not ready (state: ${deviceRef.current.state})`);
      }

      try {
        updateCallStatus('connecting');

        const call = await deviceRef.current.connect({
          params: { To: params.To, From: params.From },
        });

        bindCallEvents(call);
        return call;
      } catch (err: unknown) {
        captureException(err, {
          extra: { context: 'connect', to: params.To, from: params.From },
        });
        updateCallStatus('failed');
        throw err;
      }
    },
    [updateCallStatus, bindCallEvents],
  );

  // disconnect active call
  const disconnect = useCallback(() => {
    if (activeCall) {
      activeCall.disconnect();
    }
  }, [activeCall]);

  // sync selected audio devices to twilio
  useEffect(() => {
    if (!deviceRef.current || !isReady || !selectedMic) return;
    deviceRef.current.audio?.setInputDevice(selectedMic).catch(() => {});
  }, [selectedMic, isReady]);

  useEffect(() => {
    if (!deviceRef.current || !isReady || !selectedSpeaker) return;
    deviceRef.current.audio?.speakerDevices
      .set(selectedSpeaker)
      .catch(() => {});
  }, [selectedSpeaker, isReady]);

  // init on mount, cleanup on unmount
  useEffect(() => {
    initDevice();

    return () => {
      if (tokenTimerRef.current) clearInterval(tokenTimerRef.current);
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
      if (statusPollRef.current) clearInterval(statusPollRef.current);
      if (deviceRef.current) {
        deviceRef.current.destroy();
        deviceRef.current = null;
      }
      setIsReady(false);
      setActiveCall(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    device: deviceRef.current,
    isReady,
    error,
    activeCall,
    reconnecting,
    connect,
    disconnect,
    refreshToken,
  };
};
