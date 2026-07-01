import type { ChildProcess } from 'node:child_process';

export const PROCESS_TERMINATION_GRACE_MS = 500;
export const PROCESS_TREE_CLEANUP_SIGNALS: NodeJS.Signals[] = ['SIGINT', 'SIGTERM', 'SIGHUP'];

type ProcessTreeEvent = NodeJS.Signals | 'exit';

type ProcessLike = {
  once(event: ProcessTreeEvent, listener: (...args: unknown[]) => void): unknown;
  off(event: ProcessTreeEvent, listener: (...args: unknown[]) => void): unknown;
  kill?(pid: number, signal?: NodeJS.Signals): boolean;
  pid?: number;
};

export type ProcessTreeCleanupOptions = {
  processLike?: ProcessLike;
  reemitSignal?: boolean;
  terminate?: (child: ChildProcess, signal: NodeJS.Signals) => void;
};

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

export function registerProcessTreeCleanup(child: ChildProcess, options: ProcessTreeCleanupOptions = {}): () => void {
  if (!shouldUseDetachedProcessGroup() || typeof child.pid !== 'number') return () => {};

  const processLike = options.processLike || process;
  const terminate = options.terminate || terminateProcessTree;
  const shouldReemitSignal = options.reemitSignal !== false;
  const handlers: Array<{ event: ProcessTreeEvent; listener: (...args: unknown[]) => void }> = [];
  let disposed = false;

  const dispose = (): void => {
    if (disposed) return;
    disposed = true;
    for (const handler of handlers.splice(0)) {
      processLike.off(handler.event, handler.listener);
    }
  };

  const terminateOnce = (): void => {
    if (disposed) return;
    terminate(child, 'SIGTERM');
  };

  const register = (event: ProcessTreeEvent, listener: (...args: unknown[]) => void): void => {
    processLike.once(event, listener);
    handlers.push({ event, listener });
  };

  register('exit', () => {
    terminateOnce();
    dispose();
  });

  for (const signal of PROCESS_TREE_CLEANUP_SIGNALS) {
    register(signal, () => {
      terminateOnce();
      dispose();
      if (shouldReemitSignal && processLike.kill && typeof processLike.pid === 'number') {
        try {
          processLike.kill(processLike.pid, signal);
        } catch {
          // Best effort; the parent is already shutting down.
        }
      }
    });
  }

  return dispose;
}

function isNoSuchProcessError(error: unknown): boolean {
  return typeof error === 'object'
    && error !== null
    && 'code' in error
    && (error as { code?: unknown }).code === 'ESRCH';
}
