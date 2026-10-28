import { Effect } from 'effect';

import { LEAD_CONNECTOR_API_VERSION } from '../constants.js';
import type {
  LeadConnectorHttpRequest,
  LeadConnectorHttpResponse,
} from '../contracts/index.js';
import { LeadConnectorProviderError } from '../errors.js';
import {
  LeadConnectorConfig,
  LeadConnectorHttpTransport,
} from '../ports/index.js';

export const asRecord = (value: unknown): Record<string, unknown> =>
  typeof value === 'object' && value !== null
    ? (value as Record<string, unknown>)
    : {};

export const readString = (
  record: Record<string, unknown>,
  ...keys: string[]
): string | null => {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.length > 0) return value;
  }
  return null;
};

export const readNumber = (
  record: Record<string, unknown>,
  ...keys: string[]
): number | null => {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'number' && Number.isFinite(value)) return value;
  }
  return null;
};

export const providerHeaders = (
  accessToken?: string,
): Record<string, string> => ({
  Accept: 'application/json',
  'Content-Type': 'application/json',
  Version: LEAD_CONNECTOR_API_VERSION,
  ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
});

export const requestLeadConnector = (
  request: LeadConnectorHttpRequest,
  operation: string,
) =>
  Effect.gen(function* () {
    const transport = yield* LeadConnectorHttpTransport;
    const response = yield* transport.request(request);
    const statusCode = response.status;
    if (statusCode < 200 || statusCode >= 300) {
      return yield* Effect.fail(
        new LeadConnectorProviderError({
          operation,
          status: statusCode,
          message: 'LeadConnector provider request failed',
          retryable: statusCode === 429 || statusCode >= 500,
        }),
      );
    }
    return response;
  });

export const providerUrl = (path: string) =>
  Effect.gen(function* () {
    const config = yield* LeadConnectorConfig;
    return `${config.apiBaseUrl.replace(/\/$/, '')}${path}`;
  });
