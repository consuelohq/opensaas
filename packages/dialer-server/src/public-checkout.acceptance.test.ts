import { describe, it, expect } from 'bun:test';
import {
  publicCheckoutCatalog,
  quotePublicCheckout,
} from './billing/public-checkout-catalog';
describe('approved public checkout catalog', () => {
  it('uses the exact new monthly and annual prices with Mercury at $25', () => {
    expect(publicCheckoutCatalog.professional.monthlyCents).toBe(9900);
    expect(publicCheckoutCatalog.agency.monthlyCents).toBe(14900);
    expect(publicCheckoutCatalog.enterprise.monthlyCents).toBe(19900);
    const quote = quotePublicCheckout({
      plan: 'agency',
      billing: 'annual',
      seats: 5,
      mercurySeats: 5,
      minutePack: 600,
      numberPack: 10,
    });
    expect(quote.totalCents).toBe(1082600);
    expect(quote.items).toHaveLength(4);
  });
  it('rejects client prices, unknown choices and invalid or excessive capacity', () => {
    for (const value of [
      { plan: 'free', seats: 1 },
      { plan: 'agency', seats: 0 },
      { plan: 'agency', seats: 1.5 },
      { plan: 'agency', seats: 1001 },
      { plan: 'agency', seats: 1, mercurySeats: 2 },
      { plan: 'agency', seats: 1, minutePack: 1 },
      { plan: 'agency', seats: 1, unitAmount: 1 },
    ])
      expect(() =>
        quotePublicCheckout({
          billing: 'monthly',
          mercurySeats: 0,
          minutePack: 0,
          numberPack: 0,
          ...value,
        }),
      ).toThrow();
  });
});
