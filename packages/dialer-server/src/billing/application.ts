import { Effect } from 'effect';

import type { DialerPlanCatalog, DialerPlanCode } from '../plans/catalog';

export const projectSubscriptionItems = (input: {
  catalog: DialerPlanCatalog;
  seats: Array<{ userId: string; planCode: DialerPlanCode }>;
  additionalNumberQuantity: number;
}): Array<{ code: string; priceId: string; quantity: number }> => {
  if (
    !Number.isSafeInteger(input.additionalNumberQuantity) ||
    input.additionalNumberQuantity < 0
  ) {
    throw new Error('INVALID_ADDITIONAL_NUMBER_QUANTITY');
  }
  const quantities: Record<DialerPlanCode, number> = {
    single: 0,
    standard: 0,
    power: 0,
  };
  for (const seat of input.seats) quantities[seat.planCode] += 1;

  const items: Array<{ code: string; priceId: string; quantity: number }> = (
    ['single', 'standard', 'power'] as const
  )
    .filter((code) => quantities[code] > 0)
    .map((code) => ({
      code,
      priceId: input.catalog.plans[code].stripePriceId,
      quantity: quantities[code],
    }));
  if (input.additionalNumberQuantity > 0) {
    items.push({
      code: 'additional-number',
      priceId: input.catalog.additionalNumberStripePriceId,
      quantity: input.additionalNumberQuantity,
    });
  }
  return items;
};

const access = (
  state: 'active' | 'grace' | 'blocked' | 'canceled',
  graceEndsAt: string | null,
) => ({
  state,
  canStartCalls: state === 'active' || state === 'grace',
  canPurchaseNumbers: state === 'active' || state === 'grace',
  canManageBilling: true,
  canReadHistory: true,
  graceEndsAt,
});

export const resolveBillingAccess = (input: {
  status: string;
  paymentFailedAt: Date | null;
  now: Date;
  graceDays: number;
}) => {
  if (['canceled', 'incomplete_expired'].includes(input.status)) {
    return access('canceled', null);
  }
  if (
    ['active', 'trialing'].includes(input.status) ||
    !input.paymentFailedAt
  ) {
    return access('active', null);
  }
  const graceEndsAt = new Date(
    input.paymentFailedAt.getTime() + input.graceDays * 86_400_000,
  );
  return input.now.getTime() < graceEndsAt.getTime()
    ? access('grace', graceEndsAt.toISOString())
    : access('blocked', graceEndsAt.toISOString());
};

export const processInstallationUninstall = (input: {
  event: {
    id: string;
    workspaceId: string;
    locationId: string;
    appId: string;
  };
  repository: {
    claimWebhookEvent: (eventId: string) => Effect.Effect<boolean, unknown>;
    getWorkspaceSubscriptionId: (
      workspaceId: string,
    ) => Effect.Effect<string | null, unknown>;
    disableInstallation: (input: {
      workspaceId: string;
      locationId: string;
    }) => Effect.Effect<void, unknown>;
  };
  stripe: {
    scheduleCancellationAtPeriodEnd: (
      subscriptionId: string,
    ) => Effect.Effect<void, unknown>;
  };
}) =>
  Effect.gen(function* () {
    const claimed = yield* input.repository.claimWebhookEvent(input.event.id);
    if (!claimed) return { duplicate: true, cancellationScheduled: false };

    yield* input.repository.disableInstallation({
      workspaceId: input.event.workspaceId,
      locationId: input.event.locationId,
    });
    const subscriptionId =
      yield* input.repository.getWorkspaceSubscriptionId(
        input.event.workspaceId,
      );
    if (!subscriptionId) {
      return { duplicate: false, cancellationScheduled: false };
    }
    yield* input.stripe.scheduleCancellationAtPeriodEnd(subscriptionId);
    return { duplicate: false, cancellationScheduled: true };
  });
