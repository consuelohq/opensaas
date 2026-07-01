import type { ChildProcess } from 'node:child_process';

export const PROCESS_TERMINATION_GRACE_MS = 500;

export function shouldUseDetachedProcessGroup(): boolean {
  return process.platform !== 'win32';
}

export function terminateProcessTree(child: ChildProcess, signal: NodeJS.Signals): void {
  if (shouldUseDetachedProcessGroup() && typeof child.pid === 'number') {
    try {
      process.kill(-child.pid, signal);
      return;
    } catch (error: unknown) {
      if (!isNoSuchProcessError(error)) {
        try {
          child.kill(signal);
        } catch {
          // Best effort; the child may have exited between checks.
        }
      }
      return;
    }
  }

  try {
    child.kill(signal);
  } catch {
    // Best effort; the child may already be gone.
  }
}

function isNoSuchProcessError(error: unknown): boolean {
  return typeof error === 'object'
    && error !== null
    && 'code' in error
    && (error as { code?: unknown }).code === 'ESRCH';
}
