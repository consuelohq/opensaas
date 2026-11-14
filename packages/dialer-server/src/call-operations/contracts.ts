export type TranscriptStatus = 'pending' | 'processing' | 'ready' | 'failed';

export type TranscriptTrack = 'inbound' | 'outbound';

export type TranscriptSpeaker =
  'inbound' | 'outbound' | 'unknown' | 'customer' | 'representative';

export type TwilioMediaStartFrame = {
  event: 'start';
  sequenceNumber: string;
  streamSid: string;
  start: {
    streamSid: string;
    callSid: string;
    accountSid?: string;
    tracks?: TranscriptTrack[];
    mediaFormat?: { encoding: 'audio/x-mulaw'; sampleRate: 8000; channels: 1 };
    customParameters: Record<string, string>;
  };
};

export type TwilioMediaAudioFrame = {
  event: 'media';
  sequenceNumber: string;
  streamSid: string;
  media: {
    track: TranscriptTrack;
    chunk: string;
    timestamp: string;
    payload: string;
  };
};

export type TwilioMediaStopFrame = {
  event: 'stop';
  sequenceNumber: string;
  streamSid: string;
  stop: { accountSid?: string; callSid?: string };
};

export type TwilioMediaFrame =
  | { event: 'connected'; protocol: 'Call'; version: '1.0.0' }
  | TwilioMediaStartFrame
  | TwilioMediaAudioFrame
  | TwilioMediaStopFrame;

export type TranscriptSegment = {
  id: string;
  workspaceId: string;
  sessionId: string;
  providerCallId: string;
  sequence: number;
  idempotencyKey: string;
  track: TranscriptTrack;
  speaker: TranscriptSpeaker;
  text: string;
  startMs: number | null;
  endMs: number | null;
  language: string | null;
  confidence: number | null;
  provider: 'groq';
  model: string;
  createdAt: string;
  metadata?: {
    schemaVersion: 1;
    sourceAudioStartMs: number;
    sourceAudioEndMs: number;
    streamSid: string;
    timingBasis:
      'provider-words' | 'provider-segments' | 'provider' | 'unavailable';
    speakerProvenance: 'authenticated-leg' | 'unknown';
    words: Array<{ text: string; startMs: number; endMs: number }>;
    speechSegments: Array<{
      text: string;
      startMs: number;
      endMs: number;
      averageLogProbability?: number;
      noSpeechProbability?: number;
      compressionRatio?: number;
    }>;
    gapBefore?: { startMs: number; endMs: number };
    latency?: { bufferedAudioMs: number; queueMs: number; providerMs: number };
  };
};

export type CallLegSummary = {
  id?: string;
  providerCallId: string;
  contactId?: string | null;
  position?: number | null;
  callerIdentity?: string | null;
  status?: string | null;
  amdResult?: string | null;
  role?: 'active' | 'winner' | 'loser' | null;
  terminalOutcome?: string | null;
  durationSeconds?: number | null;
};

export type OpportunitySnapshot = {
  id?: string | null;
  status?: string | null;
  monetaryValue?: number | null;
  pipelineId?: string | null;
  stageId?: string | null;
};

export type CallSessionSummary = {
  id: string;
  workspaceId?: string;
  userId?: string | null;
  installationId?: string | null;
  locationId?: string | null;
  representative?: string | null;
  contactId?: string | null;
  contactName?: string | null;
  opportunityId?: string | null;
  queueId?: string | null;
  pipelineId?: string | null;
  stageId?: string | null;
  source?: 'direct' | 'queue' | string;
  selectionStrategy?: 'single' | 'predictive' | string;
  requestedFanout?: number | null;
  actualFanout?: number | null;
  status: string;
  disposition?: string | null;
  note?: string | null;
  tags?: string[];
  crmSyncStatus?: 'pending' | 'synced' | 'failed' | null;
  transcriptStatus?: TranscriptStatus | null;
  transcriptCoverage?:
    'pending' | 'complete' | 'partial' | 'unavailable' | 'disabled' | null;
  transcriptFailureCode?: string | null;
  transcriptProvider?: string | null;
  transcriptModel?: string | null;
  transcriptLanguage?: string | null;
  transcriptRetentionDays?: number | null;
  transcriptionEnabled?: boolean;
  recordingEnabled?: boolean;
  recordingStatus?:
    | 'pending'
    | 'starting'
    | 'in-progress'
    | 'completed'
    | 'absent'
    | 'failed'
    | null;
  recordingSid?: string | null;
  recordingDurationSeconds?: number | null;
  opportunity?: OpportunitySnapshot | null;
  startedAt?: string | null;
  answeredAt?: string | null;
  endedAt?: string | null;
  durationSeconds?: number | null;
  elapsedSeconds?: number;
  activeLineCount?: number;
  calls: CallLegSummary[];
};

export type CallDetail = CallSessionSummary & {
  currentOpportunity?: OpportunitySnapshot | null;
  transferEvents?: Array<{
    id: string;
    type:
      | 'transfer_initiated'
      | 'transfer_consulting'
      | 'transfer_completed'
      | 'transfer_cancelled'
      | 'transfer_failed';
    createdAt: string;
    metadata?: Record<string, unknown>;
  }>;
};

export type CallSessionUpsert = {
  id: string;
  workspaceId: string;
  userId: string;
  installationId?: string;
  locationId?: string;
  representativeName?: string;
  contactName?: string;
  source: string;
  selectionStrategy: string;
  requestedFanout: number;
  actualFanout: number;
  recordingEnabled?: boolean;
  transcriptionEnabled?: boolean;
  queueId?: string;
  pipelineId?: string;
  stageId?: string;
  contactId?: string;
  opportunityId?: string;
  opportunitySnapshot?: OpportunitySnapshot;
  status: string;
  startedAt: string;
  calls: Array<{
    providerCallId: string;
    providerAccountId?: string | null;
    contactId?: string;
    position: number;
    callerIdentity?: string;
    status: string;
  }>;
};

export type CallLegTransition = {
  providerCallId: string;
  workspaceId?: string;
  status: string;
  amdResult?: string;
  durationSeconds?: number;
  terminalOutcome?: string;
};
