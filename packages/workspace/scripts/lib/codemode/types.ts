import type { ToolInput, ToolResult } from '../facade/types';

export type ToolFunction = (...args: unknown[]) => unknown | Promise<unknown>;
export type ToolNamespace = Record<string, ToolValue>;
export type ToolValue = ToolFunction | ToolNamespace;
export type ToolRegistry = Record<string, ToolValue>;

export type ConsoleOutput = {
  log: string[];
  warn: string[];
  error: string[];
};

export type ExecutorConfig = {
  memoryLimit: number;
  timeout: number;
  workingDirectory: string;
  maxOperations: number;
};

export type ExecutionResult = {
  success: boolean;
  result: unknown;
  console: ConsoleOutput;
  duration: number;
  operations: number;
};

export type CodeRunMode = 'read' | 'edit' | 'verify';

export type CodeRunOperation = {
  tool: string;
  input: ToolInput;
  ok: boolean;
  code: ToolResult['code'];
  message: string;
  traceId: string;
  durationMs: number;
};

export type CodeRunRegistryState = {
  operations: CodeRunOperation[];
  blockedTools: string[];
  changedFiles: Set<string>;
};
