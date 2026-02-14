import {
  type CallAnalytics,
  type CallOutcome as CoachingOutcome,
} from './coaching';
import { type CallOutcome as QueueOutcome } from './queue';
import { type DialerContact } from './dialer';

// unified call outcome for history — superset of coaching + queue outcomes
export type HistoryCallOutcome = CoachingOutcome | QueueOutcome;

// single call in the history list
export type CallHistoryItem = {
  id: string;
  callSid: string;
  conferenceName: string | null;
  customerNumber: string;
  contact: Pick<DialerContact, 'id' | 'name' | 'company' | 'avatarUrl'> | null;
  outcome: HistoryCallOutcome | null;
  duration: number | null;
  startTime: string;
  endTime: string | null;
  hasRecording: boolean;
  hasTranscript: boolean;
  direction: 'outbound' | 'inbound';
  callingMode: 'browser' | 'phone';
  analysis: CallAnalytics | null;
};

// aggregated metrics for analytics dashboard (DEV-741)
export type CallMetrics = {
  totalCalls: number;
  answeredCalls: number;
  answerRate: number;
  avgDuration: number;
  callsToday: number;
  callsThisWeek: number;
  outcomeDistribution: Record<string, number>;
  dailyCounts: Array<{ date: string; count: number }>;
  topContacts: Array<{ id: string; name: string; callCount: number }>;
};

// history filter state
export type HistoryFilters = {
  outcome: HistoryCallOutcome | 'all';
  dateFrom: string | null;
  dateTo: string | null;
  contactId: string | null;
};
