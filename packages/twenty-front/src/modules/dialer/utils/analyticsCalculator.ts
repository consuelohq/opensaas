import {
  type CallOutcome,
  type QueueAggregatedStats,
  type QueueItem,
} from '@/dialer/types/queue';

export const calculateAggregatedStats = (
  items: QueueItem[],
  sessionStartedAt: string | null,
): QueueAggregatedStats => {
  const processed = items.filter(
    (i) => i.status === 'completed' || i.status === 'skipped',
  );

  const answeredCount = processed.filter(
    (i) => i.callOutcome === 'connected',
  ).length;
  const noAnswerCount = processed.filter(
    (i) => i.callOutcome === 'no-answer',
  ).length;
  const busyCount = processed.filter(
    (i) => i.callOutcome === 'busy',
  ).length;
  const voicemailCount = processed.filter(
    (i) => i.callOutcome === 'voicemail',
  ).length;

  const totalCalls = processed.filter((i) => i.callOutcome !== null).length;
  const answerRatePercentage = totalCalls
    ? Math.round((answeredCount / totalCalls) * 100)
    : 0;

  // avg duration excludes no-answer calls
  const durations = processed
    .filter((i) => i.callDurationSeconds !== null && i.callDurationSeconds > 0)
    .map((i) => i.callDurationSeconds as number);
  const avgCallDurationSeconds = durations.length
    ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
    : 0;

  const totalTimeSeconds = sessionStartedAt
    ? Math.round((Date.now() - new Date(sessionStartedAt).getTime()) / 1000)
    : 0;

  const hours = totalTimeSeconds / 3600;
  const callsPerHour = hours > 0 ? Math.round(totalCalls / hours) : 0;

  return {
    totalTimeSeconds,
    avgCallDurationSeconds,
    answeredCount,
    noAnswerCount,
    busyCount,
    voicemailCount,
    answerRatePercentage,
    callsPerHour,
  };
};

export const calculateOutcomeBreakdown = (
  items: QueueItem[],
): Record<CallOutcome, number> => {
  const breakdown: Record<CallOutcome, number> = {
    'connected': 0,
    'no-answer': 0,
    'voicemail': 0,
    'busy': 0,
    'wrong-number': 0,
    'callback-requested': 0,
    'not-interested': 0,
    'qualified': 0,
    'dnc': 0,
  };

  for (const item of items) {
    if (item.callOutcome) {
      breakdown[item.callOutcome]++;
    }
  }

  return breakdown;
};

export const formatDurationHuman = (seconds: number): string => {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
};
