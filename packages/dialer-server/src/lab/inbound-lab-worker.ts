import { Pool } from 'pg';
import type { InboundStoredCommand } from '@consuelo/dialer';
import { createPostgresInboundJournal } from '../inbound/postgres-journal';
import {
  decodeWorkerInput,
  readLabLines,
  type LabCheckpoint,
  type LabWorkerMessage,
} from './inbound-worker-protocol';

const main = async () => {
  if (process.env.CONSUELO_RD2_ISOLATED_WORKER !== '1')
    throw new Error('Lab worker is not a production entry point');
  const lines = readLabLines(Bun.stdin.stream());
  const receive = async () => {
    try {
      const next = await lines.next();
      if (next.done) throw new Error('Lab controller disconnected');
      return next.value;
    } catch (cause: unknown) {
      throw new Error('Lab worker input failed', { cause });
    }
  };
  const emit = (message: LabWorkerMessage) =>
    process.stdout.write(JSON.stringify(message) + '\n');
  const waitForGo = async () => {
    if ((await receive()) !== 'go')
      throw new Error('Expected controller barrier');
  };
  const checkpoint = async (name: LabCheckpoint) => {
    emit({ type: 'checkpoint', checkpoint: name });
    await waitForGo();
  };
  const input = decodeWorkerInput(await receive());
  const pool = new Pool({
    connectionString: input.databaseUrl,
    max: 1,
    connectionTimeoutMillis: 3_000,
  });
  const journal = createPostgresInboundJournal(pool);
  const provider = async (
    operation: 'execute' | 'inspect',
    commandId: string,
  ) => {
    emit({ type: 'provider', operation, commandId });
    const outcome = await receive();
    if (!['succeeded', 'failed', 'unknown', 'absent'].includes(String(outcome)))
      throw new Error('Invalid simulated provider outcome');
    return outcome;
  };
  try {
    await pool.query('SELECT 1');
    emit({ type: 'ready' });
    await waitForGo();
    if (input.action === 'commit') {
      await checkpoint('before_commit');
      try {
        const result = await journal.commit(input.commit!);
        await checkpoint('after_commit');
        emit({
          type: 'result',
          result: result.duplicate ? 'duplicate' : 'committed',
        });
      } catch {
        emit({ type: 'result', result: 'rejected' });
      }
      return;
    }
    let command: InboundStoredCommand | undefined;
    for (const status of [
      'pending',
      'dispatched',
      'unknown',
      'succeeded',
      'failed',
    ] as const) {
      const commands = await journal.listCommands(input.workspaceId, status);
      command = commands.find(
        (candidate) => candidate.command.commandId === input.commandId,
      );
      if (command) break;
    }
    if (!command) throw new Error('Missing isolated command');
    if (input.action === 'dispatch') {
      try {
        command = await journal.updateCommand(
          input.workspaceId,
          input.commandId!,
          command.version,
          'dispatched',
        );
      } catch {
        emit({ type: 'result', result: 'rejected' });
        return;
      }
      await checkpoint('after_claim');
      const outcome = await provider('execute', input.commandId!);
      await checkpoint('after_effect');
      if (outcome === 'absent')
        throw new Error('Execution cannot report absence');
      const status =
        outcome === 'succeeded'
          ? 'succeeded'
          : outcome === 'failed'
            ? 'failed'
            : 'unknown';
      await journal.updateCommand(
        input.workspaceId,
        input.commandId!,
        command.version,
        status,
      );
      await checkpoint('after_outcome');
      emit({ type: 'result', result: status });
      return;
    }
    if (command.status === 'dispatched')
      command = await journal.updateCommand(
        input.workspaceId,
        input.commandId!,
        command.version,
        'unknown',
      );
    if (command.status === 'unknown') {
      const outcome = await provider('inspect', input.commandId!);
      if (outcome !== 'unknown') {
        command = await journal.updateCommand(
          input.workspaceId,
          input.commandId!,
          command.version,
          outcome === 'succeeded' ? 'succeeded' : 'failed',
          true,
        );
      }
    }
    if (!['succeeded', 'failed', 'unknown'].includes(command.status))
      throw new Error('Reconciliation cannot dispatch a pending command');
    emit({
      type: 'result',
      result:
        command.status === 'succeeded'
          ? 'succeeded'
          : command.status === 'failed'
            ? 'failed'
            : 'unknown',
    });
  } finally {
    await pool.end();
  }
};

if (import.meta.main) {
  main().catch(() => {
    // Never serialize connection strings, provider payloads or database errors to the transcript.
    process.stdout.write(JSON.stringify({ type: 'error' }) + '\n');
    process.exitCode = 1;
  });
}
