import { describe, expect, it, vi } from 'vitest';

import {
  preserveFirstTerminationOutcome,
  scheduleProviderProcessEscalation,
  signalProviderProcess,
} from '../scripts/lib/subagent/process-termination';

describe('subagent runner termination', () => {
  it('preserves the first timeout or cancellation cause during escalation', () => {
    expect(preserveFirstTerminationOutcome(undefined, 'timed_out')).toBe('timed_out');
    expect(preserveFirstTerminationOutcome('timed_out', 'cancelled')).toBe('timed_out');
    expect(preserveFirstTerminationOutcome('cancelled', 'timed_out')).toBe('cancelled');
  });

  it('keeps SIGKILL escalation scheduled after the direct provider exits', () => {
    const provider = { pid: 7777, kill: vi.fn(() => true) };
    let scheduled: (() => void) | undefined;
    const unref = vi.fn();
    const schedule = vi.fn((callback: () => void) => {
      scheduled = callback;
      return { unref };
    });
    const signal = vi.fn(() => true);

    scheduleProviderProcessEscalation(provider, 250, schedule, signal);
    // Simulate the direct child having already emitted close/finished before escalation.
    scheduled?.();

    expect(schedule).toHaveBeenCalledWith(expect.any(Function), 250);
    expect(unref).toHaveBeenCalledTimes(1);
    expect(signal).toHaveBeenCalledWith(provider, 'SIGKILL');
  });

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
