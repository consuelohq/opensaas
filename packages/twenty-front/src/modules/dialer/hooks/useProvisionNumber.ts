import { useState, useCallback } from 'react';
import { captureException } from '@sentry/react';
import { REACT_APP_SERVER_BASE_URL } from '~/config';
import { authenticatedFetch } from '@/dialer/utils/authenticatedFetch';

type ProvisionResult = {
  success: boolean;
  phoneNumber?: string;
  sid?: string;
  areaCode?: string;
  ownershipType?: 'add_on' | 'included' | 'legacy_reserved' | 'pack';
  error?: string;
  code?: string;
};

export const useProvisionNumber = () => {
  const [isProvisioning, setIsProvisioning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const provision = useCallback(
    async (
      areaCode: string,
      phoneNumber?: string,
    ): Promise<ProvisionResult> => {
      setIsProvisioning(true);
      setError(null);

      try {
        const res = await authenticatedFetch(
          `${REACT_APP_SERVER_BASE_URL}/v1/phone-numbers/provision`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ areaCode, phoneNumber }),
          },
        );

        if (!res.ok) {
          const data = (await res.json()) as {
            error?: { code?: string; message?: string };
          };
          const message = data.error?.message ?? `HTTP ${res.status}`;
          setError(message);
          return { success: false, error: message, code: data.error?.code };
        }

        const data = (await res.json()) as ProvisionResult;
        return data;
      } catch (err: unknown) {
        captureException(err, { extra: { context: 'provisionNumber' } });
        const message = err instanceof Error ? err.message : 'Provision failed';
        setError(message);
        return { success: false, error: message };
      } finally {
        setIsProvisioning(false);
      }
    },
    [],
  );

  return { isProvisioning, error, provision };
};
