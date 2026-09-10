import { describe, expect, it } from 'bun:test';
import { decodeWorkerInput, readLabLines } from './inbound-worker-protocol';
import { createLabBridgeCommit } from './inbound-simulation-fixtures';

describe('inbound worker isolation boundary', () => {
  const input = {
    databaseUrl: 'postgresql://postgres@127.0.0.1:49152/postgres',
    workspaceId: 'rd2-test',
    action: 'commit',
    commit: createLabBridgeCommit('rd2-test'),
  };
  it('accepts only the generated local resource shape and the same tenant', () => {
    expect(decodeWorkerInput(input).workspaceId).toBe('rd2-test');
    for (const databaseUrl of [
      'postgresql://postgres@remote.example:49152/postgres',
      'postgresql://postgres@127.0.0.1:5432/postgres',
      'postgresql://postgres:secret@127.0.0.1:49152/postgres',
      'postgresql://postgres@127.0.0.1:49152/customer',
      'postgresql://postgres@127.0.0.1:49152/postgres?host=remote.example',
    ])
      expect(() => decodeWorkerInput({ ...input, databaseUrl })).toThrow();
    expect(() =>
      decodeWorkerInput({ ...input, workspaceId: 'customer' }),
    ).toThrow();
    expect(() =>
      decodeWorkerInput({
        ...input,
        commit: createLabBridgeCommit('rd2-other'),
      }),
    ).toThrow();
  });
  it('decodes split messages and rejects truncated or oversized process output', async () => {
    const stream = (chunks: string[]) =>
      new ReadableStream<Uint8Array>({
        start(controller) {
          for (const chunk of chunks)
            controller.enqueue(new TextEncoder().encode(chunk));
          controller.close();
        },
      });
    const read = async (chunks: string[]) => {
      const result: unknown[] = [];
      for await (const message of readLabLines(stream(chunks)))
        result.push(message);
      return result;
    };
    expect(await read(['{"type":', '"ready"}\n"go"\n'])).toEqual([
      { type: 'ready' },
      'go',
    ]);
    await expect(read(['{"type":'])).rejects.toThrow();
    await expect(read(['x'.repeat(1_000_001)])).rejects.toThrow();
  });
});
