import { describe, expect, it } from 'bun:test';
import {
  createStripeRedirect,
  readCheckoutRequest,
} from '../src/lib/direct-checkout';
import {
  selectionFromQuery,
  checkoutPayload,
} from '../src/lib/checkout-selection';

const storageFixture = () => {
  const entries = new Map<string, string>();
  return {
    getItem: (key: string) => entries.get(key) ?? null,
    setItem: (key: string, value: string) => {
      entries.set(key, value);
    },
    removeItem: (key: string) => {
      entries.delete(key);
    },
  };
};
const selection = selectionFromQuery(
  new URLSearchParams('plan=agency&billing=annual&seats=2&addon=mercury'),
);

describe('direct hosted checkout', () => {
  it('preserves the private claim and retry identity before an unknown network outcome', async () => {
    const storage = storageFixture();
    const payloads: Array<ReturnType<typeof checkoutPayload>> = [];
    const send = async (payload: ReturnType<typeof checkoutPayload>) => {
      payloads.push(payload);
      const current = storage.getItem('consuelo-checkout-current')!;
      expect(readCheckoutRequest(current, storage)?.claimToken).toHaveLength(
        43,
      );
      throw new Error('NETWORK_TIMEOUT');
    };
    await expect(
      createStripeRedirect(selection, { storage, send }),
    ).rejects.toThrow('NETWORK_TIMEOUT');
    await expect(
      createStripeRedirect(selection, { storage, send }),
    ).rejects.toThrow('NETWORK_TIMEOUT');
    expect(payloads[1]).toEqual(payloads[0]);
    const url = await createStripeRedirect(selection, {
      storage,
      send: async (payload) => {
        expect(payload).toEqual(payloads[0]);
        return { url: 'https://checkout.stripe.com/c/pay/cs_fixture' };
      },
    });
    expect(url).toBe('https://checkout.stripe.com/c/pay/cs_fixture');
    expect(url).not.toContain('claimToken');
  });
  it('rejects hostile redirects and keeps different selections separate', async () => {
    const storage = storageFixture();
    const send = async () => ({ url: 'https://attacker.test/checkout' });
    await expect(
      createStripeRedirect(selection, { storage, send }),
    ).rejects.toThrow();
    const first = storage.getItem('consuelo-checkout-current');
    await expect(
      createStripeRedirect(
        { ...selection, seats: 3, mercurySeats: 3 },
        { storage, send },
      ),
    ).rejects.toThrow();
    expect(storage.getItem('consuelo-checkout-current')).not.toBe(first);
    expect(readCheckoutRequest('invalid-id', storage)).toBeUndefined();
  });
  it('does not create a provider session if private recovery state cannot be persisted', async () => {
    let sent = false;
    await expect(
      createStripeRedirect(selection, {
        storage: {
          getItem: () => null,
          setItem: () => {
            throw new Error('STORAGE_UNAVAILABLE');
          },
          removeItem: () => undefined,
        },
        send: async () => {
          sent = true;
          return { url: 'https://checkout.stripe.com/c/pay/cs_fixture' };
        },
      }),
    ).rejects.toThrow();
    expect(sent).toBe(false);
  });
});
