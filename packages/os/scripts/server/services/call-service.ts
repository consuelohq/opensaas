import type { ToolInput } from '../../lib/facade/types';
import {
  withTraceRoutingContext,
  type TraceRoutingContext,
} from '../../lib/trace-routing-context';
import type { CallInput } from '../../lib/types';

import { loadOsRuntime } from './os-runtime';

export function parseCallInput(body: string): CallInput {
  const parsed = JSON.parse(body) as unknown;
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Request body must be a JSON object.');
  }
  const input = parsed as Partial<CallInput>;
  if (!input.name || typeof input.name !== 'string') {
    throw new Error('Request body requires a string name.');
  }
  return input as CallInput;
}

export async function executeLocalOsCall(input: CallInput) {
  try {
    const { executeCall } = await loadOsRuntime();
    return await executeCall(input);
  } catch (error: unknown) {
    throw error instanceof Error ? error : new Error('OS call failed.');
  }
}

export async function executeLocalOsFacadeTool(
  toolName: string,
  input: ToolInput,
  routing?: TraceRoutingContext,
) {
  try {
    const { executeTool } = await import('../../lib/facade/executor');
    return await withTraceRoutingContext(routing, () =>
      executeTool(toolName, input, { logMode: 'errors' }),
    );
  } catch (error: unknown) {
    throw error instanceof Error ? error : new Error('OS facade call failed.');
  }
}
