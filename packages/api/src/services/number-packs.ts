import * as Sentry from '@sentry/node';
import { getSharedPool } from '../shared/db.js';

const PACK_PRICE_IDS = {
  5: {
    month: process.env.STRIPE_PRICE_PACK_5_MONTHLY ?? '',
    year: process.env.STRIPE_PRICE_PACK_5_ANNUAL ?? '',
  },
  10: {
    month: process.env.STRIPE_PRICE_PACK_10_MONTHLY ?? '',
    year: process.env.STRIPE_PRICE_PACK_10_ANNUAL ?? '',
  },
  50: {
    month: process.env.STRIPE_PRICE_PACK_50_MONTHLY ?? '',
    year: process.env.STRIPE_PRICE_PACK_50_ANNUAL ?? '',
  },
} as const;

export type NumberPackSize = 5 | 10 | 50;
export type BillingInterval = 'month' | 'year';

export type NumberPackStatus = {
  packs: {
    5: { count: number; subscriptionIds: string[] };
    10: { count: number; subscriptionIds: string[] };
    50: { count: number; subscriptionIds: string[] };
  };
  totalPackSlots: number;
  canPurchase: boolean;
};

type NumberPackEntry = {
  packSize: NumberPackSize;
  subscriptionId: string;
  status: string;
};

const SQL_GET_SUBSCRIPTION =
  'SELECT status, number_packs FROM workspace_subscriptions WHERE workspace_id = $1';

const SQL_UPDATE_NUMBER_PACKS =
  'UPDATE workspace_subscriptions SET number_packs = $2, updated_at = NOW() WHERE workspace_id = $1';

const getStripe = async () => {
  const { default: Stripe } = await import('stripe');
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('STRIPE_SECRET_KEY not configured');
  return new Stripe(key);
};

export const getPackPriceId = (
  packSize: NumberPackSize,
  interval: BillingInterval,
): string | null => {
  const prices = PACK_PRICE_IDS[packSize];
  if (!prices) return null;
  return prices[interval] || null;
};

export const getNumberPackStatus = async (
  workspaceId: string,
): Promise<NumberPackStatus> => {
  try {
    const pool = await getSharedPool();
    const { rows } = await pool.query(SQL_GET_SUBSCRIPTION, [workspaceId]);
    const sub = rows[0] as
      | { status: string; number_packs: NumberPackEntry[] }
      | undefined;

    const packs: NumberPackStatus['packs'] = {
      5: { count: 0, subscriptionIds: [] },
      10: { count: 0, subscriptionIds: [] },
      50: { count: 0, subscriptionIds: [] },
    };

    let totalPackSlots = 0;

    if (sub?.number_packs && Array.isArray(sub.number_packs)) {
      for (const pack of sub.number_packs) {
        if (pack.status === 'active' && packs[pack.packSize]) {
          packs[pack.packSize].count++;
          packs[pack.packSize].subscriptionIds.push(pack.subscriptionId);
          totalPackSlots += pack.packSize;
        }
      }
    }

    const canPurchase = sub?.status === 'active' || sub?.status === 'trialing';

    return { packs, totalPackSlots, canPurchase };
  } catch (err: unknown) {
    Sentry.captureException(err);
    throw err;
  }
};

export const createNumberPackCheckout = async (
  workspaceId: string,
  packSize: NumberPackSize,
  billingInterval: BillingInterval,
  successUrl: string,
  cancelUrl: string,
): Promise<{ url: string }> => {
  try {
    const pool = await getSharedPool();
    const { rows } = await pool.query(
      'SELECT status, stripe_customer_id FROM workspace_subscriptions WHERE workspace_id = $1',
      [workspaceId],
    );
    const sub = rows[0] as
      | { status: string; stripe_customer_id: string }
      | undefined;

    if (!sub || (sub.status !== 'active' && sub.status !== 'trialing')) {
      throw Object.assign(new Error('No active subscription'), { status: 400 });
    }

    const priceId = getPackPriceId(packSize, billingInterval);
    if (!priceId) {
      throw Object.assign(new Error('Invalid pack size or billing interval'), {
        status: 400,
      });
    }

    const stripe = await getStripe();

    let customerId = sub.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({
        metadata: { workspaceId },
      });
      customerId = customer.id;
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        workspaceId,
        type: 'number_pack',
        packSize: String(packSize),
      },
    });

    if (!session.url) {
      throw new Error('Stripe checkout session missing url');
    }

    const { createLogger } = await import('@consuelo/logger');
    createLogger('number-packs').info('checkout.created', {
      workspaceId,
      packSize,
      billingInterval,
      sessionId: session.id,
    });

    return { url: session.url };
  } catch (err: unknown) {
    Sentry.captureException(err);
    throw err;
  }
};

export const addNumberPack = async (
  workspaceId: string,
  packSize: NumberPackSize,
  subscriptionId: string,
  status: string = 'active',
): Promise<void> => {
  try {
    const pool = await getSharedPool();
    const { rows } = await pool.query(SQL_GET_SUBSCRIPTION, [workspaceId]);
    const sub = rows[0] as { number_packs: NumberPackEntry[] } | undefined;

    const packs: NumberPackEntry[] = sub?.number_packs || [];
    packs.push({ packSize, subscriptionId, status });

    await pool.query(SQL_UPDATE_NUMBER_PACKS, [
      workspaceId,
      JSON.stringify(packs),
    ]);

    const { createLogger } = await import('@consuelo/logger');
    createLogger('number-packs').info('pack.added', {
      workspaceId,
      packSize,
      subscriptionId,
    });
  } catch (err: unknown) {
    Sentry.captureException(err);
    throw err;
  }
};

export const removeNumberPack = async (
  workspaceId: string,
  subscriptionId: string,
): Promise<void> => {
  try {
    const pool = await getSharedPool();
    const { rows } = await pool.query(SQL_GET_SUBSCRIPTION, [workspaceId]);
    const sub = rows[0] as { number_packs: NumberPackEntry[] } | undefined;

    if (!sub?.number_packs) return;

    const packs = sub.number_packs.filter(
      (p) => p.subscriptionId !== subscriptionId,
    );

    await pool.query(SQL_UPDATE_NUMBER_PACKS, [
      workspaceId,
      JSON.stringify(packs),
    ]);

    const { createLogger } = await import('@consuelo/logger');
    createLogger('number-packs').info('pack.removed', {
      workspaceId,
      subscriptionId,
    });
  } catch (err: unknown) {
    Sentry.captureException(err);
    throw err;
  }
};
