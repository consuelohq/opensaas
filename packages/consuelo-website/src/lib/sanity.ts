const DEFAULT_SANITY_PROJECT_ID = '7urjyvic';
const DEFAULT_SANITY_DATASET = 'production';
const DEFAULT_SANITY_API_VERSION = '2026-04-09';

const sanitizeBoolean = (value: string | undefined, fallback: boolean): boolean => {
  if (value === undefined) {
    return fallback;
  }

  return value.toLowerCase() === 'true';
};

export const sanityConfig = {
  projectId: import.meta.env.SANITY_PROJECT_ID ?? DEFAULT_SANITY_PROJECT_ID,
  dataset: import.meta.env.SANITY_DATASET ?? DEFAULT_SANITY_DATASET,
  apiVersion: import.meta.env.SANITY_API_VERSION ?? DEFAULT_SANITY_API_VERSION,
  readToken: import.meta.env.SANITY_READ_TOKEN,
  useCdn: sanitizeBoolean(import.meta.env.SANITY_USE_CDN, false),
};

const buildSanityQueryUrl = (query: string, params: Record<string, unknown>): URL => {
  const host = sanityConfig.useCdn
    ? `${sanityConfig.projectId}.apicdn.sanity.io`
    : `${sanityConfig.projectId}.api.sanity.io`;

  const url = new URL(`https://${host}/v${sanityConfig.apiVersion}/data/query/${sanityConfig.dataset}`);
  url.searchParams.set('query', query);

  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(`$${key}`, JSON.stringify(value));
  }

  return url;
};

export const fetchSanityQuery = async <T>(
  query: string,
  params: Record<string, unknown> = {},
): Promise<T | null> => {
  const url = buildSanityQueryUrl(query, params);
  const headers = sanityConfig.readToken
    ? {
        Authorization: `Bearer ${sanityConfig.readToken}`,
      }
    : undefined;

  const response = await fetch(url, { headers });

  if (!response.ok) {
    throw new Error(`Sanity query failed with ${response.status} ${response.statusText}`);
  }

  const payload = (await response.json()) as { result?: T | null };
  return payload.result ?? null;
};
