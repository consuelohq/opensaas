import { type CallStatus, type DialPadKey } from '@/dialer/types/dialer';

export const DIAL_PAD_KEYS: DialPadKey[] = [
  { digit: '1', letters: '' },
  { digit: '2', letters: 'ABC' },
  { digit: '3', letters: 'DEF' },
  { digit: '4', letters: 'GHI' },
  { digit: '5', letters: 'JKL' },
  { digit: '6', letters: 'MNO' },
  { digit: '7', letters: 'PQRS' },
  { digit: '8', letters: 'TUV' },
  { digit: '9', letters: 'WXYZ' },
  { digit: '*', letters: '' },
  { digit: '0', letters: '+' },
  { digit: '#', letters: '' },
];

export const STATUS_COLORS: Record<CallStatus, string> = {
  idle: '#22c55e',
  connecting: '#eab308',
  ringing: '#eab308',
  active: '#22c55e',
  ended: '#6b7280',
  failed: '#ef4444',
};

export const SIDEBAR_WIDTH = 400;

/** Twilio voice tokens expire at 60 min — refresh at 50 */
export const TOKEN_REFRESH_INTERVAL = 50 * 60 * 1000;

/** Max concurrent calls in parallel dialing */
export const PARALLEL_DIAL_COUNT = 3;

/** Stagger delay between parallel call legs (ms) */
export const PARALLEL_STAGGER_MS = 500;

/** Caller ID lock TTL (ms) */
export const CALLER_ID_LOCK_TTL = 5 * 60 * 1000;
