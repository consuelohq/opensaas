import { expect, it } from 'bun:test';
import { readTranscriptOutbox, acknowledgeTranscriptOutbox } from './outbox';
import type { CallOperationsDatabase } from './persistence';

it('bounds and scopes source-reference delivery and acknowledgment', async () => {
  const calls: Array<{ sql: string; values?: readonly unknown[] }> = [];
  const database: CallOperationsDatabase = {
    query: async <T,>(sql: string, values?: readonly unknown[]) => {
      calls.push({ sql, values });
      return { rows: [] as T[] };
    },
  };
  const signal = new AbortController().signal;
  await readTranscriptOutbox(database, {
    workspaceId: 'one',
    sessionId: 'call',
    afterCursor: 3,
    limit: 5000,
    signal,
  });
  expect(calls[0]?.values).toEqual(['one', 'call', 3, 100]);
  expect(calls[0]?.sql).toContain(
    'segments.workspace_id = outbox.workspace_id',
  );
  expect(calls[0]?.sql).toContain('segments.session_id = outbox.session_id');
  await acknowledgeTranscriptOutbox(database, {
    workspaceId: 'one',
    sessionId: 'call',
    outboxId: 'event',
    signal,
  });
  expect(calls[1]?.values).toEqual(['one', 'call', 'event']);
});
it('does not access persistence for a cancelled reader', async () => {
  let requests = 0;
  const database: CallOperationsDatabase = {
    query: async <T,>() => {
      requests++;
      return { rows: [] as T[] };
    },
  };
  const controller = new AbortController();
  controller.abort();
  await expect(
    readTranscriptOutbox(database, {
      workspaceId: 'one',
      sessionId: 'call',
      afterCursor: 0,
      limit: 1,
      signal: controller.signal,
    }),
  ).rejects.toThrow();
  expect(requests).toBe(0);
});
