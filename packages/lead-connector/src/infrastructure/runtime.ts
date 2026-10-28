import { Effect, Layer } from 'effect';

import {
  LEAD_CONNECTOR_API_BASE_URL,
  LEAD_CONNECTOR_AUTHORIZATION_URL,
} from '../constants.js';
import type { LeadConnectorConfiguration } from '../contracts/index.js';
import { LeadConnectorStateError, errorMessage } from '../errors.js';
import {
  LeadConnectorClock,
  LeadConnectorConfig,
  LeadConnectorRandom,
} from '../ports/index.js';

export const createLeadConnectorConfigLayer = (
  configuration: Omit<
    LeadConnectorConfiguration,
    'apiBaseUrl' | 'authorizationUrl' | 'tokenRefreshSkewSeconds' | 'userType'
  > &
    Partial<
      Pick<
        LeadConnectorConfiguration,
        | 'apiBaseUrl'
        | 'authorizationUrl'
        | 'tokenRefreshSkewSeconds'
        | 'userType'
      >
    >,
) =>
  Layer.succeed(LeadConnectorConfig, {
    ...configuration,
    apiBaseUrl: configuration.apiBaseUrl ?? LEAD_CONNECTOR_API_BASE_URL,
    authorizationUrl:
      configuration.authorizationUrl ?? LEAD_CONNECTOR_AUTHORIZATION_URL,
    tokenRefreshSkewSeconds: configuration.tokenRefreshSkewSeconds ?? 300,
    userType: configuration.userType ?? 'Location',
  });

export const liveLeadConnectorClockLayer = Layer.succeed(LeadConnectorClock, {
  now: Effect.sync(() => new Date()),
});

export const liveLeadConnectorRandomLayer = Layer.succeed(LeadConnectorRandom, {
  randomBytes: (length) =>
    Effect.try({
      try: () => crypto.getRandomValues(new Uint8Array(length)),
      catch: (cause) =>
        new LeadConnectorStateError({
          operation: 'random-bytes',
          message: errorMessage(cause),
          retryable: false,
          cause,
        }),
    }),
});
