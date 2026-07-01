export type ErrorCode =
  | 'OK'
  | 'VALIDATION_ERROR'
  | 'AMBIGUOUS_TASK_SELECTION'
  | 'WORKTREE_NOT_FOUND'
  | 'COMMAND_FAILED'
  | 'TIMEOUT'
  | 'PARSE_ERROR'
  | 'NOT_FOUND'
  | 'TASK_SESSION_NOT_FOUND'
  | 'TASK_SESSION_REQUIRED'
  | 'DRY_RUN';

export type ToolCapabilities = {
  readOnly: boolean;
  mutating: boolean;
  deterministic: boolean;
  safeToRetry: boolean;
};

export type ToolResult<TData = unknown> = {
  now: string;
  ok: boolean;
  code: ErrorCode;
  message: string;
  data: TData;
  stderr: string;
  exitCode: number;
  durationMs: number;
  traceId: string;
  requestId?: string;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  detail?: string;
  changed?: boolean;
  apiVersion: '1.0.0';
};

export type CommandArgumentKind = 'value' | 'boolean' | 'array' | 'record' | 'commandArray';

export type CommandArgument = {
  source: string;
  flag?: string;
  kind?: CommandArgumentKind;
  required?: boolean;
};

export type BranchMode = 'none' | 'optional' | 'required';
export type BranchArgumentStyle = 'flag' | 'prefix';

export type ToolCommand = {
  script: string;
  subcommand?: string;
  branchMode?: BranchMode;
  branchArgumentStyle?: BranchArgumentStyle;
  jsonFlag?: string;
  dryRunFlag?: string;
  internal?: string;
  arguments: CommandArgument[];
};

export type ToolManifestEntry = {
  name: string;
  methodPath: string[];
  description: string;
  category: string;
  underlying: string;
  capabilities: ToolCapabilities;
  defaultTimeout: number;
  inputSchema: string;
  outputSchema: string;
  command: ToolCommand;
  exampleInput: Record<string, unknown>;
  sessionRequired?: boolean;
};

export type ToolInput = Record<string, unknown>;

export type CommandPlan = {
  command: string;
  args: string[];
  cwd: string;
  env: Record<string, string | undefined>;
};

export type RunnerResult = {
  stdout: string;
  stderr: string;
  exitCode: number;
};

export type ToolRunner = (plan: CommandPlan, timeoutMs: number) => Promise<RunnerResult>;

export type TaskCandidate = {
  branch: string;
  area: string;
  prNumber?: number;
  worktree: string;
};

export type BranchResolution =
  | { ok: true; branch: string; source: string; candidates?: TaskCandidate[] }
  | { ok: false; code: 'AMBIGUOUS_TASK_SELECTION' | 'WORKTREE_NOT_FOUND'; message: string; candidates: TaskCandidate[] };

export type BranchResolver = (input: {
  explicitBranch?: string;
  cwd: string;
  env: NodeJS.ProcessEnv;
  currentTask?: TaskCandidate | null;
  candidates?: TaskCandidate[];
}) => BranchResolution;

export type LogMode = "all" | "errors" | "silent";

export type ExecuteToolOptions = {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  runner?: ToolRunner;
  branchResolver?: BranchResolver;
  currentTask?: TaskCandidate | null;
  candidates?: TaskCandidate[];
  now?: () => number;
  randomUUID?: () => string;
  logMode?: LogMode;
};

export type BatchStep = {
  tool: string;
  input?: ToolInput | ((previous: ToolResult<unknown> | null, results: ToolResult<unknown>[]) => ToolInput);
  args?: ToolInput | ((previous: ToolResult<unknown> | null, results: ToolResult<unknown>[]) => ToolInput);
  parallel?: boolean;
};

export type BatchResult = ToolResult<{
  results: ToolResult<unknown>[];
  completed: number;
}>;

