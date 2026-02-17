import { useEffect, useState } from 'react';
import { useSetRecoilState } from 'recoil';
import { captureException } from '@sentry/react';
import { REACT_APP_SERVER_BASE_URL } from '~/config';
import { type CallerIdOption } from '@/dialer/types/dialer';
import { availableCallerIdsState } from '@/dialer/states/availableCallerIdsState';

export const useAvailableCallerIds = () => {
  const setAvailableCallerIds = useSetRecoilState(availableCallerIdsState);
  const [fetched, setFetched] = useState(false);

  useEffect(() => {
    if (fetched) return;
    setFetched(true);

    const fetchPhoneNumbers = async () => {
      try {
        const res = await fetch(
          `${REACT_APP_SERVER_BASE_URL}/v1/phone-numbers`,
          {
            credentials: 'include',
          },
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
      }
    };

    fetchPhoneNumbers();
  }, [fetched, setAvailableCallerIds]);
};
