import type {
  DialerApplicationError,
  DialerCallStartResult,
  ParallelCallbackInput,
  ParallelCallbackResult,
  ParallelGroupStatusResult,
  ParallelTwimlInput,
  StartDialerCallCommand,
} from '@consuelo/dialer';
import type {
  LeadConnectorError,
  LeadConnectorWebhookProcessResult,
} from '@consuelo/lead-connector';
import type { Effect } from 'effect';

export type DialerIdentity = { workspaceId: string; userId: string };

export type DialerServerApplication = {
  startCallSession: (
    command: StartDialerCallCommand,
  ) => Effect.Effect<DialerCallStartResult, DialerApplicationError>;
  getCallSession: (command: {
    sessionId: string;
    workspaceId: string;
  }) => Effect.Effect<ParallelGroupStatusResult, DialerApplicationError>;
  terminateCallSession: (command: {
    sessionId: string;
    workspaceId: string;
    userId: string;
  }) => Effect.Effect<
    { groupId: string; status: 'completed' },
    DialerApplicationError
  >;
  processTwilioStatus: (
    input: ParallelCallbackInput,
  ) => Effect.Effect<ParallelCallbackResult, DialerApplicationError>;
  generateTwilioCustomerTwiml: (
    input: ParallelTwimlInput,
  ) => Effect.Effect<string, DialerApplicationError>;
};

export type TwilioSignatureInput = {
  signature: string;
  url: string;
  contentType: string;
  rawBody: string;
  params: Record<string, string>;
};

export type LeadConnectorServerApplication = {
  beginOAuth: (input: {
    workspaceId: string;
  }) => Effect.Effect<
    { authorizationUrl: string; state: string },
    LeadConnectorError
  >;
  completeOAuth: (input: {
    code: string;
    state: string;
  }) => Effect.Effect<
    { workspaceId: string; locationId: string; connected: true },
    LeadConnectorError
  >;
  processWebhook: (input: {
    rawBody: string;
    headers: Record<string, string | undefined>;
  }) => Effect.Effect<LeadConnectorWebhookProcessResult, LeadConnectorError>;
};

export type DialerServerDependencies = {
  application: DialerServerApplication;
  authenticate: (request: Request) => Promise<DialerIdentity | null>;
  verifyTwilioSignature: (input: TwilioSignatureInput) => Promise<boolean>;
  leadConnector?: LeadConnectorServerApplication;
};
