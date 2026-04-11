import { useCallback, useEffect, useRef } from 'react';
import { Device, type Call } from '@twilio/voice-sdk';
import { captureException } from '@sentry/react';
import { useRecoilState, useRecoilValue, useSetRecoilState } from 'recoil';
import { t } from '@lingui/core/macro';

import { REACT_APP_SERVER_BASE_URL } from '~/config';
import { authenticatedFetch } from '@/dialer/utils/authenticatedFetch';
import { useCallPersistence } from '@/dialer/hooks/useCallPersistence';
import { deviceReadyState } from '@/dialer/states/deviceReadyState';
import { deviceErrorState } from '@/dialer/states/deviceErrorState';
import { activeCallState } from '@/dialer/states/activeCallState';
import { callStateAtom } from '@/dialer/states/callStateAtom';
import { reconnectingState } from '@/dialer/states/reconnectingState';
import { callErrorState } from '@/dialer/states/callErrorState';
import { twilioConfigStatusState } from '@/dialer/states/twilioConfigStatusState';
import { TOKEN_REFRESH_INTERVAL } from '@/dialer/constants/dialerConstants';
import { selectedMicState } from '@/dialer/states/selectedMicState';
import { selectedSpeakerState } from '@/dialer/states/selectedSpeakerState';
import type { CallStatus } from '@/dialer/types/dialer';
import {
  playCallConnectedSound,
  playCallEndSound,
  playDialingStartedSound,
  playErrorSound,
  playIncomingCallSound,
  startRingbackTone,
  stopRingbackTone,
} from '@/dialer/utils/notificationSounds';

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
  deviceReady: boolean;
  deviceError: string | null;
  activeCall: Call | null;
  reconnecting: boolean;
  connect: (params: { To: string; From: string }) => Promise<Call>;
  disconnect: () => void;
  refreshToken: () => Promise<void>;
}

const fetchVoiceToken = async (): Promise<string> => {
  try {
    const res = await authenticatedFetch(
      `${REACT_APP_SERVER_BASE_URL}/v1/voice/token`,
    );
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
};

export const useTwilioDevice = (): UseTwilioDeviceReturn => {
  const [deviceReady, setDeviceReady] = useRecoilState(deviceReadyState);
  const [deviceError, setDeviceError] = useRecoilState(deviceErrorState);
  const [activeCall, setActiveCall] = useRecoilState(activeCallState);
  const [reconnecting, setReconnecting] = useRecoilState(reconnectingState);
  const setCallState = useSetRecoilState(callStateAtom);
  const setCallError = useSetRecoilState(callErrorState);
  const twilioConfigStatus = useRecoilValue(twilioConfigStatusState);

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
        setDeviceError(
          t`Microphone permission denied. Enable it in browser settings.`,
        );
      } else if (name === 'NotFoundError') {
        setDeviceError(t`No microphone found. Connect a mic and try again.`);
      } else {
        setDeviceError(t`Microphone access failed.`);
      }
      return false;
    }
  }, [setDeviceError]);

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
          const res = await authenticatedFetch(
            `${REACT_APP_SERVER_BASE_URL}/v1/calls/status/${callSid}`,
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
              message: t`Call ${data.status === 'no-answer' ? 'was not answered' : data.status}`,
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
      setDeviceError(msg);
    }
  }, [setDeviceError]);

  // wire call-level events
  const bindCallEvents = useCallback(
    (call: Call) => {
      call.on('accept', async () => {
        try {
          stopRingbackTone();
          call.mute(false);
          playCallConnectedSound();
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
        stopRingbackTone();
        playCallEndSound();
        setActiveCall(null);
        stopStatusPolling();
        setCallError(null);
        updateCallStatus('ended');
        clearPersistence();
      };

      call.on('disconnect', handleEnd);
      call.on('cancel', handleEnd);
      call.on('reject', handleEnd);

      call.on('deviceError', () => {
        stopRingbackTone();
        playErrorSound();
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
      setDeviceError(null);

      const token = await fetchVoiceToken();

      const dev = new Device(token, {
        edge: EDGES,
        closeProtection: true,
      });

      // disable Twilio's default sounds — we play our own via notificationSounds.ts
      dev.audio?.incoming(false);
      dev.audio?.outgoing(false);
      dev.audio?.disconnect(false);

      dev.on('registered', () => {
        setDeviceReady(true);
        setDeviceError(null);
      });

      dev.on('unregistered', () => {
        setDeviceReady(false);
      });

      dev.on('error', (deviceError) => {
        setDeviceError(deviceError.message ?? 'Device error');
        setDeviceReady(false);

        // null out cached device on failure (deviceError recovery pattern)
        if (deviceRef.current) {
          deviceRef.current.destroy();
          deviceRef.current = null;
        }

        // only retry on transient errors, not permission/auth failures
        const isTransient =
          deviceError.code !== 31401 && deviceError.code !== 31000;
        if (isTransient) {
          if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
          retryTimerRef.current = setTimeout(() => {
            initDevice();
          }, DEVICE_RETRY_DELAY);
        }
      });

      dev.on('incoming', (call: Call) => {
        playIncomingCallSound();
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
      setDeviceError(msg);

      // null out on failure
      if (deviceRef.current) {
        deviceRef.current.destroy();
        deviceRef.current = null;
      }

      // only retry on transient errors, not permission/auth failures
      const errorMessage = err instanceof Error ? err.message : '';
      const normalizedErrorMessage = errorMessage.toLowerCase();
      
      // parse HTTP status from "Token fetch failed: <status>" pattern
      const statusMatch = errorMessage.match(/Token fetch failed:\s*(\d+)/);
      const parsedStatus = statusMatch ? parseInt(statusMatch[1], 10) : null;
      
      const isNonTransient =
        (err instanceof Error && err.name === 'NotAllowedError') ||
        parsedStatus === 401 ||
        parsedStatus === 403 ||
        normalizedErrorMessage.includes('401') ||
        normalizedErrorMessage.includes('403') ||
        normalizedErrorMessage.includes('token expired') ||
        normalizedErrorMessage.includes('expired token') ||
        normalizedErrorMessage.includes('unauthorized');
      if (!isNonTransient) {
        if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
        retryTimerRef.current = setTimeout(() => {
          initDevice();
        }, DEVICE_RETRY_DELAY);
      }
    }
  }, [
    setDeviceError,
    setDeviceReady,
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

      // request mic permission just before connecting
      const micOk = await requestMicPermission();
      if (!micOk) {
        updateCallStatus('failed');
        setDeviceError(t`Microphone permission required to make calls`);
        throw new Error('Microphone permission denied');
      }

      try {
        setCallState((previousCallState) => ({
          ...previousCallState,
          fromNumber: params.From,
        }));
        updateCallStatus('connecting');
        playDialingStartedSound();

        const call = await deviceRef.current.connect({
          params: { To: params.To, From: params.From },
        });

        // mute carrier ringback and play our bell tone instead
        call.mute(true);
        startRingbackTone();

        bindCallEvents(call);
        return call;
      } catch (err: unknown) {
        captureException(err, {
          extra: { context: 'connect', to: params.To, from: params.From },
        });
        stopRingbackTone();
        updateCallStatus('failed');
        throw err;
      }
    },
    [
      updateCallStatus,
      bindCallEvents,
      requestMicPermission,
      setCallState,
      setDeviceError,
    ],
  );

  // disconnect active call
  const disconnect = useCallback(() => {
    if (activeCall) {
      activeCall.disconnect();
    }
  }, [activeCall]);

  // sync selected audio devices to twilio
  useEffect(() => {
    if (!deviceRef.current || !deviceReady || !selectedMic) return;
    deviceRef.current.audio
      ?.setInputDevice(selectedMic)
      .catch((err: unknown) => {
        captureException(err, {
          extra: { context: 'setInputDevice', deviceId: selectedMic },
        });
      });
  }, [selectedMic, deviceReady]);

  useEffect(() => {
    if (!deviceRef.current || !deviceReady || !selectedSpeaker) return;
    deviceRef.current.audio?.speakerDevices
      .set(selectedSpeaker)
      .catch((err: unknown) => {
        captureException(err, {
          extra: { context: 'setSpeakerDevice', deviceId: selectedSpeaker },
        });
      });
  }, [selectedSpeaker, deviceReady]);

  // init on mount, cleanup on unmount — only when configured
  useEffect(() => {
    // skip device init until config status is loaded and shows configured
    if (!twilioConfigStatus?.configured) return;

    initDevice();

    return () => {
      if (tokenTimerRef.current) clearInterval(tokenTimerRef.current);
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
      if (statusPollRef.current) clearInterval(statusPollRef.current);
      if (deviceRef.current) {
        deviceRef.current.destroy();
        deviceRef.current = null;
      }
      setDeviceReady(false);
      setActiveCall(null);
    };
  }, [
    twilioConfigStatus?.configured,
    initDevice,
    setActiveCall,
    setDeviceReady,
  ]);

  return {
    device: deviceRef.current,
    deviceReady,
    deviceError,
    activeCall,
    reconnecting,
    connect,
    disconnect,
    refreshToken,
  };
};

export default useTwilioDevice;
