import { Schema } from 'effect';
import { InboundCommitSchema } from '@consuelo/dialer';

export const checkpointSchema = Schema.Literal(
  'before_commit',
  'after_commit',
  'after_claim',
  'after_effect',
  'after_outcome',
);
export type LabCheckpoint = typeof checkpointSchema.Type;
export const workerInputSchema = Schema.Struct({
  databaseUrl: Schema.String,
  workspaceId: Schema.String.pipe(Schema.pattern(/^rd2-[a-z0-9-]+$/)),
  action: Schema.Literal('commit', 'dispatch', 'reconcile'),
  commit: Schema.optional(InboundCommitSchema),
  commandId: Schema.optional(Schema.String),
});
export type LabWorkerInput = typeof workerInputSchema.Type;
export const workerMessageSchema = Schema.Union(
  Schema.Struct({ type: Schema.Literal('ready') }),
  Schema.Struct({
    type: Schema.Literal('checkpoint'),
    checkpoint: checkpointSchema,
  }),
  Schema.Struct({
    type: Schema.Literal('provider'),
    operation: Schema.Literal('execute', 'inspect'),
    commandId: Schema.String,
  }),
  Schema.Struct({
    type: Schema.Literal('result'),
    result: Schema.Literal(
      'committed',
      'duplicate',
      'succeeded',
      'failed',
      'unknown',
      'rejected',
    ),
  }),
  Schema.Struct({ type: Schema.Literal('error') }),
);
export type LabWorkerMessage = typeof workerMessageSchema.Type;
export const decodeWorkerMessage = Schema.decodeUnknownSync(
  workerMessageSchema,
  { onExcessProperty: 'error' },
);
export const decodeWorkerInput = (value: unknown): LabWorkerInput => {
  const input = Schema.decodeUnknownSync(workerInputSchema, {
    onExcessProperty: 'error',
  })(value);
  const url = new URL(input.databaseUrl);
  if (
    url.protocol !== 'postgresql:' ||
    url.hostname !== '127.0.0.1' ||
    !url.port ||
    Number(url.port) < 1024 ||
    url.port === '5432' ||
    url.pathname !== '/postgres' ||
    url.username !== 'postgres' ||
    url.password ||
    url.search ||
    (input.commit &&
      (input.commit.workspaceId !== input.workspaceId ||
        input.commit.events.some(
          (event) => event.workspaceId !== input.workspaceId,
        ))) ||
    (input.action === 'commit' ? !input.commit : !input.commandId)
  )
    throw new Error(
      'Worker requires an isolated local lab resource and scoped operation',
    );
  return input;
};

export async function* readLabLines(stream: ReadableStream<Uint8Array>) {
  try {
    const decoder = new TextDecoder();
    let buffer = '';
    for await (const chunk of stream) {
      buffer += decoder.decode(chunk, { stream: true });
      if (buffer.length > 1_000_000)
        throw new Error('Lab protocol message exceeds limit');
      let end: number;
      while ((end = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, end);
        buffer = buffer.slice(end + 1);
        if (line) yield JSON.parse(line) as unknown;
      }
    }
    buffer += decoder.decode();
    if (buffer.trim()) throw new Error('Incomplete lab protocol message');
  } catch (cause: unknown) {
    throw new Error('Lab message stream failed', { cause });
  }
}
