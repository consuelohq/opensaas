import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

type TraceAnalyticsDbOptions = {
  home?: string;
  argv?: readonly string[];
  env?: Record<string, string | undefined>;
  exists?: (file: string) => boolean;
};

/**
 * Prefer the live Consuelo OS trace store; retain the historical OpenWorkspace
 * database as a fallback for older installations. Explicit configuration wins.
 */
export function resolveTraceAnalyticsDb(options: TraceAnalyticsDbOptions = {}): string {
  const home = options.home ?? homedir();
  const argv = options.argv ?? [];
  const env = options.env ?? process.env;
  const exists = options.exists ?? existsSync;
  const current = join(home, '.consuelo/node/db/traces.db');
  const legacy = join(
    home,
    'Library/Application Support/OpenWorkspace/traces/e8425497c3ee20bf0a28e9da/traces.db',
  );
  return env.TRACE_DB || argv.find((arg) => arg.startsWith('--db='))?.slice(5)
    || (exists(current) ? current : legacy);
}


export function traceWindowStartUtc(days: number, now: Date = new Date()): string {
  if (!Number.isInteger(days) || days < 1 || days > 3650 || !Number.isFinite(now.getTime())) {
    throw new Error('trace analytics requires a valid rolling-day UTC cutoff');
  }
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString();
}
