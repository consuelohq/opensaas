// tool function signature — all tool functions are async
export type ToolFunction = (...args: unknown[]) => Promise<unknown>;

// registry of all tool functions available in the isolate
export type ToolRegistry = Record<string, ToolFunction>;

// captured console output from the isolate
export type ConsoleOutput = {
  log: string[];
  warn: string[];
  error: string[];
};

// execution result from the isolate
export type ExecutionResult = {
  success: boolean;
  result: unknown;
  console: ConsoleOutput;
  duration: number;
  operations: number;
};

// executor configuration
export type ExecutorConfig = {
  memoryLimit: number;
  timeout: number;
  workingDirectory: string;
  maxOperations: number;
};

// MCP tool input schema
export type ExecuteCodeInput = {
  code: string;
  workingDirectory?: string;
};
