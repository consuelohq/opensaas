import { Context, type Effect } from 'effect';

import type { DialerProviderError } from '../errors/dialer-errors.js';

export type CreateProviderCallInput = {
  to: string;
  from: string;
  customerTwimlUrl: string;
  statusCallbackUrl: string;
};

export type CallProviderService = {
  createCall: (
    input: CreateProviderCallInput,
  ) => Effect.Effect<{ callSid: string }, DialerProviderError>;
  terminateCall: (callSid: string) => Effect.Effect<void, DialerProviderError>;
  unmuteConferenceParticipant: (
    conferenceName: string,
    callSid: string,
  ) => Effect.Effect<void, DialerProviderError>;
};

export const CallProvider = Context.GenericTag<CallProviderService>(
  '@consuelo/dialer/CallProvider',
);
