import {
  checkoutPayload,
  stripeCheckoutUrl,
  validateSelection,
  type CheckoutSelection,
} from './checkout-selection';

type CheckoutStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
export type CheckoutRequest = { key: string; id: string; claimToken: string };
type Payload = ReturnType<typeof checkoutPayload>;
type Transport = (payload: Payload) => Promise<{ url: unknown }>;

export const readCheckoutRequest = (
  id: string,
  storage: CheckoutStorage,
): CheckoutRequest | undefined => {
  try {
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        id,
      )
    )
      return;
    const value: unknown = JSON.parse(
      storage.getItem('consuelo-checkout:' + id) ?? 'null',
    );
    if (
      !value ||
      typeof value !== 'object' ||
      !('id' in value) ||
      value.id !== id ||
      !('key' in value) ||
      typeof value.key !== 'string' ||
      !('claimToken' in value) ||
      typeof value.claimToken !== 'string' ||
      !/^[A-Za-z0-9_-]{43}$/.test(value.claimToken)
    )
      return;
    validateSelection(JSON.parse(value.key));
    return { id, key: value.key, claimToken: value.claimToken };
  } catch {
    return;
  }
};

export const createStripeRedirect = async (
  selection: CheckoutSelection,
  options: { storage: CheckoutStorage; send?: Transport; signal?: AbortSignal },
): Promise<string> => {
  try {
    const key = JSON.stringify(validateSelection(selection));
    const current = options.storage.getItem('consuelo-checkout-current');
    let request = current
      ? readCheckoutRequest(current, options.storage)
      : undefined;
    if (!request || request.key !== key) {
      const claimToken = btoa(
        String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32))),
      )
        .replaceAll('+', '-')
        .replaceAll('/', '_')
        .replaceAll('=', '');
      request = { key, id: crypto.randomUUID(), claimToken };
      // Recovery must survive an unknown provider outcome before the network effect begins.
      options.storage.setItem(
        'consuelo-checkout:' + request.id,
        JSON.stringify(request),
      );
      options.storage.setItem('consuelo-checkout-current', request.id);
    }
    const payload = checkoutPayload(selection, request.id, request.claimToken);
    let result: { url: unknown };
    if (options.send) result = await options.send(payload);
    else {
      const response = await fetch(
        'https://calls.consuelohq.com/v1/public/billing/checkout',
        {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal: options.signal
            ? AbortSignal.any([options.signal, AbortSignal.timeout(20000)])
            : AbortSignal.timeout(20000),
        },
      );
      if (!response.ok) {
        const error: unknown = await response.json().catch(() => null);
        if (
          error &&
          typeof error === 'object' &&
          'error' in error &&
          error.error &&
          typeof error.error === 'object' &&
          'code' in error.error &&
          error.error.code === 'CHECKOUT_SESSION_EXPIRED'
        ) {
          options.storage.removeItem('consuelo-checkout:' + request.id);
          options.storage.removeItem('consuelo-checkout-current');
        }
        throw new Error(
          'Stripe Checkout is temporarily unavailable. Please try again.',
        );
      }
      const value: unknown = await response.json();
      if (!value || typeof value !== 'object' || !('url' in value))
        throw new Error('Invalid Checkout response');
      result = { url: value.url };
    }
    return stripeCheckoutUrl(result.url);
  } catch (cause: unknown) {
    if (cause instanceof Error) throw cause;
    throw new Error('Stripe Checkout is temporarily unavailable.');
  }
};
