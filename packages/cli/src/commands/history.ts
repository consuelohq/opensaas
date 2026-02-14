import type { Command } from 'commander';
import { apiGet, handleApiError } from '../api-client.js';
import { log, error, json, isJson } from '../output.js';
import { captureError } from '../sentry.js';

interface HistoryEntry {
  callSid: string;
  contactId?: string;
  contactName?: string;
  to: string;
  from: string;
  direction: 'outbound' | 'inbound';
  outcome: 'answered' | 'no-answer' | 'busy' | 'failed' | 'voicemail';
  duration: number;
  startedAt: string;
  endedAt: string;
}

interface TranscriptSegment {
  speaker: 'agent' | 'customer';
  text: string;
  timestamp: number;
}

interface HistoryDetail extends HistoryEntry {
  recordingUrl?: string;
  transcriptUrl?: string;
  transcript?: TranscriptSegment[];
  notes?: string;
  tags?: string[];
  coachingScore?: number;
  queueId?: string;
  transferredTo?: string;
}

interface HistoryStats {
  period: 'day' | 'week' | 'month';
  from: string;
  to: string;
  totalCalls: number;
  totalDuration: number;
  avgDuration: number;
  connectRate: number;
  outcomes: { answered: number; noAnswer: number; busy: number; failed: number; voicemail: number };
  byDay?: Array<{ date: string; calls: number; duration: number; connectRate: number }>;
}

const formatDuration = (seconds: number): string => {
  if (seconds < 60) return `0m ${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m < 60) return `${m}m ${String(s).padStart(2, '0')}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
};

const formatTimestamp = (seconds: number): string => {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
};

const historyErrorMessage = (data: unknown, ctx: Record<string, string>): string | null => {
  const code = (data as { error?: { code?: string } })?.error?.code;
  if (code === 'CALL_NOT_FOUND') return `call not found: ${ctx.callId ?? 'unknown'}`;
  return null;
};

const validPeriods = new Set(['day', 'week', 'month']);

const isValidDate = (value: string): boolean => !isNaN(Date.parse(value));

export const registerHistory = (program: Command): void => {
  const history = program
    .command('history')
    .description('call history and stats');

  history.command('list').description('list call history')
    .option('--limit <n>', 'max results', '20')
    .option('--from <date>', 'start date (ISO-8601 or YYYY-MM-DD)')
    .option('--to <date>', 'end date (ISO-8601 or YYYY-MM-DD)')
    .option('--outcome <outcome>', 'filter by outcome (answered|no-answer|busy|failed)')
    .action(historyList);

  history.command('get <call-id>').description('get full call detail')
    .action(historyGet);

  history.command('stats').description('aggregate call statistics')
    .option('--period <period>', 'aggregation period (day|week|month)', 'week')
    .option('--from <date>', 'start date')
    .option('--to <date>', 'end date')
    .action(historyStats);
};

const handle501 = (status: number): boolean => {
  if (status === 501) {
    error('not available yet — history commands require phase 5 (history + analytics API routes)');
    process.exit(1);
  }
  return false;
};

const historyList = async (opts: { limit: string; from?: string; to?: string; outcome?: string }): Promise<void> => {
  try {
    if (opts.from && !isValidDate(opts.from)) { error(`invalid date: ${opts.from}`); process.exit(1); }
    if (opts.to && !isValidDate(opts.to)) { error(`invalid date: ${opts.to}`); process.exit(1); }

    const query: Record<string, string> = { limit: opts.limit };
    if (opts.from) query.from = opts.from;
    if (opts.to) query.to = opts.to;
    if (opts.outcome) query.outcome = opts.outcome;

    const res = await apiGet<{ calls: HistoryEntry[]; total: number }>('/v1/history', query);
    handle501(res.status);
    if (!res.ok) handleApiError(res.status, res.data);

    if (isJson()) { json(res.data); return; }

    const { calls, total } = res.data;
    if (!calls.length) { log('no call history'); return; }

    log('date                 | contact          | to               | outcome    | duration');
    log('---------------------|------------------|------------------|------------|--------');
    for (const c of calls) {
      const date = c.startedAt.slice(0, 16).replace('T', ' ');
      const contact = (c.contactName ?? '').padEnd(16).slice(0, 16);
      const to = c.to.padEnd(16).slice(0, 16);
      const outcome = c.outcome.padEnd(10).slice(0, 10);
      log(`${date.padEnd(20)} | ${contact} | ${to} | ${outcome} | ${formatDuration(c.duration)}`);
    }
    log(`\n${calls.length} call${calls.length === 1 ? '' : 's'} (showing ${calls.length} of ${total})`);
  } catch (err: unknown) {
    captureError(err, { command: 'history list' });
    error(err instanceof Error ? err.message : 'failed to list history');
    process.exit(1);
  }
};

const historyGet = async (callId: string): Promise<void> => {
  try {
    const res = await apiGet<{ call: HistoryDetail }>(`/v1/history/${callId}`);
    handle501(res.status);
    if (!res.ok) {
      const msg = historyErrorMessage(res.data, { callId });
      if (msg) { error(msg); process.exit(1); }
      handleApiError(res.status, res.data);
    }

    if (isJson()) { json(res.data); return; }

    const c = res.data.call;
    log(`call:       ${c.callSid}`);
    if (c.contactName) log(`contact:    ${c.contactName} (${c.to})`);
    else log(`to:         ${c.to}`);
    log(`direction:  ${c.direction}`);
    log(`outcome:    ${c.outcome}`);
    log(`duration:   ${formatDuration(c.duration)}`);
    log(`started:    ${c.startedAt}`);
    log(`ended:      ${c.endedAt}`);
    if (c.recordingUrl) log(`recording:  ${c.recordingUrl}`);
    if (c.transcriptUrl) log(`transcript: ${c.transcriptUrl}`);
    if (c.coachingScore !== undefined) log(`coaching:   ${c.coachingScore}/100`);
    if (c.notes) log(`notes:      ${c.notes}`);
    if (c.queueId) log(`queue:      ${c.queueId}`);
    if (c.transferredTo) log(`transferred: ${c.transferredTo}`);

    if (c.transcript?.length) {
      log('\ntranscript:');
      for (const seg of c.transcript) {
        log(`  [${formatTimestamp(seg.timestamp)}] ${seg.speaker}: ${seg.text}`);
      }
    }
  } catch (err: unknown) {
    captureError(err, { command: 'history get' });
    error(err instanceof Error ? err.message : 'failed to get call detail');
    process.exit(1);
  }
};

const historyStats = async (opts: { period: string; from?: string; to?: string }): Promise<void> => {
  try {
    if (!validPeriods.has(opts.period)) { error(`invalid period: ${opts.period} — use day, week, or month`); process.exit(1); }
    if (opts.from && !isValidDate(opts.from)) { error(`invalid date: ${opts.from}`); process.exit(1); }
    if (opts.to && !isValidDate(opts.to)) { error(`invalid date: ${opts.to}`); process.exit(1); }

    const query: Record<string, string> = { period: opts.period };
    if (opts.from) query.from = opts.from;
    if (opts.to) query.to = opts.to;

    const res = await apiGet<{ stats: HistoryStats }>('/v1/history/stats', query);
    handle501(res.status);
    if (!res.ok) handleApiError(res.status, res.data);

    if (isJson()) { json(res.data); return; }

    const s = res.data.stats;
    log(`call stats (${s.period}: ${s.from} → ${s.to})\n`);
    log(`  total calls:    ${s.totalCalls}`);
    log(`  total duration: ${formatDuration(s.totalDuration)}`);
    log(`  avg duration:   ${formatDuration(s.avgDuration)}`);
    log(`  connect rate:   ${Math.round(s.connectRate * 100)}%`);
    log('');
    log('  outcomes:');
    const total = s.totalCalls || 1;
    log(`    answered:     ${s.outcomes.answered} (${Math.round((s.outcomes.answered / total) * 100)}%)`);
    log(`    no-answer:    ${s.outcomes.noAnswer} (${Math.round((s.outcomes.noAnswer / total) * 100)}%)`);
    log(`    busy:         ${s.outcomes.busy} (${Math.round((s.outcomes.busy / total) * 100)}%)`);
    log(`    voicemail:    ${s.outcomes.voicemail} (${Math.round((s.outcomes.voicemail / total) * 100)}%)`);
    log(`    failed:       ${s.outcomes.failed} (${Math.round((s.outcomes.failed / total) * 100)}%)`);
  } catch (err: unknown) {
    captureError(err, { command: 'history stats' });
    error(err instanceof Error ? err.message : 'failed to get stats');
    process.exit(1);
  }
};
