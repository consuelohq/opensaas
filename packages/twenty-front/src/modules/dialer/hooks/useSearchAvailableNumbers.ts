import { useState, useCallback } from 'react';
import { captureException } from '@sentry/react';
import { REACT_APP_SERVER_BASE_URL } from '~/config';
import { authenticatedFetch } from '@/dialer/utils/authenticatedFetch';
import { type AvailableNumberOption } from '@/dialer/types/dialer';

export const useSearchAvailableNumbers = () => {
  const [available, setAvailable] = useState<AvailableNumberOption[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const search = useCallback(async (areaCode: string) => {
    setIsSearching(true);
    setError(null);
    setAvailable([]);

    try {
      const res = await authenticatedFetch(
        `${REACT_APP_SERVER_BASE_URL}/v1/phone-numbers/available?areaCode=${encodeURIComponent(areaCode)}`,
      );

      if (!res.ok) {
        const data = (await res.json()) as { error?: { message?: string } };
        throw new Error(data.error?.message ?? `HTTP ${res.status}`);
      }

      const data = (await res.json()) as { available: AvailableNumberOption[] };
      setAvailable(data.available);
    } catch (err: unknown) {
      captureException(err, { extra: { context: 'searchAvailableNumbers' } });
      const message = err instanceof Error ? err.message : 'Search failed';
      setError(message);
    } finally {
      setIsSearching(false);
    }
  }, []);

  return { available, isSearching, error, search };
};
