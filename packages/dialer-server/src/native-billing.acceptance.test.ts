import { describe, expect, it } from 'bun:test';
import {
  nativePriceDefinitions,
  quoteNativeCheckout,
  normalizeNativeSubscription,
} from './billing/native-billing-catalog';

describe('Stripe-native billing packages', () => {
  it('keeps one recurring base item, a separate number invoice and the approved combined price', () => {
    const quote = quoteNativeCheckout({
      plan: 'agency',
      billing: 'annual',
      seats: 2,
      mercurySeats: 2,
      minutePack: 600,
      numberPack: 10,
    });
    expect(
      quote.baseItems.filter((item) => item.billing !== 'once'),
    ).toHaveLength(1);
    expect(quote.baseItems[0]).toMatchObject({
      code: 'agency-with-mercury',
      quantity: 2,
      unitAmount: 208800,
    });
    expect(quote.numberItems).toEqual([
      { code: 'numbers-10', billing: 'annual', quantity: 1, unitAmount: 33600 },
    ]);
    expect(quote.baseDueCents).toBe(422600);
    expect(quote.numberDueCents).toBe(33600);
    expect(quote.totalCents).toBe(456200);
  });
  it('requires an explicit all-seat coaching bundle and preserves base prices', () => {
    const selection = {
      plan: 'professional',
      billing: 'monthly',
      seats: 3,
      mercurySeats: 0,
      minutePack: 0,
      numberPack: 0,
    };
    expect(quoteNativeCheckout(selection).baseDueCents).toBe(29700);
    expect(
      quoteNativeCheckout({ ...selection, mercurySeats: 3 }).baseDueCents,
    ).toBe(37200);
    expect(() =>
      quoteNativeCheckout({ ...selection, mercurySeats: 1 }),
    ).toThrow('NATIVE_COACHING_REQUIRES_ALL_SEATS');
  });
  it('normalizes only one owned recurring item of the expected role and bounded quantity', () => {
    const prices = new Map(
      nativePriceDefinitions.map((definition) => [
        'price_' + definition.code + '_' + definition.billing,
        definition,
      ]),
    );
    expect(
      normalizeNativeSubscription(
        [
          {
            id: 'si_1',
            priceId: 'price_professional-with-mercury_monthly',
            quantity: 4,
          },
        ],
        prices,
        'base',
      ),
    ).toMatchObject({
      plan: 'professional',
      seats: 4,
      mercurySeats: 4,
      billing: 'monthly',
    });
    expect(
      normalizeNativeSubscription(
        [{ id: 'si_2', priceId: 'price_numbers-10_annual', quantity: 1 }],
        prices,
        'numbers',
      ),
    ).toMatchObject({ numberPack: 10, billing: 'annual' });
    for (const items of [
      [],
      [{ id: 'si_1', priceId: 'foreign_price', quantity: 4 }],
      [{ id: 'si_1', priceId: 'price_numbers-10_monthly', quantity: 1 }],
      [{ id: 'si_1', priceId: 'price_professional_monthly', quantity: 1001 }],
      [{ id: 'si_1', priceId: 'price_professional_monthly', quantity: 1.5 }],
    ])
      expect(() =>
        normalizeNativeSubscription(items, prices, 'base'),
      ).toThrow();
    expect(() =>
      normalizeNativeSubscription(
        [{ id: 'si_1', priceId: 'price_numbers-10_monthly', quantity: 2 }],
        prices,
        'numbers',
      ),
    ).toThrow();
  });
});
