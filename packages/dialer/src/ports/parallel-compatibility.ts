import { Context, type Effect } from 'effect';

import type { DialerApplicationError } from '../errors/dialer-errors.js';
import type { NumberPool } from '../services/local-presence.js';
import type {
  ParallelCall,
  ParallelDialOptions,
  ParallelDialProfile,
  ParallelDialResult,
  ParallelGroup,
  ParallelStrategyResolution,
  ParallelTelemetry,
  PhoneNumber,
  ProfileKey,
} from '../types.js';

export type ParallelCallbackInput = {
  callSid: string;
  callStatus: string;
  answeredBy?: string;
  callDuration?: string;
  dialCallDuration?: string;
};

export type ParallelCallbackResult = {
  received: true;
  groupId: string | null;
};

export type ParallelTelemetryRecord = {
  group: ParallelGroup;
  telemetry: ParallelTelemetry;
  success: boolean;
};

export type ParallelStrategyInput = {
  queueId: string;
  workspaceId: string;
  campaignSegment?: string;
  recentAnswerRate?: number;
  profileId?: ProfileKey;
};

export type ParallelCompatibilityRuntimeService = {
  normalizeCustomerNumber: (
    value: unknown,
  ) => Effect.Effect<string, DialerApplicationError>;
  resolveStrategy: (
    input: ParallelStrategyInput,
  ) => Effect.Effect<ParallelStrategyResolution, DialerApplicationError>;
  listNumbers: () => Effect.Effect<PhoneNumber[], DialerApplicationError>;
  resolveCallerId: (input: {
    customerNumber: string;
    pool: NumberPool;
  }) => Effect.Effect<string, DialerApplicationError>;
  acquireCallerIdLock: (input: {
    phoneNumber: string;
    userId: string;
    callSid: string;
  }) => Effect.Effect<boolean, DialerApplicationError>;
  transferCallerIdLock: (input: {
    phoneNumber: string;
    expectedCallSid: string;
    callSid: string;
  }) => Effect.Effect<boolean, DialerApplicationError>;
  refreshCallerIdLock: (
    call: ParallelCall,
  ) => Effect.Effect<void, DialerApplicationError>;
  releaseCallerIdLocks: (
    fromNumbers: string[],
  ) => Effect.Effect<void, DialerApplicationError>;
  initiateGroup: (
    options: ParallelDialOptions,
  ) => Effect.Effect<ParallelDialResult, DialerApplicationError>;
  terminateGroup: (
    groupId: string,
  ) => Effect.Effect<void, DialerApplicationError>;
  validateRequirements: (
    currentNumberCount: number,
    requiredFanout: number,
  ) => { valid: boolean; required: number; current: number; missing: number };
  handleStatusCallback: (
    input: Pick<ParallelCallbackInput, 'callSid' | 'callStatus' | 'answeredBy'>,
  ) => Effect.Effect<void, DialerApplicationError>;
  getGroupIdForCall: (
    callSid: string,
  ) => Effect.Effect<string | null, DialerApplicationError>;
  getGroup: (
    groupId: string,
  ) => Effect.Effect<ParallelGroup | null, DialerApplicationError>;
  getReleasableNumbers: (group: ParallelGroup) => string[];
  getGroupForWorkspace: (
    groupId: string,
    workspaceId: string,
  ) => Effect.Effect<ParallelGroup | null, DialerApplicationError>;
  generateCustomerTwiml: (
    callSid: string,
  ) => Effect.Effect<string | null, DialerApplicationError>;
  terminateGroupForWorkspace: (
    groupId: string,
    workspaceId: string,
  ) => Effect.Effect<boolean, DialerApplicationError>;
  retryPendingCleanup: (
    groupId: string,
  ) => Effect.Effect<
    { retried: number; remaining: number },
    DialerApplicationError
  >;
  claimTelemetryEmission: (
    groupId: string,
  ) => Effect.Effect<boolean, DialerApplicationError>;
  recordTelemetry: (
    record: ParallelTelemetryRecord,
  ) => Effect.Effect<void, DialerApplicationError>;
};

export const ParallelCompatibilityRuntime =
  Context.GenericTag<ParallelCompatibilityRuntimeService>(
    '@consuelo/dialer/ParallelCompatibilityRuntime',
  );

export type ParallelDialBody = {
  customerNumbers?: unknown;
  queueId?: unknown;
  contactIds?: unknown;
  profileId?: unknown;
  campaignSegment?: unknown;
  recentAnswerRate?: unknown;
};

export type ParallelDialCommand = {
  body: Record<string, unknown>;
  userId: string;
  workspaceId: string;
  callbackBaseUrl: string;
};

export type ValidateParallelDialCommand = {
  query: Record<string, string | undefined>;
  workspaceId: string;
};

export type ParallelGroupStatusResult = {
  groupId: string;
  conferenceName: string;
  status: string;
  winnerSid: string | null;
  winner: ParallelCall | null;
  calls: Array<{
    callSid: string;
    customerNumber: string;
    position: number;
    status: string;
    amdResult?: string;
    contactId?: string;
  }>;
};


export type ParallelAgentTwimlInput = {
  sessionId?: string;
  clientIdentity?: string;
};

export type MarkParallelAgentReadyCommand = {
  groupId: string;
  workspaceId: string;
};

export type MarkParallelAgentReadyResult = {
  groupId: string;
  status: string;
  remainingCleanup: number;
};

export type TerminateParallelGroupCommand = {
  groupId: string;
  userId: string;
  workspaceId: string;
};

export type ParallelTwimlInput = {
  callSid: string;
  callStatus?: string;
  answeredBy?: string;
  callDuration?: string;
  dialCallDuration?: string;
};

export type { ParallelDialProfile };
