import { useCallback, useState } from 'react';
import { useRecoilValue, useSetRecoilState } from 'recoil';

import { REACT_APP_SERVER_BASE_URL } from '~/config';
import { callStateAtom } from '@/dialer/states/callStateAtom';
import { activeTransferState } from '@/dialer/states/activeTransferState';
import { isOnHoldState } from '@/dialer/states/isOnHoldState';
import { conferenceSidState } from '@/dialer/states/conferenceState';
import type { TransferType, TransferStatus } from '@/dialer/types/dialer';

interface TransferState {
  status: TransferStatus | 'idle';
  transferCallSid: string | null;
  conferenceSid: string | null;
  error: string | null;
}

interface UseCallTransferReturn {
  transferState: TransferState;
  initiateTransfer: (to: string, type: TransferType) => Promise<void>;
  completeTransfer: () => Promise<void>;
  cancelTransfer: () => Promise<void>;
  toggleHold: (hold: boolean) => Promise<void>;
}

async function postJson(path: string, body: Record<string, unknown>): Promise<Record<string, unknown>> {
  try {
    const res = await fetch(`${REACT_APP_SERVER_BASE_URL}${path}`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = (await res.json()) as Record<string, unknown>;
    if (!res.ok) {
      const err = data.error as { message?: string } | undefined;
      throw new Error(err?.message ?? `Request failed: ${res.status}`);
    }
    return data;
  } catch (err: unknown) {
    if (err instanceof Error) throw err;
    throw new Error('Network request failed');
  }
}

export const useCallTransfer = (): UseCallTransferReturn => {
  const callState = useRecoilValue(callStateAtom);
  const setActiveTransfer = useSetRecoilState(activeTransferState);
  const setIsOnHold = useSetRecoilState(isOnHoldState);
  const setConferenceSid = useSetRecoilState(conferenceSidState);

  const [transferState, setTransferState] = useState<TransferState>({
    status: 'idle',
    transferCallSid: null,
    conferenceSid: null,
    error: null,
  });

  const initiateTransfer = useCallback(
    async (to: string, type: TransferType) => {
      const callSid = callState.callSid;
      if (!callSid) return;

      setTransferState({ status: 'initiating', transferCallSid: null, conferenceSid: null, error: null });

      try {
        const data = await postJson(`/v1/calls/${callSid}/transfer`, { to, type });

        setTransferState({
          status: type === 'warm' ? 'consulting' : 'completed',
          transferCallSid: (data.transferCallSid as string) ?? null,
          conferenceSid: (data.conferenceSid as string) ?? null,
          error: null,
        });
        if (data.conferenceSid) setConferenceSid(data.conferenceSid as string);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Transfer failed';
        setTransferState((prev) => ({ ...prev, status: 'failed', error: message }));
      }
    },
    [callState.callSid],
  );

  const completeTransfer = useCallback(async () => {
    const callSid = callState.callSid;
    if (!callSid || !transferState.conferenceSid) return;

    try {
      await postJson(`/v1/calls/${callSid}/transfer/complete`, {
        conferenceSid: transferState.conferenceSid,
        agentCallSid: callSid,
      });

      setTransferState({ status: 'completed', transferCallSid: null, conferenceSid: null, error: null });
      setActiveTransfer(null);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Complete failed';
      setTransferState((prev) => ({ ...prev, status: 'failed', error: message }));
    }
  }, [callState.callSid, transferState.conferenceSid, setActiveTransfer]);

  const cancelTransfer = useCallback(async () => {
    const callSid = callState.callSid;
    if (!callSid || !transferState.conferenceSid || !transferState.transferCallSid) return;

    try {
      await postJson(`/v1/calls/${callSid}/transfer/cancel`, {
        conferenceSid: transferState.conferenceSid,
        transferCallSid: transferState.transferCallSid,
      });

      setTransferState({ status: 'cancelled', transferCallSid: null, conferenceSid: null, error: null });
      setActiveTransfer(null);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Cancel failed';
      setTransferState((prev) => ({ ...prev, status: 'failed', error: message }));
    }
  }, [callState.callSid, transferState.conferenceSid, transferState.transferCallSid, setActiveTransfer]);

  const toggleHold = useCallback(
    async (hold: boolean) => {
      const callSid = callState.callSid;
      if (!callSid) return;

      try {
        await postJson(`/v1/calls/${callSid}/hold`, { hold });
        setIsOnHold(hold);
      } catch (err: unknown) {
        // hold toggle failed — UI stays in previous state
      }
    },
    [callState.callSid, setIsOnHold],
  );

  return { transferState, initiateTransfer, completeTransfer, cancelTransfer, toggleHold };
};
