import {
  DialerRequestError,
  type ParallelDialOptions,
  type TwilioCredentials,
} from '@consuelo/dialer';

export const TWILIO_TEST_FROM_NUMBER = '+15005550006' as const;

type ProviderCallMode = 'mock' | 'twilio-test' | 'live';
type CredentialMode = Exclude<ProviderCallMode, 'mock'>;
type ProviderEnvironment = Record<string, string | undefined>;

type ProviderGroupInput = {
  workspaceId: string;
  queueId: string;
  userId: string;
  targets: Array<{ contactId: string; phone: string }>;
  callerIds: string[];
};

const requiredCredential = (
  environment: ProviderEnvironment,
  name: string,
): string => {
  const value = environment[name]?.trim();
  if (!value) {
    throw new DialerRequestError({
      code: 'PROVIDER_CREDENTIALS_REQUIRED',
      message: `${name} is required`,
      retryable: false,
    });
  }
  return value;
};

export const resolveTwilioProviderCredentials = (
  environment: ProviderEnvironment,
  mode: CredentialMode,
): TwilioCredentials => {
  const prefix = mode === 'twilio-test' ? 'TWILIO_TEST' : 'TWILIO';
  return {
    accountSid: requiredCredential(environment, `${prefix}_ACCOUNT_SID`),
    authToken: requiredCredential(environment, `${prefix}_AUTH_TOKEN`),
  };
};

export const resolveProviderCallerId = (
  mode: ProviderCallMode,
  explicitCallerId: string | null | undefined,
): string | undefined => {
  if (mode !== 'twilio-test') return explicitCallerId ?? undefined;
  if (!explicitCallerId) {
    throw new DialerRequestError({
      code: 'TEST_CALLER_ID_REQUIRED',
      message: 'Provider test mode requires an explicit caller ID',
      retryable: false,
    });
  }
  if (explicitCallerId !== TWILIO_TEST_FROM_NUMBER) {
    throw new DialerRequestError({
      code: 'INVALID_TEST_CALLER_ID',
      message: 'Provider test mode requires the Twilio test caller ID',
      retryable: false,
    });
  }
  return explicitCallerId;
};

export const buildProviderGroupOptions = (
  input: ProviderGroupInput,
  publicUrl: string,
): ParallelDialOptions => ({
  workspaceId: input.workspaceId,
  customerNumbers: input.targets.map((target) => target.phone),
  queueId: input.queueId,
  contactIds: input.targets.map((target) => target.contactId),
  userId: input.userId,
  fromNumbers: [...input.callerIds],
  statusCallbackUrl: `${publicUrl}/webhooks/twilio/status`,
  customerTwimlUrl: `${publicUrl}/webhooks/twilio/customer-twiml`,
  profile: {
    id: 'balanced',
    fanout: input.targets.length,
    staggerMs: 500,
    amdPolicy: 'human-or-unknown',
    terminationPolicy: 'winner-take-all',
  },
});

export const describeProviderModeEvidence = (mode: ProviderCallMode) => ({
  carrierCallExpected: mode === 'live',
  callbacksExpected: mode === 'live',
});
