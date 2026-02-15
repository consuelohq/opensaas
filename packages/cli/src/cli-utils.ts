import { error } from './output.js';

// handle 501 Not Implemented from API routes in unbuilt phases
export const handle501 = (status: number, context: string): void => {
  if (status === 501) {
    error(`not available yet — this command requires ${context}`);
    process.exit(1);
  }
};

// format seconds into human-readable duration (e.g. "3m 05s", "1h 23m")
export const formatDuration = (seconds?: number): string => {
  if (!seconds) return '—';
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m < 60) return `${m}m ${String(s).padStart(2, '0')}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
};

// safely extract error code from API response data
// replaces unsafe `(data as { error?: ... })?.error?.code` pattern
export const getErrorCode = (data: unknown): string | undefined => {
  if (typeof data !== 'object' || data === null) return undefined;
  // HACK: narrowing from unknown requires intermediate cast
  const obj = data as Record<string, unknown>;
  if (typeof obj.error !== 'object' || obj.error === null) return undefined;
  // HACK: narrowing from unknown requires intermediate cast
  const err = obj.error as Record<string, unknown>;
  return typeof err.code === 'string' ? err.code : undefined;
};
