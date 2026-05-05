export type ErrorCode =
  | "OK"
  | "VALIDATION_ERROR"
  | "AMBIGUOUS_TASK_SELECTION"
  | "WORKTREE_NOT_FOUND"
  | "COMMAND_FAILED"
  | "TIMEOUT"
  | "PARSE_ERROR"
  | "NOT_FOUND"
  | "DRY_RUN";

export type ToolResult<TData = unknown> = {
  ok: boolean;
  code: ErrorCode;
  message: string;
  data: TData;
  stderr: string;
  exitCode: number;
  durationMs: number;
  traceId: string;
  requestId?: string;
  apiVersion: "1.0.0";
};

export type BatchStep = {
  tool: string;
  input?: Record<string, unknown>;
  args?: Record<string, unknown>;
  parallel?: boolean;
};

declare const workspace: {
  browser: {
    app: (input: { headed?: boolean; full?: boolean; dryRun?: boolean; requestId?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>;
    click: (input: { ref: string; dryRun?: boolean; requestId?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>;
    close: (input: { requestId?: string; dryRun?: boolean }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>;
    consuelo: (input: { headed?: boolean; full?: boolean; dryRun?: boolean; requestId?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>;
    eval: (input: { js: string; dryRun?: boolean; requestId?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>;
    fill: (input: { ref: string; text: string; dryRun?: boolean; requestId?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>;
    login: (input: { name: string; headed?: boolean; dryRun?: boolean; requestId?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>;
    open: (input: { url: string; headed?: boolean; full?: boolean; dryRun?: boolean; requestId?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>;
    raw: (input: { args: string[]; dryRun?: boolean; requestId?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>;
    reauth: (input: { name: string; headed?: boolean; dryRun?: boolean; requestId?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>;
    run: (input: { command?: string; url?: string; args?: string[]; dryRun?: boolean; requestId?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>;
    screenshot: (input: { name?: string; full?: boolean; dryRun?: boolean; requestId?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>;
    snap: (input: { requestId?: string; dryRun?: boolean }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>;
    test: (input: { url: string; headed?: boolean; full?: boolean; dryRun?: boolean; requestId?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>;
  };
  consueloDesign: {
    check: (input: { requestId?: string; dryRun?: boolean }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>;
    generateDemo: (input: { requestId?: string; dryRun?: boolean; name?: string; prompt?: string; timeout?: number }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>;
    generateDigitalEguide: (input: { requestId?: string; dryRun?: boolean; name?: string; prompt?: string; timeout?: number }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>;
    generateEmail: (input: { requestId?: string; dryRun?: boolean; name?: string; prompt?: string; timeout?: number }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>;
    generateImageBrief: (input: { requestId?: string; dryRun?: boolean; name?: string; prompt?: string; timeout?: number }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>;
    generateMotionFrame: (input: { requestId?: string; dryRun?: boolean; name?: string; prompt?: string; timeout?: number }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>;
    generateWebsite: (input: { requestId?: string; dryRun?: boolean; name?: string; prompt?: string; timeout?: number }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>;
    getDesignSystem: (input: { requestId?: string; dryRun?: boolean }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>;
    listDesignSystems: (input: { requestId?: string; dryRun?: boolean }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>;
    listSkills: (input: { requestId?: string; dryRun?: boolean }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>;
    odBuild: (input: { requestId?: string; dryRun?: boolean; timeout?: number }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>;
    railwayCheck: (input: { requestId?: string; dryRun?: boolean }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>;
    renderHyperframes: (input: { requestId?: string; dryRun?: boolean; name?: string; prompt?: string; timeout?: number }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>;
    run: (input: { requestId?: string; dryRun?: boolean; timeout?: number }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>;
    uiBg: (input: { requestId?: string; dryRun?: boolean; timeout?: number }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>;
    uiLogs: (input: { requestId?: string; dryRun?: boolean }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>;
    uiStatus: (input: { requestId?: string; dryRun?: boolean }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>;
    uiStop: (input: { requestId?: string; dryRun?: boolean; timeout?: number }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>;
    upstreamStatus: (input: { requestId?: string; dryRun?: boolean }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>;
  };
  context: {
    categories: (input: { requestId?: string; dryRun?: boolean }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>;
    find: (input: { keyword: string; limit?: number; requestId?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>;
    get: (input: { index: number; keyword: string; requestId?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>;
    list: (input: { category?: string; limit?: number; requestId?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>;
    save: (input: { title: string; file?: string; content?: string; category?: string; dryRun?: boolean; requestId?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>;
    search: (input: { keyword: string; limit?: number; category?: string; requestId?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>;
  };
  fs: {
    http: (input: { url: string; method?: "get" | "post" | "put" | "patch" | "delete" | "head"; headers?: Record<string, string>; body?: string; dryRun?: boolean; requestId?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>;
    list: (input: { path?: string; pattern?: string; depth?: number; tree?: boolean; dirs?: boolean; files?: boolean; branch?: string; requestId?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>;
    patch: (input: { path: string; from: number; to: number; content?: string; contentFile?: string; branch?: string; dryRun?: boolean; requestId?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>;
    read: (input: { path: string; from?: number; to?: number; branch?: string; requestId?: string }) => Promise<ToolResult<Array<{ path: string; from: number; to: number; total: number; lines: string[] }>>>;
    search: (input: { pattern: string; paths?: string[]; include?: string; context?: number; maxResults?: number; branch?: string; requestId?: string }) => Promise<ToolResult<Array<{ file: string; line: number; text: string }>>>;
    trash: (input: { path: string; branch?: string; dryRun?: boolean; requestId?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>;
    write: (input: { path: string; content: string; force?: boolean; append?: boolean; mkdirs?: boolean; branch?: string; dryRun?: boolean; requestId?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>;
  };
  generate: {
    docs: (input: { requestId?: string; dryRun?: boolean }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>;
    types: (input: { requestId?: string; dryRun?: boolean }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>;
  };
  mac: {
    exec: (input: { command: string; cwd?: string; timeout?: number; dryRun?: boolean; requestId?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>;
    list: (input: { path?: string; depth?: number; requestId?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>;
    port: (input: { action: "check" | "find"; port?: number; requestId?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>;
    process: (input: { action: "list" | "kill"; pid?: number; name?: string; dryRun?: boolean; requestId?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>;
    read: (input: { path: string; requestId?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>;
    search: (input: { pattern: string; path?: string; include?: string; requestId?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>;
    write: (input: { path: string; content?: string; contentFile?: string; dryRun?: boolean; requestId?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>;
  };
  railway: {
    logs: (input: { service?: string; build?: boolean; errors?: boolean; network?: boolean; raw?: boolean; status?: boolean; filter?: string; lines?: number; requestId?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>;
    redeploy: (input: { service?: string; all?: boolean; wait?: boolean; dryRun?: boolean; requestId?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>;
  };
  review: {
    run: (input: { branch: string; fix?: boolean; all?: boolean; base?: string; strict?: boolean; mine?: boolean; noTests?: boolean; requestId?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>;
  };
  sentry: {
    config: (input: { verify?: boolean; requestId?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>;
    event: (input: { eventId: string; project?: string; requestId?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>;
    issue: (input: { identifier: string; expand?: string[]; requestId?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>;
    issueEvent: (input: { issueId: string; eventId?: string; full?: boolean; requestId?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>;
    issues: (input: { query?: string; project?: string; environment?: string[]; sort?: string; statsPeriod?: string; start?: string; end?: string; cursor?: string; limit?: number; expand?: string[]; collapse?: string[]; requestId?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>;
    projects: (input: { limit?: number; cursor?: string; requestId?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>;
    trace: (input: { traceId: string; project?: string; query?: string; statsPeriod?: string; dataset?: string; field?: string[]; cursor?: string; limit?: number; requestId?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>;
  };
  stream: {
    context: (input: { area: string; stream?: string; repo?: string; dryRun?: boolean; requestId?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>;
    list: (input: { repo?: string; requestId?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>;
    sync: (input: { area: string; stream?: string; repo?: string; dryRun?: boolean; requestId?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>;
  };
  task: {
    cleanup: (input: { branch?: string; force?: boolean; preview?: boolean; merged?: boolean; staleDays?: number; keep?: string; dryRun?: boolean; requestId?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>;
    current: (input: { requestId?: string; dryRun?: boolean }) => Promise<ToolResult<{ branch: string; area: string; prNumber?: number; worktree: string } | null>>;
    ensureSynced: (input: { branch?: string; requestId?: string; dryRun?: boolean }) => Promise<ToolResult<{ synced: boolean; branch: string; area: string; behind?: number; action?: string }>>;
    exec: (input: { branch?: string; command: string[]; timeout?: number; dryRun?: boolean; requestId?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>;
    finish: (input: { branch?: string; requestId?: string; dryRun?: boolean }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>;
    init: (input: { area: string; branch: string; pr?: number; worktree?: string; dryRun?: boolean; requestId?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>;
    merge: (input: { pr?: number; wait?: boolean; squash?: boolean; dryRun?: boolean; requestId?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>;
    pin: (input: { branch?: string; requestId?: string; dryRun?: boolean }) => Promise<ToolResult<{ branch: string }>>;
    pr: (input: { branch?: string; taskOnly?: boolean; draft?: boolean; ready?: boolean; bodyTemplate?: string; dryRun?: boolean; requestId?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>;
    prs: (input: { branch?: string; requestId?: string; dryRun?: boolean }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>;
    push: (input: { branch?: string; message: string; changed?: boolean; files?: string[]; noVerify?: boolean; dryRun?: boolean; requestId?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>;
    start: (input: { stream?: string; area?: string; title: string; description?: string; bodyFile?: string; startFrom?: "main" | "stream"; dryRun?: boolean; requestId?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>;
  };
  taskMeta: {
    smoke: (input: { requestId?: string; dryRun?: boolean }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>;
  };
  website: {
    deploy: (input: { preview?: boolean; buildOnly?: boolean; dryRun?: boolean; requestId?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>;
  };
  aiReview: (input: { pr?: number; noPost?: boolean; dryRun?: boolean; requestId?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>;
  audit: (input: { scripts?: boolean; docs?: boolean; index?: boolean; requestId?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>;
  checkFiles: (input: { branch?: string; files: string[]; stopOnFirstError?: boolean; requestId?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>;
  confidenceScore: (input: { requestId?: string; dryRun?: boolean }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>;
  confirm: (input: { verify?: boolean; runtime?: boolean; test?: string; requestId?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>;
  decideNext: (input: { context?: string; markRead?: string; markRelevant?: string; markIrrelevant?: string; requestId?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>;
  doctor: (input: { requestId?: string; dryRun?: boolean }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>;
  editFlow: (input: { branch?: string; searchPattern: string; searchPaths: string[]; from: number; to: number; contentFile: string; dryRun?: boolean; requestId?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>;
  exploit: (input: { query?: string; target?: string; requestId?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>;
  explore: (input: { query: string; limit?: number; changedOnly?: boolean; reindex?: boolean; requestId?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>;
  gh: (input: { action: string; args?: string[]; dryRun?: boolean; requestId?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>;
  prReview: (input: { pr?: number; stdout?: boolean; dryRun?: boolean; requestId?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>;
  server: (input: { action: "status" | "restart" | "stop" | "start" | "logs"; dryRun?: boolean; requestId?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>;
  status: (input: { requestId?: string; dryRun?: boolean }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>;
  tmp: (input: { action: string; name?: string; content?: string; ext?: string; dryRun?: boolean; requestId?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>;
  verify: (input: { branch?: string; base?: string; noReview?: boolean; noDb?: boolean; dbWarnOnly?: boolean; noStamp?: boolean; dryRun?: boolean; requestId?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>;
  wait: (input: { seconds?: number; deploy?: boolean; pr?: number; requestId?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>;
  batch: (steps: BatchStep[]) => Promise<ToolResult<{ results: ToolResult[]; completed: number }>>;
};

export { workspace };
