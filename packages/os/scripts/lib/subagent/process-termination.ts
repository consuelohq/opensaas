import type { ChildProcess } from 'node:child_process';

type SignalableProvider = Pick<ChildProcess, 'pid' | 'kill'>;
type GroupKill = (pid: number, signal: NodeJS.Signals) => boolean;
type ScheduleTimeout = (callback: () => void, delayMs: number) => { unref?: () => unknown };
type ProviderSignal = (provider: SignalableProvider, signal: NodeJS.Signals) => boolean;
export type ProviderTerminationOutcome = 'timed_out' | 'cancelled';

export function preserveFirstTerminationOutcome(
  current: ProviderTerminationOutcome | undefined,
  next: ProviderTerminationOutcome,
): ProviderTerminationOutcome {
  return current ?? next;
}

export function scheduleProviderProcessEscalation(
  provider: SignalableProvider,
  delayMs = 250,
  schedule: ScheduleTimeout = (callback, delay) => setTimeout(callback, delay),
  signal: ProviderSignal = signalProviderProcess,
): void {
  const timer = schedule(() => {
    signal(provider, 'SIGKILL');
  }, delayMs);
  timer.unref?.();
}

export function signalProviderProcess(
  provider: SignalableProvider,
  signal: NodeJS.Signals,
  platform: NodeJS.Platform = process.platform,
  groupKill: GroupKill = process.kill,
): boolean {
  if (provider.pid && platform !== 'win32') {
    try {
      groupKill(-provider.pid, signal);
      return true;
    } catch {
      // Fall through to signalling the direct child when process groups are unavailable.
    }
  }
  try { return provider.kill(signal); } catch { return false; }
}
