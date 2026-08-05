import { describe, expect, it, mock } from 'bun:test';
import { Effect } from 'effect';

import {
  createStripeCommercialBilling,
  type StripeCommercialClient,
} from './billing/stripe';
import { createTwilioSubaccountProvider } from './numbers/twilio-subaccounts';

describe('commercial provider adapters', () => {
  it('reconciles Stripe items by provider price and removes stale items idempotently', async () => {
    const update = mock(async () => ({ id: 'sub_one' }));
    const client: StripeCommercialClient = {
      subscriptions: {
        retrieve: async () => ({
          id: 'sub_one',
          items: {
            data: [
              { id: 'si_single', price: { id: 'price_single' } },
              { id: 'si_stale', price: { id: 'price_stale' } },
            ],
          },
        }),
        update,
      },
      webhooks: {
        constructEvent: () => ({ id: 'evt_one', type: 'invoice.paid' }),
      },
    };
    const billing = createStripeCommercialBilling({
      client,
      webhookSecret: 'whsec_test',
    });

    await Effect.runPromise(
      billing.reconcileSubscription({
        subscriptionId: 'sub_one',
        workspaceId: 'workspace-one',
        items: [
          { code: 'single', priceId: 'price_single', quantity: 2 },
          { code: 'power', priceId: 'price_power', quantity: 1 },
        ],
      }),
    );

    expect(update).toHaveBeenCalledWith(
      'sub_one',
      {
        cancel_at_period_end: false,
        items: [
          { id: 'si_single', quantity: 2 },
          { price: 'price_power', quantity: 1 },
          { id: 'si_stale', deleted: true },
        ],
        metadata: { workspaceId: 'workspace-one' },
        payment_behavior: 'pending_if_incomplete',
        proration_behavior: 'create_prorations',
      },
      { idempotencyKey: 'workspace-one:sub_one:single:2|power:1' },
    );
  });

  it('schedules period-end cancellation with a deterministic idempotency key and verifies webhook signatures', async () => {
    const update = mock(async () => ({ id: 'sub_one' }));
    const constructEvent = mock(() => ({
      id: 'evt_one',
      type: 'customer.subscription.deleted',
    }));
    const client: StripeCommercialClient = {
      subscriptions: {
        retrieve: async () => ({
          id: 'sub_one',
          items: { data: [] },
        }),
        update,
      },
      webhooks: { constructEvent },
    };
    const billing = createStripeCommercialBilling({
      client,
      webhookSecret: 'whsec_test',
    });

    await Effect.runPromise(
      billing.scheduleCancellationAtPeriodEnd('sub_one'),
    );
    expect(update).toHaveBeenCalledWith(
      'sub_one',
      { cancel_at_period_end: true },
      { idempotencyKey: 'sub_one:cancel-at-period-end' },
    );
    expect(billing.constructWebhookEvent('raw-body', 'signature')).toEqual({
      id: 'evt_one',
      type: 'customer.subscription.deleted',
    });
    expect(constructEvent).toHaveBeenCalledWith(
      'raw-body',
      'signature',
      'whsec_test',
    );
  });

  it('creates workspace-isolated Twilio subaccounts through the Accounts resource', async () => {
    const create = mock(async () => ({ sid: 'AC_subaccount_one' }));
    const provider = createTwilioSubaccountProvider({
      api: { accounts: { create } },
    });

    expect(
      await Effect.runPromise(
        provider.createSubaccount({ friendlyName: 'Workspace one' }),
      ),
    ).toEqual({ id: 'AC_subaccount_one' });
    expect(create).toHaveBeenCalledWith({ friendlyName: 'Workspace one' });
  });
});
