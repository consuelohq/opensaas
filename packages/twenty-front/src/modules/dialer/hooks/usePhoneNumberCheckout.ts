import { useCallback, useState } from 'react';
import { captureException } from '@sentry/react';
import { REACT_APP_SERVER_BASE_URL } from '~/config';
import { authenticatedFetch } from '@/dialer/utils/authenticatedFetch';

type PhoneNumberCheckoutResult = {
  error?: string;
  url?: string;
};

export const usePhoneNumberCheckout = () => {
  const [isCreatingCheckout, setIsCreatingCheckout] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createCheckout = useCallback(async (): Promise<PhoneNumberCheckoutResult> => {
    setIsCreatingCheckout(true);
    setError(null);

    try {
      const res = await authenticatedFetch(
        `${REACT_APP_SERVER_BASE_URL}/v1/phone-numbers/checkout`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            quantity: 1,
            successUrl: `${window.location.origin}/settings/dialer/subscription?phone_number_success=true`,
            cancelUrl: `${window.location.origin}/settings/dialer/subscription`,
          }),
        },
      );

      const data = (await res.json()) as {
        error?: { message?: string };
        url?: string;
      };

      if (!res.ok || !data.url) {
        const message = data.error?.message ?? `HTTP ${res.status}`;
        setError(message);
        return { error: message };
      }

      return { url: data.url };
    } catch (err: unknown) {
      captureException(err, { extra: { context: 'phoneNumberCheckout' } });
      const message = err instanceof Error ? err.message : 'Checkout failed';
      setError(message);
      return { error: message };
    } finally {
      setIsCreatingCheckout(false);
    }
  }, []);

  return { createCheckout, error, isCreatingCheckout };
};
