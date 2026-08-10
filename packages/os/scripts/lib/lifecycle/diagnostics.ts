import { appendFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

import { resolveLifecyclePaths } from './paths';
import type {
  LifecycleOperation,
  LifecycleProgressEvent,
  LifecycleProgressPhase,
} from './types';

const SECRET_KEY = /token|secret|password|credential|authorization|cookie|private.?key/i;
const SECRET_VALUE = /(bearer\s+[A-Za-z0-9._~+\/-]+|cst_[A-Za-z0-9_-]+|gh[pousr]_[A-Za-z0-9_]+)/gi;

export function redactLifecycleDetail(value: unknown, key = ''): unknown {
  if (SECRET_KEY.test(key)) return '[REDACTED]';
  if (typeof value === 'string') return value.replace(SECRET_VALUE, '[REDACTED]');
  if (Array.isArray(value)) return value.map((item) => redactLifecycleDetail(item));
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([childKey, childValue]) => [
        childKey,
        redactLifecycleDetail(childValue, childKey),
      ]),
    );
  }
  return value;
}

export function createLifecycleProgressEmitter(input: {
  home?: string;
  operation: LifecycleOperation;
  now: () => Date;
  sink?: (event: LifecycleProgressEvent) => void;
  persistDiagnostics?: boolean;
}): (phase: LifecycleProgressPhase, detail?: Record<string, unknown>) => LifecycleProgressEvent {
  let sequence = 0;
  const diagnosticsPath = resolveLifecyclePaths(input.home).diagnosticsPath;
  return (phase, detail) => {
    const event: LifecycleProgressEvent = {
      schemaVersion: 1,
      sequence: ++sequence,
      operation: input.operation,
      phase,
      observedAt: input.now().toISOString(),
      ...(detail ? { detail: redactLifecycleDetail(detail) as Record<string, unknown> } : {}),
    };
    input.sink?.(event);
    if (input.persistDiagnostics !== false) {
      try {
        mkdirSync(dirname(diagnosticsPath), { recursive: true });
        appendFileSync(diagnosticsPath, `${JSON.stringify(event)}\n`, { mode: 0o600 });
      } catch {
        // Diagnostics are best effort and cannot change lifecycle behavior.
      }
    }
    return event;
  };
}
