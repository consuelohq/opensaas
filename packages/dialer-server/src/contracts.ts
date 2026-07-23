import type {
  DialerApplicationError,
  DialerCallStartResult,
  ParallelCallbackInput,
  ParallelCallbackResult,
  ParallelGroupStatusResult,
  ParallelTwimlInput,
  StartDialerCallCommand,
} from '@consuelo/dialer';
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

export type DialerServerDependencies = {
  application: DialerServerApplication;
  authenticate: (request: Request) => Promise<DialerIdentity | null>;
  verifyTwilioSignature: (input: TwilioSignatureInput) => Promise<boolean>;
};
