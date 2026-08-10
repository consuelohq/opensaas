import { Context, type Effect } from 'effect';

import type { DialerStateError } from '../errors/dialer-errors.js';

export type CallerIdLockStoreService = {
  acquire: (
    phoneNumber: string,
    userId: string,
    ownerId: string,
    ttlSeconds: number,
  ) => Effect.Effect<boolean, DialerStateError>;
  refresh: (
    phoneNumber: string,
    ownerId: string,
    ttlSeconds: number,
  ) => Effect.Effect<boolean, DialerStateError>;
  release: (
    phoneNumber: string,
    ownerId: string,
  ) => Effect.Effect<void, DialerStateError>;
};

export const CallerIdLockStore = Context.GenericTag<CallerIdLockStoreService>(
  '@consuelo/dialer/CallerIdLockStore',
);
