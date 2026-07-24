import { Effect, Layer } from 'effect';

import { LeadConnectorProviderError, errorMessage } from '../errors.js';
import { LeadConnectorHttpTransport } from '../ports/index.js';

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
            body:
              request.body === undefined
                ? undefined
                : JSON.stringify(request.body),
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
