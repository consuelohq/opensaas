// tool function signature — all tool functions are async
export type ToolFunction = (...args: unknown[]) => Promise<unknown>;

// nested namespace of tool functions, such as workspace.fs.read
export type ToolNamespace = { [key: string]: ToolValue };
export type ToolValue = ToolFunction | ToolNamespace;

// registry of all helper values available in code.run
export type ToolRegistry = Record<string, ToolValue>;

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
