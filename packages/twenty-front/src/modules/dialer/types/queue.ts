import {
  type CallingMode,
  type DialerContact,
  type ParallelCall,
} from '@/dialer/types/dialer';

// queue categories for filtering and organization
export type QueueCategory =
  | 'all'
  | 'leads'
  | 'customers'
  | 'prospects'
  | 'followup'
  | 'campaigns'
  | 'custom';

export type QueueStatus =
  | 'idle'
  | 'active'
  | 'paused'
  | 'completed'
  | 'stopped'
  | 'error';

export type QueueItemStatus =
  | 'pending'
  | 'calling'
  | 'completed'
  | 'skipped'
  | 'failed';

export type CallOutcome =
  | 'connected'
  | 'no-answer'
  | 'voicemail'
  | 'busy'
  | 'wrong-number'
  | 'callback-requested'
  | 'not-interested'
  | 'qualified'
  | 'dnc';

export interface QueueAggregatedStats {
  totalTimeSeconds: number;
  avgCallDurationSeconds: number;
  answeredCount: number;
  noAnswerCount: number;
  busyCount: number;
  voicemailCount: number;
  answerRatePercentage: number;
  callsPerHour: number;
}

export interface QueueSettings {
  autoAdvance: boolean;
  autoAdvanceDelay: number;
  skipNoAnswer: boolean;
  maxAttempts: number;
  callTimeout: number;
  voicemailSkipDelay: number;
  autoSkipVoicemail: boolean;
  parallelDialingEnabled: boolean;
  parallelDialingMaxLines: number;
  parallelDialingCooldown: number;
}

export interface CallQueue {
  id: string;
  name: string;
  description: string | null;
  sourceType: 'view' | 'list' | 'filter' | 'manual';
  sourceId: string | null;
  totalContacts: number;
  completedContacts: number;
  skippedContacts: number;
  status: QueueStatus;
  settings: QueueSettings;
  createdAt: string;
  updatedAt: string;
  startedAt: string | null;
  completedAt: string | null;
  category: QueueCategory;
  callingMode: CallingMode;
  dncFilteredCount: number;
  parallelDialingEnabled: boolean;
  parallelDialFromNumbers: string[];
  parallelDialingActive: boolean;
  parallelCurrentBatch: number;
  parallelGroupId: string | null;
  parallelActiveCalls: ParallelCall[];
  aggregatedStats: QueueAggregatedStats | null;
}

export interface QueueItem {
  id: string;
  queueId: string;
  contactId: string;
  contact: DialerContact;
  position: number;
  status: QueueItemStatus;
  attempts: number;
  lastAttemptAt: string | null;
  callOutcome: CallOutcome | null;
  notes: string | null;
  skipReason: string | null;
  callDurationSeconds: number | null;
}

export interface QueueSession {
  id: string;
  queueId: string;
  startedAt: string;
  endedAt: string | null;
  callsMade: number;
  callsConnected: number;
  totalTalkTime: number;
  avgCallDuration: number;
  outcomeBreakdown: Record<CallOutcome, number>;
}

export const DEFAULT_QUEUE_SETTINGS: QueueSettings = {
  autoAdvance: true,
  autoAdvanceDelay: 400,
  skipNoAnswer: false,
  maxAttempts: 3,
  callTimeout: 30,
  voicemailSkipDelay: 1000,
  autoSkipVoicemail: true,
  parallelDialingEnabled: false,
  parallelDialingMaxLines: 3,
  parallelDialingCooldown: 2000,
};

export const createQueue = (partial: Partial<CallQueue>): CallQueue => ({
  id: crypto.randomUUID(),
  name: '',
  description: null,
  sourceType: 'manual',
  sourceId: null,
  totalContacts: 0,
  completedContacts: 0,
  skippedContacts: 0,
  status: 'idle',
  settings: DEFAULT_QUEUE_SETTINGS,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  startedAt: null,
  completedAt: null,
  category: 'all',
  callingMode: 'browser',
  dncFilteredCount: 0,
  parallelDialingEnabled: false,
  parallelDialFromNumbers: [],
  parallelDialingActive: false,
  parallelCurrentBatch: 0,
  parallelGroupId: null,
  parallelActiveCalls: [],
  aggregatedStats: null,
  ...partial,
});
