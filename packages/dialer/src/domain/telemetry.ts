import type { ParallelGroup, ParallelTelemetry } from '../types.js';

export const computeParallelTelemetry = (
  group: ParallelGroup,
): ParallelTelemetry => ({
  winnerRate: group.winnerSid ? 1 : 0,
  wastedLegs: Math.max(group.calls.length - (group.winnerSid ? 1 : 0), 0),
  connectLatencyMs: group.connectedAt
    ? Math.max(
        0,
        new Date(group.connectedAt).getTime() -
          new Date(group.createdAt).getTime(),
      )
    : null,
});
