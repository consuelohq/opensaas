import { useCallback, useEffect } from 'react';
import { captureException } from '@sentry/react';
import { useSetRecoilState } from 'recoil';

import { REACT_APP_SERVER_BASE_URL } from '~/config';
import {
  clearPersistedCallState,
  getPersistedCallState,
  persistCallState,
  type PersistedCallState,
} from '@/dialer/utils/callPersistence';
import { reconnectPromptState } from '@/dialer/states/reconnectPromptState';

type ReconnectPrompt = {
  visible: boolean;
  conferenceName: string;
  callSid: string;
};

export const useCallPersistence = () => {
  const setReconnectPrompt = useSetRecoilState(reconnectPromptState);

  const checkAndPromptReconnect = useCallback(async () => {
    const persisted = getPersistedCallState();
    if (!persisted) return;

    try {
      const res = await fetch(
        `${REACT_APP_SERVER_BASE_URL}/v1/voice/active-call?conferenceName=${encodeURIComponent(persisted.conferenceName)}`,
        { credentials: 'include' },
      );

      if (!res.ok) {
        clearPersistedCallState();
        return;
      }

      const data = (await res.json()) as {
        active?: boolean;
        conferenceSid?: string;
      };

      if (data.active && data.conferenceSid) {
        const prompt: ReconnectPrompt = {
          visible: true,
          conferenceName: persisted.conferenceName,
          callSid: persisted.callSid,
        };
        setReconnectPrompt(prompt);
      } else {
        clearPersistedCallState();
      }
    } catch (err: unknown) {
      captureException(err, { extra: { context: 'checkAndPromptReconnect' } });
      clearPersistedCallState();
    }
  }, [setReconnectPrompt]);

  useEffect(() => {
    checkAndPromptReconnect();
  }, [checkAndPromptReconnect]);

  const persistCurrentCall = useCallback(
    (
      callSid: string,
      conferenceName: string,
      fromNumber: string,
      toNumber: string,
    ) => {
      const state: PersistedCallState = {
        callSid,
        conferenceName,
        fromNumber,
        toNumber,
        timestamp: Date.now(),
      };
      persistCallState(state);
    },
    [],
  );

  const clearPersistence = useCallback(() => {
    clearPersistedCallState();
  }, []);

  const getConferenceNameByCallSid = useCallback(
    async (callSid: string): Promise<string | null> => {
      try {
        const res = await fetch(
          `${REACT_APP_SERVER_BASE_URL}/v1/voice/conference-by-call/${encodeURIComponent(callSid)}`,
          { credentials: 'include' },
        );

        if (!res.ok) {
          return null;
        }

        const data = (await res.json()) as { conferenceName?: string };
        return data.conferenceName ?? null;
      } catch (err: unknown) {
        captureException(err, {
          extra: { context: 'getConferenceNameByCallSid', callSid },
        });
        return null;
      }
    },
    [],
  );

  return {
    persistCurrentCall,
    clearPersistence,
    getConferenceNameByCallSid,
  };
};
