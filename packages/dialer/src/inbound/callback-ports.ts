import { Context, Effect } from 'effect';
import type {
  CallbackBookingRequest,
  CallbackBookingResult,
  CallbackConsentDecision,
  CallbackConsentRequest,
} from './callback-contracts.js';

export class CallbackPolicyPortError extends Error {
  readonly _tag = 'CallbackPolicyPortError';
}

export type CallbackConsentService = {
  readonly evaluate: (
    input: CallbackConsentRequest,
  ) => Effect.Effect<CallbackConsentDecision, CallbackPolicyPortError>;
};
export const CallbackConsent = Context.GenericTag<CallbackConsentService>(
  '@consuelo/dialer/CallbackConsent',
);

export type CallbackCalendarService = {
  readonly book: (
    input: CallbackBookingRequest,
  ) => Effect.Effect<CallbackBookingResult, CallbackPolicyPortError>;
  readonly cancel: (
    input: CallbackBookingRequest & { readonly providerReference: string },
  ) => Effect.Effect<CallbackBookingResult, CallbackPolicyPortError>;
};
export const CallbackCalendar = Context.GenericTag<CallbackCalendarService>(
  '@consuelo/dialer/CallbackCalendar',
);
