import { useState, useCallback } from 'react';
import { captureException } from '@sentry/react';
import { REACT_APP_SERVER_BASE_URL } from '~/config';
import { authenticatedFetch } from '@/dialer/utils/authenticatedFetch';

export const useReleaseNumber = () => {
  const [isReleasing, setIsReleasing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const release = useCallback(async (sid: string): Promise<boolean> => {
    setIsReleasing(true);
    setError(null);

    try {
      const res = await authenticatedFetch(
        `${REACT_APP_SERVER_BASE_URL}/v1/phone-numbers/${encodeURIComponent(sid)}`,
        { method: 'DELETE' },
      );

      if (!res.ok) {
        const data = (await res.json()) as { error?: { message?: string } };
        const message = data.error?.message ?? `HTTP ${res.status}`;
        setError(message);
        return false;
      }

      return true;
    } catch (err: unknown) {
      captureException(err, { extra: { context: 'releaseNumber' } });
      const message = err instanceof Error ? err.message : 'Release failed';
      setError(message);
      return false;
    } finally {
      setIsReleasing(false);
    }
  }, []);

  return { isReleasing, error, release };
};
