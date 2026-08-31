export type DialerPlanCode = 'single' | 'standard' | 'power';

export type DialerPlanDefinition = {
  code: DialerPlanCode;
  priceCents: number;
  stripePriceId: string;
  maxNumbersPerSeat: number;
  includedMinutes: number | null;
  providerBudgetCents: number | null;
  predictive: boolean;
  recordings: boolean;
  transcripts: boolean;
};

export type DialerPlanCatalog = {
  plans: Record<DialerPlanCode, DialerPlanDefinition>;
  trial: {
    includedMinutes: number;
    maxSeats: number;
    maxNumbers: number;
    planCode: DialerPlanCode;
  };
  includedNumbersPerSeat: number;
  additionalNumberPriceCents: number;
  additionalNumberStripePriceId: string;
  paymentGraceDays: number;
};

export type SafeDialerPlanCatalog = {
  plans: Record<
    DialerPlanCode,
    Omit<DialerPlanDefinition, 'stripePriceId' | 'providerBudgetCents'>
  >;
  trial: DialerPlanCatalog['trial'];
  includedNumbersPerSeat: number;
  additionalNumberPriceCents: number;
  paymentGraceDays: number;
};

const requirePositiveInteger = (
  environment: Record<string, string | undefined>,
  name: string,
): number => {
  const rawValue = environment[name]?.trim();
  const value = Number(rawValue);
  if (!rawValue || !Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`Invalid positive integer configuration: ${name}`);
  }
  return value;
};

const requireValue = (
  environment: Record<string, string | undefined>,
  name: string,
): string => {
  const value = environment[name]?.trim();
  if (!value) throw new Error(`Missing commercial configuration: ${name}`);
  return value;
};

const requirePlanCode = (
  environment: Record<string, string | undefined>,
  name: string,
): DialerPlanCode => {
  const value = requireValue(environment, name);
  if (value !== 'single' && value !== 'standard' && value !== 'power') {
    throw new Error(`Invalid plan code configuration: ${name}`);
  }
  return value;
};

export const loadDialerPlanCatalog = (
  environment: Record<string, string | undefined>,
): DialerPlanCatalog => {
  const includedNumbersPerSeat = requirePositiveInteger(
    environment,
    'DIALER_INCLUDED_NUMBERS_PER_SEAT',
  );
  const priceIds = {
    single: requireValue(environment, 'STRIPE_PRICE_SINGLE_MONTHLY'),
    standard: requireValue(environment, 'STRIPE_PRICE_STANDARD_MONTHLY'),
    power: requireValue(environment, 'STRIPE_PRICE_POWER_MONTHLY'),
    additionalNumber: requireValue(
      environment,
      'STRIPE_PRICE_ADDITIONAL_NUMBER_MONTHLY',
    ),
  };
  if (new Set(Object.values(priceIds)).size !== Object.values(priceIds).length) {
    throw new Error('Commercial Stripe price IDs must be unique');
  }

  const plans: DialerPlanCatalog['plans'] = {
    single: {
      code: 'single',
      priceCents: requirePositiveInteger(
        environment,
        'DIALER_SINGLE_PRICE_CENTS',
      ),
      stripePriceId: priceIds.single,
      maxNumbersPerSeat: requirePositiveInteger(
        environment,
        'DIALER_SINGLE_MAX_NUMBERS_PER_SEAT',
      ),
      includedMinutes: requirePositiveInteger(
        environment,
        'DIALER_SINGLE_INCLUDED_MINUTES',
      ),
      providerBudgetCents: requirePositiveInteger(
        environment,
        'DIALER_SINGLE_PROVIDER_BUDGET_CENTS',
      ),
      predictive: false,
      recordings: false,
      transcripts: false,
    },
    standard: {
      code: 'standard',
      priceCents: requirePositiveInteger(
        environment,
        'DIALER_STANDARD_PRICE_CENTS',
      ),
      stripePriceId: priceIds.standard,
      maxNumbersPerSeat: requirePositiveInteger(
        environment,
        'DIALER_STANDARD_MAX_NUMBERS_PER_SEAT',
      ),
      includedMinutes: null,
      providerBudgetCents: null,
      predictive: true,
      recordings: true,
      transcripts: true,
    },
    power: {
      code: 'power',
      priceCents: requirePositiveInteger(
        environment,
        'DIALER_POWER_PRICE_CENTS',
      ),
      stripePriceId: priceIds.power,
      maxNumbersPerSeat: requirePositiveInteger(
        environment,
        'DIALER_POWER_MAX_NUMBERS_PER_SEAT',
      ),
      includedMinutes: null,
      providerBudgetCents: null,
      predictive: true,
      recordings: true,
      transcripts: true,
    },
  };

  for (const plan of Object.values(plans)) {
    if (includedNumbersPerSeat > plan.maxNumbersPerSeat) {
      throw new Error(
        `Included number quantity exceeds ${plan.code} plan capacity`,
      );
    }
  }

  return {
    plans,
    trial: {
      includedMinutes: requirePositiveInteger(
        environment,
        'DIALER_TRIAL_INCLUDED_MINUTES',
      ),
      maxSeats: requirePositiveInteger(environment, 'DIALER_TRIAL_MAX_SEATS'),
      maxNumbers: requirePositiveInteger(
        environment,
        'DIALER_TRIAL_MAX_NUMBERS',
      ),
      planCode: requirePlanCode(environment, 'DIALER_TRIAL_PLAN_CODE'),
    },
    includedNumbersPerSeat,
    additionalNumberPriceCents: requirePositiveInteger(
      environment,
      'DIALER_ADDITIONAL_NUMBER_PRICE_CENTS',
    ),
    additionalNumberStripePriceId: priceIds.additionalNumber,
    paymentGraceDays: requirePositiveInteger(
      environment,
      'DIALER_PAYMENT_GRACE_DAYS',
    ),
  };
};

const toSafePlan = ({
  stripePriceId: _stripePriceId,
  providerBudgetCents: _providerBudgetCents,
  ...safe
}: DialerPlanDefinition): SafeDialerPlanCatalog['plans'][DialerPlanCode] =>
  safe;

export const toSafeDialerPlanCatalog = (
  catalog: DialerPlanCatalog,
): SafeDialerPlanCatalog => ({
  plans: {
    single: toSafePlan(catalog.plans.single),
    standard: toSafePlan(catalog.plans.standard),
    power: toSafePlan(catalog.plans.power),
  },
  trial: catalog.trial,
  includedNumbersPerSeat: catalog.includedNumbersPerSeat,
  additionalNumberPriceCents: catalog.additionalNumberPriceCents,
  paymentGraceDays: catalog.paymentGraceDays,
});
