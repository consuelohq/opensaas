import type { Command } from 'commander';
import { apiGet, apiPost, apiDelete, handleApiError } from '../api-client.js';
import { handle501 } from '../cli-utils.js';
import { log, error, json, isJson } from '../output.js';
import { captureError } from '../sentry.js';

interface QueueResult {
  contactId: string;
  callSid?: string;
  outcome?: string;
  attemptedAt: string;
}

interface Queue {
  id: string;
  name: string;
  contactIds: string[];
  ordering: 'sequential' | 'round-robin' | 'priority';
  currentIndex: number;
  status: 'idle' | 'active' | 'paused' | 'completed';
  results: QueueResult[];
  createdAt: string;
}

interface QueueProgress {
  total: number;
  completed: number;
  remaining: number;
  currentContact?: string;
  mode: 'power' | 'preview';
  stats: { answered: number; noAnswer: number; busy: number; failed: number };
}

export const registerQueue = (program: Command): void => {
  const queue = program
    .command('queue')
    .description('manage dialer queue');

  queue.command('list').description('list all queues')
    .option('--status <status>', 'filter by status (idle|active|paused|completed)')
    .action(queueList);

  queue.command('status [id]').description('show queue status (default: active queue)')
    .action(queueStatus);

  queue.command('create').description('create a new queue')
    .requiredOption('--name <name>', 'queue name')
    .option('--contacts <ids>', 'comma-separated contact IDs')
    .option('--ordering <type>', 'ordering strategy', 'sequential')
    .action(queueCreate);

  queue.command('start [id]').description('start dialing a queue')
    .option('--mode <mode>', 'dialing mode (power|preview)', 'power')
    .action(queueStart);

  queue.command('pause [id]').description('pause the active queue').action(queuePause);
  queue.command('resume [id]').description('resume a paused queue').action(queueResume);
  queue.command('stop [id]').description('stop and complete a queue').action(queueStop);

  queue.command('add <queue-id> <contact-id>').description('add a contact to a queue')
    .option('--priority <level>', 'priority (high|normal|low)', 'normal')
    .action(queueAdd);

  queue.command('remove <queue-id> <contact-id>').description('remove a contact from a queue')
    .action(queueRemove);
};

const formatProgress = (q: Queue): string => {
  const total = q.contactIds.length;
  const completed = q.currentIndex;
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
  return `${completed}/${total} (${pct}%)`;
};

const queueList = async (opts: { status?: string }): Promise<void> => {
  try {
    const query: Record<string, string> = {};
    if (opts.status) query.status = opts.status;

    const res = await apiGet<{ queues: Queue[] }>('/v1/queue', query);
    handle501(res.status, 'queue API routes (phase 4)');
    if (!res.ok) handleApiError(res.status, res.data);

    if (isJson()) { json(res.data); return; }

    const { queues } = res.data;
    if (!queues.length) { log('no queues'); return; }

    log('id          | name              | status   | progress    | ordering');
    log('------------|-------------------|----------|-------------|----------');
    for (const q of queues) {
      const id = q.id.padEnd(11).slice(0, 11);
      const name = q.name.padEnd(17).slice(0, 17);
      const status = q.status.padEnd(8).slice(0, 8);
      const progress = formatProgress(q).padEnd(11).slice(0, 11);
      log(`${id} | ${name} | ${status} | ${progress} | ${q.ordering}`);
    }
    log(`\n${queues.length} queue${queues.length === 1 ? '' : 's'}`);
  } catch (err: unknown) {
    captureError(err, { command: 'queue list' });
    error(err instanceof Error ? err.message : 'failed to list queues');
    process.exit(1);
  }
};

const queueStatus = async (id?: string): Promise<void> => {
  try {
    const path = id ? `/v1/queue/${id}` : '/v1/queue/active';
    const res = await apiGet<{ queue: Queue; progress: QueueProgress }>(path);
    handle501(res.status, 'queue API routes (phase 4)');
    if (!res.ok) handleApiError(res.status, res.data);

    if (isJson()) { json(res.data); return; }

    const { queue: q, progress: p } = res.data;
    const pct = p.total > 0 ? Math.round((p.completed / p.total) * 100) : 0;
    log(`queue:      ${q.name} (${q.id})`);
    log(`status:     ${q.status}`);
    log(`mode:       ${p.mode}`);
    log(`progress:   ${p.completed}/${p.total} (${pct}%)`);
    if (p.currentContact) log(`current:    ${p.currentContact}`);
    log(`ordering:   ${q.ordering}`);
    log('');
    log('results:');
    log(`  answered:   ${p.stats.answered}`);
    log(`  no-answer:  ${p.stats.noAnswer}`);
    log(`  busy:       ${p.stats.busy}`);
    log(`  failed:     ${p.stats.failed}`);
  } catch (err: unknown) {
    captureError(err, { command: 'queue status' });
    error(err instanceof Error ? err.message : 'failed to get queue status');
    process.exit(1);
  }
};

const queueCreate = async (opts: { name: string; contacts?: string; ordering: string }): Promise<void> => {
  try {
    const body: Record<string, unknown> = { name: opts.name, ordering: opts.ordering };
    if (opts.contacts) body.contactIds = opts.contacts.split(',').map((s: string) => s.trim());

    const res = await apiPost<{ queue: Queue }>('/v1/queue', body);
    handle501(res.status, 'queue API routes (phase 4)');
    if (!res.ok) handleApiError(res.status, res.data);

    if (isJson()) { json(res.data); return; }

    const q = res.data.queue;
    log(`created: ${q.name} (${q.contactIds.length} contacts, ${q.ordering})`);
  } catch (err: unknown) {
    captureError(err, { command: 'queue create' });
    error(err instanceof Error ? err.message : 'failed to create queue');
    process.exit(1);
  }
};

const queueStart = async (id?: string, opts?: { mode: string }): Promise<void> => {
  try {
    const queueId = id ?? 'active';
    const mode = opts?.mode ?? 'power';
    const res = await apiPost<{ queue: Queue }>(`/v1/queue/${queueId}/start`, { mode });
    handle501(res.status, 'queue API routes (phase 4)');
    if (!res.ok) handleApiError(res.status, res.data);

    if (isJson()) { json(res.data); return; }

    const q = res.data.queue;
    log(`queue started: ${q.name} (${mode} mode, ${q.contactIds.length} contacts)`);
  } catch (err: unknown) {
    captureError(err, { command: 'queue start' });
    error(err instanceof Error ? err.message : 'failed to start queue');
    process.exit(1);
  }
};

const queuePause = async (id?: string): Promise<void> => {
  try {
    const queueId = id ?? 'active';
    const res = await apiPost<{ queue: Queue }>(`/v1/queue/${queueId}/pause`);
    handle501(res.status, 'queue API routes (phase 4)');
    if (!res.ok) handleApiError(res.status, res.data);

    if (isJson()) { json(res.data); return; }

    const q = res.data.queue;
    log(`queue paused: ${q.name} (${formatProgress(q)} completed)`);
  } catch (err: unknown) {
    captureError(err, { command: 'queue pause' });
    error(err instanceof Error ? err.message : 'failed to pause queue');
    process.exit(1);
  }
};

const queueResume = async (id?: string): Promise<void> => {
  try {
    const queueId = id ?? 'active';
    const res = await apiPost<{ queue: Queue }>(`/v1/queue/${queueId}/resume`);
    handle501(res.status, 'queue API routes (phase 4)');
    if (!res.ok) handleApiError(res.status, res.data);

    if (isJson()) { json(res.data); return; }

    log(`queue resumed: ${res.data.queue.name}`);
  } catch (err: unknown) {
    captureError(err, { command: 'queue resume' });
    error(err instanceof Error ? err.message : 'failed to resume queue');
    process.exit(1);
  }
};

const queueStop = async (id?: string): Promise<void> => {
  try {
    const queueId = id ?? 'active';
    const res = await apiPost<{ queue: Queue }>(`/v1/queue/${queueId}/stop`);
    handle501(res.status, 'queue API routes (phase 4)');
    if (!res.ok) handleApiError(res.status, res.data);

    if (isJson()) { json(res.data); return; }

    const q = res.data.queue;
    log(`queue stopped: ${q.name} (${formatProgress(q)} completed)`);
  } catch (err: unknown) {
    captureError(err, { command: 'queue stop' });
    error(err instanceof Error ? err.message : 'failed to stop queue');
    process.exit(1);
  }
};

const queueAdd = async (queueId: string, contactId: string, opts: { priority: string }): Promise<void> => {
  try {
    const res = await apiPost<{ queue: Queue }>(`/v1/queue/${queueId}/contacts`, {
      contactId,
      priority: opts.priority,
    });
    handle501(res.status, 'queue API routes (phase 4)');
    if (!res.ok) handleApiError(res.status, res.data);

    if (isJson()) { json(res.data); return; }

    const q = res.data.queue;
    log(`added ${contactId} to ${q.name} (${q.contactIds.length} contacts)`);
  } catch (err: unknown) {
    captureError(err, { command: 'queue add' });
    error(err instanceof Error ? err.message : 'failed to add contact to queue');
    process.exit(1);
  }
};

const queueRemove = async (queueId: string, contactId: string): Promise<void> => {
  try {
    const res = await apiDelete<{ removed: boolean }>(`/v1/queue/${queueId}/contacts/${contactId}`);
    handle501(res.status, 'queue API routes (phase 4)');
    if (!res.ok) handleApiError(res.status, res.data);

    if (isJson()) { json(res.data); return; }

    log(`removed ${contactId} from queue ${queueId}`);
  } catch (err: unknown) {
    captureError(err, { command: 'queue remove' });
    error(err instanceof Error ? err.message : 'failed to remove contact from queue');
    process.exit(1);
  }
};
