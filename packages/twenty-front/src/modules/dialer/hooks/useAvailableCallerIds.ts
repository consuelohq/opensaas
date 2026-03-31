import { useCallback, useEffect, useRef } from 'react';
import { useSetRecoilState } from 'recoil';
import { captureException } from '@sentry/react';
import { REACT_APP_SERVER_BASE_URL } from '~/config';
import { authenticatedFetch } from '@/dialer/utils/authenticatedFetch';
import { type CallerIdOption } from '@/dialer/types/dialer';
import { availableCallerIdsState } from '@/dialer/states/availableCallerIdsState';

const STORAGE_KEY = 'dialer_phone_numbers';

export const useAvailableCallerIds = () => {
  const setAvailableCallerIds = useSetRecoilState(availableCallerIdsState);
  const initializedRef = useRef(false);

  const fetchPhoneNumbers = useCallback(async () => {
    try {
      const res = await authenticatedFetch(
        `${REACT_APP_SERVER_BASE_URL}/v1/phone-numbers`,
      );

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }

      const data = (await res.json()) as { phoneNumbers: CallerIdOption[] };
      setAvailableCallerIds(data.phoneNumbers);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data.phoneNumbers));
    } catch (err: unknown) {
      captureException(err, {
        extra: { context: 'fetchAvailableCallerIds' },
      });
    }
  }, [setAvailableCallerIds]);

  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    // instant first paint from localStorage
    try {
      const cached = localStorage.getItem(STORAGE_KEY);
      if (cached) {
        setAvailableCallerIds(JSON.parse(cached) as CallerIdOption[]);
      }
    } catch {
      // corrupt localStorage — ignore
    }

    // refresh from server in background
    fetchPhoneNumbers();
  }, [fetchPhoneNumbers, setAvailableCallerIds]);

  const refetch = useCallback(() => {
    fetchPhoneNumbers();
  }, [fetchPhoneNumbers]);

  return { refetch };
};
