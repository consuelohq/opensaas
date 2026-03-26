import * as Sentry from '@sentry/node';
import { getSharedPool } from '../shared/db.js';
import { getWorkspaceTwilioConfig, type TwilioMode } from './twilio-config.js';
import { addNumberPack, removeNumberPack } from './number-packs.js';

const getStripe = async () => {
  const { default: Stripe } = await import('stripe');
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('STRIPE_SECRET_KEY not configured');
  return new Stripe(key);
};

const getLogger = async () => {
  const { createLogger } = await import('@consuelo/logger');
  return createLogger('subscription');
};

const PRICE_IDS = {
  baseMonthly: process.env.STRIPE_PRICE_BASE_MONTHLY ?? '',
  baseAnnual: process.env.STRIPE_PRICE_BASE_ANNUAL ?? '',
  dialerCoachMonthly: process.env.STRIPE_PRICE_DIALER_MONTHLY ?? '',
  dialerCoachAnnual: process.env.STRIPE_PRICE_DIALER_ANNUAL ?? '',
  aiAssistantMonthly: process.env.STRIPE_PRICE_AI_MONTHLY ?? '',
  aiAssistantAnnual: process.env.STRIPE_PRICE_AI_ANNUAL ?? '',
} as const;

export type BillingMode = TwilioMode;

export type AddOnKey = 'dialer-coach' | 'ai-assistant';

export type SubscriptionStatus = {
  workspaceId: string;
  mode: BillingMode;
  plan: {
    name: string;
    status: 'active' | 'trialing' | 'past_due' | 'canceled' | 'none';
    interval: 'month' | 'year' | null;
    currentPeriodEnd: string | null;
  };
  addOns: AddOnKey[];
  usage: {
    callMinutes: { used: number; limit: number | null };
    aiTokens: { used: number; limit: number | null };
  };
  byokKeys: {
    twilio: boolean;
    groq: boolean;
    openai: boolean;
  } | null;
  stripeCustomerId: string | null;
};

const SQL_GET_SUBSCRIPTION =
  'SELECT stripe_customer_id, stripe_subscription_id, status, plan_name, interval, current_period_end, add_ons FROM workspace_subscriptions WHERE workspace_id = $1';

const SQL_UPSERT_SUBSCRIPTION =
  'INSERT INTO workspace_subscriptions (workspace_id, stripe_customer_id, stripe_subscription_id, status, plan_name, interval, current_period_end, add_ons) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) ON CONFLICT (workspace_id) DO UPDATE SET stripe_customer_id = $2, stripe_subscription_id = $3, status = $4, plan_name = $5, interval = $6, current_period_end = $7, add_ons = $8, updated_at = NOW()';

const SQL_GET_USAGE =
  'SELECT COALESCE(SUM(CASE WHEN metric = $2 THEN amount ELSE 0 END), 0) AS total FROM workspace_usage WHERE workspace_id = $1 AND period_start >= $3';

const SQL_RECORD_USAGE =
  'INSERT INTO workspace_usage (workspace_id, metric, amount, period_start) VALUES ($1, $2, $3, NOW())';

export const getBillingMode = async (
  workspaceId: string,
): Promise<BillingMode> => {
  try {
    const config = await getWorkspaceTwilioConfig(workspaceId);
    return config?.mode ?? 'hosted';
  } catch (err: unknown) {
    Sentry.captureException(err);
    return 'hosted';
  }
};

export const getSubscriptionStatus = async (
  workspaceId: string,
): Promise<SubscriptionStatus> => {
  try {
    const pool = await getSharedPool();
    const mode = await getBillingMode(workspaceId);

    const { rows } = await pool.query(SQL_GET_SUBSCRIPTION, [workspaceId]);
    const sub = rows[0] as Record<string, unknown> | undefined;

    const periodStart = new Date();
    periodStart.setDate(1);
    periodStart.setHours(0, 0, 0, 0);

    const callMinutesResult = await pool.query(SQL_GET_USAGE, [
      workspaceId,
      'call_minutes',
      periodStart.toISOString(),
    ]);
    const aiTokensResult = await pool.query(SQL_GET_USAGE, [
      workspaceId,
      'ai_tokens',
      periodStart.toISOString(),
    ]);

    const callMinutesUsed = Number(
      (callMinutesResult.rows[0] as Record<string, unknown>)?.total ?? 0,
    );
    const aiTokensUsed = Number(
      (aiTokensResult.rows[0] as Record<string, unknown>)?.total ?? 0,
    );

    let byokKeys: SubscriptionStatus['byokKeys'] = null;
    if (mode === 'byok') {
      const config = await getWorkspaceTwilioConfig(workspaceId);
      byokKeys = {
        twilio: !!config?.byokAccountSidEncrypted,
        groq: !!process.env.GROQ_API_KEY,
        openai: !!process.env.OPENAI_API_KEY,
      };
    }

    return {
      workspaceId,
      mode,
      plan: {
        name: (sub?.plan_name as string) ?? 'none',
        status: (sub?.status as SubscriptionStatus['plan']['status']) ?? 'none',
        interval: (sub?.interval as 'month' | 'year') ?? null,
        currentPeriodEnd: (sub?.current_period_end as string) ?? null,
      },
      addOns: sub?.add_ons
        ? (JSON.parse(sub.add_ons as string) as AddOnKey[])
        : [],
      usage: {
        callMinutes: {
          used: callMinutesUsed,
          limit: mode === 'hosted' ? null : null,
        },
        aiTokens: {
          used: aiTokensUsed,
          limit: mode === 'hosted' ? null : null,
        },
      },
      byokKeys,
      stripeCustomerId: (sub?.stripe_customer_id as string) ?? null,
    };
  } catch (err: unknown) {
    Sentry.captureException(err);
    throw err;
  }
};

export const createCheckoutSession = async (
  workspaceId: string,
  priceIds: string[],
  successUrl: string,
  cancelUrl: string,
): Promise<{ url: string }> => {
  try {
    const stripe = await getStripe();
    const pool = await getSharedPool();
    const logger = await getLogger();

    const { rows } = await pool.query(SQL_GET_SUBSCRIPTION, [workspaceId]);
    let customerId = (rows[0] as Record<string, unknown>)
      ?.stripe_customer_id as string | undefined;

    if (!customerId) {
      const customer = await stripe.customers.create({
        metadata: { workspaceId },
      });
      customerId = customer.id;
    }

    const lineItems = priceIds.map((priceId) => ({
      price: priceId,
      quantity: 1,
    }));

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: lineItems,
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: { workspaceId },
    });

    if (!session.url) throw new Error('stripe checkout session missing url');

    logger.info('checkout.created', {
      workspaceId,
      sessionId: session.id,
    });

    return { url: session.url };
  } catch (err: unknown) {
    Sentry.captureException(err);
    throw err;
  }
};

export const createPortalSession = async (
  workspaceId: string,
  returnUrl: string,
): Promise<{ url: string }> => {
  try {
    const stripe = await getStripe();
    const pool = await getSharedPool();

    const { rows } = await pool.query(SQL_GET_SUBSCRIPTION, [workspaceId]);
    const customerId = (rows[0] as Record<string, unknown>)
      ?.stripe_customer_id as string | undefined;

    if (!customerId) {
      throw Object.assign(new Error('No subscription found'), { status: 404 });
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
    });

    return { url: session.url };
  } catch (err: unknown) {
    Sentry.captureException(err);
    throw err;
  }
};

export const handleWebhookEvent = async (
  rawBody: string,
  signature: string,
): Promise<void> => {
  try {
    const stripe = await getStripe();
    const logger = await getLogger();
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) throw new Error('STRIPE_WEBHOOK_SECRET not configured');

    const event = stripe.webhooks.constructEvent(
      rawBody,
      signature,
      webhookSecret,
    );

    const pool = await getSharedPool();

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const workspaceId = session.metadata?.workspaceId;
        if (!workspaceId || !session.subscription) break;

        if (session.metadata?.type === 'number_pack') {
          const packSize = parseInt(session.metadata.packSize as string, 10) as
            | 5
            | 10
            | 50;
          if (packSize && [5, 10, 50].includes(packSize)) {
            await addNumberPack(
              workspaceId,
              packSize,
              session.subscription as string,
            );
            logger.info('webhook.number_pack_purchased', {
              workspaceId,
              packSize,
              subscriptionId: session.subscription,
            });
          }
          break;
        }

        const subscription = await stripe.subscriptions.retrieve(
          session.subscription as string,
        );
        const addOns = extractAddOns(subscription);
        const periodEnd = getSubscriptionPeriodEnd(
          subscription.billing_cycle_anchor,
        );

        await pool.query(SQL_UPSERT_SUBSCRIPTION, [
          workspaceId,
          session.customer as string,
          subscription.id,
          subscription.status,
          'consuelo-base',
          subscription.items.data[0]?.plan?.interval ?? 'month',
          periodEnd,
          JSON.stringify(addOns),
        ]);

        logger.info('webhook.checkout_completed', { workspaceId });
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object;
        const workspaceId = subscription.metadata?.workspaceId;
        if (!workspaceId) break;

        const addOns = extractAddOns(subscription);
        const periodEnd = getSubscriptionPeriodEnd(
          subscription.billing_cycle_anchor,
        );

        await pool.query(SQL_UPSERT_SUBSCRIPTION, [
          workspaceId,
          subscription.customer as string,
          subscription.id,
          subscription.status,
          'consuelo-base',
          subscription.items.data[0]?.plan?.interval ?? 'month',
          periodEnd,
          JSON.stringify(addOns),
        ]);

        logger.info('webhook.subscription_updated', {
          workspaceId,
          status: subscription.status,
        });
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        const workspaceId = subscription.metadata?.workspaceId;
        if (!workspaceId) break;

        if (subscription.metadata?.type === 'number_pack') {
          await removeNumberPack(workspaceId, subscription.id);
          logger.info('webhook.number_pack_deleted', {
            workspaceId,
            subscriptionId: subscription.id,
          });
          break;
        }

        await pool.query(SQL_UPSERT_SUBSCRIPTION, [
          workspaceId,
          subscription.customer as string,
          subscription.id,
          'canceled',
          'consuelo-base',
          null,
          null,
          JSON.stringify([]),
        ]);

        logger.info('webhook.subscription_deleted', { workspaceId });
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object;
        const subDetails = invoice.parent?.subscription_details;
        const subscriptionRef = subDetails?.subscription;
        const subscriptionId =
          typeof subscriptionRef === 'string'
            ? subscriptionRef
            : (subscriptionRef?.id ?? null);
        if (!subscriptionId) break;

        const subscription =
          await stripe.subscriptions.retrieve(subscriptionId);
        const workspaceId = subscription.metadata?.workspaceId;
        if (!workspaceId) break;

        const periodEnd = getSubscriptionPeriodEnd(
          subscription.billing_cycle_anchor,
        );

        await pool.query(SQL_UPSERT_SUBSCRIPTION, [
          workspaceId,
          invoice.customer as string,
          subscriptionId,
          'past_due',
          'consuelo-base',
          subscription.items.data[0]?.plan?.interval ?? 'month',
          periodEnd,
          JSON.stringify(extractAddOns(subscription)),
        ]);

        logger.info('webhook.payment_failed', { workspaceId });
        break;
      }

      default:
        logger.info('webhook.unhandled', { type: event.type });
    }
  } catch (err: unknown) {
    Sentry.captureException(err);
    throw err;
  }
};

export const recordUsage = async (
  workspaceId: string,
  metric: 'call_minutes' | 'ai_tokens',
  amount: number,
): Promise<void> => {
  try {
    const mode = await getBillingMode(workspaceId);
    if (mode === 'byok') return;

    const pool = await getSharedPool();
    await pool.query(SQL_RECORD_USAGE, [workspaceId, metric, amount]);

    const logger = await getLogger();
    logger.info('usage.recorded', { workspaceId, metric, amount });
  } catch (err: unknown) {
    Sentry.captureException(err);
    throw err;
  }
};

export const hasAddOn = async (
  workspaceId: string,
  addOn: AddOnKey,
): Promise<boolean> => {
  try {
    const status = await getSubscriptionStatus(workspaceId);
    return status.addOns.includes(addOn);
  } catch (err: unknown) {
    Sentry.captureException(err);
    return false;
  }
};

const getSubscriptionPeriodEnd = (billingCycleAnchor: number): string => {
  return new Date(billingCycleAnchor * 1000).toISOString();
};

const extractAddOns = (subscription: {
  items: { data: Array<{ price: { id: string } }> };
}): AddOnKey[] => {
  const addOns: AddOnKey[] = [];
  const priceIds = subscription.items.data.map((item) => item.price.id);

  if (
    priceIds.includes(PRICE_IDS.dialerCoachMonthly) ||
    priceIds.includes(PRICE_IDS.dialerCoachAnnual)
  ) {
    addOns.push('dialer-coach');
  }

  if (
    priceIds.includes(PRICE_IDS.aiAssistantMonthly) ||
    priceIds.includes(PRICE_IDS.aiAssistantAnnual)
  ) {
    addOns.push('ai-assistant');
  }

  return addOns;
};

export { PRICE_IDS };
