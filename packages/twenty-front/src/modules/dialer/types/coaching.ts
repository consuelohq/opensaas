import { type CallStatus } from '@/dialer/types/dialer';
import { msg } from '@lingui/core/macro';

export interface TalkingPoints {
  product_or_option_name: string | null;
  details: string[];
  clarifying_questions: string[];
  objection_responses: Array<{ objection: string; response: string }>;
}

export interface TranscriptEntry {
  id: string;
  speaker: 'agent' | 'customer';
  text: string;
  timestamp: number;
  confidence: number;
}

export type TranscriptSnapshotMessage = {
  type: 'snapshot';
  entries: TranscriptEntry[];
  talkingPoints: TalkingPoints | null;
};

export type TranscriptBroadcastMessage = {
  type: 'transcript';
  entry: TranscriptEntry;
};

export type CoachingBroadcastMessage = {
  type: 'coaching';
  talkingPoints: TalkingPoints;
};

export type CoachingErrorBroadcastMessage = {
  type: 'coaching_error';
  message: string;
  rawText?: string;
};

export type CoachingStreamMessage =
  | TranscriptSnapshotMessage
  | TranscriptBroadcastMessage
  | CoachingBroadcastMessage
  | CoachingErrorBroadcastMessage;

export type CallOutcome =
  | 'interested'
  | 'not_interested'
  | 'callback_scheduled'
  | 'voicemail'
  | 'no_answer'
  | 'wrong_number'
  | 'other';

export type MomentType =
  | 'objection'
  | 'interest'
  | 'question'
  | 'commitment'
  | 'concern';

export type SentimentLabel = 'positive' | 'neutral' | 'negative';

export type SentimentTrajectory = 'improving' | 'stable' | 'declining';

export interface KeyMoment {
  timestamp: number;
  type: MomentType;
  text: string;
  speaker: 'agent' | 'customer';
}

export interface SentimentScore {
  overall: SentimentLabel;
  agentScore: number;
  customerScore: number;
  trajectory: SentimentTrajectory;
}

export interface CallAnalytics {
  id: string;
  callId: string;
  keyMoments: KeyMoment[];
  sentiment: SentimentScore;
  performanceScore: number;
  summary: string;
  duration: number;
  outcome: CallOutcome;
  nextSteps: string[];
  tokensUsed: { input: number; output: number };
  modelUsed: string;
  latencyMs: number;
  createdAt: string;
}

// maps call status to the empty-state message shown in the coaching panel
export const COACHING_EMPTY_MESSAGES: Partial<
  Record<CallStatus, ReturnType<typeof msg>>
> = {
  idle: msg`Start a call to receive coaching`,
  connecting: msg`Preparing coaching...`,
  active: msg`Analyzing conversation...`,
  ended: msg`Call ended`,
  failed: msg`Call failed — no coaching available`,
};
