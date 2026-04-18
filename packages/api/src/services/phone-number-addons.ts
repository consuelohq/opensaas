import * as Sentry from '@sentry/node';
import { getSharedPool } from '../shared/db.js';

type PhoneNumberAddOnEntry = {
  quantity: number;
  status: string;
  subscriptionId: string;
};

export type PhoneNumberAddOnStatus = {
  canPurchase: boolean;
  entries: PhoneNumberAddOnEntry[];
  totalActiveQuantity: number;
};

const SQL_GET_SUBSCRIPTION =
  'SELECT status, stripe_customer_id, phone_number_add_ons FROM workspace_subscriptions WHERE workspace_id = $1';

const SQL_UPDATE_PHONE_NUMBER_ADD_ONS =
  'UPDATE workspace_subscriptions SET phone_number_add_ons = $2, updated_at = NOW() WHERE workspace_id = $1';

const getLogger = async () => {
  const { createLogger } = await import('@consuelo/logger');
  return createLogger('phone-number-addons');
};

const getStripe = async () => {
  const { default: Stripe } = await import('stripe');
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('STRIPE_SECRET_KEY not configured');
  return new Stripe(key);
};

const getSingleNumberPriceId = (): string => {
  const priceId = process.env.STRIPE_PRICE_PHONE_NUMBER_MONTHLY ?? '';
  if (priceId.length === 0) {
    throw new Error('STRIPE_PRICE_PHONE_NUMBER_MONTHLY not configured');
  }
  return priceId;
};

const normalizeEntries = (value: unknown): PhoneNumberAddOnEntry[] => {
  if (!Array.isArray(value)) return [];

  return value.flatMap((entry) => {
    if (typeof entry !== 'object' || entry === null) return [];

    const typedEntry = entry as Record<string, unknown>;
    const subscriptionId = typedEntry.subscriptionId;
    const status = typedEntry.status;
    const quantity = typedEntry.quantity;

    if (
      typeof subscriptionId !== 'string' ||
      typeof status !== 'string' ||
      typeof quantity !== 'number'
    ) {
      return [];
    }

    return [{ quantity, status, subscriptionId }];
  });
};

export const getPhoneNumberAddOnStatus = async (
  workspaceId: string,
): Promise<PhoneNumberAddOnStatus> => {
  try {
    const pool = await getSharedPool();
    const { rows } = await pool.query(SQL_GET_SUBSCRIPTION, [workspaceId]);
    const row = rows[0] as
      | {
          phone_number_add_ons?: unknown;
          status?: string;
        }
      | undefined;

    const entries = normalizeEntries(row?.phone_number_add_ons);
    const totalActiveQuantity = entries.reduce((total, entry) => {
      return entry.status === 'active' ? total + entry.quantity : total;
    }, 0);

    return {
      canPurchase: row?.status === 'active' || row?.status === 'trialing',
      entries,
      totalActiveQuantity,
    };
  } catch (err: unknown) {
    Sentry.captureException(err);
    throw err;
  }
};

export const createPhoneNumberAddonCheckout = async (
  workspaceId: string,
  quantity: number,
  successUrl: string,
  cancelUrl: string,
): Promise<{ url: string }> => {
  try {
    if (!Number.isInteger(quantity) || quantity < 1) {
      throw Object.assign(new Error('quantity must be a positive integer'), {
        status: 400,
      });
    }

    const pool = await getSharedPool();
    const { rows } = await pool.query(SQL_GET_SUBSCRIPTION, [workspaceId]);
    const row = rows[0] as
      | {
          status?: string;
          stripe_customer_id?: string;
        }
      | undefined;

    if (!row || (row.status !== 'active' && row.status !== 'trialing')) {
      throw Object.assign(new Error('No active subscription'), { status: 400 });
    }

    const stripe = await getStripe();
    const priceId = getSingleNumberPriceId();
    let customerId = row.stripe_customer_id ?? null;

    if (customerId === null) {
      const customer = await stripe.customers.create({
        metadata: { workspaceId },
      });
      customerId = customer.id;
    }

    const session = await stripe.checkout.sessions.create({
      cancel_url: cancelUrl,
      customer: customerId,
      line_items: [{ price: priceId, quantity }],
      metadata: {
        quantity: String(quantity),
        type: 'phone_number_add_on',
        workspaceId,
      },
      mode: 'subscription',
      success_url: successUrl,
      subscription_data: {
        metadata: {
          quantity: String(quantity),
          type: 'phone_number_add_on',
          workspaceId,
        },
      },
    });

    if (!session.url) {
      throw new Error('Stripe checkout session missing url');
    }

    const logger = await getLogger();
    logger.info('checkout.created', {
      quantity,
      sessionId: session.id,
      workspaceId,
    });

    return { url: session.url };
  } catch (err: unknown) {
    Sentry.captureException(err);
    throw err;
  }
};

export const savePhoneNumberAddonSubscription = async (
  workspaceId: string,
  subscriptionId: string,
  quantity: number,
  status: string,
): Promise<void> => {
  try {
    const pool = await getSharedPool();
    const { rows } = await pool.query(SQL_GET_SUBSCRIPTION, [workspaceId]);
    const row = rows[0] as
      | {
          phone_number_add_ons?: unknown;
        }
      | undefined;

    const entries = normalizeEntries(row?.phone_number_add_ons).filter(
      (entry) => entry.subscriptionId !== subscriptionId,
    );

    entries.push({ quantity, status, subscriptionId });

    await pool.query(SQL_UPDATE_PHONE_NUMBER_ADD_ONS, [
      workspaceId,
      JSON.stringify(entries),
    ]);

    const logger = await getLogger();
    logger.info('subscription.saved', {
      quantity,
      status,
      subscriptionId,
      workspaceId,
    });
  } catch (err: unknown) {
    Sentry.captureException(err);
    throw err;
  }
};

export const removePhoneNumberAddonSubscription = async (
  workspaceId: string,
  subscriptionId: string,
): Promise<void> => {
  try {
    const pool = await getSharedPool();
    const { rows } = await pool.query(SQL_GET_SUBSCRIPTION, [workspaceId]);
    const row = rows[0] as
      | {
          phone_number_add_ons?: unknown;
        }
      | undefined;

    const entries = normalizeEntries(row?.phone_number_add_ons).filter(
      (entry) => entry.subscriptionId !== subscriptionId,
    );

    await pool.query(SQL_UPDATE_PHONE_NUMBER_ADD_ONS, [
      workspaceId,
      JSON.stringify(entries),
    ]);

    const logger = await getLogger();
    logger.info('subscription.removed', {
      subscriptionId,
      workspaceId,
    });
  } catch (err: unknown) {
    Sentry.captureException(err);
    throw err;
  }
};
