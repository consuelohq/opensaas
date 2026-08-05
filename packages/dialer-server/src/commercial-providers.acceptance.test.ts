import { describe, expect, it, mock } from 'bun:test';
import { Effect } from 'effect';

import {
  createStripeCommercialBilling,
  type StripeCommercialClient,
} from './billing/stripe';
import { createTwilioCommercialNumberProvider } from './numbers/commercial-provider';
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

  it('creates hosted Checkout and portal sessions and previews the exact proration timestamp applied to a subscription update', async () => {
    const createCustomer = mock(async () => ({ id: 'cus_payer_one' }));
    const createCheckout = mock(async () => ({
      id: 'cs_checkout_one',
      url: 'https://checkout.stripe.test/session-one',
    }));
    const createPortal = mock(async () => ({
      id: 'bps_portal_one',
      url: 'https://billing.stripe.test/session-one',
    }));
    const createPreview = mock(async () => ({
      amount_due: 4200,
      currency: 'usd',
      period_end: 1_788_600_000,
    }));
    const update = mock(async () => ({ id: 'sub_one' }));
    const client: StripeCommercialClient = {
      customers: { create: createCustomer },
      checkout: { sessions: { create: createCheckout } },
      billingPortal: { sessions: { create: createPortal } },
      invoices: { createPreview },
      subscriptions: {
        retrieve: async () => ({
          id: 'sub_one',
          items: { data: [{ id: 'si_single', price: { id: 'price_single' } }] },
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

    expect(
      await Effect.runPromise(
        billing.createCustomer({ payerId: 'payer-one', workspaceId: 'workspace-one' }),
      ),
    ).toEqual({ id: 'cus_payer_one' });
    expect(createCustomer).toHaveBeenCalledWith(
      { metadata: { payerId: 'payer-one', workspaceId: 'workspace-one' } },
      { idempotencyKey: 'payer-one:commercial-customer' },
    );

    expect(
      await Effect.runPromise(
        billing.createCheckoutSession({
          workspaceId: 'workspace-one',
          payerId: 'payer-one',
          customerId: 'cus_payer_one',
          items: [
            { code: 'single', priceId: 'price_single', quantity: 2 },
            { code: 'additional-number', priceId: 'price_number', quantity: 1 },
          ],
          successUrl: 'https://app.test/admin?billing=success',
          cancelUrl: 'https://app.test/admin?billing=cancelled',
        }),
      ),
    ).toEqual({
      id: 'cs_checkout_one',
      url: 'https://checkout.stripe.test/session-one',
    });
    expect(createCheckout).toHaveBeenCalledWith(
      {
        cancel_url: 'https://app.test/admin?billing=cancelled',
        client_reference_id: 'workspace-one',
        customer: 'cus_payer_one',
        line_items: [
          { price: 'price_single', quantity: 2 },
          { price: 'price_number', quantity: 1 },
        ],
        metadata: { payerId: 'payer-one', workspaceId: 'workspace-one' },
        mode: 'subscription',
        success_url: 'https://app.test/admin?billing=success',
        subscription_data: {
          metadata: { payerId: 'payer-one', workspaceId: 'workspace-one' },
        },
      },
      { idempotencyKey: 'workspace-one:payer-one:checkout:additional-number:1|single:2' },
    );

    expect(
      await Effect.runPromise(
        billing.createPortalSession({
          customerId: 'cus_payer_one',
          returnUrl: 'https://app.test/admin',
        }),
      ),
    ).toEqual({
      id: 'bps_portal_one',
      url: 'https://billing.stripe.test/session-one',
    });
    expect(createPortal).toHaveBeenCalledWith({
      customer: 'cus_payer_one',
      return_url: 'https://app.test/admin',
    });

    expect(
      await Effect.runPromise(
        billing.getUpcomingInvoiceSummary({
          customerId: 'cus_payer_one',
          subscriptionId: 'sub_one',
        }),
      ),
    ).toEqual({
      amountDue: 4200,
      currency: 'usd',
      periodEnd: 1_788_600_000,
    });
    expect(createPreview).toHaveBeenCalledWith({
      customer: 'cus_payer_one',
      subscription: 'sub_one',
    });

    expect(
      await Effect.runPromise(
        billing.previewSubscriptionChange({
          customerId: 'cus_payer_one',
          subscriptionId: 'sub_one',
          items: [{ code: 'single', priceId: 'price_single', quantity: 3 }],
          prorationDate: 1_786_000_000,
        }),
      ),
    ).toEqual({
      amountDue: 4200,
      currency: 'usd',
      prorationDate: 1_786_000_000,
    });
    expect(createPreview).toHaveBeenCalledWith({
      customer: 'cus_payer_one',
      subscription: 'sub_one',
      subscription_details: {
        items: [{ price: 'price_single', quantity: 3 }],
        proration_behavior: 'create_prorations',
        proration_date: 1_786_000_000,
      },
    });

    await Effect.runPromise(
      billing.reconcileSubscription({
        subscriptionId: 'sub_one',
        workspaceId: 'workspace-one',
        items: [{ code: 'single', priceId: 'price_single', quantity: 3 }],
        prorationDate: 1_786_000_000,
      }),
    );
    expect(update).toHaveBeenCalledWith(
      'sub_one',
      expect.objectContaining({
        proration_behavior: 'create_prorations',
        proration_date: 1_786_000_000,
      }),
      { idempotencyKey: 'workspace-one:sub_one:single:3:1786000000' },
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

  it('releases a newly purchased provider number when local persistence fails', async () => {
    const remove = mock(async () => true);
    const create = mock(async () => ({
      sid: 'PN_number_one',
      phoneNumber: '+15550100001',
    }));
    const incomingPhoneNumbers = Object.assign(
      (_sid: string) => ({ remove }),
      { create },
    );
    const query = mock(async (sql: string) => {
      if (sql.includes('dialer_workspace_telephony_accounts')) {
        return {
          rows: [
            {
              workspace_id: 'workspace-one',
              provider_account_id: 'AC_workspace_one',
            },
          ],
          rowCount: 1,
        };
      }
      if (sql.includes('INSERT INTO dialer_phone_numbers')) {
        throw new Error('DATABASE_UNAVAILABLE');
      }
      return { rows: [], rowCount: 0 };
    });
    const provider = createTwilioCommercialNumberProvider({
      database: { query },
      createSubaccount: async () => ({ sid: 'unused' }),
      accountClient: () => ({
        availablePhoneNumbers: () => ({
          local: { list: async () => [] },
        }),
        incomingPhoneNumbers,
      }),
      publicUrl: 'https://dialer.example.test',
    });

    await expect(
      provider.provision({
        workspaceId: 'workspace-one',
        phoneNumber: '+15550100001',
      }),
    ).rejects.toThrow('DATABASE_UNAVAILABLE');
    expect(remove).toHaveBeenCalledTimes(1);
    expect(create).toHaveBeenCalledTimes(1);
  });
});
