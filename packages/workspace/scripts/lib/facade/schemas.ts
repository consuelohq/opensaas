import { z } from 'zod';

const requestFields = {
  requestId: z.string().min(1).optional(),
  taskSession: z.string().min(1).optional(),
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


export const DesignPublishInput = z.object({
  ...requestFields,
  ...dryRunField,
  target: optionalString,
  portlessName: optionalString,
  path: optionalString,
  name: optionalString,
  category: optionalString,
  tailscaleBin: optionalString,
}).refine((input) => Boolean(input.target || input.portlessName), {
  message: 'provide either target or portlessName',
  path: ['target'],
});

export const ConsueloDesignInput = z.object({
  ...requestFields,
  ...dryRunField,
});

export const ConsueloDesignUiInput = z.object({
  ...requestFields,
  ...dryRunField,
  timeout: z.number().int().positive().optional(),
});

export const ConsueloDesignSessionInput = z.object({
  ...requestFields,
  ...dryRunField,
  name: optionalString,
  prompt: optionalString,
  timeout: z.number().int().positive().optional(),
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
  content: z.string().optional(),
  contentFile: optionalString,
}).refine((input) => Boolean(input.content) !== Boolean(input.contentFile), {
  message: 'provide exactly one of content or contentFile',
  path: ['content'],
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
  ...branchField,
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
  ...branchField,
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

export const BrowserOpenInput = z.object({
  ...requestFields,
  ...dryRunField,
  url: z.string().url(),
  headed: z.boolean().optional(),
  full: z.boolean().optional(),
});

export const BrowserPageInput = z.object({
  ...requestFields,
  ...dryRunField,
  headed: z.boolean().optional(),
  full: z.boolean().optional(),
});

export const BrowserScreenshotInput = z.object({
  ...requestFields,
  ...dryRunField,
  name: optionalString,
  full: z.boolean().optional(),
});

export const BrowserElementInput = z.object({
  ...requestFields,
  ...dryRunField,
  ref: z.string().min(1),
});

export const BrowserFillInput = z.object({
  ...requestFields,
  ...dryRunField,
  ref: z.string().min(1),
  text: z.string(),
});

export const BrowserLoginInput = z.object({
  ...requestFields,
  ...dryRunField,
  name: z.string().min(1),
  headed: z.boolean().optional(),
});

export const BrowserEvalInput = z.object({
  ...requestFields,
  ...dryRunField,
  js: z.string().min(1),
});

export const BrowserRawInput = z.object({
  ...requestFields,
  ...dryRunField,
  args: z.array(z.string().min(1)).min(1),
});



export const LinearSearchInput = z.object({
  ...requestFields,
  search: optionalString,
  team: optionalString,
  first: z.number().int().positive().optional(),
  after: optionalString,
  filter: optionalString,
});

export const LinearIssueInput = z.object({
  ...requestFields,
  identifier: z.string().min(1),
});

export const LinearCreateIssueInput = z.object({
  ...requestFields,
  ...dryRunField,
  title: z.string().min(1),
  description: optionalString,
  team: optionalString,
  state: optionalString,
  labels: stringArray,
  priority: z.number().int().min(0).max(4).optional(),
  assignee: optionalString,
  project: optionalString,
  cycle: optionalString,
  parent: optionalString,
});

export const LinearUpdateIssueInput = z.object({
  ...requestFields,
  ...dryRunField,
  issueId: z.string().min(1),
  title: optionalString,
  description: optionalString,
  state: optionalString,
  labels: stringArray,
  priority: z.number().int().min(0).max(4).optional(),
  assignee: optionalString,
  project: optionalString,
  cycle: optionalString,
  parent: optionalString,
});

export const LinearListInput = z.object({
  ...requestFields,
  first: z.number().int().positive().optional(),
  after: optionalString,
});

export const LinearTeamScopedListInput = z.object({
  ...requestFields,
  team: optionalString,
});

export const SentryConfigInput = z.object({
  ...requestFields,
  verify: z.boolean().optional(),
});

export const SentryProjectsInput = z.object({
  ...requestFields,
  limit: z.number().int().positive().optional(),
  cursor: optionalString,
});

export const SentryIssuesInput = z.object({
  ...requestFields,
  query: optionalString,
  project: optionalString,
  environment: stringArray,
  sort: optionalString,
  statsPeriod: optionalString,
  start: optionalString,
  end: optionalString,
  cursor: optionalString,
  limit: z.number().int().positive().optional(),
  expand: stringArray,
  collapse: stringArray,
});

export const SentryIssueInput = z.object({
  ...requestFields,
  identifier: z.string().min(1),
  expand: stringArray,
});

export const SentryIssueEventInput = z.object({
  ...requestFields,
  issueId: z.string().min(1),
  eventId: optionalString,
  full: z.boolean().optional(),
});

export const SentryEventInput = z.object({
  ...requestFields,
  eventId: z.string().min(1),
  project: optionalString,
});

export const SentryTraceInput = z.object({
  ...requestFields,
  traceId: z.string().min(1),
  project: optionalString,
  query: optionalString,
  statsPeriod: optionalString,
  dataset: optionalString,
  field: stringArray,
  cursor: optionalString,
  limit: z.number().int().positive().optional(),
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


export const ResearchIngestInput = z.object({
  ...requestFields,
  ...dryRunField,
  source: z.string().min(1),
  question: optionalString,
  mode: z.enum(['quick', 'standard', 'deep']).optional(),
  visual: z.boolean().optional(),
  slidesMax: z.number().int().positive().optional(),
  videoMode: z.enum(['auto', 'transcript', 'understand']).optional(),
  keep: z.boolean().optional(),
  outDir: optionalString,
  summarizeBin: optionalString,
  contextTitle: optionalString,
  contextCategory: optionalString,
  noContextSave: z.boolean().optional(),
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
  DesignPublishInput,
  ConsueloDesignInput,
  ConsueloDesignUiInput,
  ConsueloDesignSessionInput,
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
  BrowserOpenInput,
  BrowserPageInput,
  BrowserScreenshotInput,
  BrowserElementInput,
  BrowserFillInput,
  BrowserLoginInput,
  BrowserEvalInput,
  BrowserRawInput,
  LinearSearchInput,
  LinearIssueInput,
  LinearCreateIssueInput,
  LinearUpdateIssueInput,
  LinearListInput,
  LinearTeamScopedListInput,
  SentryConfigInput,
  SentryProjectsInput,
  SentryIssuesInput,
  SentryIssueInput,
  SentryIssueEventInput,
  SentryEventInput,
  SentryTraceInput,
  WaitInput,
  TmpInput,
  ResearchIngestInput,
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
  EmptyInput: '{ requestId?: string; taskSession?: string; dryRun?: boolean }',
  BranchInput: '{ branch?: string; requestId?: string; taskSession?: string; dryRun?: boolean }',
  ConsueloDesignInput: '{ requestId?: string; taskSession?: string; dryRun?: boolean }',
  ConsueloDesignUiInput: '{ requestId?: string; taskSession?: string; dryRun?: boolean; timeout?: number }',
  ConsueloDesignSessionInput: '{ requestId?: string; taskSession?: string; dryRun?: boolean; name?: string; prompt?: string; timeout?: number }',
  FsReadInput: '{ path: string; from?: number; to?: number; branch?: string; requestId?: string; taskSession?: string }',
  FsSearchInput: '{ pattern: string; paths?: string[]; include?: string; context?: number; maxResults?: number; branch?: string; requestId?: string; taskSession?: string }',
  FsListInput: '{ path?: string; pattern?: string; depth?: number; tree?: boolean; dirs?: boolean; files?: boolean; branch?: string; requestId?: string; taskSession?: string }',
  FsWriteInput: '{ path: string; content: string; force?: boolean; append?: boolean; mkdirs?: boolean; branch?: string; dryRun?: boolean; requestId?: string; taskSession?: string }',
  FsPatchInput: '{ path: string; from: number; to: number; content?: string; contentFile?: string; branch?: string; dryRun?: boolean; requestId?: string; taskSession?: string }',
  FsHttpInput: '{ url: string; method?: "get" | "post" | "put" | "patch" | "delete" | "head"; headers?: Record<string, string>; body?: string; dryRun?: boolean; requestId?: string; taskSession?: string }',
  HttpInput: '{ url: string; method?: "get" | "post" | "put" | "patch" | "delete" | "head"; headers?: Record<string, string>; body?: string; dryRun?: boolean; requestId?: string; taskSession?: string }',
  FsTrashInput: '{ path: string; branch?: string; dryRun?: boolean; requestId?: string; taskSession?: string }',
  TaskStartInput: '{ stream?: string; area?: string; title: string; description?: string; bodyFile?: string; startFrom?: "main" | "stream"; dryRun?: boolean; requestId?: string; taskSession?: string }',
  TaskInitInput: '{ area: string; branch: string; pr?: number; worktree?: string; dryRun?: boolean; requestId?: string; taskSession?: string }',
  TaskPushInput: '{ branch?: string; message: string; changed?: boolean; files?: string[]; noVerify?: boolean; dryRun?: boolean; requestId?: string; taskSession?: string }',
  TaskPrInput: '{ branch?: string; taskOnly?: boolean; draft?: boolean; ready?: boolean; bodyTemplate?: string; dryRun?: boolean; requestId?: string; taskSession?: string }',
  TaskMergeInput: '{ pr?: number; wait?: boolean; squash?: boolean; dryRun?: boolean; requestId?: string; taskSession?: string }',
  TaskCleanupInput: '{ branch?: string; force?: boolean; preview?: boolean; merged?: boolean; staleDays?: number; keep?: string; dryRun?: boolean; requestId?: string; taskSession?: string }',
  TaskExecInput: '{ branch?: string; command: string[]; timeout?: number; dryRun?: boolean; requestId?: string; taskSession?: string }',
  ContextSearchInput: '{ keyword: string; limit?: number; category?: string; requestId?: string; taskSession?: string }',
  ContextFindInput: '{ keyword: string; limit?: number; requestId?: string; taskSession?: string }',
  ContextGetInput: '{ index: number; keyword: string; requestId?: string; taskSession?: string }',
  ContextListInput: '{ category?: string; limit?: number; requestId?: string; taskSession?: string }',
  ContextSaveInput: '{ title: string; file?: string; content?: string; category?: string; dryRun?: boolean; requestId?: string; taskSession?: string }',
  ExploreInput: '{ query: string; limit?: number; changedOnly?: boolean; reindex?: boolean; requestId?: string; taskSession?: string }',
  DecideNextInput: '{ context?: string; markRead?: string; markRelevant?: string; markIrrelevant?: string; requestId?: string; taskSession?: string }',
  ExploitInput: '{ query?: string; target?: string; requestId?: string; taskSession?: string }',
  ConfirmInput: '{ verify?: boolean; runtime?: boolean; test?: string; requestId?: string; taskSession?: string }',
  AuditInput: '{ scripts?: boolean; docs?: boolean; index?: boolean; requestId?: string; taskSession?: string }',
  StreamInput: '{ area: string; stream?: string; repo?: string; dryRun?: boolean; requestId?: string; taskSession?: string }',
  StreamListInput: '{ repo?: string; requestId?: string; taskSession?: string }',
  ReviewInput: "{ branch?: string; fix?: boolean; all?: boolean; base?: string; strict?: boolean; mine?: boolean; noTests?: boolean; requestId?: string; taskSession?: string }",
  VerifyInput: '{ branch?: string; base?: string; noReview?: boolean; noDb?: boolean; dbWarnOnly?: boolean; noStamp?: boolean; dryRun?: boolean; requestId?: string; taskSession?: string }',
  PrReviewInput: '{ pr?: number; stdout?: boolean; dryRun?: boolean; requestId?: string; taskSession?: string }',
  AiReviewInput: '{ pr?: number; noPost?: boolean; dryRun?: boolean; requestId?: string; taskSession?: string }',
  GhInput: '{ action: string; args?: string[]; dryRun?: boolean; requestId?: string; taskSession?: string }',
  BrowserInput: '{ command?: string; url?: string; args?: string[]; dryRun?: boolean; requestId?: string; taskSession?: string }',
  BrowserOpenInput: '{ url: string; headed?: boolean; full?: boolean; dryRun?: boolean; requestId?: string; taskSession?: string }',
  BrowserPageInput: '{ headed?: boolean; full?: boolean; dryRun?: boolean; requestId?: string; taskSession?: string }',
  BrowserScreenshotInput: '{ name?: string; full?: boolean; dryRun?: boolean; requestId?: string; taskSession?: string }',
  BrowserElementInput: '{ ref: string; dryRun?: boolean; requestId?: string; taskSession?: string }',
  BrowserFillInput: '{ ref: string; text: string; dryRun?: boolean; requestId?: string; taskSession?: string }',
  BrowserLoginInput: '{ name: string; headed?: boolean; dryRun?: boolean; requestId?: string; taskSession?: string }',
  BrowserEvalInput: '{ js: string; dryRun?: boolean; requestId?: string; taskSession?: string }',
  BrowserRawInput: '{ args: string[]; dryRun?: boolean; requestId?: string; taskSession?: string }',
  LinearSearchInput: '{ search?: string; team?: string; first?: number; after?: string; filter?: string; requestId?: string; taskSession?: string }',
  LinearIssueInput: '{ identifier: string; requestId?: string; taskSession?: string }',
  LinearCreateIssueInput: '{ title: string; description?: string; team?: string; state?: string; labels?: string[]; priority?: number; assignee?: string; project?: string; cycle?: string; parent?: string; dryRun?: boolean; requestId?: string; taskSession?: string }',
  LinearUpdateIssueInput: '{ issueId: string; title?: string; description?: string; state?: string; labels?: string[]; priority?: number; assignee?: string; project?: string; cycle?: string; parent?: string; dryRun?: boolean; requestId?: string; taskSession?: string }',
  LinearListInput: '{ first?: number; after?: string; requestId?: string; taskSession?: string }',
  LinearTeamScopedListInput: '{ team?: string; requestId?: string; taskSession?: string }',
  SentryConfigInput: '{ verify?: boolean; requestId?: string; taskSession?: string }',
  SentryProjectsInput: '{ limit?: number; cursor?: string; requestId?: string; taskSession?: string }',
  SentryIssuesInput: '{ query?: string; project?: string; environment?: string[]; sort?: string; statsPeriod?: string; start?: string; end?: string; cursor?: string; limit?: number; expand?: string[]; collapse?: string[]; requestId?: string; taskSession?: string }',
  SentryIssueInput: '{ identifier: string; expand?: string[]; requestId?: string; taskSession?: string }',
  SentryIssueEventInput: '{ issueId: string; eventId?: string; full?: boolean; requestId?: string; taskSession?: string }',
  SentryEventInput: '{ eventId: string; project?: string; requestId?: string; taskSession?: string }',
  SentryTraceInput: '{ traceId: string; project?: string; query?: string; statsPeriod?: string; dataset?: string; field?: string[]; cursor?: string; limit?: number; requestId?: string; taskSession?: string }',
  WaitInput: '{ seconds?: number; deploy?: boolean; pr?: number; requestId?: string; taskSession?: string }',
  TmpInput: '{ action: string; name?: string; content?: string; ext?: string; dryRun?: boolean; requestId?: string; taskSession?: string }',
  ResearchIngestInput: '{ source: string; question?: string; mode?: "quick" | "standard" | "deep"; visual?: boolean; slidesMax?: number; videoMode?: "auto" | "transcript" | "understand"; keep?: boolean; outDir?: string; summarizeBin?: string; contextTitle?: string; contextCategory?: string; noContextSave?: boolean; dryRun?: boolean; requestId?: string; taskSession?: string }',
  RailwayLogsInput: '{ service?: string; build?: boolean; errors?: boolean; network?: boolean; raw?: boolean; status?: boolean; filter?: string; lines?: number; requestId?: string; taskSession?: string }',
  RailwayRedeployInput: '{ service?: string; all?: boolean; wait?: boolean; dryRun?: boolean; requestId?: string; taskSession?: string }',
  WebsiteDeployInput: '{ preview?: boolean; buildOnly?: boolean; dryRun?: boolean; requestId?: string; taskSession?: string }',
  ServerInput: '{ action: "status" | "restart" | "stop" | "start" | "logs"; dryRun?: boolean; requestId?: string; taskSession?: string }',
  CheckFilesInput: '{ branch?: string; files: string[]; stopOnFirstError?: boolean; requestId?: string; taskSession?: string }',
  EditFlowInput: '{ branch?: string; searchPattern: string; searchPaths: string[]; from: number; to: number; contentFile: string; dryRun?: boolean; requestId?: string; taskSession?: string }',
  MacExecInput: '{ command: string; cwd?: string; timeout?: number; dryRun?: boolean; requestId?: string; taskSession?: string }',
  MacReadInput: '{ path: string; requestId?: string; taskSession?: string }',
  MacWriteInput: '{ path: string; content?: string; contentFile?: string; dryRun?: boolean; requestId?: string; taskSession?: string }',
  MacSearchInput: '{ pattern: string; path?: string; include?: string; requestId?: string; taskSession?: string }',
  MacListInput: '{ path?: string; depth?: number; requestId?: string; taskSession?: string }',
  MacProcessInput: '{ action: "list" | "kill"; pid?: number; name?: string; dryRun?: boolean; requestId?: string; taskSession?: string }',
  MacPortInput: '{ action: "check" | "find"; port?: number; requestId?: string; taskSession?: string }',
};

export const outputTypeSignatures: Record<string, string> = {
  RawOutput: '{ raw?: string; [key: string]: unknown } | null',
  FsReadOutput: 'Array<{ path: string; from: number; to: number; total: number; lines: string[] }>',
  FsSearchOutput: 'Array<{ file: string; line: number; text: string }>',
  TaskCurrentOutput: '{ branch: string; area: string; prNumber?: number; worktree: string } | null',
  TaskPinOutput: '{ branch: string }',
  TaskEnsureSyncedOutput: '{ synced: boolean; branch: string; area: string; behind?: number; action?: string }',
};
