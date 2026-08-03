import { Effect, Layer } from 'effect';

import {
  DialerProviderError,
  errorMessage,
} from '../../errors/dialer-errors.js';
import {
  CallProvider,
  type CallProviderService,
} from '../../ports/call-provider.js';
import type { TwilioCredentials } from '../../types.js';

type TwilioClient = import('twilio').Twilio;

const retryableProviderFailure = (cause: unknown): boolean => {
  if (typeof cause !== 'object' || cause === null || !('status' in cause)) {
    return true;
  }
  const status = (cause as { status?: unknown }).status;
  return typeof status !== 'number' || status === 429 || status >= 500;
};

const providerFailure = (
  operation: 'create-call' | 'terminate-call' | 'unmute-winner',
  cause: unknown,
): DialerProviderError =>
  new DialerProviderError({
    operation,
    message: errorMessage(cause),
    retryable: retryableProviderFailure(cause),
    cause,
  });

const asProviderFailure = (
  operation: 'create-call' | 'terminate-call' | 'unmute-winner',
  cause: unknown,
): DialerProviderError =>
  cause instanceof DialerProviderError
    ? cause
    : providerFailure(operation, cause);

export const createTwilioCallProviderLayer = (
  credentials: TwilioCredentials | undefined,
): Layer.Layer<CallProviderService> => {
  let client: TwilioClient | null = null;
  const resolved = {
    accountSid: credentials?.accountSid ?? process.env.TWILIO_ACCOUNT_SID ?? '',
    authToken: credentials?.authToken ?? process.env.TWILIO_AUTH_TOKEN ?? '',
  };

  const getClient = (): Promise<TwilioClient> => {
    if (client) return Promise.resolve(client);
    return import('twilio')
      .then(({ default: twilio }) => {
        client = twilio(resolved.accountSid, resolved.authToken);
        return client;
      })
      .catch((cause: unknown) => {
        client = null;
        throw cause;
      });
  };

  const service: CallProviderService = {
    createCall: (input) =>
      Effect.tryPromise({
        try: async () => {
          try {
            const twilio = await getClient();
            const call = await twilio.calls.create({
              to: input.to,
              from: input.from,
              url: input.customerTwimlUrl,
              statusCallback: input.statusCallbackUrl,
              statusCallbackEvent: [
                'initiated',
                'ringing',
                'answered',
                'completed',
              ],
              machineDetection: 'Enable',
            });
            return { callSid: call.sid };
          } catch (cause: unknown) {
            throw asProviderFailure('create-call', cause);
          }
        },
        catch: (cause) => asProviderFailure('create-call', cause),
      }),
    terminateCall: (callSid) =>
      Effect.tryPromise({
        try: async () => {
          try {
            const twilio = await getClient();
            await twilio.calls(callSid).update({ status: 'completed' });
          } catch (cause: unknown) {
            throw asProviderFailure('terminate-call', cause);
          }
        },
        catch: (cause) => asProviderFailure('terminate-call', cause),
      }),
    unmuteConferenceParticipant: (conferenceName, callSid) =>
      Effect.tryPromise({
        try: async () => {
          try {
            const twilio = await getClient();
            const conferences = await twilio.conferences.list({
              friendlyName: conferenceName,
              status: 'in-progress',
              limit: 1,
            });
            const conferenceSid = conferences[0]?.sid;
            if (!conferenceSid) throw new Error('Active conference not found');
            await twilio
              .conferences(conferenceSid)
              .participants(callSid)
              .update({ muted: false, endConferenceOnExit: true });
          } catch (cause: unknown) {
            throw asProviderFailure('unmute-winner', cause);
          }
        },
        catch: (cause) => asProviderFailure('unmute-winner', cause),
      }),
  };

  return Layer.succeed(CallProvider, service);
};
