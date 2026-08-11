import type { ChildProcess } from 'node:child_process';

type SignalableProvider = Pick<ChildProcess, 'pid' | 'kill'>;
type GroupKill = (pid: number, signal: NodeJS.Signals) => boolean;

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
