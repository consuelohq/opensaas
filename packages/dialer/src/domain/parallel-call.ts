import type { AmdResult, ParallelCall } from '../types.js';

export const TERMINAL_CALL_STATUSES = new Set([
  'completed',
  'failed',
  'busy',
  'no-answer',
  'canceled',
]);

export const isTerminalCallStatus = (status: string): boolean =>
  TERMINAL_CALL_STATUSES.has(status);

// Provider callbacks may arrive late or out of order. Terminal events can
// close any nonterminal leg, but nonterminal progress must never run backward.
const PROGRESS_ORDER: Record<string, number> = {
  queued: 0,
  dialing: 1,
  initiated: 1,
  ringing: 2,
  'in-progress': 3,
};

export const isStaleProviderCallStatus = (
  current: string,
  incoming: string,
): boolean => {
  if (isTerminalCallStatus(incoming)) return false;
  const next = PROGRESS_ORDER[incoming];
  if (next === undefined) return true; // Do not replace known state with unknown progress.
  const previous = PROGRESS_ORDER[current];
  return previous !== undefined && next < previous;
};

export const normalizeAmdResult = (
  answeredBy: string | undefined,
): AmdResult | undefined => {
  if (!answeredBy) return undefined;
  if (answeredBy === 'human') return 'human';
  if (answeredBy === 'unknown') return 'unknown';
  return 'machine';
};

export type ProviderCallStatusEvent = {
  callStatus: string;
  answeredBy?: string;
  occurredAt: string;
};

export const applyProviderCallStatus = (
  call: ParallelCall,
  event: ProviderCallStatusEvent,
): ParallelCall => {
  if (
    isTerminalCallStatus(call.status) ||
    isStaleProviderCallStatus(call.status, event.callStatus)
  ) return { ...call };

  // Preserve a confirmed human classification against contradictory late AMD.
  const amdResult =
    call.amdResult === 'human'
      ? 'human'
      : normalizeAmdResult(event.answeredBy) ?? call.amdResult;
  return {
    ...call,
    status: event.callStatus,
    ...(amdResult ? { amdResult } : {}),
    ...(event.callStatus === 'in-progress'
      ? { answeredAt: call.answeredAt ?? event.occurredAt }
      : {}),
    ...(isTerminalCallStatus(event.callStatus)
      ? { terminatedAt: event.occurredAt }
      : {}),
  };
};
