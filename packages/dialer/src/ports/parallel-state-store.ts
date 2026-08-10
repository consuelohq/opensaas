import { Context, type Effect } from 'effect';

import type { DialerStateError } from '../errors/dialer-errors.js';
import type { ParallelCall, ParallelGroup } from '../types.js';

export type ParallelStateStoreService = {
  setGroup: (
    group: ParallelGroup,
    ttlSeconds: number,
  ) => Effect.Effect<void, DialerStateError>;
  getGroup: (
    groupId: string,
  ) => Effect.Effect<ParallelGroup | null, DialerStateError>;
  registerCall: (
    groupId: string,
    call: ParallelCall,
    ttlSeconds: number,
  ) => Effect.Effect<void, DialerStateError>;
  getGroupIdForCall: (
    callSid: string,
  ) => Effect.Effect<string | null, DialerStateError>;
  claimWinner: (
    groupId: string,
    callSid: string,
    ttlSeconds: number,
  ) => Effect.Effect<boolean, DialerStateError>;
  getWinner: (
    groupId: string,
  ) => Effect.Effect<string | null, DialerStateError>;
  claimTelemetryEmission: (
    groupId: string,
    emittedAt: string,
    ttlSeconds: number,
  ) => Effect.Effect<boolean, DialerStateError>;
  withGroupLock: <A, E>(
    groupId: string,
    operation: Effect.Effect<A, E>,
  ) => Effect.Effect<A, E | DialerStateError>;
  deleteGroup: (groupId: string) => Effect.Effect<void, DialerStateError>;
};

export const ParallelStateStore = Context.GenericTag<ParallelStateStoreService>(
  '@consuelo/dialer/ParallelStateStore',
);
