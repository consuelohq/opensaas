# workspace typed tools

This file is the human-readable tool catalog for the workspace facade. It is generated from `packages/workspace/tooling/tool-manifest.json`, so tool additions, schema changes, and timeout changes update this reference through the generator.

The workspace app exposes exactly two MCP entrypoints:

- `workspace.get_steering()` for bootstrap context
- `workspace.call({ tool, input, taskSession, timeout })` for every typed operation

<Note>
Use this file as a contract map. The manifest remains the executable source of truth; this page makes the available tools easier to scan.
</Note>

## Call contract

Every operation travels through the same envelope:

```ts
await workspace.call({
  tool: "fs.read",
  input: { path: "packages/workspace/package.json" },
  timeout: 120,
})
```

Task-scoped work must pass the `taskSession` returned by `task.start`. The facade resolves the session to the correct branch and worktree before invoking the underlying script.

## Tool index

| Category | Tools |
| --- | ---: |
| codemode | 2 |
| composed | 3 |
| context | 1 |
| decision engine | 6 |
| filesystem | 6 |
| generation | 2 |
| git | 1 |
| github | 2 |
| http | 1 |
| linear | 8 |
| mac | 8 |
| office | 21 |
| review | 4 |
| sentry | 7 |
| stream | 3 |
| task lifecycle | 13 |
| tooling | 1 |
| utilities | 34 |
| worker | 1 |
| workflow | 1 |

## Tools by category

## codemode

### workspace.code.call

run short language-specific code through staged Python, Bun, or Bash backends

| Field | Value |
| --- | --- |
| Category | codemode |
| Signature | `workspace.code.call({ language: string; code?: string; codeFile?: string; stdin?: string; stdinFile?: string; mode: "read" &#124; "edit" &#124; "verify"; cwd?: string; timeout?: number; maxResultChars?: number; taskWorktree?: string; branch?: string; dryRun?: boolean; requestId?: string; taskSession?: string }) => Promise<ToolResult<{ ok: boolean; exitCode: number; language: "python" &#124; "bun" &#124; "bash"; requestedLanguage?: string; runtime: string; mode: "read" &#124; "edit" &#124; "verify"; cwd: string; durationMs: number; stdout: string; stderr: string; filesChanged: string[]; truncated: boolean; traceId: string; message?: string; code?: string; detectedMistakeClass?: string; stdoutLogPath?: string; stderrLogPath?: string }>>` |
| Runtime | `workspace code.call` |
| Capability | writes state · mutating · single-shot |
| Default timeout | 300000ms |

#### Example call

```ts
await workspace.call({
  "tool": "code.call",
  "input": {
    "language": "python",
    "mode": "read",
    "code": "print(\"hello\")",
    "maxResultChars": 20000
  }
});
```

#### Success envelope

```json
{
  "ok": true,
  "code": "OK",
  "message": "command completed",
  "data": {
    "raw": "example"
  },
  "stderr": "",
  "exitCode": 0,
  "durationMs": 12,
  "traceId": "trc_abc123def456",
  "apiVersion": "1.0.0"
}
```

#### Error envelope

```json
{
  "ok": false,
  "code": "VALIDATION_ERROR",
  "message": "input: Required",
  "data": {
    "issues": []
  },
  "stderr": "",
  "exitCode": 1,
  "durationMs": 12,
  "traceId": "trc_abc123def456",
  "apiVersion": "1.0.0"
}
```

### workspace.code.run

run workspace-native codemode JavaScript against allowed workspace tools

| Field | Value |
| --- | --- |
| Category | codemode |
| Signature | `workspace.code.run({ code: string; mode?: "read" &#124; "edit" &#124; "verify"; timeout?: number; memoryLimit?: number; maxOperations?: number; maxResultChars?: number; dryRun?: boolean; requestId?: string; taskSession?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } &#124; null>>` |
| Runtime | `workspace code.run` |
| Capability | writes state · mutating · single-shot |
| Default timeout | 300000ms |

#### Example call

```ts
await workspace.call({
  "tool": "code.run",
  "input": {
    "code": "return await workspace_call(\"status\", {})",
    "maxOperations": 25,
    "maxResultChars": 20000
  }
});
```

#### Success envelope

```json
{
  "ok": true,
  "code": "OK",
  "message": "command completed",
  "data": {
    "raw": "example"
  },
  "stderr": "",
  "exitCode": 0,
  "durationMs": 12,
  "traceId": "trc_abc123def456",
  "apiVersion": "1.0.0"
}
```

#### Error envelope

```json
{
  "ok": false,
  "code": "VALIDATION_ERROR",
  "message": "input: Required",
  "data": {
    "issues": []
  },
  "stderr": "",
  "exitCode": 1,
  "durationMs": 12,
  "traceId": "trc_abc123def456",
  "apiVersion": "1.0.0"
}
```

## composed

### workspace.batch

run multiple workspace tools sequentially or in parallel with compact per-step results

| Field | Value |
| --- | --- |
| Category | composed |
| Signature | `workspace.batch({ steps: Array<{ tool: string; input?: Record<string, unknown>; args?: Record<string, unknown>; parallel?: boolean }>; dryRun?: boolean; requestId?: string; taskSession?: string }) => Promise<ToolResult<{ results: Array<ToolResult<unknown>>; completed: number }>>` |
| Runtime | `workspace batch` |
| Capability | writes state · mutating · single-shot |
| Default timeout | 300000ms |

#### Example call

```ts
await workspace.call({
  "tool": "batch",
  "input": {
    "steps": [
      {
        "tool": "context.find",
        "input": {
          "keyword": "workspace",
          "limit": 1
        }
      }
    ]
  }
});
```

#### Success envelope

```json
{
  "ok": true,
  "code": "OK",
  "message": "command completed",
  "data": {
    "raw": "example"
  },
  "stderr": "",
  "exitCode": 0,
  "durationMs": 12,
  "traceId": "trc_abc123def456",
  "apiVersion": "1.0.0"
}
```

#### Error envelope

```json
{
  "ok": false,
  "code": "VALIDATION_ERROR",
  "message": "input: Required",
  "data": {
    "issues": []
  },
  "stderr": "",
  "exitCode": 1,
  "durationMs": 12,
  "traceId": "trc_abc123def456",
  "apiVersion": "1.0.0"
}
```

### workspace.checkFiles

run syntax checks over a set of files through task:exec

| Field | Value |
| --- | --- |
| Category | composed |
| Signature | `workspace.checkFiles({ branch?: string; files: string[]; stopOnFirstError?: boolean; requestId?: string; taskSession?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } &#124; null>>` |
| Runtime | `workspace checkFiles` |
| Capability | read-only · non-mutating · single-shot |
| Default timeout | 300000ms |

#### Example call

```ts
await workspace.call({
  "tool": "checkFiles",
  "input": {
    "branch": "task/workspace-agents/example",
    "files": [
      "packages/workspace/scripts/fs.js"
    ],
    "stopOnFirstError": true
  }
});
```

#### Success envelope

```json
{
  "ok": true,
  "code": "OK",
  "message": "command completed",
  "data": {
    "raw": "example"
  },
  "stderr": "",
  "exitCode": 0,
  "durationMs": 12,
  "traceId": "trc_abc123def456",
  "apiVersion": "1.0.0"
}
```

#### Error envelope

```json
{
  "ok": false,
  "code": "VALIDATION_ERROR",
  "message": "input: Required",
  "data": {
    "issues": []
  },
  "stderr": "",
  "exitCode": 1,
  "durationMs": 12,
  "traceId": "trc_abc123def456",
  "apiVersion": "1.0.0"
}
```

### workspace.editFlow

run a search-read-patch-verify flow as a composed script

| Field | Value |
| --- | --- |
| Category | composed |
| Signature | `workspace.editFlow({ branch?: string; searchPattern: string; searchPaths: string[]; from: number; to: number; contentFile: string; dryRun?: boolean; requestId?: string; taskSession?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } &#124; null>>` |
| Runtime | `workspace editFlow` |
| Capability | writes state · mutating · single-shot |
| Default timeout | 300000ms |

#### Example call

```ts
await workspace.call({
  "tool": "editFlow",
  "input": {
    "branch": "task/workspace-agents/example",
    "searchPattern": "oldFn",
    "searchPaths": [
      "packages/workspace/scripts"
    ],
    "from": 1,
    "to": 1,
    "contentFile": "/tmp/new.ts",
    "dryRun": true
  }
});
```

#### Success envelope

```json
{
  "ok": true,
  "code": "OK",
  "message": "command completed",
  "data": {
    "raw": "example"
  },
  "stderr": "",
  "exitCode": 0,
  "durationMs": 12,
  "traceId": "trc_abc123def456",
  "apiVersion": "1.0.0"
}
```

#### Error envelope

```json
{
  "ok": false,
  "code": "VALIDATION_ERROR",
  "message": "input: Required",
  "data": {
    "issues": []
  },
  "stderr": "",
  "exitCode": 1,
  "durationMs": 12,
  "traceId": "trc_abc123def456",
  "apiVersion": "1.0.0"
}
```

## context

### workspace.context

search, read, save, list, and inspect project context and local workspace traces

| Field | Value |
| --- | --- |
| Category | context |
| Signature | `workspace.context({ operation: "search" &#124; "find" &#124; "get" &#124; "list" &#124; "save" &#124; "categories" &#124; "trace"; keyword?: string; index?: number; category?: string; limit?: number; title?: string; file?: string; text?: boolean; byTitle?: boolean; traceId?: string; tool?: string; status?: "all" &#124; "ok" &#124; "error" &#124; "blocked" &#124; "timeout"; since?: string; until?: string; contains?: string; contextTaskSession?: string; branch?: string; raw?: boolean; db?: string; dryRun?: boolean; requestId?: string; taskSession?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } &#124; null>>` |
| Runtime | `workspace context` |
| Capability | writes state · mutating · single-shot |
| Default timeout | 60000ms |

#### Example call

```ts
await workspace.call({
  "tool": "context",
  "input": {
    "operation": "search",
    "keyword": "workspace",
    "limit": 3
  }
});
```

#### Success envelope

```json
{
  "ok": true,
  "code": "OK",
  "message": "command completed",
  "data": {
    "raw": "example"
  },
  "stderr": "",
  "exitCode": 0,
  "durationMs": 12,
  "traceId": "trc_abc123def456",
  "apiVersion": "1.0.0"
}
```

#### Error envelope

```json
{
  "ok": false,
  "code": "VALIDATION_ERROR",
  "message": "input: Required",
  "data": {
    "issues": []
  },
  "stderr": "",
  "exitCode": 1,
  "durationMs": 12,
  "traceId": "trc_abc123def456",
  "apiVersion": "1.0.0"
}
```

## decision engine

### workspace.audit

audit workspace scripts, docs, or index freshness

| Field | Value |
| --- | --- |
| Category | decision engine |
| Signature | `workspace.audit({ scripts?: boolean; docs?: boolean; index?: boolean; requestId?: string; taskSession?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } &#124; null>>` |
| Runtime | `workspace audit` |
| Capability | read-only · non-mutating · safe to retry |
| Default timeout | 120000ms |

#### Example call

```ts
await workspace.call({
  "tool": "audit",
  "input": {
    "scripts": true
  }
});
```

#### Success envelope

```json
{
  "ok": true,
  "code": "OK",
  "message": "command completed",
  "data": {
    "raw": "example"
  },
  "stderr": "",
  "exitCode": 0,
  "durationMs": 12,
  "traceId": "trc_abc123def456",
  "apiVersion": "1.0.0"
}
```

#### Error envelope

```json
{
  "ok": false,
  "code": "VALIDATION_ERROR",
  "message": "input: Required",
  "data": {
    "issues": []
  },
  "stderr": "",
  "exitCode": 1,
  "durationMs": 12,
  "traceId": "trc_abc123def456",
  "apiVersion": "1.0.0"
}
```

### workspace.confidenceScore

score confidence from evidence state

| Field | Value |
| --- | --- |
| Category | decision engine |
| Signature | `workspace.confidenceScore({ requestId?: string; taskSession?: string; dryRun?: boolean }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } &#124; null>>` |
| Runtime | `workspace confidenceScore` |
| Capability | read-only · non-mutating · safe to retry |
| Default timeout | 300000ms |

#### Example call

```ts
await workspace.call({
  "tool": "confidenceScore",
  "input": {}
});
```

#### Success envelope

```json
{
  "ok": true,
  "code": "OK",
  "message": "command completed",
  "data": {
    "raw": "example"
  },
  "stderr": "",
  "exitCode": 0,
  "durationMs": 12,
  "traceId": "trc_abc123def456",
  "apiVersion": "1.0.0"
}
```

#### Error envelope

```json
{
  "ok": false,
  "code": "VALIDATION_ERROR",
  "message": "input: Required",
  "data": {
    "issues": []
  },
  "stderr": "",
  "exitCode": 1,
  "durationMs": 12,
  "traceId": "trc_abc123def456",
  "apiVersion": "1.0.0"
}
```

### workspace.confirm

run verification or targeted validation through confirm

| Field | Value |
| --- | --- |
| Category | decision engine |
| Signature | `workspace.confirm({ verify?: boolean; runtime?: boolean; test?: string; requestId?: string; taskSession?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } &#124; null>>` |
| Runtime | `workspace confirm` |
| Capability | read-only · non-mutating · safe to retry |
| Default timeout | 120000ms |

#### Example call

```ts
await workspace.call({
  "tool": "confirm",
  "input": {
    "verify": true
  }
});
```

#### Success envelope

```json
{
  "ok": true,
  "code": "OK",
  "message": "command completed",
  "data": {
    "raw": "example"
  },
  "stderr": "",
  "exitCode": 0,
  "durationMs": 12,
  "traceId": "trc_abc123def456",
  "apiVersion": "1.0.0"
}
```

#### Error envelope

```json
{
  "ok": false,
  "code": "VALIDATION_ERROR",
  "message": "input: Required",
  "data": {
    "issues": []
  },
  "stderr": "",
  "exitCode": 1,
  "durationMs": 12,
  "traceId": "trc_abc123def456",
  "apiVersion": "1.0.0"
}
```

### workspace.decideNext

recommend the next action from evidence state

| Field | Value |
| --- | --- |
| Category | decision engine |
| Signature | `workspace.decideNext({ context?: string; markRead?: string; markRelevant?: string; markIrrelevant?: string; requestId?: string; taskSession?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } &#124; null>>` |
| Runtime | `workspace decideNext` |
| Capability | read-only · non-mutating · safe to retry |
| Default timeout | 300000ms |

#### Example call

```ts
await workspace.call({
  "tool": "decideNext",
  "input": {}
});
```

#### Success envelope

```json
{
  "ok": true,
  "code": "OK",
  "message": "command completed",
  "data": {
    "raw": "example"
  },
  "stderr": "",
  "exitCode": 0,
  "durationMs": 12,
  "traceId": "trc_abc123def456",
  "apiVersion": "1.0.0"
}
```

#### Error envelope

```json
{
  "ok": false,
  "code": "VALIDATION_ERROR",
  "message": "input: Required",
  "data": {
    "issues": []
  },
  "stderr": "",
  "exitCode": 1,
  "durationMs": 12,
  "traceId": "trc_abc123def456",
  "apiVersion": "1.0.0"
}
```

### workspace.exploit

select the highest-confidence editing target

| Field | Value |
| --- | --- |
| Category | decision engine |
| Signature | `workspace.exploit({ query?: string; target?: string; requestId?: string; taskSession?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } &#124; null>>` |
| Runtime | `workspace exploit` |
| Capability | read-only · non-mutating · safe to retry |
| Default timeout | 120000ms |

#### Example call

```ts
await workspace.call({
  "tool": "exploit",
  "input": {}
});
```

#### Success envelope

```json
{
  "ok": true,
  "code": "OK",
  "message": "command completed",
  "data": {
    "raw": "example"
  },
  "stderr": "",
  "exitCode": 0,
  "durationMs": 12,
  "traceId": "trc_abc123def456",
  "apiVersion": "1.0.0"
}
```

#### Error envelope

```json
{
  "ok": false,
  "code": "VALIDATION_ERROR",
  "message": "input: Required",
  "data": {
    "issues": []
  },
  "stderr": "",
  "exitCode": 1,
  "durationMs": 12,
  "traceId": "trc_abc123def456",
  "apiVersion": "1.0.0"
}
```

### workspace.explore

a repo-aware decision search tool for coding agents. It answers where to spend attention and what files or paths are likely relevant to a given request.

| Field | Value |
| --- | --- |
| Category | decision engine |
| Signature | `workspace.explore({ query: string; limit?: number; changedOnly?: boolean; reindex?: boolean; requestId?: string; taskSession?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } &#124; null>>` |
| Runtime | `workspace explore` |
| Capability | read-only · non-mutating · safe to retry |
| Default timeout | 300000ms |

#### Example call

```ts
await workspace.call({
  "tool": "explore",
  "input": {
    "query": "workspace facade",
    "limit": 5
  }
});
```

#### Success envelope

```json
{
  "ok": true,
  "code": "OK",
  "message": "command completed",
  "data": {
    "raw": "example"
  },
  "stderr": "",
  "exitCode": 0,
  "durationMs": 12,
  "traceId": "trc_abc123def456",
  "apiVersion": "1.0.0"
}
```

#### Error envelope

```json
{
  "ok": false,
  "code": "VALIDATION_ERROR",
  "message": "input: Required",
  "data": {
    "issues": []
  },
  "stderr": "",
  "exitCode": 1,
  "durationMs": 12,
  "traceId": "trc_abc123def456",
  "apiVersion": "1.0.0"
}
```

## filesystem

### workspace.fs.apply_patch

apply an anchored patch file with embedded task-worktree-relative paths

| Field | Value |
| --- | --- |
| Category | filesystem |
| Signature | `workspace.fs.apply_patch({ patchText?: string; patchFile?: string; branch?: string; dryRun?: boolean; requestId?: string; taskSession?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } &#124; null>>` |
| Runtime | `workspace fs.apply_patch` |
| Capability | writes state · mutating · single-shot |
| Default timeout | 30000ms |

#### Example call

```ts
await workspace.call({
  "tool": "fs.apply_patch",
  "input": {
    "branch": "task/workspace-agents/example",
    "patchFile": "/tmp/change.patch",
    "dryRun": true
  }
});
```

#### Success envelope

```json
{
  "ok": true,
  "code": "OK",
  "message": "command completed",
  "data": {
    "raw": "example"
  },
  "stderr": "",
  "exitCode": 0,
  "durationMs": 12,
  "traceId": "trc_abc123def456",
  "apiVersion": "1.0.0"
}
```

#### Error envelope

```json
{
  "ok": false,
  "code": "VALIDATION_ERROR",
  "message": "input: Required",
  "data": {
    "issues": []
  },
  "stderr": "",
  "exitCode": 1,
  "durationMs": 12,
  "traceId": "trc_abc123def456",
  "apiVersion": "1.0.0"
}
```

### workspace.fs.list

list or find files in the repo root or a resolved task worktree

| Field | Value |
| --- | --- |
| Category | filesystem |
| Signature | `workspace.fs.list({ path?: string; pattern?: string; depth?: number; tree?: boolean; dirs?: boolean; files?: boolean; branch?: string; requestId?: string; taskSession?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } &#124; null>>` |
| Runtime | `workspace fs list, or task:fs list when a branch is resolved` |
| Capability | read-only · non-mutating · safe to retry |
| Default timeout | 30000ms |

#### Example call

```ts
await workspace.call({
  "tool": "fs.list",
  "input": {
    "branch": "task/workspace-agents/example",
    "path": "packages/workspace/scripts",
    "depth": 1
  }
});
```

#### Success envelope

```json
{
  "ok": true,
  "code": "OK",
  "message": "command completed",
  "data": {
    "raw": "example"
  },
  "stderr": "",
  "exitCode": 0,
  "durationMs": 12,
  "traceId": "trc_abc123def456",
  "apiVersion": "1.0.0"
}
```

#### Error envelope

```json
{
  "ok": false,
  "code": "VALIDATION_ERROR",
  "message": "input: Required",
  "data": {
    "issues": []
  },
  "stderr": "",
  "exitCode": 1,
  "durationMs": 12,
  "traceId": "trc_abc123def456",
  "apiVersion": "1.0.0"
}
```

### workspace.fs.read

read bounded text or supported media from files with pagination, MIME metadata, binary detection, and structured truncation for agent-safe file ingestion

| Field | Value |
| --- | --- |
| Category | filesystem |
| Signature | `workspace.fs.read(({ path: string; files?: never; offset?: number; limit?: number; from?: number; to?: number; branch?: string; requestId?: string; taskSession?: string } &#124; { files: Array<{ path: string; offset?: number; limit?: number; from?: number; to?: number }>; path?: never; offset?: never; limit?: never; from?: never; to?: never; branch?: string; requestId?: string; taskSession?: string })) => Promise<ToolResult<({ type: "text-page"; path: string; mime: "text/plain"; encoding: "utf8"; offset: number; limit: number; content: string; truncated: boolean; next?: number; totalLines?: number } &#124; { type: "binary"; path: string; mime?: string; sizeBytes: number; message: string } &#124; { type: "media"; path: string; mime: "image/png" &#124; "image/jpeg" &#124; "image/gif" &#124; "image/webp"; sizeBytes: number; encoding: "base64"; content: string }) &#124; { type: "error"; code: "NOT_FOUND" &#124; "IS_DIRECTORY" &#124; "PATH_OUTSIDE_ROOT" &#124; "SYMLINK_OUTSIDE_ROOT" &#124; "OFFSET_OUT_OF_RANGE" &#124; "INVALID_RANGE" &#124; "INVALID_UTF8" &#124; "MEDIA_TOO_LARGE" &#124; "READ_FAILED"; path?: string; message: string } &#124; { results: Array<{ path: string; ok: true; page: ({ type: "text-page"; path: string; mime: "text/plain"; encoding: "utf8"; offset: number; limit: number; content: string; truncated: boolean; next?: number; totalLines?: number } &#124; { type: "binary"; path: string; mime?: string; sizeBytes: number; message: string } &#124; { type: "media"; path: string; mime: "image/png" &#124; "image/jpeg" &#124; "image/gif" &#124; "image/webp"; sizeBytes: number; encoding: "base64"; content: string }) } &#124; { path: string; ok: false; error: { type: "error"; code: "NOT_FOUND" &#124; "IS_DIRECTORY" &#124; "PATH_OUTSIDE_ROOT" &#124; "SYMLINK_OUTSIDE_ROOT" &#124; "OFFSET_OUT_OF_RANGE" &#124; "INVALID_RANGE" &#124; "INVALID_UTF8" &#124; "MEDIA_TOO_LARGE" &#124; "READ_FAILED"; path?: string; message: string } }> }>>` |
| Runtime | `workspace fs read, or task:fs read when a branch is resolved` |
| Capability | read-only · non-mutating · safe to retry |
| Default timeout | 30000ms |

#### Example call

```ts
await workspace.call({
  "tool": "fs.read",
  "input": {
    "branch": "task/workspace-agents/example",
    "path": "packages/workspace/scripts/fs.js",
    "offset": 1,
    "limit": 120
  }
});
```

#### Success envelope

```json
{
  "ok": true,
  "code": "OK",
  "message": "command completed",
  "data": {
    "raw": "example"
  },
  "stderr": "",
  "exitCode": 0,
  "durationMs": 12,
  "traceId": "trc_abc123def456",
  "apiVersion": "1.0.0"
}
```

#### Error envelope

```json
{
  "ok": false,
  "code": "VALIDATION_ERROR",
  "message": "input: Required",
  "data": {
    "issues": []
  },
  "stderr": "",
  "exitCode": 1,
  "durationMs": 12,
  "traceId": "trc_abc123def456",
  "apiVersion": "1.0.0"
}
```

### workspace.fs.search

search file contents with ripgrep and return structured bounded matches for agent-safe discovery

| Field | Value |
| --- | --- |
| Category | filesystem |
| Signature | `workspace.fs.search({ pattern: string; path?: string; paths?: string[]; include?: string; context?: number; maxResults?: number; branch?: string; requestId?: string; taskSession?: string }) => Promise<ToolResult<{ type: "search-results"; pattern: string; root: string; matches: Array<{ type: "match"; path: string; line: number; text: string; before?: Array<{ line: number; text: string }>; after?: Array<{ line: number; text: string }> }>; truncated: boolean; limit: number; reads?: Array<{ path: string; ok: true; ranges: Array<{ from: number; to: number }>; page: unknown } &#124; { path: string; ok: false; ranges: Array<{ from: number; to: number }>; error: unknown }> }>>` |
| Runtime | `workspace fs search, or task:fs search when a branch is resolved` |
| Capability | read-only · non-mutating · safe to retry |
| Default timeout | 30000ms |

#### Example call

```ts
await workspace.call({
  "tool": "fs.search",
  "input": {
    "branch": "task/workspace-agents/example",
    "pattern": "task:fs",
    "path": "packages/workspace/SCRIPTS.md"
  }
});
```

#### Success envelope

```json
{
  "ok": true,
  "code": "OK",
  "message": "command completed",
  "data": {
    "raw": "example"
  },
  "stderr": "",
  "exitCode": 0,
  "durationMs": 12,
  "traceId": "trc_abc123def456",
  "apiVersion": "1.0.0"
}
```

#### Error envelope

```json
{
  "ok": false,
  "code": "VALIDATION_ERROR",
  "message": "input: Required",
  "data": {
    "issues": []
  },
  "stderr": "",
  "exitCode": 1,
  "durationMs": 12,
  "traceId": "trc_abc123def456",
  "apiVersion": "1.0.0"
}
```

### workspace.fs.trash

An agent safe file deletion path. Prefered over rm rf

| Field | Value |
| --- | --- |
| Category | filesystem |
| Signature | `workspace.fs.trash({ path: string; branch?: string; dryRun?: boolean; requestId?: string; taskSession?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } &#124; null>>` |
| Runtime | `workspace fs.trash` |
| Capability | writes state · mutating · single-shot |
| Default timeout | 30000ms |

#### Example call

```ts
await workspace.call({
  "tool": "fs.trash",
  "input": {
    "branch": "task/workspace-agents/example",
    "path": "tmp/example.txt",
    "dryRun": true
  }
});
```

#### Success envelope

```json
{
  "ok": true,
  "code": "OK",
  "message": "command completed",
  "data": {
    "raw": "example"
  },
  "stderr": "",
  "exitCode": 0,
  "durationMs": 12,
  "traceId": "trc_abc123def456",
  "apiVersion": "1.0.0"
}
```

#### Error envelope

```json
{
  "ok": false,
  "code": "VALIDATION_ERROR",
  "message": "input: Required",
  "data": {
    "issues": []
  },
  "stderr": "",
  "exitCode": 1,
  "durationMs": 12,
  "traceId": "trc_abc123def456",
  "apiVersion": "1.0.0"
}
```

### workspace.fs.write

write a file in a task worktree

| Field | Value |
| --- | --- |
| Category | filesystem |
| Signature | `workspace.fs.write({ path: string; content?: string; contentFile?: string; force?: boolean; append?: boolean; mkdirs?: boolean; branch?: string; dryRun?: boolean; requestId?: string; taskSession?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } &#124; null>>` |
| Runtime | `workspace fs.write` |
| Capability | writes state · mutating · single-shot |
| Default timeout | 30000ms |

#### Example call

```ts
await workspace.call({
  "tool": "fs.write",
  "input": {
    "branch": "task/workspace-agents/example",
    "path": "tmp/example.txt",
    "contentFile": "/tmp/example.txt",
    "dryRun": true
  }
});
```

#### Success envelope

```json
{
  "ok": true,
  "code": "OK",
  "message": "command completed",
  "data": {
    "raw": "example"
  },
  "stderr": "",
  "exitCode": 0,
  "durationMs": 12,
  "traceId": "trc_abc123def456",
  "apiVersion": "1.0.0"
}
```

#### Error envelope

```json
{
  "ok": false,
  "code": "VALIDATION_ERROR",
  "message": "input: Required",
  "data": {
    "issues": []
  },
  "stderr": "",
  "exitCode": 1,
  "durationMs": 12,
  "traceId": "trc_abc123def456",
  "apiVersion": "1.0.0"
}
```

## generation

### workspace.generate.docs

generate TOOLS.md from the tool manifest

| Field | Value |
| --- | --- |
| Category | generation |
| Signature | `workspace.generate.docs({ requestId?: string; taskSession?: string; dryRun?: boolean }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } &#124; null>>` |
| Runtime | `workspace generate.docs` |
| Capability | writes state · mutating · single-shot |
| Default timeout | 120000ms |

#### Example call

```ts
await workspace.call({
  "tool": "generate.docs",
  "input": {
    "dryRun": true
  }
});
```

#### Success envelope

```json
{
  "ok": true,
  "code": "OK",
  "message": "command completed",
  "data": {
    "raw": "example"
  },
  "stderr": "",
  "exitCode": 0,
  "durationMs": 12,
  "traceId": "trc_abc123def456",
  "apiVersion": "1.0.0"
}
```

#### Error envelope

```json
{
  "ok": false,
  "code": "VALIDATION_ERROR",
  "message": "input: Required",
  "data": {
    "issues": []
  },
  "stderr": "",
  "exitCode": 1,
  "durationMs": 12,
  "traceId": "trc_abc123def456",
  "apiVersion": "1.0.0"
}
```

### workspace.generate.types

generate workspace.d.ts from the tool manifest

| Field | Value |
| --- | --- |
| Category | generation |
| Signature | `workspace.generate.types({ requestId?: string; taskSession?: string; dryRun?: boolean }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } &#124; null>>` |
| Runtime | `workspace generate.types` |
| Capability | writes state · mutating · single-shot |
| Default timeout | 120000ms |

#### Example call

```ts
await workspace.call({
  "tool": "generate.types",
  "input": {
    "dryRun": true
  }
});
```

#### Success envelope

```json
{
  "ok": true,
  "code": "OK",
  "message": "command completed",
  "data": {
    "raw": "example"
  },
  "stderr": "",
  "exitCode": 0,
  "durationMs": 12,
  "traceId": "trc_abc123def456",
  "apiVersion": "1.0.0"
}
```

#### Error envelope

```json
{
  "ok": false,
  "code": "VALIDATION_ERROR",
  "message": "input: Required",
  "data": {
    "issues": []
  },
  "stderr": "",
  "exitCode": 1,
  "durationMs": 12,
  "traceId": "trc_abc123def456",
  "apiVersion": "1.0.0"
}
```

## git

### workspace.git.diff

inspect task or working-tree diffs as bounded structured JSON for agents

| Field | Value |
| --- | --- |
| Category | git |
| Signature | `workspace.git.diff({ branch?: string; base?: string; head?: string; paths?: string[]; stat?: boolean; files?: boolean; hunks?: boolean; patch?: boolean; nameOnly?: boolean; context?: number; maxBytes?: number; requestId?: string; taskSession?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } &#124; null>>` |
| Runtime | `workspace git:diff` |
| Capability | read-only · non-mutating · safe to retry |
| Default timeout | 120000ms |

#### Example call

```ts
await workspace.call({
  "tool": "git.diff",
  "input": {
    "branch": "task/workspace-agents/example",
    "base": "origin/main",
    "stat": true,
    "files": true,
    "hunks": true,
    "maxBytes": 20000
  }
});
```

#### Success envelope

```json
{
  "ok": true,
  "code": "OK",
  "message": "command completed",
  "data": {
    "raw": "example"
  },
  "stderr": "",
  "exitCode": 0,
  "durationMs": 12,
  "traceId": "trc_abc123def456",
  "apiVersion": "1.0.0"
}
```

#### Error envelope

```json
{
  "ok": false,
  "code": "VALIDATION_ERROR",
  "message": "input: Required",
  "data": {
    "issues": []
  },
  "stderr": "",
  "exitCode": 1,
  "durationMs": 12,
  "traceId": "trc_abc123def456",
  "apiVersion": "1.0.0"
}
```

## github

### workspace.gh

run the workspace GitHub helper with an explicit action

| Field | Value |
| --- | --- |
| Category | github |
| Signature | `workspace.gh({ action: string; args?: string[]; dryRun?: boolean; requestId?: string; taskSession?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } &#124; null>>` |
| Runtime | `workspace gh` |
| Capability | writes state · mutating · single-shot |
| Default timeout | 120000ms |

#### Example call

```ts
await workspace.call({
  "tool": "gh",
  "input": {
    "action": "view",
    "args": [
      "225"
    ]
  }
});
```

#### Success envelope

```json
{
  "ok": true,
  "code": "OK",
  "message": "command completed",
  "data": {
    "raw": "example"
  },
  "stderr": "",
  "exitCode": 0,
  "durationMs": 12,
  "traceId": "trc_abc123def456",
  "apiVersion": "1.0.0"
}
```

#### Error envelope

```json
{
  "ok": false,
  "code": "VALIDATION_ERROR",
  "message": "input: Required",
  "data": {
    "issues": []
  },
  "stderr": "",
  "exitCode": 1,
  "durationMs": 12,
  "traceId": "trc_abc123def456",
  "apiVersion": "1.0.0"
}
```

### workspace.github

typed GitHub facade with semantic operations and presets; prefer over raw gh

| Field | Value |
| --- | --- |
| Category | github |
| Signature | `workspace.github({ operation: "pr.view" &#124; "pr.checks" &#124; "pr.reviews" &#124; "pr.files" &#124; "pr.diff" &#124; "pr.list" &#124; "pr.merge" &#124; "branch.compare" &#124; "repo.view" &#124; "raw"; repo?: string; pr?: number; branch?: string; base?: string; head?: string; preset?: "summary" &#124; "review" &#124; "merge" &#124; "checks" &#124; "files" &#124; "full"; fields?: string[]; limit?: number; state?: "open" &#124; "closed" &#124; "merged" &#124; "all"; body?: string; bodyFile?: string; wait?: boolean; squash?: boolean; full?: boolean; mergeMethod?: "merge" &#124; "squash" &#124; "rebase"; rawArgs?: string[]; args?: string[]; reason?: string; dryRun?: boolean; requestId?: string; taskSession?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } &#124; null>>` |
| Runtime | `workspace github` |
| Capability | writes state · mutating · single-shot |
| Default timeout | 120000ms |

#### Example call

```ts
await workspace.call({
  "tool": "github",
  "input": {
    "operation": "pr.view",
    "pr": 436,
    "preset": "review"
  }
});
```

#### Success envelope

```json
{
  "ok": true,
  "code": "OK",
  "message": "command completed",
  "data": {
    "raw": "example"
  },
  "stderr": "",
  "exitCode": 0,
  "durationMs": 12,
  "traceId": "trc_abc123def456",
  "apiVersion": "1.0.0"
}
```

#### Error envelope

```json
{
  "ok": false,
  "code": "VALIDATION_ERROR",
  "message": "input: Required",
  "data": {
    "issues": []
  },
  "stderr": "",
  "exitCode": 1,
  "durationMs": 12,
  "traceId": "trc_abc123def456",
  "apiVersion": "1.0.0"
}
```

## http

### workspace.http

make HTTP requests through the workspace http wrapper (wraps xh)

| Field | Value |
| --- | --- |
| Category | http |
| Signature | `workspace.http({ url: string; method?: "get" &#124; "post" &#124; "put" &#124; "patch" &#124; "delete" &#124; "head"; headers?: Record<string, string>; body?: string; dryRun?: boolean; requestId?: string; taskSession?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } &#124; null>>` |
| Runtime | `workspace http` |
| Capability | writes state · mutating · safe to retry |
| Default timeout | 60000ms |

#### Example call

```ts
await workspace.call({
  "tool": "http",
  "input": {
    "method": "get",
    "url": "https://example.com"
  }
});
```

#### Success envelope

```json
{
  "ok": true,
  "code": "OK",
  "message": "command completed",
  "data": {
    "raw": "example"
  },
  "stderr": "",
  "exitCode": 0,
  "durationMs": 12,
  "traceId": "trc_abc123def456",
  "apiVersion": "1.0.0"
}
```

#### Error envelope

```json
{
  "ok": false,
  "code": "VALIDATION_ERROR",
  "message": "input: Required",
  "data": {
    "issues": []
  },
  "stderr": "",
  "exitCode": 1,
  "durationMs": 12,
  "traceId": "trc_abc123def456",
  "apiVersion": "1.0.0"
}
```

## linear

### workspace.linear.createIssue

create a Linear issue with DEV/open defaults and the opensaas label

| Field | Value |
| --- | --- |
| Category | linear |
| Signature | `workspace.linear.createIssue({ title: string; description?: string; team?: string; state?: string; labels?: string[]; priority?: number; assignee?: string; project?: string; cycle?: string; parent?: string; dryRun?: boolean; requestId?: string; taskSession?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } &#124; null>>` |
| Runtime | `workspace linear.createIssue` |
| Capability | writes state · mutating · single-shot |
| Default timeout | 60000ms |

#### Example call

```ts
await workspace.call({
  "tool": "linear.createIssue",
  "input": {
    "title": "add Linear facade commands",
    "labels": [
      "opensaas"
    ]
  }
});
```

#### Success envelope

```json
{
  "ok": true,
  "code": "OK",
  "message": "command completed",
  "data": {
    "raw": "example"
  },
  "stderr": "",
  "exitCode": 0,
  "durationMs": 12,
  "traceId": "trc_abc123def456",
  "apiVersion": "1.0.0"
}
```

#### Error envelope

```json
{
  "ok": false,
  "code": "VALIDATION_ERROR",
  "message": "input: Required",
  "data": {
    "issues": []
  },
  "stderr": "",
  "exitCode": 1,
  "durationMs": 12,
  "traceId": "trc_abc123def456",
  "apiVersion": "1.0.0"
}
```

### workspace.linear.issue

read a Linear issue by identifier or id

| Field | Value |
| --- | --- |
| Category | linear |
| Signature | `workspace.linear.issue({ identifier: string; requestId?: string; taskSession?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } &#124; null>>` |
| Runtime | `workspace linear.issue` |
| Capability | read-only · non-mutating · safe to retry |
| Default timeout | 60000ms |

#### Example call

```ts
await workspace.call({
  "tool": "linear.issue",
  "input": {
    "identifier": "DEV-123"
  }
});
```

#### Success envelope

```json
{
  "ok": true,
  "code": "OK",
  "message": "command completed",
  "data": {
    "raw": "example"
  },
  "stderr": "",
  "exitCode": 0,
  "durationMs": 12,
  "traceId": "trc_abc123def456",
  "apiVersion": "1.0.0"
}
```

#### Error envelope

```json
{
  "ok": false,
  "code": "VALIDATION_ERROR",
  "message": "input: Required",
  "data": {
    "issues": []
  },
  "stderr": "",
  "exitCode": 1,
  "durationMs": 12,
  "traceId": "trc_abc123def456",
  "apiVersion": "1.0.0"
}
```

### workspace.linear.labels

list Linear issue labels for label consistency

| Field | Value |
| --- | --- |
| Category | linear |
| Signature | `workspace.linear.labels({ first?: number; after?: string; requestId?: string; taskSession?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } &#124; null>>` |
| Runtime | `workspace linear.labels` |
| Capability | read-only · non-mutating · safe to retry |
| Default timeout | 60000ms |

#### Example call

```ts
await workspace.call({
  "tool": "linear.labels",
  "input": {
    "first": 50
  }
});
```

#### Success envelope

```json
{
  "ok": true,
  "code": "OK",
  "message": "command completed",
  "data": {
    "raw": "example"
  },
  "stderr": "",
  "exitCode": 0,
  "durationMs": 12,
  "traceId": "trc_abc123def456",
  "apiVersion": "1.0.0"
}
```

#### Error envelope

```json
{
  "ok": false,
  "code": "VALIDATION_ERROR",
  "message": "input: Required",
  "data": {
    "issues": []
  },
  "stderr": "",
  "exitCode": 1,
  "durationMs": 12,
  "traceId": "trc_abc123def456",
  "apiVersion": "1.0.0"
}
```

### workspace.linear.projects

list Linear projects and ids

| Field | Value |
| --- | --- |
| Category | linear |
| Signature | `workspace.linear.projects({ first?: number; after?: string; requestId?: string; taskSession?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } &#124; null>>` |
| Runtime | `workspace linear.projects` |
| Capability | read-only · non-mutating · safe to retry |
| Default timeout | 60000ms |

#### Example call

```ts
await workspace.call({
  "tool": "linear.projects",
  "input": {
    "first": 50
  }
});
```

#### Success envelope

```json
{
  "ok": true,
  "code": "OK",
  "message": "command completed",
  "data": {
    "raw": "example"
  },
  "stderr": "",
  "exitCode": 0,
  "durationMs": 12,
  "traceId": "trc_abc123def456",
  "apiVersion": "1.0.0"
}
```

#### Error envelope

```json
{
  "ok": false,
  "code": "VALIDATION_ERROR",
  "message": "input: Required",
  "data": {
    "issues": []
  },
  "stderr": "",
  "exitCode": 1,
  "durationMs": 12,
  "traceId": "trc_abc123def456",
  "apiVersion": "1.0.0"
}
```

### workspace.linear.search

search Linear issues with DEV default team support

| Field | Value |
| --- | --- |
| Category | linear |
| Signature | `workspace.linear.search({ search?: string; team?: string; first?: number; after?: string; filter?: string; requestId?: string; taskSession?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } &#124; null>>` |
| Runtime | `workspace linear.search` |
| Capability | read-only · non-mutating · safe to retry |
| Default timeout | 60000ms |

#### Example call

```ts
await workspace.call({
  "tool": "linear.search",
  "input": {
    "search": "workspace facade"
  }
});
```

#### Success envelope

```json
{
  "ok": true,
  "code": "OK",
  "message": "command completed",
  "data": {
    "raw": "example"
  },
  "stderr": "",
  "exitCode": 0,
  "durationMs": 12,
  "traceId": "trc_abc123def456",
  "apiVersion": "1.0.0"
}
```

#### Error envelope

```json
{
  "ok": false,
  "code": "VALIDATION_ERROR",
  "message": "input: Required",
  "data": {
    "issues": []
  },
  "stderr": "",
  "exitCode": 1,
  "durationMs": 12,
  "traceId": "trc_abc123def456",
  "apiVersion": "1.0.0"
}
```

### workspace.linear.states

list workflow states for a Linear team

| Field | Value |
| --- | --- |
| Category | linear |
| Signature | `workspace.linear.states({ team?: string; requestId?: string; taskSession?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } &#124; null>>` |
| Runtime | `workspace linear.states` |
| Capability | read-only · non-mutating · safe to retry |
| Default timeout | 60000ms |

#### Example call

```ts
await workspace.call({
  "tool": "linear.states",
  "input": {
    "team": "dev"
  }
});
```

#### Success envelope

```json
{
  "ok": true,
  "code": "OK",
  "message": "command completed",
  "data": {
    "raw": "example"
  },
  "stderr": "",
  "exitCode": 0,
  "durationMs": 12,
  "traceId": "trc_abc123def456",
  "apiVersion": "1.0.0"
}
```

#### Error envelope

```json
{
  "ok": false,
  "code": "VALIDATION_ERROR",
  "message": "input: Required",
  "data": {
    "issues": []
  },
  "stderr": "",
  "exitCode": 1,
  "durationMs": 12,
  "traceId": "trc_abc123def456",
  "apiVersion": "1.0.0"
}
```

### workspace.linear.teams

list Linear teams and workflow states

| Field | Value |
| --- | --- |
| Category | linear |
| Signature | `workspace.linear.teams({ first?: number; after?: string; requestId?: string; taskSession?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } &#124; null>>` |
| Runtime | `workspace linear.teams` |
| Capability | read-only · non-mutating · safe to retry |
| Default timeout | 60000ms |

#### Example call

```ts
await workspace.call({
  "tool": "linear.teams",
  "input": {
    "first": 20
  }
});
```

#### Success envelope

```json
{
  "ok": true,
  "code": "OK",
  "message": "command completed",
  "data": {
    "raw": "example"
  },
  "stderr": "",
  "exitCode": 0,
  "durationMs": 12,
  "traceId": "trc_abc123def456",
  "apiVersion": "1.0.0"
}
```

#### Error envelope

```json
{
  "ok": false,
  "code": "VALIDATION_ERROR",
  "message": "input: Required",
  "data": {
    "issues": []
  },
  "stderr": "",
  "exitCode": 1,
  "durationMs": 12,
  "traceId": "trc_abc123def456",
  "apiVersion": "1.0.0"
}
```

### workspace.linear.updateIssue

update Linear issue fields including labels, project, cycle, and parent

| Field | Value |
| --- | --- |
| Category | linear |
| Signature | `workspace.linear.updateIssue({ issueId: string; title?: string; description?: string; state?: string; labels?: string[]; priority?: number; assignee?: string; project?: string; cycle?: string; parent?: string; dryRun?: boolean; requestId?: string; taskSession?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } &#124; null>>` |
| Runtime | `workspace linear.updateIssue` |
| Capability | writes state · mutating · single-shot |
| Default timeout | 60000ms |

#### Example call

```ts
await workspace.call({
  "tool": "linear.updateIssue",
  "input": {
    "issueId": "DEV-123",
    "labels": [
      "opensaas"
    ]
  }
});
```

#### Success envelope

```json
{
  "ok": true,
  "code": "OK",
  "message": "command completed",
  "data": {
    "raw": "example"
  },
  "stderr": "",
  "exitCode": 0,
  "durationMs": 12,
  "traceId": "trc_abc123def456",
  "apiVersion": "1.0.0"
}
```

#### Error envelope

```json
{
  "ok": false,
  "code": "VALIDATION_ERROR",
  "message": "input: Required",
  "data": {
    "issues": []
  },
  "stderr": "",
  "exitCode": 1,
  "durationMs": 12,
  "traceId": "trc_abc123def456",
  "apiVersion": "1.0.0"
}
```

## mac

### workspace.mac.call

run a non-repo shell command on the Mac

| Field | Value |
| --- | --- |
| Category | mac |
| Signature | `workspace.mac.call({ command: string; cwd?: string; timeout?: number; dryRun?: boolean; requestId?: string; taskSession?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } &#124; null>>` |
| Runtime | `workspace mac.call` |
| Capability | writes state · mutating · single-shot |
| Default timeout | 300000ms |

#### Example call

```ts
await workspace.call({
  "tool": "mac.call",
  "input": {
    "command": "pwd",
    "dryRun": true
  }
});
```

#### Success envelope

```json
{
  "ok": true,
  "code": "OK",
  "message": "command completed",
  "data": {
    "raw": "example"
  },
  "stderr": "",
  "exitCode": 0,
  "durationMs": 12,
  "traceId": "trc_abc123def456",
  "apiVersion": "1.0.0"
}
```

#### Error envelope

```json
{
  "ok": false,
  "code": "VALIDATION_ERROR",
  "message": "input: Required",
  "data": {
    "issues": []
  },
  "stderr": "",
  "exitCode": 1,
  "durationMs": 12,
  "traceId": "trc_abc123def456",
  "apiVersion": "1.0.0"
}
```

### workspace.mac.exec

legacy alias for mac.call; run a non-repo shell command on the Mac

| Field | Value |
| --- | --- |
| Category | mac |
| Signature | `workspace.mac.exec({ command: string; cwd?: string; timeout?: number; dryRun?: boolean; requestId?: string; taskSession?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } &#124; null>>` |
| Runtime | `workspace mac.exec` |
| Capability | writes state · mutating · single-shot |
| Default timeout | 300000ms |

#### Example call

```ts
await workspace.call({
  "tool": "mac.exec",
  "input": {
    "command": "pwd",
    "dryRun": true
  }
});
```

#### Success envelope

```json
{
  "ok": true,
  "code": "OK",
  "message": "command completed",
  "data": {
    "raw": "example"
  },
  "stderr": "",
  "exitCode": 0,
  "durationMs": 12,
  "traceId": "trc_abc123def456",
  "apiVersion": "1.0.0"
}
```

#### Error envelope

```json
{
  "ok": false,
  "code": "VALIDATION_ERROR",
  "message": "input: Required",
  "data": {
    "issues": []
  },
  "stderr": "",
  "exitCode": 1,
  "durationMs": 12,
  "traceId": "trc_abc123def456",
  "apiVersion": "1.0.0"
}
```

### workspace.mac.list

list non-repo files on the Mac

| Field | Value |
| --- | --- |
| Category | mac |
| Signature | `workspace.mac.list({ path?: string; depth?: number; requestId?: string; taskSession?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } &#124; null>>` |
| Runtime | `workspace mac.list` |
| Capability | read-only · non-mutating · safe to retry |
| Default timeout | 300000ms |

#### Example call

```ts
await workspace.call({
  "tool": "mac.list",
  "input": {
    "path": "/tmp",
    "depth": 1
  }
});
```

#### Success envelope

```json
{
  "ok": true,
  "code": "OK",
  "message": "command completed",
  "data": {
    "raw": "example"
  },
  "stderr": "",
  "exitCode": 0,
  "durationMs": 12,
  "traceId": "trc_abc123def456",
  "apiVersion": "1.0.0"
}
```

#### Error envelope

```json
{
  "ok": false,
  "code": "VALIDATION_ERROR",
  "message": "input: Required",
  "data": {
    "issues": []
  },
  "stderr": "",
  "exitCode": 1,
  "durationMs": 12,
  "traceId": "trc_abc123def456",
  "apiVersion": "1.0.0"
}
```

### workspace.mac.port

check or find a local port

| Field | Value |
| --- | --- |
| Category | mac |
| Signature | `workspace.mac.port({ action: "check" &#124; "find"; port?: number; requestId?: string; taskSession?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } &#124; null>>` |
| Runtime | `workspace mac.port` |
| Capability | read-only · non-mutating · safe to retry |
| Default timeout | 300000ms |

#### Example call

```ts
await workspace.call({
  "tool": "mac.port",
  "input": {
    "action": "find"
  }
});
```

#### Success envelope

```json
{
  "ok": true,
  "code": "OK",
  "message": "command completed",
  "data": {
    "raw": "example"
  },
  "stderr": "",
  "exitCode": 0,
  "durationMs": 12,
  "traceId": "trc_abc123def456",
  "apiVersion": "1.0.0"
}
```

#### Error envelope

```json
{
  "ok": false,
  "code": "VALIDATION_ERROR",
  "message": "input: Required",
  "data": {
    "issues": []
  },
  "stderr": "",
  "exitCode": 1,
  "durationMs": 12,
  "traceId": "trc_abc123def456",
  "apiVersion": "1.0.0"
}
```

### workspace.mac.process

list or kill local Mac processes

| Field | Value |
| --- | --- |
| Category | mac |
| Signature | `workspace.mac.process({ action: "list" &#124; "kill"; pid?: number; name?: string; dryRun?: boolean; requestId?: string; taskSession?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } &#124; null>>` |
| Runtime | `workspace mac.process` |
| Capability | writes state · mutating · single-shot |
| Default timeout | 300000ms |

#### Example call

```ts
await workspace.call({
  "tool": "mac.process",
  "input": {
    "action": "list"
  }
});
```

#### Success envelope

```json
{
  "ok": true,
  "code": "OK",
  "message": "command completed",
  "data": {
    "raw": "example"
  },
  "stderr": "",
  "exitCode": 0,
  "durationMs": 12,
  "traceId": "trc_abc123def456",
  "apiVersion": "1.0.0"
}
```

#### Error envelope

```json
{
  "ok": false,
  "code": "VALIDATION_ERROR",
  "message": "input: Required",
  "data": {
    "issues": []
  },
  "stderr": "",
  "exitCode": 1,
  "durationMs": 12,
  "traceId": "trc_abc123def456",
  "apiVersion": "1.0.0"
}
```

### workspace.mac.read

read a non-repo file on the Mac

| Field | Value |
| --- | --- |
| Category | mac |
| Signature | `workspace.mac.read({ path: string; requestId?: string; taskSession?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } &#124; null>>` |
| Runtime | `workspace mac.read` |
| Capability | read-only · non-mutating · safe to retry |
| Default timeout | 300000ms |

#### Example call

```ts
await workspace.call({
  "tool": "mac.read",
  "input": {
    "path": "/tmp/example.txt"
  }
});
```

#### Success envelope

```json
{
  "ok": true,
  "code": "OK",
  "message": "command completed",
  "data": {
    "raw": "example"
  },
  "stderr": "",
  "exitCode": 0,
  "durationMs": 12,
  "traceId": "trc_abc123def456",
  "apiVersion": "1.0.0"
}
```

#### Error envelope

```json
{
  "ok": false,
  "code": "VALIDATION_ERROR",
  "message": "input: Required",
  "data": {
    "issues": []
  },
  "stderr": "",
  "exitCode": 1,
  "durationMs": 12,
  "traceId": "trc_abc123def456",
  "apiVersion": "1.0.0"
}
```

### workspace.mac.search

search non-repo files on the Mac

| Field | Value |
| --- | --- |
| Category | mac |
| Signature | `workspace.mac.search({ pattern: string; path?: string; include?: string; requestId?: string; taskSession?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } &#124; null>>` |
| Runtime | `workspace mac.search` |
| Capability | read-only · non-mutating · safe to retry |
| Default timeout | 300000ms |

#### Example call

```ts
await workspace.call({
  "tool": "mac.search",
  "input": {
    "pattern": "hello",
    "path": "/tmp"
  }
});
```

#### Success envelope

```json
{
  "ok": true,
  "code": "OK",
  "message": "command completed",
  "data": {
    "raw": "example"
  },
  "stderr": "",
  "exitCode": 0,
  "durationMs": 12,
  "traceId": "trc_abc123def456",
  "apiVersion": "1.0.0"
}
```

#### Error envelope

```json
{
  "ok": false,
  "code": "VALIDATION_ERROR",
  "message": "input: Required",
  "data": {
    "issues": []
  },
  "stderr": "",
  "exitCode": 1,
  "durationMs": 12,
  "traceId": "trc_abc123def456",
  "apiVersion": "1.0.0"
}
```

### workspace.mac.write

write a non-repo file on the Mac

| Field | Value |
| --- | --- |
| Category | mac |
| Signature | `workspace.mac.write({ path: string; content?: string; contentFile?: string; dryRun?: boolean; requestId?: string; taskSession?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } &#124; null>>` |
| Runtime | `workspace mac.write` |
| Capability | writes state · mutating · single-shot |
| Default timeout | 300000ms |

#### Example call

```ts
await workspace.call({
  "tool": "mac.write",
  "input": {
    "path": "/tmp/example.txt",
    "content": "hello",
    "dryRun": true
  }
});
```

#### Success envelope

```json
{
  "ok": true,
  "code": "OK",
  "message": "command completed",
  "data": {
    "raw": "example"
  },
  "stderr": "",
  "exitCode": 0,
  "durationMs": 12,
  "traceId": "trc_abc123def456",
  "apiVersion": "1.0.0"
}
```

#### Error envelope

```json
{
  "ok": false,
  "code": "VALIDATION_ERROR",
  "message": "input: Required",
  "data": {
    "issues": []
  },
  "stderr": "",
  "exitCode": 1,
  "durationMs": 12,
  "traceId": "trc_abc123def456",
  "apiVersion": "1.0.0"
}
```

## office

### workspace.design.publish

publish a design artifact through private Tailscale Serve and update the design wiki archive

| Field | Value |
| --- | --- |
| Category | office |
| Signature | `workspace.design.publish({ target?: string; portlessName?: string; path?: string; name?: string; category?: string; template?: "research" &#124; "spec" &#124; "plan"; tailscaleBin?: string; requestId?: string; taskSession?: string; dryRun?: boolean }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } &#124; null>>` |
| Runtime | `workspace office publish` |
| Capability | writes state · mutating · single-shot |
| Default timeout | 120000ms |

#### Example call

```ts
await workspace.call({
  "tool": "design.publish",
  "input": {
    "portlessName": "design.localhost",
    "dryRun": true
  }
});
```

#### Success envelope

```json
{
  "ok": true,
  "code": "OK",
  "message": "command completed",
  "data": {
    "raw": "example"
  },
  "stderr": "",
  "exitCode": 0,
  "durationMs": 12,
  "traceId": "trc_abc123def456",
  "apiVersion": "1.0.0"
}
```

#### Error envelope

```json
{
  "ok": false,
  "code": "VALIDATION_ERROR",
  "message": "input: Required",
  "data": {
    "issues": []
  },
  "stderr": "",
  "exitCode": 1,
  "durationMs": 12,
  "traceId": "trc_abc123def456",
  "apiVersion": "1.0.0"
}
```

### workspace.design.refresh

regenerate and publish the existing Consuelo Wiki archive without adding an artifact

| Field | Value |
| --- | --- |
| Category | office |
| Signature | `workspace.design.refresh({ tailscaleBin?: string; requestId?: string; taskSession?: string; dryRun?: boolean }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } &#124; null>>` |
| Runtime | `workspace office refresh` |
| Capability | writes state · mutating · single-shot |
| Default timeout | 120000ms |

#### Example call

```ts
await workspace.call({
  "tool": "design.refresh",
  "input": {
    "dryRun": true
  }
});
```

#### Success envelope

```json
{
  "ok": true,
  "code": "OK",
  "message": "command completed",
  "data": {
    "raw": "example"
  },
  "stderr": "",
  "exitCode": 0,
  "durationMs": 12,
  "traceId": "trc_abc123def456",
  "apiVersion": "1.0.0"
}
```

#### Error envelope

```json
{
  "ok": false,
  "code": "VALIDATION_ERROR",
  "message": "input: Required",
  "data": {
    "issues": []
  },
  "stderr": "",
  "exitCode": 1,
  "durationMs": 12,
  "traceId": "trc_abc123def456",
  "apiVersion": "1.0.0"
}
```

### workspace.office.check

run office package boundary and Railway checks

| Field | Value |
| --- | --- |
| Category | office |
| Signature | `workspace.office.check({ requestId?: string; taskSession?: string; dryRun?: boolean }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } &#124; null>>` |
| Runtime | `workspace office check` |
| Capability | read-only · non-mutating · safe to retry |
| Default timeout | 30000ms |

#### Example call

```ts
await workspace.call({
  "tool": "office.check",
  "input": {}
});
```

#### Success envelope

```json
{
  "ok": true,
  "code": "OK",
  "message": "command completed",
  "data": {
    "raw": "example"
  },
  "stderr": "",
  "exitCode": 0,
  "durationMs": 12,
  "traceId": "trc_abc123def456",
  "apiVersion": "1.0.0"
}
```

#### Error envelope

```json
{
  "ok": false,
  "code": "VALIDATION_ERROR",
  "message": "input: Required",
  "data": {
    "issues": []
  },
  "stderr": "",
  "exitCode": 1,
  "durationMs": 12,
  "traceId": "trc_abc123def456",
  "apiVersion": "1.0.0"
}
```

### workspace.office.generateDemo

create a headless Open Design work order for a demo artifact; pass live=true only for a headed UI session

| Field | Value |
| --- | --- |
| Category | office |
| Signature | `workspace.office.generateDemo({ requestId?: string; taskSession?: string; dryRun?: boolean; live?: boolean; name?: string; prompt?: string; timeout?: number }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } &#124; null>>` |
| Runtime | `workspace office generate-demo` |
| Capability | writes state · mutating · single-shot |
| Default timeout | 600000ms |

#### Example call

```ts
await workspace.call({
  "tool": "office.generateDemo",
  "input": {
    "dryRun": true
  }
});
```

#### Success envelope

```json
{
  "ok": true,
  "code": "OK",
  "message": "command completed",
  "data": {
    "raw": "example"
  },
  "stderr": "",
  "exitCode": 0,
  "durationMs": 12,
  "traceId": "trc_abc123def456",
  "apiVersion": "1.0.0"
}
```

#### Error envelope

```json
{
  "ok": false,
  "code": "VALIDATION_ERROR",
  "message": "input: Required",
  "data": {
    "issues": []
  },
  "stderr": "",
  "exitCode": 1,
  "durationMs": 12,
  "traceId": "trc_abc123def456",
  "apiVersion": "1.0.0"
}
```

### workspace.office.generateDigitalEguide

create a headless Open Design work order for a digital e-guide artifact, optionally using a named Consuelo e-guide template

| Field | Value |
| --- | --- |
| Category | office |
| Signature | `workspace.office.generateDigitalEguide({ requestId?: string; taskSession?: string; dryRun?: boolean; live?: boolean; name?: string; prompt?: string; template?: "research" &#124; "spec" &#124; "plan"; timeout?: number }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } &#124; null>>` |
| Runtime | `workspace office generate-digital-eguide` |
| Capability | writes state · mutating · single-shot |
| Default timeout | 600000ms |

#### Example call

```ts
await workspace.call({
  "tool": "office.generateDigitalEguide",
  "input": {
    "dryRun": true
  }
});
```

#### Success envelope

```json
{
  "ok": true,
  "code": "OK",
  "message": "command completed",
  "data": {
    "raw": "example"
  },
  "stderr": "",
  "exitCode": 0,
  "durationMs": 12,
  "traceId": "trc_abc123def456",
  "apiVersion": "1.0.0"
}
```

#### Error envelope

```json
{
  "ok": false,
  "code": "VALIDATION_ERROR",
  "message": "input: Required",
  "data": {
    "issues": []
  },
  "stderr": "",
  "exitCode": 1,
  "durationMs": 12,
  "traceId": "trc_abc123def456",
  "apiVersion": "1.0.0"
}
```

### workspace.office.generateEmail

create a headless Open Design work order for a email artifact; pass live=true only for a headed UI session

| Field | Value |
| --- | --- |
| Category | office |
| Signature | `workspace.office.generateEmail({ requestId?: string; taskSession?: string; dryRun?: boolean; live?: boolean; name?: string; prompt?: string; timeout?: number }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } &#124; null>>` |
| Runtime | `workspace office generate-email` |
| Capability | writes state · mutating · single-shot |
| Default timeout | 600000ms |

#### Example call

```ts
await workspace.call({
  "tool": "office.generateEmail",
  "input": {
    "dryRun": true
  }
});
```

#### Success envelope

```json
{
  "ok": true,
  "code": "OK",
  "message": "command completed",
  "data": {
    "raw": "example"
  },
  "stderr": "",
  "exitCode": 0,
  "durationMs": 12,
  "traceId": "trc_abc123def456",
  "apiVersion": "1.0.0"
}
```

#### Error envelope

```json
{
  "ok": false,
  "code": "VALIDATION_ERROR",
  "message": "input: Required",
  "data": {
    "issues": []
  },
  "stderr": "",
  "exitCode": 1,
  "durationMs": 12,
  "traceId": "trc_abc123def456",
  "apiVersion": "1.0.0"
}
```

### workspace.office.generateImageBrief

create a headless Open Design work order for a image/media artifact; pass live=true only for a headed UI session

| Field | Value |
| --- | --- |
| Category | office |
| Signature | `workspace.office.generateImageBrief({ requestId?: string; taskSession?: string; dryRun?: boolean; live?: boolean; name?: string; prompt?: string; timeout?: number }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } &#124; null>>` |
| Runtime | `workspace office generate-image-brief` |
| Capability | writes state · mutating · single-shot |
| Default timeout | 600000ms |

#### Example call

```ts
await workspace.call({
  "tool": "office.generateImageBrief",
  "input": {
    "dryRun": true
  }
});
```

#### Success envelope

```json
{
  "ok": true,
  "code": "OK",
  "message": "command completed",
  "data": {
    "raw": "example"
  },
  "stderr": "",
  "exitCode": 0,
  "durationMs": 12,
  "traceId": "trc_abc123def456",
  "apiVersion": "1.0.0"
}
```

#### Error envelope

```json
{
  "ok": false,
  "code": "VALIDATION_ERROR",
  "message": "input: Required",
  "data": {
    "issues": []
  },
  "stderr": "",
  "exitCode": 1,
  "durationMs": 12,
  "traceId": "trc_abc123def456",
  "apiVersion": "1.0.0"
}
```

### workspace.office.generateMotionFrame

create a headless Open Design work order for a motion-frame artifact; pass live=true only for a headed UI session

| Field | Value |
| --- | --- |
| Category | office |
| Signature | `workspace.office.generateMotionFrame({ requestId?: string; taskSession?: string; dryRun?: boolean; live?: boolean; name?: string; prompt?: string; timeout?: number }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } &#124; null>>` |
| Runtime | `workspace office generate-motion-frame` |
| Capability | writes state · mutating · single-shot |
| Default timeout | 600000ms |

#### Example call

```ts
await workspace.call({
  "tool": "office.generateMotionFrame",
  "input": {
    "dryRun": true
  }
});
```

#### Success envelope

```json
{
  "ok": true,
  "code": "OK",
  "message": "command completed",
  "data": {
    "raw": "example"
  },
  "stderr": "",
  "exitCode": 0,
  "durationMs": 12,
  "traceId": "trc_abc123def456",
  "apiVersion": "1.0.0"
}
```

#### Error envelope

```json
{
  "ok": false,
  "code": "VALIDATION_ERROR",
  "message": "input: Required",
  "data": {
    "issues": []
  },
  "stderr": "",
  "exitCode": 1,
  "durationMs": 12,
  "traceId": "trc_abc123def456",
  "apiVersion": "1.0.0"
}
```

### workspace.office.generateWebsite

create a headless Open Design work order for a website artifact; pass live=true only for a headed UI session

| Field | Value |
| --- | --- |
| Category | office |
| Signature | `workspace.office.generateWebsite({ requestId?: string; taskSession?: string; dryRun?: boolean; live?: boolean; name?: string; prompt?: string; timeout?: number }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } &#124; null>>` |
| Runtime | `workspace office generate-website` |
| Capability | writes state · mutating · single-shot |
| Default timeout | 600000ms |

#### Example call

```ts
await workspace.call({
  "tool": "office.generateWebsite",
  "input": {
    "dryRun": true
  }
});
```

#### Success envelope

```json
{
  "ok": true,
  "code": "OK",
  "message": "command completed",
  "data": {
    "raw": "example"
  },
  "stderr": "",
  "exitCode": 0,
  "durationMs": 12,
  "traceId": "trc_abc123def456",
  "apiVersion": "1.0.0"
}
```

#### Error envelope

```json
{
  "ok": false,
  "code": "VALIDATION_ERROR",
  "message": "input: Required",
  "data": {
    "issues": []
  },
  "stderr": "",
  "exitCode": 1,
  "durationMs": 12,
  "traceId": "trc_abc123def456",
  "apiVersion": "1.0.0"
}
```

### workspace.office.getDesignSystem

return base Consuelo DESIGN.md and office AGENTS.md only

| Field | Value |
| --- | --- |
| Category | office |
| Signature | `workspace.office.getDesignSystem({ requestId?: string; taskSession?: string; dryRun?: boolean }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } &#124; null>>` |
| Runtime | `workspace office get-design-system` |
| Capability | read-only · non-mutating · safe to retry |
| Default timeout | 30000ms |

#### Example call

```ts
await workspace.call({
  "tool": "office.getDesignSystem",
  "input": {}
});
```

#### Success envelope

```json
{
  "ok": true,
  "code": "OK",
  "message": "command completed",
  "data": {
    "raw": "example"
  },
  "stderr": "",
  "exitCode": 0,
  "durationMs": 12,
  "traceId": "trc_abc123def456",
  "apiVersion": "1.0.0"
}
```

#### Error envelope

```json
{
  "ok": false,
  "code": "VALIDATION_ERROR",
  "message": "input: Required",
  "data": {
    "issues": []
  },
  "stderr": "",
  "exitCode": 1,
  "durationMs": 12,
  "traceId": "trc_abc123def456",
  "apiVersion": "1.0.0"
}
```

### workspace.office.listDesignSystems

list Consuelo default design system and upstream reference systems

| Field | Value |
| --- | --- |
| Category | office |
| Signature | `workspace.office.listDesignSystems({ requestId?: string; taskSession?: string; dryRun?: boolean }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } &#124; null>>` |
| Runtime | `workspace office list-design-systems` |
| Capability | read-only · non-mutating · safe to retry |
| Default timeout | 30000ms |

#### Example call

```ts
await workspace.call({
  "tool": "office.listDesignSystems",
  "input": {}
});
```

#### Success envelope

```json
{
  "ok": true,
  "code": "OK",
  "message": "command completed",
  "data": {
    "raw": "example"
  },
  "stderr": "",
  "exitCode": 0,
  "durationMs": 12,
  "traceId": "trc_abc123def456",
  "apiVersion": "1.0.0"
}
```

#### Error envelope

```json
{
  "ok": false,
  "code": "VALIDATION_ERROR",
  "message": "input: Required",
  "data": {
    "issues": []
  },
  "stderr": "",
  "exitCode": 1,
  "durationMs": 12,
  "traceId": "trc_abc123def456",
  "apiVersion": "1.0.0"
}
```

### workspace.office.listSkills

list upstream Open Design skills and Consuelo workflow mappings

| Field | Value |
| --- | --- |
| Category | office |
| Signature | `workspace.office.listSkills({ requestId?: string; taskSession?: string; dryRun?: boolean }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } &#124; null>>` |
| Runtime | `workspace office list-skills` |
| Capability | read-only · non-mutating · safe to retry |
| Default timeout | 30000ms |

#### Example call

```ts
await workspace.call({
  "tool": "office.listSkills",
  "input": {}
});
```

#### Success envelope

```json
{
  "ok": true,
  "code": "OK",
  "message": "command completed",
  "data": {
    "raw": "example"
  },
  "stderr": "",
  "exitCode": 0,
  "durationMs": 12,
  "traceId": "trc_abc123def456",
  "apiVersion": "1.0.0"
}
```

#### Error envelope

```json
{
  "ok": false,
  "code": "VALIDATION_ERROR",
  "message": "input: Required",
  "data": {
    "issues": []
  },
  "stderr": "",
  "exitCode": 1,
  "durationMs": 12,
  "traceId": "trc_abc123def456",
  "apiVersion": "1.0.0"
}
```

### workspace.office.odBuild

build the vendored Open Design daemon CLI through the Bun facade

| Field | Value |
| --- | --- |
| Category | office |
| Signature | `workspace.office.odBuild({ requestId?: string; taskSession?: string; dryRun?: boolean; timeout?: number }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } &#124; null>>` |
| Runtime | `workspace office od:build` |
| Capability | writes state · mutating · single-shot |
| Default timeout | 300000ms |

#### Example call

```ts
await workspace.call({
  "tool": "office.odBuild",
  "input": {
    "dryRun": true
  }
});
```

#### Success envelope

```json
{
  "ok": true,
  "code": "OK",
  "message": "command completed",
  "data": {
    "raw": "example"
  },
  "stderr": "",
  "exitCode": 0,
  "durationMs": 12,
  "traceId": "trc_abc123def456",
  "apiVersion": "1.0.0"
}
```

#### Error envelope

```json
{
  "ok": false,
  "code": "VALIDATION_ERROR",
  "message": "input: Required",
  "data": {
    "issues": []
  },
  "stderr": "",
  "exitCode": 1,
  "durationMs": 12,
  "traceId": "trc_abc123def456",
  "apiVersion": "1.0.0"
}
```

### workspace.office.railwayCheck

verify office is excluded from Railway deploy paths

| Field | Value |
| --- | --- |
| Category | office |
| Signature | `workspace.office.railwayCheck({ requestId?: string; taskSession?: string; dryRun?: boolean }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } &#124; null>>` |
| Runtime | `workspace office railway:check` |
| Capability | read-only · non-mutating · safe to retry |
| Default timeout | 30000ms |

#### Example call

```ts
await workspace.call({
  "tool": "office.railwayCheck",
  "input": {}
});
```

#### Success envelope

```json
{
  "ok": true,
  "code": "OK",
  "message": "command completed",
  "data": {
    "raw": "example"
  },
  "stderr": "",
  "exitCode": 0,
  "durationMs": 12,
  "traceId": "trc_abc123def456",
  "apiVersion": "1.0.0"
}
```

#### Error envelope

```json
{
  "ok": false,
  "code": "VALIDATION_ERROR",
  "message": "input: Required",
  "data": {
    "issues": []
  },
  "stderr": "",
  "exitCode": 1,
  "durationMs": 12,
  "traceId": "trc_abc123def456",
  "apiVersion": "1.0.0"
}
```

### workspace.office.renderHyperframes

create a headless Open Design work order for a HyperFrames render artifact; pass live=true only for a headed UI session

| Field | Value |
| --- | --- |
| Category | office |
| Signature | `workspace.office.renderHyperframes({ requestId?: string; taskSession?: string; dryRun?: boolean; live?: boolean; name?: string; prompt?: string; timeout?: number }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } &#124; null>>` |
| Runtime | `workspace office render-hyperframes` |
| Capability | writes state · mutating · single-shot |
| Default timeout | 600000ms |

#### Example call

```ts
await workspace.call({
  "tool": "office.renderHyperframes",
  "input": {
    "dryRun": true
  }
});
```

#### Success envelope

```json
{
  "ok": true,
  "code": "OK",
  "message": "command completed",
  "data": {
    "raw": "example"
  },
  "stderr": "",
  "exitCode": 0,
  "durationMs": 12,
  "traceId": "trc_abc123def456",
  "apiVersion": "1.0.0"
}
```

#### Error envelope

```json
{
  "ok": false,
  "code": "VALIDATION_ERROR",
  "message": "input: Required",
  "data": {
    "issues": []
  },
  "stderr": "",
  "exitCode": 1,
  "durationMs": 12,
  "traceId": "trc_abc123def456",
  "apiVersion": "1.0.0"
}
```

### workspace.office.run

start Open Design daemon and web UI in the foreground through the Bun facade

| Field | Value |
| --- | --- |
| Category | office |
| Signature | `workspace.office.run({ requestId?: string; taskSession?: string; dryRun?: boolean; timeout?: number }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } &#124; null>>` |
| Runtime | `workspace office run` |
| Capability | writes state · mutating · single-shot |
| Default timeout | 600000ms |

#### Example call

```ts
await workspace.call({
  "tool": "office.run",
  "input": {
    "dryRun": true
  }
});
```

#### Success envelope

```json
{
  "ok": true,
  "code": "OK",
  "message": "command completed",
  "data": {
    "raw": "example"
  },
  "stderr": "",
  "exitCode": 0,
  "durationMs": 12,
  "traceId": "trc_abc123def456",
  "apiVersion": "1.0.0"
}
```

#### Error envelope

```json
{
  "ok": false,
  "code": "VALIDATION_ERROR",
  "message": "input: Required",
  "data": {
    "issues": []
  },
  "stderr": "",
  "exitCode": 1,
  "durationMs": 12,
  "traceId": "trc_abc123def456",
  "apiVersion": "1.0.0"
}
```

### workspace.office.uiBg

start Open Design managed runtimes in the background through the Bun facade

| Field | Value |
| --- | --- |
| Category | office |
| Signature | `workspace.office.uiBg({ requestId?: string; taskSession?: string; dryRun?: boolean; timeout?: number }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } &#124; null>>` |
| Runtime | `workspace office ui:bg` |
| Capability | writes state · mutating · single-shot |
| Default timeout | 300000ms |

#### Example call

```ts
await workspace.call({
  "tool": "office.uiBg",
  "input": {
    "dryRun": true
  }
});
```

#### Success envelope

```json
{
  "ok": true,
  "code": "OK",
  "message": "command completed",
  "data": {
    "raw": "example"
  },
  "stderr": "",
  "exitCode": 0,
  "durationMs": 12,
  "traceId": "trc_abc123def456",
  "apiVersion": "1.0.0"
}
```

#### Error envelope

```json
{
  "ok": false,
  "code": "VALIDATION_ERROR",
  "message": "input: Required",
  "data": {
    "issues": []
  },
  "stderr": "",
  "exitCode": 1,
  "durationMs": 12,
  "traceId": "trc_abc123def456",
  "apiVersion": "1.0.0"
}
```

### workspace.office.uiLogs

show Open Design managed runtime logs through the Bun facade

| Field | Value |
| --- | --- |
| Category | office |
| Signature | `workspace.office.uiLogs({ requestId?: string; taskSession?: string; dryRun?: boolean }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } &#124; null>>` |
| Runtime | `workspace office ui:logs` |
| Capability | read-only · non-mutating · safe to retry |
| Default timeout | 30000ms |

#### Example call

```ts
await workspace.call({
  "tool": "office.uiLogs",
  "input": {}
});
```

#### Success envelope

```json
{
  "ok": true,
  "code": "OK",
  "message": "command completed",
  "data": {
    "raw": "example"
  },
  "stderr": "",
  "exitCode": 0,
  "durationMs": 12,
  "traceId": "trc_abc123def456",
  "apiVersion": "1.0.0"
}
```

#### Error envelope

```json
{
  "ok": false,
  "code": "VALIDATION_ERROR",
  "message": "input: Required",
  "data": {
    "issues": []
  },
  "stderr": "",
  "exitCode": 1,
  "durationMs": 12,
  "traceId": "trc_abc123def456",
  "apiVersion": "1.0.0"
}
```

### workspace.office.uiStatus

show Open Design managed runtime status through the Bun facade

| Field | Value |
| --- | --- |
| Category | office |
| Signature | `workspace.office.uiStatus({ requestId?: string; taskSession?: string; dryRun?: boolean }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } &#124; null>>` |
| Runtime | `workspace office ui:status` |
| Capability | read-only · non-mutating · safe to retry |
| Default timeout | 30000ms |

#### Example call

```ts
await workspace.call({
  "tool": "office.uiStatus",
  "input": {}
});
```

#### Success envelope

```json
{
  "ok": true,
  "code": "OK",
  "message": "command completed",
  "data": {
    "raw": "example"
  },
  "stderr": "",
  "exitCode": 0,
  "durationMs": 12,
  "traceId": "trc_abc123def456",
  "apiVersion": "1.0.0"
}
```

#### Error envelope

```json
{
  "ok": false,
  "code": "VALIDATION_ERROR",
  "message": "input: Required",
  "data": {
    "issues": []
  },
  "stderr": "",
  "exitCode": 1,
  "durationMs": 12,
  "traceId": "trc_abc123def456",
  "apiVersion": "1.0.0"
}
```

### workspace.office.uiStop

stop Open Design managed runtimes through the Bun facade

| Field | Value |
| --- | --- |
| Category | office |
| Signature | `workspace.office.uiStop({ requestId?: string; taskSession?: string; dryRun?: boolean; timeout?: number }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } &#124; null>>` |
| Runtime | `workspace office ui:stop` |
| Capability | writes state · mutating · single-shot |
| Default timeout | 120000ms |

#### Example call

```ts
await workspace.call({
  "tool": "office.uiStop",
  "input": {
    "dryRun": true
  }
});
```

#### Success envelope

```json
{
  "ok": true,
  "code": "OK",
  "message": "command completed",
  "data": {
    "raw": "example"
  },
  "stderr": "",
  "exitCode": 0,
  "durationMs": 12,
  "traceId": "trc_abc123def456",
  "apiVersion": "1.0.0"
}
```

#### Error envelope

```json
{
  "ok": false,
  "code": "VALIDATION_ERROR",
  "message": "input: Required",
  "data": {
    "issues": []
  },
  "stderr": "",
  "exitCode": 1,
  "durationMs": 12,
  "traceId": "trc_abc123def456",
  "apiVersion": "1.0.0"
}
```

### workspace.office.upstreamStatus

show vendored Open Design metadata and runtime requirements

| Field | Value |
| --- | --- |
| Category | office |
| Signature | `workspace.office.upstreamStatus({ requestId?: string; taskSession?: string; dryRun?: boolean }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } &#124; null>>` |
| Runtime | `workspace office upstream-status` |
| Capability | read-only · non-mutating · safe to retry |
| Default timeout | 30000ms |

#### Example call

```ts
await workspace.call({
  "tool": "office.upstreamStatus",
  "input": {}
});
```

#### Success envelope

```json
{
  "ok": true,
  "code": "OK",
  "message": "command completed",
  "data": {
    "raw": "example"
  },
  "stderr": "",
  "exitCode": 0,
  "durationMs": 12,
  "traceId": "trc_abc123def456",
  "apiVersion": "1.0.0"
}
```

#### Error envelope

```json
{
  "ok": false,
  "code": "VALIDATION_ERROR",
  "message": "input: Required",
  "data": {
    "issues": []
  },
  "stderr": "",
  "exitCode": 1,
  "durationMs": 12,
  "traceId": "trc_abc123def456",
  "apiVersion": "1.0.0"
}
```

## review

### workspace.aiReview

run the AI PR review helper

| Field | Value |
| --- | --- |
| Category | review |
| Signature | `workspace.aiReview({ pr?: number; noPost?: boolean; dryRun?: boolean; requestId?: string; taskSession?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } &#124; null>>` |
| Runtime | `workspace aiReview` |
| Capability | writes state · mutating · single-shot |
| Default timeout | 600000ms |

#### Example call

```ts
await workspace.call({
  "tool": "aiReview",
  "input": {
    "pr": 226,
    "noPost": true
  }
});
```

#### Success envelope

```json
{
  "ok": true,
  "code": "OK",
  "message": "command completed",
  "data": {
    "raw": "example"
  },
  "stderr": "",
  "exitCode": 0,
  "durationMs": 12,
  "traceId": "trc_abc123def456",
  "apiVersion": "1.0.0"
}
```

#### Error envelope

```json
{
  "ok": false,
  "code": "VALIDATION_ERROR",
  "message": "input: Required",
  "data": {
    "issues": []
  },
  "stderr": "",
  "exitCode": 1,
  "durationMs": 12,
  "traceId": "trc_abc123def456",
  "apiVersion": "1.0.0"
}
```

### workspace.prReview

fetch review comments for a PR

| Field | Value |
| --- | --- |
| Category | review |
| Signature | `workspace.prReview({ pr?: number; stdout?: boolean; dryRun?: boolean; requestId?: string; taskSession?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } &#124; null>>` |
| Runtime | `workspace prReview` |
| Capability | read-only · non-mutating · safe to retry |
| Default timeout | 120000ms |

#### Example call

```ts
await workspace.call({
  "tool": "prReview",
  "input": {
    "pr": 225,
    "stdout": true
  }
});
```

#### Success envelope

```json
{
  "ok": true,
  "code": "OK",
  "message": "command completed",
  "data": {
    "raw": "example"
  },
  "stderr": "",
  "exitCode": 0,
  "durationMs": 12,
  "traceId": "trc_abc123def456",
  "apiVersion": "1.0.0"
}
```

#### Error envelope

```json
{
  "ok": false,
  "code": "VALIDATION_ERROR",
  "message": "input: Required",
  "data": {
    "issues": []
  },
  "stderr": "",
  "exitCode": 1,
  "durationMs": 12,
  "traceId": "trc_abc123def456",
  "apiVersion": "1.0.0"
}
```

### workspace.review.run

run the workspace review checks

| Field | Value |
| --- | --- |
| Category | review |
| Signature | `workspace.review.run({ branch?: string; fix?: boolean; all?: boolean; base?: string; strict?: boolean; mine?: boolean; noTests?: boolean; requestId?: string; taskSession?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } &#124; null>>` |
| Runtime | `workspace review.run` |
| Capability | read-only · non-mutating · single-shot |
| Default timeout | 600000ms |

#### Example call

```ts
await workspace.call({
  "tool": "review.run",
  "input": {
    "branch": "task/workspace-agents/example",
    "noTests": true
  }
});
```

#### Success envelope

```json
{
  "ok": true,
  "code": "OK",
  "message": "command completed",
  "data": {
    "raw": "example"
  },
  "stderr": "",
  "exitCode": 0,
  "durationMs": 12,
  "traceId": "trc_abc123def456",
  "apiVersion": "1.0.0"
}
```

#### Error envelope

```json
{
  "ok": false,
  "code": "VALIDATION_ERROR",
  "message": "input: Required",
  "data": {
    "issues": []
  },
  "stderr": "",
  "exitCode": 1,
  "durationMs": 12,
  "traceId": "trc_abc123def456",
  "apiVersion": "1.0.0"
}
```

### workspace.verify

run the full task safety gate

| Field | Value |
| --- | --- |
| Category | review |
| Signature | `workspace.verify({ branch?: string; base?: string; noStamp?: boolean; dryRun?: boolean; requestId?: string; taskSession?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } &#124; null>>` |
| Runtime | `workspace verify` |
| Capability | writes state · mutating · single-shot |
| Default timeout | 600000ms |

#### Example call

```ts
await workspace.call({
  "tool": "verify",
  "input": {
    "branch": "task/workspace-agents/example",
    "noStamp": true,
    "dryRun": true
  }
});
```

#### Success envelope

```json
{
  "ok": true,
  "code": "OK",
  "message": "command completed",
  "data": {
    "raw": "example"
  },
  "stderr": "",
  "exitCode": 0,
  "durationMs": 12,
  "traceId": "trc_abc123def456",
  "apiVersion": "1.0.0"
}
```

#### Error envelope

```json
{
  "ok": false,
  "code": "VALIDATION_ERROR",
  "message": "input: Required",
  "data": {
    "issues": []
  },
  "stderr": "",
  "exitCode": 1,
  "durationMs": 12,
  "traceId": "trc_abc123def456",
  "apiVersion": "1.0.0"
}
```

## sentry

### workspace.sentry.config

show Sentry API configuration status from Keychain without exposing secrets

| Field | Value |
| --- | --- |
| Category | sentry |
| Signature | `workspace.sentry.config({ verify?: boolean; requestId?: string; taskSession?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } &#124; null>>` |
| Runtime | `workspace sentry.config` |
| Capability | read-only · non-mutating · safe to retry |
| Default timeout | 60000ms |

#### Example call

```ts
await workspace.call({
  "tool": "sentry.config",
  "input": {
    "verify": true
  }
});
```

#### Success envelope

```json
{
  "ok": true,
  "code": "OK",
  "message": "command completed",
  "data": {
    "raw": "example"
  },
  "stderr": "",
  "exitCode": 0,
  "durationMs": 12,
  "traceId": "trc_abc123def456",
  "apiVersion": "1.0.0"
}
```

#### Error envelope

```json
{
  "ok": false,
  "code": "VALIDATION_ERROR",
  "message": "input: Required",
  "data": {
    "issues": []
  },
  "stderr": "",
  "exitCode": 1,
  "durationMs": 12,
  "traceId": "trc_abc123def456",
  "apiVersion": "1.0.0"
}
```

### workspace.sentry.event

retrieve or resolve a Sentry event id, using a project slug when available

| Field | Value |
| --- | --- |
| Category | sentry |
| Signature | `workspace.sentry.event({ eventId: string; project?: string; requestId?: string; taskSession?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } &#124; null>>` |
| Runtime | `workspace sentry.event` |
| Capability | read-only · non-mutating · safe to retry |
| Default timeout | 60000ms |

#### Example call

```ts
await workspace.call({
  "tool": "sentry.event",
  "input": {
    "eventId": "0123456789abcdef0123456789abcdef"
  }
});
```

#### Success envelope

```json
{
  "ok": true,
  "code": "OK",
  "message": "command completed",
  "data": {
    "raw": "example"
  },
  "stderr": "",
  "exitCode": 0,
  "durationMs": 12,
  "traceId": "trc_abc123def456",
  "apiVersion": "1.0.0"
}
```

#### Error envelope

```json
{
  "ok": false,
  "code": "VALIDATION_ERROR",
  "message": "input: Required",
  "data": {
    "issues": []
  },
  "stderr": "",
  "exitCode": 1,
  "durationMs": 12,
  "traceId": "trc_abc123def456",
  "apiVersion": "1.0.0"
}
```

### workspace.sentry.issue

retrieve one Sentry issue by short id or numeric issue id

| Field | Value |
| --- | --- |
| Category | sentry |
| Signature | `workspace.sentry.issue({ identifier: string; expand?: string[]; requestId?: string; taskSession?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } &#124; null>>` |
| Runtime | `workspace sentry.issue` |
| Capability | read-only · non-mutating · safe to retry |
| Default timeout | 60000ms |

#### Example call

```ts
await workspace.call({
  "tool": "sentry.issue",
  "input": {
    "identifier": "PROJECT-123"
  }
});
```

#### Success envelope

```json
{
  "ok": true,
  "code": "OK",
  "message": "command completed",
  "data": {
    "raw": "example"
  },
  "stderr": "",
  "exitCode": 0,
  "durationMs": 12,
  "traceId": "trc_abc123def456",
  "apiVersion": "1.0.0"
}
```

#### Error envelope

```json
{
  "ok": false,
  "code": "VALIDATION_ERROR",
  "message": "input: Required",
  "data": {
    "issues": []
  },
  "stderr": "",
  "exitCode": 1,
  "durationMs": 12,
  "traceId": "trc_abc123def456",
  "apiVersion": "1.0.0"
}
```

### workspace.sentry.issueEvent

retrieve a latest, recommended, oldest, or concrete Sentry event for an issue

| Field | Value |
| --- | --- |
| Category | sentry |
| Signature | `workspace.sentry.issueEvent({ issueId: string; eventId?: string; full?: boolean; requestId?: string; taskSession?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } &#124; null>>` |
| Runtime | `workspace sentry.issueEvent` |
| Capability | read-only · non-mutating · safe to retry |
| Default timeout | 60000ms |

#### Example call

```ts
await workspace.call({
  "tool": "sentry.issueEvent",
  "input": {
    "issueId": "PROJECT-123",
    "eventId": "recommended",
    "full": true
  }
});
```

#### Success envelope

```json
{
  "ok": true,
  "code": "OK",
  "message": "command completed",
  "data": {
    "raw": "example"
  },
  "stderr": "",
  "exitCode": 0,
  "durationMs": 12,
  "traceId": "trc_abc123def456",
  "apiVersion": "1.0.0"
}
```

#### Error envelope

```json
{
  "ok": false,
  "code": "VALIDATION_ERROR",
  "message": "input: Required",
  "data": {
    "issues": []
  },
  "stderr": "",
  "exitCode": 1,
  "durationMs": 12,
  "traceId": "trc_abc123def456",
  "apiVersion": "1.0.0"
}
```

### workspace.sentry.issues

search Sentry issues across the configured organization

| Field | Value |
| --- | --- |
| Category | sentry |
| Signature | `workspace.sentry.issues({ query?: string; project?: string; environment?: string[]; sort?: string; statsPeriod?: string; start?: string; end?: string; cursor?: string; limit?: number; expand?: string[]; collapse?: string[]; requestId?: string; taskSession?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } &#124; null>>` |
| Runtime | `workspace sentry.issues` |
| Capability | read-only · non-mutating · safe to retry |
| Default timeout | 60000ms |

#### Example call

```ts
await workspace.call({
  "tool": "sentry.issues",
  "input": {
    "query": "is:unresolved",
    "limit": 10
  }
});
```

#### Success envelope

```json
{
  "ok": true,
  "code": "OK",
  "message": "command completed",
  "data": {
    "raw": "example"
  },
  "stderr": "",
  "exitCode": 0,
  "durationMs": 12,
  "traceId": "trc_abc123def456",
  "apiVersion": "1.0.0"
}
```

#### Error envelope

```json
{
  "ok": false,
  "code": "VALIDATION_ERROR",
  "message": "input: Required",
  "data": {
    "issues": []
  },
  "stderr": "",
  "exitCode": 1,
  "durationMs": 12,
  "traceId": "trc_abc123def456",
  "apiVersion": "1.0.0"
}
```

### workspace.sentry.projects

list Sentry projects for the configured organization

| Field | Value |
| --- | --- |
| Category | sentry |
| Signature | `workspace.sentry.projects({ limit?: number; cursor?: string; requestId?: string; taskSession?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } &#124; null>>` |
| Runtime | `workspace sentry.projects` |
| Capability | read-only · non-mutating · safe to retry |
| Default timeout | 60000ms |

#### Example call

```ts
await workspace.call({
  "tool": "sentry.projects",
  "input": {
    "limit": 25
  }
});
```

#### Success envelope

```json
{
  "ok": true,
  "code": "OK",
  "message": "command completed",
  "data": {
    "raw": "example"
  },
  "stderr": "",
  "exitCode": 0,
  "durationMs": 12,
  "traceId": "trc_abc123def456",
  "apiVersion": "1.0.0"
}
```

#### Error envelope

```json
{
  "ok": false,
  "code": "VALIDATION_ERROR",
  "message": "input: Required",
  "data": {
    "issues": []
  },
  "stderr": "",
  "exitCode": 1,
  "durationMs": 12,
  "traceId": "trc_abc123def456",
  "apiVersion": "1.0.0"
}
```

### workspace.sentry.trace

perform a best-effort Sentry trace lookup across organization events and issues

| Field | Value |
| --- | --- |
| Category | sentry |
| Signature | `workspace.sentry.trace({ traceId: string; project?: string; query?: string; statsPeriod?: string; dataset?: string; field?: string[]; cursor?: string; limit?: number; requestId?: string; taskSession?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } &#124; null>>` |
| Runtime | `workspace sentry.trace` |
| Capability | read-only · non-mutating · safe to retry |
| Default timeout | 60000ms |

#### Example call

```ts
await workspace.call({
  "tool": "sentry.trace",
  "input": {
    "traceId": "0123456789abcdef0123456789abcdef",
    "limit": 10
  }
});
```

#### Success envelope

```json
{
  "ok": true,
  "code": "OK",
  "message": "command completed",
  "data": {
    "raw": "example"
  },
  "stderr": "",
  "exitCode": 0,
  "durationMs": 12,
  "traceId": "trc_abc123def456",
  "apiVersion": "1.0.0"
}
```

#### Error envelope

```json
{
  "ok": false,
  "code": "VALIDATION_ERROR",
  "message": "input: Required",
  "data": {
    "issues": []
  },
  "stderr": "",
  "exitCode": 1,
  "durationMs": 12,
  "traceId": "trc_abc123def456",
  "apiVersion": "1.0.0"
}
```

## stream

### workspace.stream.context

show recent stream context

| Field | Value |
| --- | --- |
| Category | stream |
| Signature | `workspace.stream.context({ area: string; stream?: string; repo?: string; dryRun?: boolean; requestId?: string; taskSession?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } &#124; null>>` |
| Runtime | `workspace stream.context` |
| Capability | read-only · non-mutating · safe to retry |
| Default timeout | 120000ms |

#### Example call

```ts
await workspace.call({
  "tool": "stream.context",
  "input": {
    "area": "workspace-agents"
  }
});
```

#### Success envelope

```json
{
  "ok": true,
  "code": "OK",
  "message": "command completed",
  "data": {
    "raw": "example"
  },
  "stderr": "",
  "exitCode": 0,
  "durationMs": 12,
  "traceId": "trc_abc123def456",
  "apiVersion": "1.0.0"
}
```

#### Error envelope

```json
{
  "ok": false,
  "code": "VALIDATION_ERROR",
  "message": "input: Required",
  "data": {
    "issues": []
  },
  "stderr": "",
  "exitCode": 1,
  "durationMs": 12,
  "traceId": "trc_abc123def456",
  "apiVersion": "1.0.0"
}
```

### workspace.stream.list

list stream branches

| Field | Value |
| --- | --- |
| Category | stream |
| Signature | `workspace.stream.list({ repo?: string; requestId?: string; taskSession?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } &#124; null>>` |
| Runtime | `workspace stream.list` |
| Capability | read-only · non-mutating · safe to retry |
| Default timeout | 120000ms |

#### Example call

```ts
await workspace.call({
  "tool": "stream.list",
  "input": {}
});
```

#### Success envelope

```json
{
  "ok": true,
  "code": "OK",
  "message": "command completed",
  "data": {
    "raw": "example"
  },
  "stderr": "",
  "exitCode": 0,
  "durationMs": 12,
  "traceId": "trc_abc123def456",
  "apiVersion": "1.0.0"
}
```

#### Error envelope

```json
{
  "ok": false,
  "code": "VALIDATION_ERROR",
  "message": "input: Required",
  "data": {
    "issues": []
  },
  "stderr": "",
  "exitCode": 1,
  "durationMs": 12,
  "traceId": "trc_abc123def456",
  "apiVersion": "1.0.0"
}
```

### workspace.stream.sync

sync a stream branch with main

| Field | Value |
| --- | --- |
| Category | stream |
| Signature | `workspace.stream.sync({ area: string; stream?: string; repo?: string; dryRun?: boolean; requestId?: string; taskSession?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } &#124; null>>` |
| Runtime | `workspace stream.sync` |
| Capability | writes state · mutating · single-shot |
| Default timeout | 120000ms |

#### Example call

```ts
await workspace.call({
  "tool": "stream.sync",
  "input": {
    "area": "workspace-agents",
    "dryRun": true
  }
});
```

#### Success envelope

```json
{
  "ok": true,
  "code": "OK",
  "message": "command completed",
  "data": {
    "raw": "example"
  },
  "stderr": "",
  "exitCode": 0,
  "durationMs": 12,
  "traceId": "trc_abc123def456",
  "apiVersion": "1.0.0"
}
```

#### Error envelope

```json
{
  "ok": false,
  "code": "VALIDATION_ERROR",
  "message": "input: Required",
  "data": {
    "issues": []
  },
  "stderr": "",
  "exitCode": 1,
  "durationMs": 12,
  "traceId": "trc_abc123def456",
  "apiVersion": "1.0.0"
}
```

## task lifecycle

### workspace.task.call

run a command inside a task worktree

| Field | Value |
| --- | --- |
| Category | task lifecycle |
| Signature | `workspace.task.call({ branch?: string; command: string[]; tddPhase?: "red" &#124; "green" &#124; "post"; timeout?: number; dryRun?: boolean; requestId?: string; taskSession?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } &#124; null>>` |
| Runtime | `workspace task.call` |
| Capability | writes state · mutating · single-shot |
| Default timeout | 300000ms |

#### Example call

```ts
await workspace.call({
  "tool": "task.call",
  "input": {
    "branch": "task/workspace-agents/example",
    "command": [
      "git",
      "status",
      "--short"
    ],
    "dryRun": true
  }
});
```

#### Success envelope

```json
{
  "ok": true,
  "code": "OK",
  "message": "command completed",
  "data": {
    "raw": "example"
  },
  "stderr": "",
  "exitCode": 0,
  "durationMs": 12,
  "traceId": "trc_abc123def456",
  "apiVersion": "1.0.0"
}
```

#### Error envelope

```json
{
  "ok": false,
  "code": "VALIDATION_ERROR",
  "message": "input: Required",
  "data": {
    "issues": []
  },
  "stderr": "",
  "exitCode": 1,
  "durationMs": 12,
  "traceId": "trc_abc123def456",
  "apiVersion": "1.0.0"
}
```

### workspace.task.cleanup

preview or remove stale task worktrees and branches

| Field | Value |
| --- | --- |
| Category | task lifecycle |
| Signature | `workspace.task.cleanup({ branch?: string; force?: boolean; preview?: boolean; merged?: boolean; staleDays?: number; keep?: string; dryRun?: boolean; requestId?: string; taskSession?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } &#124; null>>` |
| Runtime | `workspace task.cleanup` |
| Capability | writes state · mutating · single-shot |
| Default timeout | 120000ms |

#### Example call

```ts
await workspace.call({
  "tool": "task.cleanup",
  "input": {
    "branch": "task/workspace-agents/example",
    "preview": true,
    "dryRun": true
  }
});
```

#### Success envelope

```json
{
  "ok": true,
  "code": "OK",
  "message": "command completed",
  "data": {
    "raw": "example"
  },
  "stderr": "",
  "exitCode": 0,
  "durationMs": 12,
  "traceId": "trc_abc123def456",
  "apiVersion": "1.0.0"
}
```

#### Error envelope

```json
{
  "ok": false,
  "code": "VALIDATION_ERROR",
  "message": "input: Required",
  "data": {
    "issues": []
  },
  "stderr": "",
  "exitCode": 1,
  "durationMs": 12,
  "traceId": "trc_abc123def456",
  "apiVersion": "1.0.0"
}
```

### workspace.task.current

resolve the current task branch without running a mutating command

| Field | Value |
| --- | --- |
| Category | task lifecycle |
| Signature | `workspace.task.current({ requestId?: string; taskSession?: string; dryRun?: boolean }) => Promise<ToolResult<{ branch: string; area: string; prNumber?: number; worktree: string } &#124; null>>` |
| Runtime | `branch resolver` |
| Capability | read-only · non-mutating · safe to retry |
| Default timeout | 30000ms |

#### Example call

```ts
await workspace.call({
  "tool": "task.current",
  "input": {}
});
```

#### Success envelope

```json
{
  "ok": true,
  "code": "OK",
  "message": "command completed",
  "data": {
    "raw": "example"
  },
  "stderr": "",
  "exitCode": 0,
  "durationMs": 12,
  "traceId": "trc_abc123def456",
  "apiVersion": "1.0.0"
}
```

#### Error envelope

```json
{
  "ok": false,
  "code": "VALIDATION_ERROR",
  "message": "input: Required",
  "data": {
    "issues": []
  },
  "stderr": "",
  "exitCode": 1,
  "durationMs": 12,
  "traceId": "trc_abc123def456",
  "apiVersion": "1.0.0"
}
```

### workspace.task.ensureSynced

check whether the task stream appears synced

| Field | Value |
| --- | --- |
| Category | task lifecycle |
| Signature | `workspace.task.ensureSynced({ branch?: string; requestId?: string; taskSession?: string; dryRun?: boolean }) => Promise<ToolResult<{ synced: boolean; branch: string; area: string; behind?: number; action?: string }>>` |
| Runtime | `workspace task.ensureSynced` |
| Capability | read-only · non-mutating · safe to retry |
| Default timeout | 60000ms |

#### Example call

```ts
await workspace.call({
  "tool": "task.ensureSynced",
  "input": {
    "branch": "task/workspace-agents/example"
  }
});
```

#### Success envelope

```json
{
  "ok": true,
  "code": "OK",
  "message": "command completed",
  "data": {
    "raw": "example"
  },
  "stderr": "",
  "exitCode": 0,
  "durationMs": 12,
  "traceId": "trc_abc123def456",
  "apiVersion": "1.0.0"
}
```

#### Error envelope

```json
{
  "ok": false,
  "code": "VALIDATION_ERROR",
  "message": "input: Required",
  "data": {
    "issues": []
  },
  "stderr": "",
  "exitCode": 1,
  "durationMs": 12,
  "traceId": "trc_abc123def456",
  "apiVersion": "1.0.0"
}
```

### workspace.task.exec

legacy alias for task.call; run a command inside a task worktree

| Field | Value |
| --- | --- |
| Category | task lifecycle |
| Signature | `workspace.task.exec({ branch?: string; command: string[]; tddPhase?: "red" &#124; "green" &#124; "post"; timeout?: number; dryRun?: boolean; requestId?: string; taskSession?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } &#124; null>>` |
| Runtime | `workspace task.exec` |
| Capability | writes state · mutating · single-shot |
| Default timeout | 300000ms |

#### Example call

```ts
await workspace.call({
  "tool": "task.exec",
  "input": {
    "branch": "task/workspace-agents/example",
    "command": [
      "git",
      "status",
      "--short"
    ],
    "dryRun": true
  }
});
```

#### Success envelope

```json
{
  "ok": true,
  "code": "OK",
  "message": "command completed",
  "data": {
    "raw": "example"
  },
  "stderr": "",
  "exitCode": 0,
  "durationMs": 12,
  "traceId": "trc_abc123def456",
  "apiVersion": "1.0.0"
}
```

#### Error envelope

```json
{
  "ok": false,
  "code": "VALIDATION_ERROR",
  "message": "input: Required",
  "data": {
    "issues": []
  },
  "stderr": "",
  "exitCode": 1,
  "durationMs": 12,
  "traceId": "trc_abc123def456",
  "apiVersion": "1.0.0"
}
```

### workspace.task.finish

finish a task branch after merge

| Field | Value |
| --- | --- |
| Category | task lifecycle |
| Signature | `workspace.task.finish({ branch?: string; requestId?: string; taskSession?: string; dryRun?: boolean }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } &#124; null>>` |
| Runtime | `workspace task.finish` |
| Capability | writes state · mutating · single-shot |
| Default timeout | 120000ms |

#### Example call

```ts
await workspace.call({
  "tool": "task.finish",
  "input": {
    "branch": "task/workspace-agents/example",
    "dryRun": true
  }
});
```

#### Success envelope

```json
{
  "ok": true,
  "code": "OK",
  "message": "command completed",
  "data": {
    "raw": "example"
  },
  "stderr": "",
  "exitCode": 0,
  "durationMs": 12,
  "traceId": "trc_abc123def456",
  "apiVersion": "1.0.0"
}
```

#### Error envelope

```json
{
  "ok": false,
  "code": "VALIDATION_ERROR",
  "message": "input: Required",
  "data": {
    "issues": []
  },
  "stderr": "",
  "exitCode": 1,
  "durationMs": 12,
  "traceId": "trc_abc123def456",
  "apiVersion": "1.0.0"
}
```

### workspace.task.init

write task metadata for an existing worktree

| Field | Value |
| --- | --- |
| Category | task lifecycle |
| Signature | `workspace.task.init({ area: string; branch: string; pr?: number; worktree?: string; dryRun?: boolean; requestId?: string; taskSession?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } &#124; null>>` |
| Runtime | `workspace task.init` |
| Capability | writes state · mutating · single-shot |
| Default timeout | 60000ms |

#### Example call

```ts
await workspace.call({
  "tool": "task.init",
  "input": {
    "area": "workspace-agents",
    "branch": "task/workspace-agents/example",
    "dryRun": true
  }
});
```

#### Success envelope

```json
{
  "ok": true,
  "code": "OK",
  "message": "command completed",
  "data": {
    "raw": "example"
  },
  "stderr": "",
  "exitCode": 0,
  "durationMs": 12,
  "traceId": "trc_abc123def456",
  "apiVersion": "1.0.0"
}
```

#### Error envelope

```json
{
  "ok": false,
  "code": "VALIDATION_ERROR",
  "message": "input: Required",
  "data": {
    "issues": []
  },
  "stderr": "",
  "exitCode": 1,
  "durationMs": 12,
  "traceId": "trc_abc123def456",
  "apiVersion": "1.0.0"
}
```

### workspace.task.merge

merge a pull request through the workspace task merge script

| Field | Value |
| --- | --- |
| Category | task lifecycle |
| Signature | `workspace.task.merge({ pr?: number; wait?: boolean; squash?: boolean; dryRun?: boolean; requestId?: string; taskSession?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } &#124; null>>` |
| Runtime | `workspace task.merge` |
| Capability | writes state · mutating · single-shot |
| Default timeout | 120000ms |

#### Example call

```ts
await workspace.call({
  "tool": "task.merge",
  "input": {
    "pr": 225,
    "dryRun": true
  }
});
```

#### Success envelope

```json
{
  "ok": true,
  "code": "OK",
  "message": "command completed",
  "data": {
    "raw": "example"
  },
  "stderr": "",
  "exitCode": 0,
  "durationMs": 12,
  "traceId": "trc_abc123def456",
  "apiVersion": "1.0.0"
}
```

#### Error envelope

```json
{
  "ok": false,
  "code": "VALIDATION_ERROR",
  "message": "input: Required",
  "data": {
    "issues": []
  },
  "stderr": "",
  "exitCode": 1,
  "durationMs": 12,
  "traceId": "trc_abc123def456",
  "apiVersion": "1.0.0"
}
```

### workspace.task.pr

merge task to stream and create or refresh the stream review PR

| Field | Value |
| --- | --- |
| Category | task lifecycle |
| Signature | `workspace.task.pr({ branch?: string; taskOnly?: boolean; draft?: boolean; ready?: boolean; bodyTemplate?: string; dryRun?: boolean; requestId?: string; taskSession?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } &#124; null>>` |
| Runtime | `workspace task.pr` |
| Capability | writes state · mutating · single-shot |
| Default timeout | 120000ms |

#### Example call

```ts
await workspace.call({
  "tool": "task.pr",
  "input": {
    "branch": "task/workspace-agents/example",
    "taskOnly": true,
    "dryRun": true
  }
});
```

#### Success envelope

```json
{
  "ok": true,
  "code": "OK",
  "message": "command completed",
  "data": {
    "raw": "example"
  },
  "stderr": "",
  "exitCode": 0,
  "durationMs": 12,
  "traceId": "trc_abc123def456",
  "apiVersion": "1.0.0"
}
```

#### Error envelope

```json
{
  "ok": false,
  "code": "VALIDATION_ERROR",
  "message": "input: Required",
  "data": {
    "issues": []
  },
  "stderr": "",
  "exitCode": 1,
  "durationMs": 12,
  "traceId": "trc_abc123def456",
  "apiVersion": "1.0.0"
}
```

### workspace.task.prs

show task and review PR links

| Field | Value |
| --- | --- |
| Category | task lifecycle |
| Signature | `workspace.task.prs({ branch?: string; requestId?: string; taskSession?: string; dryRun?: boolean }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } &#124; null>>` |
| Runtime | `workspace task.prs` |
| Capability | read-only · non-mutating · safe to retry |
| Default timeout | 120000ms |

#### Example call

```ts
await workspace.call({
  "tool": "task.prs",
  "input": {
    "branch": "task/workspace-agents/example"
  }
});
```

#### Success envelope

```json
{
  "ok": true,
  "code": "OK",
  "message": "command completed",
  "data": {
    "raw": "example"
  },
  "stderr": "",
  "exitCode": 0,
  "durationMs": 12,
  "traceId": "trc_abc123def456",
  "apiVersion": "1.0.0"
}
```

#### Error envelope

```json
{
  "ok": false,
  "code": "VALIDATION_ERROR",
  "message": "input: Required",
  "data": {
    "issues": []
  },
  "stderr": "",
  "exitCode": 1,
  "durationMs": 12,
  "traceId": "trc_abc123def456",
  "apiVersion": "1.0.0"
}
```

### workspace.task.push

push changed task files to the task branch through GitHub API

| Field | Value |
| --- | --- |
| Category | task lifecycle |
| Signature | `workspace.task.push({ branch?: string; message: string; changed?: boolean; files?: string[]; approved?: boolean; reason?: string; dryRun?: boolean; requestId?: string; taskSession?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } &#124; null>>` |
| Runtime | `workspace task.push` |
| Capability | writes state · mutating · single-shot |
| Default timeout | 120000ms |

#### Example call

```ts
await workspace.call({
  "tool": "task.push",
  "input": {
    "branch": "task/workspace-agents/example",
    "message": "feat(workspace): example",
    "changed": true,
    "dryRun": true
  }
});
```

#### Success envelope

```json
{
  "ok": true,
  "code": "OK",
  "message": "command completed",
  "data": {
    "raw": "example"
  },
  "stderr": "",
  "exitCode": 0,
  "durationMs": 12,
  "traceId": "trc_abc123def456",
  "apiVersion": "1.0.0"
}
```

#### Error envelope

```json
{
  "ok": false,
  "code": "VALIDATION_ERROR",
  "message": "input: Required",
  "data": {
    "issues": []
  },
  "stderr": "",
  "exitCode": 1,
  "durationMs": 12,
  "traceId": "trc_abc123def456",
  "apiVersion": "1.0.0"
}
```

### workspace.task.start

create a task branch, worktree, and draft PR

| Field | Value |
| --- | --- |
| Category | task lifecycle |
| Signature | `workspace.task.start({ stream?: string; area?: string; title: string; description?: string; bodyFile?: string; startFrom?: "main" &#124; "stream"; dryRun?: boolean; requestId?: string; taskSession?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } &#124; null>>` |
| Runtime | `workspace task.start` |
| Capability | writes state · mutating · single-shot |
| Default timeout | 60000ms |

#### Example call

```ts
await workspace.call({
  "tool": "task.start",
  "input": {
    "stream": "stream/workspace-agents",
    "title": "example task",
    "dryRun": true
  }
});
```

#### Success envelope

```json
{
  "ok": true,
  "code": "OK",
  "message": "command completed",
  "data": {
    "raw": "example"
  },
  "stderr": "",
  "exitCode": 0,
  "durationMs": 12,
  "traceId": "trc_abc123def456",
  "apiVersion": "1.0.0"
}
```

#### Error envelope

```json
{
  "ok": false,
  "code": "VALIDATION_ERROR",
  "message": "input: Required",
  "data": {
    "issues": []
  },
  "stderr": "",
  "exitCode": 1,
  "durationMs": 12,
  "traceId": "trc_abc123def456",
  "apiVersion": "1.0.0"
}
```

### workspace.taskMeta.smoke

run the task metadata smoke suite

| Field | Value |
| --- | --- |
| Category | task lifecycle |
| Signature | `workspace.taskMeta.smoke({ requestId?: string; taskSession?: string; dryRun?: boolean }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } &#124; null>>` |
| Runtime | `workspace taskMeta.smoke` |
| Capability | read-only · non-mutating · safe to retry |
| Default timeout | 120000ms |

#### Example call

```ts
await workspace.call({
  "tool": "taskMeta.smoke",
  "input": {}
});
```

#### Success envelope

```json
{
  "ok": true,
  "code": "OK",
  "message": "command completed",
  "data": {
    "raw": "example"
  },
  "stderr": "",
  "exitCode": 0,
  "durationMs": 12,
  "traceId": "trc_abc123def456",
  "apiVersion": "1.0.0"
}
```

#### Error envelope

```json
{
  "ok": false,
  "code": "VALIDATION_ERROR",
  "message": "input: Required",
  "data": {
    "issues": []
  },
  "stderr": "",
  "exitCode": 1,
  "durationMs": 12,
  "traceId": "trc_abc123def456",
  "apiVersion": "1.0.0"
}
```

## tooling

### workspace.tools.search

search workspace tools by intent and return ranked usage guidance

| Field | Value |
| --- | --- |
| Category | tooling |
| Signature | `workspace.tools.search({ query: string; limit?: number; category?: string; readOnly?: boolean; mutating?: boolean; noDocs?: boolean; requestId?: string; taskSession?: string }) => Promise<ToolResult<{ query: string; limit: number; searchedCount: number; returnedCount: number; filters: Record<string, unknown>; totalMatches: number; confidence: "high" &#124; "medium" &#124; "low"; ambiguous: boolean; detectedIntent?: string; recommended?: string; matches: Array<{ name: string; methodPath?: string[]; category?: string; score: number; scoreParts?: Record<string, number>; description?: string; capabilities: Record<string, unknown>; sessionRequired: boolean; inputSchema?: string; outputSchema?: string; inputSignature?: string; outputSignature?: string; exampleInput?: Record<string, unknown>; usage: { workspaceCall: string; script?: string; subcommand?: string; arguments: Array<Record<string, unknown>> }; docs?: { heading: string; snippet: string; source: string }; why: string[] }>; alternatives?: Array<{ intent: string; tools: string[] }>; guidance: string &#124; Record<string, unknown>; catalog: { source: string[]; catalogHash: string; toolCount: number; searchedCount: number; cardVersion: string; embeddingConfigId: string; cardsEmbedded: number; cardsReused: number; embeddingError?: string } }>>` |
| Runtime | `workspace tools.search` |
| Capability | read-only · non-mutating · safe to retry |
| Default timeout | 30000ms |

#### Example call

```ts
await workspace.call({
  "tool": "tools.search",
  "input": {
    "query": "linear issue",
    "limit": 5
  }
});
```

#### Success envelope

```json
{
  "ok": true,
  "code": "OK",
  "message": "command completed",
  "data": {
    "query": "linear issue",
    "limit": 5,
    "searchedCount": 128,
    "returnedCount": 1,
    "filters": {},
    "totalMatches": 1,
    "confidence": "high",
    "ambiguous": false,
    "detectedIntent": "read or search Linear issues",
    "recommended": "linear.issue",
    "matches": [
      {
        "name": "linear.issue",
        "methodPath": [
          "linear",
          "issue"
        ],
        "category": "linear",
        "score": 142,
        "scoreParts": {
          "exact": 0,
          "name": 22,
          "lexical": 31,
          "bm25": 34,
          "intent": 55,
          "capability": 0,
          "embedding": 0
        },
        "description": "Read one Linear issue by identifier.",
        "capabilities": {
          "readOnly": true,
          "mutating": false,
          "safeToRetry": true
        },
        "sessionRequired": false,
        "inputSchema": "LinearIssueInput",
        "outputSchema": "RawOutput",
        "inputSignature": "{ identifier: string; requestId?: string; taskSession?: string }",
        "usage": {
          "workspaceCall": "await workspace.call({ tool: \"linear.issue\", input: { \"identifier\": \"DEV-123\" } })",
          "script": "linear",
          "subcommand": "issue",
          "arguments": []
        },
        "why": [
          "intent: read or search Linear issues"
        ]
      }
    ],
    "guidance": {
      "summary": "Use the recommended tool when its intent matches the user request. Inspect alternatives when ambiguous.",
      "recommendedUse": "Read-only recommendation is safe for investigation.",
      "ambiguous": false,
      "safeDefaults": [],
      "mutatingGuidance": []
    },
    "catalog": {
      "source": [
        "tool-manifest.json",
        "TOOLS.md"
      ],
      "catalogHash": "abc123",
      "toolCount": 128,
      "searchedCount": 128,
      "cardVersion": "tools-search-card-v2",
      "embeddingConfigId": "disabled",
      "cardsEmbedded": 0,
      "cardsReused": 0
    }
  },
  "stderr": "",
  "exitCode": 0,
  "durationMs": 12,
  "traceId": "trc_abc123def456",
  "apiVersion": "1.0.0"
}
```

#### Error envelope

```json
{
  "ok": false,
  "code": "VALIDATION_ERROR",
  "message": "input: Required",
  "data": {
    "issues": []
  },
  "stderr": "",
  "exitCode": 1,
  "durationMs": 12,
  "traceId": "trc_abc123def456",
  "apiVersion": "1.0.0"
}
```

## utilities

### workspace.browser

run the generic workspace browser wrapper command

| Field | Value |
| --- | --- |
| Category | utilities |
| Signature | `workspace.browser({ command?: string; url?: string; args?: string[]; dryRun?: boolean; requestId?: string; taskSession?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } &#124; null>>` |
| Runtime | `workspace browser` |
| Capability | writes state · mutating · single-shot |
| Default timeout | 300000ms |

#### Example call

```ts
await workspace.call({
  "tool": "browser",
  "input": {
    "command": "open",
    "url": "https://example.com",
    "dryRun": true
  }
});
```

#### Success envelope

```json
{
  "ok": true,
  "code": "OK",
  "message": "command completed",
  "data": {
    "raw": "example"
  },
  "stderr": "",
  "exitCode": 0,
  "durationMs": 12,
  "traceId": "trc_abc123def456",
  "apiVersion": "1.0.0"
}
```

#### Error envelope

```json
{
  "ok": false,
  "code": "VALIDATION_ERROR",
  "message": "input: Required",
  "data": {
    "issues": []
  },
  "stderr": "",
  "exitCode": 1,
  "durationMs": 12,
  "traceId": "trc_abc123def456",
  "apiVersion": "1.0.0"
}
```

### workspace.browser.app

open app.consuelohq.com with the browser wrapper

| Field | Value |
| --- | --- |
| Category | utilities |
| Signature | `workspace.browser.app({ headed?: boolean; full?: boolean; preset?: "desktop" &#124; "mobile" &#124; "tablet" &#124; "ipad" &#124; "iphone"; device?: string; provider?: string; width?: number; height?: number; colorScheme?: "dark" &#124; "light" &#124; "no-preference"; dryRun?: boolean; requestId?: string; taskSession?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } &#124; null>>` |
| Runtime | `workspace browser.app` |
| Capability | writes state · mutating · single-shot |
| Default timeout | 300000ms |

#### Example call

```ts
await workspace.call({
  "tool": "browser.app",
  "input": {
    "preset": "desktop",
    "dryRun": true
  }
});
```

#### Success envelope

```json
{
  "ok": true,
  "code": "OK",
  "message": "command completed",
  "data": {
    "raw": "example"
  },
  "stderr": "",
  "exitCode": 0,
  "durationMs": 12,
  "traceId": "trc_abc123def456",
  "apiVersion": "1.0.0"
}
```

#### Error envelope

```json
{
  "ok": false,
  "code": "VALIDATION_ERROR",
  "message": "input: Required",
  "data": {
    "issues": []
  },
  "stderr": "",
  "exitCode": 1,
  "durationMs": 12,
  "traceId": "trc_abc123def456",
  "apiVersion": "1.0.0"
}
```

### workspace.browser.click

click a browser element by ref

| Field | Value |
| --- | --- |
| Category | utilities |
| Signature | `workspace.browser.click({ ref: string; dryRun?: boolean; requestId?: string; taskSession?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } &#124; null>>` |
| Runtime | `workspace browser.click` |
| Capability | writes state · mutating · single-shot |
| Default timeout | 300000ms |

#### Example call

```ts
await workspace.call({
  "tool": "browser.click",
  "input": {
    "ref": "@e1",
    "dryRun": true
  }
});
```

#### Success envelope

```json
{
  "ok": true,
  "code": "OK",
  "message": "command completed",
  "data": {
    "raw": "example"
  },
  "stderr": "",
  "exitCode": 0,
  "durationMs": 12,
  "traceId": "trc_abc123def456",
  "apiVersion": "1.0.0"
}
```

#### Error envelope

```json
{
  "ok": false,
  "code": "VALIDATION_ERROR",
  "message": "input: Required",
  "data": {
    "issues": []
  },
  "stderr": "",
  "exitCode": 1,
  "durationMs": 12,
  "traceId": "trc_abc123def456",
  "apiVersion": "1.0.0"
}
```

### workspace.browser.clipboard

read from or write to the browser clipboard

| Field | Value |
| --- | --- |
| Category | utilities |
| Signature | `workspace.browser.clipboard({ action: "read" &#124; "write"; text?: string; dryRun?: boolean; requestId?: string; taskSession?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } &#124; null>>` |
| Runtime | `workspace browser.clipboard` |
| Capability | writes state · mutating · single-shot |
| Default timeout | 300000ms |

#### Example call

```ts
await workspace.call({
  "tool": "browser.clipboard",
  "input": {
    "action": "read",
    "dryRun": true
  }
});
```

#### Success envelope

```json
{
  "ok": true,
  "code": "OK",
  "message": "command completed",
  "data": {
    "raw": "example"
  },
  "stderr": "",
  "exitCode": 0,
  "durationMs": 12,
  "traceId": "trc_abc123def456",
  "apiVersion": "1.0.0"
}
```

#### Error envelope

```json
{
  "ok": false,
  "code": "VALIDATION_ERROR",
  "message": "input: Required",
  "data": {
    "issues": []
  },
  "stderr": "",
  "exitCode": 1,
  "durationMs": 12,
  "traceId": "trc_abc123def456",
  "apiVersion": "1.0.0"
}
```

### workspace.browser.close

close active browser sessions

| Field | Value |
| --- | --- |
| Category | utilities |
| Signature | `workspace.browser.close({ requestId?: string; taskSession?: string; dryRun?: boolean }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } &#124; null>>` |
| Runtime | `workspace browser.close` |
| Capability | writes state · mutating · single-shot |
| Default timeout | 300000ms |

#### Example call

```ts
await workspace.call({
  "tool": "browser.close",
  "input": {
    "dryRun": true
  }
});
```

#### Success envelope

```json
{
  "ok": true,
  "code": "OK",
  "message": "command completed",
  "data": {
    "raw": "example"
  },
  "stderr": "",
  "exitCode": 0,
  "durationMs": 12,
  "traceId": "trc_abc123def456",
  "apiVersion": "1.0.0"
}
```

#### Error envelope

```json
{
  "ok": false,
  "code": "VALIDATION_ERROR",
  "message": "input: Required",
  "data": {
    "issues": []
  },
  "stderr": "",
  "exitCode": 1,
  "durationMs": 12,
  "traceId": "trc_abc123def456",
  "apiVersion": "1.0.0"
}
```

### workspace.browser.consuelo

open consuelo.consuelohq.com with the browser wrapper

| Field | Value |
| --- | --- |
| Category | utilities |
| Signature | `workspace.browser.consuelo({ headed?: boolean; full?: boolean; preset?: "desktop" &#124; "mobile" &#124; "tablet" &#124; "ipad" &#124; "iphone"; device?: string; provider?: string; width?: number; height?: number; colorScheme?: "dark" &#124; "light" &#124; "no-preference"; dryRun?: boolean; requestId?: string; taskSession?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } &#124; null>>` |
| Runtime | `workspace browser.consuelo` |
| Capability | writes state · mutating · single-shot |
| Default timeout | 300000ms |

#### Example call

```ts
await workspace.call({
  "tool": "browser.consuelo",
  "input": {
    "preset": "desktop",
    "dryRun": true
  }
});
```

#### Success envelope

```json
{
  "ok": true,
  "code": "OK",
  "message": "command completed",
  "data": {
    "raw": "example"
  },
  "stderr": "",
  "exitCode": 0,
  "durationMs": 12,
  "traceId": "trc_abc123def456",
  "apiVersion": "1.0.0"
}
```

#### Error envelope

```json
{
  "ok": false,
  "code": "VALIDATION_ERROR",
  "message": "input: Required",
  "data": {
    "issues": []
  },
  "stderr": "",
  "exitCode": 1,
  "durationMs": 12,
  "traceId": "trc_abc123def456",
  "apiVersion": "1.0.0"
}
```

### workspace.browser.cookies

list, set, or clear browser cookies for the current browser session

| Field | Value |
| --- | --- |
| Category | utilities |
| Signature | `workspace.browser.cookies({ action?: "list" &#124; "set" &#124; "clear"; name?: string; value?: string; dryRun?: boolean; requestId?: string; taskSession?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } &#124; null>>` |
| Runtime | `workspace browser.cookies` |
| Capability | writes state · mutating · single-shot |
| Default timeout | 300000ms |

#### Example call

```ts
await workspace.call({
  "tool": "browser.cookies",
  "input": {
    "action": "list",
    "dryRun": true
  }
});
```

#### Success envelope

```json
{
  "ok": true,
  "code": "OK",
  "message": "command completed",
  "data": {
    "raw": "example"
  },
  "stderr": "",
  "exitCode": 0,
  "durationMs": 12,
  "traceId": "trc_abc123def456",
  "apiVersion": "1.0.0"
}
```

#### Error envelope

```json
{
  "ok": false,
  "code": "VALIDATION_ERROR",
  "message": "input: Required",
  "data": {
    "issues": []
  },
  "stderr": "",
  "exitCode": 1,
  "durationMs": 12,
  "traceId": "trc_abc123def456",
  "apiVersion": "1.0.0"
}
```

### workspace.browser.dialog

accept or dismiss browser dialogs

| Field | Value |
| --- | --- |
| Category | utilities |
| Signature | `workspace.browser.dialog({ action: "accept" &#124; "dismiss"; text?: string; dryRun?: boolean; requestId?: string; taskSession?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } &#124; null>>` |
| Runtime | `workspace browser.dialog` |
| Capability | writes state · mutating · single-shot |
| Default timeout | 300000ms |

#### Example call

```ts
await workspace.call({
  "tool": "browser.dialog",
  "input": {
    "action": "dismiss",
    "dryRun": true
  }
});
```

#### Success envelope

```json
{
  "ok": true,
  "code": "OK",
  "message": "command completed",
  "data": {
    "raw": "example"
  },
  "stderr": "",
  "exitCode": 0,
  "durationMs": 12,
  "traceId": "trc_abc123def456",
  "apiVersion": "1.0.0"
}
```

#### Error envelope

```json
{
  "ok": false,
  "code": "VALIDATION_ERROR",
  "message": "input: Required",
  "data": {
    "issues": []
  },
  "stderr": "",
  "exitCode": 1,
  "durationMs": 12,
  "traceId": "trc_abc123def456",
  "apiVersion": "1.0.0"
}
```

### workspace.browser.download

click an element and save the triggered download to a path

| Field | Value |
| --- | --- |
| Category | utilities |
| Signature | `workspace.browser.download({ ref: string; path: string; dryRun?: boolean; requestId?: string; taskSession?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } &#124; null>>` |
| Runtime | `workspace browser.download` |
| Capability | writes state · mutating · single-shot |
| Default timeout | 300000ms |

#### Example call

```ts
await workspace.call({
  "tool": "browser.download",
  "input": {
    "ref": "@e1",
    "path": "/tmp/download.bin",
    "dryRun": true
  }
});
```

#### Success envelope

```json
{
  "ok": true,
  "code": "OK",
  "message": "command completed",
  "data": {
    "raw": "example"
  },
  "stderr": "",
  "exitCode": 0,
  "durationMs": 12,
  "traceId": "trc_abc123def456",
  "apiVersion": "1.0.0"
}
```

#### Error envelope

```json
{
  "ok": false,
  "code": "VALIDATION_ERROR",
  "message": "input: Required",
  "data": {
    "issues": []
  },
  "stderr": "",
  "exitCode": 1,
  "durationMs": 12,
  "traceId": "trc_abc123def456",
  "apiVersion": "1.0.0"
}
```

### workspace.browser.eval

execute JavaScript on the current browser page

| Field | Value |
| --- | --- |
| Category | utilities |
| Signature | `workspace.browser.eval({ js: string; dryRun?: boolean; requestId?: string; taskSession?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } &#124; null>>` |
| Runtime | `workspace browser.eval` |
| Capability | writes state · mutating · single-shot |
| Default timeout | 300000ms |

#### Example call

```ts
await workspace.call({
  "tool": "browser.eval",
  "input": {
    "js": "document.title",
    "dryRun": true
  }
});
```

#### Success envelope

```json
{
  "ok": true,
  "code": "OK",
  "message": "command completed",
  "data": {
    "raw": "example"
  },
  "stderr": "",
  "exitCode": 0,
  "durationMs": 12,
  "traceId": "trc_abc123def456",
  "apiVersion": "1.0.0"
}
```

#### Error envelope

```json
{
  "ok": false,
  "code": "VALIDATION_ERROR",
  "message": "input: Required",
  "data": {
    "issues": []
  },
  "stderr": "",
  "exitCode": 1,
  "durationMs": 12,
  "traceId": "trc_abc123def456",
  "apiVersion": "1.0.0"
}
```

### workspace.browser.fill

fill a browser input by ref

| Field | Value |
| --- | --- |
| Category | utilities |
| Signature | `workspace.browser.fill({ ref: string; text: string; dryRun?: boolean; requestId?: string; taskSession?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } &#124; null>>` |
| Runtime | `workspace browser.fill` |
| Capability | writes state · mutating · single-shot |
| Default timeout | 300000ms |

#### Example call

```ts
await workspace.call({
  "tool": "browser.fill",
  "input": {
    "ref": "@e1",
    "text": "hello",
    "dryRun": true
  }
});
```

#### Success envelope

```json
{
  "ok": true,
  "code": "OK",
  "message": "command completed",
  "data": {
    "raw": "example"
  },
  "stderr": "",
  "exitCode": 0,
  "durationMs": 12,
  "traceId": "trc_abc123def456",
  "apiVersion": "1.0.0"
}
```

#### Error envelope

```json
{
  "ok": false,
  "code": "VALIDATION_ERROR",
  "message": "input: Required",
  "data": {
    "issues": []
  },
  "stderr": "",
  "exitCode": 1,
  "durationMs": 12,
  "traceId": "trc_abc123def456",
  "apiVersion": "1.0.0"
}
```

### workspace.browser.find

find an element by role, text, label, placeholder, alt text, title, or test id and run an action

| Field | Value |
| --- | --- |
| Category | utilities |
| Signature | `workspace.browser.find({ by: "role" &#124; "text" &#124; "label" &#124; "placeholder" &#124; "alt" &#124; "title" &#124; "testid"; value: string; action: "click" &#124; "fill" &#124; "type" &#124; "hover" &#124; "focus" &#124; "check" &#124; "text"; text?: string; name?: string; dryRun?: boolean; requestId?: string; taskSession?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } &#124; null>>` |
| Runtime | `workspace browser.find` |
| Capability | writes state · mutating · single-shot |
| Default timeout | 300000ms |

#### Example call

```ts
await workspace.call({
  "tool": "browser.find",
  "input": {
    "by": "role",
    "value": "button",
    "action": "click",
    "name": "Submit",
    "dryRun": true
  }
});
```

#### Success envelope

```json
{
  "ok": true,
  "code": "OK",
  "message": "command completed",
  "data": {
    "raw": "example"
  },
  "stderr": "",
  "exitCode": 0,
  "durationMs": 12,
  "traceId": "trc_abc123def456",
  "apiVersion": "1.0.0"
}
```

#### Error envelope

```json
{
  "ok": false,
  "code": "VALIDATION_ERROR",
  "message": "input: Required",
  "data": {
    "issues": []
  },
  "stderr": "",
  "exitCode": 1,
  "durationMs": 12,
  "traceId": "trc_abc123def456",
  "apiVersion": "1.0.0"
}
```

### workspace.browser.get

get text, html, value, attributes, title, or URL from the current page

| Field | Value |
| --- | --- |
| Category | utilities |
| Signature | `workspace.browser.get({ target: "text" &#124; "html" &#124; "value" &#124; "attribute" &#124; "title" &#124; "url"; selector?: string; attribute?: string; dryRun?: boolean; requestId?: string; taskSession?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } &#124; null>>` |
| Runtime | `workspace browser.get` |
| Capability | writes state · mutating · single-shot |
| Default timeout | 300000ms |

#### Example call

```ts
await workspace.call({
  "tool": "browser.get",
  "input": {
    "target": "title",
    "dryRun": true
  }
});
```

#### Success envelope

```json
{
  "ok": true,
  "code": "OK",
  "message": "command completed",
  "data": {
    "raw": "example"
  },
  "stderr": "",
  "exitCode": 0,
  "durationMs": 12,
  "traceId": "trc_abc123def456",
  "apiVersion": "1.0.0"
}
```

#### Error envelope

```json
{
  "ok": false,
  "code": "VALIDATION_ERROR",
  "message": "input: Required",
  "data": {
    "issues": []
  },
  "stderr": "",
  "exitCode": 1,
  "durationMs": 12,
  "traceId": "trc_abc123def456",
  "apiVersion": "1.0.0"
}
```

### workspace.browser.login

run a saved browser auth login profile

| Field | Value |
| --- | --- |
| Category | utilities |
| Signature | `workspace.browser.login({ name: string; headed?: boolean; dryRun?: boolean; requestId?: string; taskSession?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } &#124; null>>` |
| Runtime | `workspace browser.login` |
| Capability | writes state · mutating · single-shot |
| Default timeout | 300000ms |

#### Example call

```ts
await workspace.call({
  "tool": "browser.login",
  "input": {
    "name": "consuelo",
    "headed": true,
    "dryRun": true
  }
});
```

#### Success envelope

```json
{
  "ok": true,
  "code": "OK",
  "message": "command completed",
  "data": {
    "raw": "example"
  },
  "stderr": "",
  "exitCode": 0,
  "durationMs": 12,
  "traceId": "trc_abc123def456",
  "apiVersion": "1.0.0"
}
```

#### Error envelope

```json
{
  "ok": false,
  "code": "VALIDATION_ERROR",
  "message": "input: Required",
  "data": {
    "issues": []
  },
  "stderr": "",
  "exitCode": 1,
  "durationMs": 12,
  "traceId": "trc_abc123def456",
  "apiVersion": "1.0.0"
}
```

### workspace.browser.network

inspect or manage browser network requests, routes, and HAR capture

| Field | Value |
| --- | --- |
| Category | utilities |
| Signature | `workspace.browser.network({ args: string[]; dryRun?: boolean; requestId?: string; taskSession?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } &#124; null>>` |
| Runtime | `workspace browser.network` |
| Capability | writes state · mutating · single-shot |
| Default timeout | 300000ms |

#### Example call

```ts
await workspace.call({
  "tool": "browser.network",
  "input": {
    "args": [
      "requests"
    ],
    "dryRun": true
  }
});
```

#### Success envelope

```json
{
  "ok": true,
  "code": "OK",
  "message": "command completed",
  "data": {
    "raw": "example"
  },
  "stderr": "",
  "exitCode": 0,
  "durationMs": 12,
  "traceId": "trc_abc123def456",
  "apiVersion": "1.0.0"
}
```

#### Error envelope

```json
{
  "ok": false,
  "code": "VALIDATION_ERROR",
  "message": "input: Required",
  "data": {
    "issues": []
  },
  "stderr": "",
  "exitCode": 1,
  "durationMs": 12,
  "traceId": "trc_abc123def456",
  "apiVersion": "1.0.0"
}
```

### workspace.browser.open

open a URL with the browser wrapper

| Field | Value |
| --- | --- |
| Category | utilities |
| Signature | `workspace.browser.open({ url: string; headed?: boolean; full?: boolean; preset?: "desktop" &#124; "mobile" &#124; "tablet" &#124; "ipad" &#124; "iphone"; device?: string; provider?: string; width?: number; height?: number; colorScheme?: "dark" &#124; "light" &#124; "no-preference"; dryRun?: boolean; requestId?: string; taskSession?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } &#124; null>>` |
| Runtime | `workspace browser.open` |
| Capability | writes state · mutating · single-shot |
| Default timeout | 300000ms |

#### Example call

```ts
await workspace.call({
  "tool": "browser.open",
  "input": {
    "url": "https://example.com",
    "preset": "mobile",
    "full": true,
    "dryRun": true
  }
});
```

#### Success envelope

```json
{
  "ok": true,
  "code": "OK",
  "message": "command completed",
  "data": {
    "raw": "example"
  },
  "stderr": "",
  "exitCode": 0,
  "durationMs": 12,
  "traceId": "trc_abc123def456",
  "apiVersion": "1.0.0"
}
```

#### Error envelope

```json
{
  "ok": false,
  "code": "VALIDATION_ERROR",
  "message": "input: Required",
  "data": {
    "issues": []
  },
  "stderr": "",
  "exitCode": 1,
  "durationMs": 12,
  "traceId": "trc_abc123def456",
  "apiVersion": "1.0.0"
}
```

### workspace.browser.raw

pass raw arguments through to agent-browser

| Field | Value |
| --- | --- |
| Category | utilities |
| Signature | `workspace.browser.raw({ args: string[]; dryRun?: boolean; requestId?: string; taskSession?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } &#124; null>>` |
| Runtime | `workspace browser.raw` |
| Capability | writes state · mutating · single-shot |
| Default timeout | 300000ms |

#### Example call

```ts
await workspace.call({
  "tool": "browser.raw",
  "input": {
    "args": [
      "auth",
      "list"
    ],
    "dryRun": true
  }
});
```

#### Success envelope

```json
{
  "ok": true,
  "code": "OK",
  "message": "command completed",
  "data": {
    "raw": "example"
  },
  "stderr": "",
  "exitCode": 0,
  "durationMs": 12,
  "traceId": "trc_abc123def456",
  "apiVersion": "1.0.0"
}
```

#### Error envelope

```json
{
  "ok": false,
  "code": "VALIDATION_ERROR",
  "message": "input: Required",
  "data": {
    "issues": []
  },
  "stderr": "",
  "exitCode": 1,
  "durationMs": 12,
  "traceId": "trc_abc123def456",
  "apiVersion": "1.0.0"
}
```

### workspace.browser.reauth

restart the browser daemon and run a saved auth login profile

| Field | Value |
| --- | --- |
| Category | utilities |
| Signature | `workspace.browser.reauth({ name: string; headed?: boolean; dryRun?: boolean; requestId?: string; taskSession?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } &#124; null>>` |
| Runtime | `workspace browser.reauth` |
| Capability | writes state · mutating · single-shot |
| Default timeout | 300000ms |

#### Example call

```ts
await workspace.call({
  "tool": "browser.reauth",
  "input": {
    "name": "consuelo",
    "headed": true,
    "dryRun": true
  }
});
```

#### Success envelope

```json
{
  "ok": true,
  "code": "OK",
  "message": "command completed",
  "data": {
    "raw": "example"
  },
  "stderr": "",
  "exitCode": 0,
  "durationMs": 12,
  "traceId": "trc_abc123def456",
  "apiVersion": "1.0.0"
}
```

#### Error envelope

```json
{
  "ok": false,
  "code": "VALIDATION_ERROR",
  "message": "input: Required",
  "data": {
    "issues": []
  },
  "stderr": "",
  "exitCode": 1,
  "durationMs": 12,
  "traceId": "trc_abc123def456",
  "apiVersion": "1.0.0"
}
```

### workspace.browser.screenshot

capture a browser screenshot

| Field | Value |
| --- | --- |
| Category | utilities |
| Signature | `workspace.browser.screenshot({ name?: string; full?: boolean; preset?: "desktop" &#124; "mobile" &#124; "tablet" &#124; "ipad" &#124; "iphone"; device?: string; provider?: string; width?: number; height?: number; colorScheme?: "dark" &#124; "light" &#124; "no-preference"; dryRun?: boolean; requestId?: string; taskSession?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } &#124; null>>` |
| Runtime | `workspace browser.screenshot` |
| Capability | writes state · mutating · single-shot |
| Default timeout | 300000ms |

#### Example call

```ts
await workspace.call({
  "tool": "browser.screenshot",
  "input": {
    "name": "mobile-check",
    "preset": "mobile",
    "dryRun": true
  }
});
```

#### Success envelope

```json
{
  "ok": true,
  "code": "OK",
  "message": "command completed",
  "data": {
    "raw": "example"
  },
  "stderr": "",
  "exitCode": 0,
  "durationMs": 12,
  "traceId": "trc_abc123def456",
  "apiVersion": "1.0.0"
}
```

#### Error envelope

```json
{
  "ok": false,
  "code": "VALIDATION_ERROR",
  "message": "input: Required",
  "data": {
    "issues": []
  },
  "stderr": "",
  "exitCode": 1,
  "durationMs": 12,
  "traceId": "trc_abc123def456",
  "apiVersion": "1.0.0"
}
```

### workspace.browser.snap

capture an accessibility snapshot

| Field | Value |
| --- | --- |
| Category | utilities |
| Signature | `workspace.browser.snap({ requestId?: string; taskSession?: string; dryRun?: boolean }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } &#124; null>>` |
| Runtime | `workspace browser.snap` |
| Capability | writes state · mutating · single-shot |
| Default timeout | 300000ms |

#### Example call

```ts
await workspace.call({
  "tool": "browser.snap",
  "input": {
    "dryRun": true
  }
});
```

#### Success envelope

```json
{
  "ok": true,
  "code": "OK",
  "message": "command completed",
  "data": {
    "raw": "example"
  },
  "stderr": "",
  "exitCode": 0,
  "durationMs": 12,
  "traceId": "trc_abc123def456",
  "apiVersion": "1.0.0"
}
```

#### Error envelope

```json
{
  "ok": false,
  "code": "VALIDATION_ERROR",
  "message": "input: Required",
  "data": {
    "issues": []
  },
  "stderr": "",
  "exitCode": 1,
  "durationMs": 12,
  "traceId": "trc_abc123def456",
  "apiVersion": "1.0.0"
}
```

### workspace.browser.tabs

list, create, select, or close browser tabs with stable labels when needed

| Field | Value |
| --- | --- |
| Category | utilities |
| Signature | `workspace.browser.tabs({ action?: "list" &#124; "new" &#124; "select" &#124; "switch" &#124; "close"; target?: string; url?: string; label?: string; dryRun?: boolean; requestId?: string; taskSession?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } &#124; null>>` |
| Runtime | `workspace browser.tabs` |
| Capability | writes state · mutating · single-shot |
| Default timeout | 300000ms |

#### Example call

```ts
await workspace.call({
  "tool": "browser.tabs",
  "input": {
    "action": "list",
    "dryRun": true
  }
});
```

#### Success envelope

```json
{
  "ok": true,
  "code": "OK",
  "message": "command completed",
  "data": {
    "raw": "example"
  },
  "stderr": "",
  "exitCode": 0,
  "durationMs": 12,
  "traceId": "trc_abc123def456",
  "apiVersion": "1.0.0"
}
```

#### Error envelope

```json
{
  "ok": false,
  "code": "VALIDATION_ERROR",
  "message": "input: Required",
  "data": {
    "issues": []
  },
  "stderr": "",
  "exitCode": 1,
  "durationMs": 12,
  "traceId": "trc_abc123def456",
  "apiVersion": "1.0.0"
}
```

### workspace.browser.test

open a URL, wait for load, snapshot, and screenshot

| Field | Value |
| --- | --- |
| Category | utilities |
| Signature | `workspace.browser.test({ url: string; headed?: boolean; full?: boolean; preset?: "desktop" &#124; "mobile" &#124; "tablet" &#124; "ipad" &#124; "iphone"; device?: string; provider?: string; width?: number; height?: number; colorScheme?: "dark" &#124; "light" &#124; "no-preference"; dryRun?: boolean; requestId?: string; taskSession?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } &#124; null>>` |
| Runtime | `workspace browser.test` |
| Capability | writes state · mutating · single-shot |
| Default timeout | 300000ms |

#### Example call

```ts
await workspace.call({
  "tool": "browser.test",
  "input": {
    "url": "https://example.com",
    "preset": "mobile",
    "full": true,
    "dryRun": true
  }
});
```

#### Success envelope

```json
{
  "ok": true,
  "code": "OK",
  "message": "command completed",
  "data": {
    "raw": "example"
  },
  "stderr": "",
  "exitCode": 0,
  "durationMs": 12,
  "traceId": "trc_abc123def456",
  "apiVersion": "1.0.0"
}
```

#### Error envelope

```json
{
  "ok": false,
  "code": "VALIDATION_ERROR",
  "message": "input: Required",
  "data": {
    "issues": []
  },
  "stderr": "",
  "exitCode": 1,
  "durationMs": 12,
  "traceId": "trc_abc123def456",
  "apiVersion": "1.0.0"
}
```

### workspace.browser.trace

start or stop browser tracing and optionally write a trace file

| Field | Value |
| --- | --- |
| Category | utilities |
| Signature | `workspace.browser.trace({ action: "start" &#124; "stop"; path?: string; dryRun?: boolean; requestId?: string; taskSession?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } &#124; null>>` |
| Runtime | `workspace browser.trace` |
| Capability | writes state · mutating · single-shot |
| Default timeout | 300000ms |

#### Example call

```ts
await workspace.call({
  "tool": "browser.trace",
  "input": {
    "action": "start",
    "dryRun": true
  }
});
```

#### Success envelope

```json
{
  "ok": true,
  "code": "OK",
  "message": "command completed",
  "data": {
    "raw": "example"
  },
  "stderr": "",
  "exitCode": 0,
  "durationMs": 12,
  "traceId": "trc_abc123def456",
  "apiVersion": "1.0.0"
}
```

#### Error envelope

```json
{
  "ok": false,
  "code": "VALIDATION_ERROR",
  "message": "input: Required",
  "data": {
    "issues": []
  },
  "stderr": "",
  "exitCode": 1,
  "durationMs": 12,
  "traceId": "trc_abc123def456",
  "apiVersion": "1.0.0"
}
```

### workspace.browser.wait

wait for a selector, duration, text, URL, load state, JavaScript condition, or download

| Field | Value |
| --- | --- |
| Category | utilities |
| Signature | `workspace.browser.wait({ target?: string; text?: string; url?: string; load?: string; conditionScript?: string; download?: boolean; dryRun?: boolean; requestId?: string; taskSession?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } &#124; null>>` |
| Runtime | `workspace browser.wait` |
| Capability | writes state · mutating · single-shot |
| Default timeout | 300000ms |

#### Example call

```ts
await workspace.call({
  "tool": "browser.wait",
  "input": {
    "load": "networkidle",
    "dryRun": true
  }
});
```

#### Success envelope

```json
{
  "ok": true,
  "code": "OK",
  "message": "command completed",
  "data": {
    "raw": "example"
  },
  "stderr": "",
  "exitCode": 0,
  "durationMs": 12,
  "traceId": "trc_abc123def456",
  "apiVersion": "1.0.0"
}
```

#### Error envelope

```json
{
  "ok": false,
  "code": "VALIDATION_ERROR",
  "message": "input: Required",
  "data": {
    "issues": []
  },
  "stderr": "",
  "exitCode": 1,
  "durationMs": 12,
  "traceId": "trc_abc123def456",
  "apiVersion": "1.0.0"
}
```

### workspace.doctor

run workspace diagnostics

| Field | Value |
| --- | --- |
| Category | utilities |
| Signature | `workspace.doctor({ requestId?: string; taskSession?: string; dryRun?: boolean }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } &#124; null>>` |
| Runtime | `workspace doctor` |
| Capability | read-only · non-mutating · safe to retry |
| Default timeout | 120000ms |

#### Example call

```ts
await workspace.call({
  "tool": "doctor",
  "input": {}
});
```

#### Success envelope

```json
{
  "ok": true,
  "code": "OK",
  "message": "command completed",
  "data": {
    "raw": "example"
  },
  "stderr": "",
  "exitCode": 0,
  "durationMs": 12,
  "traceId": "trc_abc123def456",
  "apiVersion": "1.0.0"
}
```

#### Error envelope

```json
{
  "ok": false,
  "code": "VALIDATION_ERROR",
  "message": "input: Required",
  "data": {
    "issues": []
  },
  "stderr": "",
  "exitCode": 1,
  "durationMs": 12,
  "traceId": "trc_abc123def456",
  "apiVersion": "1.0.0"
}
```

### workspace.git.status

alias for status; use status directly in new code

| Field | Value |
| --- | --- |
| Category | utilities |
| Signature | `workspace.git.status({ requestId?: string; taskSession?: string; dryRun?: boolean }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } &#124; null>>` |
| Runtime | `workspace status` |
| Capability | read-only · non-mutating · safe to retry |
| Default timeout | 120000ms |

#### Example call

```ts
await workspace.call({
  "tool": "git.status",
  "input": {}
});
```

#### Success envelope

```json
{
  "ok": true,
  "code": "OK",
  "message": "command completed",
  "data": {
    "raw": "example"
  },
  "stderr": "",
  "exitCode": 0,
  "durationMs": 12,
  "traceId": "trc_abc123def456",
  "apiVersion": "1.0.0"
}
```

#### Error envelope

```json
{
  "ok": false,
  "code": "VALIDATION_ERROR",
  "message": "input: Required",
  "data": {
    "issues": []
  },
  "stderr": "",
  "exitCode": 1,
  "durationMs": 12,
  "traceId": "trc_abc123def456",
  "apiVersion": "1.0.0"
}
```

### workspace.railway.logs

read Railway deploy/runtime logs through the workspace script

| Field | Value |
| --- | --- |
| Category | utilities |
| Signature | `workspace.railway.logs({ service?: string; build?: boolean; errors?: boolean; network?: boolean; raw?: boolean; status?: boolean; filter?: string; lines?: number; requestId?: string; taskSession?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } &#124; null>>` |
| Runtime | `workspace railway.logs` |
| Capability | read-only · non-mutating · safe to retry |
| Default timeout | 60000ms |

#### Example call

```ts
await workspace.call({
  "tool": "railway.logs",
  "input": {
    "service": "opensaas",
    "lines": 10
  }
});
```

#### Success envelope

```json
{
  "ok": true,
  "code": "OK",
  "message": "command completed",
  "data": {
    "raw": "example"
  },
  "stderr": "",
  "exitCode": 0,
  "durationMs": 12,
  "traceId": "trc_abc123def456",
  "apiVersion": "1.0.0"
}
```

#### Error envelope

```json
{
  "ok": false,
  "code": "VALIDATION_ERROR",
  "message": "input: Required",
  "data": {
    "issues": []
  },
  "stderr": "",
  "exitCode": 1,
  "durationMs": 12,
  "traceId": "trc_abc123def456",
  "apiVersion": "1.0.0"
}
```

### workspace.railway.redeploy

trigger a Railway redeploy

| Field | Value |
| --- | --- |
| Category | utilities |
| Signature | `workspace.railway.redeploy({ service?: string; all?: boolean; wait?: boolean; dryRun?: boolean; requestId?: string; taskSession?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } &#124; null>>` |
| Runtime | `workspace railway.redeploy` |
| Capability | writes state · mutating · single-shot |
| Default timeout | 600000ms |

#### Example call

```ts
await workspace.call({
  "tool": "railway.redeploy",
  "input": {
    "service": "opensaas",
    "dryRun": true
  }
});
```

#### Success envelope

```json
{
  "ok": true,
  "code": "OK",
  "message": "command completed",
  "data": {
    "raw": "example"
  },
  "stderr": "",
  "exitCode": 0,
  "durationMs": 12,
  "traceId": "trc_abc123def456",
  "apiVersion": "1.0.0"
}
```

#### Error envelope

```json
{
  "ok": false,
  "code": "VALIDATION_ERROR",
  "message": "input: Required",
  "data": {
    "issues": []
  },
  "stderr": "",
  "exitCode": 1,
  "durationMs": 12,
  "traceId": "trc_abc123def456",
  "apiVersion": "1.0.0"
}
```

### workspace.research.ingest

generate a local research packet and autosave its text bundle to context

| Field | Value |
| --- | --- |
| Category | utilities |
| Signature | `workspace.research.ingest({ source: string; question?: string; mode?: "quick" &#124; "standard" &#124; "deep"; visual?: boolean; slidesMax?: number; videoMode?: "auto" &#124; "transcript" &#124; "understand"; keep?: boolean; outDir?: string; summarizeBin?: string; contextTitle?: string; contextCategory?: string; noContextSave?: boolean; dryRun?: boolean; requestId?: string; taskSession?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } &#124; null>>` |
| Runtime | `workspace research.ingest` |
| Capability | writes state · mutating · single-shot |
| Default timeout | 600000ms |

#### Example call

```ts
await workspace.call({
  "tool": "research.ingest",
  "input": {
    "source": "https://example.com",
    "question": "What should I learn from this?",
    "dryRun": true
  }
});
```

#### Success envelope

```json
{
  "ok": true,
  "code": "OK",
  "message": "command completed",
  "data": {
    "raw": "example"
  },
  "stderr": "",
  "exitCode": 0,
  "durationMs": 12,
  "traceId": "trc_abc123def456",
  "apiVersion": "1.0.0"
}
```

#### Error envelope

```json
{
  "ok": false,
  "code": "VALIDATION_ERROR",
  "message": "input: Required",
  "data": {
    "issues": []
  },
  "stderr": "",
  "exitCode": 1,
  "durationMs": 12,
  "traceId": "trc_abc123def456",
  "apiVersion": "1.0.0"
}
```

### workspace.server

manage the workspace MCP server reload/status lifecycle

| Field | Value |
| --- | --- |
| Category | utilities |
| Signature | `workspace.server({ action: "status" &#124; "consuelo-reload" &#124; "reload" &#124; "restart" &#124; "stop" &#124; "start" &#124; "logs"; dryRun?: boolean; requestId?: string; taskSession?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } &#124; null>>` |
| Runtime | `workspace server` |
| Capability | writes state · mutating · single-shot |
| Default timeout | 120000ms |

#### Example call

```ts
await workspace.call({
  "tool": "server",
  "input": {
    "action": "status"
  }
});
```

#### Success envelope

```json
{
  "ok": true,
  "code": "OK",
  "message": "command completed",
  "data": {
    "raw": "example"
  },
  "stderr": "",
  "exitCode": 0,
  "durationMs": 12,
  "traceId": "trc_abc123def456",
  "apiVersion": "1.0.0"
}
```

#### Error envelope

```json
{
  "ok": false,
  "code": "VALIDATION_ERROR",
  "message": "input: Required",
  "data": {
    "issues": []
  },
  "stderr": "",
  "exitCode": 1,
  "durationMs": 12,
  "traceId": "trc_abc123def456",
  "apiVersion": "1.0.0"
}
```

### workspace.status

show compact workspace status

| Field | Value |
| --- | --- |
| Category | utilities |
| Signature | `workspace.status({ requestId?: string; taskSession?: string; dryRun?: boolean }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } &#124; null>>` |
| Runtime | `workspace status` |
| Capability | read-only · non-mutating · safe to retry |
| Default timeout | 120000ms |

#### Example call

```ts
await workspace.call({
  "tool": "status",
  "input": {}
});
```

#### Success envelope

```json
{
  "ok": true,
  "code": "OK",
  "message": "command completed",
  "data": {
    "raw": "example"
  },
  "stderr": "",
  "exitCode": 0,
  "durationMs": 12,
  "traceId": "trc_abc123def456",
  "apiVersion": "1.0.0"
}
```

#### Error envelope

```json
{
  "ok": false,
  "code": "VALIDATION_ERROR",
  "message": "input: Required",
  "data": {
    "issues": []
  },
  "stderr": "",
  "exitCode": 1,
  "durationMs": 12,
  "traceId": "trc_abc123def456",
  "apiVersion": "1.0.0"
}
```

### workspace.tmp

run the workspace temp-file helper

| Field | Value |
| --- | --- |
| Category | utilities |
| Signature | `workspace.tmp({ action: string; name?: string; content?: string; ext?: string; dryRun?: boolean; requestId?: string; taskSession?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } &#124; null>>` |
| Runtime | `workspace tmp` |
| Capability | writes state · mutating · single-shot |
| Default timeout | 60000ms |

#### Example call

```ts
await workspace.call({
  "tool": "tmp",
  "input": {
    "action": "write",
    "name": "example",
    "content": "hello",
    "dryRun": true
  }
});
```

#### Success envelope

```json
{
  "ok": true,
  "code": "OK",
  "message": "command completed",
  "data": {
    "raw": "example"
  },
  "stderr": "",
  "exitCode": 0,
  "durationMs": 12,
  "traceId": "trc_abc123def456",
  "apiVersion": "1.0.0"
}
```

#### Error envelope

```json
{
  "ok": false,
  "code": "VALIDATION_ERROR",
  "message": "input: Required",
  "data": {
    "issues": []
  },
  "stderr": "",
  "exitCode": 1,
  "durationMs": 12,
  "traceId": "trc_abc123def456",
  "apiVersion": "1.0.0"
}
```

### workspace.wait

sleep, create detached wait checkpoints, or wait for a PR/deploy

| Field | Value |
| --- | --- |
| Category | utilities |
| Signature | `workspace.wait({ seconds?: number; duration?: string; detached?: boolean; status?: string; list?: boolean; reason?: string; deploy?: boolean; pr?: number; requestId?: string; taskSession?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } &#124; null>>` |
| Runtime | `workspace wait` |
| Capability | read-only · non-mutating · safe to retry |
| Default timeout | 300000ms |

#### Example call

```ts
await workspace.call({
  "tool": "wait",
  "input": {
    "duration": "24h",
    "detached": true,
    "reason": "wake after long-running external work"
  }
});
```

#### Success envelope

```json
{
  "ok": true,
  "code": "OK",
  "message": "command completed",
  "data": {
    "raw": "example"
  },
  "stderr": "",
  "exitCode": 0,
  "durationMs": 12,
  "traceId": "trc_abc123def456",
  "apiVersion": "1.0.0"
}
```

#### Error envelope

```json
{
  "ok": false,
  "code": "VALIDATION_ERROR",
  "message": "input: Required",
  "data": {
    "issues": []
  },
  "stderr": "",
  "exitCode": 1,
  "durationMs": 12,
  "traceId": "trc_abc123def456",
  "apiVersion": "1.0.0"
}
```

### workspace.website.deploy

deploy the Consuelo website

| Field | Value |
| --- | --- |
| Category | utilities |
| Signature | `workspace.website.deploy({ preview?: boolean; buildOnly?: boolean; dryRun?: boolean; requestId?: string; taskSession?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } &#124; null>>` |
| Runtime | `workspace website.deploy` |
| Capability | writes state · mutating · single-shot |
| Default timeout | 600000ms |

#### Example call

```ts
await workspace.call({
  "tool": "website.deploy",
  "input": {
    "buildOnly": true,
    "dryRun": true
  }
});
```

#### Success envelope

```json
{
  "ok": true,
  "code": "OK",
  "message": "command completed",
  "data": {
    "raw": "example"
  },
  "stderr": "",
  "exitCode": 0,
  "durationMs": 12,
  "traceId": "trc_abc123def456",
  "apiVersion": "1.0.0"
}
```

#### Error envelope

```json
{
  "ok": false,
  "code": "VALIDATION_ERROR",
  "message": "input: Required",
  "data": {
    "issues": []
  },
  "stderr": "",
  "exitCode": 1,
  "durationMs": 12,
  "traceId": "trc_abc123def456",
  "apiVersion": "1.0.0"
}
```

## worker

### workspace.worker.call

delegate a bounded instruction file to a configured local worker provider

| Field | Value |
| --- | --- |
| Category | worker |
| Signature | `workspace.worker.call({ provider: "cdx" &#124; "pi" &#124; "opc" &#124; "mini"; profile?: string; mode?: "check" &#124; "step" &#124; "work"; policy?: "read" &#124; "safe" &#124; "edit" &#124; "ship"; instructionPath: string; cwd?: string; taskSession?: string; timeoutMs?: number; workspaceOnly?: boolean &#124; "preferred" &#124; "strict"; approval?: Record<string, unknown>; requestId?: string }) => Promise<ToolResult<{ provider: "cdx" &#124; "pi" &#124; "opc"; requestedProvider?: "cdx" &#124; "pi" &#124; "opc" &#124; "mini"; profile?: string; mode: "check" &#124; "step" &#124; "work"; policy: "read" &#124; "safe" &#124; "edit" &#124; "ship"; status: "completed" &#124; "failed" &#124; "not_configured" &#124; "not_supported" &#124; "timed_out" &#124; "approval_required"; cwd: string; instructionPath: string; command: string[]; stdout: string; stderr: string; exitCode: number; durationMs: number; audit: { taskSession?: string; branch?: string; workspaceOnly: "preferred" &#124; "strict" &#124; false; rawShellUsed: boolean } }>>` |
| Runtime | `workspace worker.call` |
| Capability | writes state · mutating · single-shot |
| Default timeout | 300000ms |

#### Example call

```ts
await workspace.call({
  "tool": "worker.call",
  "input": {
    "provider": "cdx",
    "mode": "work",
    "policy": "edit",
    "instructionPath": ".task/workspace-agents/example/worker-instructions.md",
    "workspaceOnly": "preferred"
  }
});
```

#### Success envelope

```json
{
  "ok": true,
  "code": "OK",
  "message": "command completed",
  "data": {
    "raw": "example"
  },
  "stderr": "",
  "exitCode": 0,
  "durationMs": 12,
  "traceId": "trc_abc123def456",
  "apiVersion": "1.0.0"
}
```

#### Error envelope

```json
{
  "ok": false,
  "code": "VALIDATION_ERROR",
  "message": "input: Required",
  "data": {
    "issues": []
  },
  "stderr": "",
  "exitCode": 1,
  "durationMs": 12,
  "traceId": "trc_abc123def456",
  "apiVersion": "1.0.0"
}
```

## workflow

### workspace.intent

Start a task workflow for scoped write access. It dispatches progressively disclosed tools, workflow hooks, validation steps, and rules that preserve user safety and alignment.

| Field | Value |
| --- | --- |
| Category | workflow |
| Signature | `workspace.intent({ action: "start" &#124; "dispatch"; workflow?: "task" &#124; "office" &#124; "design" &#124; "sites"; area?: string; title?: string; eventFile?: string; dryRun?: boolean; requestId?: string; taskSession?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } &#124; null>>` |
| Runtime | `workspace intent` |
| Capability | writes state · mutating · single-shot |
| Default timeout | 120000ms |

#### Example call

```ts
await workspace.call({
  "tool": "intent",
  "input": {
    "action": "start",
    "workflow": "task",
    "area": "workspace-agents",
    "title": "example task intent"
  }
});
```

#### Success envelope

```json
{
  "ok": true,
  "code": "OK",
  "message": "command completed",
  "data": {
    "raw": "example"
  },
  "stderr": "",
  "exitCode": 0,
  "durationMs": 12,
  "traceId": "trc_abc123def456",
  "apiVersion": "1.0.0"
}
```

#### Error envelope

```json
{
  "ok": false,
  "code": "VALIDATION_ERROR",
  "message": "input: Required",
  "data": {
    "issues": []
  },
  "stderr": "",
  "exitCode": 1,
  "durationMs": 12,
  "traceId": "trc_abc123def456",
  "apiVersion": "1.0.0"
}
```

## Result envelope

Every result includes `ok`, `code`, `message`, `data`, `stderr`, `exitCode`, `durationMs`, `traceId`, and `apiVersion`. When callers pass a `requestId`, the facade echoes it so work can be correlated across logs and task evidence.

## Error codes

`OK`, `VALIDATION_ERROR`, `CODE_CALL_VALIDATION_ERROR`, `AMBIGUOUS_TASK_SELECTION`, `WORKTREE_NOT_FOUND`, `COMMAND_FAILED`, `TIMEOUT`, `PARSE_ERROR`, `NOT_FOUND`, `TASK_SESSION_REQUIRED`, `TASK_SESSION_NOT_FOUND`, `DRY_RUN`.

## Final rule

The tool manifest is executable contract. If this file and the manifest disagree, regenerate this file from the manifest and trust the manifest-backed generator.

