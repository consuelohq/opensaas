import { describe, expect, it } from 'bun:test';
import { randomBytes, randomUUID } from 'node:crypto';
import {
  createPublicCheckout,
  type PublicCheckoutProvider,
  type PublicSession,
  type PublicPrice,
  type PublicSubscription,
} from './billing/public-checkout';
import {
  createPublicCheckoutStore,
  initializePublicCheckoutStore,
} from './billing/public-checkout-store';
import { createNativeCheckout } from './billing/native-checkout';
import {
  initializeNativeBillingStore,
  createNativeBillingStore,
} from './billing/native-billing-store';
import {
  nativePriceDefinitions,
  nativePriceLookupKey,
} from './billing/native-billing-catalog';
import type { DialerPlanCatalog } from './plans/catalog';
import { withDisposableCommercialPostgres } from './test-support/disposable-commercial-postgres';
const suite =
  Bun.env.CONSUELO_RUN_NATIVE_BILLING_POSTGRES === '1'
    ? describe
    : describe.skip;
const baseCatalog: DialerPlanCatalog = {
  plans: Object.fromEntries(
    ['single', 'standard', 'power'].map((code, index) => [
      code,
      {
        code,
        priceCents: [5900, 9900, 15900][index],
        stripePriceId: 'legacy-' + code,
        maxNumbersPerSeat: [1, 3, 10][index],
        includedMinutes: index ? null : 1388,
        providerBudgetCents: null,
        predictive: index > 0,
        recordings: index > 0,
        transcripts: index > 0,
      },
    ]),
  ) as DialerPlanCatalog['plans'],
  trial: {
    includedMinutes: 100,
    maxSeats: 1,
    maxNumbers: 1,
    planCode: 'single',
  },
  includedNumbersPerSeat: 1,
  additionalNumberPriceCents: 199,
  additionalNumberStripePriceId: 'legacy-number',
  paymentGraceDays: 3,
};
const prices: PublicPrice[] = nativePriceDefinitions.map((definition) => ({
  id: 'price_' + definition.code + '_' + definition.billing,
  lookupKey: nativePriceLookupKey(definition.code, definition.billing),
  unitAmount: definition.unitAmount,
  currency: 'usd',
  interval:
    definition.billing === 'annual'
      ? 'year'
      : definition.billing === 'monthly'
        ? 'month'
        : null,
  productId: 'prod_' + definition.code,
}));
const row = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
const admin = {
  workspaceId: 'native-workspace',
  userId: 'native-owner',
  role: 'admin',
};
suite(
  'native billing with durable PostgreSQL and simulated carrier-independent Stripe',
  () => {
    it('isolates native subscriptions, survives partial payment/retry and projects only paid owned edits', async () => {
      await withDisposableCommercialPostgres(async (database) => {
        await initializePublicCheckoutStore(database);
        await initializeNativeBillingStore(database);
        const store = createPublicCheckoutStore(database),
          nativeStore = createNativeBillingStore(database);
        const sessions = new Map<string, PublicSession>(),
          commands = new Map<
            string,
            { id: string; parameters: Record<string, unknown> }
          >();
        const provisions = new Map<string, PublicSubscription>();
        const portalCalls: Record<string, unknown>[] = [];
        let loseBaseResponse = true,
          loseNumberResponse = true;
        const provider: PublicCheckoutProvider = {
          listPrices: async (keys) =>
            prices.filter((price) => keys.includes(price.lookupKey)),
          createSession: async (parameters, key) => {
            let command = commands.get(key);
            if (!command) {
              command = { id: 'cs_test_' + commands.size, parameters };
              commands.set(key, command);
              sessions.set(command.id, {
                id: command.id,
                status: 'open',
                paymentStatus: 'unpaid',
                metadata: parameters.metadata as Record<string, string>,
                customerId:
                  typeof parameters.customer === 'string'
                    ? parameters.customer
                    : null,
                subscription: null,
                mode: String(parameters.mode),
                url: 'https://checkout.stripe.com/c/pay/' + command.id,
              });
              if (key.includes('number') && loseNumberResponse) {
                loseNumberResponse = false;
                throw new Error('NETWORK_TIMEOUT');
              }
              if (!key.includes('number') && loseBaseResponse) {
                loseBaseResponse = false;
                throw new Error('NETWORK_TIMEOUT');
              }
            }
            return {
              id: command.id,
              url: 'https://checkout.stripe.com/c/pay/' + command.id,
            };
          },
          retrieveSession: async (id) => structuredClone(sessions.get(id)!),
          retrieveLineItems: async (id) =>
            row(sessions.get(id)).testLines as Array<{
              priceId: string;
              quantity: number;
            }>,
          findCheckoutSession: async (customer, reference) => {
            const found = [...sessions.values()].find(
              (s) =>
                s.customerId === customer &&
                s.metadata.nativeMinuteId === reference,
            );
            return found ? { id: found.id, url: found.url ?? null } : null;
          },
          createSubscription: async (parameters, key) => {
            let sub = provisions.get(key);
            if (!sub) {
              sub = {
                id: 'sub_numbers_' + provisions.size,
                customerId: String(parameters.customer),
                status: 'active',
                cancelAtPeriodEnd: false,
                metadata: parameters.metadata as Record<string, string>,
                items: [
                  {
                    id: 'si_numbers_' + provisions.size,
                    priceId: (parameters.items as Array<{ price: string }>)[0]
                      .price,
                    quantity: 1,
                  },
                ],
                latestInvoicePaid: true,
                latestInvoiceAmountDue: 0,
                pendingUpdate: false,
              };
              provisions.set(key, sub);
              if (loseNumberResponse) {
                loseNumberResponse = false;
                throw new Error('NETWORK_TIMEOUT');
              }
            }
            return structuredClone(sub);
          },
          retrieveSubscription: async (id) =>
            structuredClone(
              [
                ...provisions.values(),
                ...[...sessions.values()].flatMap((session) =>
                  session.subscription ? [session.subscription] : [],
                ),
              ].find((sub) => sub.id === id)!,
            ),
          findNumberSubscription: async (customer, attempt) =>
            structuredClone(
              [...provisions.values()].find(
                (sub) =>
                  sub.customerId === customer &&
                  sub.metadata.attemptId === attempt,
              ) ?? null,
            ),
          createPortal: async (parameters) => {
            portalCalls.push(parameters);
            return {
              id: 'bps_test',
              url: 'https://billing.stripe.com/p/session/test_owned',
            };
          },
        };
        const pay = (id: string) => {
          const command = [...commands.values()].find(
            (value) => value.id === id,
          )!;
          const parameters = command.parameters;
          const session = sessions.get(id)!;
          const lines = parameters.line_items as Array<{
            price: string;
            quantity: number;
          }>;
          session.status = 'complete';
          session.paymentStatus = 'paid';
          session.customerId =
            typeof parameters.customer === 'string'
              ? parameters.customer
              : 'cus_native';
          session.subscription = {
            id: 'sub_' + id,
            customerId: session.customerId,
            status: 'active',
            cancelAtPeriodEnd: false,
            metadata: (
              parameters.subscription_data as {
                metadata: Record<string, string>;
              }
            ).metadata,
            items: lines
              .filter(
                (line) =>
                  prices.find((price) => price.id === line.price)?.interval,
              )
              .map((line, index) => ({
                id: 'si_' + id + '_' + index,
                priceId: line.price,
                quantity: line.quantity,
              })),
            latestInvoicePaid: true,
            pendingUpdate: false,
          };
        };
        const make = () => {
          const legacy = createPublicCheckout({
            store,
            provider,
            baseCatalog,
            rateLimitSecret: 'controlled-test-secret',
            installUrl:
              'https://marketplace.leadconnectorhq.com/oauth/chooselocation',
            websiteOrigin: 'https://consuelo-dialer-website-preview.pages.dev',
          });
          return createNativeCheckout({
            legacy,
            store,
            nativeStore,
            provider,
            enabled: true,
            rateLimitSecret: 'controlled-test-secret',
            installUrl:
              'https://marketplace.leadconnectorhq.com/oauth/chooselocation',
            websiteOrigin: 'https://consuelo-dialer-website-preview.pages.dev',
            portalConfigurations: { base: 'bpc_base', numbers: 'bpc_numbers' },
          });
        };
        let checkout = make();
        const id = randomUUID(),
          claimToken = randomBytes(32).toString('base64url'),
          selection = {
            plan: 'agency',
            billing: 'annual',
            seats: 2,
            mercurySeats: 2,
            minutePack: 600,
            numberPack: 10,
          };
        const body = { version: 1, requestId: id, claimToken, selection };
        const context = {
          origin: 'https://consuelo-dialer-website-preview.pages.dev',
          clientAddress: 'controlled-test',
        };
        await expect(checkout.create(body, context)).rejects.toThrow(
          'NETWORK_TIMEOUT',
        );
        expect(commands.size).toBe(1);
        expect((await store.get(id))?.billing_version).toBe('native-20261031');
        checkout = make();
        const opened = await checkout.create(body, context);
        expect(commands.size).toBe(1);
        const baseId = [...commands.values()][0].id;
        expect((await checkout.status(id, claimToken)).paid).toBe(false);
        pay(baseId);
        await expect(checkout.status(id, claimToken)).rejects.toThrow(
          'NETWORK_TIMEOUT',
        );
        expect(commands.size).toBe(1);
        expect(provisions.size).toBe(1);
        const partial = await checkout.status(id, claimToken);
        expect(partial.paid).toBe(true);
        expect(partial.allSelectedPaid).toBe(false);
        expect(partial.nextPortalUrl).toMatch(
          /^https:\/\/billing.stripe.com\//,
        );
        expect(commands.size).toBe(1);
        expect(provisions.size).toBe(1);
        const number = await nativeStore.number(id);
        expect(number?.provider_customer_id).toBe('cus_native');
        const numberId = String(number?.provider_subscription_id);
        expect(numberId).not.toBe(baseId);
        await checkout.claim(admin, { purchaseId: id, claimToken });
        await checkout.claim(admin, { purchaseId: id, claimToken });
        expect(
          (await database.query('SELECT * FROM dialer_prepaid_minute_grants'))
            .rows,
        ).toHaveLength(1);
        expect(
          (
            await database.query(
              "SELECT * FROM dialer_workspace_subscription_items WHERE item_code='additional-number'",
            )
          ).rows,
        ).toHaveLength(0);
        const numberSub = [...provisions.values()].find(
          (sub) => sub.id === numberId,
        )!;
        numberSub.items[0].priceId = 'price_numbers-10_annual';
        numberSub.latestInvoiceAmountDue = 33600;
        await checkout.webhook({
          id: 'evt_numbers_paid',
          type: 'checkout.session.completed',
          data: { object: { metadata: { enrollmentId: id } } },
        });
        await checkout.webhook({
          id: 'evt_numbers_paid',
          type: 'checkout.session.completed',
          data: { object: { metadata: { enrollmentId: id } } },
        });
        expect((await checkout.status(id, claimToken)).allSelectedPaid).toBe(
          true,
        );
        expect(
          row(
            (
              await database.query(
                "SELECT quantity FROM dialer_workspace_subscription_items WHERE item_code='additional-number'",
              )
            ).rows[0],
          ).quantity,
        ).toBe(10);
        await checkout.native.createPortal(admin, { component: 'base' });
        expect(portalCalls.at(-1)).toMatchObject({
          customer: 'cus_native',
          configuration: 'bpc_base',
          flow_data: {
            type: 'subscription_update',
            subscription_update: { subscription: 'sub_' + baseId },
          },
        });
        await checkout.native.createPortal(admin, { component: 'numbers' });
        expect(portalCalls.at(-1)).toMatchObject({
          configuration: 'bpc_numbers',
          flow_data: { subscription_update: { subscription: numberId } },
        });
        await expect(
          checkout.native.createPortal(
            { ...admin, role: 'user' },
            { component: 'base' },
          ),
        ).rejects.toThrow();
        const base = sessions.get(baseId)!.subscription!;
        base.pendingUpdate = true;
        base.latestInvoicePaid = false;
        expect((await checkout.status(id, claimToken)).paymentPending).toBe(
          true,
        );
        expect((await store.get(id))?.entitlement_selection).toMatchObject({
          plan: 'agency',
          seats: 2,
        });
        base.pendingUpdate = false;

        base.items = [
          {
            id: base.items[0].id,
            priceId: 'price_enterprise-with-mercury_annual',
            quantity: 3,
          },
        ];
        base.latestInvoicePaid = false;
        expect((await checkout.status(id, claimToken)).paymentPending).toBe(
          true,
        );
        expect((await store.get(id))?.entitlement_selection).toMatchObject({
          plan: 'agency',
          seats: 2,
        });
        base.latestInvoicePaid = true;
        await checkout.webhook({
          id: 'evt_base_upgrade',
          type: 'invoice.paid',
          data: { object: { metadata: { enrollmentId: id } } },
        });
        expect((await store.get(id))?.entitlement_selection).toMatchObject({
          plan: 'enterprise',
          seats: 3,
          mercurySeats: 3,
        });
        expect(
          row(
            (
              await database.query(
                'SELECT plan_code FROM dialer_team_seats WHERE workspace_id=$1',
                [admin.workspaceId],
              )
            ).rows[0],
          ).plan_code,
        ).toBe('power');
        // A native seat downgrade blocks new calls above the allowance; it does not delete assignments or media.
        await database.query(
          "INSERT INTO dialer_team_seats(workspace_id,user_id,plan_code,status) VALUES($1,'second-rep','power','active')",
          [admin.workspaceId],
        );
        base.items[0].quantity = 1;
        await checkout.status(id, claimToken);
        expect((await checkout.native.capacityFor(admin)).allowed).toBe(false);
        expect(
          (
            await database.query(
              "SELECT user_id FROM dialer_team_seats WHERE workspace_id=$1 AND status='active'",
              [admin.workspaceId],
            )
          ).rows,
        ).toHaveLength(2);
        await database.query(
          "UPDATE dialer_team_seats SET status='disabled' WHERE workspace_id=$1 AND user_id='second-rep'",
          [admin.workspaceId],
        );
        expect((await checkout.native.capacityFor(admin)).allowed).toBe(true);
        numberSub.status = 'canceled';
        await checkout.webhook({
          id: 'evt_numbers_cancel',
          type: 'customer.subscription.deleted',
          data: { object: { metadata: { enrollmentId: id } } },
        });
        expect(
          (
            await database.query(
              "SELECT * FROM dialer_workspace_subscription_items WHERE item_code='additional-number'",
            )
          ).rows,
        ).toHaveLength(0);
        expect((await store.get(id))?.provider_status).toBe('active');
        expect(commands.size).toBe(1);
        await checkout.status(id, claimToken);
        expect(provisions.size).toBe(1);
        await checkout.native.createCheckout(admin, {
          component: 'numbers',
          pack: 50,
        });
        expect(commands.size).toBe(1);
        expect(provisions.size).toBe(2);
        const replacement = await nativeStore.number(id);
        const replacementSub = [...provisions.values()].find(
          (sub) => sub.id === replacement?.provider_subscription_id,
        )!;
        replacementSub.items[0].priceId = 'price_numbers-50_annual';
        await checkout.status(id, claimToken);
        await checkout.webhook({
          id: 'evt_old_number_cancel_late',
          type: 'customer.subscription.deleted',
          data: { object: { metadata: { enrollmentId: id } } },
        });
        expect(
          row(
            (
              await database.query(
                "SELECT quantity FROM dialer_workspace_subscription_items WHERE item_code='additional-number'",
              )
            ).rows[0],
          ).quantity,
        ).toBe(50);
        expect(
          row(
            (
              await database.query(
                'SELECT count(*)::int AS count FROM dialer_prepaid_minute_grants',
              )
            ).rows[0],
          ).count,
        ).toBe(1);
        // Top-ups stay entirely on Stripe and only actual paid owned line items grant credits.
        const topup = await checkout.native.createPortal(admin, {
          component: 'minutes',
        });
        const repeated = await checkout.native.createPortal(admin, {
          component: 'minutes',
        });
        expect(repeated.id).toBe(topup.id);
        const topupSession = sessions.get(topup.id)!;
        expect(
          [...commands.values()].find((c) => c.id === topup.id)?.parameters,
        ).toMatchObject({
          mode: 'payment',
          customer: 'cus_native',
          optional_items: expect.any(Array),
        });
        topupSession.status = 'complete';
        topupSession.currency = 'usd';
        topupSession.amountTotal = 5000;
        (topupSession as PublicSession & { testLines: unknown }).testLines = [
          { priceId: 'price_minutes-choice_once', quantity: 1 },
          { priceId: 'price_minutes-600_once', quantity: 1 },
        ];
        const topupEvent = {
          id: 'evt_topup_paid',
          type: 'checkout.session.completed',
          data: { object: { id: topup.id, metadata: topupSession.metadata } },
        };
        await checkout.webhook(topupEvent);
        expect(
          (await database.query('SELECT * FROM dialer_native_minute_grants'))
            .rows,
        ).toHaveLength(0);
        topupSession.paymentStatus = 'paid';
        await checkout.webhook(topupEvent);
        await checkout.webhook(topupEvent);
        expect(
          (await database.query('SELECT * FROM dialer_native_minute_grants'))
            .rows,
        ).toHaveLength(1);
        expect((await store.get(id))?.provider_session_id).toBe(baseId);
        const nextTopup = await checkout.native.createPortal(admin, {
          component: 'minutes',
        });
        expect(nextTopup.id).not.toBe(topup.id);
        const invalid = sessions.get(nextTopup.id)!;
        invalid.status = 'complete';
        invalid.paymentStatus = 'paid';
        invalid.currency = 'usd';
        invalid.amountTotal = 5000;
        (invalid as PublicSession & { testLines: unknown }).testLines = [
          { priceId: 'foreign_price', quantity: 1 },
        ];
        await expect(
          checkout.webhook({
            id: 'evt_foreign',
            type: 'checkout.session.completed',
            data: { object: { id: nextTopup.id, metadata: invalid.metadata } },
          }),
        ).rejects.toThrow('MINUTE_ITEMS_MISMATCH');
        expect(
          (await database.query('SELECT * FROM dialer_native_minute_grants'))
            .rows,
        ).toHaveLength(1);
        // Plan changes debit usage once and never retroactively refund or spend prepaid credits.
        const setPlan = async (plan: string) => {
          base.items[0].priceId = 'price_' + plan + '-with-mercury_annual';
          await checkout.status(id, claimToken);
        };
        const usage = async (source: string, quantity: number) => {
          await database.query(
            "INSERT INTO dialer_usage_events(workspace_id,source_type,source_id,user_id,seat_id,metric,quantity,provider_cost_micros,occurred_at) VALUES($1,'test',$2,$3,'seat','connected_minutes',$4,0,now())",
            [admin.workspaceId, source, admin.userId, quantity],
          );
        };
        const allowance = async () =>
          (await checkout.catalogFor(admin))!.plans.single.includedMinutes;
        await setPlan('professional');
        await usage('first-usage', 1200);
        // 1,200 granted (initial 600 + paid top-up 600), minus 200 spent.
        expect(await allowance()).toBe(2200);
        await setPlan('agency');
        await usage('later-usage', 3900);
        await checkout.catalogFor(admin);
        expect(
          Number(
            row(
              (
                await database.query(
                  'SELECT SUM(debit_minutes) AS spent FROM dialer_native_minute_debits',
                )
              ).rows[0],
            ).spent,
          ),
        ).toBe(300);
        await setPlan('professional');
        await usage('after-downgrade', 50);
        expect(await allowance()).toBe(6000);
        await Promise.all([allowance(), allowance(), allowance()]);
        expect(
          Number(
            row(
              (
                await database.query(
                  'SELECT SUM(debit_minutes) AS spent FROM dialer_native_minute_debits',
                )
              ).rows[0],
            ).spent,
          ),
        ).toBe(350);
        await database.query(
          "UPDATE dialer_public_purchases SET created_at=now()-interval '2 months' WHERE id=$1",
          [id],
        );
        await database.query(
          "INSERT INTO dialer_native_minute_debits(workspace_id,user_id,period,quota,usage_seen,debit_minutes) VALUES($1,$2,date_trunc('month',now() AT TIME ZONE 'UTC')::date-interval '1 month',1000,1200,200)",
          [admin.workspaceId, admin.userId],
        );
        await database.query(
          "INSERT INTO dialer_usage_events(workspace_id,source_type,source_id,user_id,seat_id,metric,quantity,provider_cost_micros,occurred_at) VALUES($1,'test','late-old-fact',$2,'seat','connected_minutes',1250,0,date_trunc('month',now())-interval '1 day')",
          [admin.workspaceId, admin.userId],
        );
        await setPlan('agency');
        await checkout.catalogFor(admin);
        const oldMonth = row(
          (
            await database.query(
              "SELECT quota,debit_minutes FROM dialer_native_minute_debits WHERE period<date_trunc('month',now() AT TIME ZONE 'UTC')::date",
            )
          ).rows[0],
        );
        expect(Number(oldMonth.quota)).toBe(1000);
        expect(Number(oldMonth.debit_minutes)).toBe(250);
      });
    }, 60000);
  },
);
