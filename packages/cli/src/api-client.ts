import { loadConfig } from './config.js';
import { error } from './output.js';
import { captureError } from './sentry.js';

interface ApiClientConfig {
  baseUrl: string;
  apiKey: string;
  workspaceId?: string;
}

export type ApiResponse<TData = unknown> =
  | { ok: true; status: number; data: TData }
  | { ok: false; status: number; data: unknown };

export const getApiError = (data: unknown): { code?: string; message?: string } | null => {
  if (typeof data !== 'object' || data === null) return null;
  // HACK: narrowing from unknown requires intermediate cast
  const obj = data as Record<string, unknown>;
  if (typeof obj.error !== 'object' || obj.error === null) return null;
  // HACK: narrowing from unknown requires intermediate cast
  const err = obj.error as Record<string, unknown>;
  return {
    code: typeof err.code === 'string' ? err.code : undefined,
    message: typeof err.message === 'string' ? err.message : undefined,
  };
};

const resolveConfig = (): ApiClientConfig => {
  const config = loadConfig();
  const baseUrl = process.env.CONSUELO_API_URL ?? config.apiUrl ?? 'http://localhost:8000';
  const apiKey = process.env.CONSUELO_API_KEY ?? config.apiKey ?? '';
  const workspaceId = process.env.CONSUELO_WORKSPACE_ID ?? config.workspaceId;

  if (!apiKey) {
    error('not configured — run `consuelo init` or set CONSUELO_API_KEY');
    process.exit(1);
  }

  return { baseUrl, apiKey, workspaceId };
};

const request = async <TData>(method: string, path: string, body?: unknown, query?: Record<string, string>): Promise<ApiResponse<TData>> => {
  const { baseUrl, apiKey, workspaceId } = resolveConfig();

  const url = new URL(path, baseUrl);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined) url.searchParams.set(k, v);
    }
  }

  const headers: Record<string, string> = {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  };
  if (workspaceId) headers['X-Workspace-Id'] = workspaceId;

  try {
    const res = await fetch(url.toString(), {
      method,
      headers,
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });

    const data: unknown = await res.json().catch(() => null);

    if (res.ok) return { ok: true, status: res.status, data: data as TData };
    return { ok: false, status: res.status, data };
  } catch (err: unknown) {
    captureError(err, { category: 'network' });
    const message = err instanceof Error ? err.message : '';
    if (message.includes('ECONNREFUSED') || message.includes('fetch failed')) {
      error(`could not connect to API at ${baseUrl} — is the server running?`);
    } else if (message.includes('ENOTFOUND')) {
      error(`could not resolve ${url.hostname} — check your API URL`);
    } else {
      error(`network error: ${message || 'unknown'}`);
    }
    process.exit(1);
  }
};

export const apiGet = async <TData>(path: string, query?: Record<string, string>): Promise<ApiResponse<TData>> =>
  request<TData>('GET', path, undefined, query);

export const apiPost = async <TData>(path: string, body?: unknown): Promise<ApiResponse<TData>> =>
  request<TData>('POST', path, body);

export const apiPut = async <TData>(path: string, body?: unknown): Promise<ApiResponse<TData>> =>
  request<TData>('PUT', path, body);

export const apiDelete = async <TData>(path: string): Promise<ApiResponse<TData>> =>
  request<TData>('DELETE', path);

export const handleApiError = (status: number, data: unknown): never => {
  const apiErr = getApiError(data);
  const msg = apiErr?.message ?? `request failed (${status})`;

  if (status === 401) error('unauthorized — check your API key');
  else if (status === 404) error(msg);
  else if (status === 429) error('rate limited — try again in a moment');
  else error(msg);

  process.exit(1);
};
