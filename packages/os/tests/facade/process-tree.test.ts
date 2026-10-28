import type { ChildProcess } from 'node:child_process';

import { describe, expect, it, vi } from 'vitest';

import { registerProcessTreeCleanup } from '../../scripts/lib/facade/process-tree';

describe('process tree cleanup', () => {
  it('should terminate a detached child group when the parent exits', () => {
    const calls: Array<{ signal: NodeJS.Signals }> = [];
    const listeners = new Map<string, () => void>();
    const processLike = {
      once: (event: string, listener: () => void) => {
        listeners.set(event, listener);
      },
      off: (event: string, listener: () => void) => {
        if (listeners.get(event) === listener) listeners.delete(event);
      },
      kill: vi.fn(),
      pid: 1234,
    };
    const child = { pid: 4321 } as ChildProcess;

    const dispose = registerProcessTreeCleanup(child, {
      processLike,
      reemitSignal: false,
      terminate: (_child, signal) => {
        calls.push({ signal });
      },
    });

    listeners.get('exit')?.();

    expect(calls).toEqual([{ signal: 'SIGTERM' }]);
    expect(listeners.has('exit')).toBe(false);
    dispose();
  });
});
