import { Effect } from 'effect';

import {
  processInstallationUninstall as processInstallationUninstallEffect,
  projectSubscriptionItems,
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

type CommercialRecord = Record<string, unknown>;
type CommercialBilling = ReturnType<typeof createStripeCommercialBilling>;

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

const metadataWorkspaceId = (object: CommercialRecord): string =>
  stringValue(record(object.metadata).workspaceId);

const subscriptionReference = (object: CommercialRecord): string => {
  const direct = stringValue(object.subscription);
  if (direct) return direct;
  const parent = record(object.parent);
  const details = record(parent.subscription_details);
  return stringValue(details.subscription);
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

export const createCommercialApplication = (input: {
  database: CommercialSqlClient;
  catalog: DialerPlanCatalog;
  billing?: CommercialBilling;
  numbers?: CommercialNumberProvider;
  usage?: CommercialUsageProvider;
  now?: () => Date;
}): CommercialRouteDependencies => {
  const persistence = createCommercialPersistence(input.database);
  const now = input.now ?? (() => new Date());

  const subscriptionIdForWorkspace = async (
    workspaceId: string,
  ): Promise<string | null> => {
    const result = await input.database.query(
      `SELECT provider_subscription_id
       FROM dialer_workspace_subscriptions
       WHERE workspace_id = $1`,
      [workspaceId],
    );
    const id = record(result.rows[0]).provider_subscription_id;
    return typeof id === 'string' && id ? id : null;
  };

  const workspaceForSubscription = async (
    subscriptionId: string,
  ): Promise<string> => {
    const result = await input.database.query(
      `SELECT workspace_id
       FROM dialer_workspace_subscriptions
       WHERE provider_subscription_id = $1`,
      [subscriptionId],
    );
    const workspaceId = stringValue(record(result.rows[0]).workspace_id);
    if (!workspaceId) throw new Error('STRIPE_WORKSPACE_NOT_FOUND');
    return workspaceId;
  };

  const reconcileWorkspaceSubscription = async (
    workspaceId: string,
  ): Promise<void> => {
    const [seatResult, numberResult] = await Promise.all([
      input.database.query(
        `SELECT user_id, plan_code
         FROM dialer_team_seats
         WHERE workspace_id = $1 AND status = 'active'`,
        [workspaceId],
      ),
      input.database.query(
        `SELECT COUNT(*)::integer AS quantity
         FROM dialer_phone_numbers
         WHERE workspace_id = $1 AND status = 'active'`,
        [workspaceId],
      ),
    ]);
    const seats = seatResult.rows.map((row) => {
      const candidate = record(row);
      return {
        userId: stringValue(candidate.user_id),
        planCode: planCode(candidate.plan_code),
      };
    });
    const activeNumberQuantity = Number(
      record(numberResult.rows[0]).quantity ?? 0,
    );
    const includedNumberQuantity =
      seats.length * input.catalog.includedNumbersPerSeat;
    const items = projectSubscriptionItems({
      catalog: input.catalog,
      seats,
      additionalNumberQuantity: Math.max(
        0,
        activeNumberQuantity - includedNumberQuantity,
      ),
    });
    const subscriptionId = await subscriptionIdForWorkspace(workspaceId);
    if (subscriptionId) {
      if (!input.billing) throw new Error('BILLING_PROVIDER_UNAVAILABLE');
      await Effect.runPromise(
        input.billing.reconcileSubscription({
          subscriptionId,
          workspaceId,
          items,
        }),
      );
    }
    await input.database.query(
      `DELETE FROM dialer_workspace_subscription_items
       WHERE workspace_id = $1`,
      [workspaceId],
    );
    for (const item of items) {
      await input.database.query(
        `INSERT INTO dialer_workspace_subscription_items (
           workspace_id, item_code, provider_price_id, quantity
         ) VALUES ($1, $2, $3, $4)`,
        [workspaceId, item.code, item.priceId, item.quantity],
      );
    }
  };

  const validateAssignment = async (
    workspaceId: string,
    userId: string,
    phoneNumber: string,
  ) => {
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
  };

  const loadCallerContext = async (identity: CommercialIdentity) => {
    authorizeCommercialAction({
      identity: {
        workspaceId: identity.workspaceId,
        userId: identity.userId,
        role: identity.role ?? 'user',
      },
      targetWorkspaceId: identity.workspaceId,
      action: 'calls.start',
    });
    const [seatResult, numberResult, usageResult, subscriptionResult, totals] =
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
        input.database.query(
          `SELECT status, payment_failed_at, cancel_at_period_end
           FROM dialer_workspace_subscriptions
           WHERE workspace_id = $1`,
          [identity.workspaceId],
        ),
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
    const subscription = record(subscriptionResult.rows[0]);
    const paymentFailedAt = stringValue(subscription.payment_failed_at);
    const billing = subscriptionResult.rows[0]
      ? resolveBillingAccess({
          status: stringValue(subscription.status) || 'active',
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
  };

  const assignExistingNumber = async (
    workspaceId: string,
    userId: string,
    phoneNumber: string,
  ) => {
    await validateAssignment(workspaceId, userId, phoneNumber);
    const updated = await input.database.query(
      `UPDATE dialer_phone_numbers
       SET user_id = $2, updated_at = now()
       WHERE workspace_id = $1 AND phone_number = $3 AND status = 'active'
         AND (user_id IS NULL OR user_id = $2)
       RETURNING phone_number, user_id`,
      [workspaceId, userId, phoneNumber],
    );
    if ((updated.rowCount ?? updated.rows.length) !== 1) {
      throw new Error('NUMBER_NOT_AVAILABLE');
    }
  };

  return {
    catalog: () => Effect.succeed(toSafeDialerPlanCatalog(input.catalog)),
    callerContext: (identity) => effectQuery(() => loadCallerContext(identity)),
    authorizeCall: (identity, body) =>
      effectQuery(async () => {
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
        return { ...bodyRecord, requestedFanout };
      }),
    dashboard: (identity) =>
      effectQuery(async () => {
        requireAdmin(identity, 'seats.manage');
        const [subscription, seats, numbers, usage] = await Promise.all([
          input.database.query(
            `SELECT status, payment_failed_at, cancel_at_period_end,
                    provider_customer_id, provider_subscription_id
             FROM dialer_workspace_subscriptions
             WHERE workspace_id = $1`,
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
        return {
          workspaceId: identity.workspaceId,
          catalog: toSafeDialerPlanCatalog(input.catalog),
          subscription: subscription.rows[0] ?? null,
          seats: seats.rows,
          numbers: numbers.rows,
          usage: usage.rows[0] ?? {
            connected_minutes: 0,
            provider_cost_micros: 0,
          },
        };
      }),
    updateTeam: (identity, body) =>
      effectQuery(async () => {
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
        const requested: Record<DialerPlanCode, number> = {
          single: 0,
          standard: 0,
          power: 0,
        };
        for (const assignment of assignments) requested[assignment.planCode] += 1;
        validateSeatInventory({
          purchased: requested,
          assignments,
          requested,
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
        await reconcileWorkspaceSubscription(identity.workspaceId);
        return { updated: true, assignments };
      }),
    assignNumber: (identity, body) =>
      effectQuery(async () => {
        requireAdmin(identity, 'numbers.manage');
        const bodyRecord = record(body);
        const userId = stringValue(bodyRecord.userId);
        if (!userId) throw new Error('INVALID_NUMBER_ASSIGNMENT');
        const phoneNumber = e164(bodyRecord.phoneNumber);
        await assignExistingNumber(identity.workspaceId, userId, phoneNumber);
        return { assigned: true, phoneNumber, userId };
      }),
    searchNumbers: (identity, body) =>
      effectQuery(async () => {
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
      }),
    provisionNumber: (identity, body) =>
      effectQuery(async () => {
        requireAdmin(identity, 'numbers.manage');
        if (!input.numbers) throw new Error('NUMBER_PROVIDER_UNAVAILABLE');
        const bodyRecord = record(body);
        const userId = stringValue(bodyRecord.userId);
        if (!userId) throw new Error('INVALID_NUMBER_ASSIGNMENT');
        const phoneNumber = e164(bodyRecord.phoneNumber);
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
        await reconcileWorkspaceSubscription(identity.workspaceId);
        return { provisioned: true, ...provisioned, userId };
      }),
    releaseNumber: (identity, body) =>
      effectQuery(async () => {
        requireAdmin(identity, 'numbers.manage');
        if (!input.numbers) throw new Error('NUMBER_PROVIDER_UNAVAILABLE');
        const phoneNumber = e164(record(body).phoneNumber);
        const result = await input.numbers.release({
          workspaceId: identity.workspaceId,
          phoneNumber,
        });
        await reconcileWorkspaceSubscription(identity.workspaceId);
        return { ...result, phoneNumber };
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
        const claimed = await Effect.runPromise(
          persistence.claimProviderEvent({
            workspaceId,
            source: 'stripe',
            sourceId: event.id,
          }),
        );
        if (!claimed) return { received: true as const, duplicate: true };

        if (event.type.startsWith('customer.subscription.')) {
          const status =
            event.type === 'customer.subscription.deleted'
              ? 'canceled'
              : stringValue(object.status) || 'active';
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
              stringValue(object.customer) || null,
              providerSubscriptionId,
              status,
              booleanValue(object.cancel_at_period_end),
            ],
          );
        }
        if (event.type === 'invoice.payment_failed') {
          await input.database.query(
            `UPDATE dialer_workspace_subscriptions
             SET status = 'past_due', payment_failed_at = COALESCE(payment_failed_at, $2),
                 updated_at = now()
             WHERE workspace_id = $1`,
            [workspaceId, now().toISOString()],
          );
        }
        if (event.type === 'invoice.paid') {
          await input.database.query(
            `UPDATE dialer_workspace_subscriptions
             SET status = 'active', payment_failed_at = NULL, updated_at = now()
             WHERE workspace_id = $1`,
            [workspaceId],
          );
        }
        return { received: true as const, duplicate: false };
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
          getWorkspaceSubscriptionId: (workspaceId) =>
            effectQuery(() => subscriptionIdForWorkspace(workspaceId)),
          disableInstallation: ({ workspaceId, locationId }) =>
            effectQuery(async () => {
              await input.database.query(
                `INSERT INTO dialer_installation_lifecycle_events (
                   workspace_id, location_id, source_id, event_type
                 ) VALUES ($1, $2, $3, 'uninstalled')
                 ON CONFLICT (source_id) DO NOTHING`,
                [workspaceId, locationId, event.id],
              );
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
              insertUsageEvent: (usageEvent) =>
                effectQuery(async () => {
                  await input.database.query(
                    `INSERT INTO dialer_usage_events (
                       workspace_id, source_type, source_id, user_id, seat_id,
                       metric, quantity, provider_cost_micros, occurred_at, payload
                     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb)`,
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
                }),
            },
            releaseResources: () => Effect.void,
          }),
        );
      }),
  };
};
