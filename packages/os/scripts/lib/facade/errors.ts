import { randomUUID } from 'node:crypto';

import type { ErrorCode, ToolResult } from './types';

export const API_VERSION = '1.0.0' as const;

export function createTraceId(uuidFactory: () => string = randomUUID): string {
  return `trc_${uuidFactory().replace(/-/g, '').slice(0, 12)}`;
}

export function createToolResult<TData>(input: {
  ok: boolean;
  code: ErrorCode;
  message: string;
  data: TData;
  stderr?: string;
  exitCode?: number;
  durationMs: number;
  traceId: string;
  requestId?: string;
  now?: () => number;
}): ToolResult<TData> {
  const nowIso = new Date((input.now || Date.now)()).toISOString();
  return {
    now: nowIso,
    ok: input.ok,
    code: input.code,
    message: input.message,
    data: input.data,
    stderr: input.stderr || '',
    exitCode: input.exitCode ?? (input.ok ? 0 : 1),
    durationMs: input.durationMs,
    traceId: input.traceId,
    ...(input.requestId ? { requestId: input.requestId } : {}),
    apiVersion: API_VERSION,
  };
}

export function isToolResult(value: unknown): value is ToolResult<unknown> {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return candidate.apiVersion === API_VERSION
    && typeof candidate.ok === 'boolean'
    && typeof candidate.code === 'string'
    && typeof candidate.traceId === 'string';
}

export function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function isTimeoutError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const candidate = error as Record<string, unknown>;
  return candidate.timedOut === true || candidate.code === 'ETIMEDOUT';
}
