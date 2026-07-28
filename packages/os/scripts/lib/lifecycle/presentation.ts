import { LifecycleError } from './errors';
import type {
  LifecycleOperationResult,
  LifecycleProgressEvent,
} from './types';

export type LifecycleJsonEnvelope =
  | {
      schemaVersion: 1;
      command: string;
      ok: true;
      result: LifecycleOperationResult;
    }
  | {
      schemaVersion: 1;
      command: string;
      ok: false;
      error: {
        code: string;
        message: string;
        phase?: string;
      };
    };

export function lifecycleSuccessEnvelope(
  command: string,
  result: LifecycleOperationResult,
): LifecycleJsonEnvelope {
  return { schemaVersion: 1, command, ok: true, result };
}

export function lifecycleFailureEnvelope(
  command: string,
  error: unknown,
): LifecycleJsonEnvelope {
  if (error instanceof LifecycleError) {
    return {
      schemaVersion: 1,
      command,
      ok: false,
      error: {
        code: error.code,
        message: error.message,
        ...(error.phase ? { phase: error.phase } : {}),
      },
    };
  }
  return {
    schemaVersion: 1,
    command,
    ok: false,
    error: {
      code: 'LIFECYCLE_FAILED',
      message: error instanceof Error ? error.message : String(error),
    },
  };
}

export function renderLifecycleResult(result: LifecycleOperationResult): string {
  const fields = [
    `operation: ${result.operation}`,
    `changed: ${result.changed ? 'yes' : 'no'}`,
    ...(result.installState ? [`install: ${result.installState}`] : []),
    ...(result.version ? [`version: ${result.version}`] : []),
    ...(result.preferences ? [
      `channel: ${result.preferences.channel}`,
      `notifications: ${result.preferences.notifications.mode}`,
    ] : []),
  ];
  return `${fields.join('\n')}\n`;
}

export function renderLifecycleProgress(event: LifecycleProgressEvent): string {
  return `[${event.sequence}] ${event.operation}: ${event.phase}\n`;
}
