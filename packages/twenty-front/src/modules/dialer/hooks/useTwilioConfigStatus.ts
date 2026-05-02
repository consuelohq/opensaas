import { useCallback, useEffect, useRef } from 'react';
import { useRecoilState } from 'recoil';
import { captureException } from '@sentry/react';

import { REACT_APP_SERVER_BASE_URL } from '~/config';
import { authenticatedFetch } from '@/dialer/utils/authenticatedFetch';
import { twilioConfigStatusState } from '@/dialer/states/twilioConfigStatusState';
import { type TwilioConfigStatus } from '@/dialer/types/dialer';

const POLL_INTERVAL_UNCONFIGURED = 5_000;
const POLL_INTERVAL_CONFIGURED = 60_000;

export const useTwilioConfigStatus = () => {
  const [twilioConfigStatus, setTwilioConfigStatus] = useRecoilState(
    twilioConfigStatusState,
  );
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await authenticatedFetch(
        `${REACT_APP_SERVER_BASE_URL}/v1/voice/status`,
      );
      if (!res.ok) {
        throw new Error(`Status fetch failed: ${res.status}`);
      }
      const data = (await res.json()) as TwilioConfigStatus;
      setTwilioConfigStatus((previousStatus) => {
        if (
          previousStatus?.configured === true &&
          data.configured === false &&
          data.error
        ) {
          return {
            ...previousStatus,
            error: data.error,
          };
        }

        return data;
      });
    } catch (err: unknown) {
      captureException(err, { extra: { context: 'fetchTwilioConfigStatus' } });
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to fetch status';

      setTwilioConfigStatus((previousStatus) => {
        if (previousStatus !== null) {
          return {
            ...previousStatus,
            error: errorMessage,
          };
        }

        return {
          mode: 'byok',
          configured: false,
          twilioConnected: false,
          hasPhoneNumbers: false,
          twimlAppConfigured: false,
          error: errorMessage,
        };
      });
    }
  }, [setTwilioConfigStatus]);

  // fetch on mount, then poll — faster when unconfigured, slower when configured
  useEffect(() => {
    fetchStatus();

    const startPolling = () => {
      if (pollRef.current) clearInterval(pollRef.current);
      const interval = twilioConfigStatus?.configured
        ? POLL_INTERVAL_CONFIGURED
        : POLL_INTERVAL_UNCONFIGURED;
      pollRef.current = setInterval(fetchStatus, interval);
    };

    startPolling();

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [fetchStatus, twilioConfigStatus?.configured]);

  return { status: twilioConfigStatus, refetch: fetchStatus };
};
