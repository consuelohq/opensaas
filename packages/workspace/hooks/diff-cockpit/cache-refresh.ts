export type DiffCockpitCacheRefreshOptions = {
  origin?: string;
  repo: string;
  pulls?: number[];
  codePaths?: string[];
  reason?: string;
  token?: string;
  fetcher?: typeof fetch;
  timeoutMs?: number;
};

export type DiffCockpitCacheRefreshResult = {
  ok: boolean;
  reason: string;
  cache: string;
  refreshed: {
    homepage: string;
    pulls: string[];
    code: string[];
    history: string[];
  };
};

const DEFAULT_ORIGIN = 'https://diffs.consuelohq.com';
const DEFAULT_TIMEOUT_MS = 15_000;

export async function refreshDiffCockpitCache(
  options: DiffCockpitCacheRefreshOptions,
): Promise<DiffCockpitCacheRefreshResult> {
  const origin = (options.origin || process.env.DIFF_COCKPIT_ORIGIN || DEFAULT_ORIGIN).replace(/\/$/, '');
  const token = options.token || process.env.DIFF_COCKPIT_REFRESH_TOKEN || '';
  if (!token) {
    throw new Error('DIFF_COCKPIT_REFRESH_TOKEN is required to refresh diff cockpit cache');
  }

  const fetcher = options.fetcher || fetch;
  const controller = new AbortController();
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);
  let response: Response;
  try {
    response = await fetcher(`${origin}/internal/cache/refresh`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        repo: options.repo,
        pulls: options.pulls || [],
        codePaths: options.codePaths || ['packages'],
        reason: options.reason || 'manual',
      }),
      signal: controller.signal,
    });
  } catch (error: unknown) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`diff cockpit cache refresh timed out after ${timeoutMs}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timeoutHandle);
  }

  const text = await response.text();
  let payload: unknown;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch (error: unknown) {
    throw new Error(`diff cockpit cache refresh returned non-JSON response: ${error instanceof Error ? error.message : String(error)}`);
  }

  if (!response.ok) {
    const message = getPayloadError(payload) || `diff cockpit cache refresh failed with HTTP ${response.status}`;
    throw new Error(message);
  }

  if (!isRefreshResult(payload)) {
    throw new Error('diff cockpit cache refresh returned an unexpected payload');
  }

  return payload;
}

function getPayloadError(payload: unknown): string {
  if (!payload || typeof payload !== 'object') return '';
  const value = (payload as { error?: unknown }).error;
  return typeof value === 'string' ? value : '';
}

function isRefreshResult(value: unknown): value is DiffCockpitCacheRefreshResult {
  if (!value || typeof value !== 'object') return false;
  const result = value as DiffCockpitCacheRefreshResult;
  return result.ok === true
    && typeof result.reason === 'string'
    && typeof result.cache === 'string'
    && !!result.refreshed
    && typeof result.refreshed.homepage === 'string'
    && Array.isArray(result.refreshed.pulls)
    && result.refreshed.pulls.every((pull) => typeof pull === 'string')
    && Array.isArray(result.refreshed.code)
    && result.refreshed.code.every((path) => typeof path === 'string')
    && Array.isArray(result.refreshed.history)
    && result.refreshed.history.every((path) => typeof path === 'string');
}
