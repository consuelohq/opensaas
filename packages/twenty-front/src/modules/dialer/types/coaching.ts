import { type CallStatus } from '@/dialer/types/dialer';

export interface TalkingPoints {
  product_or_option_name: string | null;
  details: string[];
  clarifying_questions: string[];
}

export interface TranscriptEntry {
  id: string;
  speaker: 'agent' | 'customer';
  text: string;
  timestamp: number;
  confidence: number;
}

// maps call status to the empty-state message shown in the coaching panel
export const COACHING_EMPTY_MESSAGES: Partial<Record<CallStatus, string>> = {
  idle: 'Start a call to receive coaching',
  connecting: 'Preparing coaching...',
  active: 'Analyzing conversation...',
  ended: 'Call ended',
  failed: 'Call failed — no coaching available',
};
