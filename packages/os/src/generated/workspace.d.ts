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
    app: (input: { headed?: boolean; full?: boolean; preset?: "desktop" | "mobile" | "tablet" | "ipad" | "iphone"; device?: string; provider?: string; width?: number; height?: number; colorScheme?: "dark" | "light" | "no-preference"; dryRun?: boolean; requestId?: string; taskSession?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>;
    click: (input: { ref: string; dryRun?: boolean; requestId?: string; taskSession?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>;
    clipboard: (input: { action: "read" | "write"; text?: string; dryRun?: boolean; requestId?: string; taskSession?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>;
    close: (input: { requestId?: string; taskSession?: string; dryRun?: boolean }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>;
    consuelo: (input: { headed?: boolean; full?: boolean; preset?: "desktop" | "mobile" | "tablet" | "ipad" | "iphone"; device?: string; provider?: string; width?: number; height?: number; colorScheme?: "dark" | "light" | "no-preference"; dryRun?: boolean; requestId?: string; taskSession?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>;
    cookies: (input: { action?: "list" | "set" | "clear"; name?: string; value?: string; dryRun?: boolean; requestId?: string; taskSession?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>;
    dialog: (input: { action: "accept" | "dismiss"; text?: string; dryRun?: boolean; requestId?: string; taskSession?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>;
    download: (input: { ref: string; path: string; dryRun?: boolean; requestId?: string; taskSession?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>;
    eval: (input: { js: string; dryRun?: boolean; requestId?: string; taskSession?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>;
    fill: (input: { ref: string; text: string; dryRun?: boolean; requestId?: string; taskSession?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>;
    find: (input: { by: "role" | "text" | "label" | "placeholder" | "alt" | "title" | "testid"; value: string; action: "click" | "fill" | "type" | "hover" | "focus" | "check" | "text"; text?: string; name?: string; dryRun?: boolean; requestId?: string; taskSession?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>;
    get: (input: { target: "text" | "html" | "value" | "attribute" | "title" | "url"; selector?: string; attribute?: string; dryRun?: boolean; requestId?: string; taskSession?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>;
    login: (input: { name: string; headed?: boolean; dryRun?: boolean; requestId?: string; taskSession?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>;
    network: (input: { args: string[]; dryRun?: boolean; requestId?: string; taskSession?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>;
    open: (input: { url: string; headed?: boolean; full?: boolean; preset?: "desktop" | "mobile" | "tablet" | "ipad" | "iphone"; device?: string; provider?: string; width?: number; height?: number; colorScheme?: "dark" | "light" | "no-preference"; dryRun?: boolean; requestId?: string; taskSession?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>;
    raw: (input: { args: string[]; dryRun?: boolean; requestId?: string; taskSession?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>;
    reauth: (input: { name: string; headed?: boolean; dryRun?: boolean; requestId?: string; taskSession?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>;
    run: (input: { command?: string; url?: string; args?: string[]; dryRun?: boolean; requestId?: string; taskSession?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>;
    screenshot: (input: { name?: string; full?: boolean; preset?: "desktop" | "mobile" | "tablet" | "ipad" | "iphone"; device?: string; provider?: string; width?: number; height?: number; colorScheme?: "dark" | "light" | "no-preference"; dryRun?: boolean; requestId?: string; taskSession?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>;
    snap: (input: { requestId?: string; taskSession?: string; dryRun?: boolean }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>;
    tabs: (input: { action?: "list" | "new" | "select" | "switch" | "close"; target?: string; url?: string; label?: string; dryRun?: boolean; requestId?: string; taskSession?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>;
    test: (input: { url: string; headed?: boolean; full?: boolean; preset?: "desktop" | "mobile" | "tablet" | "ipad" | "iphone"; device?: string; provider?: string; width?: number; height?: number; colorScheme?: "dark" | "light" | "no-preference"; dryRun?: boolean; requestId?: string; taskSession?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>;
    trace: (input: { action: "start" | "stop"; path?: string; dryRun?: boolean; requestId?: string; taskSession?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>;
    wait: (input: { target?: string; text?: string; url?: string; load?: string; conditionScript?: string; download?: boolean; dryRun?: boolean; requestId?: string; taskSession?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>;
  };
  code: {
    call: (input: { language: string; code?: string; codeFile?: string; stdin?: string; stdinFile?: string; mode: "read" | "edit" | "verify"; cwd?: string; timeout?: number; maxResultChars?: number; dryRun?: boolean; requestId?: string; taskSession?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>;
    run: (input: { code: string; mode?: "read" | "edit" | "verify"; timeout?: number; memoryLimit?: number; maxOperations?: number; maxResultChars?: number; dryRun?: boolean; requestId?: string; taskSession?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>;
  };
  consueloDesign: {
    check: (input: { requestId?: string; taskSession?: string; dryRun?: boolean }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>;
    generateDemo: (input: { requestId?: string; taskSession?: string; dryRun?: boolean; live?: boolean; name?: string; prompt?: string; timeout?: number }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>;
    generateDigitalEguide: (input: { requestId?: string; taskSession?: string; dryRun?: boolean; live?: boolean; name?: string; prompt?: string; template?: "research" | "spec" | "plan"; timeout?: number }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>;
    generateEmail: (input: { requestId?: string; taskSession?: string; dryRun?: boolean; live?: boolean; name?: string; prompt?: string; timeout?: number }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>;
    generateImageBrief: (input: { requestId?: string; taskSession?: string; dryRun?: boolean; live?: boolean; name?: string; prompt?: string; timeout?: number }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>;
    generateMotionFrame: (input: { requestId?: string; taskSession?: string; dryRun?: boolean; live?: boolean; name?: string; prompt?: string; timeout?: number }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>;
    generateWebsite: (input: { requestId?: string; taskSession?: string; dryRun?: boolean; live?: boolean; name?: string; prompt?: string; timeout?: number }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>;
    getDesignSystem: (input: { requestId?: string; taskSession?: string; dryRun?: boolean }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>;
    listDesignSystems: (input: { requestId?: string; taskSession?: string; dryRun?: boolean }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>;
    listSkills: (input: { requestId?: string; taskSession?: string; dryRun?: boolean }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>;
    odBuild: (input: { requestId?: string; taskSession?: string; dryRun?: boolean; timeout?: number }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>;
    railwayCheck: (input: { requestId?: string; taskSession?: string; dryRun?: boolean }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>;
    renderHyperframes: (input: { requestId?: string; taskSession?: string; dryRun?: boolean; live?: boolean; name?: string; prompt?: string; timeout?: number }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>;
    run: (input: { requestId?: string; taskSession?: string; dryRun?: boolean; timeout?: number }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>;
    uiBg: (input: { requestId?: string; taskSession?: string; dryRun?: boolean; timeout?: number }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>;
    uiLogs: (input: { requestId?: string; taskSession?: string; dryRun?: boolean }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>;
    uiStatus: (input: { requestId?: string; taskSession?: string; dryRun?: boolean }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>;
    uiStop: (input: { requestId?: string; taskSession?: string; dryRun?: boolean; timeout?: number }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>;
    upstreamStatus: (input: { requestId?: string; taskSession?: string; dryRun?: boolean }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>;
  };
  context: {
    categories: (input: { requestId?: string; taskSession?: string; dryRun?: boolean }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>;
    find: (input: { keyword: string; limit?: number; requestId?: string; taskSession?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>;
    get: (input: { index: number; keyword: string; requestId?: string; taskSession?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>;
    list: (input: { category?: string; limit?: number; requestId?: string; taskSession?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>;
    save: (input: { title: string; file?: string; content?: string; category?: string; dryRun?: boolean; requestId?: string; taskSession?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>;
    search: (input: { keyword: string; limit?: number; category?: string; requestId?: string; taskSession?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>;
    trace: (input: { traceId?: string; tool?: string; status?: "all" | "ok" | "error" | "blocked" | "timeout"; since?: string; until?: string; contains?: string; taskSession?: string; branch?: string; limit?: number; raw?: boolean; db?: string; requestId?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>;
  };
  design: {
    publish: (input: { target?: string; portlessName?: string; path?: string; name?: string; category?: string; template?: "research" | "spec" | "plan"; tailscaleBin?: string; requestId?: string; taskSession?: string; dryRun?: boolean }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>;
    refresh: (input: { tailscaleBin?: string; requestId?: string; taskSession?: string; dryRun?: boolean }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>;
  };
  fs: {
    http: (input: { url: string; method?: "get" | "post" | "put" | "patch" | "delete" | "head"; headers?: Record<string, string>; body?: string; dryRun?: boolean; requestId?: string; taskSession?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>;
    list: (input: { path?: string; pattern?: string; depth?: number; tree?: boolean; dirs?: boolean; files?: boolean; branch?: string; requestId?: string; taskSession?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>;
    patch: (input: { path: string; from: number; to: number; content?: string; contentFile?: string; branch?: string; dryRun?: boolean; requestId?: string; taskSession?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>;
    read: (input: { path: string; from?: number; to?: number; branch?: string; requestId?: string; taskSession?: string }) => Promise<ToolResult<Array<{ path: string; from: number; to: number; total: number; lines: string[] }>>>;
    search: (input: { pattern: string; paths?: string[]; include?: string; context?: number; maxResults?: number; branch?: string; requestId?: string; taskSession?: string }) => Promise<ToolResult<Array<{ file: string; line: number; text: string }>>>;
    trash: (input: { path: string; branch?: string; dryRun?: boolean; requestId?: string; taskSession?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>;
    write: (input: { path: string; content?: string; contentFile?: string; force?: boolean; append?: boolean; mkdirs?: boolean; branch?: string; dryRun?: boolean; requestId?: string; taskSession?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>;
  };
  generate: {
    docs: (input: { requestId?: string; taskSession?: string; dryRun?: boolean }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>;
    types: (input: { requestId?: string; taskSession?: string; dryRun?: boolean }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>;
  };
  git: {
    diff: (input: { branch?: string; base?: string; head?: string; paths?: string[]; stat?: boolean; files?: boolean; hunks?: boolean; patch?: boolean; nameOnly?: boolean; context?: number; maxBytes?: number; requestId?: string; taskSession?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>;
    status: (input: { requestId?: string; taskSession?: string; dryRun?: boolean }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>;
  };
  linear: {
    createIssue: (input: { title: string; description?: string; team?: string; state?: string; labels?: string[]; priority?: number; assignee?: string; project?: string; cycle?: string; parent?: string; dryRun?: boolean; requestId?: string; taskSession?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>;
    issue: (input: { identifier: string; requestId?: string; taskSession?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>;
    labels: (input: { first?: number; after?: string; requestId?: string; taskSession?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>;
    projects: (input: { first?: number; after?: string; requestId?: string; taskSession?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>;
    search: (input: { search?: string; team?: string; first?: number; after?: string; filter?: string; requestId?: string; taskSession?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>;
    states: (input: { team?: string; requestId?: string; taskSession?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>;
    teams: (input: { first?: number; after?: string; requestId?: string; taskSession?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>;
    updateIssue: (input: { issueId: string; title?: string; description?: string; state?: string; labels?: string[]; priority?: number; assignee?: string; project?: string; cycle?: string; parent?: string; dryRun?: boolean; requestId?: string; taskSession?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>;
  };
  mac: {
    call: (input: { command: string; cwd?: string; timeout?: number; dryRun?: boolean; requestId?: string; taskSession?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>;
    exec: (input: { command: string; cwd?: string; timeout?: number; dryRun?: boolean; requestId?: string; taskSession?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>;
    list: (input: { path?: string; depth?: number; requestId?: string; taskSession?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>;
    port: (input: { action: "check" | "find"; port?: number; requestId?: string; taskSession?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>;
    process: (input: { action: "list" | "kill"; pid?: number; name?: string; dryRun?: boolean; requestId?: string; taskSession?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>;
    read: (input: { path: string; requestId?: string; taskSession?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>;
    search: (input: { pattern: string; path?: string; include?: string; requestId?: string; taskSession?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>;
    write: (input: { path: string; content?: string; contentFile?: string; dryRun?: boolean; requestId?: string; taskSession?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>;
  };
  railway: {
    logs: (input: { service?: string; build?: boolean; errors?: boolean; network?: boolean; raw?: boolean; status?: boolean; filter?: string; lines?: number; requestId?: string; taskSession?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>;
    redeploy: (input: { service?: string; all?: boolean; wait?: boolean; dryRun?: boolean; requestId?: string; taskSession?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>;
  };
  research: {
    ingest: (input: { source: string; question?: string; mode?: "quick" | "standard" | "deep"; visual?: boolean; slidesMax?: number; videoMode?: "auto" | "transcript" | "understand"; keep?: boolean; outDir?: string; summarizeBin?: string; contextTitle?: string; contextCategory?: string; noContextSave?: boolean; dryRun?: boolean; requestId?: string; taskSession?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>;
  };
  review: {
    run: (input: { branch?: string; fix?: boolean; all?: boolean; base?: string; strict?: boolean; mine?: boolean; noTests?: boolean; requestId?: string; taskSession?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>;
  };
  sentry: {
    config: (input: { verify?: boolean; requestId?: string; taskSession?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>;
    event: (input: { eventId: string; project?: string; requestId?: string; taskSession?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>;
    issue: (input: { identifier: string; expand?: string[]; requestId?: string; taskSession?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>;
    issueEvent: (input: { issueId: string; eventId?: string; full?: boolean; requestId?: string; taskSession?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>;
    issues: (input: { query?: string; project?: string; environment?: string[]; sort?: string; statsPeriod?: string; start?: string; end?: string; cursor?: string; limit?: number; expand?: string[]; collapse?: string[]; requestId?: string; taskSession?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>;
    projects: (input: { limit?: number; cursor?: string; requestId?: string; taskSession?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>;
    trace: (input: { traceId: string; project?: string; query?: string; statsPeriod?: string; dataset?: string; field?: string[]; cursor?: string; limit?: number; requestId?: string; taskSession?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>;
  };
  stream: {
    context: (input: { area: string; stream?: string; repo?: string; dryRun?: boolean; requestId?: string; taskSession?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>;
    list: (input: { repo?: string; requestId?: string; taskSession?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>;
    sync: (input: { area: string; stream?: string; repo?: string; dryRun?: boolean; requestId?: string; taskSession?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>;
  };
  task: {
    call: (input: { branch?: string; command: string[]; tddPhase?: "red" | "green" | "post"; timeout?: number; dryRun?: boolean; requestId?: string; taskSession?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>;
    cleanup: (input: { branch?: string; force?: boolean; preview?: boolean; merged?: boolean; staleDays?: number; keep?: string; dryRun?: boolean; requestId?: string; taskSession?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>;
    current: (input: { requestId?: string; taskSession?: string; dryRun?: boolean }) => Promise<ToolResult<{ branch: string; area: string; prNumber?: number; worktree: string } | null>>;
    ensureSynced: (input: { branch?: string; pr?: string | number; github?: string; requestId?: string; taskSession?: string; dryRun?: boolean }) => Promise<ToolResult<{ synced: boolean; branch: string; area: string; behind?: number; action?: string }>>;
    exec: (input: { branch?: string; command: string[]; tddPhase?: "red" | "green" | "post"; timeout?: number; dryRun?: boolean; requestId?: string; taskSession?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>;
    finish: (input: { branch?: string; pr?: string | number; github?: string; requestId?: string; taskSession?: string; dryRun?: boolean }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>;
    init: (input: { area: string; branch: string; pr?: string | number; github?: string; worktree?: string; dryRun?: boolean; requestId?: string; taskSession?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>;
    merge: (input: { pr?: string | number; github?: string; wait?: boolean; squash?: boolean; dryRun?: boolean; requestId?: string; taskSession?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>;
    pr: (input: { branch?: string; pr?: string | number; github?: string; taskOnly?: boolean; draft?: boolean; ready?: boolean; bodyTemplate?: string; dryRun?: boolean; requestId?: string; taskSession?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>;
    prs: (input: { branch?: string; pr?: string | number; github?: string; requestId?: string; taskSession?: string; dryRun?: boolean }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>;
    push: (input: { branch?: string; pr?: string | number; github?: string; message: string; changed?: boolean; files?: string[]; approved?: boolean; reason?: string; dryRun?: boolean; requestId?: string; taskSession?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>;
    start: (input: { stream?: string; area?: string; title?: string; description?: string; bodyFile?: string; startFrom?: "main" | "stream"; pr?: string | number; github?: string; dryRun?: boolean; requestId?: string; taskSession?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>;
  };
  taskMeta: {
    smoke: (input: { requestId?: string; taskSession?: string; dryRun?: boolean }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>;
  };
  tools: {
    search: (input: { query: string; limit?: number; category?: string; readOnly?: boolean; mutating?: boolean; noDocs?: boolean; requestId?: string; taskSession?: string }) => Promise<ToolResult<{ query: string; limit: number; searchedCount: number; returnedCount: number; filters: Record<string, unknown>; totalMatches: number; confidence: "high" | "medium" | "low"; ambiguous: boolean; detectedIntent?: string; recommended?: string; matches: Array<{ name: string; methodPath?: string[]; category?: string; score: number; scoreParts?: Record<string, number>; description?: string; capabilities: Record<string, unknown>; sessionRequired: boolean; inputSchema?: string; outputSchema?: string; inputSignature?: string; outputSignature?: string; exampleInput?: Record<string, unknown>; usage: { workspaceCall: string; script?: string; subcommand?: string; arguments: Array<Record<string, unknown>> }; docs?: { heading: string; snippet: string; source: string }; why: string[] }>; alternatives?: Array<{ intent: string; tools: string[] }>; guidance: string | Record<string, unknown>; catalog: { source: string[]; catalogHash: string; toolCount: number; searchedCount: number; cardVersion: string; embeddingConfigId: string; cardsEmbedded: number; cardsReused: number; embeddingError?: string } }>>;
  };
  website: {
    deploy: (input: { preview?: boolean; buildOnly?: boolean; dryRun?: boolean; requestId?: string; taskSession?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>;
  };
  worker: {
    call: (input: { provider: "cdx" | "pi" | "opc" | "mini"; profile?: string; mode?: "check" | "step" | "work"; policy?: "read" | "safe" | "edit" | "ship"; instructionPath: string; cwd?: string; taskSession?: string; timeoutMs?: number; workspaceOnly?: boolean | "preferred" | "strict"; approval?: Record<string, unknown>; requestId?: string }) => Promise<ToolResult<{ provider: "cdx" | "pi" | "opc"; requestedProvider?: "cdx" | "pi" | "opc" | "mini"; profile?: string; mode: "check" | "step" | "work"; policy: "read" | "safe" | "edit" | "ship"; status: "completed" | "failed" | "not_configured" | "not_supported" | "timed_out" | "approval_required"; cwd: string; instructionPath: string; command: string[]; stdout: string; stderr: string; exitCode: number; durationMs: number; audit: { taskSession?: string; branch?: string; workspaceOnly: "preferred" | "strict" | false; rawShellUsed: boolean } }>>;
  };
  aiReview: (input: { pr?: number; noPost?: boolean; dryRun?: boolean; requestId?: string; taskSession?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>;
  audit: (input: { scripts?: boolean; docs?: boolean; index?: boolean; requestId?: string; taskSession?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>;
  checkFiles: (input: { branch?: string; files: string[]; stopOnFirstError?: boolean; requestId?: string; taskSession?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>;
  confidenceScore: (input: { requestId?: string; taskSession?: string; dryRun?: boolean }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>;
  confirm: (input: { verify?: boolean; runtime?: boolean; test?: string; requestId?: string; taskSession?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>;
  decideNext: (input: { context?: string; markRead?: string; markRelevant?: string; markIrrelevant?: string; requestId?: string; taskSession?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>;
  doctor: (input: { requestId?: string; taskSession?: string; dryRun?: boolean }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>;
  editFlow: (input: { branch?: string; searchPattern: string; searchPaths: string[]; from: number; to: number; contentFile: string; dryRun?: boolean; requestId?: string; taskSession?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>;
  exploit: (input: { query?: string; target?: string; requestId?: string; taskSession?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>;
  explore: (input: { query: string; limit?: number; changedOnly?: boolean; reindex?: boolean; requestId?: string; taskSession?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>;
  gh: (input: { action: string; args?: string[]; dryRun?: boolean; requestId?: string; taskSession?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>;
  github: (input: { operation: "pr.view" | "pr.checks" | "pr.reviews" | "pr.files" | "pr.diff" | "pr.list" | "pr.merge" | "branch.compare" | "repo.view" | "raw"; repo?: string; pr?: number; branch?: string; base?: string; head?: string; preset?: "summary" | "review" | "merge" | "checks" | "files" | "full"; fields?: string[]; limit?: number; state?: "open" | "closed" | "merged" | "all"; body?: string; bodyFile?: string; wait?: boolean; squash?: boolean; full?: boolean; mergeMethod?: "merge" | "squash" | "rebase"; rawArgs?: string[]; args?: string[]; reason?: string; dryRun?: boolean; requestId?: string; taskSession?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>;
  prReview: (input: { pr?: number; stdout?: boolean; dryRun?: boolean; requestId?: string; taskSession?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>;
  server: (input: { action: "status" | "consuelo-reload" | "reload" | "restart" | "stop" | "start" | "logs"; dryRun?: boolean; requestId?: string; taskSession?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>;
  status: (input: { requestId?: string; taskSession?: string; dryRun?: boolean }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>;
  tmp: (input: { action: string; name?: string; content?: string; ext?: string; dryRun?: boolean; requestId?: string; taskSession?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>;
  verify: (input: { branch?: string; base?: string; noStamp?: boolean; dryRun?: boolean; requestId?: string; taskSession?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>;
  wait: (input: { seconds?: number; duration?: string; detached?: boolean; status?: string; list?: boolean; reason?: string; deploy?: boolean; pr?: number; requestId?: string; taskSession?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>;
  batch: (steps: BatchStep[]) => Promise<ToolResult<{ results: ToolResult[]; completed: number }>>;
};

export { workspace };
