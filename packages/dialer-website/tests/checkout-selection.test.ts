import { describe, it, expect } from 'bun:test';
import {
  selectionFromQuery,
  quoteCheckout,
  checkoutPayload,
  stripeCheckoutUrl,
} from '../src/lib/checkout-selection';
describe('pay first checkout selection', () => {
  it('retains team seats, annual billing and the approved Mercury price', () => {
    const selection = selectionFromQuery(
      new URLSearchParams(
        'plan=agency&billing=annual&seats=5&addon=mercury&price=1',
      ),
    );
    expect(quoteCheckout(selection)).toEqual({
      recurringCents: 1044000,
      recurringMonthlyCents: 87000,
      oneTimeCents: 0,
      dueCents: 1044000,
      months: 12,
    });
    const payload = checkoutPayload(
      selection,
      'eecbb747-12d8-4f07-9326-ce833ce9499c',
      'a'.repeat(43),
    );
    expect(Object.keys(payload.selection)).toEqual([
      'plan',
      'billing',
      'seats',
      'mercurySeats',
      'minutePack',
      'numberPack',
    ]);
    expect(JSON.stringify(payload)).not.toContain('price');
  });
  it('quotes one-time minutes separately from recurring number packs', () => {
    const s = selectionFromQuery(
      new URLSearchParams('plan=enterprise&addon=minutes-600'),
    );
    expect(quoteCheckout({ ...s, numberPack: 10 }).dueCents).toBe(27700);
    expect(
      quoteCheckout({ ...s, numberPack: 10, billing: 'annual' }).dueCents,
    ).toBe(277400);
  });
  it('rejects invalid quantities or forged add-on sizes and never charges for Starter', () => {
    for (const seats of ['0', '1.5', '1001', 'NaN'])
      expect(() =>
        selectionFromQuery(new URLSearchParams('seats=' + seats)),
      ).toThrow();
    for (const addon of ['minutes-1', 'numbers-999', 'minutes-NaN'])
      expect(() =>
        selectionFromQuery(new URLSearchParams('addon=' + addon)),
      ).toThrow();
    const starter = selectionFromQuery(new URLSearchParams('plan=starter'));
    expect(quoteCheckout(starter).dueCents).toBe(0);
    expect(() =>
      checkoutPayload(
        starter,
        'eecbb747-12d8-4f07-9326-ce833ce9499c',
        'a'.repeat(43),
      ),
    ).toThrow();
    expect(() =>
      selectionFromQuery(new URLSearchParams('plan=starter&addon=mercury')),
    ).toThrow();
  });
  it('does not reflect hostile plan input or accept redirects outside Stripe', () => {
    for (const plan of ['__proto__', 'toString', '<img src=x>'])
      expect(selectionFromQuery(new URLSearchParams({ plan })).plan).toBe(
        'professional',
      );
    expect(
      stripeCheckoutUrl('https://checkout.stripe.com/c/pay/cs_test_example'),
    ).toContain('checkout.stripe.com');
    for (const url of [
      'javascript:alert(1)',
      'https://checkout.stripe.com.evil.test/c/x',
      'https://evil.test/c/x',
      'https://checkout.stripe.com@evil.test/c/x',
      'http://checkout.stripe.com/c/x',
      'https://checkout.stripe.com:8443/c/x',
    ])
      expect(() => stripeCheckoutUrl(url)).toThrow();
  });
});
