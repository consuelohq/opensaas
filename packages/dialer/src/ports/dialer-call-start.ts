import { Context, type Effect } from 'effect';

import type { DialerApplicationError } from '../errors/dialer-errors.js';
import type {
  PredictiveDecisionContext,
  PredictiveSourceContext,
} from '../types.js';

export type DialerCallSource = 'direct' | 'queue';
export type DialerCallSelectionStrategy = 'single' | 'predictive';
export type DialerScenarioCallMode = 'mock' | 'twilio-test' | 'live';
export type DialerCallStartStatus = 'mocked' | 'dialing';

export type StartDialerCallInput = {
  source: DialerCallSource;
  selectionStrategy: DialerCallSelectionStrategy;
  requestedFanout: number;
  targetPhone?: string | null;
  targetPhones?: string[] | null;
  contactId?: string | null;
  contactIds?: string[] | null;
  targetContexts?: Array<{
    contactId: string;
    context: PredictiveSourceContext;
  }> | null;
  queueId?: string | null;
  callerIdNumber?: string | null;
  preferLocalPresence?: boolean | null;
  callMode?: DialerScenarioCallMode | null;
};

export type DialerCallStartCapacity = {
  requestedFanout: number;
  callableTargetCount: number;
  availableCallerIdCount: number;
  reducedCapacityReasons: string[];
  blockedReasons: string[];
  actualFanout: number;
};

export type DialerCallStartCall = {
  callSid: string;
  contactId: string;
  customerNumber: string;
  callerId: string;
  status: string;
  position: number;
};

export type DialerCallStartResult = {
  sessionId: string;
  twilioGroupId: string | null;
  queueId: string;
  selectionStrategy: DialerCallSelectionStrategy;
  requestedFanout: number;
  actualFanout: number;
  status: DialerCallStartStatus;
  capacity: DialerCallStartCapacity;
  calls: DialerCallStartCall[];
};

export type CallableTarget = {
  contactId: string;
  phone: string;
  queueItemId?: string;
  sourceContext?: PredictiveSourceContext;
  predictiveDecisionId?: string;
  decisionContext?: PredictiveDecisionContext;
};

export type DialerCallContext = {
  workspaceId: string;
  userId: string;
};

export type DialerTargetRepositoryService = {
  resolveInputQueueId: (
    input: DialerCallContext & { input: StartDialerCallInput },
  ) => Effect.Effect<string, DialerApplicationError>;
  resolveDirectTargets: (
    input: DialerCallContext & { input: StartDialerCallInput },
  ) => Effect.Effect<CallableTarget[], DialerApplicationError>;
  resolveQueueTargets: (
    input: DialerCallContext & {
      queueId: string;
      requestedFanout: number;
      preferLocalPresence?: boolean;
      fallbackPhonesByContactId: ReadonlyMap<string, string>;
    },
  ) => Effect.Effect<CallableTarget[], DialerApplicationError>;
  createDirectQueue: (
    input: DialerCallContext & { contactIds: string[] },
  ) => Effect.Effect<string, DialerApplicationError>;
};

export const DialerTargetRepository =
  Context.GenericTag<DialerTargetRepositoryService>(
    '@consuelo/dialer/DialerTargetRepository',
  );

export type DialerCallRepositoryService = {
  createMockCalls: (
    input: DialerCallContext & {
      sessionId: string;
      queueId: string;
      targets: CallableTarget[];
      callerIds: string[];
    },
  ) => Effect.Effect<DialerCallStartCall[], DialerApplicationError>;
};

export const DialerCallRepository =
  Context.GenericTag<DialerCallRepositoryService>(
    '@consuelo/dialer/DialerCallRepository',
  );

export type DialerCallRuntimeService = {
  assertSafeTargetsAllowed: (
    input: DialerCallContext & { targets: CallableTarget[] },
  ) => Effect.Effect<void, DialerApplicationError>;
  resolveCallerIds: (
    input: DialerCallContext & {
      callerIdNumber?: string | null;
      callMode: DialerScenarioCallMode;
      enforceScenarioAllowlist: boolean;
      preferLocalPresence: boolean;
      targets: CallableTarget[];
    },
  ) => Effect.Effect<string[], DialerApplicationError>;
  initiateProviderCalls: (
    input: DialerCallContext & {
      sessionId: string;
      queueId: string;
      targets: CallableTarget[];
      callerIds: string[];
      callMode: DialerScenarioCallMode;
    },
  ) => Effect.Effect<
    { calls: DialerCallStartCall[]; twilioGroupId: string },
    DialerApplicationError
  >;
};

export const DialerCallRuntime = Context.GenericTag<DialerCallRuntimeService>(
  '@consuelo/dialer/DialerCallRuntime',
);
