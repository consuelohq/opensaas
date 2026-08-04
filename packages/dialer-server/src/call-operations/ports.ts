import type { DialerApplicationError } from '@consuelo/dialer';
import { Context, type Effect } from 'effect';

import type {
  CallDetail,
  CallLegTransition,
  CallSessionSummary,
  CallSessionUpsert,
  TranscriptSegment,
  TranscriptStatus,
  TranscriptTrack,
} from './contracts';

export type TranscriptionContext = {
  workspaceId: string;
  sessionId: string;
  enabled: boolean;
  language: string | null;
  retentionDays: number;
};

export type CallOperationsRepositoryService = {
  resolveTranscriptionSettings: (workspaceId: string) => Effect.Effect<
    {
      enabled: boolean;
      language: string | null;
      retentionDays: number;
    },
    DialerApplicationError
  >;
  resolveTranscriptionContextForSession: (
    sessionId: string,
  ) => Effect.Effect<TranscriptionContext | null, DialerApplicationError>;
  resolveTranscriptionContext: (
    providerCallId: string,
  ) => Effect.Effect<TranscriptionContext | null, DialerApplicationError>;
  setTranscriptStatus: (input: {
    workspaceId: string;
    sessionId: string;
    status: TranscriptStatus;
    provider?: string;
    model?: string;
    language?: string | null;
    failureCode?: string;
  }) => Effect.Effect<void, DialerApplicationError>;
  appendTranscriptSegment: (
    segment: TranscriptSegment,
  ) => Effect.Effect<{ inserted: boolean }, DialerApplicationError>;
  recoverInterruptedTranscriptions: () => Effect.Effect<
    number,
    DialerApplicationError
  >;
  createOrUpdateCallSession: (
    input: CallSessionUpsert,
  ) => Effect.Effect<void, DialerApplicationError>;
  recordCallLegTransition: (
    input: CallLegTransition,
  ) => Effect.Effect<void, DialerApplicationError>;
  listActiveCalls: (input: {
    workspaceId: string;
  }) => Effect.Effect<CallSessionSummary[], DialerApplicationError>;
  listCallHistory: (input: {
    workspaceId: string;
    status?: string;
    cursor?: string;
    limit: number;
  }) => Effect.Effect<
    { calls: CallSessionSummary[]; nextCursor: string | null },
    DialerApplicationError
  >;
  getCallDetail: (input: {
    workspaceId: string;
    callId: string;
  }) => Effect.Effect<CallDetail | null, DialerApplicationError>;
  getCallTranscript: (input: {
    workspaceId: string;
    callId: string;
  }) => Effect.Effect<TranscriptSegment[], DialerApplicationError>;
  recordDisposition: (input: {
    workspaceId: string;
    sessionId: string;
    disposition: string;
    note?: string;
    tags?: string[];
  }) => Effect.Effect<void, DialerApplicationError>;
  setCrmSyncStatus: (input: {
    workspaceId: string;
    sessionId: string;
    status: 'synced' | 'failed';
    errorCode?: string;
  }) => Effect.Effect<void, DialerApplicationError>;
};

export type SpeechToTextRequest = {
  audio: Uint8Array;
  encoding: 'audio/wav';
  track: TranscriptTrack;
  model: string;
  language?: string;
};

export type SpeechToTextResult = {
  text: string;
  language?: string | null;
  confidence?: number | null;
  startMs?: number | null;
  endMs?: number | null;
};

export type SpeechToTextProviderService = {
  transcribe: (
    input: SpeechToTextRequest,
  ) => Effect.Effect<SpeechToTextResult, Error>;
};

export const CallOperationsRepository =
  Context.GenericTag<CallOperationsRepositoryService>(
    '@consuelo/dialer-server/CallOperationsRepository',
  );

export const SpeechToTextProvider =
  Context.GenericTag<SpeechToTextProviderService>(
    '@consuelo/dialer-server/SpeechToTextProvider',
  );
