import { mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  createMcpRequestRecoveryStore,
  mcpRequestRecoveryRecordPath,
} from '../scripts/server/mcp-request-recovery';

const homes: string[] = [];

function makeHome(): string {
  const home = mkdtempSync(join(tmpdir(), 'consuelo-mcp-recovery-'));
  homes.push(home);
  return home;
}

afterEach(() => {
  for (const home of homes.splice(0)) rmSync(home, { recursive: true, force: true });
});

describe('MCP request recovery', () => {
  it('executes one explicit request id exactly once and replays the completed terminal result', async () => {
    const home = makeHome();
    const store = createMcpRequestRecoveryStore({ home });
    const execute = vi.fn(async () => ({ ok: true, code: 'OK', data: { sha: 'abc123' } }));
    const input = { requestId: 'request-replay-1234', path: 'README.md', taskSession: 'tsk_123' };

    const first = await store.execute({
      requestId: input.requestId,
      toolName: 'fs.write',
      toolInput: input,
      execute,
    });
    const second = await store.execute({
      requestId: input.requestId,
      toolName: 'fs.write',
      toolInput: input,
      execute,
    });

    expect(first).toEqual({ ok: true, code: 'OK', data: { sha: 'abc123' } });
    expect(second).toEqual(first);
    expect(execute).toHaveBeenCalledTimes(1);

    const recordPath = mcpRequestRecoveryRecordPath(home, input.requestId);
    const record = JSON.parse(readFileSync(recordPath, 'utf8')) as Record<string, unknown>;
    expect(record).toMatchObject({ status: 'completed', requestId: input.requestId, toolName: 'fs.write' });
    if (process.platform !== 'win32') expect(statSync(recordPath).mode & 0o777).toBe(0o600);
  });

  it('returns bounded in-progress state instead of executing a concurrent duplicate', async () => {
    const home = makeHome();
    const store = createMcpRequestRecoveryStore({ home });
    let release = () => {};
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const execute = vi.fn(async () => {
      await gate;
      return { ok: true, code: 'OK', data: { merged: true } };
    });
    const input = { requestId: 'request-running-1234', pr: 2600 };

    const firstPromise = store.execute({
      requestId: input.requestId,
      toolName: 'task.merge',
      toolInput: input,
      execute,
    });
    await new Promise((resolve) => setTimeout(resolve, 10));
    const duplicate = await store.execute({
      requestId: input.requestId,
      toolName: 'task.merge',
      toolInput: input,
      execute,
    });

    expect(duplicate).toMatchObject({
      ok: false,
      code: 'REQUEST_IN_PROGRESS',
      data: { requestId: input.requestId },
    });
    expect(execute).toHaveBeenCalledTimes(1);

    release();
    await expect(firstPromise).resolves.toMatchObject({ ok: true, code: 'OK' });
  });

  it('fails closed when the same request id is reused for different tool input', async () => {
    const home = makeHome();
    const store = createMcpRequestRecoveryStore({ home });
    const execute = vi.fn(async () => ({ ok: true, code: 'OK' }));

    await store.execute({
      requestId: 'request-conflict-1234',
      toolName: 'fs.write',
      toolInput: { requestId: 'request-conflict-1234', path: 'a.txt', content: 'one' },
      execute,
    });
    const conflict = await store.execute({
      requestId: 'request-conflict-1234',
      toolName: 'fs.write',
      toolInput: { requestId: 'request-conflict-1234', path: 'b.txt', content: 'two' },
      execute,
    });

    expect(conflict).toMatchObject({
      ok: false,
      code: 'REQUEST_ID_CONFLICT',
      data: { requestId: 'request-conflict-1234' },
    });
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it('isolates the same request id across authenticated caller scopes', async () => {
    const home = makeHome();
    const store = createMcpRequestRecoveryStore({ home });
    const executeA = vi.fn(async () => ({ ok: true, code: 'OK', data: { caller: 'a' } }));
    const executeB = vi.fn(async () => ({ ok: true, code: 'OK', data: { caller: 'b' } }));
    const requestId = 'request-scoped-1234';
    const toolInput = { requestId, path: 'scoped.txt' };

    const a = await store.execute({ requestId, scope: 'principal-a', toolName: 'fs.write', toolInput, execute: executeA });
    const b = await store.execute({ requestId, scope: 'principal-b', toolName: 'fs.write', toolInput, execute: executeB });

    expect(a).toMatchObject({ data: { caller: 'a' } });
    expect(b).toMatchObject({ data: { caller: 'b' } });
    expect(executeA).toHaveBeenCalledOnce();
    expect(executeB).toHaveBeenCalledOnce();
    expect(mcpRequestRecoveryRecordPath(home, requestId, 'principal-a'))
      .not.toBe(mcpRequestRecoveryRecordPath(home, requestId, 'principal-b'));
  });

  it('does not re-execute when a completed result exceeds the bounded replay cache', async () => {
    const home = makeHome();
    const store = createMcpRequestRecoveryStore({ home, maxResultBytes: 32 });
    const execute = vi.fn(async () => ({ ok: true, code: 'OK', data: { payload: 'x'.repeat(256) } }));
    const input = { requestId: 'request-large-result-1234', path: 'large.txt' };

    await store.execute({ requestId: input.requestId, toolName: 'fs.write', toolInput: input, execute });
    const replay = await store.execute({ requestId: input.requestId, toolName: 'fs.write', toolInput: input, execute });

    expect(replay).toMatchObject({
      ok: false,
      code: 'REQUEST_RESULT_NOT_REPLAYABLE',
      data: { requestId: input.requestId },
    });
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it('keeps recovery files bounded by pruning terminal records outside retention', async () => {
    const home = makeHome();
    let nowMs = Date.parse('2026-09-27T12:00:00Z');
    const store = createMcpRequestRecoveryStore({
      home,
      now: () => new Date(nowMs),
      retentionMs: 1_000,
    });
    await store.execute({
      requestId: 'request-old-1234',
      toolName: 'fs.write',
      toolInput: { requestId: 'request-old-1234', path: 'old.txt' },
      execute: async () => ({ ok: true, code: 'OK' }),
    });
    nowMs += 2_000;
    await store.execute({
      requestId: 'request-new-1234',
      toolName: 'fs.write',
      toolInput: { requestId: 'request-new-1234', path: 'new.txt' },
      execute: async () => ({ ok: true, code: 'OK' }),
    });

    expect(() => readFileSync(mcpRequestRecoveryRecordPath(home, 'request-old-1234'), 'utf8')).toThrow();
    expect(() => readFileSync(mcpRequestRecoveryRecordPath(home, 'request-new-1234'), 'utf8')).not.toThrow();
  });
});
