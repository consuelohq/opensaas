import { describe, expect, it } from 'vitest';

import {
  MANAGED_CLOUD_MONTHLY_HOURS_CEILING,
  calculateManagedCloudNodeQuote,
  getManagedCloudProviderProfile,
  listManagedCloudPlans,
  listManagedCloudRegions,
  toManagedCloudPublicQuote,
  type ManagedCloudGcpRateCard,
  type ManagedCloudPricingPolicy,
} from '../scripts/lib/managed-cloud-pricing';

const rateCard: ManagedCloudGcpRateCard = {
  provider: 'gcp',
  currency: 'USD',
  version: 'gcp-public-2026-08-11',
  effectiveAt: '2026-08-11T00:00:00.000Z',
  region: 'us-east1',
  rates: {
    computeHourlyMicrosByPlan: {
      starter: 10_000,
      standard: 20_000,
      performance: 40_000,
      power: 80_000,
      max: 160_000,
    },
    balancedDiskGbMonthMicros: 1_000,
    snapshotGbMonthMicros: 500,
    natGatewayHourlyMicros: 3_000,
    natDataProcessingGbMicros: 4_000,
    egressGbMicros: 10_000,
  },
};

const policy: ManagedCloudPricingPolicy = {
  pricingVersion: 'managed-cloud-2026-08-a',
  targetGrossMarginBps: 5_000,
  providerContingencyBps: 1_000,
  priceIncrementCents: 100,
  snapshotAllowanceGb: 50,
  includedNatProcessedGb: 10,
  includedEgressGb: 20,
  platformOperationsReserveMicros: 1_000_000,
};

describe('managed cloud pricing', () => {
  it('publishes five simple plans without leaking provider machine types', () => {
    expect(listManagedCloudPlans()).toEqual([
      {
        id: 'starter',
        name: 'Starter',
        cpu: { vcpus: 2, shared: true },
        memoryGb: 4,
        recommended: false,
      },
      {
        id: 'standard',
        name: 'Standard',
        cpu: { vcpus: 2, shared: false },
        memoryGb: 8,
        recommended: true,
      },
      {
        id: 'performance',
        name: 'Performance',
        cpu: { vcpus: 4, shared: false },
        memoryGb: 16,
        recommended: false,
      },
      {
        id: 'power',
        name: 'Power',
        cpu: { vcpus: 8, shared: false },
        memoryGb: 32,
        recommended: false,
      },
      {
        id: 'max',
        name: 'Max',
        cpu: { vcpus: 16, shared: false },
        memoryGb: 64,
        recommended: false,
      },
    ]);
    expect(JSON.stringify(listManagedCloudPlans())).not.toMatch(/e2-/i);
  });

  it('keeps provider sizing internal while retaining an exact provisioning mapping', () => {
    expect(getManagedCloudProviderProfile('starter')).toMatchObject({
      machineType: 'e2-medium',
      bootDiskGb: 30,
      dataDiskGb: 100,
    });
    expect(getManagedCloudProviderProfile('standard')).toMatchObject({
      machineType: 'e2-standard-2',
      bootDiskGb: 30,
      dataDiskGb: 100,
    });
    expect(getManagedCloudProviderProfile('performance').machineType).toBe(
      'e2-standard-4',
    );
    expect(getManagedCloudProviderProfile('power').machineType).toBe(
      'e2-standard-8',
    );
    expect(getManagedCloudProviderProfile('max').machineType).toBe(
      'e2-standard-16',
    );
  });

  it('publishes the five regions already supported by managed-cloud provisioning', () => {
    expect(listManagedCloudRegions()).toEqual([
      { id: 'us-east1', name: 'US East (South Carolina)' },
      { id: 'us-east4', name: 'US East (Virginia)' },
      { id: 'us-central1', name: 'US Central (Iowa)' },
      { id: 'us-west1', name: 'US West (Oregon)' },
      { id: 'europe-west1', name: 'Europe West (Belgium)' },
    ]);
  });

  it('uses a 31-day always-on ceiling and computes landed cost by component', () => {
    const quote = calculateManagedCloudNodeQuote({
      planId: 'standard',
      region: 'us-east1',
      rateCard,
      policy,
    });

    expect(MANAGED_CLOUD_MONTHLY_HOURS_CEILING).toBe(744);
    expect(quote.providerCostMicros).toEqual({
      compute: 14_880_000,
      balancedDisks: 130_000,
      snapshots: 25_000,
      natGateway: 2_232_000,
      natDataProcessing: 40_000,
      egress: 200_000,
      subtotal: 17_507_000,
      contingency: 1_750_700,
    });
    expect(quote.landedCostMicros).toBe(20_257_700);
  });

  it('applies gross margin and rounds the customer price upward deterministically', () => {
    const quote = calculateManagedCloudNodeQuote({
      planId: 'standard',
      region: 'us-east1',
      rateCard,
      policy,
    });

    // $20.2577 landed at 50% target margin requires $40.5154 revenue.
    // Whole-dollar upward rounding produces a $41 monthly customer price.
    expect(quote.unroundedRequiredRevenueMicros).toBe(40_515_400);
    expect(quote.monthlyPriceCents).toBe(4_100);
    expect(quote.achievedGrossMarginBps).toBeGreaterThanOrEqual(5_000);
  });

  it('retains pricing provenance internally while exposing a simple public quote', () => {
    const quote = calculateManagedCloudNodeQuote({
      planId: 'standard',
      region: 'us-east1',
      rateCard,
      policy,
    });
    const publicQuote = toManagedCloudPublicQuote(quote);

    expect(quote).toMatchObject({
      pricingVersion: 'managed-cloud-2026-08-a',
      rateCardVersion: 'gcp-public-2026-08-11',
      rateCardEffectiveAt: '2026-08-11T00:00:00.000Z',
      provider: 'gcp',
      providerMachineType: 'e2-standard-2',
    });
    expect(publicQuote).toEqual({
      plan: {
        id: 'standard',
        name: 'Standard',
        cpu: { vcpus: 2, shared: false },
        memoryGb: 8,
        recommended: true,
      },
      region: { id: 'us-east1', name: 'US East (South Carolina)' },
      billingPeriod: 'month',
      currency: 'USD',
      monthlyPriceCents: 4_100,
      pricingVersion: 'managed-cloud-2026-08-a',
    });
    expect(JSON.stringify(publicQuote)).not.toMatch(
      /machineType|providerCost|landedCost|e2-/i,
    );
  });

  it('rejects invalid business policy and mismatched or invalid provider rates', () => {
    expect(() =>
      calculateManagedCloudNodeQuote({
        planId: 'standard',
        region: 'us-east1',
        rateCard,
        policy: { ...policy, targetGrossMarginBps: 10_000 },
      }),
    ).toThrow(/gross margin/i);

    expect(() =>
      calculateManagedCloudNodeQuote({
        planId: 'standard',
        region: 'us-east4',
        rateCard,
        policy,
      }),
    ).toThrow(/rate card.*region/i);

    expect(() =>
      calculateManagedCloudNodeQuote({
        planId: 'standard',
        region: 'us-east1',
        rateCard: {
          ...rateCard,
          rates: { ...rateCard.rates, natGatewayHourlyMicros: -1 },
        },
        policy,
      }),
    ).toThrow(/rate/i);
  });
});


describe('managed cloud rate-card hardening', () => {
  it('rejects unsupported provider or currency values at runtime', () => {
    expect(() =>
      calculateManagedCloudNodeQuote({
        planId: 'standard',
        region: 'us-east1',
        rateCard: { ...rateCard, provider: 'aws' as 'gcp' },
        policy,
      }),
    ).toThrow(/provider/i);

    expect(() =>
      calculateManagedCloudNodeQuote({
        planId: 'standard',
        region: 'us-east1',
        rateCard: { ...rateCard, currency: 'EUR' as 'USD' },
        policy,
      }),
    ).toThrow(/currency/i);
  });
});
