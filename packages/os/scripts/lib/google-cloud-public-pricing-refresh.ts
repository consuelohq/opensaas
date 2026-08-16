import {
  createDefaultManagedCloudPricingRuntime,
  type DefaultManagedCloudPricingRuntime,
} from './managed-cloud-public-pricing';
import type {
  ManagedCloudGcpRateCard,
  ManagedCloudPlanId,
  ManagedCloudRegionId,
} from './managed-cloud-pricing';

const GOOGLE_COMPUTE_PRICING_URL =
  'https://cloud.google.com/products/compute/pricing/general-purpose?hl=en';
const GOOGLE_DISK_PRICING_URL =
  'https://cloud.google.com/compute/disks-image-pricing?hl=en';
const GOOGLE_NAT_PRICING_URL = 'https://cloud.google.com/nat/pricing?hl=en';
const GOOGLE_VPC_PRICING_URL = 'https://cloud.google.com/vpc/pricing?hl=en';
const GOOGLE_PRICING_FETCH_TIMEOUT_MS = 30_000;
const GOOGLE_MONTH_HOURS = 730;

const SUPPORTED_REGIONS: ManagedCloudRegionId[] = [
  'us-east1',
  'us-east4',
  'us-central1',
  'us-west1',
  'europe-west1',
];

function fail(message: string): never {
  throw new Error(`Google Cloud public pricing refresh failed: ${message}`);
}

function positiveNumber(value: string | undefined, label: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    fail(`${label} is unavailable`);
  }
  return parsed;
}

function hourlyDollarsToMicros(value: number, multiplier = 1): number {
  return Math.ceil(value * multiplier * 1_000_000 - 1e-8);
}

function dollarsToMicros(value: number): number {
  return Math.round(value * 1_000_000);
}

function normalizeEmbeddedGoogleHtml(value: string): string {
  return value
    .replaceAll('\\u003c', '<')
    .replaceAll('\\u003e', '>')
    .replaceAll('\\"', '"');
}

function visibleText(value: string): string {
  return normalizeEmbeddedGoogleHtml(value)
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseRegionalE2Standard2Hourly(
  computeHtml: string,
): Record<ManagedCloudRegionId, number> {
  const normalized = normalizeEmbeddedGoogleHtml(computeHtml);
  const parts = normalized.split('<p>e2-standard-2</p>').slice(1);
  const values = new Map<ManagedCloudRegionId, Set<number>>();

  for (const part of parts) {
    const bounded = part.slice(0, 20_000);
    const priceMatch = /\$([0-9.]+) \/ 1 hour/.exec(bounded);
    const regionMatch = /"[^"\\]+ \(([a-z0-9-]+)\)",\[3\],1\]/.exec(bounded);
    if (!priceMatch || !regionMatch) continue;
    const region = regionMatch[1] as ManagedCloudRegionId;
    if (!SUPPORTED_REGIONS.includes(region)) continue;
    const price = positiveNumber(priceMatch[1], `${region} E2 price`);
    const regionValues = values.get(region) ?? new Set<number>();
    regionValues.add(price);
    values.set(region, regionValues);
  }

  return Object.fromEntries(SUPPORTED_REGIONS.map((region) => {
    const regionValues = values.get(region);
    if (!regionValues || regionValues.size === 0) {
      fail(`required E2 price for ${region} is unavailable`);
    }
    if (regionValues.size !== 1) {
      fail(`Google published conflicting E2 prices for ${region}`);
    }
    return [region, [...regionValues][0]];
  })) as Record<ManagedCloudRegionId, number>;
}

function computeRates(
  e2Standard2HourlyDollars: number,
): Record<ManagedCloudPlanId, number> {
  return {
    starter: hourlyDollarsToMicros(e2Standard2HourlyDollars, 0.5),
    standard: hourlyDollarsToMicros(e2Standard2HourlyDollars),
    performance: hourlyDollarsToMicros(e2Standard2HourlyDollars, 2),
    power: hourlyDollarsToMicros(e2Standard2HourlyDollars, 4),
    max: hourlyDollarsToMicros(e2Standard2HourlyDollars, 8),
  };
}

function parseStorageRates(diskHtml: string): {
  balancedDiskGbMonthMicros: number;
  snapshotGbMonthMicros: number;
} {
  const text = visibleText(diskHtml);
  const balanced = /Balanced provisioned space\s+\$([0-9.]+) \/ 1 gibibyte hour/i.exec(text);
  const snapshot = /Standard snapshot storage\s+\$([0-9.]+) \/ 1 gibibyte hour/i.exec(text);
  const balancedHourly = positiveNumber(balanced?.[1], 'balanced disk rate');
  const snapshotHourly = positiveNumber(snapshot?.[1], 'standard snapshot rate');
  return {
    balancedDiskGbMonthMicros: dollarsToMicros(balancedHourly * GOOGLE_MONTH_HOURS),
    snapshotGbMonthMicros: dollarsToMicros(snapshotHourly * GOOGLE_MONTH_HOURS),
  };
}

function parseNatRates(natHtml: string): {
  natGatewayHourlyMicros: number;
  natDataProcessingGbMicros: number;
} {
  const text = visibleText(natHtml);
  const section = /Up to 32 VM instances([\s\S]{0,900})/i.exec(text)?.[1];
  if (!section) fail('Cloud NAT rate table is unavailable');
  const values = [...section.matchAll(/\$([0-9.]+)/g)].map((match) =>
    positiveNumber(match[1], 'Cloud NAT rate'),
  );
  if (values.length < 3) fail('Cloud NAT rate components are unavailable');
  const [gatewayPerVmHourly, processingPerGib, externalIpHourly] = values;
  return {
    natGatewayHourlyMicros: dollarsToMicros(gatewayPerVmHourly + externalIpHourly),
    natDataProcessingGbMicros: dollarsToMicros(processingPerGib),
  };
}

function parsePremiumInternetEgressMicros(networkHtml: string): number {
  const text = visibleText(networkHtml);
  const sectionStart = text.indexOf('Internet data transfer rates Premium Tier pricing');
  if (sectionStart < 0) fail('Premium Tier internet data transfer table is unavailable');
  const bounded = text.slice(sectionStart, sectionStart + 8_000);
  const match = /1 gibibyte to 1,024 gibibyte\s+\$([0-9.]+)/i.exec(bounded);
  return dollarsToMicros(positiveNumber(match?.[1], 'Premium Tier internet egress rate'));
}

export function parseGoogleCloudPublicPricingPages(input: {
  computeHtml: string;
  diskHtml: string;
  natHtml: string;
  networkHtml: string;
  now?: Date;
}): DefaultManagedCloudPricingRuntime {
  const now = input.now ?? new Date();
  if (!Number.isFinite(now.getTime())) fail('refresh timestamp is invalid');
  const date = now.toISOString().slice(0, 10);
  const effectiveAt = now.toISOString();
  const computeHourlyByRegion = parseRegionalE2Standard2Hourly(input.computeHtml);
  const storage = parseStorageRates(input.diskHtml);
  const nat = parseNatRates(input.natHtml);
  const egressGbMicros = parsePremiumInternetEgressMicros(input.networkHtml);
  const fallback = createDefaultManagedCloudPricingRuntime();
  const version = `gcp-public-list-${date}`;

  const rateCards = Object.fromEntries(SUPPORTED_REGIONS.map((region) => [
    region,
    {
      provider: 'gcp',
      currency: 'USD',
      version,
      effectiveAt,
      region,
      rates: {
        computeHourlyMicrosByPlan: computeRates(computeHourlyByRegion[region]),
        ...storage,
        ...nat,
        egressGbMicros,
      },
    } satisfies ManagedCloudGcpRateCard,
  ])) as Record<ManagedCloudRegionId, ManagedCloudGcpRateCard>;

  return {
    policy: {
      ...fallback.policy,
      pricingVersion: `managed-cloud-google-public-${date}-v1`,
    },
    rateCards,
  };
}

async function fetchPricingPage(
  url: string,
  fetchImpl: typeof fetch,
): Promise<string> {
  try {
    const response = await fetchImpl(url, {
      headers: { 'user-agent': 'consuelo-os-pricing-refresh/1.0' },
      signal: AbortSignal.timeout(GOOGLE_PRICING_FETCH_TIMEOUT_MS),
    });
    if (!response.ok) {
      fail(`${url} returned HTTP ${response.status}`);
    }
    return await response.text();
  } catch (error: unknown) {
    if (error instanceof Error && error.message.startsWith('Google Cloud public pricing refresh failed:')) {
      throw error;
    }
    fail(`${url} could not be fetched: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export async function fetchGoogleCloudPublicPricingRuntime(input: {
  fetchImpl?: typeof fetch;
  now?: Date;
} = {}): Promise<DefaultManagedCloudPricingRuntime> {
  try {
    const fetchImpl = input.fetchImpl ?? fetch;
    const [computeHtml, diskHtml, natHtml, networkHtml] = await Promise.all([
      fetchPricingPage(GOOGLE_COMPUTE_PRICING_URL, fetchImpl),
      fetchPricingPage(GOOGLE_DISK_PRICING_URL, fetchImpl),
      fetchPricingPage(GOOGLE_NAT_PRICING_URL, fetchImpl),
      fetchPricingPage(GOOGLE_VPC_PRICING_URL, fetchImpl),
    ]);
    return parseGoogleCloudPublicPricingPages({
      computeHtml,
      diskHtml,
      natHtml,
      networkHtml,
      now: input.now,
    });
  } catch (error: unknown) {
    if (error instanceof Error && error.message.startsWith('Google Cloud public pricing refresh failed:')) {
      throw error;
    }
    fail(error instanceof Error ? error.message : String(error));
  }
}
