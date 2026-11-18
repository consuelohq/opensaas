import { describe, expect, it, vi } from 'vitest';

import { logToolExecution } from '../scripts/lib/facade/logger';
import { recordToolTraceSafely } from '../scripts/lib/trace-persistence';

vi.mock('../scripts/lib/trace-persistence', () => ({ recordToolTraceSafely: vi.fn() }));

describe('computer use trace privacy', () => {
  it.each([
    { tool: 'computer.use', input: { action: 'fill', text: 'private sample' } },
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
