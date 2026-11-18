import { describe, expect, it, vi } from 'vitest';

import { parseSubagentTraceEvents } from '../scripts/lib/subagent/runtime';
import { logToolExecution } from '../scripts/lib/facade/logger';
import { recordToolTraceSafely } from '../scripts/lib/trace-persistence';

vi.mock('../scripts/lib/trace-persistence', () => ({ recordToolTraceSafely: vi.fn() }));

describe('computer use trace privacy', () => {
  it.each([
    { tool: 'code.run', input: { code: 'private sample' }, result: { data: { operations: [{ tool: 'computer.use' }], result: 'private sample' } } },
    { tool: 'code.run', input: { code: 'private sample' }, result: { data: { privateComputerUse: true, operations: [{ tool: 'batch' }] } } },
    { tool: 'code.run', input: { code: 'private sample' }, result: { ok: false, stderr: 'private sample' } },
    { tool: 'batch', input: { steps: [{ tool: 'code.run' }] }, result: { data: { results: [{ data: { privateComputerUse: true, operations: [] } }] } } },
  ])('suppresses the parent payload for composed private operations in $tool', ({ tool, input, result }) => {
    logToolExecution({
      tool, input, resolvedInput: input, result, stderr: 'private sample',
      traceId: 'private-parent', durationMs: 1, exitCode: 0, ok: true, code: 'OK', command: tool,
      capabilities: { readOnly: false, mutating: true }, emit: false,
    });
    expect(recordToolTraceSafely).toHaveBeenLastCalledWith(expect.objectContaining({
      input: undefined, resolvedInput: undefined, result: undefined, stderr: undefined,
    }), expect.anything());
  });

  it('omits native UI content from parsed subagent trace events while keeping token counts', () => {
    const stdout = JSON.stringify({ type: 'item.completed', item: {
      type: 'mcp_tool_call', id: 'fixture', server: 'os', tool: 'call',
      arguments: { tool: 'computer.use', input: { text: 'private sample' } }, result: { snapshot: 'private sample' },
    } });
    const [event] = parseSubagentTraceEvents('codex', stdout);
    expect(event.facadeTool).toBe('computer.use');
    expect(event.totalTokens).toBeGreaterThan(0);
    expect(JSON.stringify(event)).not.toContain('private sample');
  });

  it('keeps an ordinary code.run result with a completed, nonprivate operation ledger', () => {
    const result = { data: { privateComputerUse: false, operations: [{ tool: 'fs.list' }], result: ['example.ts'] } };
    logToolExecution({ tool: 'code.run', input: {}, result, traceId: 'ordinary', durationMs: 1, exitCode: 0,
      ok: true, code: 'OK', command: 'code.run', capabilities: { readOnly: true, mutating: false }, emit: false });
    expect(recordToolTraceSafely).toHaveBeenLastCalledWith(expect.objectContaining({ result }), expect.anything());
  });

  it.each([
    { tool: 'computer.use', input: { action: 'fill', text: 'private sample' } },
    { tool: 'computer-use', input: { action: 'fill', text: 'private sample' } },
    { tool: 'batch', input: { steps: [{ tool: 'batch', input: { steps: [{ tool: 'computer-use', args: { text: 'private sample' } }] } }] } },
    { tool: 'batch', input: { steps: [{ tool: 'code-run', input: { code: 'private sample' } }] } },
    { tool: 'batch', input: { steps: [{ tool: 'batch', input: {}, args: { steps: [{ tool: 'computer.use', args: { text: 'private sample' } }] } }] } },
    { tool: 'batch', input: { steps: [{ tool: 'batch', args: { steps: [{ tool: 'computer.use' }] } }] } },
  ])('retains execution metadata without recording private UI content for $tool', ({ tool, input }) => {
    logToolExecution({
      tool, input, resolvedInput: input, result: { text: 'private sample' }, stderr: 'private sample',
      traceId: 'private-test', durationMs: 1, exitCode: 0, ok: true, code: 'OK', command: tool,
      capabilities: { readOnly: false, mutating: true }, emit: false,
    });
    expect(recordToolTraceSafely).toHaveBeenLastCalledWith(expect.objectContaining({
      tool, ok: true, code: 'OK', input: undefined, resolvedInput: undefined, result: undefined, stderr: undefined,
    }), expect.anything());
  });
});
