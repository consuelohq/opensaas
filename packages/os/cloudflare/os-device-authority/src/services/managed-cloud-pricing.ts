import {
  calculateManagedCloudNodeQuote,
  listManagedCloudPlans,
  listManagedCloudRegions,
  toManagedCloudPublicQuote,
  type ManagedCloudGcpRateCard,
  type ManagedCloudPricingPolicy,
  type ManagedCloudRegionId,
} from '../../../../scripts/lib/managed-cloud-pricing';

export type ManagedCloudPricingRuntime = {
  policy: ManagedCloudPricingPolicy;
  rateCards: Partial<Record<ManagedCloudRegionId, ManagedCloudGcpRateCard>>;
};

export type ManagedCloudPublicCatalog = {
  plans: ReturnType<typeof listManagedCloudPlans>;
  regions: ReturnType<typeof listManagedCloudRegions>;
  selectedRegion: ManagedCloudRegionId;
  pricingAvailable: boolean;
  quotes: ReturnType<typeof toManagedCloudPublicQuote>[];
};

const DEFAULT_REGION: ManagedCloudRegionId = 'us-east1';

const normalizeRegion = (value?: string | null): ManagedCloudRegionId => {
  const normalized = value?.trim();
  return listManagedCloudRegions().find((region) => region.id === normalized)?.id ?? DEFAULT_REGION;
};

export function buildManagedCloudPublicCatalog(
  pricing: ManagedCloudPricingRuntime | undefined,
  regionValue?: string | null,
): ManagedCloudPublicCatalog {
  const plans = listManagedCloudPlans();
  const regions = listManagedCloudRegions();
  const selectedRegion = normalizeRegion(regionValue);
  const rateCard = pricing?.rateCards[selectedRegion];
  if (!pricing || !rateCard) {
    return { plans, regions, selectedRegion, pricingAvailable: false, quotes: [] };
  }
  try {
    return {
      plans,
      regions,
      selectedRegion,
      pricingAvailable: true,
      quotes: plans.map((plan) =>
        toManagedCloudPublicQuote(
          calculateManagedCloudNodeQuote({
            planId: plan.id,
            region: selectedRegion,
            rateCard,
            policy: pricing.policy,
          }),
        ),
      ),
    };
  } catch {
    return { plans, regions, selectedRegion, pricingAvailable: false, quotes: [] };
  }
}

export function managedCloudPricingFromJson(input: {
  policyJson?: string;
  rateCardsJson?: string;
}): ManagedCloudPricingRuntime | undefined {
  const policyJson = input.policyJson?.trim();
  const rateCardsJson = input.rateCardsJson?.trim();
  if (!policyJson || !rateCardsJson) return undefined;
  try {
    const policy = JSON.parse(policyJson) as ManagedCloudPricingPolicy;
    const rateCards = JSON.parse(rateCardsJson) as Partial<Record<ManagedCloudRegionId, ManagedCloudGcpRateCard>>;
    const first = Object.entries(rateCards)[0] as [ManagedCloudRegionId, ManagedCloudGcpRateCard] | undefined;
    if (!first) return undefined;
    calculateManagedCloudNodeQuote({
      planId: 'standard',
      region: first[0],
      rateCard: first[1],
      policy,
    });
    return { policy, rateCards };
  } catch {
    return undefined;
  }
}
