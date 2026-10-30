import { describe, it, expect } from 'bun:test';
import { randomBytes, randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'node:net';
import { Pool } from 'pg';
import { Effect } from 'effect';
import { initializeCommercialPersistence } from './commercial/persistence';
import { createCommercialApplication } from './commercial/application';
import {
  createPublicCheckoutStore,
  initializePublicCheckoutStore,
} from './billing/public-checkout-store';
import {
  createPublicCheckout,
  type PublicCheckoutProvider,
  type PublicSession,
  type PublicPrice,
} from './billing/public-checkout';
import {
  publicCheckoutCatalog,
  publicPriceLookupKey,
} from './billing/public-checkout-catalog';
import type { DialerPlanCatalog } from './plans/catalog';
import { createPublicCheckoutRoutes } from './routes/public-checkout';

const suite =
  process.env.CONSUELO_RUN_PUBLIC_CHECKOUT_POSTGRES === '1'
    ? describe
    : describe.skip;
const run = async (args: string[]) => {
  const proc = Bun.spawn(args, {
    stdout: 'pipe',
    stderr: 'pipe',
    env: { ...process.env, LC_ALL: 'C', LANG: 'C' },
  });
  const [stdout, stderr, exit] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  if (exit) throw new Error(args[0] + ': ' + stderr);
  return stdout.trim();
};
const reservePort = () =>
  new Promise<number>((resolve, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string')
        return reject(new Error('No loopback port'));
      server.close((error) => (error ? reject(error) : resolve(address.port)));
    });
  });
const baseCatalog: DialerPlanCatalog = {
  plans: Object.fromEntries(
    ['single', 'standard', 'power'].map((code, index) => [
      code,
      {
        code,
        priceCents: [5900, 9900, 15900][index],
        stripePriceId: 'legacy-' + code,
        maxNumbersPerSeat: [1, 3, 10][index],
        includedMinutes: index === 0 ? 1388 : null,
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
const prices: PublicPrice[] = [
  ...Object.entries(publicCheckoutCatalog).flatMap(([code, p]) =>
    ['monthly', 'annual'].map((billing) => ({
      code,
      billing,
      amount: p.monthlyCents * (billing === 'annual' ? 12 : 1),
    })),
  ),
  ...['monthly', 'annual'].map((billing) => ({
    code: 'mercury',
    billing,
    amount: 2500 * (billing === 'annual' ? 12 : 1),
  })),
  ...Object.entries({ 1: 300, 10: 2800, 50: 12500 }).flatMap(([n, cents]) =>
    ['monthly', 'annual'].map((billing) => ({
      code: 'numbers-' + n,
      billing,
      amount: cents * (billing === 'annual' ? 12 : 1),
    })),
  ),
  ...Object.entries({ 100: 1000, 600: 5000, 1400: 10000 }).map(
    ([n, amount]) => ({ code: 'minutes-' + n, billing: 'once', amount }),
  ),
].map((p) => ({
  id: 'price_' + publicPriceLookupKey(p.code, p.billing),
  lookupKey: publicPriceLookupKey(p.code, p.billing),
  unitAmount: p.amount,
  currency: 'usd',
  interval:
    p.billing === 'annual' ? 'year' : p.billing === 'monthly' ? 'month' : null,
}));
const selection = {
  plan: 'agency',
  billing: 'annual',
  seats: 5,
  mercurySeats: 5,
  minutePack: 600,
  numberPack: 10,
};
const admin = { workspaceId: 'workspace-a', userId: 'admin-a', role: 'admin' };

suite('public checkout with disposable PostgreSQL and simulated Stripe', () => {
  it('survives unknown outcomes, binds once, fences stale facts and retains legacy billing', async () => {
    const root = await mkdtemp(join(tmpdir(), 'consuelo-public-checkout-'));
    let pgCtl: string | undefined,
      started = false,
      pool: Pool | undefined;
    try {
      const pgConfig = Bun.which('pg_config');
      if (!pgConfig)
        throw new Error(
          'Local PostgreSQL is required; never use a customer DATABASE_URL',
        );
      const bin = await run([pgConfig, '--bindir']);
      pgCtl = join(bin, 'pg_ctl');
      const port = await reservePort();
      await run([
        join(bin, 'initdb'),
        '-D',
        join(root, 'postgres'),
        '--auth=trust',
        '--username=postgres',
        '--no-locale',
      ]);
      await run([
        pgCtl,
        '-D',
        join(root, 'postgres'),
        '-l',
        join(root, 'postgres.log'),
        '-o',
        `-h 127.0.0.1 -p ${port} -F`,
        '-w',
        'start',
      ]);
      started = true;
      pool = new Pool({
        host: '127.0.0.1',
        port,
        user: 'postgres',
        database: 'postgres',
        max: 6,
      });
      const database = {
        query: async (sql: string, parameters?: readonly unknown[]) => {
          const r = await pool!.query(sql, parameters as unknown[]);
          return { rows: r.rows, rowCount: r.rowCount ?? undefined };
        },
      };
      await Effect.runPromise(initializeCommercialPersistence(database));
      await initializePublicCheckoutStore(database);
      await initializePublicCheckoutStore(database);
      const store = createPublicCheckoutStore(database),
        sessions = new Map<string, PublicSession>();
      const created = new Map<string, { id: string; url: string }>();
      let createAttempts = 0,
        failAfterCreate = true;
      let retrieveOverride:
        | ((id: string) => Promise<PublicSession>)
        | undefined;
      const provider: PublicCheckoutProvider = {
        listPrices: async () => prices,
        createSession: async (parameters, key) => {
          createAttempts++;
          let result = created.get(key);
          if (!result) {
            const id = String(parameters.client_reference_id),
              sessionId = 'cs_' + id;
            const items = (
              parameters.line_items as Array<{
                price: string;
                quantity: number;
              }>
            ).filter(
              (item) =>
                prices.find((p) => p.id === item.price)?.interval !== null,
            );
            sessions.set(sessionId, {
              id: sessionId,
              status: 'open',
              paymentStatus: 'unpaid',
              metadata: { enrollmentId: id },
              customerId: 'cus_' + id,
              subscription: {
                id: 'sub_' + id,
                customerId: 'cus_' + id,
                status: 'active',
                cancelAtPeriodEnd: false,
                metadata: { enrollmentId: id },
                items: items.map((item, index) => ({
                  id: 'si_' + id + '_' + index,
                  priceId: item.price,
                  quantity: item.quantity,
                })),
              },
            });
            result = {
              id: sessionId,
              url: 'https://checkout.stripe.com/c/pay/' + sessionId,
            };
            created.set(key, result);
          }
          if (failAfterCreate) {
            failAfterCreate = false;
            throw new Error('Provider response lost after creation');
          }
          return result;
        },
        retrieveSession: async (id) =>
          retrieveOverride
            ? retrieveOverride(id)
            : structuredClone(sessions.get(id)!),
      };
      const checkout = createPublicCheckout({
        store,
        provider,
        baseCatalog,
        rateLimitSecret: 'fixture-only-secret',
        installUrl:
          'https://marketplace.leadconnectorhq.com/oauth/chooselocation',
      });
      const trialCatalog = await checkout.catalogFor({
        ...admin,
        workspaceId: 'new-trial',
      });
      expect(trialCatalog!.plans.single.priceCents).toBe(9900);
      expect(trialCatalog!.trial.includedMinutes).toBe(100);
      const trialCommercial = createCommercialApplication({
        database,
        catalog: baseCatalog,
        publicCheckout: checkout,
      });
      const newCheckout = (await Effect.runPromise(
        trialCommercial.createCheckout(
          { ...admin, workspaceId: 'new-trial' },
          {
            quantities: {
              single: 0,
              standard: 2,
              power: 0,
              additionalNumber: 0,
            },
          },
        ),
      )) as { url: string };
      expect(new URL(newCheckout.url).searchParams.get('plan')).toBe('agency');
      expect(new URL(newCheckout.url).searchParams.get('seats')).toBe('2');
      const id = randomUUID(),
        token = randomBytes(32).toString('base64url'),
        body = { version: 1, requestId: id, claimToken: token, selection };
      const context = {
        origin: 'https://consuelohq.com',
        clientAddress: '127.0.0.1',
      };
      await expect(checkout.create(body, context)).rejects.toThrow(
        'Provider response lost',
      );
      expect((await store.get(id))?.provider_session_id).toBeNull();
      const result = await checkout.create(body, context);
      expect(created.size).toBe(1);
      expect(createAttempts).toBe(2);
      expect((await store.get(id))?.claim_hash).not.toBe(token);
      expect((await checkout.status(id, token)).paid).toBe(false);
      await expect(
        checkout.claim(admin, { purchaseId: id, claimToken: token }),
      ).rejects.toThrow('PURCHASE_NOT_PAID');
      await expect(
        checkout.status(id, randomBytes(32).toString('base64url')),
      ).rejects.toThrow('PURCHASE_NOT_FOUND');
      await expect(
        checkout.create(
          { ...body, selection: { ...selection, seats: 1 } },
          context,
        ),
      ).rejects.toThrow();
      await expect(
        checkout.create({ ...body, unitAmount: 1 }, context),
      ).rejects.toThrow('INVALID_CHECKOUT_REQUEST');
      await expect(
        checkout.create(body, { ...context, origin: 'https://evil.test' }),
      ).rejects.toThrow('CHECKOUT_ORIGIN_DENIED');
      const app = createPublicCheckoutRoutes(checkout);
      expect(
        (
          await app.request('/v1/public/billing/checkout', {
            method: 'POST',
            headers: { origin: context.origin },
            body: 'x'.repeat(8193),
          })
        ).status,
      ).toBe(413);
      expect(
        (
          await app.request('/v1/public/billing/checkout', {
            method: 'OPTIONS',
            headers: { origin: context.origin },
          })
        ).status,
      ).toBe(204);
      expect(
        (
          await app.request('/v1/public/billing/checkout', {
            method: 'POST',
            headers: { origin: 'https://consuelohq.com.evil.test' },
            body: '{}',
          })
        ).status,
      ).toBe(403);
      expect(
        (
          await app.request('/v1/public/billing/purchase/' + id, {
            headers: { origin: context.origin },
          })
        ).status,
      ).toBe(404);

      const session = sessions.get('cs_' + id)!;
      session.status = 'complete';
      session.paymentStatus = 'paid';
      expect((await checkout.status(id, token)).paid).toBe(true);
      await expect(
        checkout.claim(
          { ...admin, role: 'user' },
          { purchaseId: id, claimToken: token },
        ),
      ).rejects.toThrow('ADMIN_REQUIRED');
      const races = await Promise.allSettled([
        checkout.claim(admin, { purchaseId: id, claimToken: token }),
        checkout.claim(
          { ...admin, workspaceId: 'workspace-b' },
          { purchaseId: id, claimToken: token },
        ),
      ]);
      expect(races.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      const purchase = (await store.get(id))!;
      const winner = String(purchase.claimed_workspace_id);
      const winnerIdentity = { ...admin, workspaceId: winner };
      expect(
        (await pool.query('SELECT * FROM dialer_workspace_subscriptions')).rows,
      ).toHaveLength(1);
      await pool.query(
        "UPDATE dialer_team_seats SET status='disabled' WHERE workspace_id=$1",
        [winner],
      );
      await checkout.claim(winnerIdentity, {
        purchaseId: id,
        claimToken: token,
      });
      expect(
        (
          await pool.query(
            'SELECT status FROM dialer_team_seats WHERE workspace_id=$1',
            [winner],
          )
        ).rows[0].status,
      ).toBe('disabled');
      await pool.query(
        "UPDATE dialer_team_seats SET status='active' WHERE workspace_id=$1",
        [winner],
      );
      expect(
        (await pool.query('SELECT * FROM dialer_prepaid_minute_grants')).rows,
      ).toHaveLength(1);
      await expect(
        checkout.claim(
          {
            ...admin,
            workspaceId:
              winner === 'workspace-a' ? 'workspace-b' : 'workspace-a',
          },
          { purchaseId: id, claimToken: token },
        ),
      ).rejects.toThrow('PURCHASE_ALREADY_CLAIMED');
      const catalog = (await checkout.catalogFor(winnerIdentity))!;
      expect(catalog.plans.standard.priceCents).toBe(14900);
      expect(catalog.plans.standard.includedMinutes).toBe(5600);
      expect(catalog.includedNumbersPerSeat).toBe(10);
      await pool.query(
        "INSERT INTO dialer_workspace_subscriptions(workspace_id,provider_subscription_id,status) VALUES('legacy-workspace','sub_legacy_existing','active')",
      );
      expect(
        await checkout.catalogFor({
          ...admin,
          workspaceId: 'legacy-workspace',
        }),
      ).toBeNull();
      expect(baseCatalog.plans.standard.priceCents).toBe(9900);
      const commercial = createCommercialApplication({
        database,
        catalog: baseCatalog,
        publicCheckout: checkout,
      });
      const dashboard = (await Effect.runPromise(
        commercial.dashboard(winnerIdentity),
      )) as { publicPurchase: { recurringCents: number } };
      expect(dashboard.publicPurchase.recurringCents).toBe(1077600);
      await expect(
        Effect.runPromise(commercial.createCheckout(winnerIdentity, {})),
      ).rejects.toThrow('PUBLIC_PLAN_USE_BILLING_PORTAL');

      await pool.query(
        `INSERT INTO dialer_usage_events(workspace_id,source_type,source_id,user_id,seat_id,metric,quantity,provider_cost_micros,occurred_at)
    VALUES($1,'fixture','call-1',$2,$2,'connected_minutes',5100,0,now())`,
        [winner, admin.userId],
      );
      const afterUsage = (await checkout.catalogFor(winnerIdentity))!;
      expect(afterUsage.plans.standard.includedMinutes).toBe(5600);
      expect(
        (await checkout.catalogFor({
          ...winnerIdentity,
          userId: 'second-rep',
        }))!.plans.standard.includedMinutes,
      ).toBe(5500);

      const limits = await Promise.allSettled(
        Array.from({ length: 21 }, () => store.rateLimit('rate-fixture')),
      );
      expect(
        limits.filter((result) => result.status === 'fulfilled'),
      ).toHaveLength(20);
      session.subscription!.items[0].quantity = 6;
      await expect(checkout.status(id, token)).rejects.toThrow(
        'PURCHASE_SUBSCRIPTION_ITEMS_MISMATCH',
      );
      expect(
        (
          await pool.query(
            'SELECT status FROM dialer_workspace_subscriptions WHERE workspace_id=$1',
            [winner],
          )
        ).rows[0].status,
      ).toBe('incomplete');
      session.subscription!.items[0].quantity = 5;
      await checkout.status(id, token);
      // The later reconciler owns the write, even if an older provider read returns last.
      const pending: Array<(value: PublicSession) => void> = [];
      retrieveOverride = () => new Promise((resolve) => pending.push(resolve));
      const first = checkout.status(id, token).catch((error) => error);
      while (pending.length < 1) await Bun.sleep(2);
      const second = checkout.status(id, token);
      while (pending.length < 2) await Bun.sleep(2);
      const canceled = structuredClone(session);
      canceled.subscription!.status = 'canceled';
      pending[1](canceled);
      await second;
      pending[0](structuredClone(session));
      expect((await first).message).toContain(
        'PURCHASE_RECONCILIATION_PENDING',
      );
      expect(
        (
          await pool.query(
            'SELECT status FROM dialer_workspace_subscriptions WHERE workspace_id=$1',
            [winner],
          )
        ).rows[0].status,
      ).toBe('canceled');
      retrieveOverride = undefined;
      session.subscription!.status = 'canceled';
      await checkout.webhook({
        id: 'evt_late_active',
        type: 'customer.subscription.updated',
        data: { object: { metadata: { enrollmentId: id }, status: 'active' } },
      });
      expect(
        (
          await pool.query(
            'SELECT status FROM dialer_workspace_subscriptions WHERE workspace_id=$1',
            [winner],
          )
        ).rows[0].status,
      ).toBe('canceled');
      expect(
        await checkout.webhook({
          id: 'evt_legacy',
          type: 'customer.subscription.updated',
          data: { object: { id: 'sub_legacy' } },
        }),
      ).toBe(false);
      await expect(
        checkout.claim(winnerIdentity, { purchaseId: id, claimToken: token }),
      ).rejects.toThrow('PURCHASE_NOT_PAID');
      const secondId = randomUUID(),
        secondToken = randomBytes(32).toString('base64url');
      const secondResult = await checkout.create(
        {
          version: 1,
          requestId: secondId,
          claimToken: secondToken,
          selection: {
            plan: 'professional',
            billing: 'monthly',
            seats: 1,
            mercurySeats: 0,
            minutePack: 0,
            numberPack: 0,
          },
        },
        context,
      );
      const secondSession = sessions.get('cs_' + secondId)!;
      secondSession.status = 'complete';
      secondSession.paymentStatus = 'paid';
      await pool.query(
        "INSERT INTO dialer_workspace_subscriptions(workspace_id,provider_customer_id,provider_subscription_id,status) VALUES('legacy-active','cus_legacy','sub_legacy','active')",
      );
      await expect(
        checkout.claim(
          { ...admin, workspaceId: 'legacy-active' },
          { purchaseId: secondId, claimToken: secondToken },
        ),
      ).rejects.toThrow('SUBSCRIPTION_ALREADY_EXISTS');
      expect((await store.get(secondId))!.claimed_workspace_id).toBeNull();
      expect(
        (
          await pool.query(
            "SELECT provider_subscription_id FROM dialer_workspace_subscriptions WHERE workspace_id='legacy-active'",
          )
        ).rows[0].provider_subscription_id,
      ).toBe('sub_legacy');
      await checkout.claim(
        { ...admin, workspaceId: 'new-professional', role: 'OWNER' },
        {
          purchaseId: secondId,
          claimToken: secondToken,
          workspaceId: 'forged-tenant',
        },
      );
      const professional = (await checkout.catalogFor({
        ...admin,
        workspaceId: 'new-professional',
      }))!;
      expect(professional.plans.single.includedMinutes).toBe(1000);
      expect(professional.plans.single.maxNumbersPerSeat).toBe(3);
      expect(professional.plans.single.predictive).toBe(false);
      expect(professional.plans.single.parallelDialing).toBe(true);
      expect((await store.get(secondId))!.claimed_workspace_id).toBe(
        'new-professional',
      );
      expect(secondResult.url).toContain('checkout.stripe.com');
      const mismatched = createPublicCheckout({
        store,
        baseCatalog,
        rateLimitSecret: 'fixture',
        installUrl: 'https://marketplace.leadconnectorhq.com/',
        provider: {
          ...provider,
          listPrices: async () =>
            prices.map((p, index) =>
              index === 0 ? { ...p, unitAmount: 1 } : p,
            ),
        },
      });
      await expect(mismatched.ready()).rejects.toThrow(
        'CHECKOUT_PRICE_CATALOG_MISMATCH',
      );
    } finally {
      await pool?.end();
      if (started && pgCtl)
        await run([
          pgCtl,
          '-D',
          join(root, 'postgres'),
          '-m',
          'immediate',
          '-w',
          'stop',
        ]);
      await rm(root, { recursive: true, force: true });
    }
  }, 30000);
});
