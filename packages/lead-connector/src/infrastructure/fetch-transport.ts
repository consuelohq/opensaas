import { Effect, Layer } from 'effect';

import { LeadConnectorProviderError, errorMessage } from '../errors.js';
import { LeadConnectorHttpTransport } from '../ports/index.js';

const contentType = (headers: Record<string, string>): string =>
  Object.entries(headers).find(
    ([name]) => name.toLowerCase() === 'content-type',
  )?.[1] ?? '';

const serializeBody = (
  body: unknown,
  headers: Record<string, string>,
): BodyInit | undefined => {
  if (body === undefined) return undefined;
  if (
    contentType(headers)
      .toLowerCase()
      .startsWith('application/x-www-form-urlencoded')
  ) {
    if (body instanceof URLSearchParams) return body.toString();
    if (typeof body === 'object' && body !== null && !Array.isArray(body)) {
      const parameters = new URLSearchParams();
      for (const [key, value] of Object.entries(body)) {
        if (value === undefined || value === null) continue;
        parameters.set(key, String(value));
      }
      return parameters.toString();
    }
    return String(body);
  }
  return JSON.stringify(body);
};

export const createLeadConnectorFetchTransportLayer = (
  fetchImplementation: typeof fetch = fetch,
) =>
  Layer.succeed(LeadConnectorHttpTransport, {
    request: (request) =>
      Effect.tryPromise({
        try: async () => {
          const response = await fetchImplementation(request.url, {
            method: request.method,
            headers: request.headers,
            body: serializeBody(request.body, request.headers),
          });
          const text = await response.text();
          let body: unknown = null;
          if (text.length > 0) {
            try {
              body = JSON.parse(text) as unknown;
            } catch {
              body = text;
            }
          }
          return { status: response.status, body };
        },
        catch: (cause) =>
          new LeadConnectorProviderError({
            operation: 'http-request',
            message: errorMessage(cause),
            retryable: true,
            cause,
          }),
      }),
  });
