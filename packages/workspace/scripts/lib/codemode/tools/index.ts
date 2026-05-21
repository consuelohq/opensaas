import { executeTool, manifestEntries } from '../../facade/executor';
import type { ToolInput, ToolManifestEntry, ToolResult } from '../../facade/types';
import type { ToolFunction, ToolRegistry } from '../types';

export type CodeRunMode = 'read' | 'edit' | 'verify';
export type CodeRunOperation = { tool: string; helper: string; ok: boolean; code: string; message: string; traceId: string; durationMs: number };
export type BlockedCodeRunTool = { tool: string; helper: string; reason: string; nextStep: string };
export type CodeRunRegistryState = { operations: CodeRunOperation[]; blockedTools: BlockedCodeRunTool[]; changedFiles: Set<string> };

type BuildToolRegistryOptions = { taskSession?: string; mode?: CodeRunMode; state?: CodeRunRegistryState };

const JS_RESERVED = new Set(['await', 'break', 'case', 'catch', 'class', 'const', 'continue', 'default', 'delete', 'do', 'else', 'export', 'extends', 'finally', 'for', 'function', 'if', 'import', 'in', 'instanceof', 'let', 'new', 'return', 'switch', 'this', 'throw', 'try', 'typeof', 'var', 'void', 'while', 'with', 'yield']);
const READ_MUTATING_CATEGORIES = new Set(['http', 'utilities']);
const EDIT_MUTATING_CATEGORIES = new Set(['filesystem', 'composed', 'utilities', 'http']);
const VERIFY_MUTATING_CATEGORIES = new Set(['filesystem', 'composed', 'utilities', 'http', 'review', 'decision engine']);
const EXPLICITLY_BLOCKED_CATEGORIES = new Set(['task lifecycle', 'linear', 'github', 'consuelo design', 'generation']);

function sanitizeToolName(name: string): string {
  let sanitized = name.replace(/[-.\s]/g, '_').replace(/[^a-zA-Z0-9_$]/g, '');
  if (!sanitized) sanitized = '_';
  if (/^[0-9]/.test(sanitized)) sanitized = `_${sanitized}`;
  if (JS_RESERVED.has(sanitized)) sanitized = `${sanitized}_`;
  return sanitized;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asToolInput(value: unknown): ToolInput {
  return isRecord(value) ? value : {};
}

function isAllowed(entry: ToolManifestEntry, mode: CodeRunMode, hasTaskSession: boolean): { ok: true } | { ok: false; reason: string; nextStep: string } {
  if (!entry.capabilities.mutating) return { ok: true };
  if (EXPLICITLY_BLOCKED_CATEGORIES.has(entry.category)) return { ok: false, reason: `${entry.name} belongs to ${entry.category} and is blocked inside code.run.`, nextStep: `Run ${entry.name} as an explicit workspace.call after reviewing code.run output.` };
  if (entry.sessionRequired && !hasTaskSession) return { ok: false, reason: `${entry.name} requires taskSession inside code.run.`, nextStep: 'Pass taskSession to code.run.' };
  if (mode === 'read' && READ_MUTATING_CATEGORIES.has(entry.category)) return { ok: true };
  if (mode === 'edit' && EDIT_MUTATING_CATEGORIES.has(entry.category)) return { ok: true };
  if (mode === 'verify' && VERIFY_MUTATING_CATEGORIES.has(entry.category)) return { ok: true };
  return { ok: false, reason: `${entry.name} is not allowed in code.run ${mode} mode.`, nextStep: mode === 'read' ? 'Use mode="edit" or mode="verify" for task-scoped mutation or validation.' : `Run ${entry.name} explicitly through workspace.call.` };
}

function makeToolFunction(entry: ToolManifestEntry, helper: string, options: BuildToolRegistryOptions, state: CodeRunRegistryState): ToolFunction {
  return async (input: unknown = {}) => {
    try {
      const mode = options.mode || 'read';
    const policy = isAllowed(entry, mode, Boolean(options.taskSession));
    if (!policy.ok) {
      const blocked = { tool: entry.name, helper, reason: policy.reason, nextStep: policy.nextStep };
      state.blockedTools.push(blocked);
      return { error: 'CODE_RUN_TOOL_BLOCKED', ...blocked };
    }
    const toolInput = { ...asToolInput(input), ...(options.taskSession ? { taskSession: options.taskSession } : {}) };
    const result = await executeTool(entry.name, toolInput, { logMode: 'errors' });
    state.operations.push({ tool: entry.name, helper, ok: result.ok, code: result.code, message: result.message, traceId: result.traceId, durationMs: result.durationMs });
      if (result.ok && entry.category === 'filesystem' && typeof toolInput.path === 'string' && entry.capabilities.mutating) state.changedFiles.add(toolInput.path);
      return result;
    } catch (error: unknown) {
      return { ok: false, code: 'COMMAND_FAILED', message: error instanceof Error ? error.message : String(error) };
    }
  };
}

function addFriendlyAliases(registry: ToolRegistry, state: CodeRunRegistryState): void {
  const fsRead = registry.fs_read;
  const fsSearch = registry.fs_search;
  const fsList = registry.fs_list;
  const fsWrite = registry.fs_write;
  if (fsRead) registry.readFile = async (path: unknown, from?: unknown, to?: unknown) => fsRead({ path, ...(typeof from === 'number' ? { from } : {}), ...(typeof to === 'number' ? { to } : {}) });
  if (fsSearch) registry.grep = async (pattern: unknown, searchPath?: unknown, options?: unknown) => fsSearch({ pattern, ...(typeof searchPath === 'string' ? { paths: [searchPath] } : {}), ...(isRecord(options) ? options : {}) });
  if (fsList) {
    registry.readDir = async (path?: unknown, depth?: unknown) => fsList({ ...(typeof path === 'string' ? { path } : {}), ...(typeof depth === 'number' ? { depth } : {}) });
    registry.glob = async (pattern: unknown, path?: unknown) => fsList({ pattern, ...(typeof path === 'string' ? { path } : {}), files: true });
  }
  if (fsWrite) {
    registry.writeFile = async (path: unknown, content: unknown) => fsWrite({ path, content: String(content ?? ''), force: true });
    registry.appendFile = async (path: unknown, content: unknown) => fsWrite({ path, content: String(content ?? ''), append: true });
  }
  if (fsRead && fsWrite) {
    registry.editFile = async (path: unknown, oldText: unknown, newText: unknown) => {
      const readResult = await fsRead({ path }) as ToolResult<unknown>;
      if (!readResult.ok) return readResult;
      const data = readResult.data;
      const content = Array.isArray(data) && isRecord(data[0]) && Array.isArray(data[0].lines) ? data[0].lines.join('\n') + '\n' : '';
      const oldValue = String(oldText ?? '');
      const matches = oldValue ? content.split(oldValue).length - 1 : 0;
      if (matches !== 1) return { ok: false, code: 'VALIDATION_ERROR', message: `editFile expected exactly one match but found ${matches}`, data: { matches } };
      const writeResult = await fsWrite({ path, content: content.replace(oldValue, String(newText ?? '')), force: true });
      if (typeof path === 'string') state.changedFiles.add(path);
      return writeResult;
    };
  }
}

export function buildToolRegistry(_basePath: string, options: BuildToolRegistryOptions = {}): ToolRegistry {
  const state = options.state || { operations: [], blockedTools: [], changedFiles: new Set<string>() };
  const registry: ToolRegistry = {};
  for (const entry of manifestEntries) {
    if (entry.name === 'code.run') continue;
    const helper = sanitizeToolName(entry.name);
    registry[helper] = makeToolFunction(entry, helper, options, state);
  }
  addFriendlyAliases(registry, state);
  return registry;
}
