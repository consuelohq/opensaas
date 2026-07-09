import { executeTool } from '../../facade/executor';
import { createToolResult } from '../../facade/errors';
import { manifestEntries } from '../../facade/executor';

import type { ToolInput, ToolManifestEntry, ToolResult } from '../../facade/types';
import type { CodeRunMode, CodeRunOperation, CodeRunRegistryState, ToolFunction, ToolNamespace, ToolRegistry } from '../types';

export type { CodeRunRegistryState } from '../types';

type BuildToolRegistryOptions = {
  taskSession?: string;
  mode?: CodeRunMode;
  state?: CodeRunRegistryState;
};

const blockedNestedTools = new Set(['code.run', 'code.call']);

function createState(): CodeRunRegistryState {
  return { operations: [], blockedTools: [], changedFiles: new Set<string>() };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeInput(value: unknown): ToolInput {
  return isRecord(value) ? { ...value } : {};
}

function firstArgumentAsInput(args: unknown[]): ToolInput {
  if (args.length === 0) return {};
  return normalizeInput(args[0]);
}

function recordChangedPath(toolName: string, input: ToolInput, state: CodeRunRegistryState): void {
  if (!toolName.startsWith('fs.')) return;
  if (!['fs.write', 'fs.apply_patch', 'fs.trash'].includes(toolName)) return;
  if (typeof input.path === 'string') state.changedFiles.add(input.path);
}

function compactOperation(tool: string, input: ToolInput, result: ToolResult): CodeRunOperation {
  return {
    tool,
    input,
    ok: result.ok,
    code: result.code,
    message: result.message,
    traceId: result.traceId,
    durationMs: result.durationMs,
  };
}

function blockedToolResult(toolName: string, state: CodeRunRegistryState): ToolResult<null> {
  state.blockedTools.push(toolName);
  return createToolResult({
    ok: false,
    code: 'COMMAND_FAILED',
    message: `${toolName} is blocked inside code mode; run it as an explicit outer workspace.call step.`,
    data: null,
    stderr: '',
    exitCode: 1,
  });
}

function createCallTool(repoRoot: string, options: BuildToolRegistryOptions, state: CodeRunRegistryState): ToolFunction {
  return async (toolName: unknown, rawInput?: unknown): Promise<ToolResult> => {
    if (typeof toolName !== 'string' || toolName.trim().length === 0) {
      const result = createToolResult({
        ok: false,
        code: 'VALIDATION_ERROR',
        message: 'workspace_call requires a non-empty tool name',
        data: null,
        stderr: '',
        exitCode: 1,
      });
      state.operations.push(compactOperation('workspace_call', {}, result));
      return result;
    }

    const normalizedInput = normalizeInput(rawInput);
    if (options.taskSession && typeof normalizedInput.taskSession !== 'string') {
      normalizedInput.taskSession = options.taskSession;
    }

    if (blockedNestedTools.has(toolName)) {
      const result = blockedToolResult(toolName, state);
      state.operations.push(compactOperation(toolName, normalizedInput, result));
      return result;
    }

    try {
      const result = await executeTool(toolName, normalizedInput, { cwd: repoRoot, logMode: 'errors' });
      state.operations.push(compactOperation(toolName, normalizedInput, result));
      if (result.ok) recordChangedPath(toolName, normalizedInput, state);
      return result;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      const result = createToolResult({
        ok: false,
        code: 'COMMAND_FAILED',
        message: 'workspace_call failed for ' + toolName + ': ' + message,
        data: null,
        stderr: message,
        exitCode: 1,
      });
      state.operations.push(compactOperation(toolName, normalizedInput, result));
      return result;
    }
  };
}

function setNestedTool(root: ToolNamespace, methodPath: string[], fn: ToolFunction): void {
  let current = root;
  for (const part of methodPath.slice(0, -1)) {
    const existing = current[part];
    if (!isRecord(existing)) current[part] = {};
    current = current[part] as ToolNamespace;
  }
  current[methodPath[methodPath.length - 1]] = fn;
}

function createManifestTool(entry: ToolManifestEntry, callTool: ToolFunction): ToolFunction {
  return (...args: unknown[]) => callTool(entry.name, firstArgumentAsInput(args));
}

export function buildToolRegistry(repoRoot: string, options: BuildToolRegistryOptions = {}): ToolRegistry {
  const state = options.state ?? createState();
  const callTool = createCallTool(repoRoot, options, state);
  const workspace: ToolNamespace = {};

  for (const entry of manifestEntries) {
    if (!entry.methodPath.length) continue;
    setNestedTool(workspace, entry.methodPath, createManifestTool(entry, callTool));
  }

  return {
    workspace,
    workspace_call: callTool,
  };
}
