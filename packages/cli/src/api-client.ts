import { loadConfig } from './config.js';
import { error } from './output.js';

interface ApiClientConfig {
  baseUrl: string;
  apiKey: string;
  workspaceId?: string;
}

export interface ApiResponse<TData = unknown> {
  ok: boolean;
  status: number;
  data: TData;
}

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

  const res = await fetch(url.toString(), {
    method,
    headers,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });

  const data = await res.json() as TData;
  return { ok: res.ok, status: res.status, data };
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
  const apiErr = data as { error?: { code?: string; message?: string } };
  const msg = apiErr?.error?.message ?? `request failed (${status})`;

  if (status === 401) error('unauthorized — check your API key');
  else if (status === 404) error(msg);
  else if (status === 429) error('rate limited — try again in a moment');
  else error(msg);

  process.exit(1);
};
