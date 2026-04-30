import { z } from 'zod';

const requestFields = {
  requestId: z.string().min(1).optional(),
};

const dryRunField = {
  dryRun: z.boolean().optional(),
};

const branchField = {
  branch: z.string().min(1).optional(),
};

const optionalString = z.string().min(1).optional();
const stringArray = z.array(z.string().min(1)).optional();

export const EmptyInput = z.object({
  ...requestFields,
  ...dryRunField,
});

export const BranchInput = z.object({
  ...requestFields,
  ...dryRunField,
  ...branchField,
});

export const FsReadInput = z.object({
  ...requestFields,
  ...branchField,
  path: z.string().min(1),
  from: z.number().int().positive().optional(),
  to: z.number().int().positive().optional(),
});

export const FsSearchInput = z.object({
  ...requestFields,
  ...branchField,
  pattern: z.string().min(1),
  paths: stringArray,
  include: optionalString,
  context: z.number().int().nonnegative().optional(),
  maxResults: z.number().int().positive().optional(),
});

export const FsListInput = z.object({
  ...requestFields,
  ...branchField,
  path: optionalString,
  pattern: optionalString,
  depth: z.number().int().positive().optional(),
  tree: z.boolean().optional(),
  dirs: z.boolean().optional(),
  files: z.boolean().optional(),
});

export const FsWriteInput = z.object({
  ...requestFields,
  ...dryRunField,
  ...branchField,
  path: z.string().min(1),
  content: z.string(),
  force: z.boolean().optional(),
  append: z.boolean().optional(),
  mkdirs: z.boolean().optional(),
});

export const FsPatchInput = z.object({
  ...requestFields,
  ...dryRunField,
  ...branchField,
  path: z.string().min(1),
  from: z.number().int().positive(),
  to: z.number().int().positive(),
  content: z.string(),
});

export const FsHttpInput = z.object({
  ...requestFields,
  ...dryRunField,
  method: z.enum(['get', 'post', 'put', 'patch', 'delete', 'head']).optional(),
  url: z.string().url(),
  headers: z.record(z.string(), z.string()).optional(),
  body: z.string().optional(),
});

export const FsTrashInput = z.object({
  ...requestFields,
  ...dryRunField,
  ...branchField,
  path: z.string().min(1),
});

export const TaskStartInput = z.object({
  ...requestFields,
  ...dryRunField,
  area: optionalString,
  stream: optionalString,
  title: z.string().min(1),
  description: optionalString,
  bodyFile: optionalString,
  startFrom: z.enum(['main', 'stream']).optional(),
}).refine((input) => Boolean(input.area || input.stream), {
  message: 'provide either area or stream',
  path: ['area'],
});

export const TaskInitInput = z.object({
  ...requestFields,
  ...dryRunField,
  area: z.string().min(1),
  branch: z.string().min(1),
  pr: z.number().int().positive().optional(),
  worktree: optionalString,
});

export const TaskPushInput = z.object({
  ...requestFields,
  ...dryRunField,
  ...branchField,
  message: z.string().min(1),
  changed: z.boolean().optional(),
  files: stringArray,
  noVerify: z.boolean().optional(),
});

export const TaskPrInput = z.object({
  ...requestFields,
  ...dryRunField,
  ...branchField,
  taskOnly: z.boolean().optional(),
  draft: z.boolean().optional(),
  ready: z.boolean().optional(),
  bodyTemplate: optionalString,
});

export const TaskMergeInput = z.object({
  ...requestFields,
  ...dryRunField,
  pr: z.number().int().positive().optional(),
  wait: z.boolean().optional(),
  squash: z.boolean().optional(),
});

export const TaskCleanupInput = z.object({
  ...requestFields,
  ...dryRunField,
  ...branchField,
  force: z.boolean().optional(),
  preview: z.boolean().optional(),
  merged: z.boolean().optional(),
  staleDays: z.number().int().positive().optional(),
  keep: optionalString,
});

export const TaskExecInput = z.object({
  ...requestFields,
  ...dryRunField,
  ...branchField,
  command: z.array(z.string().min(1)).min(1),
  timeout: z.number().int().positive().optional(),
});

export const ContextSearchInput = z.object({
  ...requestFields,
  keyword: z.string().min(1),
  limit: z.number().int().positive().optional(),
  category: optionalString,
});

export const ContextFindInput = z.object({
  ...requestFields,
  keyword: z.string().min(1),
  limit: z.number().int().positive().optional(),
});

export const ContextGetInput = z.object({
  ...requestFields,
  index: z.number().int().positive(),
  keyword: z.string().min(1),
});

export const ContextListInput = z.object({
  ...requestFields,
  category: optionalString,
  limit: z.number().int().positive().optional(),
});

export const ContextSaveInput = z.object({
  ...requestFields,
  ...dryRunField,
  title: z.string().min(1),
  file: optionalString,
  content: optionalString,
  category: optionalString,
});

export const ExploreInput = z.object({
  ...requestFields,
  query: z.string().min(1),
  limit: z.number().int().positive().optional(),
  changedOnly: z.boolean().optional(),
  reindex: z.boolean().optional(),
});

export const DecideNextInput = z.object({
  ...requestFields,
  context: optionalString,
  markRead: optionalString,
  markRelevant: optionalString,
  markIrrelevant: optionalString,
});

export const ExploitInput = z.object({
  ...requestFields,
  query: optionalString,
  target: optionalString,
});

export const ConfirmInput = z.object({
  ...requestFields,
  verify: z.boolean().optional(),
  runtime: z.boolean().optional(),
  test: optionalString,
});

export const AuditInput = z.object({
  ...requestFields,
  scripts: z.boolean().optional(),
  docs: z.boolean().optional(),
  index: z.boolean().optional(),
});

export const StreamInput = z.object({
  ...requestFields,
  ...dryRunField,
  area: z.string().min(1),
  stream: optionalString,
  repo: optionalString,
});

export const StreamListInput = z.object({
  ...requestFields,
  repo: optionalString,
});

export const ReviewInput = z.object({
  ...requestFields,
  fix: z.boolean().optional(),
  all: z.boolean().optional(),
  base: optionalString,
  strict: z.boolean().optional(),
  mine: z.boolean().optional(),
  noTests: z.boolean().optional(),
});

export const VerifyInput = z.object({
  ...requestFields,
  ...dryRunField,
  base: optionalString,
  noReview: z.boolean().optional(),
  noDb: z.boolean().optional(),
  dbWarnOnly: z.boolean().optional(),
  noStamp: z.boolean().optional(),
});

export const PrReviewInput = z.object({
  ...requestFields,
  ...dryRunField,
  pr: z.number().int().positive().optional(),
  stdout: z.boolean().optional(),
});

export const AiReviewInput = z.object({
  ...requestFields,
  ...dryRunField,
  pr: z.number().int().positive().optional(),
  noPost: z.boolean().optional(),
});

export const GhInput = z.object({
  ...requestFields,
  ...dryRunField,
  action: z.string().min(1),
  args: stringArray,
});

export const BrowserInput = z.object({
  ...requestFields,
  ...dryRunField,
  command: optionalString,
  url: optionalString,
  args: stringArray,
});

export const WaitInput = z.object({
  ...requestFields,
  seconds: z.number().int().positive().optional(),
  deploy: z.boolean().optional(),
  pr: z.number().int().positive().optional(),
});

export const TmpInput = z.object({
  ...requestFields,
  ...dryRunField,
  action: z.string().min(1),
  name: optionalString,
  content: optionalString,
  ext: optionalString,
});

export const RailwayLogsInput = z.object({
  ...requestFields,
  service: optionalString,
  build: z.boolean().optional(),
  errors: z.boolean().optional(),
  network: z.boolean().optional(),
  raw: z.boolean().optional(),
  status: z.boolean().optional(),
  filter: optionalString,
  lines: z.number().int().positive().optional(),
});

export const RailwayRedeployInput = z.object({
  ...requestFields,
  ...dryRunField,
  service: optionalString,
  all: z.boolean().optional(),
  wait: z.boolean().optional(),
});

export const WebsiteDeployInput = z.object({
  ...requestFields,
  ...dryRunField,
  preview: z.boolean().optional(),
  buildOnly: z.boolean().optional(),
});

export const ServerInput = z.object({
  ...requestFields,
  ...dryRunField,
  action: z.enum(['status', 'restart', 'stop', 'start', 'logs']),
});

export const CheckFilesInput = z.object({
  ...requestFields,
  ...branchField,
  files: z.array(z.string().min(1)).min(1),
  stopOnFirstError: z.boolean().optional(),
});

export const EditFlowInput = z.object({
  ...requestFields,
  ...dryRunField,
  ...branchField,
  searchPattern: z.string().min(1),
  searchPaths: z.array(z.string().min(1)).min(1),
  from: z.number().int().positive(),
  to: z.number().int().positive(),
  contentFile: z.string().min(1),
});

export const MacExecInput = z.object({
  ...requestFields,
  ...dryRunField,
  command: z.string().min(1),
  cwd: optionalString,
  timeout: z.number().int().positive().optional(),
});

export const MacReadInput = z.object({
  ...requestFields,
  path: z.string().min(1),
});

export const MacWriteInput = z.object({
  ...requestFields,
  ...dryRunField,
  path: z.string().min(1),
  content: z.string().optional(),
  contentFile: optionalString,
});

export const MacSearchInput = z.object({
  ...requestFields,
  pattern: z.string().min(1),
  path: optionalString,
  include: optionalString,
});

export const MacListInput = z.object({
  ...requestFields,
  path: optionalString,
  depth: z.number().int().positive().optional(),
});

export const MacProcessInput = z.object({
  ...requestFields,
  ...dryRunField,
  action: z.enum(['list', 'kill']),
  pid: z.number().int().positive().optional(),
  name: optionalString,
});

export const MacPortInput = z.object({
  ...requestFields,
  action: z.enum(['check', 'find']),
  port: z.number().int().positive().optional(),
});

export const schemaRegistry = {
  EmptyInput,
  BranchInput,
  FsReadInput,
  FsSearchInput,
  FsListInput,
  FsWriteInput,
  FsPatchInput,
  FsHttpInput,
  HttpInput: FsHttpInput,
  FsTrashInput,
  TaskStartInput,
  TaskInitInput,
  TaskPushInput,
  TaskPrInput,
  TaskMergeInput,
  TaskCleanupInput,
  TaskExecInput,
  ContextSearchInput,
  ContextFindInput,
  ContextGetInput,
  ContextListInput,
  ContextSaveInput,
  ExploreInput,
  DecideNextInput,
  ExploitInput,
  ConfirmInput,
  AuditInput,
  StreamInput,
  StreamListInput,
  ReviewInput,
  VerifyInput,
  PrReviewInput,
  AiReviewInput,
  GhInput,
  BrowserInput,
  WaitInput,
  TmpInput,
  RailwayLogsInput,
  RailwayRedeployInput,
  WebsiteDeployInput,
  ServerInput,
  CheckFilesInput,
  EditFlowInput,
  MacExecInput,
  MacReadInput,
  MacWriteInput,
  MacSearchInput,
  MacListInput,
  MacProcessInput,
  MacPortInput,
} satisfies Record<string, z.ZodType<unknown>>;

export type SchemaName = keyof typeof schemaRegistry;

export function getInputSchema(name: string): z.ZodType<unknown> | null {
  return name in schemaRegistry ? schemaRegistry[name as SchemaName] : null;
}

export const schemaTypeSignatures: Record<string, string> = {
  EmptyInput: '{ requestId?: string; dryRun?: boolean }',
  BranchInput: '{ branch?: string; requestId?: string; dryRun?: boolean }',
  FsReadInput: '{ path: string; from?: number; to?: number; branch?: string; requestId?: string }',
  FsSearchInput: '{ pattern: string; paths?: string[]; include?: string; context?: number; maxResults?: number; branch?: string; requestId?: string }',
  FsListInput: '{ path?: string; pattern?: string; depth?: number; tree?: boolean; dirs?: boolean; files?: boolean; branch?: string; requestId?: string }',
  FsWriteInput: '{ path: string; content: string; force?: boolean; append?: boolean; mkdirs?: boolean; branch?: string; dryRun?: boolean; requestId?: string }',
  FsPatchInput: '{ path: string; from: number; to: number; content: string; branch?: string; dryRun?: boolean; requestId?: string }',
  FsHttpInput: '{ url: string; method?: "get" | "post" | "put" | "patch" | "delete" | "head"; headers?: Record<string, string>; body?: string; dryRun?: boolean; requestId?: string }',
  HttpInput: '{ url: string; method?: "get" | "post" | "put" | "patch" | "delete" | "head"; headers?: Record<string, string>; body?: string; dryRun?: boolean; requestId?: string }',
  FsTrashInput: '{ path: string; branch?: string; dryRun?: boolean; requestId?: string }',
  TaskStartInput: '{ stream?: string; area?: string; title: string; description?: string; bodyFile?: string; startFrom?: "main" | "stream"; dryRun?: boolean; requestId?: string }',
  TaskInitInput: '{ area: string; branch: string; pr?: number; worktree?: string; dryRun?: boolean; requestId?: string }',
  TaskPushInput: '{ branch?: string; message: string; changed?: boolean; files?: string[]; noVerify?: boolean; dryRun?: boolean; requestId?: string }',
  TaskPrInput: '{ branch?: string; taskOnly?: boolean; draft?: boolean; ready?: boolean; bodyTemplate?: string; dryRun?: boolean; requestId?: string }',
  TaskMergeInput: '{ pr?: number; wait?: boolean; squash?: boolean; dryRun?: boolean; requestId?: string }',
  TaskCleanupInput: '{ branch?: string; force?: boolean; preview?: boolean; merged?: boolean; staleDays?: number; keep?: string; dryRun?: boolean; requestId?: string }',
  TaskExecInput: '{ branch?: string; command: string[]; timeout?: number; dryRun?: boolean; requestId?: string }',
  ContextSearchInput: '{ keyword: string; limit?: number; category?: string; requestId?: string }',
  ContextFindInput: '{ keyword: string; limit?: number; requestId?: string }',
  ContextGetInput: '{ index: number; keyword: string; requestId?: string }',
  ContextListInput: '{ category?: string; limit?: number; requestId?: string }',
  ContextSaveInput: '{ title: string; file?: string; content?: string; category?: string; dryRun?: boolean; requestId?: string }',
  ExploreInput: '{ query: string; limit?: number; changedOnly?: boolean; reindex?: boolean; requestId?: string }',
  DecideNextInput: '{ context?: string; markRead?: string; markRelevant?: string; markIrrelevant?: string; requestId?: string }',
  ExploitInput: '{ query?: string; target?: string; requestId?: string }',
  ConfirmInput: '{ verify?: boolean; runtime?: boolean; test?: string; requestId?: string }',
  AuditInput: '{ scripts?: boolean; docs?: boolean; index?: boolean; requestId?: string }',
  StreamInput: '{ area: string; stream?: string; repo?: string; dryRun?: boolean; requestId?: string }',
  StreamListInput: '{ repo?: string; requestId?: string }',
  ReviewInput: '{ fix?: boolean; all?: boolean; base?: string; strict?: boolean; mine?: boolean; noTests?: boolean; requestId?: string }',
  VerifyInput: '{ base?: string; noReview?: boolean; noDb?: boolean; dbWarnOnly?: boolean; noStamp?: boolean; dryRun?: boolean; requestId?: string }',
  PrReviewInput: '{ pr?: number; stdout?: boolean; dryRun?: boolean; requestId?: string }',
  AiReviewInput: '{ pr?: number; noPost?: boolean; dryRun?: boolean; requestId?: string }',
  GhInput: '{ action: string; args?: string[]; dryRun?: boolean; requestId?: string }',
  BrowserInput: '{ command?: string; url?: string; args?: string[]; dryRun?: boolean; requestId?: string }',
  WaitInput: '{ seconds?: number; deploy?: boolean; pr?: number; requestId?: string }',
  TmpInput: '{ action: string; name?: string; content?: string; ext?: string; dryRun?: boolean; requestId?: string }',
  RailwayLogsInput: '{ service?: string; build?: boolean; errors?: boolean; network?: boolean; raw?: boolean; status?: boolean; filter?: string; lines?: number; requestId?: string }',
  RailwayRedeployInput: '{ service?: string; all?: boolean; wait?: boolean; dryRun?: boolean; requestId?: string }',
  WebsiteDeployInput: '{ preview?: boolean; buildOnly?: boolean; dryRun?: boolean; requestId?: string }',
  ServerInput: '{ action: "status" | "restart" | "stop" | "start" | "logs"; dryRun?: boolean; requestId?: string }',
  CheckFilesInput: '{ branch?: string; files: string[]; stopOnFirstError?: boolean; requestId?: string }',
  EditFlowInput: '{ branch?: string; searchPattern: string; searchPaths: string[]; from: number; to: number; contentFile: string; dryRun?: boolean; requestId?: string }',
  MacExecInput: '{ command: string; cwd?: string; timeout?: number; dryRun?: boolean; requestId?: string }',
  MacReadInput: '{ path: string; requestId?: string }',
  MacWriteInput: '{ path: string; content?: string; contentFile?: string; dryRun?: boolean; requestId?: string }',
  MacSearchInput: '{ pattern: string; path?: string; include?: string; requestId?: string }',
  MacListInput: '{ path?: string; depth?: number; requestId?: string }',
  MacProcessInput: '{ action: "list" | "kill"; pid?: number; name?: string; dryRun?: boolean; requestId?: string }',
  MacPortInput: '{ action: "check" | "find"; port?: number; requestId?: string }',
};

export const outputTypeSignatures: Record<string, string> = {
  RawOutput: '{ raw?: string; [key: string]: unknown } | null',
  FsReadOutput: 'Array<{ path: string; from: number; to: number; total: number; lines: string[] }>',
  FsSearchOutput: 'Array<{ file: string; line: number; text: string }>',
  TaskCurrentOutput: '{ branch: string; area: string; prNumber?: number; worktree: string } | null',
  TaskPinOutput: '{ branch: string }',
  TaskEnsureSyncedOutput: '{ synced: boolean; branch: string; area: string; behind?: number; action?: string }',
};
