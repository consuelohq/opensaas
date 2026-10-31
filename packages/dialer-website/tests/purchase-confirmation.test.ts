import { describe, it, expect } from 'bun:test';
import {
  purchaseConfirmation,
  numberConfirmationRedirect,
} from '../src/lib/purchase-confirmation';
describe('native Stripe purchase confirmation', () => {
  it('retains partial purchase recovery after the paid base is connected', () => {
    const result = purchaseConfirmation({
      paid: true,
      status: 'active',
      claimed: true,
      allSelectedPaid: false,
      paymentPending: false,
      nextPortalUrl: 'https://billing.stripe.com/p/session/owned',
    });
    expect(result.complete).toBe(false);
    expect(result.needsNumbers).toBe(true);
    expect(result.portalUrl).toContain('billing.stripe.com');
    expect(result.clearClaim).toBe(false);
  });
  it('keeps legacy completion compatible and refuses unpaid or failed payment as activation evidence', () => {
    expect(
      purchaseConfirmation({ paid: true, status: 'active', claimed: true })
        .clearClaim,
    ).toBe(true);
    expect(
      purchaseConfirmation({
        paid: false,
        status: 'pending',
        allSelectedPaid: true,
      }).complete,
    ).toBe(false);
    expect(
      purchaseConfirmation({ paid: true, status: 'past_due', claimed: false })
        .canConnect,
    ).toBe(false);
  });
  it('rejects hostile portal destinations', () => {
    for (const url of [
      'https://evil.test/',
      'https://billing.stripe.com.evil.test/',
      'https://user@billing.stripe.com/p',
      'https://billing.stripe.com:123/p',
      'javascript:alert(1)',
    ])
      expect(() =>
        purchaseConfirmation({
          paid: true,
          status: 'active',
          allSelectedPaid: false,
          nextPortalUrl: url,
        }),
      ).toThrow();
  });
  it('auto-opens number confirmation once, retains explicit retry and never loops on cancellation', () => {
    const entries = new Map<string, string>();
    const storage = {
      getItem: (key: string) => entries.get(key) ?? null,
      setItem: (key: string, value: string) => {
        entries.set(key, value);
      },
    };
    const result = purchaseConfirmation({
      paid: true,
      status: 'active',
      allSelectedPaid: false,
      nextPortalUrl: 'https://billing.stripe.com/p/session/owned',
    });
    expect(
      numberConfirmationRedirect(
        'purchase',
        result,
        new URLSearchParams(),
        storage,
      ),
    ).toBe(result.portalUrl);
    expect(
      numberConfirmationRedirect(
        'purchase',
        result,
        new URLSearchParams(),
        storage,
      ),
    ).toBeNull();
    entries.clear();
    expect(
      numberConfirmationRedirect(
        'purchase',
        result,
        new URLSearchParams('checkout=cancelled'),
        storage,
      ),
    ).toBeNull();
    expect(
      numberConfirmationRedirect(
        'purchase',
        result,
        new URLSearchParams('numbers=done'),
        storage,
      ),
    ).toBeNull();
  });
});
