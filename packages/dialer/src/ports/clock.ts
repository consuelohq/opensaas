import { Context, type Effect } from 'effect';

export type DialerClockService = {
  now: Effect.Effect<Date>;
  sleep: (milliseconds: number) => Effect.Effect<void>;
};

export const DialerClock = Context.GenericTag<DialerClockService>(
  '@consuelo/dialer/DialerClock',
);
