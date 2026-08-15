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

const ENTITLED_SUBSCRIPTION_STATUSES = new Set(['active', 'trialing']);
const CANCELED_SUBSCRIPTION_STATUSES = new Set([
  'canceled',
  'incomplete_expired',
]);
const GRACE_ELIGIBLE_SUBSCRIPTION_STATUSES = new Set(['past_due']);

export const resolveBillingAccess = (input: {
  status: string;
  paymentFailedAt: Date | null;
  now: Date;
  graceDays: number;
}) => {
  if (ENTITLED_SUBSCRIPTION_STATUSES.has(input.status)) {
    return access('active', null);
  }
  if (CANCELED_SUBSCRIPTION_STATUSES.has(input.status)) {
    return access('canceled', null);
  }
  if (
    !GRACE_ELIGIBLE_SUBSCRIPTION_STATUSES.has(input.status) ||
    !input.paymentFailedAt
  ) {
    return access('blocked', null);
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
    completeWebhookEvent: (eventId: string) => Effect.Effect<void, unknown>;
    failWebhookEvent: (
      eventId: string,
      errorCode: string,
    ) => Effect.Effect<void, unknown>;
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

    return yield* Effect.gen(function* () {
      const subscriptionId =
        yield* input.repository.getWorkspaceSubscriptionId(
          input.event.workspaceId,
        );
      if (subscriptionId) {
        yield* input.stripe.scheduleCancellationAtPeriodEnd(subscriptionId);
      }
      yield* input.repository.disableInstallation({
        workspaceId: input.event.workspaceId,
        locationId: input.event.locationId,
      });
      yield* input.repository.completeWebhookEvent(input.event.id);
      return {
        duplicate: false,
        cancellationScheduled: subscriptionId !== null,
      };
    }).pipe(
      Effect.tapError(() =>
        input.repository.failWebhookEvent(
          input.event.id,
          'INSTALLATION_UNINSTALL_FAILED',
        ),
      ),
    );
  });
