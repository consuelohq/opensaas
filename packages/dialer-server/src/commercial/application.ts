import { Effect, Schedule } from 'effect';

import {
  processInstallationUninstall as processInstallationUninstallEffect,
  resolveBillingAccess,
} from '../billing/application';
import type { createStripeCommercialBilling } from '../billing/stripe';
import type { CommercialNumberProvider } from '../numbers/commercial-provider';
import { validateNumberAssignment } from '../numbers/application';
import {
  resolveSeatEntitlement,
  resolveTrialEntitlement,
} from '../plans/entitlements';
import type { DialerPlanCatalog, DialerPlanCode } from '../plans/catalog';
import { toSafeDialerPlanCatalog } from '../plans/catalog';
import type {
  CommercialIdentity,
  CommercialRouteDependencies,
} from '../routes/commercial';
import {
  authorizeCommercialAction,
  validateSeatInventory,
} from '../teams/application';
import { recordFinalProviderUsage } from '../usage/application';
import {
  createCommercialPersistence,
  type CommercialSqlClient,
} from './persistence';

import { normalizeAsyncError } from '../errors/normalize-async-error';

type CommercialRecord = Record<string, unknown>;
type CommercialBilling = ReturnType<typeof createStripeCommercialBilling>;
type CommercialApplication = CommercialRouteDependencies & {
  callerContext: NonNullable<CommercialRouteDependencies['callerContext']>;
  authorizeCall: NonNullable<CommercialRouteDependencies['authorizeCall']>;
};

export type CommercialUsageProvider = {
  getCompletion: (providerCallId: string) => Promise<{
    customerConnectedSeconds: number;
    agentConnectedSeconds: number;
    providerCostMicros: number;
    occurredAt: string;
  }>;
};

const record = (value: unknown): CommercialRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as CommercialRecord)
    : {};

const stringValue = (value: unknown): string =>
  typeof value === 'string' ? value.trim() : '';

const booleanValue = (value: unknown): boolean => value === true;

const planCode = (value: unknown): DialerPlanCode => {
  if (value === 'single' || value === 'standard' || value === 'power') {
    return value;
  }
  throw new Error('INVALID_PLAN_CODE');
};

const effectQuery = <T>(operation: () => Promise<T>) =>
  Effect.tryPromise({ try: operation, catch: (cause) => cause });

const requireAdmin = (
  identity: CommercialIdentity,
  action: 'billing.manage' | 'seats.manage' | 'numbers.manage',
) =>
  authorizeCommercialAction({
    identity: {
      workspaceId: identity.workspaceId,
      userId: identity.userId,
      role: identity.role ?? 'user',
    },
    targetWorkspaceId: identity.workspaceId,
    action,
  });

const e164 = (value: unknown): string => {
  const candidate = stringValue(value);
  if (!/^\+[1-9]\d{7,14}$/.test(candidate)) {
    throw new Error('INVALID_PHONE_NUMBER');
  }
  return candidate;
};

const positiveLimit = (value: unknown): number => {
  const parsed = Number(value ?? 10);
  if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > 30) {
    throw new Error('INVALID_NUMBER_SEARCH_LIMIT');
  }
  return parsed;
};

const subscriptionDetails = (object: CommercialRecord): CommercialRecord =>
  record(record(object.parent).subscription_details);

const metadataWorkspaceId = (object: CommercialRecord): string =>
  stringValue(record(object.metadata).workspaceId) ||
  stringValue(record(subscriptionDetails(object).metadata).workspaceId);

const metadataPayerId = (object: CommercialRecord): string =>
  stringValue(record(object.metadata).payerId);

const subscriptionReference = (object: CommercialRecord): string => {
  const direct = stringValue(object.subscription);
  if (direct) return direct;
  return stringValue(subscriptionDetails(object).subscription);
};

const billingPeriod = (now: Date) => {
  const start = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
  );
  const end = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1),
  );
  return { start: start.toISOString(), end: end.toISOString() };
};

type CommercialBillingQuantities = Record<DialerPlanCode, number> & {
  additionalNumber: number;
};

const nonNegativeQuantity = (value: unknown): number => {
  const quantity = Number(value ?? 0);
  if (!Number.isSafeInteger(quantity) || quantity < 0 || quantity > 10_000) {
    throw new Error('INVALID_BILLING_QUANTITY');
  }
  return quantity;
};

const billingQuantities = (body: unknown): CommercialBillingQuantities => {
  const quantities = record(record(body).quantities);
  const result = {
    single: nonNegativeQuantity(quantities.single),
    standard: nonNegativeQuantity(quantities.standard),
    power: nonNegativeQuantity(quantities.power),
    additionalNumber: nonNegativeQuantity(quantities.additionalNumber),
  };
  if (result.single + result.standard + result.power < 1) {
    throw new Error('BILLING_SEAT_REQUIRED');
  }
  return result;
};

const billingItems = (
  catalog: DialerPlanCatalog,
  quantities: CommercialBillingQuantities,
): Array<{
  code: DialerPlanCode | 'additional-number';
  priceId: string;
  quantity: number;
}> => {
  const items: Array<{
    code: DialerPlanCode | 'additional-number';
    priceId: string;
    quantity: number;
  }> = (['single', 'standard', 'power'] as const)
    .filter((code) => quantities[code] > 0)
    .map((code) => ({
      code,
      priceId: catalog.plans[code].stripePriceId,
      quantity: quantities[code],
    }));
  if (quantities.additionalNumber > 0) {
    items.push({
      code: 'additional-number' as const,
      priceId: catalog.additionalNumberStripePriceId,
      quantity: quantities.additionalNumber,
    });
  }
  return items;
};

const itemCodeForPrice = (
  catalog: DialerPlanCatalog,
  priceId: string,
): DialerPlanCode | 'additional-number' => {
  for (const code of ['single', 'standard', 'power'] as const) {
    if (catalog.plans[code].stripePriceId === priceId) return code;
  }
  if (catalog.additionalNumberStripePriceId === priceId) {
    return 'additional-number';
  }
  throw new Error('UNKNOWN_STRIPE_PRICE');
};

export const createCommercialApplication = (input: {
  database: CommercialSqlClient;
  catalog: DialerPlanCatalog;
  billing?: CommercialBilling;
  billingReturnUrl?: string;
  numbers?: CommercialNumberProvider;
  usage?: CommercialUsageProvider;
  now?: () => Date;
}): CommercialApplication => {
  const persistence = createCommercialPersistence(input.database);
  const now = input.now ?? (() => new Date());

  const requireBilling = (): CommercialBilling => {
    if (!input.billing) throw new Error('BILLING_PROVIDER_UNAVAILABLE');
    return input.billing;
  };

  const requireBillingReturnUrl = (): string => {
    const value = input.billingReturnUrl?.trim();
    if (!value) throw new Error('BILLING_RETURN_URL_UNAVAILABLE');
    return value.replace(/\/$/, '');
  };

  const getWorkspaceSubscription = async (workspaceId: string) => {
    try {
      const result = await input.database.query(
        'SELECT provider_customer_id, provider_subscription_id, status FROM dialer_workspace_subscriptions WHERE workspace_id = $1',
        [workspaceId],
      );
      const current = record(result.rows[0]);
      return {
        customerId: stringValue(current.provider_customer_id) || null,
        subscriptionId: stringValue(current.provider_subscription_id) || null,
        status: stringValue(current.status) || null,
      };
    } catch (cause: unknown) {
      throw normalizeAsyncError(cause);
    }
  };

  const getOrCreateBillingCustomer = async (
    payerId: string,
    workspaceId: string,
  ): Promise<string> => {
    try {
      const existing = await input.database.query(
        'SELECT provider_customer_id FROM dialer_billing_accounts WHERE payer_user_id = $1',
        [payerId],
      );
      const existingId = stringValue(record(existing.rows[0]).provider_customer_id);
      if (existingId) return existingId;

      const created = await Effect.runPromise(
        requireBilling().createCustomer({ payerId, workspaceId }),
      );
      const saved = await input.database.query(
        'INSERT INTO dialer_billing_accounts (payer_user_id, provider_customer_id) VALUES ($1, $2) ON CONFLICT (payer_user_id) DO UPDATE SET updated_at = now() RETURNING provider_customer_id',
        [payerId, created.id],
      );
      const resolvedId = stringValue(record(saved.rows[0]).provider_customer_id);
      if (!resolvedId) throw new Error('BILLING_CUSTOMER_NOT_PERSISTED');
      return resolvedId;
    } catch (cause: unknown) {
      throw normalizeAsyncError(cause);
    }
  };

  const loadConfirmedInventory = async (workspaceId: string) => {
    try {
      const result = await input.database.query(
        'SELECT item_code, quantity FROM dialer_workspace_subscription_items WHERE workspace_id = $1',
        [workspaceId],
      );
      const purchased: Record<DialerPlanCode, number> = {
        single: 0,
        standard: 0,
        power: 0,
      };
      let additionalNumberQuantity = 0;
      for (const row of result.rows) {
        const item = record(row);
        const code = stringValue(item.item_code);
        const quantity = nonNegativeQuantity(item.quantity);
        if (code === 'single' || code === 'standard' || code === 'power') {
          purchased[code] = quantity;
        } else if (code === 'additional-number') {
          additionalNumberQuantity = quantity;
        }
      }
      const paidSeatQuantity = purchased.single + purchased.standard + purchased.power;
      if (paidSeatQuantity === 0) {
        purchased[input.catalog.trial.planCode] = input.catalog.trial.maxSeats;
      }
      const includedNumberQuantity =
        paidSeatQuantity > 0
          ? paidSeatQuantity * input.catalog.includedNumbersPerSeat
          : input.catalog.trial.maxNumbers;
      return {
        purchased,
        paid: paidSeatQuantity > 0,
        includedNumberQuantity,
        additionalNumberQuantity,
        numberCapacity: includedNumberQuantity + additionalNumberQuantity,
      };
    } catch (cause: unknown) {
      throw normalizeAsyncError(cause);
    }
  };

  const ensureBillingQuantitiesCoverResources = async (
    workspaceId: string,
    quantities: CommercialBillingQuantities,
  ): Promise<void> => {
    try {
      const [seatCounts, activeNumbers] = await Promise.all([
        input.database.query(
          `SELECT plan_code, COUNT(*)::integer AS quantity
           FROM dialer_team_seats
           WHERE workspace_id = $1 AND status = 'active'
           GROUP BY plan_code`,
          [workspaceId],
        ),
        input.database.query(
          `SELECT COUNT(*)::integer AS quantity
           FROM dialer_phone_numbers
           WHERE workspace_id = $1 AND status = 'active'`,
          [workspaceId],
        ),
      ]);
      for (const row of seatCounts.rows) {
        const count = record(row);
        const code = planCode(count.plan_code);
        const assigned = Number(count.quantity ?? 0);
        if (quantities[code] < assigned) {
          throw new Error('SUBSCRIPTION_BELOW_ASSIGNED_SEATS');
        }
      }
      const seatQuantity =
        quantities.single + quantities.standard + quantities.power;
      const numberCapacity =
        seatQuantity * input.catalog.includedNumbersPerSeat +
        quantities.additionalNumber;
      const activeNumberQuantity = Number(
        record(activeNumbers.rows[0]).quantity ?? 0,
      );
      if (numberCapacity < activeNumberQuantity) {
        throw new Error('SUBSCRIPTION_BELOW_ACTIVE_NUMBERS');
      }
    } catch (cause: unknown) {
      throw normalizeAsyncError(cause);
    }
  };

  const ensureNumberInventory = async (workspaceId: string): Promise<void> => {
    try {
      const [inventory, active] = await Promise.all([
        loadConfirmedInventory(workspaceId),
        input.database.query(
          "SELECT COUNT(*)::integer AS quantity FROM dialer_phone_numbers WHERE workspace_id = $1 AND status = 'active'",
          [workspaceId],
        ),
      ]);
      const activeQuantity = Number(record(active.rows[0]).quantity ?? 0);
      if (activeQuantity >= inventory.numberCapacity) {
        throw new Error('NUMBER_INVENTORY_EXHAUSTED');
      }
    } catch (cause: unknown) {
      throw normalizeAsyncError(cause);
    }
  };

  const subscriptionIdForWorkspace = async (
    workspaceId: string,
  ): Promise<string | null> => {
    try {
      const result = await input.database.query(
        `SELECT provider_subscription_id
         FROM dialer_workspace_subscriptions
         WHERE workspace_id = $1`,
        [workspaceId],
      );
      const id = record(result.rows[0]).provider_subscription_id;
      return typeof id === 'string' && id ? id : null;
    } catch (cause: unknown) {
      throw normalizeAsyncError(cause);
    }
  };

  const workspaceForSubscription = async (
    subscriptionId: string,
  ): Promise<string> => {
    try {
      const result = await input.database.query(
        `SELECT workspace_id
         FROM dialer_workspace_subscriptions
         WHERE provider_subscription_id = $1`,
        [subscriptionId],
      );
      const workspaceId = stringValue(record(result.rows[0]).workspace_id);
      if (!workspaceId) throw new Error('STRIPE_WORKSPACE_NOT_FOUND');
      return workspaceId;
    } catch (cause: unknown) {
      throw normalizeAsyncError(cause);
    }
  };

  const validateAssignment = async (
    workspaceId: string,
    userId: string,
    phoneNumber: string,
  ) => {
    try {
      const [seatResult, numberResult] = await Promise.all([
        input.database.query(
          `SELECT plan_code
           FROM dialer_team_seats
           WHERE workspace_id = $1 AND user_id = $2 AND status = 'active'`,
          [workspaceId, userId],
        ),
        input.database.query(
          `SELECT workspace_id, user_id, phone_number, status
           FROM dialer_phone_numbers
           WHERE workspace_id = $1`,
          [workspaceId],
        ),
      ]);
      const assignedPlan = planCode(record(seatResult.rows[0]).plan_code);
      const existingAssignments = numberResult.rows.map((row) => {
        const current = record(row);
        return {
          workspaceId: stringValue(current.workspace_id),
          userId: stringValue(current.user_id),
          phoneNumber: stringValue(current.phone_number),
          status:
            current.status === 'released'
              ? ('released' as const)
              : ('active' as const),
        };
      });
      validateNumberAssignment({
        workspaceId,
        seatUserId: userId,
        planMaximum: input.catalog.plans[assignedPlan].maxNumbersPerSeat,
        existingAssignments,
        phoneNumber,
      });
    } catch (cause: unknown) {
      throw normalizeAsyncError(cause);
    }
  };

  const loadBillingAccess = async (workspaceId: string) => {
    try {
      const subscriptionResult = await input.database.query(
        `SELECT status, payment_failed_at, cancel_at_period_end
         FROM dialer_workspace_subscriptions
         WHERE workspace_id = $1`,
        [workspaceId],
      );
      const subscription = record(subscriptionResult.rows[0]);
      const paymentFailedAt = stringValue(subscription.payment_failed_at);
      return subscriptionResult.rows[0]
        ? resolveBillingAccess({
            status: stringValue(subscription.status) || 'unknown',
            paymentFailedAt: paymentFailedAt ? new Date(paymentFailedAt) : null,
            now: now(),
            graceDays: input.catalog.paymentGraceDays,
          })
        : {
            state: 'trial' as const,
            canStartCalls: true,
            canPurchaseNumbers: true,
            canManageBilling: true,
            canReadHistory: true,
            graceEndsAt: null,
          };
    } catch (cause: unknown) {
      throw normalizeAsyncError(cause);
    }
  };

  const loadCallerContext = async (identity: CommercialIdentity) => {
    try {
      authorizeCommercialAction({
        identity: {
          workspaceId: identity.workspaceId,
          userId: identity.userId,
          role: identity.role ?? 'user',
        },
        targetWorkspaceId: identity.workspaceId,
        action: 'calls.start',
      });
      const [seatResult, numberResult, usageResult, billing, totals] =
        await Promise.all([
          input.database.query(
            `SELECT plan_code
             FROM dialer_team_seats
             WHERE workspace_id = $1 AND user_id = $2 AND status = 'active'`,
            [identity.workspaceId, identity.userId],
          ),
          input.database.query(
            `SELECT phone_number
             FROM dialer_phone_numbers
             WHERE workspace_id = $1 AND user_id = $2 AND status = 'active'
             ORDER BY phone_number`,
            [identity.workspaceId, identity.userId],
          ),
          input.database.query(
            `SELECT COALESCE(SUM(quantity), 0)::integer AS connected_minutes
             FROM dialer_usage_events
             WHERE workspace_id = $1 AND user_id = $2
               AND occurred_at >= date_trunc('month', now())`,
            [identity.workspaceId, identity.userId],
          ),
          loadBillingAccess(identity.workspaceId),
          input.database.query(
            `SELECT
               (SELECT COUNT(*)::integer FROM dialer_team_seats
                WHERE workspace_id = $1 AND status = 'active') AS seat_count,
               (SELECT COUNT(*)::integer FROM dialer_phone_numbers
                WHERE workspace_id = $1 AND status = 'active') AS number_count`,
            [identity.workspaceId],
          ),
        ]);
      const seatRow = record(seatResult.rows[0]);
      const trial = !stringValue(seatRow.plan_code);
      const currentPlan = trial
        ? input.catalog.trial.planCode
        : planCode(seatRow.plan_code);
      const callerIds = numberResult.rows
        .map((row) => stringValue(record(row).phone_number))
        .filter(Boolean);
      const connectedMinutes = Number(
        record(usageResult.rows[0]).connected_minutes ?? 0,
      );
      const entitlement = resolveSeatEntitlement({
        catalog: input.catalog,
        planCode: currentPlan,
        activeNumberCount: callerIds.length,
        requestedLines: input.catalog.plans[currentPlan].maxNumbersPerSeat,
        callerIdSelection: { kind: 'automatic' },
        connectedMinutes,
      });
      const totalRow = record(totals.rows[0]);
      const trialEntitlement = trial
        ? resolveTrialEntitlement({
            catalog: input.catalog,
            seatCount: Number(totalRow.seat_count ?? 0) || 1,
            numberCount: Number(totalRow.number_count ?? 0),
            connectedMinutes,
          })
        : null;
      const maximumLines = Math.min(
        entitlement.maxNumbers,
        callerIds.length,
        entitlement.predictive ? callerIds.length : 1,
      );
      const canStartCall =
        billing.canStartCalls &&
        entitlement.canStartCall &&
        (trialEntitlement?.canStartCall ?? true);
      return {
        planCode: currentPlan,
        trial,
        callerIds,
        connectedMinutes,
        remainingMinutes: trialEntitlement
          ? trialEntitlement.remainingMinutes
          : input.catalog.plans[currentPlan].includedMinutes === null
            ? null
            : Math.max(
                0,
                input.catalog.plans[currentPlan].includedMinutes! -
                  connectedMinutes,
              ),
        lineOptions: Array.from({ length: maximumLines }, (_, index) => index + 1),
        predictive: entitlement.predictive,
        recordings: entitlement.recordings,
        transcripts: entitlement.transcripts,
        canStartCall,
        denialCode: !billing.canStartCalls
          ? 'BILLING_ACCESS_BLOCKED'
          : !trialEntitlement?.canStartCall && trialEntitlement
            ? 'TRIAL_LIMIT_REACHED'
            : entitlement.denialCode,
        billing,
      };
    } catch (cause: unknown) {
      throw normalizeAsyncError(cause);
    }
  };

  const assignExistingNumber = async (
    workspaceId: string,
    userId: string,
    phoneNumber: string,
  ) => {
    try {
      const [, inventory] = await Promise.all([
        validateAssignment(workspaceId, userId, phoneNumber),
        loadConfirmedInventory(workspaceId),
      ]);
      const updated = await input.database.query(
        `UPDATE dialer_phone_numbers AS target
         SET user_id = $2,
             slot_type = COALESCE(
               target.slot_type,
               CASE WHEN (
                 SELECT COUNT(*)
                 FROM dialer_phone_numbers AS existing
                 WHERE existing.workspace_id = $1
                   AND existing.phone_number <> $3
                   AND existing.status = 'active'
                   AND existing.slot_type = 'included'
               ) < $4 THEN 'included' ELSE 'additional' END
             ),
             updated_at = now()
         WHERE target.workspace_id = $1
           AND target.phone_number = $3
           AND target.status = 'active'
           AND (target.user_id IS NULL OR target.user_id = $2)
         RETURNING phone_number, user_id, slot_type`,
        [workspaceId, userId, phoneNumber, inventory.includedNumberQuantity],
      );
      if ((updated.rowCount ?? updated.rows.length) !== 1) {
        throw new Error('NUMBER_NOT_AVAILABLE');
      }
    } catch (cause: unknown) {
      throw normalizeAsyncError(cause);
    }
  };

  return {
    catalog: () => Effect.succeed(toSafeDialerPlanCatalog(input.catalog)),
    createCheckout: (identity, body) =>
      effectQuery(async () => {
        try {
          requireAdmin(identity, 'billing.manage');
          const billing = requireBilling();
          const quantities = billingQuantities(body);
          const subscription = await getWorkspaceSubscription(identity.workspaceId);
          if (
            subscription.subscriptionId &&
            !['canceled', 'incomplete_expired'].includes(subscription.status ?? '')
          ) {
            throw new Error('SUBSCRIPTION_ALREADY_EXISTS');
          }
          const customerId = await getOrCreateBillingCustomer(
            identity.userId,
            identity.workspaceId,
          );
          const returnUrl = requireBillingReturnUrl();
          return Effect.runPromise(
            billing.createCheckoutSession({
              workspaceId: identity.workspaceId,
              payerId: identity.userId,
              customerId,
              items: billingItems(input.catalog, quantities),
              successUrl: returnUrl + '?billing=success',
              cancelUrl: returnUrl + '?billing=cancelled',
            }),
          );
        } catch (cause: unknown) {
          throw normalizeAsyncError(cause);
        }
      }),
    createBillingPortal: (identity) =>
      effectQuery(async () => {
        try {
          requireAdmin(identity, 'billing.manage');
          const subscription = await getWorkspaceSubscription(identity.workspaceId);
          if (!subscription.customerId) {
            throw new Error('BILLING_CUSTOMER_NOT_FOUND');
          }
          return Effect.runPromise(
            requireBilling().createPortalSession({
              customerId: subscription.customerId,
              returnUrl: requireBillingReturnUrl(),
            }),
          );
        } catch (cause: unknown) {
          throw normalizeAsyncError(cause);
        }
      }),
    previewBillingChange: (identity, body) =>
      effectQuery(async () => {
        try {
          requireAdmin(identity, 'billing.manage');
          const subscription = await getWorkspaceSubscription(identity.workspaceId);
          if (!subscription.customerId || !subscription.subscriptionId) {
            throw new Error('BILLING_SUBSCRIPTION_NOT_FOUND');
          }
          const quantities = billingQuantities(body);
          await ensureBillingQuantitiesCoverResources(
            identity.workspaceId,
            quantities,
          );
          const prorationDate = Math.floor(now().getTime() / 1_000);
          return Effect.runPromise(
            requireBilling().previewSubscriptionChange({
              customerId: subscription.customerId,
              subscriptionId: subscription.subscriptionId,
              items: billingItems(input.catalog, quantities),
              prorationDate,
            }),
          );
        } catch (cause: unknown) {
          throw normalizeAsyncError(cause);
        }
      }),
    applyBillingChange: (identity, body) =>
      effectQuery(async () => {
        try {
          requireAdmin(identity, 'billing.manage');
          const subscription = await getWorkspaceSubscription(identity.workspaceId);
          if (!subscription.subscriptionId) {
            throw new Error('BILLING_SUBSCRIPTION_NOT_FOUND');
          }
          const bodyRecord = record(body);
          const quantities = billingQuantities(body);
          await ensureBillingQuantitiesCoverResources(
            identity.workspaceId,
            quantities,
          );
          const prorationDate = Number(bodyRecord.prorationDate);
          if (!Number.isSafeInteger(prorationDate) || prorationDate <= 0) {
            throw new Error('INVALID_PRORATION_DATE');
          }
          await Effect.runPromise(
            requireBilling().reconcileSubscription({
              subscriptionId: subscription.subscriptionId,
              workspaceId: identity.workspaceId,
              items: billingItems(input.catalog, quantities),
              prorationDate,
            }),
          );
          return { updated: true as const, pendingWebhook: true as const };
        } catch (cause: unknown) {
          throw normalizeAsyncError(cause);
        }
      }),
    callerContext: (identity) => effectQuery(() => loadCallerContext(identity)),
    authorizeCall: (identity, body) =>
      effectQuery(async () => {
        try {
          const bodyRecord = record(body);
          const caller = await loadCallerContext(identity);
          if (!caller.canStartCall) {
            throw new Error(caller.denialCode ?? 'CALL_NOT_ENTITLED');
          }
          const requestedFanout = Number(bodyRecord.requestedFanout ?? 1);
          if (
            !Number.isSafeInteger(requestedFanout) ||
            !caller.lineOptions.includes(requestedFanout)
          ) {
            throw new Error('FANOUT_NOT_ENTITLED');
          }
          if (
            bodyRecord.selectionStrategy === 'predictive' &&
            !caller.predictive
          ) {
            throw new Error('PREDICTIVE_NOT_ENTITLED');
          }
          const callerIdNumber = stringValue(bodyRecord.callerIdNumber);
          if (callerIdNumber && !caller.callerIds.includes(callerIdNumber)) {
            throw new Error('CALLER_ID_NOT_ASSIGNED');
          }
          return {
            ...bodyRecord,
            requestedFanout,
            recordingEnabled: caller.recordings,
            transcriptionEnabled: caller.transcripts,
          };
        } catch (cause: unknown) {
          throw normalizeAsyncError(cause);
        }
      }),
    dashboard: (identity) =>
      effectQuery(async () => {
        try {
          requireAdmin(identity, 'seats.manage');
          const [subscription, subscriptionItems, seats, numbers, usage] =
            await Promise.all([
            input.database.query(
              `SELECT status, payment_failed_at, cancel_at_period_end,
                      provider_customer_id, provider_subscription_id
               FROM dialer_workspace_subscriptions
               WHERE workspace_id = $1`,
              [identity.workspaceId],
            ),
            input.database.query(
              `SELECT item_code, provider_price_id, quantity
               FROM dialer_workspace_subscription_items
               WHERE workspace_id = $1
               ORDER BY item_code`,
              [identity.workspaceId],
            ),
            input.database.query(
              `SELECT user_id, plan_code, status
               FROM dialer_team_seats
               WHERE workspace_id = $1
               ORDER BY user_id`,
              [identity.workspaceId],
            ),
            input.database.query(
              `SELECT phone_number, user_id, status
               FROM dialer_phone_numbers
               WHERE workspace_id = $1
               ORDER BY phone_number`,
              [identity.workspaceId],
            ),
            input.database.query(
              `SELECT COALESCE(SUM(quantity), 0)::integer AS connected_minutes,
                      COALESCE(SUM(provider_cost_micros), 0)::bigint AS provider_cost_micros
               FROM dialer_usage_events
               WHERE workspace_id = $1`,
              [identity.workspaceId],
            ),
          ]);
          const subscriptionRow = record(subscription.rows[0]);
          const customerId = stringValue(subscriptionRow.provider_customer_id);
          const subscriptionId = stringValue(
            subscriptionRow.provider_subscription_id,
          );
          let billingSummary: {
            amountDue: number;
            currency: string;
            periodEnd: number | null;
          } | null = null;
          let billingSummaryError: string | null = null;
          if (input.billing && customerId && subscriptionId) {
            try {
              billingSummary = await Effect.runPromise(
                input.billing.getUpcomingInvoiceSummary({
                  customerId,
                  subscriptionId,
                }),
              );
            } catch {
              billingSummaryError = 'Upcoming invoice is temporarily unavailable';
            }
          }
          return {
            workspaceId: identity.workspaceId,
            catalog: toSafeDialerPlanCatalog(input.catalog),
            subscription: subscription.rows[0] ?? null,
            subscriptionItems: subscriptionItems.rows,
            billingSummary,
            billingSummaryError,
            seats: seats.rows,
            numbers: numbers.rows,
            usage: usage.rows[0] ?? {
              connected_minutes: 0,
              provider_cost_micros: 0,
            },
          };
        } catch (cause: unknown) {
          throw normalizeAsyncError(cause);
        }
      }),
    updateTeam: (identity, body) =>
      effectQuery(async () => {
        try {
          requireAdmin(identity, 'seats.manage');
          const assignmentsValue = record(body).assignments;
          if (!Array.isArray(assignmentsValue)) {
            throw new Error('INVALID_SEAT_ASSIGNMENTS');
          }
          const assignments = assignmentsValue.map((candidate) => {
            const candidateRecord = record(candidate);
            const userId = stringValue(candidateRecord.userId);
            if (!userId) throw new Error('INVALID_SEAT_USER');
            return { userId, planCode: planCode(candidateRecord.planCode) };
          });
          const inventory = await loadConfirmedInventory(identity.workspaceId);
          validateSeatInventory({
            purchased: inventory.purchased,
            assignments,
            requested: inventory.purchased,
          });
          for (const assignment of assignments) {
            await Effect.runPromise(
              persistence.saveSeatAssignment({
                workspaceId: identity.workspaceId,
                userId: assignment.userId,
                planCode: assignment.planCode,
              }),
            );
          }
          await input.database.query(
            `UPDATE dialer_team_seats
             SET status = 'disabled', updated_at = now()
             WHERE workspace_id = $1
               AND NOT (user_id = ANY($2::text[]))`,
            [identity.workspaceId, assignments.map(({ userId }) => userId)],
          );
          return { updated: true, assignments };
        } catch (cause: unknown) {
          throw normalizeAsyncError(cause);
        }
      }),
    assignNumber: (identity, body) =>
      effectQuery(async () => {
        try {
          requireAdmin(identity, 'numbers.manage');
          const bodyRecord = record(body);
          const userId = stringValue(bodyRecord.userId);
          if (!userId) throw new Error('INVALID_NUMBER_ASSIGNMENT');
          const phoneNumber = e164(bodyRecord.phoneNumber);
          await assignExistingNumber(identity.workspaceId, userId, phoneNumber);
          return { assigned: true, phoneNumber, userId };
        } catch (cause: unknown) {
          throw normalizeAsyncError(cause);
        }
      }),
    searchNumbers: (identity, body) =>
      effectQuery(async () => {
        try {
          requireAdmin(identity, 'numbers.manage');
          if (!input.numbers) throw new Error('NUMBER_PROVIDER_UNAVAILABLE');
          const bodyRecord = record(body);
          const areaCode = stringValue(bodyRecord.areaCode);
          if (areaCode && !/^\d{3}$/.test(areaCode)) {
            throw new Error('INVALID_AREA_CODE');
          }
          const numbers = await input.numbers.searchAvailable({
            workspaceId: identity.workspaceId,
            ...(areaCode ? { areaCode } : {}),
            ...(stringValue(bodyRecord.contains)
              ? { contains: stringValue(bodyRecord.contains) }
              : {}),
            ...(stringValue(bodyRecord.country)
              ? { country: stringValue(bodyRecord.country).toUpperCase() }
              : {}),
            limit: positiveLimit(bodyRecord.limit),
          });
          return { numbers };
        } catch (cause: unknown) {
          throw normalizeAsyncError(cause);
        }
      }),
    provisionNumber: (identity, body) =>
      effectQuery(async () => {
        try {
          requireAdmin(identity, 'numbers.manage');
          if (!input.numbers) throw new Error('NUMBER_PROVIDER_UNAVAILABLE');
          const bodyRecord = record(body);
          const userId = stringValue(bodyRecord.userId);
          if (!userId) throw new Error('INVALID_NUMBER_ASSIGNMENT');
          const phoneNumber = e164(bodyRecord.phoneNumber);
          const billingAccess = await loadBillingAccess(identity.workspaceId);
          if (!billingAccess.canPurchaseNumbers) {
            throw new Error('BILLING_ACCESS_BLOCKED');
          }
          await ensureNumberInventory(identity.workspaceId);
          await validateAssignment(identity.workspaceId, userId, phoneNumber);
          const provisioned = await input.numbers.provision({
            workspaceId: identity.workspaceId,
            phoneNumber,
          });
          await assignExistingNumber(
            identity.workspaceId,
            userId,
            provisioned.phoneNumber,
          );
          return { provisioned: true, ...provisioned, userId };
        } catch (cause: unknown) {
          throw normalizeAsyncError(cause);
        }
      }),
    releaseNumber: (identity, body) =>
      effectQuery(async () => {
        try {
          requireAdmin(identity, 'numbers.manage');
          if (!input.numbers) throw new Error('NUMBER_PROVIDER_UNAVAILABLE');
          const phoneNumber = e164(record(body).phoneNumber);
          const numberResult = await input.database.query(
            `SELECT phone_number, user_id, slot_type, status
             FROM dialer_phone_numbers
             WHERE workspace_id = $1 AND phone_number = $2 AND status = 'active'`,
            [identity.workspaceId, phoneNumber],
          );
          const number = record(numberResult.rows[0]);
          const slotType = stringValue(number.slot_type);
          if (slotType !== 'included' && slotType !== 'additional') {
            throw new Error('NUMBER_SLOT_NOT_FOUND');
          }

          let addOnAdjustment:
            | {
                subscriptionId: string;
                items: Array<{
                  code: DialerPlanCode | 'additional-number';
                  priceId: string;
                  quantity: number;
                }>;
              }
            | null = null;
          if (slotType === 'additional') {
            const [subscription, itemResult] = await Promise.all([
              getWorkspaceSubscription(identity.workspaceId),
              input.database.query(
                `SELECT item_code, provider_price_id, quantity
                 FROM dialer_workspace_subscription_items
                 WHERE workspace_id = $1
                 ORDER BY item_code`,
                [identity.workspaceId],
              ),
            ]);
            if (!subscription.subscriptionId) {
              throw new Error('BILLING_SUBSCRIPTION_NOT_FOUND');
            }
            const items = itemResult.rows
              .map((row) => {
                const item = record(row);
                const code = stringValue(item.item_code);
                const priceId = stringValue(item.provider_price_id);
                const quantity = nonNegativeQuantity(item.quantity);
                if (
                  !priceId ||
                  !['single', 'standard', 'power', 'additional-number'].includes(
                    code,
                  )
                ) {
                  throw new Error('INVALID_CONFIRMED_SUBSCRIPTION_ITEM');
                }
                return {
                  code: code as DialerPlanCode | 'additional-number',
                  priceId,
                  quantity:
                    code === 'additional-number' ? Math.max(0, quantity - 1) : quantity,
                };
              })
              .filter((item) => item.quantity > 0);
            const confirmedAddOn = itemResult.rows.find(
              (row) => stringValue(record(row).item_code) === 'additional-number',
            );
            if (nonNegativeQuantity(record(confirmedAddOn).quantity) < 1) {
              throw new Error('ADDITIONAL_NUMBER_INVENTORY_MISSING');
            }
            addOnAdjustment = {
              subscriptionId: subscription.subscriptionId,
              items,
            };
          }

          const result = await input.numbers.release({
            workspaceId: identity.workspaceId,
            phoneNumber,
          });
          if (addOnAdjustment) {
            const billing = requireBilling();
            await Effect.runPromise(
              billing
                .reconcileSubscription({
                  subscriptionId: addOnAdjustment.subscriptionId,
                  workspaceId: identity.workspaceId,
                  items: addOnAdjustment.items,
                  prorationDate: Math.floor(now().getTime() / 1_000),
                })
                .pipe(Effect.retry(Schedule.recurs(2))),
            );
          }
          return {
            ...result,
            phoneNumber,
            slotType,
            pendingWebhook: addOnAdjustment !== null,
          };
        } catch (cause: unknown) {
          throw normalizeAsyncError(cause);
        }
      }),
    processStripeWebhook: ({ rawBody, signature }) =>
      effectQuery(async () => {
        if (!input.billing) throw new Error('BILLING_PROVIDER_UNAVAILABLE');
        let event;
        try {
          event = input.billing.constructWebhookEvent(rawBody, signature);
        } catch (cause: unknown) {
          throw new Error('INVALID_STRIPE_SIGNATURE', { cause });
        }
        const object = record(record(event.data).object);
        const providerSubscriptionId =
          stringValue(object.id).startsWith('sub_')
            ? stringValue(object.id)
            : subscriptionReference(object);
        const workspaceId =
          metadataWorkspaceId(object) ||
          (providerSubscriptionId
            ? await workspaceForSubscription(providerSubscriptionId)
            : '');
        if (!workspaceId) throw new Error('STRIPE_WORKSPACE_NOT_FOUND');
        const providerEvent = {
          workspaceId,
          source: 'stripe',
          sourceId: event.id,
        };
        const claimed = await Effect.runPromise(
          persistence.claimProviderEvent(providerEvent),
        );
        if (!claimed) return { received: true as const, duplicate: true };

        try {
          if (event.type.startsWith('customer.subscription.')) {
          const deleted = event.type === 'customer.subscription.deleted';
          const status = deleted
            ? 'canceled'
            : stringValue(object.status) || 'unknown';
          const customerId = stringValue(object.customer) || null;
          await input.database.query(
            `INSERT INTO dialer_workspace_subscriptions (
               workspace_id, provider_customer_id, provider_subscription_id,
               status, cancel_at_period_end
             ) VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT (workspace_id) DO UPDATE
             SET provider_customer_id = EXCLUDED.provider_customer_id,
                 provider_subscription_id = EXCLUDED.provider_subscription_id,
                 status = EXCLUDED.status,
                 cancel_at_period_end = EXCLUDED.cancel_at_period_end,
                 updated_at = now()`,
            [
              workspaceId,
              customerId,
              providerSubscriptionId,
              status,
              booleanValue(object.cancel_at_period_end),
            ],
          );
          const payerId = metadataPayerId(object);
          if (payerId && customerId) {
            await input.database.query(
              `INSERT INTO dialer_billing_accounts (
                 payer_user_id, provider_customer_id
               ) VALUES ($1, $2)
               ON CONFLICT (payer_user_id) DO UPDATE
               SET updated_at = now()`,
              [payerId, customerId],
            );
          }
          await input.database.query(
            `DELETE FROM dialer_workspace_subscription_items
             WHERE workspace_id = $1`,
            [workspaceId],
          );
          if (!deleted) {
            const providerItems = record(object.items).data;
            if (!Array.isArray(providerItems)) {
              throw new Error('STRIPE_SUBSCRIPTION_ITEMS_REQUIRED');
            }
            for (const candidate of providerItems) {
              const item = record(candidate);
              const providerItemId = stringValue(item.id);
              const priceId = stringValue(record(item.price).id);
              const quantity = nonNegativeQuantity(item.quantity);
              if (!providerItemId || !priceId) {
                throw new Error('INVALID_STRIPE_SUBSCRIPTION_ITEM');
              }
              await input.database.query(
                `INSERT INTO dialer_workspace_subscription_items (
                   workspace_id, item_code, provider_item_id,
                   provider_price_id, quantity
                 ) VALUES ($1, $2, $3, $4, $5)`,
                [
                  workspaceId,
                  itemCodeForPrice(input.catalog, priceId),
                  providerItemId,
                  priceId,
                  quantity,
                ],
              );
            }
          }
          }
          if (event.type === 'invoice.payment_failed') {
          await input.database.query(
            `INSERT INTO dialer_workspace_subscriptions (
               workspace_id, provider_customer_id, provider_subscription_id,
               status, payment_failed_at
             ) VALUES ($1, $2, $3, 'past_due', $4)
             ON CONFLICT (workspace_id) DO UPDATE
             SET provider_customer_id = COALESCE(
                   dialer_workspace_subscriptions.provider_customer_id,
                   EXCLUDED.provider_customer_id
                 ),
                 provider_subscription_id = COALESCE(
                   dialer_workspace_subscriptions.provider_subscription_id,
                   EXCLUDED.provider_subscription_id
                 ),
                 status = 'past_due',
                 payment_failed_at = COALESCE(
                   dialer_workspace_subscriptions.payment_failed_at,
                   EXCLUDED.payment_failed_at
                 ),
                 updated_at = now()`,
            [
              workspaceId,
              stringValue(object.customer) || null,
              providerSubscriptionId || null,
              now().toISOString(),
            ],
          );
          }
          if (event.type === 'invoice.paid') {
          await input.database.query(
            `UPDATE dialer_workspace_subscriptions
             SET payment_failed_at = NULL, updated_at = now()
             WHERE workspace_id = $1`,
            [workspaceId],
          );
          }
          await Effect.runPromise(
            persistence.completeProviderEvent(providerEvent),
          );
          return { received: true as const, duplicate: false };
        } catch (cause: unknown) {
          await Effect.runPromise(
            persistence.failProviderEvent({
              ...providerEvent,
              errorCode: 'STRIPE_EVENT_PROCESSING_FAILED',
            }),
          ).catch(() => undefined);
          throw cause;
        }
      }),
    processInstallationUninstall: (event) => {
      const billing = input.billing;
      if (!billing) {
        return Effect.fail(new Error('BILLING_PROVIDER_UNAVAILABLE'));
      }
      return processInstallationUninstallEffect({
        event: {
          id: event.id,
          workspaceId: event.workspaceId,
          locationId: event.locationId,
          appId: event.appId ?? '',
        },
        repository: {
          claimWebhookEvent: (eventId) =>
            persistence.claimProviderEvent({
              workspaceId: event.workspaceId,
              source: 'leadconnector.installation',
              sourceId: eventId,
            }),
          completeWebhookEvent: (eventId) =>
            persistence.completeProviderEvent({
              workspaceId: event.workspaceId,
              source: 'leadconnector.installation',
              sourceId: eventId,
            }),
          failWebhookEvent: (eventId, errorCode) =>
            persistence.failProviderEvent({
              workspaceId: event.workspaceId,
              source: 'leadconnector.installation',
              sourceId: eventId,
              errorCode,
            }),
          getWorkspaceSubscriptionId: (workspaceId) =>
            effectQuery(() => subscriptionIdForWorkspace(workspaceId)),
          disableInstallation: ({ workspaceId, locationId }) =>
            effectQuery(async () => {
              try {
                await input.database.query(
                  `INSERT INTO dialer_installation_lifecycle_events (
                     workspace_id, location_id, source_id, event_type
                   ) VALUES ($1, $2, $3, 'uninstalled')
                   ON CONFLICT (source_id) DO NOTHING`,
                  [workspaceId, locationId, event.id],
                );
              } catch (cause: unknown) {
                throw normalizeAsyncError(cause);
              }
            }),
        },
        stripe: {
          scheduleCancellationAtPeriodEnd: (subscriptionId) =>
            billing.scheduleCancellationAtPeriodEnd(subscriptionId),
        },
      });
    },
    recordProviderCompletion: (request) =>
      effectQuery(async () => {
        try {
          const terminal = new Set([
            'completed',
            'failed',
            'busy',
            'no-answer',
            'canceled',
          ]);
          if (!terminal.has(request.status) || !input.usage) return null;
          const sessionResult = await input.database.query(
            `SELECT user_id
             FROM dialer_call_sessions
             WHERE workspace_id = $1 AND id = $2`,
            [request.workspaceId, request.sessionId],
          );
          const userId = stringValue(record(sessionResult.rows[0]).user_id);
          if (!userId) throw new Error('USAGE_SESSION_NOT_FOUND');
          const completion = await input.usage.getCompletion(
            request.providerCallId,
          );
          return Effect.runPromise(
            recordFinalProviderUsage({
              completion: {
                workspaceId: request.workspaceId,
                userId,
                seatId: userId,
                sessionId: request.sessionId,
                providerCallId: request.providerCallId,
                ...completion,
                billingPeriod: billingPeriod(now()),
              },
              repository: {
                claimSource: (workspaceId, sourceId) =>
                  persistence.claimProviderEvent({
                    workspaceId,
                    source: 'twilio.usage',
                    sourceId,
                  }),
                completeSource: (workspaceId, sourceId) =>
                  persistence.completeProviderEvent({
                    workspaceId,
                    source: 'twilio.usage',
                    sourceId,
                  }),
                failSource: (workspaceId, sourceId, errorCode) =>
                  persistence.failProviderEvent({
                    workspaceId,
                    source: 'twilio.usage',
                    sourceId,
                    errorCode,
                  }),
                insertUsageEvent: (usageEvent) =>
                  effectQuery(async () => {
                    try {
                      await input.database.query(
                        `INSERT INTO dialer_usage_events (
                           workspace_id, source_type, source_id, user_id, seat_id,
                           metric, quantity, provider_cost_micros, occurred_at, payload
                         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb)
                         ON CONFLICT (workspace_id, source_type, source_id) DO NOTHING`,
                        [
                          usageEvent.workspaceId,
                          usageEvent.sourceType,
                          usageEvent.sourceId,
                          usageEvent.userId,
                          usageEvent.seatId,
                          usageEvent.metric,
                          usageEvent.quantity,
                          usageEvent.providerCostMicros,
                          usageEvent.occurredAt,
                          JSON.stringify({
                            sessionId: usageEvent.sessionId,
                            billingPeriod: usageEvent.billingPeriod,
                          }),
                        ],
                      );
                    } catch (cause: unknown) {
                      throw normalizeAsyncError(cause);
                    }
                  }),
              },
              releaseResources: () => Effect.void,
            }),
          );
        } catch (cause: unknown) {
          throw normalizeAsyncError(cause);
        }
      }),
  };
};
