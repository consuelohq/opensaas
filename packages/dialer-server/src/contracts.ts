import type {
  DialerApplicationError,
  DialerCallStartResult,
  MarkParallelAgentReadyResult,
  ParallelAgentTwimlInput,
  ParallelCallbackInput,
  ParallelCallbackResult,
  ParallelGroupStatusResult,
  ParallelTwimlInput,
  StartDialerCallCommand,
  VoiceToken,
} from '@consuelo/dialer';
import type {
  LeadConnectorContact,
  LeadConnectorEmbedIdentity,
  LeadConnectorError,
  LeadConnectorOpportunity,
  LeadConnectorPipeline,
  LeadConnectorWebhookProcessResult,
} from '@consuelo/lead-connector';
import type { Effect } from 'effect';

export type DialerIdentity = {
  workspaceId: string;
  userId: string;
  installationId?: string;
  locationId?: string;
};

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
  generateTwilioAgentTwiml: (
    input: ParallelAgentTwimlInput,
  ) => Effect.Effect<string, DialerApplicationError>;
  markAgentReady: (command: {
    sessionId: string;
    workspaceId: string;
  }) => Effect.Effect<MarkParallelAgentReadyResult, DialerApplicationError>;
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
  listContacts: (input: {
    workspaceId: string;
    query?: string;
    limit?: number;
    cursor?: string;
  }) => Effect.Effect<
    {
      contacts: LeadConnectorContact[];
      total: number;
      nextCursor: string | null;
    },
    LeadConnectorError
  >;
  searchOpportunities: (input: {
    workspaceId: string;
    query?: string;
    pipelineId?: string;
    stageId?: string;
    status?: string;
    limit?: number;
  }) => Effect.Effect<
    { opportunities: LeadConnectorOpportunity[]; total: number },
    LeadConnectorError
  >;
  listPipelines: (
    workspaceId: string,
  ) => Effect.Effect<LeadConnectorPipeline[], LeadConnectorError>;
  recordDisposition: (input: {
    workspaceId: string;
    contactId: string;
    disposition: string;
    note?: string;
    tags?: string[];
  }) => Effect.Effect<{ recorded: true }, LeadConnectorError>;
  exchangeEmbedBootstrap: (input: {
    encryptedData: string;
  }) => Effect.Effect<LeadConnectorEmbedIdentity, LeadConnectorError>;
  validateEmbedIdentity: (
    identity: LeadConnectorEmbedIdentity,
  ) => Effect.Effect<boolean, LeadConnectorError>;
};

export type DialerServerDependencies = {
  application: DialerServerApplication;
  authenticate: (request: Request) => Promise<DialerIdentity | null>;
  verifyTwilioSignature: (input: TwilioSignatureInput) => Promise<boolean>;
  issueVoiceToken?: (identity: DialerIdentity) => Promise<VoiceToken>;
  issueEmbedSession?: (
    identity: LeadConnectorEmbedIdentity,
  ) => Promise<{ token: string; expiresAt: string }>;
  leadConnector?: LeadConnectorServerApplication;
};
