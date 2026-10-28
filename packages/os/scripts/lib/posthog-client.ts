import { execFileSync } from 'node:child_process';

export type PosthogConfig = {
  region?: 'us' | 'eu';
  apiHost: string;
  ingestHost: string;
  projectId?: string;
  personalApiKey?: string;
  projectToken?: string;
};

type Environment = Record<string, string | undefined>;
type Fetch = (input: string | URL, init?: RequestInit) => Promise<Response>;

const REGIONS = {
  us: { apiHost: 'https://us.posthog.com', ingestHost: 'https://us.i.posthog.com' },
  eu: { apiHost: 'https://eu.posthog.com', ingestHost: 'https://eu.i.posthog.com' },
} as const;

const KEYCHAIN = {
  personalApiKey: 'consuelo-posthog-personal-api-key',
  projectToken: 'consuelo-posthog-project-token',
  projectId: 'consuelo-posthog-project-id',
  region: 'consuelo-posthog-region',
} as const;

const MAX_RESPONSE_BYTES = 2_000_000;
const MAX_RESULTS = 100;
const SENSITIVE_PROPERTY = /(^|[_-])(phone|email|address|transcript|password|secret|token|authorization|cookie|recording|audio|message|customer|contact|ssn|dob|call_sid|caller)([_-]|$)/i;
const SENSITIVE_VALUE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;

export function readPosthogKeychain(service: string): string | null {
  if (process.platform !== 'darwin') return null;
  try {
    return execFileSync('security', ['find-generic-password', '-s', service, '-w'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 4000,
    }).trim() || null;
  } catch {
    return null;
  }
}

export function resolvePosthogConfig(
  environment: Environment = process.env,
  readKeychain: (service: string) => string | null = readPosthogKeychain,
): PosthogConfig {
  const rawRegion = environment.POSTHOG_REGION?.trim().toLowerCase() || readKeychain(KEYCHAIN.region) || 'us';
  if (rawRegion !== 'us' && rawRegion !== 'eu') {
    throw new Error('PostHog region must be us or eu.');
  }
  const region = rawRegion;
  const hosts = REGIONS[region];
  const customHost = environment.POSTHOG_HOST?.trim();
  if (customHost) {
    const url = new URL(customHost);
    if (url.protocol !== 'https:') throw new Error('PostHog host must use https.');
    if (url.pathname !== '/' || url.search || url.hash || url.username || url.password || url.port) {
      throw new Error('PostHog host must be a clean HTTPS origin.');
    }
    if (url.origin !== hosts.apiHost && url.origin !== hosts.ingestHost) {
      throw new Error('PostHog host must match the selected PostHog region.');
    }
  }

  const readValue = (key: string, service: string) => environment[key]?.trim() || readKeychain(service) || undefined;
  return {
    region,
    ...hosts,
    personalApiKey: readValue('POSTHOG_PERSONAL_API_KEY', KEYCHAIN.personalApiKey),
    projectToken: environment.POSTHOG_PROJECT_TOKEN?.trim() || environment.POSTHOG_API_KEY?.trim() || readKeychain(KEYCHAIN.projectToken) || undefined,
    projectId: readValue('POSTHOG_PROJECT_ID', KEYCHAIN.projectId),
  };
}

function positiveLimit(value: number | undefined, fallback = 25): number {
  if (value === undefined) return fallback;
  if (!Number.isInteger(value) || value < 1 || value > MAX_RESULTS) {
    throw new Error('PostHog limit must be an integer from 1 to 100.');
  }
  return value;
}

function validProjectId(value: string | undefined): string {
  if (!value || !/^\d{1,15}$/.test(value)) throw new Error('PostHog project id must be a numeric project id.');
  return value;
}

function validateHogql(sql: string): string {
  const query = sql.trim();
  if (query.length === 0 || query.length > 5000) throw new Error('PostHog HogQL query must be 1 to 5000 characters.');
  if (!/^(select|with)\b/i.test(query) || /\b(insert|delete|update|drop|alter|truncate|create|grant|revoke)\b/i.test(query)) {
    throw new Error('PostHog query must be read-only HogQL.');
  }
  if (/[;]/.test(query) || /--|\/\*/.test(query)) throw new Error('PostHog query must be a single statement without SQL comments.');
  return query;
}

async function readBoundedJson(response: Response): Promise<unknown> {
  if (Number(response.headers.get('content-length')) > MAX_RESPONSE_BYTES) {
    throw new Error('PostHog response exceeded the size limit.');
  }
  if (!response.body) return null;
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_RESPONSE_BYTES) {
        await reader.cancel();
        throw new Error('PostHog response exceeded the size limit.');
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const buffer = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    buffer.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return JSON.parse(new TextDecoder().decode(buffer)) as unknown;
  } catch {
    throw new Error('PostHog response is not valid JSON.');
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function checkSensitiveProperties(properties: Record<string, unknown>): void {
  const inspect = (value: unknown, depth: number): void => {
    if (depth > 4) throw new Error('PostHog event properties are too deeply nested.');
    if (typeof value === 'string' && (value.length > 500 || SENSITIVE_VALUE.test(value))) {
      throw new Error('PostHog event properties contain sensitive or oversized values.');
    }
    if (Array.isArray(value)) {
      if (value.length > 30) throw new Error('PostHog event properties are too large.');
      for (const item of value) inspect(item, depth + 1);
    } else if (value && typeof value === 'object') {
      for (const [key, item] of Object.entries(value)) {
        if (SENSITIVE_PROPERTY.test(key)) throw new Error('PostHog event properties contain sensitive fields.');
        inspect(item, depth + 1);
      }
    }
  };
  if (Object.keys(properties).length > 30) throw new Error('PostHog event properties are too large.');
  inspect(properties, 0);
}

export function createPosthogClient({ config, fetchImpl = fetch }: { config: PosthogConfig; fetchImpl?: Fetch }) {
  const send = async (url: string, init: RequestInit): Promise<unknown> => {
    let response: Response;
    try {
      response = await fetchImpl(url, { ...init, redirect: 'error', signal: AbortSignal.timeout(12000) });
    } catch {
      throw new Error('PostHog request failed (network or timeout).');
    }
    if (!response.ok) {
      throw new Error(`PostHog API returned HTTP ${response.status}.`);
    }
    return readBoundedJson(response);
  };

  return {
    status() {
      return {
        region: config.region ?? (config.apiHost.includes('eu.') ? 'eu' : 'us'),
        apiHost: config.apiHost,
        ingestHost: config.ingestHost,
        hasPersonalApiKey: Boolean(config.personalApiKey),
        hasProjectToken: Boolean(config.projectToken),
        hasProjectId: Boolean(config.projectId),
      };
    },

    async projects({ limit }: { limit?: number } = {}) {
      try {
      if (!config.personalApiKey) throw new Error('PostHog personal API key is not configured.');
      const count = positiveLimit(limit);
      const url = new URL('/api/projects/', config.apiHost);
      url.searchParams.set('limit', String(count));
      const result = asRecord(await send(url.toString(), {
        method: 'GET',
        headers: { Authorization: `Bearer ${config.personalApiKey}`, Accept: 'application/json' },
      }));
      const projects = Array.isArray(result.results) ? result.results.slice(0, count).map((item) => {
        const record = asRecord(item);
        return { id: record.id, name: record.name };
      }) : [];
      return { projects, next: typeof result.next === 'string' ? result.next : null };
      } catch (error: unknown) {
        if (error instanceof Error) throw error;
        throw new Error('PostHog projects request failed.');
      }
    },

    async query({ sql, projectId, limit }: { sql: string; projectId?: string; limit?: number }) {
      try {
      if (!config.personalApiKey) throw new Error('PostHog personal API key is not configured.');
      const id = validProjectId(projectId ?? config.projectId);
      const count = positiveLimit(limit);
      const query = validateHogql(sql);
      const result = asRecord(await send(new URL(`/api/projects/${id}/query/`, config.apiHost).toString(), {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.personalApiKey}`,
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: { kind: 'HogQLQuery', query } }),
      }));
      const rows = Array.isArray(result.results) ? result.results : [];
      const columns = Array.isArray(result.columns) ? result.columns.filter((column): column is string => typeof column === 'string') : [];
      return {
        columns: columns.slice(0, MAX_RESULTS),
        rows: rows.slice(0, count),
        truncated: rows.length > count,
        count: Math.min(rows.length, count),
      };
      } catch (error: unknown) {
        if (error instanceof Error) throw error;
        throw new Error('PostHog query request failed.');
      }
    },

    async capture({ event, distinctId, properties = {} }: {
      event: string;
      distinctId: string;
      properties?: Record<string, unknown>;
    }) {
      try {
      if (!config.projectToken) throw new Error('PostHog project token is not configured.');
      if (!/^[a-zA-Z][a-zA-Z0-9_.:-]{0,127}$/.test(event)) {
        throw new Error('PostHog event must use a short machine-readable name.');
      }
      if (!/^[a-zA-Z0-9_.:-]{1,128}$/.test(distinctId)) {
        throw new Error('PostHog distinct id must be an opaque identifier, not personal information.');
      }
      checkSensitiveProperties(properties);
      const body = JSON.stringify({ api_key: config.projectToken, event, distinct_id: distinctId, properties });
      if (body.length > 10000) throw new Error('PostHog event payload is too large.');
      await send(new URL('/i/v0/e/', config.ingestHost).toString(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body,
      });
      return { accepted: true, event };
      } catch (error: unknown) {
        if (error instanceof Error) throw error;
        throw new Error('PostHog capture request failed.');
      }
    },
  };
}
