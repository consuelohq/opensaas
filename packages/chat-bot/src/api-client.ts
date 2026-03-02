import { createLogger } from '@consuelo/logger';

const logger = createLogger('chat-bot:api');

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000;

export type ApiClientConfig = {
  baseUrl: string;
  apiKey: string;
};

export function createApiClient(config: ApiClientConfig) {
  async function request<TResult>(method: string, path: string, body?: unknown): Promise<TResult> {
    let lastError: unknown;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const response = await fetch(`${config.baseUrl}${path}`, {
          method,
          headers: {
            'authorization': `Bearer ${config.apiKey}`,
            'content-type': 'application/json',
          },
          body: body ? JSON.stringify(body) : undefined,
        });

        if (!response.ok) {
          const text = await response.text().catch(() => '');
          const error = new Error(`API ${method} ${path} returned ${response.status}: ${text}`);
          logger.error('api request failed', { method, path, status: response.status, attempt });
          if (response.status >= 500 && attempt < MAX_RETRIES) {
            lastError = error;
            const delay = BASE_DELAY_MS * Math.pow(2, attempt);
            await new Promise(resolve => setTimeout(resolve, delay));
            continue;
          }
          throw error;
        }

        return await response.json() as TResult;
      } catch (err: unknown) {
        lastError = err;
        if (attempt < MAX_RETRIES) {
          const delay = BASE_DELAY_MS * Math.pow(2, attempt);
          logger.warn('api request error, retrying', {
            method,
            path,
            attempt,
            delay,
            error: err instanceof Error ? err.message : 'unknown',
          });
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError;
  }

  return {
    get: <TResult>(path: string) => request<TResult>('GET', path),
    post: <TResult>(path: string, body?: unknown) => request<TResult>('POST', path, body),
    put: <TResult>(path: string, body?: unknown) => request<TResult>('PUT', path, body),
    delete: <TResult>(path: string) => request<TResult>('DELETE', path),
  };
}
