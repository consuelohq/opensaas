import type { ToolResult } from '../facade/types';

export type CodeCallLanguage = 'python' | 'bun' | 'bash';
export type CodeCallMode = 'read' | 'edit' | 'verify';

export type CodeCallMistakeClass =
  | 'shell_escaped_code'
  | 'unsupported_language'
  | 'edit_without_task'
  | 'edit_mode_gated'
  | 'mutation_in_read_mode'
  | 'timeout'
  | 'output_truncated'
  | 'runtime_missing'
  | 'cwd_out_of_scope'
  | 'invalid_source'
  | 'unsafe_shell';

export type CodeCallInput = {
  language: string;
  code?: string;
  codeFile?: string;
  stdin?: string;
  stdinFile?: string;
  mode: CodeCallMode;
  cwd?: string;
  timeout?: number;
  maxResultChars?: number;
  dryRun?: boolean;
  requestId?: string;
  taskSession?: string;
  taskWorktree?: string;
  branch?: string;
};

export type CodeCallData = {
  ok: boolean;
  exitCode: number;
  language: CodeCallLanguage;
  requestedLanguage?: string;
  runtime: string;
  mode: CodeCallMode;
  cwd: string;
  durationMs: number;
  stdout: string;
  stderr: string;
  filesChanged: string[];
  truncated: boolean;
  traceId: string;
  message?: string;
  code?: string;
  detectedMistakeClass?: CodeCallMistakeClass;
  stdoutLogPath?: string;
  stderrLogPath?: string;
};

export type CodeCallResult = ToolResult<CodeCallData>;

export type CodeCallContext = {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  now?: () => number;
  randomUUID?: () => string;
  traceId?: string;
  requestId?: string;
};
