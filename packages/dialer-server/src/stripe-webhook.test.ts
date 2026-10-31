import { describe, expect, it, mock } from 'bun:test';
import { createHmac } from 'node:crypto';
import { Effect } from 'effect';
import {
  createStripeCommercialBilling,
  createStripeCommercialWebhookVerifier,
} from './billing/stripe';
import { createCommercialApplication } from './commercial/application';
import { loadDialerPlanCatalog } from './plans/catalog';

const secret = 'whsec_local_fixture_only';
const payload = JSON.stringify({
  id: 'evt_local_crypto',
  object: 'event',
  type: 'invoice.paid',
  data: { object: { metadata: { workspaceId: 'workspace-local' } } },
});
const signature = (timestamp = Math.floor(Date.now() / 1000)) =>
  `t=${timestamp},v1=${createHmac('sha256', secret)
    .update(`${timestamp}.${payload}`)
    .digest('hex')}`;

const fixture = async () => {
  const { default: Stripe } = await import('stripe');
  const stripe = new Stripe('sk_test_local_fixture_only');
  const query = mock(async () => ({ rows: [], rowCount: 0 }));
  const billing = createStripeCommercialBilling({
    webhookSecret: secret,
    client: {
      subscriptions: {
        retrieve: async () => ({ id: 'unused', items: { data: [] } }),
        update: async () => undefined,
      },
      webhooks: { constructEvent: createStripeCommercialWebhookVerifier(stripe) },
    },
  });
  const application = createCommercialApplication({
    database: { query },
    catalog: loadDialerPlanCatalog({
      DIALER_INCLUDED_NUMBERS_PER_SEAT: '1',
      STRIPE_PRICE_SINGLE_MONTHLY: 'price_single',
      STRIPE_PRICE_STANDARD_MONTHLY: 'price_standard',
      STRIPE_PRICE_POWER_MONTHLY: 'price_power',
      STRIPE_PRICE_ADDITIONAL_NUMBER_MONTHLY: 'price_number',
      DIALER_SINGLE_PRICE_CENTS: '9900',
      DIALER_SINGLE_MAX_NUMBERS_PER_SEAT: '1',
      DIALER_SINGLE_INCLUDED_MINUTES: '1000',
      DIALER_SINGLE_PROVIDER_BUDGET_CENTS: '1000',
      DIALER_STANDARD_PRICE_CENTS: '14900',
      DIALER_STANDARD_MAX_NUMBERS_PER_SEAT: '3',
      DIALER_POWER_PRICE_CENTS: '19900',
      DIALER_POWER_MAX_NUMBERS_PER_SEAT: '10',
      DIALER_TRIAL_INCLUDED_MINUTES: '100',
      DIALER_TRIAL_MAX_SEATS: '1',
      DIALER_TRIAL_MAX_NUMBERS: '1',
      DIALER_TRIAL_PLAN_CODE: 'standard',
      DIALER_ADDITIONAL_NUMBER_PRICE_CENTS: '300',
      DIALER_PAYMENT_GRACE_DAYS: '3',
    }),
    billing,
    billingReturnUrl: 'https://example.com/admin',
  });
  return { application, query };
};

describe('real Stripe WebCrypto webhook boundary', () => {
  it('awaits real SDK verification before dispatching a signed event', async () => {
    const { application, query } = await fixture();
    await expect(Effect.runPromise(application.processStripeWebhook({
      rawBody: payload,
      signature: signature(),
    }))).resolves.toEqual({ received: true, duplicate: true });
    expect(query).toHaveBeenCalled();
  });

  it('rejects tampered and stale signatures before any database effect', async () => {
    const { application, query } = await fixture();
    for (const input of [
      { rawBody: payload + ' ', signature: signature() },
      { rawBody: payload, signature: signature(Math.floor(Date.now() / 1000) - 600) },
    ]) {
      await expect(Effect.runPromise(application.processStripeWebhook(input)))
        .rejects.toThrow('INVALID_STRIPE_SIGNATURE');
    }
    expect(query).not.toHaveBeenCalled();
  });
});
