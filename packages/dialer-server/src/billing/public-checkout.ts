import { authorizeCommercialAction } from '../teams/application';
import { normalizeAsyncError } from '../errors/normalize-async-error';
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import type { DialerIdentity } from '../contracts';
import type { DialerPlanCatalog } from '../plans/catalog';
import type { StripeCommercialEvent } from './stripe';
import {
  publicCheckoutCatalog,
  publicPriceLookupKey,
  quotePublicCheckout,
  type PublicSelection,
} from './public-checkout-catalog';
import { createPublicCheckoutStore } from './public-checkout-store';

export type PublicPrice = {
  id: string;
  lookupKey: string;
  unitAmount: number;
  currency: string;
  interval: string | null;
};
export type PublicSubscription = {
  id: string;
  customerId: string;
  status: string;
  cancelAtPeriodEnd: boolean;
  metadata: Record<string, string>;
  items: Array<{ id: string; priceId: string; quantity: number }>;
};
export type PublicSession = {
  id: string;
  status: string | null;
  paymentStatus: string;
  metadata: Record<string, string>;
  customerId: string | null;
  subscription: PublicSubscription | null;
};
export type PublicCheckoutProvider = {
  listPrices: (lookupKeys: string[]) => Promise<PublicPrice[]>;
  createSession: (
    parameters: Record<string, unknown>,
    idempotencyKey: string,
  ) => Promise<{ id: string; url: string | null }>;
  retrieveSession: (id: string) => Promise<PublicSession>;
};
type Store = ReturnType<typeof createPublicCheckoutStore>;
const record = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
const uuid = (value: unknown): string => {
  if (
    typeof value !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    )
  )
    throw new Error('INVALID_PURCHASE_ID');
  return value.toLowerCase();
};
const tokenHash = (value: unknown): string => {
  if (
    typeof value !== 'string' ||
    !/^[A-Za-z0-9_-]{43}$/.test(value) ||
    value.length !== 43
  )
    throw new Error('INVALID_PURCHASE_CLAIM');
  return createHash('sha256').update(value).digest('hex');
};
const verifyClaim = (
  purchase: Record<string, unknown> | undefined,
  token: unknown,
) => {
  const hash = tokenHash(token),
    stored = String(purchase?.claim_hash ?? '');
  if (
    !purchase ||
    stored.length !== 64 ||
    !timingSafeEqual(Buffer.from(hash), Buffer.from(stored))
  )
    throw new Error('PURCHASE_NOT_FOUND');
  return hash;
};
const selectionOnly = (value: unknown): PublicSelection => {
  const s = record(value);
  return quotePublicCheckout({
    plan: s.plan,
    billing: s.billing,
    seats: s.seats,
    mercurySeats: s.mercurySeats,
    minutePack: s.minutePack,
    numberPack: s.numberPack,
  }).selection;
};
const trustedOrigin = (origin: string) => {
  try {
    const url = new URL(origin);
    return (
      url.origin === origin &&
      url.protocol === 'https:' &&
      ([
        'https://consuelohq.com',
        'https://dialer.consuelohq.com',
        'https://consuelo-dialer-website-preview.pages.dev',
      ].includes(origin) ||
        /^[a-z0-9-]+\.consuelo-dialer-website-preview\.pages\.dev$/.test(
          url.hostname,
        ))
    );
  } catch {
    return false;
  }
};
export { trustedOrigin as isPublicCheckoutOrigin };

export const createPublicCheckout = (input: {
  store: Store;
  provider: PublicCheckoutProvider;
  rateLimitSecret: string;
  installUrl: string;
  baseCatalog: DialerPlanCatalog;
  websiteOrigin?: string;
}) => {
  const websiteOrigin = input.websiteOrigin ?? 'https://consuelohq.com';
  if (!trustedOrigin(websiteOrigin))
    throw new Error('CHECKOUT_WEBSITE_ORIGIN_INVALID');
  const launchCatalog = () => {
    const catalog = structuredClone(input.baseCatalog);
    const names = {
      professional: 'Professional',
      agency: 'Agency',
      enterprise: 'Enterprise',
    };
    for (const [code, plan] of Object.entries(publicCheckoutCatalog)) {
      Object.assign(catalog.plans[plan.legacyCode], {
        name: names[code as keyof typeof names],
        priceCents: plan.monthlyCents,
        maxNumbersPerSeat: plan.numbers,
        includedMinutes: plan.minutes,
        providerBudgetCents: null,
        predictive: code !== 'professional',
        recordings: code !== 'professional',
        transcripts: code !== 'professional',
        parallelDialing: true,
      });
    }
    catalog.trial = {
      ...catalog.trial,
      includedMinutes: 100,
      maxSeats: 1,
      maxNumbers: 1,
      planCode: 'single',
    };
    catalog.includedNumbersPerSeat = 1;
    catalog.additionalNumberPriceCents = 300;
    return catalog;
  };
  let pricePromise: Promise<Map<string, PublicPrice>> | undefined;
  const prices = () =>
    (pricePromise ??= (async () => {
      try {
        const definitions = [
          ...Object.entries(publicCheckoutCatalog).flatMap(([code, p]) =>
            ['monthly', 'annual'].map((billing) => ({
              code,
              billing,
              cents: p.monthlyCents * (billing === 'annual' ? 12 : 1),
            })),
          ),
          ...['monthly', 'annual'].map((billing) => ({
            code: 'mercury',
            billing,
            cents: 2500 * (billing === 'annual' ? 12 : 1),
          })),
          ...Object.entries({ 1: 300, 10: 2800, 50: 12500 }).flatMap(
            ([n, cents]) =>
              ['monthly', 'annual'].map((billing) => ({
                code: 'numbers-' + n,
                billing,
                cents: cents * (billing === 'annual' ? 12 : 1),
              })),
          ),
          ...Object.entries({ 100: 1000, 600: 5000, 1400: 10000 }).map(
            ([n, cents]) => ({ code: 'minutes-' + n, billing: 'once', cents }),
          ),
        ];
        const found = await input.provider.listPrices(
          definitions.map((d) => publicPriceLookupKey(d.code, d.billing)),
        );
        const map = new Map<string, PublicPrice>();
        for (const d of definitions) {
          const lookup = publicPriceLookupKey(d.code, d.billing),
            matches = found.filter((p) => p.lookupKey === lookup);
          if (
            matches.length !== 1 ||
            matches[0].unitAmount !== d.cents ||
            matches[0].currency !== 'usd' ||
            matches[0].interval !==
              (d.billing === 'annual'
                ? 'year'
                : d.billing === 'monthly'
                  ? 'month'
                  : null)
          )
            throw new Error('CHECKOUT_PRICE_CATALOG_MISMATCH');
          map.set(lookup, matches[0]);
        }
        return map;
      } catch (cause: unknown) {
        throw normalizeAsyncError(cause);
      }
    })().catch((cause) => {
      pricePromise = undefined;
      throw cause;
    }));
  const reconcile = async (purchase: Record<string, unknown>) => {
    try {
      if (typeof purchase.provider_session_id !== 'string')
        throw new Error('PURCHASE_RECONCILIATION_PENDING');
      const generation = await input.store.generation(String(purchase.id));
      const session = await input.provider.retrieveSession(
        purchase.provider_session_id,
      );
      if (session.metadata.enrollmentId !== purchase.id)
        throw new Error('PURCHASE_PROVIDER_MISMATCH');
      if (
        session.status !== 'complete' ||
        session.paymentStatus !== 'paid' ||
        !session.subscription
      ) {
        return {
          paid: false,
          generation,
          claimed: !!purchase.claimed_workspace_id,
          status: session.status === 'expired' ? 'expired' : 'pending',
        };
      }
      const subscription = session.subscription;
      if (
        subscription.metadata.enrollmentId !== purchase.id ||
        !session.customerId ||
        session.customerId !== subscription.customerId
      )
        throw new Error('PURCHASE_PROVIDER_MISMATCH');
      const initial = selectionOnly(purchase.selection),
        map = await prices();
      const suspend = async (): Promise<never> => {
        try {
          await input.store.database.query(
            'SELECT dialer_project_public_purchase($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb,$8)',
            [
              purchase.id,
              generation,
              subscription.customerId,
              subscription.id,
              'incomplete',
              JSON.stringify(purchase.provider_items ?? []),
              JSON.stringify(purchase.entitlement_selection ?? initial),
              false,
            ],
          );
          throw new Error('PURCHASE_SUBSCRIPTION_ITEMS_MISMATCH');
        } catch (cause: unknown) {
          throw normalizeAsyncError(cause);
        }
      };
      const recurring = quotePublicCheckout({
        ...initial,
        minutePack: 0,
      }).items;
      if (subscription.items.length !== recurring.length) return suspend();
      const projected: Array<{
        code: string;
        id: string;
        priceId: string;
        quantity: number;
      }> = [];
      for (const item of recurring) {
        const price = map.get(publicPriceLookupKey(item.code, item.billing))!;
        const actual = subscription.items.find((i) => i.priceId === price.id);
        if (!actual || actual.quantity !== item.quantity) return suspend();
        projected.push({
          code:
            item.code === initial.plan
              ? publicCheckoutCatalog[initial.plan].legacyCode
              : item.code.startsWith('numbers-')
                ? 'additional-number'
                : 'mercury',
          id: actual.id,
          priceId: actual.priceId,
          quantity: item.code.startsWith('numbers-')
            ? initial.numberPack
            : actual.quantity,
        });
      }
      const entitlement = {
        ...initial,
        cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
      };
      const result = await input.store.database.query(
        'SELECT dialer_project_public_purchase($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb,$8) AS applied',
        [
          purchase.id,
          generation,
          subscription.customerId,
          subscription.id,
          subscription.status,
          JSON.stringify(projected),
          JSON.stringify(entitlement),
          true,
        ],
      );
      if (!record(result.rows[0]).applied)
        throw new Error('PURCHASE_RECONCILIATION_PENDING');
      return {
        paid: true,
        generation,
        claimed: !!purchase.claimed_workspace_id,
        status: subscription.status,
      };
    } catch (cause: unknown) {
      throw normalizeAsyncError(cause);
    }
  };
  return {
    ready: async () => {
      try {
        await prices();
        return { ready: true };
      } catch (cause: unknown) {
        throw normalizeAsyncError(cause);
      }
    },
    create: async (
      body: unknown,
      context: { origin: string; clientAddress: string },
    ) => {
      try {
        if (!trustedOrigin(context.origin))
          throw new Error('CHECKOUT_ORIGIN_DENIED');
        const value = record(body);
        if (
          value.version !== 1 ||
          Object.keys(value).some(
            (key) =>
              !['version', 'requestId', 'selection', 'claimToken'].includes(
                key,
              ),
          )
        )
          throw new Error('INVALID_CHECKOUT_REQUEST');
        const id = uuid(value.requestId),
          hash = tokenHash(value.claimToken),
          quote = quotePublicCheckout(value.selection);
        const bucket = createHmac('sha256', input.rateLimitSecret)
          .update(
            'public-checkout:' +
              context.clientAddress +
              ':' +
              Math.floor(Date.now() / 3600000),
          )
          .digest('hex');
        const existing = await input.store.get(id);
        if (!existing) await input.store.rateLimit(bucket);
        const purchase = await input.store.begin({
          id,
          selection: quote.selection,
          claimHash: hash,
          origin: context.origin,
        });
        verifyClaim(purchase, value.claimToken);
        if (
          JSON.stringify(selectionOnly(purchase!.selection)) !==
            JSON.stringify(quote.selection) ||
          purchase!.origin !== context.origin
        )
          throw new Error('CHECKOUT_REQUEST_CONFLICT');
        if (
          Date.now() - new Date(String(purchase!.created_at)).getTime() >
          1800000
        ) {
          if (!purchase!.provider_session_id)
            throw new Error('PURCHASE_RECONCILIATION_PENDING');
          const current = await input.provider.retrieveSession(
            String(purchase!.provider_session_id),
          );
          if (current.status === 'expired')
            throw new Error('CHECKOUT_SESSION_EXPIRED');
          if (current.status === 'complete')
            throw new Error('PURCHASE_ALREADY_PAID');
          throw new Error('PURCHASE_RECONCILIATION_PENDING');
        }
        const map = await prices();
        const cancel = new URL('/get-started', context.origin);
        cancel.search = new URLSearchParams({
          plan: quote.selection.plan,
          billing: quote.selection.billing,
          seats: String(quote.selection.seats),
          checkout: 'cancelled',
          purchase: id,
        }).toString();
        const result = await input.provider.createSession(
          {
            mode: 'subscription',
            client_reference_id: id,
            line_items: quote.items.map((item) => ({
              price: map.get(publicPriceLookupKey(item.code, item.billing))!.id,
              quantity: item.quantity,
            })),
            metadata: { enrollmentId: id, catalogVersion: 'launch-20261030' },
            subscription_data: {
              metadata: { enrollmentId: id, catalogVersion: 'launch-20261030' },
            },
            success_url: new URL('/get-started?purchase=' + id, context.origin)
              .href,
            cancel_url: cancel.href,
            expires_at:
              Math.floor(
                new Date(String(purchase!.created_at)).getTime() / 1000,
              ) + 1800,
          },
          'public-checkout:' + id,
        );
        if (
          !result.url ||
          new URL(result.url).origin !== 'https://checkout.stripe.com'
        )
          throw new Error('CHECKOUT_PROVIDER_URL_INVALID');
        await input.store.saveSession(id, result.id);
        return { id, url: result.url };
      } catch (cause: unknown) {
        throw normalizeAsyncError(cause);
      }
    },
    status: async (idValue: unknown, token: unknown) => {
      try {
        const purchase = await input.store.get(uuid(idValue));
        verifyClaim(purchase, token);
        const result = await reconcile(purchase!);
        return {
          purchaseId: purchase!.id,
          paid: result.paid,
          status: result.status,
          claimed: result.claimed,
          installUrl: result.paid ? input.installUrl : null,
        };
      } catch (cause: unknown) {
        throw normalizeAsyncError(cause);
      }
    },
    claim: async (identity: DialerIdentity, body: unknown) => {
      try {
        authorizeCommercialAction({
          identity: {
            workspaceId: identity.workspaceId,
            userId: identity.userId,
            role: identity.role ?? 'user',
          },
          targetWorkspaceId: identity.workspaceId,
          action: 'billing.manage',
        });
        const value = record(body),
          id = uuid(value.purchaseId);
        const purchase = await input.store.get(id),
          hash = verifyClaim(purchase, value.claimToken);
        const result = await reconcile(purchase!);
        if (!result.paid || result.status !== 'active')
          throw new Error('PURCHASE_NOT_PAID');
        const claim = await input.store.database.query(
          'SELECT dialer_claim_public_purchase($1,$2,$3,$4,$5) AS result',
          [id, hash, identity.workspaceId, identity.userId, result.generation],
        );
        return record(claim.rows[0]).result;
      } catch (cause: unknown) {
        throw normalizeAsyncError(cause);
      }
    },
    webhook: async (event: StripeCommercialEvent) => {
      const object = record(record(event.data).object),
        metadata = record(object.metadata);
      let purchase =
        typeof metadata.enrollmentId === 'string'
          ? await input.store.get(metadata.enrollmentId)
          : undefined;
      if (!purchase) {
        const parent = record(object.parent),
          details = record(parent.subscription_details);
        const subscription =
          typeof object.subscription === 'string'
            ? object.subscription
            : typeof details.subscription === 'string'
              ? details.subscription
              : typeof object.id === 'string' && object.id.startsWith('sub_')
                ? object.id
                : '';
        if (subscription)
          purchase = await input.store.findSubscription(subscription);
      }
      if (!purchase) return false;
      await input.store.database.query(
        `INSERT INTO dialer_public_purchase_events(provider_event_id,purchase_id,event_type)
     VALUES($1,$2,$3) ON CONFLICT(provider_event_id) DO UPDATE SET attempts=dialer_public_purchase_events.attempts+1`,
        [event.id, purchase.id, event.type],
      );
      try {
        await reconcile(purchase);
        await input.store.database.query(
          'UPDATE dialer_public_purchase_events SET processed_at=now(),last_error_code=NULL WHERE provider_event_id=$1',
          [event.id],
        );
      } catch (cause: unknown) {
        await input.store.database.query(
          "UPDATE dialer_public_purchase_events SET last_error_code='PUBLIC_PURCHASE_RECONCILIATION_FAILED' WHERE provider_event_id=$1",
          [event.id],
        );
        throw cause;
      }
      return true;
    },
    catalogFor: async (
      identity: DialerIdentity,
    ): Promise<DialerPlanCatalog | null> => {
      try {
        const purchase = await input.store.claimed(identity.workspaceId);
        if (!purchase) {
          const subscription = record(
            (
              await input.store.database.query(
                'SELECT provider_subscription_id,status FROM dialer_workspace_subscriptions WHERE workspace_id=$1',
                [identity.workspaceId],
              )
            ).rows[0],
          );
          if (
            subscription.provider_subscription_id &&
            !['canceled', 'incomplete_expired'].includes(
              String(subscription.status),
            )
          )
            return null;
          return launchCatalog();
        }
        const s = selectionOnly(purchase.entitlement_selection);
        const definition = publicCheckoutCatalog[s.plan],
          catalog = launchCatalog();
        for (const [code, plan] of Object.entries(publicCheckoutCatalog)) {
          const legacy = catalog.plans[plan.legacyCode];
          legacy.priceCents = plan.monthlyCents;
          if (code === s.plan) {
            const items = purchase.provider_items as Array<{
              code: string;
              priceId: string;
            }>;
            legacy.stripePriceId =
              items.find((item) => item.code === plan.legacyCode)?.priceId ??
              legacy.stripePriceId;
          }
          legacy.maxNumbersPerSeat = plan.numbers;
          legacy.includedMinutes = plan.minutes;
          legacy.providerBudgetCents = null;
          legacy.predictive = code !== 'professional';
          legacy.recordings = code !== 'professional';
          legacy.transcripts = code !== 'professional';
          legacy.parallelDialing = true;
        }
        catalog.includedNumbersPerSeat = definition.numbers;
        catalog.additionalNumberPriceCents = 300;

        const credits = (
          await input.store.database.query(
            `WITH monthly_usage AS (
     SELECT user_id,date_trunc('month',occurred_at) AS month,SUM(quantity) AS used
     FROM dialer_usage_events WHERE workspace_id=$1 AND occurred_at>=date_trunc('month',$3::timestamptz)
     GROUP BY user_id,date_trunc('month',occurred_at)
    ) SELECT
      (SELECT COALESCE(SUM(minutes),0) FROM dialer_prepaid_minute_grants WHERE workspace_id=$1) AS granted,
      COALESCE(SUM(GREATEST(used-$2,0)),0) AS consumed,
      COALESCE(SUM(GREATEST(used-$2,0)) FILTER (WHERE user_id=$4 AND month=date_trunc('month',now())),0) AS current_overage
    FROM monthly_usage`,
            [
              identity.workspaceId,
              definition.minutes,
              purchase.created_at,
              identity.userId,
            ],
          )
        ).rows[0];
        const row = record(credits),
          remaining = Math.max(0, Number(row.granted) - Number(row.consumed));
        catalog.plans[definition.legacyCode].includedMinutes =
          definition.minutes + remaining + Number(row.current_overage);
        return catalog;
      } catch (cause: unknown) {
        throw normalizeAsyncError(cause);
      }
    },
    websiteCheckout: (identity: DialerIdentity, body: unknown) => {
      authorizeCommercialAction({
        identity: {
          workspaceId: identity.workspaceId,
          userId: identity.userId,
          role: identity.role ?? 'user',
        },
        targetWorkspaceId: identity.workspaceId,
        action: 'billing.manage',
      });
      const quantities = record(record(body).quantities);
      const mapping = {
        single: 'professional',
        standard: 'agency',
        power: 'enterprise',
      } as const;
      const choices = Object.entries(mapping).map(([legacy, plan]) => ({
        plan,
        seats: Number(quantities[legacy] ?? 0),
      }));
      if (choices.some((c) => !Number.isSafeInteger(c.seats) || c.seats < 0))
        throw new Error('INVALID_SEAT_QUANTITY');
      const selected = choices.filter((c) => c.seats > 0);
      if (selected.length !== 1) throw new Error('CHOOSE_ONE_PLAN_ON_WEBSITE');
      const numbers = Number(quantities.additionalNumber ?? 0);
      const selection = quotePublicCheckout({
        plan: selected[0].plan,
        billing: 'monthly',
        seats: selected[0].seats,
        mercurySeats: 0,
        minutePack: 0,
        numberPack: numbers,
      }).selection;
      const url = new URL('/get-started', websiteOrigin);
      url.search = new URLSearchParams({
        plan: selection.plan,
        billing: selection.billing,
        seats: String(selection.seats),
        ...(numbers ? { addon: 'numbers-' + numbers } : {}),
      }).toString();
      return { id: 'website-selection', url: url.href };
    },
    summaryFor: async (workspaceId: string) => {
      try {
        const purchase = await input.store.claimed(workspaceId);
        if (!purchase) return null;
        const selection = selectionOnly(purchase.entitlement_selection);
        const quote = quotePublicCheckout(selection);
        return {
          ...selection,
          recurringCents:
            quote.totalCents -
            (selection.minutePack
              ? { 100: 1000, 600: 5000, 1400: 10000 }[
                  selection.minutePack as 100 | 600 | 1400
                ]
              : 0),
        };
      } catch (cause: unknown) {
        throw normalizeAsyncError(cause);
      }
    },
    isClaimed: async (workspaceId: string) => {
      try {
        return !!(await input.store.claimed(workspaceId));
      } catch (cause: unknown) {
        throw normalizeAsyncError(cause);
      }
    },
  };
};
export type PublicCheckout = ReturnType<typeof createPublicCheckout>;
