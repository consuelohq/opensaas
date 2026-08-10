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
  if (isTerminalCallStatus(call.status)) return { ...call };

  const amdResult = normalizeAmdResult(event.answeredBy);
  return {
    ...call,
    status: event.callStatus,
    ...(amdResult ? { amdResult } : {}),
    ...(event.callStatus === 'in-progress'
      ? { answeredAt: event.occurredAt }
      : {}),
    ...(isTerminalCallStatus(event.callStatus)
      ? { terminatedAt: event.occurredAt }
      : {}),
  };
};
