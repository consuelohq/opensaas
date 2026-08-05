import { describe, expect, it, mock } from 'bun:test';
import { Effect } from 'effect';

import { createCommercialApplication } from './commercial/application';
import type { DialerPlanCatalog } from './plans/catalog';

const catalog: DialerPlanCatalog = {
  plans: {
    single: {
      code: 'single',
      priceCents: 5900,
      stripePriceId: 'price_single',
      maxNumbersPerSeat: 1,
      includedMinutes: 1388,
      providerBudgetCents: 3000,
      predictive: false,
      recordings: false,
      transcripts: false,
    },
    standard: {
      code: 'standard',
      priceCents: 9900,
      stripePriceId: 'price_standard',
      maxNumbersPerSeat: 3,
      includedMinutes: null,
      providerBudgetCents: null,
      predictive: true,
      recordings: true,
      transcripts: true,
    },
    power: {
      code: 'power',
      priceCents: 15900,
      stripePriceId: 'price_power',
      maxNumbersPerSeat: 10,
      includedMinutes: null,
      providerBudgetCents: null,
      predictive: true,
      recordings: true,
      transcripts: true,
    },
  },
  trial: {
    includedMinutes: 500,
    maxSeats: 1,
    maxNumbers: 1,
    planCode: 'standard',
  },
  includedNumbersPerSeat: 1,
  additionalNumberPriceCents: 199,
  additionalNumberStripePriceId: 'price_number',
  paymentGraceDays: 3,
};

const admin = (workspaceId: string) => ({
  workspaceId,
  userId: 'payer-one',
  role: 'admin',
});

const createBilling = () => ({
  createCustomer: mock(() => Effect.succeed({ id: 'cus_payer_one' })),
  createCheckoutSession: mock((input: unknown) =>
    Effect.succeed({
      id: 'cs_' + String((input as { workspaceId: string }).workspaceId),
      url:
        'https://checkout.stripe.test/' +
        String((input as { workspaceId: string }).workspaceId),
    }),
  ),
  createPortalSession: mock(() =>
    Effect.succeed({
      id: 'bps_one',
      url: 'https://billing.stripe.test/session-one',
    }),
  ),
  getUpcomingInvoiceSummary: mock(() =>
    Effect.succeed({
      amountDue: 12_198,
      currency: 'usd',
      periodEnd: 1_788_600_000,
    }),
  ),
  previewSubscriptionChange: mock(() =>
    Effect.succeed({ amountDue: 4200, currency: 'usd', prorationDate: 123 }),
  ),
  reconcileSubscription: mock(() => Effect.void),
  scheduleCancellationAtPeriodEnd: mock(() => Effect.void),
  constructWebhookEvent: mock((_rawBody: string, _signature: string) => ({
    id: 'evt_default',
    type: 'invoice.paid',
    data: { object: { metadata: { workspaceId: 'workspace-one' } } },
  })),
});

describe('commercial application billing and inventory authority', () => {
  it('reuses one Stripe customer per payer across multiple workspaces while creating workspace-specific Checkout sessions', async () => {
    const billingAccounts = new Map<string, string>();
    const query = mock(async (sql: string, parameters: readonly unknown[] = []) => {
      if (sql.includes('FROM dialer_workspace_subscriptions')) return { rows: [] };
      if (sql.includes('FROM dialer_billing_accounts')) {
        const customerId = billingAccounts.get(String(parameters[0]));
        return { rows: customerId ? [{ provider_customer_id: customerId }] : [] };
      }
      if (sql.includes('INSERT INTO dialer_billing_accounts')) {
        const payerId = String(parameters[0]);
        if (!billingAccounts.has(payerId)) {
          billingAccounts.set(payerId, String(parameters[1]));
        }
        return {
          rows: [
            { provider_customer_id: billingAccounts.get(payerId) as string },
          ],
          rowCount: 1,
        };
      }
      throw new Error('Unexpected query: ' + sql);
    });
    const billing = createBilling();
    const application = createCommercialApplication({
      database: { query },
      catalog,
      billing,
      billingReturnUrl: 'https://app.test/admin',
    });

    const quantities = {
      single: 1,
      standard: 0,
      power: 0,
      additionalNumber: 0,
    };
    const first = await Effect.runPromise(
      application.createCheckout(admin('workspace-one'), { quantities }),
    );
    const second = await Effect.runPromise(
      application.createCheckout(admin('workspace-two'), { quantities }),
    );

    expect(first).toEqual({
      id: 'cs_workspace-one',
      url: 'https://checkout.stripe.test/workspace-one',
    });
    expect(second).toEqual({
      id: 'cs_workspace-two',
      url: 'https://checkout.stripe.test/workspace-two',
    });
    expect(billing.createCustomer).toHaveBeenCalledTimes(1);
    expect(billing.createCheckoutSession.mock.calls[0]?.[0]).toMatchObject({
      workspaceId: 'workspace-one',
      payerId: 'payer-one',
      customerId: 'cus_payer_one',
    });
    expect(billing.createCheckoutSession.mock.calls[1]?.[0]).toMatchObject({
      workspaceId: 'workspace-two',
      payerId: 'payer-one',
      customerId: 'cus_payer_one',
    });
  });

  it('injects plan-owned recording and transcription flags into call authorization and ignores browser escalation', async () => {
    const createQuery = (planCode: 'single' | 'standard') =>
      mock(async (sql: string) => {
        if (sql.toLowerCase().includes('dialer_team_seats') && sql.includes('user_id = $2')) {
          return { rows: [{ plan_code: planCode }] };
        }
        if (sql.toLowerCase().includes('dialer_phone_numbers') && sql.includes('user_id = $2')) {
          return { rows: [{ phone_number: '+15550100001' }] };
        }
        if (sql.includes('FROM dialer_usage_events')) {
          return { rows: [{ connected_minutes: 0 }] };
        }
        if (sql.includes('FROM dialer_workspace_subscriptions')) {
          return {
            rows: [
              {
                status: 'active',
                payment_failed_at: null,
                cancel_at_period_end: false,
              },
            ],
          };
        }
        if (sql.includes('AS seat_count')) {
          return { rows: [{ seat_count: 1, number_count: 1 }] };
        }
        throw new Error('Unexpected query: ' + sql);
      });

    const single = createCommercialApplication({
      database: { query: createQuery('single') },
      catalog,
      billing: createBilling(),
      billingReturnUrl: 'https://app.test/admin',
    });
    await expect(
      Effect.runPromise(
        single.authorizeCall(
          { workspaceId: 'workspace-one', userId: 'user-one', role: 'user' },
          {
            requestedFanout: 1,
            selectionStrategy: 'single',
            callerIdNumber: '+15550100001',
            recordingEnabled: true,
            transcriptionEnabled: true,
          },
        ),
      ),
    ).resolves.toMatchObject({
      recordingEnabled: false,
      transcriptionEnabled: false,
    });

    const standard = createCommercialApplication({
      database: { query: createQuery('standard') },
      catalog,
      billing: createBilling(),
      billingReturnUrl: 'https://app.test/admin',
    });
    await expect(
      Effect.runPromise(
        standard.authorizeCall(
          { workspaceId: 'workspace-one', userId: 'user-one', role: 'user' },
          {
            requestedFanout: 1,
            selectionStrategy: 'single',
            callerIdNumber: '+15550100001',
            recordingEnabled: false,
            transcriptionEnabled: false,
          },
        ),
      ),
    ).resolves.toMatchObject({
      recordingEnabled: true,
      transcriptionEnabled: true,
    });
  });

  it('returns confirmed subscription quantities and the upcoming invoice summary for admin billing', async () => {
    const query = mock(async (sql: string) => {
      if (sql.includes('FROM dialer_workspace_subscriptions')) {
        return {
          rows: [
            {
              status: 'active',
              payment_failed_at: null,
              cancel_at_period_end: false,
              provider_customer_id: 'cus_payer_one',
              provider_subscription_id: 'sub_one',
            },
          ],
        };
      }
      if (sql.toLowerCase().includes('dialer_workspace_subscription_items')) {
        return {
          rows: [
            { item_code: 'single', quantity: 2 },
            { item_code: 'additional-number', quantity: 1 },
          ],
        };
      }
      if (sql.includes('FROM dialer_team_seats')) {
        return { rows: [{ user_id: 'user-one', plan_code: 'single', status: 'active' }] };
      }
      if (sql.includes('FROM dialer_phone_numbers')) {
        return { rows: [{ phone_number: '+15550100001', user_id: 'user-one', status: 'active' }] };
      }
      if (sql.includes('FROM dialer_usage_events')) {
        return { rows: [{ connected_minutes: 42, provider_cost_micros: 9000 }] };
      }
      throw new Error('Unexpected query: ' + sql);
    });
    const billing = createBilling();
    const application = createCommercialApplication({
      database: { query },
      catalog,
      billing,
      billingReturnUrl: 'https://app.test/admin',
    });

    const dashboard = await Effect.runPromise(
      application.dashboard(admin('workspace-one')),
    );

    expect(dashboard).toMatchObject({
      workspaceId: 'workspace-one',
      subscriptionItems: [
        { item_code: 'single', quantity: 2 },
        { item_code: 'additional-number', quantity: 1 },
      ],
      billingSummary: {
        amountDue: 12_198,
        currency: 'usd',
        periodEnd: 1_788_600_000,
      },
    });
    expect(billing.getUpcomingInvoiceSummary).toHaveBeenCalledWith({
      customerId: 'cus_payer_one',
      subscriptionId: 'sub_one',
    });
  });

  it('allows paid seats to remain unassigned and rejects assignment beyond confirmed webhook inventory without mutating Stripe', async () => {
    const writes: string[] = [];
    const query = mock(async (sql: string) => {
      if (sql.toLowerCase().includes('dialer_workspace_subscription_items')) {
        return { rows: [{ item_code: 'single', quantity: 2 }] };
      }
      if (
        sql.includes('INSERT INTO dialer_team_seats') ||
        sql.includes('UPDATE dialer_team_seats')
      ) {
        writes.push(sql);
        return { rows: [], rowCount: 1 };
      }
      throw new Error('Unexpected query: ' + sql);
    });
    const billing = createBilling();
    const application = createCommercialApplication({
      database: { query },
      catalog,
      billing,
      billingReturnUrl: 'https://app.test/admin',
    });

    await expect(
      Effect.runPromise(
        application.updateTeam(admin('workspace-one'), {
          assignments: [{ userId: 'user-one', planCode: 'single' }],
        }),
      ),
    ).resolves.toMatchObject({ updated: true });
    expect(writes.length).toBe(2);
    expect(billing.reconcileSubscription).not.toHaveBeenCalled();

    await expect(
      Effect.runPromise(
        application.updateTeam(admin('workspace-one'), {
          assignments: [
            { userId: 'user-one', planCode: 'single' },
            { userId: 'user-two', planCode: 'single' },
            { userId: 'user-three', planCode: 'single' },
          ],
        }),
      ),
    ).rejects.toThrow('ASSIGNED_SEAT_QUANTITY');
  });

  it('rejects number purchase before the provider boundary when confirmed line inventory is exhausted', async () => {
    const query = mock(async (sql: string) => {
      if (sql.includes('SELECT plan_code')) {
        return { rows: [{ plan_code: 'standard' }] };
      }
      if (sql.includes('SELECT workspace_id, user_id, phone_number, status')) {
        return {
          rows: [
            {
              workspace_id: 'workspace-one',
              user_id: 'user-one',
              phone_number: '+15550100001',
              status: 'active',
            },
          ],
        };
      }
      if (sql.toLowerCase().includes('dialer_workspace_subscription_items')) {
        return { rows: [{ item_code: 'standard', quantity: 1 }] };
      }
      if (sql.includes('COUNT(*)::integer AS quantity')) {
        return { rows: [{ quantity: 1 }] };
      }
      throw new Error('Unexpected query: ' + sql);
    });
    const provision = mock(async () => ({
      providerNumberId: 'PN_should_not_exist',
      phoneNumber: '+15550100002',
    }));
    const application = createCommercialApplication({
      database: { query },
      catalog,
      billing: createBilling(),
      billingReturnUrl: 'https://app.test/admin',
      numbers: {
        searchAvailable: async () => [],
        provision,
        release: async () => ({ released: true as const }),
      },
    });

    await expect(
      Effect.runPromise(
        application.provisionNumber(admin('workspace-one'), {
          userId: 'user-one',
          phoneNumber: '+15550100002',
        }),
      ),
    ).rejects.toThrow('NUMBER_INVENTORY_EXHAUSTED');
    expect(provision).not.toHaveBeenCalled();
  });

  it('rejects subscription downgrades below assigned seats or active number slots before Stripe', async () => {
    const query = mock(async (sql: string) => {
      if (sql.includes('FROM dialer_workspace_subscriptions')) {
        return {
          rows: [
            {
              provider_customer_id: 'cus_payer_one',
              provider_subscription_id: 'sub_one',
              status: 'active',
            },
          ],
        };
      }
      if (sql.includes('GROUP BY plan_code')) {
        return { rows: [{ plan_code: 'single', quantity: 2 }] };
      }
      if (sql.includes('COUNT(*)::integer AS quantity')) {
        return { rows: [{ quantity: 3 }] };
      }
      throw new Error('Unexpected query: ' + sql);
    });
    const billing = createBilling();
    const application = createCommercialApplication({
      database: { query },
      catalog,
      billing,
      billingReturnUrl: 'https://app.test/admin',
    });

    await expect(
      Effect.runPromise(
        application.applyBillingChange(admin('workspace-one'), {
          quantities: {
            single: 1,
            standard: 0,
            power: 0,
            additionalNumber: 2,
          },
          prorationDate: 1_786_000_000,
        }),
      ),
    ).rejects.toThrow('SUBSCRIPTION_BELOW_ASSIGNED_SEATS');

    await expect(
      Effect.runPromise(
        application.applyBillingChange(admin('workspace-one'), {
          quantities: {
            single: 2,
            standard: 0,
            power: 0,
            additionalNumber: 0,
          },
          prorationDate: 1_786_000_000,
        }),
      ),
    ).rejects.toThrow('SUBSCRIPTION_BELOW_ACTIVE_NUMBERS');
    expect(billing.reconcileSubscription).not.toHaveBeenCalled();
  });

  it('preserves included slots and decrements only released paid-number add-ons through Stripe', async () => {
    const billing = createBilling();
    const release = mock(async () => ({ released: true as const }));
    const includedQuery = mock(async (sql: string) => {
      if (sql.toLowerCase().includes('dialer_phone_numbers') && sql.toLowerCase().includes('slot_type')) {
        return {
          rows: [
            {
              phone_number: '+15550100001',
              user_id: 'user-one',
              slot_type: 'included',
              status: 'active',
            },
          ],
        };
      }
      throw new Error('Unexpected included query: ' + sql);
    });
    const includedApplication = createCommercialApplication({
      database: { query: includedQuery },
      catalog,
      billing,
      billingReturnUrl: 'https://app.test/admin',
      numbers: {
        searchAvailable: async () => [],
        provision: async () => ({
          providerNumberId: 'PN_unused',
          phoneNumber: '+15550100001',
        }),
        release,
      },
    });

    await expect(
      Effect.runPromise(
        includedApplication.releaseNumber(admin('workspace-one'), {
          phoneNumber: '+15550100001',
        }),
      ),
    ).resolves.toEqual({
      released: true,
      phoneNumber: '+15550100001',
      slotType: 'included',
      pendingWebhook: false,
    });
    expect(billing.reconcileSubscription).not.toHaveBeenCalled();

    const addOnQuery = mock(async (sql: string) => {
      if (sql.toLowerCase().includes('dialer_phone_numbers') && sql.toLowerCase().includes('slot_type')) {
        return {
          rows: [
            {
              phone_number: '+15550100002',
              user_id: 'user-one',
              slot_type: 'additional',
              status: 'active',
            },
          ],
        };
      }
      if (sql.includes('FROM dialer_workspace_subscriptions')) {
        return {
          rows: [
            {
              provider_customer_id: 'cus_payer_one',
              provider_subscription_id: 'sub_one',
              status: 'active',
            },
          ],
        };
      }
      if (sql.toLowerCase().includes('dialer_workspace_subscription_items')) {
        return {
          rows: [
            {
              item_code: 'single',
              provider_price_id: 'price_single',
              quantity: 1,
            },
            {
              item_code: 'additional-number',
              provider_price_id: 'price_number',
              quantity: 2,
            },
          ],
        };
      }
      throw new Error('Unexpected add-on query: ' + sql);
    });
    const addOnApplication = createCommercialApplication({
      database: { query: addOnQuery },
      catalog,
      billing,
      billingReturnUrl: 'https://app.test/admin',
      now: () => new Date('2026-08-05T00:00:00.000Z'),
      numbers: {
        searchAvailable: async () => [],
        provision: async () => ({
          providerNumberId: 'PN_unused',
          phoneNumber: '+15550100002',
        }),
        release,
      },
    });

    await expect(
      Effect.runPromise(
        addOnApplication.releaseNumber(admin('workspace-one'), {
          phoneNumber: '+15550100002',
        }),
      ),
    ).resolves.toEqual({
      released: true,
      phoneNumber: '+15550100002',
      slotType: 'additional',
      pendingWebhook: true,
    });
    expect(billing.reconcileSubscription).toHaveBeenCalledWith({
      subscriptionId: 'sub_one',
      workspaceId: 'workspace-one',
      items: [
        { code: 'single', priceId: 'price_single', quantity: 1 },
        { code: 'additional-number', priceId: 'price_number', quantity: 1 },
      ],
      prorationDate: 1_785_888_000,
    });
  });

  it('projects Stripe subscription item quantities into local confirmed inventory only from a verified webhook', async () => {
    const calls: Array<{ sql: string; parameters: readonly unknown[] }> = [];
    const query = mock(async (sql: string, parameters: readonly unknown[] = []) => {
      calls.push({ sql, parameters });
      if (sql.includes('dialer_provider_webhook_events')) {
        return { rows: [{ inserted: true }], rowCount: 1 };
      }
      return { rows: [], rowCount: 1 };
    });
    const billing = createBilling();
    billing.constructWebhookEvent.mockImplementation(() => ({
      id: 'evt_subscription_one',
      type: 'customer.subscription.updated',
      data: {
        object: {
          id: 'sub_one',
          customer: 'cus_payer_one',
          status: 'active',
          cancel_at_period_end: false,
          metadata: { workspaceId: 'workspace-one' },
          items: {
            data: [
              {
                id: 'si_single',
                quantity: 2,
                price: { id: 'price_single' },
              },
              {
                id: 'si_number',
                quantity: 3,
                price: { id: 'price_number' },
              },
            ],
          },
        },
      },
    }));
    const application = createCommercialApplication({
      database: { query },
      catalog,
      billing,
      billingReturnUrl: 'https://app.test/admin',
    });

    await expect(
      Effect.runPromise(
        application.processStripeWebhook({ rawBody: '{}', signature: 'sig' }),
      ),
    ).resolves.toEqual({ received: true, duplicate: false });

    const itemDelete = calls.find((call) =>
      call.sql.includes('DELETE FROM dialer_workspace_subscription_items'),
    );
    const itemInserts = calls.filter((call) =>
      call.sql.includes('INSERT INTO dialer_workspace_subscription_items'),
    );
    expect(itemDelete?.parameters).toEqual(['workspace-one']);
    expect(itemInserts.map((call) => call.parameters)).toEqual([
      ['workspace-one', 'single', 'si_single', 'price_single', 2],
      ['workspace-one', 'additional-number', 'si_number', 'price_number', 3],
    ]);
  });
});
