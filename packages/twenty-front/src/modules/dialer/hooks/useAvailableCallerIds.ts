import { useCallback, useEffect, useState } from 'react';
import { useSetRecoilState } from 'recoil';
import { captureException } from '@sentry/react';
import { REACT_APP_SERVER_BASE_URL } from '~/config';
import { authenticatedFetch } from '@/dialer/utils/authenticatedFetch';
import { type CallerIdOption } from '@/dialer/types/dialer';
import { availableCallerIdsState } from '@/dialer/states/availableCallerIdsState';

export const useAvailableCallerIds = () => {
  const setAvailableCallerIds = useSetRecoilState(availableCallerIdsState);
  const [loading, setLoading] = useState(true);

  const fetchPhoneNumbers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authenticatedFetch(
        `${REACT_APP_SERVER_BASE_URL}/v1/phone-numbers`,
      );

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }

      const data = (await res.json()) as { phoneNumbers: CallerIdOption[] };
      setAvailableCallerIds(data.phoneNumbers);
    } catch (err: unknown) {
      captureException(err, {
        extra: { context: 'fetchAvailableCallerIds' },
      });
    } finally {
      setLoading(false);
    }
  }, [setAvailableCallerIds]);

  useEffect(() => {
    if (!loading) return;
    fetchPhoneNumbers();
  }, [loading, fetchPhoneNumbers]);

  const refetch = useCallback(() => {
    fetchPhoneNumbers();
  }, [fetchPhoneNumbers]);

  return { refetch, loading };
};
