export const MANAGED_CLOUD_MONTHLY_HOURS_CEILING = 31 * 24;

export type ManagedCloudPlanId =
  | 'starter'
  | 'standard'
  | 'performance'
  | 'power'
  | 'max';

export type ManagedCloudRegionId =
  | 'us-east1'
  | 'us-east4'
  | 'us-central1'
  | 'us-west1'
  | 'europe-west1';

export type ManagedCloudPublicPlan = {
  id: ManagedCloudPlanId;
  name: string;
  cpu: {
    vcpus: number;
    shared: boolean;
  };
  memoryGb: number;
  recommended: boolean;
};

export type ManagedCloudPublicRegion = {
  id: ManagedCloudRegionId;
  name: string;
};

export type ManagedCloudProviderProfile = {
  provider: 'gcp';
  machineType: string;
  bootDiskGb: number;
  dataDiskGb: number;
};

type ManagedCloudPlanDefinition = ManagedCloudPublicPlan & {
  providerProfile: ManagedCloudProviderProfile;
};

const PLAN_ORDER: ManagedCloudPlanId[] = [
  'starter',
  'standard',
  'performance',
  'power',
  'max',
];

const PLAN_DEFINITIONS: Record<ManagedCloudPlanId, ManagedCloudPlanDefinition> = {
  starter: {
    id: 'starter',
    name: 'Starter',
    cpu: { vcpus: 2, shared: true },
    memoryGb: 4,
    recommended: false,
    providerProfile: {
      provider: 'gcp',
      machineType: 'e2-medium',
      bootDiskGb: 30,
      dataDiskGb: 100,
    },
  },
  standard: {
    id: 'standard',
    name: 'Standard',
    cpu: { vcpus: 2, shared: false },
    memoryGb: 8,
    recommended: true,
    providerProfile: {
      provider: 'gcp',
      machineType: 'e2-standard-2',
      bootDiskGb: 30,
      dataDiskGb: 100,
    },
  },
  performance: {
    id: 'performance',
    name: 'Performance',
    cpu: { vcpus: 4, shared: false },
    memoryGb: 16,
    recommended: false,
    providerProfile: {
      provider: 'gcp',
      machineType: 'e2-standard-4',
      bootDiskGb: 30,
      dataDiskGb: 100,
    },
  },
  power: {
    id: 'power',
    name: 'Power',
    cpu: { vcpus: 8, shared: false },
    memoryGb: 32,
    recommended: false,
    providerProfile: {
      provider: 'gcp',
      machineType: 'e2-standard-8',
      bootDiskGb: 30,
      dataDiskGb: 100,
    },
  },
  max: {
    id: 'max',
    name: 'Max',
    cpu: { vcpus: 16, shared: false },
    memoryGb: 64,
    recommended: false,
    providerProfile: {
      provider: 'gcp',
      machineType: 'e2-standard-16',
      bootDiskGb: 30,
      dataDiskGb: 100,
    },
  },
};

const REGIONS: ManagedCloudPublicRegion[] = [
  { id: 'us-east1', name: 'US East (South Carolina)' },
  { id: 'us-east4', name: 'US East (Virginia)' },
  { id: 'us-central1', name: 'US Central (Iowa)' },
  { id: 'us-west1', name: 'US West (Oregon)' },
  { id: 'europe-west1', name: 'Europe West (Belgium)' },
];

export type ManagedCloudGcpRateCard = {
  provider: 'gcp';
  currency: 'USD';
  version: string;
  effectiveAt: string;
  region: ManagedCloudRegionId;
  rates: {
    computeHourlyMicrosByPlan: Record<ManagedCloudPlanId, number>;
    balancedDiskGbMonthMicros: number;
    snapshotGbMonthMicros: number;
    natGatewayHourlyMicros: number;
    natDataProcessingGbMicros: number;
    egressGbMicros: number;
  };
};

export type ManagedCloudPricingPolicy = {
  pricingVersion: string;
  targetGrossMarginBps: number;
  providerContingencyBps: number;
  priceIncrementCents: number;
  snapshotAllowanceGb: number;
  includedNatProcessedGb: number;
  includedEgressGb: number;
  platformOperationsReserveMicros: number;
};

export type ManagedCloudProviderCostBreakdown = {
  compute: number;
  balancedDisks: number;
  snapshots: number;
  natGateway: number;
  natDataProcessing: number;
  egress: number;
  subtotal: number;
  contingency: number;
};

export type ManagedCloudNodeQuote = {
  plan: ManagedCloudPublicPlan;
  region: ManagedCloudPublicRegion;
  billingPeriod: 'month';
  currency: 'USD';
  monthlyPriceCents: number;
  pricingVersion: string;
  rateCardVersion: string;
  rateCardEffectiveAt: string;
  provider: 'gcp';
  providerMachineType: string;
  providerCostMicros: ManagedCloudProviderCostBreakdown;
  platformOperationsReserveMicros: number;
  landedCostMicros: number;
  unroundedRequiredRevenueMicros: number;
  achievedGrossMarginBps: number;
};

export type ManagedCloudPublicQuote = Pick<
  ManagedCloudNodeQuote,
  'billingPeriod' | 'currency' | 'monthlyPriceCents' | 'pricingVersion'
> & {
  plan: ManagedCloudPublicPlan;
  region: ManagedCloudPublicRegion;
};

const MICROS_PER_CENT = 10_000;
const BPS_DENOMINATOR = 10_000;

const clonePublicPlan = (
  definition: ManagedCloudPlanDefinition,
): ManagedCloudPublicPlan => ({
  id: definition.id,
  name: definition.name,
  cpu: { ...definition.cpu },
  memoryGb: definition.memoryGb,
  recommended: definition.recommended,
});

const clonePublicRegion = (
  region: ManagedCloudPublicRegion,
): ManagedCloudPublicRegion => ({ ...region });

const requirePlanDefinition = (
  planId: ManagedCloudPlanId,
): ManagedCloudPlanDefinition => {
  const definition = PLAN_DEFINITIONS[planId];
  if (!definition) {
    throw new Error(`unknown managed cloud plan: ${String(planId)}`);
  }
  return definition;
};

const requireRegionDefinition = (
  regionId: ManagedCloudRegionId,
): ManagedCloudPublicRegion => {
  const region = REGIONS.find((candidate) => candidate.id === regionId);
  if (!region) {
    throw new Error(`unsupported managed cloud region: ${String(regionId)}`);
  }
  return region;
};

const requireNonEmpty = (value: string, name: string): string => {
  const normalized = value.trim();
  if (!normalized) throw new Error(`${name} must not be empty`);
  return normalized;
};

const requireNonNegativeSafeInteger = (value: number, name: string): number => {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${name} rate/value must be a non-negative safe integer`);
  }
  return value;
};

const requirePositiveSafeInteger = (value: number, name: string): number => {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive safe integer`);
  }
  return value;
};

const safeNumber = (value: bigint, name: string): number => {
  if (value < 0n || value > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error(`${name} exceeds safe integer range`);
  }
  return Number(value);
};

const multiply = (left: number, right: number, name: string): number =>
  safeNumber(BigInt(left) * BigInt(right), name);

const sum = (values: number[], name: string): number =>
  safeNumber(
    values.reduce((total, value) => total + BigInt(value), 0n),
    name,
  );

const ceilRatio = (
  value: number,
  numerator: number,
  denominator: number,
  name: string,
): number => {
  const scaled = BigInt(value) * BigInt(numerator);
  const divisor = BigInt(denominator);
  return safeNumber((scaled + divisor - 1n) / divisor, name);
};

const roundMicrosUpToCentsIncrement = (
  micros: number,
  incrementCents: number,
): number => {
  const unitMicros = BigInt(incrementCents) * BigInt(MICROS_PER_CENT);
  const roundedMicros =
    ((BigInt(micros) + unitMicros - 1n) / unitMicros) * unitMicros;
  return safeNumber(
    roundedMicros / BigInt(MICROS_PER_CENT),
    'monthlyPriceCents',
  );
};

const achievedGrossMarginBps = (
  monthlyPriceCents: number,
  landedCostMicros: number,
): number => {
  const revenueMicros =
    BigInt(monthlyPriceCents) * BigInt(MICROS_PER_CENT);
  if (revenueMicros === 0n) return 0;
  const marginMicros = revenueMicros - BigInt(landedCostMicros);
  if (marginMicros <= 0n) return 0;
  return safeNumber(
    (marginMicros * BigInt(BPS_DENOMINATOR)) / revenueMicros,
    'achievedGrossMarginBps',
  );
};

const validateRateCard = (rateCard: ManagedCloudGcpRateCard): void => {
  if (rateCard.provider !== 'gcp') {
    throw new Error('managed cloud rate card provider must be gcp');
  }
  if (rateCard.currency !== 'USD') {
    throw new Error('managed cloud rate card currency must be USD');
  }
  requireNonEmpty(rateCard.version, 'rateCard.version');
  if (!Number.isFinite(Date.parse(rateCard.effectiveAt))) {
    throw new Error('rateCard.effectiveAt must be a valid timestamp');
  }
  for (const planId of PLAN_ORDER) {
    requireNonNegativeSafeInteger(
      rateCard.rates.computeHourlyMicrosByPlan[planId],
      `computeHourlyMicrosByPlan.${planId}`,
    );
  }
  requireNonNegativeSafeInteger(
    rateCard.rates.balancedDiskGbMonthMicros,
    'balancedDiskGbMonthMicros',
  );
  requireNonNegativeSafeInteger(
    rateCard.rates.snapshotGbMonthMicros,
    'snapshotGbMonthMicros',
  );
  requireNonNegativeSafeInteger(
    rateCard.rates.natGatewayHourlyMicros,
    'natGatewayHourlyMicros',
  );
  requireNonNegativeSafeInteger(
    rateCard.rates.natDataProcessingGbMicros,
    'natDataProcessingGbMicros',
  );
  requireNonNegativeSafeInteger(rateCard.rates.egressGbMicros, 'egressGbMicros');
};

const validatePolicy = (policy: ManagedCloudPricingPolicy): void => {
  requireNonEmpty(policy.pricingVersion, 'policy.pricingVersion');
  if (
    !Number.isInteger(policy.targetGrossMarginBps) ||
    policy.targetGrossMarginBps < 0 ||
    policy.targetGrossMarginBps >= BPS_DENOMINATOR
  ) {
    throw new Error('target gross margin must be between 0 and 9999 basis points');
  }
  if (
    !Number.isInteger(policy.providerContingencyBps) ||
    policy.providerContingencyBps < 0 ||
    policy.providerContingencyBps > BPS_DENOMINATOR
  ) {
    throw new Error('provider contingency must be between 0 and 10000 basis points');
  }
  requirePositiveSafeInteger(policy.priceIncrementCents, 'priceIncrementCents');
  requireNonNegativeSafeInteger(policy.snapshotAllowanceGb, 'snapshotAllowanceGb');
  requireNonNegativeSafeInteger(
    policy.includedNatProcessedGb,
    'includedNatProcessedGb',
  );
  requireNonNegativeSafeInteger(policy.includedEgressGb, 'includedEgressGb');
  requireNonNegativeSafeInteger(
    policy.platformOperationsReserveMicros,
    'platformOperationsReserveMicros',
  );
};

export const listManagedCloudPlans = (): ManagedCloudPublicPlan[] =>
  PLAN_ORDER.map((planId) => clonePublicPlan(PLAN_DEFINITIONS[planId]));

export const listManagedCloudRegions = (): ManagedCloudPublicRegion[] =>
  REGIONS.map(clonePublicRegion);

export const getManagedCloudProviderProfile = (
  planId: ManagedCloudPlanId,
): ManagedCloudProviderProfile => ({
  ...requirePlanDefinition(planId).providerProfile,
});

export const calculateManagedCloudNodeQuote = (input: {
  planId: ManagedCloudPlanId;
  region: ManagedCloudRegionId;
  rateCard: ManagedCloudGcpRateCard;
  policy: ManagedCloudPricingPolicy;
}): ManagedCloudNodeQuote => {
  const definition = requirePlanDefinition(input.planId);
  const region = requireRegionDefinition(input.region);
  validateRateCard(input.rateCard);
  validatePolicy(input.policy);

  if (input.rateCard.region !== input.region) {
    throw new Error(
      `rate card region ${input.rateCard.region} does not match requested region ${input.region}`,
    );
  }

  const providerProfile = definition.providerProfile;
  const rates = input.rateCard.rates;
  const compute = multiply(
    rates.computeHourlyMicrosByPlan[input.planId],
    MANAGED_CLOUD_MONTHLY_HOURS_CEILING,
    'compute monthly cost',
  );
  const balancedDisks = multiply(
    rates.balancedDiskGbMonthMicros,
    providerProfile.bootDiskGb + providerProfile.dataDiskGb,
    'balanced disk monthly cost',
  );
  const snapshots = multiply(
    rates.snapshotGbMonthMicros,
    input.policy.snapshotAllowanceGb,
    'snapshot monthly cost',
  );
  const natGateway = multiply(
    rates.natGatewayHourlyMicros,
    MANAGED_CLOUD_MONTHLY_HOURS_CEILING,
    'NAT gateway monthly cost',
  );
  const natDataProcessing = multiply(
    rates.natDataProcessingGbMicros,
    input.policy.includedNatProcessedGb,
    'NAT processing monthly cost',
  );
  const egress = multiply(
    rates.egressGbMicros,
    input.policy.includedEgressGb,
    'egress monthly cost',
  );
  const subtotal = sum(
    [
      compute,
      balancedDisks,
      snapshots,
      natGateway,
      natDataProcessing,
      egress,
    ],
    'provider subtotal',
  );
  const contingency = ceilRatio(
    subtotal,
    input.policy.providerContingencyBps,
    BPS_DENOMINATOR,
    'provider contingency',
  );
  const landedCostMicros = sum(
    [
      subtotal,
      contingency,
      input.policy.platformOperationsReserveMicros,
    ],
    'landed monthly cost',
  );
  const unroundedRequiredRevenueMicros = ceilRatio(
    landedCostMicros,
    BPS_DENOMINATOR,
    BPS_DENOMINATOR - input.policy.targetGrossMarginBps,
    'required monthly revenue',
  );
  const monthlyPriceCents = roundMicrosUpToCentsIncrement(
    unroundedRequiredRevenueMicros,
    input.policy.priceIncrementCents,
  );

  return {
    plan: clonePublicPlan(definition),
    region: clonePublicRegion(region),
    billingPeriod: 'month',
    currency: input.rateCard.currency,
    monthlyPriceCents,
    pricingVersion: input.policy.pricingVersion.trim(),
    rateCardVersion: input.rateCard.version.trim(),
    rateCardEffectiveAt: new Date(input.rateCard.effectiveAt).toISOString(),
    provider: input.rateCard.provider,
    providerMachineType: providerProfile.machineType,
    providerCostMicros: {
      compute,
      balancedDisks,
      snapshots,
      natGateway,
      natDataProcessing,
      egress,
      subtotal,
      contingency,
    },
    platformOperationsReserveMicros:
      input.policy.platformOperationsReserveMicros,
    landedCostMicros,
    unroundedRequiredRevenueMicros,
    achievedGrossMarginBps: achievedGrossMarginBps(
      monthlyPriceCents,
      landedCostMicros,
    ),
  };
};

export const toManagedCloudPublicQuote = (
  quote: ManagedCloudNodeQuote,
): ManagedCloudPublicQuote => ({
  plan: {
    ...quote.plan,
    cpu: { ...quote.plan.cpu },
  },
  region: { ...quote.region },
  billingPeriod: quote.billingPeriod,
  currency: quote.currency,
  monthlyPriceCents: quote.monthlyPriceCents,
  pricingVersion: quote.pricingVersion,
});
