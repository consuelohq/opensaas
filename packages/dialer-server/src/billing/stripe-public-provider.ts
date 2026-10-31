import type Stripe from 'stripe';
import type {
  PublicCheckoutProvider,
  PublicSubscription,
} from './public-checkout';
import { normalizeAsyncError } from '../errors/normalize-async-error';
const normalizeSubscription = (
  subscription: Stripe.Subscription,
): PublicSubscription => {
  const invoice =
    subscription.latest_invoice &&
    typeof subscription.latest_invoice === 'object'
      ? subscription.latest_invoice
      : null;
  return {
    id: subscription.id,
    customerId:
      typeof subscription.customer === 'string'
        ? subscription.customer
        : subscription.customer.id,
    status: subscription.status,
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
    metadata: subscription.metadata,
    items: subscription.items.data.map((item) => ({
      id: item.id,
      priceId: item.price.id,
      quantity: item.quantity ?? 0,
    })),
    latestInvoicePaid: invoice?.status === 'paid',
    latestInvoiceAmountDue: invoice?.amount_due,
    pendingUpdate: !!subscription.pending_update,
    currentPeriodEnd: subscription.items.data[0]?.current_period_end,
    defaultPaymentMethodId:
      typeof subscription.default_payment_method === 'string'
        ? subscription.default_payment_method
        : (subscription.default_payment_method?.id ?? null),
  };
};
export const createStripePublicCheckoutProvider = (
  stripe: Pick<
    Stripe,
    'prices' | 'checkout' | 'subscriptions' | 'billingPortal'
  >,
): PublicCheckoutProvider => ({
  listPrices: async (lookupKeys) => {
    try {
      const pages = await Promise.all(
        Array.from({ length: Math.ceil(lookupKeys.length / 10) }, (_, index) =>
          stripe.prices.list({
            lookup_keys: lookupKeys.slice(index * 10, (index + 1) * 10),
            active: true,
            limit: 100,
          }),
        ),
      );
      return pages.flatMap((page) =>
        page.data.map((price) => ({
          id: price.id,
          lookupKey: price.lookup_key ?? '',
          unitAmount: price.unit_amount ?? -1,
          currency: price.currency,
          interval: price.recurring?.interval ?? null,
          productId:
            typeof price.product === 'string'
              ? price.product
              : price.product.id,
        })),
      );
    } catch (cause: unknown) {
      throw normalizeAsyncError(cause);
    }
  },
  createSession: async (parameters, idempotencyKey) => {
    try {
      const session = await stripe.checkout.sessions.create(
        parameters as Stripe.Checkout.SessionCreateParams,
        { idempotencyKey },
      );
      return { id: session.id, url: session.url };
    } catch (cause: unknown) {
      throw normalizeAsyncError(cause);
    }
  },
  retrieveSession: async (id) => {
    try {
      const session = await stripe.checkout.sessions.retrieve(id, {
        expand: ['subscription.latest_invoice'],
      });
      const subscription =
        typeof session.subscription === 'string'
          ? await stripe.subscriptions.retrieve(session.subscription, {
              expand: ['latest_invoice'],
            })
          : session.subscription;
      return {
        id: session.id,
        url: session.url,
        status: session.status,
        paymentStatus: session.payment_status,
        mode: session.mode,
        amountTotal: session.amount_total,
        currency: session.currency,
        metadata: session.metadata ?? {},
        customerId:
          typeof session.customer === 'string'
            ? session.customer
            : (session.customer?.id ?? null),
        subscription: subscription ? normalizeSubscription(subscription) : null,
      };
    } catch (cause: unknown) {
      throw normalizeAsyncError(cause);
    }
  },
  retrieveLineItems: async (id) => {
    try {
      const page = await stripe.checkout.sessions.listLineItems(id, {
        limit: 100,
      });
      if (page.has_more) throw new Error('NATIVE_LINE_ITEMS_OVERFLOW');
      return page.data.map((item) => ({
        priceId: item.price?.id ?? '',
        quantity: item.quantity ?? 0,
      }));
    } catch (cause: unknown) {
      throw normalizeAsyncError(cause);
    }
  },
  findCheckoutSession: async (customerId, referenceId) => {
    try {
      const page = await stripe.checkout.sessions.list({
        customer: customerId,
        limit: 100,
      });
      const matches = page.data.filter(
        (session) => session.metadata?.nativeMinuteId === referenceId,
      );
      if (matches.length > 1 || (!matches.length && page.has_more))
        throw new Error('PURCHASE_RECONCILIATION_PENDING');
      return matches.length ? { id: matches[0].id, url: matches[0].url } : null;
    } catch (cause: unknown) {
      throw normalizeAsyncError(cause);
    }
  },
  createSubscription: async (parameters, idempotencyKey) => {
    try {
      return normalizeSubscription(
        await stripe.subscriptions.create(
          {
            ...parameters,
            expand: ['latest_invoice'],
          } as Stripe.SubscriptionCreateParams,
          { idempotencyKey },
        ),
      );
    } catch (cause: unknown) {
      throw normalizeAsyncError(cause);
    }
  },
  retrieveSubscription: async (id) => {
    try {
      return normalizeSubscription(
        await stripe.subscriptions.retrieve(id, { expand: ['latest_invoice'] }),
      );
    } catch (cause: unknown) {
      throw normalizeAsyncError(cause);
    }
  },
  findNumberSubscription: async (customerId, attemptId) => {
    try {
      const page = await stripe.subscriptions.list({
        customer: customerId,
        status: 'all',
        limit: 100,
        expand: ['data.latest_invoice'],
      });
      const matches = page.data.filter(
        (subscription) =>
          subscription.metadata.attemptId === attemptId &&
          subscription.metadata.component === 'number_pool',
      );
      if (matches.length > 1 || (!matches.length && page.has_more))
        throw new Error('PURCHASE_RECONCILIATION_PENDING');
      return matches.length ? normalizeSubscription(matches[0]) : null;
    } catch (cause: unknown) {
      throw normalizeAsyncError(cause);
    }
  },
  createPortal: async (parameters) => {
    try {
      if (typeof parameters.customer !== 'string')
        throw new Error('BILLING_CUSTOMER_NOT_FOUND');
      const session = await stripe.billingPortal.sessions.create({
        ...parameters,
        customer: parameters.customer,
      } as Stripe.BillingPortal.SessionCreateParams);
      if (!session.url) throw new Error('BILLING_PORTAL_UNAVAILABLE');
      return { id: session.id, url: session.url };
    } catch (cause: unknown) {
      throw normalizeAsyncError(cause);
    }
  },
});
