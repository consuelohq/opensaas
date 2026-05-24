import { executeTool, manifestEntries } from '../../facade/executor';
import type { ToolInput, ToolManifestEntry, ToolResult } from '../../facade/types';
import type { ToolFunction, ToolNamespace, ToolRegistry } from '../types';

export type CodeRunMode = 'read' | 'edit' | 'verify';
export type CodeRunOperation = { tool: string; helper: string; ok: boolean; code: string; message: string; traceId: string; durationMs: number; inputTokens: number; outputTokens: number; totalTokens: number; detail?: string; changed?: boolean };
export type BlockedCodeRunTool = { tool: string; helper: string; reason: string; nextStep: string };
export type CodeRunRegistryState = { operations: CodeRunOperation[]; blockedTools: BlockedCodeRunTool[]; changedFiles: Set<string> };

type BuildToolRegistryOptions = { taskSession?: string; mode?: CodeRunMode; state?: CodeRunRegistryState };

const JS_RESERVED = new Set([
  'await', 'break', 'case', 'catch', 'class', 'const', 'continue', 'default', 'delete',
  'do', 'else', 'export', 'extends', 'finally', 'for', 'function', 'if', 'import', 'in',
  'instanceof', 'let', 'new', 'return', 'switch', 'this', 'throw', 'try', 'typeof', 'var',
  'void', 'while', 'with', 'yield',
]);

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

function withTaskSession(input: ToolInput, taskSession?: string): ToolInput {
  return { ...input, ...(taskSession ? { taskSession } : {}) };
}

function estimateTokens(value: unknown): number {
  if (value === undefined || value === null) return 0;
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  return Math.max(1, Math.ceil(text.length / 4));
}

function cleanText(value: unknown): string {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

function commandDetail(command: unknown): string {
  if (!Array.isArray(command)) return '';
  return command.map((part) => String(part)).join(' ').slice(0, 120);
}

function operationDetail(input: ToolInput): string {
  const candidates = [
    input.path,
    input.pattern ? `pattern=${input.pattern}` : '',
    input.query ? `query=${input.query}` : '',
    input.keyword ? `keyword=${input.keyword}` : '',
    input.operation,
    input.pr ? `pr #${input.pr}` : '',
    input.repo,
    commandDetail(input.command),
  ];
  return cleanText(candidates.find((value) => cleanText(value)) || '').slice(0, 120);
}

function trackChangedFile(entry: ToolManifestEntry, input: ToolInput, state: CodeRunRegistryState): void {
  if (!entry.capabilities.mutating) return;
  if (entry.category !== 'filesystem') return;
  if (typeof input.path === 'string') state.changedFiles.add(input.path);
}

function blockedResult(tool: string, helper: string, state: CodeRunRegistryState): ToolResult<unknown> {
  const blocked = {
    tool,
    helper,
    reason: `${tool} cannot be called from inside code.run because recursive code.run calls are blocked.`,
    nextStep: `Run ${tool} as a separate outer workspace.call if nesting is required.`,
  };
  state.blockedTools.push(blocked);
  return {
    now: new Date().toISOString(),
    ok: false,
    code: 'VALIDATION_ERROR',
    message: blocked.reason,
    data: blocked,
    stderr: '',
    exitCode: 1,
    durationMs: 0,
    traceId: 'code-run-blocked-recursive',
    apiVersion: '1.0.0',
  };
}

function missingToolResult(tool: string, helper: string): ToolResult<unknown> {
  return {
    now: new Date().toISOString(),
    ok: false,
    code: 'NOT_FOUND',
    message: `unknown workspace tool: ${tool}`,
    data: { tool, helper },
    stderr: '',
    exitCode: 1,
    durationMs: 0,
    traceId: 'code-run-tool-not-found',
    apiVersion: '1.0.0',
  };
}

async function runWorkspaceTool(
  entry: ToolManifestEntry,
  helper: string,
  rawInput: unknown,
  options: BuildToolRegistryOptions,
  state: CodeRunRegistryState,
): Promise<unknown> {
  try {
    if (entry.name === 'code.run') return blockedResult(entry.name, helper, state);
    const toolInput = withTaskSession(asToolInput(rawInput), options.taskSession);
    const result = await executeTool(entry.name, toolInput, { logMode: 'errors' });
    state.operations.push({
      tool: entry.name,
      helper,
      ok: result.ok,
      code: result.code,
      message: result.message,
      traceId: result.traceId,
      durationMs: result.durationMs,
      inputTokens: estimateTokens(toolInput),
      outputTokens: estimateTokens(result),
      totalTokens: estimateTokens(toolInput) + estimateTokens(result),
      detail: operationDetail(toolInput),
      changed: entry.capabilities.mutating === true,
    });
    if (result.ok) trackChangedFile(entry, toolInput, state);
    return result;
  } catch (error: unknown) {
    return {
      ok: false,
      code: 'COMMAND_FAILED',
      message: error instanceof Error ? error.message : String(error),
    };
  }
}

function makeToolFunction(entry: ToolManifestEntry, helper: string, options: BuildToolRegistryOptions, state: CodeRunRegistryState): ToolFunction {
  return async (input: unknown = {}) => runWorkspaceTool(entry, helper, input, options, state);
}

function makeGenericWorkspaceCall(entriesByName: Map<string, ToolManifestEntry>, options: BuildToolRegistryOptions, state: CodeRunRegistryState): ToolFunction {
  return async (toolOrRequest: unknown, maybeInput?: unknown) => {
    const request = isRecord(toolOrRequest) ? toolOrRequest : null;
    const tool = typeof toolOrRequest === 'string'
      ? toolOrRequest
      : typeof request?.tool === 'string'
        ? request.tool
        : '';
    const input = typeof toolOrRequest === 'string'
      ? maybeInput
      : isRecord(request) && 'input' in request
        ? request.input
        : {};
    const helper = 'workspace_call';
    const entry = entriesByName.get(tool);
    if (!entry) return missingToolResult(tool || '<missing>', helper);
    return runWorkspaceTool(entry, helper, input, options, state);
  };
}

function setNamespaceFunction(root: ToolNamespace, path: string[], fn: ToolFunction): void {
  let cursor = root;
  for (let index = 0; index < path.length; index += 1) {
    const part = path[index];
    if (index === path.length - 1) {
      cursor[part] = fn;
      return;
    }
    const existing = cursor[part];
    if (!isRecord(existing) || typeof existing === 'function') cursor[part] = {};
    cursor = cursor[part] as ToolNamespace;
  }
}

function buildWorkspaceNamespace(entries: ToolManifestEntry[], options: BuildToolRegistryOptions, state: CodeRunRegistryState): ToolNamespace {
  const workspace: ToolNamespace = {};
  for (const entry of entries) {
    const parts = entry.name.split('.').map(sanitizeToolName);
    const helper = `workspace.${parts.join('.')}`;
    setNamespaceFunction(workspace, parts, makeToolFunction(entry, helper, options, state));
  }
  return workspace;
}

function addFriendlyAliases(registry: ToolRegistry, state: CodeRunRegistryState): void {
  const fsRead = registry.fs_read as ToolFunction | undefined;
  const fsSearch = registry.fs_search as ToolFunction | undefined;
  const fsList = registry.fs_list as ToolFunction | undefined;
  const fsWrite = registry.fs_write as ToolFunction | undefined;
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
  const entriesByName = new Map<string, ToolManifestEntry>();
  for (const entry of manifestEntries) {
    entriesByName.set(entry.name, entry);
    const helper = sanitizeToolName(entry.name);
    registry[helper] = makeToolFunction(entry, helper, options, state);
  }
  const genericCall = makeGenericWorkspaceCall(entriesByName, options, state);
  registry.workspace_call = genericCall;
  registry.workspaceCall = genericCall;
  registry.callTool = genericCall;
  registry.workspace = buildWorkspaceNamespace(manifestEntries, options, state);
  addFriendlyAliases(registry, state);
  return registry;
}
