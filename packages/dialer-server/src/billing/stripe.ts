import { Effect } from 'effect';

export type StripeCommercialEvent = { id: string; type: string; data?: unknown };

type StripeSession = { id: string; url: string | null };

export type StripeCommercialClient = {
  customers?: {
    create: (
      parameters: Record<string, unknown>,
      options?: { idempotencyKey: string },
    ) => Promise<{ id: string }>;
  };
  checkout?: {
    sessions: {
      create: (
        parameters: Record<string, unknown>,
        options?: { idempotencyKey: string },
      ) => Promise<StripeSession>;
    };
  };
  billingPortal?: {
    sessions: {
      create: (parameters: Record<string, unknown>) => Promise<StripeSession>;
    };
  };
  invoices?: {
    createPreview: (parameters: Record<string, unknown>) => Promise<{
      amount_due: number;
      currency: string;
      period_end?: number;
    }>;
  };
  subscriptions: {
    retrieve: (subscriptionId: string) => Promise<{
      id: string;
      items: {
        data: Array<{ id: string; price: { id: string } }>;
      };
    }>;
    update: (
      subscriptionId: string,
      parameters: Record<string, unknown>,
      options?: { idempotencyKey: string },
    ) => Promise<unknown>;
  };
  webhooks: {
    constructEvent: (
      rawBody: string,
      signature: string,
      secret: string,
    ) => StripeCommercialEvent;
  };
};

type CommercialBillingItem = { code: string; priceId: string; quantity: number };

const providerEffect = <T>(operation: () => Promise<T>) =>
  Effect.tryPromise({ try: operation, catch: (cause) => cause });

const requiredResource = <T>(resource: T | undefined, name: string): T => {
  if (!resource) throw new Error('Stripe resource ' + name + ' is unavailable');
  return resource;
};

const projectionKey = (items: CommercialBillingItem[]): string =>
  items.map((item) => item.code + ':' + item.quantity).join('|');

const canonicalProjectionKey = (items: CommercialBillingItem[]): string =>
  projectionKey([...items].sort((left, right) => left.code.localeCompare(right.code)));

export const createStripeCommercialBilling = (input: {
  client: StripeCommercialClient;
  webhookSecret: string;
}) => ({
  createCustomer: (request: { payerId: string; workspaceId: string }) =>
    providerEffect(async () => {
      const customers = requiredResource(input.client.customers, 'customers');
      const customer = await customers.create(
        {
          metadata: {
            payerId: request.payerId,
            workspaceId: request.workspaceId,
          },
        },
        { idempotencyKey: request.payerId + ':commercial-customer' },
      );
      return { id: customer.id };
    }),
  createCheckoutSession: (request: {
    workspaceId: string;
    payerId: string;
    customerId: string;
    items: CommercialBillingItem[];
    successUrl: string;
    cancelUrl: string;
  }) =>
    providerEffect(async () => {
      const checkout = requiredResource(input.client.checkout, 'checkout');
      const session = await checkout.sessions.create(
        {
          cancel_url: request.cancelUrl,
          client_reference_id: request.workspaceId,
          customer: request.customerId,
          line_items: request.items.map((item) => ({
            price: item.priceId,
            quantity: item.quantity,
          })),
          metadata: {
            payerId: request.payerId,
            workspaceId: request.workspaceId,
          },
          mode: 'subscription',
          success_url: request.successUrl,
          subscription_data: {
            metadata: {
              payerId: request.payerId,
              workspaceId: request.workspaceId,
            },
          },
        },
        {
          idempotencyKey:
            request.workspaceId +
            ':' +
            request.payerId +
            ':checkout:' +
            canonicalProjectionKey(request.items),
        },
      );
      if (!session.url) throw new Error('Stripe Checkout session URL is missing');
      return { id: session.id, url: session.url };
    }),
  createPortalSession: (request: { customerId: string; returnUrl: string }) =>
    providerEffect(async () => {
      const portal = requiredResource(
        input.client.billingPortal,
        'billingPortal',
      );
      const session = await portal.sessions.create({
        customer: request.customerId,
        return_url: request.returnUrl,
      });
      if (!session.url) throw new Error('Stripe portal session URL is missing');
      return { id: session.id, url: session.url };
    }),
  getUpcomingInvoiceSummary: (request: {
    customerId: string;
    subscriptionId: string;
  }) =>
    providerEffect(async () => {
      const invoices = requiredResource(input.client.invoices, 'invoices');
      const preview = await invoices.createPreview({
        customer: request.customerId,
        subscription: request.subscriptionId,
      });
      return {
        amountDue: preview.amount_due,
        currency: preview.currency,
        periodEnd: preview.period_end ?? null,
      };
    }),
  previewSubscriptionChange: (request: {
    customerId: string;
    subscriptionId: string;
    items: CommercialBillingItem[];
    prorationDate: number;
  }) =>
    providerEffect(async () => {
      const invoices = requiredResource(input.client.invoices, 'invoices');
      const preview = await invoices.createPreview({
        customer: request.customerId,
        subscription: request.subscriptionId,
        subscription_details: {
          items: request.items.map((item) => ({
            price: item.priceId,
            quantity: item.quantity,
          })),
          proration_behavior: 'create_prorations',
          proration_date: request.prorationDate,
        },
      });
      return {
        amountDue: preview.amount_due,
        currency: preview.currency,
        prorationDate: request.prorationDate,
      };
    }),
  reconcileSubscription: (request: {
    subscriptionId: string;
    workspaceId: string;
    items: CommercialBillingItem[];
    prorationDate?: number;
  }) =>
    providerEffect(async () => {
      const subscription = await input.client.subscriptions.retrieve(
        request.subscriptionId,
      );
      const existingByPrice = new Map(
        subscription.items.data.map((item) => [item.price.id, item]),
      );
      const desiredPrices = new Set(request.items.map((item) => item.priceId));
      const items: Array<Record<string, unknown>> = request.items.map((item) => {
        const existing = existingByPrice.get(item.priceId);
        return existing
          ? { id: existing.id, quantity: item.quantity }
          : { price: item.priceId, quantity: item.quantity };
      });
      for (const existing of subscription.items.data) {
        if (!desiredPrices.has(existing.price.id)) {
          items.push({ id: existing.id, deleted: true });
        }
      }
      const parameters: Record<string, unknown> = {
        cancel_at_period_end: false,
        items,
        metadata: { workspaceId: request.workspaceId },
        payment_behavior: 'pending_if_incomplete',
        proration_behavior: 'create_prorations',
      };
      if (request.prorationDate !== undefined) {
        parameters.proration_date = request.prorationDate;
      }
      const prorationKey =
        request.prorationDate === undefined ? '' : ':' + request.prorationDate;
      await input.client.subscriptions.update(
        request.subscriptionId,
        parameters,
        {
          idempotencyKey:
            request.workspaceId +
            ':' +
            request.subscriptionId +
            ':' +
            projectionKey(request.items) +
            prorationKey,
        },
      );
    }),
  scheduleCancellationAtPeriodEnd: (subscriptionId: string) =>
    providerEffect(async () => {
      await input.client.subscriptions.update(
        subscriptionId,
        { cancel_at_period_end: true },
        { idempotencyKey: subscriptionId + ':cancel-at-period-end' },
      );
    }),
  constructWebhookEvent: (rawBody: string, signature: string) =>
    input.client.webhooks.constructEvent(
      rawBody,
      signature,
      input.webhookSecret,
    ),
});
