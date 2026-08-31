import type {
  ManagedCloudGcpRateCard,
  ManagedCloudPlanId,
  ManagedCloudPricingPolicy,
  ManagedCloudRegionId,
} from './managed-cloud-pricing';

/**
 * Public Google Cloud list-price snapshot captured from Google's current public pricing pages.
 *
 * This is the fail-safe bootstrap rate card used when no explicit control-plane pricing payload
 * has been deployed yet. Production refresh tooling can replace it with a newer versioned Google
 * rate card without changing the customer-facing plan IDs or Stripe checkout contract.
 *
 * Sources captured 2026-08-15:
 * - https://cloud.google.com/products/compute/pricing/general-purpose
 * - https://cloud.google.com/compute/disks-image-pricing
 * - https://cloud.google.com/nat/pricing
 * - https://cloud.google.com/products/compute
 */
export const MANAGED_CLOUD_PUBLIC_RATE_CARD_EFFECTIVE_AT =
  '2026-08-15T00:00:00.000Z';

export const MANAGED_CLOUD_PUBLIC_RATE_CARD_VERSION =
  'gcp-public-list-2026-08-15';

const STANDARD_2_HOURLY_DOLLARS: Record<ManagedCloudRegionId, number> = {
  // Current Google public on-demand E2 list prices captured from the regional pricing data.
  'us-east1': 0.06701142,
  'us-east4': 0.07547082,
  'us-central1': 0.06701142,
  'us-west1': 0.06701142,
  'europe-west1': 0.07371546,
};

const hourlyMicros = (dollars: number, multiplier = 1): number =>
  Math.ceil(dollars * multiplier * 1_000_000 - 1e-8);

const scaledComputeRates = (
  region: ManagedCloudRegionId,
): Record<ManagedCloudPlanId, number> => {
  const standard2 = STANDARD_2_HOURLY_DOLLARS[region];
  return {
    // e2-medium is half an e2-standard-2; the remaining public plans scale linearly.
    starter: hourlyMicros(standard2, 0.5),
    standard: hourlyMicros(standard2),
    performance: hourlyMicros(standard2, 2),
    power: hourlyMicros(standard2, 4),
    max: hourlyMicros(standard2, 8),
  };
};

const rateCard = (region: ManagedCloudRegionId): ManagedCloudGcpRateCard => ({
  provider: 'gcp',
  currency: 'USD',
  version: MANAGED_CLOUD_PUBLIC_RATE_CARD_VERSION,
  effectiveAt: MANAGED_CLOUD_PUBLIC_RATE_CARD_EFFECTIVE_AT,
  region,
  rates: {
    computeHourlyMicrosByPlan: scaledComputeRates(region),
    // Google public list prices: pd-balanced $0.10/GiB-month and standard snapshots
    // $0.05/GiB-month in the supported baseline regions.
    balancedDiskGbMonthMicros: 100_000,
    snapshotGbMonthMicros: 50_000,
    // A single managed node consumes one Cloud NAT gateway assignment plus one external IPv4.
    // Current public list rates are $0.0014/hour + $0.005/hour.
    natGatewayHourlyMicros: 6_400,
    natDataProcessingGbMicros: 45_000,
    // Conservative Premium Tier public-internet egress rate used for the included allowance.
    egressGbMicros: 120_000,
  },
});

const DEFAULT_POLICY: ManagedCloudPricingPolicy = {
  pricingVersion: 'managed-cloud-google-public-2026-08-15-v1',
  targetGrossMarginBps: 4_000,
  providerContingencyBps: 500,
  priceIncrementCents: 100,
  snapshotAllowanceGb: 50,
  includedNatProcessedGb: 10,
  includedEgressGb: 20,
  platformOperationsReserveMicros: 5_000_000,
};

export type DefaultManagedCloudPricingRuntime = {
  policy: ManagedCloudPricingPolicy;
  rateCards: Record<ManagedCloudRegionId, ManagedCloudGcpRateCard>;
};

export function createDefaultManagedCloudPricingRuntime(): DefaultManagedCloudPricingRuntime {
  const regions: ManagedCloudRegionId[] = [
    'us-east1',
    'us-east4',
    'us-central1',
    'us-west1',
    'europe-west1',
  ];
  return {
    policy: { ...DEFAULT_POLICY },
    rateCards: Object.fromEntries(
      regions.map((region) => [region, rateCard(region)]),
    ) as Record<ManagedCloudRegionId, ManagedCloudGcpRateCard>,
  };
}
