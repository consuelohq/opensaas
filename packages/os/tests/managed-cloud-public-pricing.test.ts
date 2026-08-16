import { describe, expect, it } from 'vitest';

import {
  buildManagedCloudPublicCatalog,
  managedCloudPricingFromJson,
} from '../cloudflare/os-device-authority/src/services/managed-cloud-pricing';
import {
  createDefaultManagedCloudPricingRuntime,
  MANAGED_CLOUD_PUBLIC_RATE_CARD_EFFECTIVE_AT,
} from '../scripts/lib/managed-cloud-public-pricing';
import {
  fetchGoogleCloudPublicPricingRuntime,
  parseGoogleCloudPublicPricingPages,
} from '../scripts/lib/google-cloud-public-pricing-refresh';
import { listManagedCloudRegions } from '../scripts/lib/managed-cloud-pricing';

describe('managed cloud public Google pricing baseline', () => {
  it('ships one current Google public rate card for every supported region', () => {
    const runtime = createDefaultManagedCloudPricingRuntime();

    const cards = Object.values(runtime.rateCards);
    expect(Object.keys(runtime.rateCards)).toEqual(
      listManagedCloudRegions().map((region) => region.id),
    );
    expect(new Set(cards.map((card) => card.version)).size).toBe(1);
    expect(cards.every((card) => card.provider === 'gcp' && card.currency === 'USD')).toBe(true);
    expect(cards.every((card) => card.effectiveAt === MANAGED_CLOUD_PUBLIC_RATE_CARD_EFFECTIVE_AT)).toBe(true);
    expect(runtime.policy.pricingVersion).toContain('google-public');
  });

  it('turns the baseline into five positive monthly checkout quotes per region without leaking provider internals', () => {
    const runtime = createDefaultManagedCloudPricingRuntime();

    for (const region of listManagedCloudRegions()) {
      const catalog = buildManagedCloudPublicCatalog(runtime, region.id);
      expect(catalog.pricingAvailable).toBe(true);
      expect(catalog.quotes).toHaveLength(5);
      expect(catalog.quotes.every((quote) => Number.isSafeInteger(quote.monthlyPriceCents) && quote.monthlyPriceCents > 0)).toBe(true);
      expect(JSON.stringify(catalog)).not.toMatch(/machineType|providerCost|landedCost|targetGrossMargin|e2-/i);
    }
  });

  it('uses the checked-in Google public baseline only when no explicit pricing override exists', () => {
    const fallback = createDefaultManagedCloudPricingRuntime();
    expect(managedCloudPricingFromJson({ fallback })).toEqual(fallback);

    expect(managedCloudPricingFromJson({
      fallback,
      policyJson: '{bad json',
      rateCardsJson: '[]',
    })).toBeUndefined();
    expect(managedCloudPricingFromJson({
      fallback,
      policyJson: JSON.stringify(fallback.policy),
    })).toBeUndefined();
  });
});


const computeSnippet = (regionName: string, region: string, hourly: string) =>
  String.raw`\u003cp\u003ee2-standard-2\u003c/p\u003e],[null,[null,\"$${hourly} / 1 hour\"]],1]]],\"${regionName} (${region})\",[3],1]`;

const livePricingPages = () => ({
  computeHtml: [
    computeSnippet('South Carolina', 'us-east1', '0.06701142'),
    computeSnippet('Northern Virginia', 'us-east4', '0.07547082'),
    computeSnippet('Iowa', 'us-central1', '0.06701142'),
    computeSnippet('Oregon', 'us-west1', '0.06701142'),
    computeSnippet('Belgium', 'europe-west1', '0.07371546'),
  ].join(''),
  diskHtml: `Balanced provisioned space $0.000136986 / 1 gibibyte hour
    Standard snapshot storage $0.000068493 / 1 gibibyte hour`,
  natHtml: `Up to 32 VM instances $0.0014 * the number of VM instances that are using the gateway $0.045 $0.005`,
  networkHtml: `Internet data transfer rates Premium Tier pricing Item Price Network (data transfer out) TO North America 0 gibibyte to 1 gibibyte $0.00 1 gibibyte to 1,024 gibibyte $0.12 / 1 gibibyte`,
});

describe('Google public pricing refresh', () => {
  it('parses the exact supported-region E2, disk, NAT, and Premium Tier rates into a versioned runtime', () => {
    const runtime = parseGoogleCloudPublicPricingPages({
      ...livePricingPages(),
      now: new Date('2026-08-15T07:45:00.000Z'),
    });

    expect(runtime.policy.pricingVersion).toBe('managed-cloud-google-public-2026-08-15-v1');
    expect(runtime.rateCards['us-east1'].rates.computeHourlyMicrosByPlan).toEqual({
      starter: 33_506,
      standard: 67_012,
      performance: 134_023,
      power: 268_046,
      max: 536_092,
    });
    expect(runtime.rateCards['us-east4'].rates.computeHourlyMicrosByPlan.standard).toBe(75_471);
    expect(runtime.rateCards['europe-west1'].rates.computeHourlyMicrosByPlan.standard).toBe(73_716);
    expect(runtime.rateCards['us-east1'].rates).toMatchObject({
      balancedDiskGbMonthMicros: 100_000,
      snapshotGbMonthMicros: 50_000,
      natGatewayHourlyMicros: 6_400,
      natDataProcessingGbMicros: 45_000,
      egressGbMicros: 120_000,
    });
    expect(runtime.rateCards['us-east1'].version).toBe('gcp-public-list-2026-08-15');
    expect(runtime.rateCards['us-east1'].effectiveAt).toBe('2026-08-15T07:45:00.000Z');
  });

  it('fails closed when Google no longer exposes a required region or rate component', () => {
    const pages = livePricingPages();
    expect(() => parseGoogleCloudPublicPricingPages({
      ...pages,
      computeHtml: pages.computeHtml.replace(
        computeSnippet('Belgium', 'europe-west1', '0.07371546'),
        '',
      ),
      now: new Date('2026-08-15T07:45:00.000Z'),
    })).toThrow(/europe-west1/i);
    expect(() => parseGoogleCloudPublicPricingPages({
      ...pages,
      natHtml: 'Google Cloud NAT pricing changed',
      now: new Date('2026-08-15T07:45:00.000Z'),
    })).toThrow(/NAT/i);
  });

  it('fetches only official Google pricing pages and returns the parsed runtime', async () => {
    const pages = livePricingPages();
    const requested: string[] = [];
    const responses = new Map([
      ['https://cloud.google.com/products/compute/pricing/general-purpose?hl=en', pages.computeHtml],
      ['https://cloud.google.com/compute/disks-image-pricing?hl=en', pages.diskHtml],
      ['https://cloud.google.com/nat/pricing?hl=en', pages.natHtml],
      ['https://cloud.google.com/vpc/pricing?hl=en', pages.networkHtml],
    ]);
    const runtime = await fetchGoogleCloudPublicPricingRuntime({
      now: new Date('2026-08-15T07:45:00.000Z'),
      async fetchImpl(input) {
        const url = String(input);
        requested.push(url);
        const body = responses.get(url);
        if (!body) return new Response('not found', { status: 404 });
        return new Response(body, { status: 200 });
      },
    });

    expect(requested).toEqual([...responses.keys()]);
    expect(runtime.rateCards['us-central1'].rates.computeHourlyMicrosByPlan.standard).toBe(67_012);
  });
});
