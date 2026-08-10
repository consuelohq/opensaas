import { Context, type Effect } from 'effect';

import type { ParallelGroup, ParallelTelemetry } from '../types.js';

export type DialerTelemetryService = {
  recordParallelGroup: (
    group: ParallelGroup,
    telemetry: ParallelTelemetry,
  ) => Effect.Effect<void>;
};

export const DialerTelemetry = Context.GenericTag<DialerTelemetryService>(
  '@consuelo/dialer/DialerTelemetry',
);
