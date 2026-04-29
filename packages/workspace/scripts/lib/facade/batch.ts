import { createToolResult, createTraceId, getErrorMessage } from './errors';
import { executeTool, getToolManifestEntry } from './executor';
import type { BatchResult, BatchStep, ExecuteToolOptions, ToolInput, ToolResult } from './types';

export async function runBatch(
  steps: BatchStep[],
  options: ExecuteToolOptions = {},
): Promise<BatchResult> {
  const startedAt = Date.now();
  const traceId = createTraceId(options.randomUUID);
  const results: ToolResult<unknown>[] = [];

  try {
    let index = 0;
    while (index < steps.length) {
      const parallelGroup = collectParallelGroup(steps, index);
      if (parallelGroup.length > 1) {
        const groupResults = await Promise.all(parallelGroup.map((step) => runStep(step, null, results, options)));
        results.push(...groupResults);
        const failed = groupResults.find((result) => !result.ok);
        if (failed) break;
        index += parallelGroup.length;
        continue;
      }

      const previous = results.length > 0 ? results[results.length - 1] : null;
      const result = await runStep(steps[index], previous, results, options);
      results.push(result);
      index += 1;
      if (!result.ok) break;
    }

    const ok = results.length === steps.length && results.every((result) => result.ok);
    return createToolResult({
      ok,
      code: ok ? 'OK' : 'COMMAND_FAILED',
      message: ok ? 'batch completed' : 'batch stopped after a failed step',
      data: {
        results,
        completed: results.length,
      },
      durationMs: Math.max(0, Date.now() - startedAt),
      traceId,
    });
  } catch (error: unknown) {
    const message = getErrorMessage(error);
    return createToolResult({
      ok: false,
      code: 'COMMAND_FAILED',
      message: `batch failed: ${message}`,
      data: {
        results,
        completed: results.length,
      },
      stderr: message,
      durationMs: Math.max(0, Date.now() - startedAt),
      traceId,
    });
  }
}

function collectParallelGroup(steps: BatchStep[], startIndex: number): BatchStep[] {
  const first = steps[startIndex];
  if (!first.parallel || hasFunctionArgs(first) || !isReadOnly(first.tool)) return [first];

  const group: BatchStep[] = [];
  for (let index = startIndex; index < steps.length; index += 1) {
    const step = steps[index];
    if (!step.parallel || hasFunctionArgs(step) || !isReadOnly(step.tool)) break;
    group.push(step);
  }

  return group;
}

function hasFunctionArgs(step: BatchStep): boolean {
  return typeof step.input === 'function' || typeof step.args === 'function';
}

function isReadOnly(toolName: string): boolean {
  return getToolManifestEntry(toolName)?.capabilities.readOnly === true;
}

async function runStep(
  step: BatchStep,
  previous: ToolResult<unknown> | null,
  results: ToolResult<unknown>[],
  options: ExecuteToolOptions,
): Promise<ToolResult<unknown>> {
  const input = step.input ?? step.args ?? {};
  const args = typeof input === 'function'
    ? input(previous, results)
    : input;
  return executeTool(step.tool, args as ToolInput, options);
}
