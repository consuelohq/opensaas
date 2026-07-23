import { Context, type Effect } from 'effect';

export type DialerIdGeneratorService = {
  generateParallelGroupId: Effect.Effect<string>;
};

export const DialerIdGenerator = Context.GenericTag<DialerIdGeneratorService>(
  '@consuelo/dialer/DialerIdGenerator',
);
