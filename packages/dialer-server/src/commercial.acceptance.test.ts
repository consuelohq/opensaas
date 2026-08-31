import { describe, expect, it } from 'bun:test';
import { Effect } from 'effect';

type PlanCode = 'single' | 'standard' | 'power';

type PlanDefinition = {
  code: PlanCode;
  priceCents: number;
  stripePriceId: string;
  maxNumbersPerSeat: number;
  includedMinutes: number | null;
  providerBudgetCents: number | null;
  predictive: boolean;
  recordings: boolean;
  transcripts: boolean;
};

type DialerPlanCatalog = {
  plans: Record<PlanCode, PlanDefinition>;
  trial: {
    includedMinutes: number;
    maxSeats: number;
    maxNumbers: number;
    planCode: PlanCode;
  };
  includedNumbersPerSeat: number;
  additionalNumberPriceCents: number;
  additionalNumberStripePriceId: string;
  paymentGraceDays: number;
};

type SafeDialerPlanCatalog = {
  plans: Record<
    PlanCode,
    Omit<PlanDefinition, 'stripePriceId' | 'providerBudgetCents'>
  >;
  trial: DialerPlanCatalog['trial'];
  includedNumbersPerSeat: number;
  additionalNumberPriceCents: number;
  paymentGraceDays: number;
};

type CatalogModule = {
  loadDialerPlanCatalog: (
    environment: Record<string, string | undefined>,
  ) => DialerPlanCatalog;
  toSafeDialerPlanCatalog: (
    catalog: DialerPlanCatalog,
  ) => SafeDialerPlanCatalog;
};

type EntitlementModule = {
  resolveSeatEntitlement: (input: {
    catalog: DialerPlanCatalog;
    planCode: PlanCode;
    activeNumberCount: number;
    requestedLines: number;
    callerIdSelection:
      | { kind: 'automatic' }
      | { kind: 'explicit'; phoneNumber: string };
    connectedMinutes: number;
  }) => {
    maxNumbers: number;
    effectiveLineCount: number;
    predictive: boolean;
    recordings: boolean;
    transcripts: boolean;
    canStartCall: boolean;
    denialCode: string | null;
  };
  resolveTrialEntitlement: (input: {
    catalog: DialerPlanCatalog;
    seatCount: number;
    numberCount: number;
    connectedMinutes: number;
  }) => {
    planCode: PlanCode;
    canStartCall: boolean;
    canAddSeat: boolean;
    canAddNumber: boolean;
    remainingMinutes: number;
  };
};

type TeamAuthorizationModule = {
  authorizeCommercialAction: (input: {
    identity: { workspaceId: string; userId: string; role: string };
    targetWorkspaceId: string;
    action:
      | 'billing.manage'
      | 'numbers.manage'
      | 'seats.manage'
      | 'calls.start';
  }) => void;
  validateSeatInventory: (input: {
    purchased: Record<PlanCode, number>;
    assignments: Array<{ userId: string; planCode: PlanCode }>;
    requested: Record<PlanCode, number>;
  }) => void;
};

type BillingModule = {
  projectSubscriptionItems: (input: {
    catalog: DialerPlanCatalog;
    seats: Array<{ userId: string; planCode: PlanCode }>;
    additionalNumberQuantity: number;
  }) => Array<{ code: string; priceId: string; quantity: number }>;
  resolveBillingAccess: (input: {
    status: string;
    paymentFailedAt: Date | null;
    now: Date;
    graceDays: number;
  }) => {
    state: 'active' | 'grace' | 'blocked' | 'canceled';
    canStartCalls: boolean;
    canPurchaseNumbers: boolean;
    canManageBilling: boolean;
    canReadHistory: boolean;
    graceEndsAt: string | null;
  };
  processInstallationUninstall: (input: {
    event: {
      id: string;
      workspaceId: string;
      locationId: string;
      appId: string;
    };
    repository: {
      claimWebhookEvent: (
        eventId: string,
      ) => Effect.Effect<boolean, never>;
      completeWebhookEvent: (eventId: string) => Effect.Effect<void, never>;
      failWebhookEvent: (
        eventId: string,
        errorCode: string,
      ) => Effect.Effect<void, never>;
      getWorkspaceSubscriptionId: (
        workspaceId: string,
      ) => Effect.Effect<string | null, never>;
      disableInstallation: (input: {
        workspaceId: string;
        locationId: string;
      }) => Effect.Effect<void, never>;
    };
    stripe: {
      scheduleCancellationAtPeriodEnd: (
        subscriptionId: string,
      ) => Effect.Effect<void, never>;
    };
  }) => Effect.Effect<
    { duplicate: boolean; cancellationScheduled: boolean },
    unknown
  >;
};

type UsageModule = {
  createUsageEventFromProviderCompletion: (input: {
    workspaceId: string;
    userId: string;
    seatId: string;
    sessionId: string;
    providerCallId: string;
    customerConnectedSeconds: number;
    agentConnectedSeconds: number;
    providerCostMicros: number;
    occurredAt: string;
    billingPeriod: { start: string; end: string };
  }) => {
    workspaceId: string;
    userId: string;
    seatId: string;
    metric: 'connected_minutes';
    quantity: number;
    providerCostMicros: number;
    sourceType: 'twilio.call.completed';
    sourceId: string;
  };
  recordFinalProviderUsage: (input: {
    completion: {
      workspaceId: string;
      userId: string;
      seatId: string;
      sessionId: string;
      providerCallId: string;
      customerConnectedSeconds: number;
      agentConnectedSeconds: number;
      providerCostMicros: number;
      occurredAt: string;
      billingPeriod: { start: string; end: string };
    };
    repository: {
      claimSource: (
        workspaceId: string,
        sourceId: string,
      ) => Effect.Effect<boolean, never>;
      completeSource: (
        workspaceId: string,
        sourceId: string,
      ) => Effect.Effect<void, never>;
      failSource: (
        workspaceId: string,
        sourceId: string,
        errorCode: string,
      ) => Effect.Effect<void, never>;
      insertUsageEvent: (
        event: ReturnType<
          UsageModule['createUsageEventFromProviderCompletion']
        >,
      ) => Effect.Effect<void, never>;
    };
    releaseResources: () => Effect.Effect<void, never>;
  }) => Effect.Effect<{ duplicate: boolean }, unknown>;
};

type NumbersModule = {
  resolveEffectiveLineCount: (input: {
    requestedLines: number;
    planMaximum: number;
    activeAssignedNumbers: string[];
    callerIdSelection:
      | { kind: 'automatic' }
      | { kind: 'explicit'; phoneNumber: string };
  }) => { lineCount: number; callerIds: string[] };
  validateNumberAssignment: (input: {
    workspaceId: string;
    seatUserId: string;
    planMaximum: number;
    existingAssignments: Array<{
      workspaceId: string;
      userId: string;
      phoneNumber: string;
      status: 'active' | 'released';
    }>;
    phoneNumber: string;
  }) => void;
  ensureWorkspaceTelephonyAccount: (input: {
    workspaceId: string;
    repository: {
      get: (
        workspaceId: string,
      ) => Effect.Effect<
        { workspaceId: string; providerAccountId: string } | null,
        never
      >;
      save: (account: {
        workspaceId: string;
        providerAccountId: string;
        status: 'active';
      }) => Effect.Effect<void, never>;
    };
    provider: {
      createSubaccount: (input: {
        friendlyName: string;
      }) => Effect.Effect<{ id: string }, never>;
    };
  }) => Effect.Effect<
    { workspaceId: string; providerAccountId: string },
    unknown
  >;
};

const loadModule = async <TModule>(path: string): Promise<TModule> =>
  (await import(path)) as TModule;

const validEnvironment = (): Record<string, string> => ({
  DIALER_TRIAL_INCLUDED_MINUTES: '500',
  DIALER_TRIAL_MAX_SEATS: '1',
  DIALER_TRIAL_MAX_NUMBERS: '1',
  DIALER_TRIAL_PLAN_CODE: 'standard',
  DIALER_SINGLE_INCLUDED_MINUTES: '1388',
  DIALER_SINGLE_PROVIDER_BUDGET_CENTS: '3000',
  DIALER_PAYMENT_GRACE_DAYS: '3',
  DIALER_SINGLE_PRICE_CENTS: '5900',
  DIALER_STANDARD_PRICE_CENTS: '9900',
  DIALER_POWER_PRICE_CENTS: '15900',
  DIALER_SINGLE_MAX_NUMBERS_PER_SEAT: '1',
  DIALER_STANDARD_MAX_NUMBERS_PER_SEAT: '3',
  DIALER_POWER_MAX_NUMBERS_PER_SEAT: '10',
  DIALER_INCLUDED_NUMBERS_PER_SEAT: '1',
  DIALER_ADDITIONAL_NUMBER_PRICE_CENTS: '199',
  STRIPE_PRICE_SINGLE_MONTHLY: 'price_single_test',
  STRIPE_PRICE_STANDARD_MONTHLY: 'price_standard_test',
  STRIPE_PRICE_POWER_MONTHLY: 'price_power_test',
  STRIPE_PRICE_ADDITIONAL_NUMBER_MONTHLY: 'price_number_test',
});

describe('commercial plan catalog and entitlements', () => {
  it('loads the complete catalog from validated server environment and projects a secret-free browser catalog', async () => {
    const module = await loadModule<CatalogModule>('./plans/catalog.ts');
    const catalog = module.loadDialerPlanCatalog(validEnvironment());

    expect(catalog.plans.single).toMatchObject({
      code: 'single',
      priceCents: 5900,
      stripePriceId: 'price_single_test',
      maxNumbersPerSeat: 1,
      includedMinutes: 1388,
      providerBudgetCents: 3000,
      predictive: false,
      recordings: false,
      transcripts: false,
    });
    expect(catalog.plans.standard).toMatchObject({
      priceCents: 9900,
      maxNumbersPerSeat: 3,
      includedMinutes: null,
      predictive: true,
      recordings: true,
      transcripts: true,
    });
    expect(catalog.plans.power).toMatchObject({
      priceCents: 15900,
      maxNumbersPerSeat: 10,
      includedMinutes: null,
      predictive: true,
      recordings: true,
      transcripts: true,
    });
    expect(catalog.trial).toEqual({
      includedMinutes: 500,
      maxSeats: 1,
      maxNumbers: 1,
      planCode: 'standard',
    });
    expect(catalog.additionalNumberPriceCents).toBe(199);
    expect(catalog.paymentGraceDays).toBe(3);

    const safeCatalog = module.toSafeDialerPlanCatalog(catalog);
    expect(JSON.stringify(safeCatalog)).not.toContain('price_');
    expect(JSON.stringify(safeCatalog)).not.toContain('providerBudgetCents');
    expect(safeCatalog.plans.standard.priceCents).toBe(9900);
  });

  it('rejects invalid, contradictory, and duplicate commercial configuration', async () => {
    const module = await loadModule<CatalogModule>('./plans/catalog.ts');

    expect(() =>
      module.loadDialerPlanCatalog({
        ...validEnvironment(),
        DIALER_INCLUDED_NUMBERS_PER_SEAT: '2',
        DIALER_SINGLE_MAX_NUMBERS_PER_SEAT: '1',
      }),
    ).toThrow();
    expect(() =>
      module.loadDialerPlanCatalog({
        ...validEnvironment(),
        DIALER_STANDARD_PRICE_CENTS: '-1',
      }),
    ).toThrow();
    expect(() =>
      module.loadDialerPlanCatalog({
        ...validEnvironment(),
        STRIPE_PRICE_STANDARD_MONTHLY: 'price_single_test',
      }),
    ).toThrow();
    expect(() =>
      module.loadDialerPlanCatalog({
        ...validEnvironment(),
        STRIPE_PRICE_POWER_MONTHLY: '',
      }),
    ).toThrow();
  });

  it('derives Single, Standard, Power, and trial access from plan, numbers, caller selection, and usage', async () => {
    const catalogModule = await loadModule<CatalogModule>('./plans/catalog.ts');
    const entitlementModule =
      await loadModule<EntitlementModule>('./plans/entitlements.ts');
    const catalog = catalogModule.loadDialerPlanCatalog(validEnvironment());

    expect(
      entitlementModule.resolveSeatEntitlement({
        catalog,
        planCode: 'single',
        activeNumberCount: 1,
        requestedLines: 8,
        callerIdSelection: { kind: 'automatic' },
        connectedMinutes: 10,
      }),
    ).toMatchObject({
      maxNumbers: 1,
      effectiveLineCount: 1,
      predictive: false,
      recordings: false,
      transcripts: false,
      canStartCall: true,
      denialCode: null,
    });
    expect(
      entitlementModule.resolveSeatEntitlement({
        catalog,
        planCode: 'standard',
        activeNumberCount: 2,
        requestedLines: 5,
        callerIdSelection: { kind: 'automatic' },
        connectedMinutes: 50_000,
      }),
    ).toMatchObject({
      maxNumbers: 3,
      effectiveLineCount: 2,
      predictive: true,
      recordings: true,
      transcripts: true,
      canStartCall: true,
    });
    expect(
      entitlementModule.resolveSeatEntitlement({
        catalog,
        planCode: 'power',
        activeNumberCount: 10,
        requestedLines: 10,
        callerIdSelection: {
          kind: 'explicit',
          phoneNumber: '+15550100001',
        },
        connectedMinutes: 50_000,
      }).effectiveLineCount,
    ).toBe(1);
    expect(
      entitlementModule.resolveSeatEntitlement({
        catalog,
        planCode: 'single',
        activeNumberCount: 1,
        requestedLines: 1,
        callerIdSelection: { kind: 'automatic' },
        connectedMinutes: 1388,
      }),
    ).toMatchObject({
      canStartCall: false,
      denialCode: 'MINUTE_LIMIT_REACHED',
    });
    expect(
      entitlementModule.resolveTrialEntitlement({
        catalog,
        seatCount: 1,
        numberCount: 1,
        connectedMinutes: 499,
      }),
    ).toEqual({
      planCode: 'standard',
      canStartCall: true,
      canAddSeat: false,
      canAddNumber: false,
      remainingMinutes: 1,
    });
  });
});

describe('commercial team authorization and mixed seat inventory', () => {
  it('allows workspace owner/admin mutations and denies members and cross-tenant identities', async () => {
    const module =
      await loadModule<TeamAuthorizationModule>('./teams/application.ts');

    expect(() =>
      module.authorizeCommercialAction({
        identity: {
          workspaceId: 'workspace-1',
          userId: 'admin-1',
          role: 'admin',
        },
        targetWorkspaceId: 'workspace-1',
        action: 'seats.manage',
      }),
    ).not.toThrow();
    expect(() =>
      module.authorizeCommercialAction({
        identity: {
          workspaceId: 'workspace-1',
          userId: 'member-1',
          role: 'user',
        },
        targetWorkspaceId: 'workspace-1',
        action: 'numbers.manage',
      }),
    ).toThrow('ADMIN_REQUIRED');
    expect(() =>
      module.authorizeCommercialAction({
        identity: {
          workspaceId: 'workspace-2',
          userId: 'admin-2',
          role: 'owner',
        },
        targetWorkspaceId: 'workspace-1',
        action: 'billing.manage',
      }),
    ).toThrow('WORKSPACE_MISMATCH');
  });

  it('supports mixed tiers and prevents reducing purchased quantities below assigned seats', async () => {
    const module =
      await loadModule<TeamAuthorizationModule>('./teams/application.ts');
    const assignments = [
      { userId: 'user-a', planCode: 'single' as const },
      { userId: 'user-b', planCode: 'single' as const },
      { userId: 'user-c', planCode: 'standard' as const },
      { userId: 'user-d', planCode: 'power' as const },
    ];

    expect(() =>
      module.validateSeatInventory({
        purchased: { single: 2, standard: 1, power: 1 },
        assignments,
        requested: { single: 2, standard: 1, power: 1 },
      }),
    ).not.toThrow();
    expect(() =>
      module.validateSeatInventory({
        purchased: { single: 2, standard: 1, power: 1 },
        assignments,
        requested: { single: 1, standard: 1, power: 1 },
      }),
    ).toThrow('ASSIGNED_SEAT_QUANTITY');
  });
});

describe('Stripe subscription projection, grace, and uninstall', () => {
  it('projects mixed seat tiers and additional numbers as authoritative subscription items', async () => {
    const catalogModule = await loadModule<CatalogModule>('./plans/catalog.ts');
    const billingModule =
      await loadModule<BillingModule>('./billing/application.ts');
    const catalog = catalogModule.loadDialerPlanCatalog(validEnvironment());

    expect(
      billingModule.projectSubscriptionItems({
        catalog,
        seats: [
          { userId: 'user-a', planCode: 'single' },
          { userId: 'user-b', planCode: 'single' },
          { userId: 'user-c', planCode: 'standard' },
          { userId: 'user-d', planCode: 'power' },
        ],
        additionalNumberQuantity: 4,
      }),
    ).toEqual([
      { code: 'single', priceId: 'price_single_test', quantity: 2 },
      { code: 'standard', priceId: 'price_standard_test', quantity: 1 },
      { code: 'power', priceId: 'price_power_test', quantity: 1 },
      {
        code: 'additional-number',
        priceId: 'price_number_test',
        quantity: 4,
      },
    ]);
  });

  it('fails closed for status-only non-entitled Stripe states while preserving billing recovery and history', async () => {
    const module =
      await loadModule<BillingModule>('./billing/application.ts');
    const now = new Date('2026-08-03T00:00:00.000Z');

    for (const status of [
      'past_due',
      'unpaid',
      'incomplete',
      'paused',
      'future_provider_status',
    ]) {
      expect(
        module.resolveBillingAccess({
          status,
          paymentFailedAt: null,
          now,
          graceDays: 3,
        }),
      ).toEqual({
        state: 'blocked',
        canStartCalls: false,
        canPurchaseNumbers: false,
        canManageBilling: true,
        canReadHistory: true,
        graceEndsAt: null,
      });
    }

    expect(
      module.resolveBillingAccess({
        status: 'future_provider_status',
        paymentFailedAt: new Date('2026-08-02T00:00:00.000Z'),
        now,
        graceDays: 3,
      }),
    ).toEqual({
      state: 'blocked',
      canStartCalls: false,
      canPurchaseNumbers: false,
      canManageBilling: true,
      canReadHistory: true,
      graceEndsAt: null,
    });

    for (const status of ['unpaid', 'incomplete', 'paused']) {
      expect(
        module.resolveBillingAccess({
          status,
          paymentFailedAt: new Date('2026-08-02T00:00:00.000Z'),
          now,
          graceDays: 3,
        }),
      ).toEqual({
        state: 'blocked',
        canStartCalls: false,
        canPurchaseNumbers: false,
        canManageBilling: true,
        canReadHistory: true,
        graceEndsAt: null,
      });
    }
  });

  it('keeps only active and trialing subscriptions entitled without payment-failure evidence', async () => {
    const module =
      await loadModule<BillingModule>('./billing/application.ts');
    const now = new Date('2026-08-03T00:00:00.000Z');

    for (const status of ['active', 'trialing']) {
      expect(
        module.resolveBillingAccess({
          status,
          paymentFailedAt: null,
          now,
          graceDays: 3,
        }),
      ).toMatchObject({
        state: 'active',
        canStartCalls: true,
        canPurchaseNumbers: true,
        canManageBilling: true,
        canReadHistory: true,
      });
    }

    for (const status of ['canceled', 'incomplete_expired']) {
      expect(
        module.resolveBillingAccess({
          status,
          paymentFailedAt: null,
          now,
          graceDays: 3,
        }),
      ).toMatchObject({
        state: 'canceled',
        canStartCalls: false,
        canPurchaseNumbers: false,
        canManageBilling: true,
        canReadHistory: true,
      });
    }
  });

  it('preserves recovery/history during grace and blocks new commercial consumption after expiry', async () => {
    const module =
      await loadModule<BillingModule>('./billing/application.ts');
    const failedAt = new Date('2026-08-01T00:00:00.000Z');

    expect(
      module.resolveBillingAccess({
        status: 'past_due',
        paymentFailedAt: failedAt,
        now: new Date('2026-08-03T23:59:59.000Z'),
        graceDays: 3,
      }),
    ).toMatchObject({
      state: 'grace',
      canStartCalls: true,
      canPurchaseNumbers: true,
      canManageBilling: true,
      canReadHistory: true,
      graceEndsAt: '2026-08-04T00:00:00.000Z',
    });
    expect(
      module.resolveBillingAccess({
        status: 'past_due',
        paymentFailedAt: failedAt,
        now: new Date('2026-08-04T00:00:00.000Z'),
        graceDays: 3,
      }),
    ).toMatchObject({
      state: 'blocked',
      canStartCalls: false,
      canPurchaseNumbers: false,
      canManageBilling: true,
      canReadHistory: true,
    });
  });

  it('claims HighLevel uninstall once, disables the installation, and schedules Stripe cancellation at period end', async () => {
    const module =
      await loadModule<BillingModule>('./billing/application.ts');
    const claimed = new Set<string>();
    const disabled: string[] = [];
    const scheduled: string[] = [];
    const input = {
      event: {
        id: 'uninstall-event-1',
        workspaceId: 'workspace-1',
        locationId: 'location-1',
        appId: 'app-1',
      },
      repository: {
        claimWebhookEvent: (eventId: string) =>
          Effect.sync(() => {
            if (claimed.has(eventId)) return false;
            claimed.add(eventId);
            return true;
          }),
        completeWebhookEvent: () => Effect.void,
        failWebhookEvent: (eventId: string) =>
          Effect.sync(() => {
            claimed.delete(eventId);
          }),
        getWorkspaceSubscriptionId: () =>
          Effect.succeed<string | null>('sub_test_workspace_1'),
        disableInstallation: ({
          workspaceId,
          locationId,
        }: {
          workspaceId: string;
          locationId: string;
        }) =>
          Effect.sync(() => {
            disabled.push(`${workspaceId}:${locationId}`);
          }),
      },
      stripe: {
        scheduleCancellationAtPeriodEnd: (subscriptionId: string) =>
          Effect.sync(() => {
            scheduled.push(subscriptionId);
          }),
      },
    };

    expect(await Effect.runPromise(module.processInstallationUninstall(input))).toEqual({
      duplicate: false,
      cancellationScheduled: true,
    });
    expect(await Effect.runPromise(module.processInstallationUninstall(input))).toEqual({
      duplicate: true,
      cancellationScheduled: false,
    });
    expect(disabled).toEqual(['workspace-1:location-1']);
    expect(scheduled).toEqual(['sub_test_workspace_1']);
  });
});

describe('authoritative usage lifecycle', () => {
  it('derives connected minutes and provider cost only from final provider completion records', async () => {
    const module =
      await loadModule<UsageModule>('./usage/application.ts');
    const event = module.createUsageEventFromProviderCompletion({
      workspaceId: 'workspace-1',
      userId: 'user-a',
      seatId: 'seat-a',
      sessionId: 'session-1',
      providerCallId: 'CA_test_1',
      customerConnectedSeconds: 61,
      agentConnectedSeconds: 61,
      providerCostMicros: 43_200,
      occurredAt: '2026-08-01T12:00:00.000Z',
      billingPeriod: {
        start: '2026-08-01T00:00:00.000Z',
        end: '2026-09-01T00:00:00.000Z',
      },
    });

    expect(event).toMatchObject({
      workspaceId: 'workspace-1',
      userId: 'user-a',
      seatId: 'seat-a',
      metric: 'connected_minutes',
      quantity: 2,
      providerCostMicros: 43_200,
      sourceType: 'twilio.call.completed',
      sourceId: 'CA_test_1',
    });
  });

  it('inserts one immutable usage event per provider source and releases resources on duplicate terminal callbacks', async () => {
    const module =
      await loadModule<UsageModule>('./usage/application.ts');
    const claimed = new Set<string>();
    const inserted: string[] = [];
    let released = 0;
    const completion = {
      workspaceId: 'workspace-1',
      userId: 'user-a',
      seatId: 'seat-a',
      sessionId: 'session-1',
      providerCallId: 'CA_test_1',
      customerConnectedSeconds: 60,
      agentConnectedSeconds: 60,
      providerCostMicros: 21_600,
      occurredAt: '2026-08-01T12:00:00.000Z',
      billingPeriod: {
        start: '2026-08-01T00:00:00.000Z',
        end: '2026-09-01T00:00:00.000Z',
      },
    };
    const input = {
      completion,
      repository: {
        claimSource: (workspaceId: string, sourceId: string) =>
          Effect.sync(() => {
            const key = `${workspaceId}:${sourceId}`;
            if (claimed.has(key)) return false;
            claimed.add(key);
            return true;
          }),
        completeSource: () => Effect.void,
        failSource: (workspaceId: string, sourceId: string) =>
          Effect.sync(() => {
            claimed.delete(`${workspaceId}:${sourceId}`);
          }),
        insertUsageEvent: (
          event: ReturnType<
            UsageModule['createUsageEventFromProviderCompletion']
          >,
        ) =>
          Effect.sync(() => {
            inserted.push(event.sourceId);
          }),
      },
      releaseResources: () =>
        Effect.sync(() => {
          released += 1;
        }),
    };

    expect(await Effect.runPromise(module.recordFinalProviderUsage(input))).toEqual({
      duplicate: false,
    });
    expect(await Effect.runPromise(module.recordFinalProviderUsage(input))).toEqual({
      duplicate: true,
    });
    expect(inserted).toEqual(['CA_test_1']);
    expect(released).toBe(2);
  });
});

describe('workspace Twilio accounts and user-owned number capacity', () => {
  it('creates one Twilio subaccount per workspace and resolves it idempotently', async () => {
    const module =
      await loadModule<NumbersModule>('./numbers/telephony-account.ts');
    const accounts = new Map<
      string,
      { workspaceId: string; providerAccountId: string }
    >();
    let creates = 0;
    const input = {
      workspaceId: 'workspace-1',
      repository: {
        get: (workspaceId: string) =>
          Effect.succeed(accounts.get(workspaceId) ?? null),
        save: (account: {
          workspaceId: string;
          providerAccountId: string;
          status: 'active';
        }) =>
          Effect.sync(() => {
            accounts.set(account.workspaceId, account);
          }),
      },
      provider: {
        createSubaccount: () =>
          Effect.sync(() => {
            creates += 1;
            return { id: 'AC_subaccount_test_1' };
          }),
      },
    };

    expect(
      await Effect.runPromise(module.ensureWorkspaceTelephonyAccount(input)),
    ).toEqual({
      workspaceId: 'workspace-1',
      providerAccountId: 'AC_subaccount_test_1',
    });
    expect(
      await Effect.runPromise(module.ensureWorkspaceTelephonyAccount(input)),
    ).toEqual({
      workspaceId: 'workspace-1',
      providerAccountId: 'AC_subaccount_test_1',
    });
    expect(creates).toBe(1);
  });

  it('uses distinct active numbers assigned to the signed-in user and enforces explicit-caller one-line capacity', async () => {
    const module =
      await loadModule<NumbersModule>('./numbers/application.ts');
    const assigned = [
      '+15550100001',
      '+15550100002',
      '+15550100003',
    ];

    expect(
      module.resolveEffectiveLineCount({
        requestedLines: 10,
        planMaximum: 3,
        activeAssignedNumbers: assigned,
        callerIdSelection: { kind: 'automatic' },
      }),
    ).toEqual({ lineCount: 3, callerIds: assigned });
    expect(
      module.resolveEffectiveLineCount({
        requestedLines: 3,
        planMaximum: 3,
        activeAssignedNumbers: assigned,
        callerIdSelection: {
          kind: 'explicit',
          phoneNumber: '+15550100002',
        },
      }),
    ).toEqual({ lineCount: 1, callerIds: ['+15550100002'] });
  });

  it('normalizes assigned and explicitly selected phone numbers before capacity checks', async () => {
    const module =
      await loadModule<NumbersModule>('./numbers/application.ts');

    expect(
      module.resolveEffectiveLineCount({
        requestedLines: 3,
        planMaximum: 3,
        activeAssignedNumbers: [
          '(555) 010-0001',
          '+1 555 010 0001',
          '555.010.0002',
        ],
        callerIdSelection: {
          kind: 'explicit',
          phoneNumber: '+1 (555) 010-0002',
        },
      }),
    ).toEqual({ lineCount: 1, callerIds: ['+15550100002'] });
  });

  it('prevents cross-user number sharing and plan-limit overflow', async () => {
    const module =
      await loadModule<NumbersModule>('./numbers/application.ts');
    const existingAssignments = [
      {
        workspaceId: 'workspace-1',
        userId: 'user-a',
        phoneNumber: '+15550100001',
        status: 'active' as const,
      },
    ];

    expect(() =>
      module.validateNumberAssignment({
        workspaceId: 'workspace-1',
        seatUserId: 'user-b',
        planMaximum: 3,
        existingAssignments,
        phoneNumber: '(555) 010-0001',
      }),
    ).toThrow('NUMBER_ALREADY_ASSIGNED');
    expect(() =>
      module.validateNumberAssignment({
        workspaceId: 'workspace-1',
        seatUserId: 'user-a',
        planMaximum: 1,
        existingAssignments,
        phoneNumber: '+15550100002',
      }),
    ).toThrow('NUMBER_LIMIT_REACHED');
  });
});
