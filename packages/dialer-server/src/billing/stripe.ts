import { Effect } from 'effect';

export type StripeCommercialEvent = { id: string; type: string; data?: unknown };

export type StripeCommercialClient = {
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

const providerEffect = <T>(operation: () => Promise<T>) =>
  Effect.tryPromise({ try: operation, catch: (cause) => cause });

export const createStripeCommercialBilling = (input: {
  client: StripeCommercialClient;
  webhookSecret: string;
}) => ({
  reconcileSubscription: (request: {
    subscriptionId: string;
    workspaceId: string;
    items: Array<{ code: string; priceId: string; quantity: number }>;
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
      const projectionKey = request.items
        .map((item) => `${item.code}:${item.quantity}`)
        .join('|');
      await input.client.subscriptions.update(
        request.subscriptionId,
        {
          cancel_at_period_end: false,
          items,
          metadata: { workspaceId: request.workspaceId },
          payment_behavior: 'pending_if_incomplete',
          proration_behavior: 'create_prorations',
        },
        {
          idempotencyKey: `${request.workspaceId}:${request.subscriptionId}:${projectionKey}`,
        },
      );
    }),
  scheduleCancellationAtPeriodEnd: (subscriptionId: string) =>
    providerEffect(async () => {
      await input.client.subscriptions.update(
        subscriptionId,
        { cancel_at_period_end: true },
        { idempotencyKey: `${subscriptionId}:cancel-at-period-end` },
      );
    }),
  constructWebhookEvent: (rawBody: string, signature: string) =>
    input.client.webhooks.constructEvent(
      rawBody,
      signature,
      input.webhookSecret,
    ),
});
