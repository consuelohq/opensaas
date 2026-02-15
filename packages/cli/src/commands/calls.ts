import type { Command } from 'commander';
import { apiGet, apiPost, handleApiError } from '../api-client.js';
import { handle501, formatDuration } from '../cli-utils.js';
import { log, error, json, isJson } from '../output.js';
import { captureError } from '../sentry.js';

interface Call {
  callSid: string;
  to: string;
  from: string;
  status: 'initiated' | 'ringing' | 'in-progress' | 'completed' | 'failed' | 'no-answer' | 'busy';
  direction: 'outbound' | 'inbound';
  duration?: number;
  startedAt?: string;
  endedAt?: string;
  recordingUrl?: string;
}

export const registerCalls = (program: Command): void => {
  const calls = program
    .command('calls')
    .description('manage calls');

  calls
    .command('list')
    .description('list recent calls')
    .option('--limit <n>', 'max results', '20')
    .option('--status <status>', 'filter by status (active|completed|failed)')
    .action(callsList);

  calls
    .command('get <id>')
    .description('get call details')
    .action(callsGet);

  calls
    .command('start <target>')
    .description('start a call (phone number or contact ID)')
    .option('--caller-id <number>', 'outbound caller ID (E.164)')
    .option('--local-presence', 'auto-select local number')
    .action(callsStart);

  calls
    .command('end <id>')
    .description('end an active call')
    .action(callsEnd);

  calls
    .command('transfer <id>')
    .description('transfer an active call')
    .requiredOption('--to <target>', 'transfer target (phone or agent ID)')
    .option('--type <type>', 'transfer type', 'blind')
    .action(callsTransfer);
};

const E164_RE = /^\+[1-9]\d{1,14}$/;

const callsList = async (opts: { limit: string; status?: string }): Promise<void> => {
  try {
    const query: Record<string, string> = { limit: opts.limit };
    if (opts.status) query.status = opts.status;

    const res = await apiGet<{ calls: Call[] }>('/v1/calls', query);
    handle501(res.status, 'dialer API routes (phase 2)');
    if (!res.ok) handleApiError(res.status, res.data);

    if (isJson()) { json(res.data); return; }

    const { calls } = res.data;
    if (!calls.length) { log('no calls found'); return; }

    log('sid                  | to               | from             | status      | duration');
    log('---------------------|------------------|------------------|-------------|--------');
    for (const c of calls) {
      const sid = c.callSid.padEnd(20).slice(0, 20);
      const to = c.to.padEnd(16).slice(0, 16);
      const from = c.from.padEnd(16).slice(0, 16);
      const status = c.status.padEnd(11).slice(0, 11);
      log(`${sid} | ${to} | ${from} | ${status} | ${formatDuration(c.duration)}`);
    }
    log(`\n${calls.length} call${calls.length === 1 ? '' : 's'}`);
  } catch (err: unknown) {
    captureError(err, { command: 'calls list' });
    error(err instanceof Error ? err.message : 'failed to list calls');
    process.exit(1);
  }
};

const callsGet = async (id: string): Promise<void> => {
  try {
    const res = await apiGet<{ call: Call }>(`/v1/calls/${id}`);
    handle501(res.status, 'dialer API routes (phase 2)');
    if (!res.ok) handleApiError(res.status, res.data);

    if (isJson()) { json(res.data); return; }

    const c = res.data.call;
    log(`sid:       ${c.callSid}`);
    log(`to:        ${c.to}`);
    log(`from:      ${c.from}`);
    log(`status:    ${c.status}`);
    log(`duration:  ${formatDuration(c.duration)}`);
    if (c.startedAt) log(`started:   ${c.startedAt}`);
    if (c.endedAt) log(`ended:     ${c.endedAt}`);
    if (c.recordingUrl) log(`recording: ${c.recordingUrl}`);
  } catch (err: unknown) {
    captureError(err, { command: 'calls get' });
    error(err instanceof Error ? err.message : 'failed to get call');
    process.exit(1);
  }
};

const callsStart = async (target: string, opts: { callerId?: string; localPresence?: boolean }): Promise<void> => {
  try {
    if (opts.callerId && !E164_RE.test(opts.callerId)) {
      error(`invalid caller ID: ${opts.callerId} — expected E.164 format (e.g. +15551234567)`);
      process.exit(1);
    }

    const body: Record<string, unknown> = { to: target };
    if (opts.callerId) body.callerIdNumber = opts.callerId;
    if (opts.localPresence) body.localPresence = true;

    const res = await apiPost<{ callSid: string; status: string }>('/v1/calls', body);
    handle501(res.status, 'dialer API routes (phase 2)');
    if (!res.ok) handleApiError(res.status, res.data);

    if (isJson()) { json(res.data); return; }

    log(`call started: ${res.data.callSid} → ${target}`);
  } catch (err: unknown) {
    captureError(err, { command: 'calls start' });
    error(err instanceof Error ? err.message : 'call failed');
    process.exit(1);
  }
};

const callsEnd = async (id: string): Promise<void> => {
  try {
    const res = await apiPost<{ callSid: string; status: string }>(`/v1/calls/${id}/hangup`);
    handle501(res.status, 'dialer API routes (phase 2)');
    if (!res.ok) handleApiError(res.status, res.data);

    if (isJson()) { json(res.data); return; }

    log(`call ended: ${id}`);
  } catch (err: unknown) {
    captureError(err, { command: 'calls end' });
    error(err instanceof Error ? err.message : 'could not end call');
    process.exit(1);
  }
};

const callsTransfer = async (id: string, opts: { to: string; type: string }): Promise<void> => {
  try {
    const res = await apiPost<{ transferId: string; status: string }>(`/v1/calls/${id}/transfer`, {
      to: opts.to,
      type: opts.type,
    });
    handle501(res.status, 'dialer API routes (phase 2)');
    if (!res.ok) handleApiError(res.status, res.data);

    if (isJson()) { json(res.data); return; }

    log(`transfer initiated: ${opts.type} → ${opts.to}`);
  } catch (err: unknown) {
    captureError(err, { command: 'calls transfer' });
    error(err instanceof Error ? err.message : 'transfer failed');
    process.exit(1);
  }
};
