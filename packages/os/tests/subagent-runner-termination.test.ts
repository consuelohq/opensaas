import { describe, expect, it, vi } from 'vitest';

import { signalProviderProcess } from '../scripts/lib/subagent/process-termination';

describe('subagent runner termination', () => {
  it('falls back to ChildProcess.kill on Windows', () => {
    const childKill = vi.fn(() => true);
    const groupKill = vi.fn(() => { throw new Error('negative pid unsupported'); });

    const signalled = signalProviderProcess(
      { pid: 1234, kill: childKill },
      'SIGTERM',
      'win32',
      groupKill,
    );

    expect(signalled).toBe(true);
    expect(groupKill).not.toHaveBeenCalled();
    expect(childKill).toHaveBeenCalledWith('SIGTERM');
  });

  it('falls back to ChildProcess.kill when POSIX group signalling fails', () => {
    const childKill = vi.fn(() => true);
    const groupKill = vi.fn(() => { throw new Error('group disappeared'); });

    expect(signalProviderProcess({ pid: 4321, kill: childKill }, 'SIGKILL', 'darwin', groupKill)).toBe(true);
    expect(groupKill).toHaveBeenCalledWith(-4321, 'SIGKILL');
    expect(childKill).toHaveBeenCalledWith('SIGKILL');
  });
});
