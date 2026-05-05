# workspace typed tools

## mandatory workspace app transport

You are working inside the workspace MCP app. The app exposes exactly two tools:

- `workspace.get_steering()`
- `workspace.sandbox_exec({ command, timeout })`

Every command in this document is run through `sandbox_exec`. When you see a command string such as:

```bash
workspace stream.context '{"area":"workspace-agents"}'
```

call it as:

```ts
workspace.sandbox_exec({
  command: "workspace stream.context '{\"area\":\"workspace-agents\"}'",
  timeout: 120
})
```

**This wrapper is mandatory.** `workspace stream.context ...` is not a direct MCP tool call and it is not a shell command agents should run outside the workspace app. Inside the workspace app, `sandbox_exec` is the transport layer and the `workspace <tool> '<json>'` command is the typed facade entrypoint. If a command does not work through `sandbox_exec`, test it there and fix the command or implementation.

This file is generated from `packages/workspace/tooling/tool-manifest.json`. The typed facade validates inputs, invokes the existing Bun workspace scripts, and wraps every result in the standard tool envelope.

## quick start

Inside the workspace app, invoke the same tool through `sandbox_exec`:

```ts
workspace.sandbox_exec({
  command: "workspace fs.read '{\"path\":\"packages/workspace/package.json\"}'",
  timeout: 120
})
```

The TypeScript shape below documents the facade schema and return envelope:

```ts
import { workspace } from './src/generated/tool-client';

const result = await workspace.fs.read({ path: 'packages/workspace/package.json' });
if (!result.ok) throw new Error(result.message);
```

## commands by category

## composed

### checkFiles

run syntax checks over a set of files through task:exec

- signature: `workspace.checkFiles({ branch?: string; files: string[]; stopOnFirstError?: boolean; requestId?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>`
- wraps: `workspace checkFiles`
- capabilities: readOnly=true, mutating=false, safeToRetry=false
- default timeout: 300000ms

example call:

```ts
await workspace.checkFiles({
  "branch": "task/workspace-agents/example",
  "files": [
    "packages/workspace/scripts/fs.js"
  ],
  "stopOnFirstError": true
});
```

example success envelope:

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

example error envelope:

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

### editFlow

run a search-read-patch-verify flow as a composed script

- signature: `workspace.editFlow({ branch?: string; searchPattern: string; searchPaths: string[]; from: number; to: number; contentFile: string; dryRun?: boolean; requestId?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>`
- wraps: `workspace editFlow`
- capabilities: readOnly=false, mutating=true, safeToRetry=false
- default timeout: 300000ms

example call:

```ts
await workspace.editFlow({
  "branch": "task/workspace-agents/example",
  "searchPattern": "oldFn",
  "searchPaths": [
    "packages/workspace/scripts"
  ],
  "from": 1,
  "to": 1,
  "contentFile": "/tmp/new.ts",
  "dryRun": true
});
```

example success envelope:

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

example error envelope:

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

## consuelo design

### consueloDesign.check

run consuelo-design package boundary and Railway checks

- signature: `workspace.consueloDesign.check({ requestId?: string; dryRun?: boolean }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>`
- wraps: `workspace consuelo-design check`
- capabilities: readOnly=true, mutating=false, safeToRetry=true
- default timeout: 30000ms

example call:

```ts
await workspace.consueloDesign.check({});
```

example success envelope:

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

example error envelope:

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

### consueloDesign.generateDemo

start or open a live Open Design demo working session

- signature: `workspace.consueloDesign.generateDemo({ requestId?: string; dryRun?: boolean; name?: string; prompt?: string; timeout?: number }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>`
- wraps: `workspace consuelo-design generate-demo`
- capabilities: readOnly=false, mutating=true, safeToRetry=false
- default timeout: 600000ms

example call:

```ts
await workspace.consueloDesign.generateDemo({
  "dryRun": true
});
```

example success envelope:

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

example error envelope:

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

### consueloDesign.generateDigitalEguide

start or open a live Open Design digital e-guide working session

- signature: `workspace.consueloDesign.generateDigitalEguide({ requestId?: string; dryRun?: boolean; name?: string; prompt?: string; timeout?: number }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>`
- wraps: `workspace consuelo-design generate-digital-eguide`
- capabilities: readOnly=false, mutating=true, safeToRetry=false
- default timeout: 600000ms

example call:

```ts
await workspace.consueloDesign.generateDigitalEguide({
  "dryRun": true
});
```

example success envelope:

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

example error envelope:

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

### consueloDesign.generateEmail

start or open a live Open Design email working session

- signature: `workspace.consueloDesign.generateEmail({ requestId?: string; dryRun?: boolean; name?: string; prompt?: string; timeout?: number }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>`
- wraps: `workspace consuelo-design generate-email`
- capabilities: readOnly=false, mutating=true, safeToRetry=false
- default timeout: 600000ms

example call:

```ts
await workspace.consueloDesign.generateEmail({
  "dryRun": true
});
```

example success envelope:

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

example error envelope:

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

### consueloDesign.generateImageBrief

start or open a live Open Design image/media working session

- signature: `workspace.consueloDesign.generateImageBrief({ requestId?: string; dryRun?: boolean; name?: string; prompt?: string; timeout?: number }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>`
- wraps: `workspace consuelo-design generate-image-brief`
- capabilities: readOnly=false, mutating=true, safeToRetry=false
- default timeout: 600000ms

example call:

```ts
await workspace.consueloDesign.generateImageBrief({
  "dryRun": true
});
```

example success envelope:

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

example error envelope:

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

### consueloDesign.generateMotionFrame

start or open a live Open Design motion-frame working session

- signature: `workspace.consueloDesign.generateMotionFrame({ requestId?: string; dryRun?: boolean; name?: string; prompt?: string; timeout?: number }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>`
- wraps: `workspace consuelo-design generate-motion-frame`
- capabilities: readOnly=false, mutating=true, safeToRetry=false
- default timeout: 600000ms

example call:

```ts
await workspace.consueloDesign.generateMotionFrame({
  "dryRun": true
});
```

example success envelope:

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

example error envelope:

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

### consueloDesign.generateWebsite

start or open a live Open Design website working session

- signature: `workspace.consueloDesign.generateWebsite({ requestId?: string; dryRun?: boolean; name?: string; prompt?: string; timeout?: number }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>`
- wraps: `workspace consuelo-design generate-website`
- capabilities: readOnly=false, mutating=true, safeToRetry=false
- default timeout: 600000ms

example call:

```ts
await workspace.consueloDesign.generateWebsite({
  "dryRun": true
});
```

example success envelope:

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

example error envelope:

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

### consueloDesign.getDesignSystem

return base Consuelo DESIGN.md and consuelo-design AGENTS.md only

- signature: `workspace.consueloDesign.getDesignSystem({ requestId?: string; dryRun?: boolean }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>`
- wraps: `workspace consuelo-design get-design-system`
- capabilities: readOnly=true, mutating=false, safeToRetry=true
- default timeout: 30000ms

example call:

```ts
await workspace.consueloDesign.getDesignSystem({});
```

example success envelope:

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

example error envelope:

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

### consueloDesign.listDesignSystems

list Consuelo default design system and upstream reference systems

- signature: `workspace.consueloDesign.listDesignSystems({ requestId?: string; dryRun?: boolean }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>`
- wraps: `workspace consuelo-design list-design-systems`
- capabilities: readOnly=true, mutating=false, safeToRetry=true
- default timeout: 30000ms

example call:

```ts
await workspace.consueloDesign.listDesignSystems({});
```

example success envelope:

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

example error envelope:

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

### consueloDesign.listSkills

list upstream Open Design skills and Consuelo workflow mappings

- signature: `workspace.consueloDesign.listSkills({ requestId?: string; dryRun?: boolean }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>`
- wraps: `workspace consuelo-design list-skills`
- capabilities: readOnly=true, mutating=false, safeToRetry=true
- default timeout: 30000ms

example call:

```ts
await workspace.consueloDesign.listSkills({});
```

example success envelope:

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

example error envelope:

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

### consueloDesign.odBuild

build the vendored Open Design daemon CLI through the Bun facade

- signature: `workspace.consueloDesign.odBuild({ requestId?: string; dryRun?: boolean; timeout?: number }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>`
- wraps: `workspace consuelo-design od:build`
- capabilities: readOnly=false, mutating=true, safeToRetry=false
- default timeout: 300000ms

example call:

```ts
await workspace.consueloDesign.odBuild({
  "dryRun": true
});
```

example success envelope:

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

example error envelope:

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

### consueloDesign.railwayCheck

verify consuelo-design is excluded from Railway deploy paths

- signature: `workspace.consueloDesign.railwayCheck({ requestId?: string; dryRun?: boolean }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>`
- wraps: `workspace consuelo-design railway:check`
- capabilities: readOnly=true, mutating=false, safeToRetry=true
- default timeout: 30000ms

example call:

```ts
await workspace.consueloDesign.railwayCheck({});
```

example success envelope:

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

example error envelope:

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

### consueloDesign.renderHyperframes

start or open a live Open Design HyperFrames render working session

- signature: `workspace.consueloDesign.renderHyperframes({ requestId?: string; dryRun?: boolean; name?: string; prompt?: string; timeout?: number }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>`
- wraps: `workspace consuelo-design render-hyperframes`
- capabilities: readOnly=false, mutating=true, safeToRetry=false
- default timeout: 600000ms

example call:

```ts
await workspace.consueloDesign.renderHyperframes({
  "dryRun": true
});
```

example success envelope:

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

example error envelope:

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

### consueloDesign.run

start Open Design daemon and web UI in the foreground through the Bun facade

- signature: `workspace.consueloDesign.run({ requestId?: string; dryRun?: boolean; timeout?: number }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>`
- wraps: `workspace consuelo-design run`
- capabilities: readOnly=false, mutating=true, safeToRetry=false
- default timeout: 600000ms

example call:

```ts
await workspace.consueloDesign.run({
  "dryRun": true
});
```

example success envelope:

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

example error envelope:

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

### consueloDesign.uiBg

start Open Design managed runtimes in the background through the Bun facade

- signature: `workspace.consueloDesign.uiBg({ requestId?: string; dryRun?: boolean; timeout?: number }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>`
- wraps: `workspace consuelo-design ui:bg`
- capabilities: readOnly=false, mutating=true, safeToRetry=false
- default timeout: 300000ms

example call:

```ts
await workspace.consueloDesign.uiBg({
  "dryRun": true
});
```

example success envelope:

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

example error envelope:

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

### consueloDesign.uiLogs

show Open Design managed runtime logs through the Bun facade

- signature: `workspace.consueloDesign.uiLogs({ requestId?: string; dryRun?: boolean }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>`
- wraps: `workspace consuelo-design ui:logs`
- capabilities: readOnly=true, mutating=false, safeToRetry=true
- default timeout: 30000ms

example call:

```ts
await workspace.consueloDesign.uiLogs({});
```

example success envelope:

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

example error envelope:

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

### consueloDesign.uiStatus

show Open Design managed runtime status through the Bun facade

- signature: `workspace.consueloDesign.uiStatus({ requestId?: string; dryRun?: boolean }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>`
- wraps: `workspace consuelo-design ui:status`
- capabilities: readOnly=true, mutating=false, safeToRetry=true
- default timeout: 30000ms

example call:

```ts
await workspace.consueloDesign.uiStatus({});
```

example success envelope:

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

example error envelope:

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

### consueloDesign.uiStop

stop Open Design managed runtimes through the Bun facade

- signature: `workspace.consueloDesign.uiStop({ requestId?: string; dryRun?: boolean; timeout?: number }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>`
- wraps: `workspace consuelo-design ui:stop`
- capabilities: readOnly=false, mutating=true, safeToRetry=false
- default timeout: 120000ms

example call:

```ts
await workspace.consueloDesign.uiStop({
  "dryRun": true
});
```

example success envelope:

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

example error envelope:

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

### consueloDesign.upstreamStatus

show vendored Open Design metadata and runtime requirements

- signature: `workspace.consueloDesign.upstreamStatus({ requestId?: string; dryRun?: boolean }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>`
- wraps: `workspace consuelo-design upstream-status`
- capabilities: readOnly=true, mutating=false, safeToRetry=true
- default timeout: 30000ms

example call:

```ts
await workspace.consueloDesign.upstreamStatus({});
```

example success envelope:

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

example error envelope:

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

### context.categories

list project memory categories

- signature: `workspace.context.categories({ requestId?: string; dryRun?: boolean }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>`
- wraps: `workspace context.categories`
- capabilities: readOnly=true, mutating=false, safeToRetry=true
- default timeout: 60000ms

example call:

```ts
await workspace.context.categories({});
```

example success envelope:

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

example error envelope:

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

### context.find

search project memory by title

- signature: `workspace.context.find({ keyword: string; limit?: number; requestId?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>`
- wraps: `workspace context.find`
- capabilities: readOnly=true, mutating=false, safeToRetry=true
- default timeout: 60000ms

example call:

```ts
await workspace.context.find({
  "keyword": "handoff",
  "limit": 3
});
```

example success envelope:

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

example error envelope:

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

### context.get

read a full project memory search result

- signature: `workspace.context.get({ index: number; keyword: string; requestId?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>`
- wraps: `workspace context.get`
- capabilities: readOnly=true, mutating=false, safeToRetry=true
- default timeout: 60000ms

example call:

```ts
await workspace.context.get({
  "index": 1,
  "keyword": "workspace"
});
```

example success envelope:

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

example error envelope:

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

### context.list

list recent project memories

- signature: `workspace.context.list({ category?: string; limit?: number; requestId?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>`
- wraps: `workspace context.list`
- capabilities: readOnly=true, mutating=false, safeToRetry=true
- default timeout: 60000ms

example call:

```ts
await workspace.context.list({
  "category": "workpad",
  "limit": 3
});
```

example success envelope:

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

example error envelope:

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

### context.save

save a file or text into project memory

- signature: `workspace.context.save({ title: string; file?: string; content?: string; category?: string; dryRun?: boolean; requestId?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>`
- wraps: `workspace context.save`
- capabilities: readOnly=false, mutating=true, safeToRetry=false
- default timeout: 60000ms

example call:

```ts
await workspace.context.save({
  "title": "example memory",
  "file": "/tmp/example.md",
  "dryRun": true
});
```

example success envelope:

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

example error envelope:

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

### context.search

search project memory by content

- signature: `workspace.context.search({ keyword: string; limit?: number; category?: string; requestId?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>`
- wraps: `workspace context.search`
- capabilities: readOnly=true, mutating=false, safeToRetry=true
- default timeout: 60000ms

example call:

```ts
await workspace.context.search({
  "keyword": "workspace",
  "limit": 3
});
```

example success envelope:

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

example error envelope:

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

### audit

audit workspace scripts, docs, or index freshness

- signature: `workspace.audit({ scripts?: boolean; docs?: boolean; index?: boolean; requestId?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>`
- wraps: `workspace audit`
- capabilities: readOnly=true, mutating=false, safeToRetry=true
- default timeout: 120000ms

example call:

```ts
await workspace.audit({
  "scripts": true
});
```

example success envelope:

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

example error envelope:

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

### confidenceScore

score confidence from evidence state

- signature: `workspace.confidenceScore({ requestId?: string; dryRun?: boolean }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>`
- wraps: `workspace confidenceScore`
- capabilities: readOnly=true, mutating=false, safeToRetry=true
- default timeout: 300000ms

example call:

```ts
await workspace.confidenceScore({});
```

example success envelope:

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

example error envelope:

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

### confirm

run verification or targeted validation through confirm

- signature: `workspace.confirm({ verify?: boolean; runtime?: boolean; test?: string; requestId?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>`
- wraps: `workspace confirm`
- capabilities: readOnly=true, mutating=false, safeToRetry=true
- default timeout: 120000ms

example call:

```ts
await workspace.confirm({
  "verify": true
});
```

example success envelope:

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

example error envelope:

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

### decideNext

recommend the next action from evidence state

- signature: `workspace.decideNext({ context?: string; markRead?: string; markRelevant?: string; markIrrelevant?: string; requestId?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>`
- wraps: `workspace decideNext`
- capabilities: readOnly=true, mutating=false, safeToRetry=true
- default timeout: 300000ms

example call:

```ts
await workspace.decideNext({});
```

example success envelope:

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

example error envelope:

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

### exploit

select the highest-confidence editing target

- signature: `workspace.exploit({ query?: string; target?: string; requestId?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>`
- wraps: `workspace exploit`
- capabilities: readOnly=true, mutating=false, safeToRetry=true
- default timeout: 120000ms

example call:

```ts
await workspace.exploit({});
```

example success envelope:

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

example error envelope:

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

### explore

run repository exploration retrieval

- signature: `workspace.explore({ query: string; limit?: number; changedOnly?: boolean; reindex?: boolean; requestId?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>`
- wraps: `workspace explore`
- capabilities: readOnly=true, mutating=false, safeToRetry=true
- default timeout: 300000ms

example call:

```ts
await workspace.explore({
  "query": "workspace facade",
  "limit": 5
});
```

example success envelope:

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

example error envelope:

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

### fs.list

list or find files in the repo root or a resolved task worktree

- signature: `workspace.fs.list({ path?: string; pattern?: string; depth?: number; tree?: boolean; dirs?: boolean; files?: boolean; branch?: string; requestId?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>`
- wraps: `workspace fs list, or task:fs list when a branch is resolved`
- capabilities: readOnly=true, mutating=false, safeToRetry=true
- default timeout: 30000ms

example call:

```ts
await workspace.fs.list({
  "branch": "task/workspace-agents/example",
  "path": "packages/workspace/scripts",
  "depth": 1
});
```

example success envelope:

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

example error envelope:

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

### fs.patch

replace a line range in a task worktree file

- signature: `workspace.fs.patch({ path: string; from: number; to: number; content?: string; contentFile?: string; branch?: string; dryRun?: boolean; requestId?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>`
- wraps: `workspace fs.patch`
- capabilities: readOnly=false, mutating=true, safeToRetry=false
- default timeout: 30000ms

example call:

```ts
await workspace.fs.patch({
  "branch": "task/workspace-agents/example",
  "path": "tmp/example.txt",
  "from": 1,
  "to": 1,
  "dryRun": true,
  "contentFile": "/tmp/replacement.txt"
});
```

example success envelope:

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

example error envelope:

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

### fs.read

read file contents with an optional line range

- signature: `workspace.fs.read({ path: string; from?: number; to?: number; branch?: string; requestId?: string }) => Promise<ToolResult<Array<{ path: string; from: number; to: number; total: number; lines: string[] }>>>`
- wraps: `workspace fs read, or task:fs read when a branch is resolved`
- capabilities: readOnly=true, mutating=false, safeToRetry=true
- default timeout: 30000ms

example call:

```ts
await workspace.fs.read({
  "branch": "task/workspace-agents/example",
  "path": "packages/workspace/package.json"
});
```

example success envelope:

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

example error envelope:

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

### fs.search

search files with ripgrep through the workspace script

- signature: `workspace.fs.search({ pattern: string; paths?: string[]; include?: string; context?: number; maxResults?: number; branch?: string; requestId?: string }) => Promise<ToolResult<Array<{ file: string; line: number; text: string }>>>`
- wraps: `workspace fs search, or task:fs search when a branch is resolved`
- capabilities: readOnly=true, mutating=false, safeToRetry=true
- default timeout: 30000ms

example call:

```ts
await workspace.fs.search({
  "branch": "task/workspace-agents/example",
  "pattern": "task:fs",
  "paths": [
    "packages/workspace/SCRIPTS.md"
  ]
});
```

example success envelope:

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

example error envelope:

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

### fs.trash

move a task worktree file to trash

- signature: `workspace.fs.trash({ path: string; branch?: string; dryRun?: boolean; requestId?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>`
- wraps: `workspace fs.trash`
- capabilities: readOnly=false, mutating=true, safeToRetry=false
- default timeout: 30000ms

example call:

```ts
await workspace.fs.trash({
  "branch": "task/workspace-agents/example",
  "path": "tmp/example.txt",
  "dryRun": true
});
```

example success envelope:

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

example error envelope:

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

### fs.write

write a file in a task worktree

- signature: `workspace.fs.write({ path: string; content: string; force?: boolean; append?: boolean; mkdirs?: boolean; branch?: string; dryRun?: boolean; requestId?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>`
- wraps: `workspace fs.write`
- capabilities: readOnly=false, mutating=true, safeToRetry=false
- default timeout: 30000ms

example call:

```ts
await workspace.fs.write({
  "branch": "task/workspace-agents/example",
  "path": "tmp/example.txt",
  "content": "hello",
  "dryRun": true
});
```

example success envelope:

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

example error envelope:

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

### generate.docs

generate TOOLS.md from the tool manifest

- signature: `workspace.generate.docs({ requestId?: string; dryRun?: boolean }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>`
- wraps: `workspace generate.docs`
- capabilities: readOnly=false, mutating=true, safeToRetry=false
- default timeout: 120000ms

example call:

```ts
await workspace.generate.docs({
  "dryRun": true
});
```

example success envelope:

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

example error envelope:

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

### generate.types

generate workspace.d.ts from the tool manifest

- signature: `workspace.generate.types({ requestId?: string; dryRun?: boolean }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>`
- wraps: `workspace generate.types`
- capabilities: readOnly=false, mutating=true, safeToRetry=false
- default timeout: 120000ms

example call:

```ts
await workspace.generate.types({
  "dryRun": true
});
```

example success envelope:

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

example error envelope:

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

### gh

run the workspace GitHub helper with an explicit action

- signature: `workspace.gh({ action: string; args?: string[]; dryRun?: boolean; requestId?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>`
- wraps: `workspace gh`
- capabilities: readOnly=false, mutating=true, safeToRetry=false
- default timeout: 120000ms

example call:

```ts
await workspace.gh({
  "action": "view",
  "args": [
    "225"
  ]
});
```

example success envelope:

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

example error envelope:

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

### http

make HTTP requests through the workspace http wrapper (wraps xh)

- signature: `workspace.http({ url: string; method?: "get" | "post" | "put" | "patch" | "delete" | "head"; headers?: Record<string, string>; body?: string; dryRun?: boolean; requestId?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>`
- wraps: `workspace http`
- capabilities: readOnly=false, mutating=true, safeToRetry=true
- default timeout: 60000ms

example call:

```ts
await workspace.http({
  "method": "get",
  "url": "https://example.com"
});
```

example success envelope:

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

example error envelope:

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

### mac.exec

run a non-repo shell command on the Mac

- signature: `workspace.mac.exec({ command: string; cwd?: string; timeout?: number; dryRun?: boolean; requestId?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>`
- wraps: `workspace mac.exec`
- capabilities: readOnly=false, mutating=true, safeToRetry=false
- default timeout: 300000ms

example call:

```ts
await workspace.mac.exec({
  "command": "pwd",
  "dryRun": true
});
```

example success envelope:

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

example error envelope:

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

### mac.list

list non-repo files on the Mac

- signature: `workspace.mac.list({ path?: string; depth?: number; requestId?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>`
- wraps: `workspace mac.list`
- capabilities: readOnly=true, mutating=false, safeToRetry=true
- default timeout: 300000ms

example call:

```ts
await workspace.mac.list({
  "path": "/tmp",
  "depth": 1
});
```

example success envelope:

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

example error envelope:

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

### mac.port

check or find a local port

- signature: `workspace.mac.port({ action: "check" | "find"; port?: number; requestId?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>`
- wraps: `workspace mac.port`
- capabilities: readOnly=true, mutating=false, safeToRetry=true
- default timeout: 300000ms

example call:

```ts
await workspace.mac.port({
  "action": "find"
});
```

example success envelope:

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

example error envelope:

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

### mac.process

list or kill local Mac processes

- signature: `workspace.mac.process({ action: "list" | "kill"; pid?: number; name?: string; dryRun?: boolean; requestId?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>`
- wraps: `workspace mac.process`
- capabilities: readOnly=false, mutating=true, safeToRetry=false
- default timeout: 300000ms

example call:

```ts
await workspace.mac.process({
  "action": "list"
});
```

example success envelope:

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

example error envelope:

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

### mac.read

read a non-repo file on the Mac

- signature: `workspace.mac.read({ path: string; requestId?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>`
- wraps: `workspace mac.read`
- capabilities: readOnly=true, mutating=false, safeToRetry=true
- default timeout: 300000ms

example call:

```ts
await workspace.mac.read({
  "path": "/tmp/example.txt"
});
```

example success envelope:

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

example error envelope:

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

### mac.search

search non-repo files on the Mac

- signature: `workspace.mac.search({ pattern: string; path?: string; include?: string; requestId?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>`
- wraps: `workspace mac.search`
- capabilities: readOnly=true, mutating=false, safeToRetry=true
- default timeout: 300000ms

example call:

```ts
await workspace.mac.search({
  "pattern": "hello",
  "path": "/tmp"
});
```

example success envelope:

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

example error envelope:

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

### mac.write

write a non-repo file on the Mac

- signature: `workspace.mac.write({ path: string; content?: string; contentFile?: string; dryRun?: boolean; requestId?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>`
- wraps: `workspace mac.write`
- capabilities: readOnly=false, mutating=true, safeToRetry=false
- default timeout: 300000ms

example call:

```ts
await workspace.mac.write({
  "path": "/tmp/example.txt",
  "content": "hello",
  "dryRun": true
});
```

example success envelope:

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

example error envelope:

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

### aiReview

run the AI PR review helper

- signature: `workspace.aiReview({ pr?: number; noPost?: boolean; dryRun?: boolean; requestId?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>`
- wraps: `workspace aiReview`
- capabilities: readOnly=false, mutating=true, safeToRetry=false
- default timeout: 600000ms

example call:

```ts
await workspace.aiReview({
  "pr": 226,
  "noPost": true
});
```

example success envelope:

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

example error envelope:

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

### prReview

fetch review comments for a PR

- signature: `workspace.prReview({ pr?: number; stdout?: boolean; dryRun?: boolean; requestId?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>`
- wraps: `workspace prReview`
- capabilities: readOnly=true, mutating=false, safeToRetry=true
- default timeout: 120000ms

example call:

```ts
await workspace.prReview({
  "pr": 225,
  "stdout": true
});
```

example success envelope:

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

example error envelope:

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

### review.run

run the workspace review checks

- signature: `workspace.review.run({ branch: string; fix?: boolean; all?: boolean; base?: string; strict?: boolean; mine?: boolean; noTests?: boolean; requestId?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>`
- wraps: `workspace review.run`
- capabilities: readOnly=true, mutating=false, safeToRetry=false
- default timeout: 600000ms

example call:

```ts
await workspace.review.run({
  "branch": "task/workspace-agents/example",
  "noTests": true
});
```

example success envelope:

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

example error envelope:

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

### verify

run the full task safety gate

- recommended: always pass `branch` explicitly for deterministic verify stamps and branch-local execution.
- signature: `workspace.verify({ branch?: string; base?: string; noReview?: boolean; noDb?: boolean; dbWarnOnly?: boolean; noStamp?: boolean; dryRun?: boolean; requestId?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>`
- wraps: `workspace verify`
- capabilities: readOnly=false, mutating=true, safeToRetry=false
- default timeout: 600000ms

example call:

```ts
await workspace.verify({
  "branch": "task/workspace-agents/example",
  "noStamp": true,
  "dryRun": true
});
```

example success envelope:

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

example error envelope:

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

### sentry.config

show Sentry API configuration status from Keychain without exposing secrets

- signature: `workspace.sentry.config({ verify?: boolean; requestId?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>`
- wraps: `workspace sentry.config`
- capabilities: readOnly=true, mutating=false, safeToRetry=true
- default timeout: 60000ms

example call:

```ts
await workspace.sentry.config({
  "verify": true
});
```

example success envelope:

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

example error envelope:

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

### sentry.event

retrieve or resolve a Sentry event id, using a project slug when available

- signature: `workspace.sentry.event({ eventId: string; project?: string; requestId?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>`
- wraps: `workspace sentry.event`
- capabilities: readOnly=true, mutating=false, safeToRetry=true
- default timeout: 60000ms

example call:

```ts
await workspace.sentry.event({
  "eventId": "0123456789abcdef0123456789abcdef"
});
```

example success envelope:

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

example error envelope:

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

### sentry.issue

retrieve one Sentry issue by short id or numeric issue id

- signature: `workspace.sentry.issue({ identifier: string; expand?: string[]; requestId?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>`
- wraps: `workspace sentry.issue`
- capabilities: readOnly=true, mutating=false, safeToRetry=true
- default timeout: 60000ms

example call:

```ts
await workspace.sentry.issue({
  "identifier": "PROJECT-123"
});
```

example success envelope:

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

example error envelope:

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

### sentry.issueEvent

retrieve a latest, recommended, oldest, or concrete Sentry event for an issue

- signature: `workspace.sentry.issueEvent({ issueId: string; eventId?: string; full?: boolean; requestId?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>`
- wraps: `workspace sentry.issueEvent`
- capabilities: readOnly=true, mutating=false, safeToRetry=true
- default timeout: 60000ms

example call:

```ts
await workspace.sentry.issueEvent({
  "issueId": "PROJECT-123",
  "eventId": "recommended",
  "full": true
});
```

example success envelope:

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

example error envelope:

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

### sentry.issues

search Sentry issues across the configured organization

- signature: `workspace.sentry.issues({ query?: string; project?: string; environment?: string[]; sort?: string; statsPeriod?: string; start?: string; end?: string; cursor?: string; limit?: number; expand?: string[]; collapse?: string[]; requestId?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>`
- wraps: `workspace sentry.issues`
- capabilities: readOnly=true, mutating=false, safeToRetry=true
- default timeout: 60000ms

example call:

```ts
await workspace.sentry.issues({
  "query": "is:unresolved",
  "limit": 10
});
```

example success envelope:

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

example error envelope:

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

### sentry.projects

list Sentry projects for the configured organization

- signature: `workspace.sentry.projects({ limit?: number; cursor?: string; requestId?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>`
- wraps: `workspace sentry.projects`
- capabilities: readOnly=true, mutating=false, safeToRetry=true
- default timeout: 60000ms

example call:

```ts
await workspace.sentry.projects({
  "limit": 25
});
```

example success envelope:

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

example error envelope:

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

### sentry.trace

perform a best-effort Sentry trace lookup across organization events and issues

- signature: `workspace.sentry.trace({ traceId: string; project?: string; query?: string; statsPeriod?: string; dataset?: string; field?: string[]; cursor?: string; limit?: number; requestId?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>`
- wraps: `workspace sentry.trace`
- capabilities: readOnly=true, mutating=false, safeToRetry=true
- default timeout: 60000ms

example call:

```ts
await workspace.sentry.trace({
  "traceId": "0123456789abcdef0123456789abcdef",
  "limit": 10
});
```

example success envelope:

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

example error envelope:

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

### stream.context

show recent stream context

- signature: `workspace.stream.context({ area: string; stream?: string; repo?: string; dryRun?: boolean; requestId?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>`
- wraps: `workspace stream.context`
- capabilities: readOnly=true, mutating=false, safeToRetry=true
- default timeout: 120000ms

example call:

```ts
await workspace.stream.context({
  "area": "workspace-agents"
});
```

example success envelope:

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

example error envelope:

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

### stream.list

list stream branches

- signature: `workspace.stream.list({ repo?: string; requestId?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>`
- wraps: `workspace stream.list`
- capabilities: readOnly=true, mutating=false, safeToRetry=true
- default timeout: 120000ms

example call:

```ts
await workspace.stream.list({});
```

example success envelope:

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

example error envelope:

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

### stream.sync

sync a stream branch with main

- signature: `workspace.stream.sync({ area: string; stream?: string; repo?: string; dryRun?: boolean; requestId?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>`
- wraps: `workspace stream.sync`
- capabilities: readOnly=false, mutating=true, safeToRetry=false
- default timeout: 120000ms

example call:

```ts
await workspace.stream.sync({
  "area": "workspace-agents",
  "dryRun": true
});
```

example success envelope:

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

example error envelope:

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

### task.cleanup

preview or remove stale task worktrees and branches

- signature: `workspace.task.cleanup({ branch?: string; force?: boolean; preview?: boolean; merged?: boolean; staleDays?: number; keep?: string; dryRun?: boolean; requestId?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>`
- wraps: `workspace task.cleanup`
- capabilities: readOnly=false, mutating=true, safeToRetry=false
- default timeout: 120000ms

example call:

```ts
await workspace.task.cleanup({
  "branch": "task/workspace-agents/example",
  "preview": true,
  "dryRun": true
});
```

example success envelope:

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

example error envelope:

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

### task.current

resolve the current task branch without running a mutating command

- signature: `workspace.task.current({ requestId?: string; dryRun?: boolean }) => Promise<ToolResult<{ branch: string; area: string; prNumber?: number; worktree: string } | null>>`
- wraps: `branch resolver`
- capabilities: readOnly=true, mutating=false, safeToRetry=true
- default timeout: 30000ms

example call:

```ts
await workspace.task.current({});
```

example success envelope:

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

example error envelope:

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

### task.ensureSynced

check whether the task stream appears synced

- signature: `workspace.task.ensureSynced({ branch?: string; requestId?: string; dryRun?: boolean }) => Promise<ToolResult<{ synced: boolean; branch: string; area: string; behind?: number; action?: string }>>`
- wraps: `workspace task.ensureSynced`
- capabilities: readOnly=true, mutating=false, safeToRetry=true
- default timeout: 60000ms

example call:

```ts
await workspace.task.ensureSynced({
  "branch": "task/workspace-agents/example"
});
```

example success envelope:

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

example error envelope:

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

### task.exec

run a command inside a task worktree

- signature: `workspace.task.exec({ branch?: string; command: string[]; timeout?: number; dryRun?: boolean; requestId?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>`
- wraps: `workspace task.exec`
- capabilities: readOnly=false, mutating=true, safeToRetry=false
- default timeout: 300000ms

example call:

```ts
await workspace.task.exec({
  "branch": "task/workspace-agents/example",
  "command": [
    "git",
    "status",
    "--short"
  ],
  "dryRun": true
});
```

example success envelope:

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

example error envelope:

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

### task.finish

finish a task branch after merge

- signature: `workspace.task.finish({ branch?: string; requestId?: string; dryRun?: boolean }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>`
- wraps: `workspace task.finish`
- capabilities: readOnly=false, mutating=true, safeToRetry=false
- default timeout: 120000ms

example call:

```ts
await workspace.task.finish({
  "branch": "task/workspace-agents/example",
  "dryRun": true
});
```

example success envelope:

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

example error envelope:

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

### task.init

write task metadata for an existing worktree

- signature: `workspace.task.init({ area: string; branch: string; pr?: number; worktree?: string; dryRun?: boolean; requestId?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>`
- wraps: `workspace task.init`
- capabilities: readOnly=false, mutating=true, safeToRetry=false
- default timeout: 60000ms

example call:

```ts
await workspace.task.init({
  "area": "workspace-agents",
  "branch": "task/workspace-agents/example",
  "dryRun": true
});
```

example success envelope:

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

example error envelope:

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

### task.merge

merge a pull request through the workspace task merge script

- signature: `workspace.task.merge({ pr?: number; wait?: boolean; squash?: boolean; dryRun?: boolean; requestId?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>`
- wraps: `workspace task.merge`
- capabilities: readOnly=false, mutating=true, safeToRetry=false
- default timeout: 120000ms

example call:

```ts
await workspace.task.merge({
  "pr": 225,
  "dryRun": true
});
```

example success envelope:

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

example error envelope:

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

### task.pin

pin a task branch for a programmatic workspace client

- signature: `workspace.task.pin({ branch?: string; requestId?: string; dryRun?: boolean }) => Promise<ToolResult<{ branch: string }>>`
- wraps: `client session state`
- capabilities: readOnly=false, mutating=false, safeToRetry=true
- default timeout: 30000ms

example call:

```ts
await workspace.task.pin({
  "branch": "task/workspace-agents/example"
});
```

example success envelope:

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

example error envelope:

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

### task.pr

merge task to stream and create or refresh the stream review PR

- signature: `workspace.task.pr({ branch?: string; taskOnly?: boolean; draft?: boolean; ready?: boolean; bodyTemplate?: string; dryRun?: boolean; requestId?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>`
- wraps: `workspace task.pr`
- capabilities: readOnly=false, mutating=true, safeToRetry=false
- default timeout: 120000ms

example call:

```ts
await workspace.task.pr({
  "branch": "task/workspace-agents/example",
  "taskOnly": true,
  "dryRun": true
});
```

example success envelope:

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

example error envelope:

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

### task.prs

show task and review PR links

- signature: `workspace.task.prs({ branch?: string; requestId?: string; dryRun?: boolean }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>`
- wraps: `workspace task.prs`
- capabilities: readOnly=true, mutating=false, safeToRetry=true
- default timeout: 120000ms

example call:

```ts
await workspace.task.prs({
  "branch": "task/workspace-agents/example"
});
```

example success envelope:

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

example error envelope:

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

### task.push

push changed task files to the task branch through GitHub API

- signature: `workspace.task.push({ branch?: string; message: string; changed?: boolean; files?: string[]; noVerify?: boolean; dryRun?: boolean; requestId?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>`
- wraps: `workspace task.push`
- capabilities: readOnly=false, mutating=true, safeToRetry=false
- default timeout: 120000ms

example call:

```ts
await workspace.task.push({
  "branch": "task/workspace-agents/example",
  "message": "feat(workspace): example",
  "changed": true,
  "dryRun": true
});
```

example success envelope:

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

example error envelope:

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

### task.start

create a task branch, worktree, and draft PR

- signature: `workspace.task.start({ stream?: string; area?: string; title: string; description?: string; bodyFile?: string; startFrom?: "main" | "stream"; dryRun?: boolean; requestId?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>`
- wraps: `workspace task.start`
- capabilities: readOnly=false, mutating=true, safeToRetry=false
- default timeout: 60000ms

example call:

```ts
await workspace.task.start({
  "stream": "stream/workspace-agents",
  "title": "example task",
  "dryRun": true
});
```

example success envelope:

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

example error envelope:

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

### taskMeta.smoke

run the task metadata smoke suite

- signature: `workspace.taskMeta.smoke({ requestId?: string; dryRun?: boolean }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>`
- wraps: `workspace taskMeta.smoke`
- capabilities: readOnly=true, mutating=false, safeToRetry=true
- default timeout: 120000ms

example call:

```ts
await workspace.taskMeta.smoke({});
```

example success envelope:

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

example error envelope:

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

### browser

run the generic workspace browser wrapper command

- signature: `workspace.browser({ command?: string; url?: string; args?: string[]; dryRun?: boolean; requestId?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>`
- wraps: `workspace browser`
- capabilities: readOnly=false, mutating=true, safeToRetry=false
- default timeout: 300000ms

example call:

```ts
await workspace.browser({
  "command": "open",
  "url": "https://example.com",
  "dryRun": true
});
```

example success envelope:

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

example error envelope:

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

### browser.app

open app.consuelohq.com with the browser wrapper

- signature: `workspace.browser.app({ headed?: boolean; full?: boolean; dryRun?: boolean; requestId?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>`
- wraps: `workspace browser.app`
- capabilities: readOnly=false, mutating=true, safeToRetry=false
- default timeout: 300000ms

example call:

```ts
await workspace.browser.app({
  "dryRun": true
});
```

example success envelope:

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

example error envelope:

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

### browser.click

click a browser element by ref

- signature: `workspace.browser.click({ ref: string; dryRun?: boolean; requestId?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>`
- wraps: `workspace browser.click`
- capabilities: readOnly=false, mutating=true, safeToRetry=false
- default timeout: 300000ms

example call:

```ts
await workspace.browser.click({
  "ref": "@e1",
  "dryRun": true
});
```

example success envelope:

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

example error envelope:

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

### browser.close

close active browser sessions

- signature: `workspace.browser.close({ requestId?: string; dryRun?: boolean }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>`
- wraps: `workspace browser.close`
- capabilities: readOnly=false, mutating=true, safeToRetry=false
- default timeout: 300000ms

example call:

```ts
await workspace.browser.close({
  "dryRun": true
});
```

example success envelope:

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

example error envelope:

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

### browser.consuelo

open consuelo.consuelohq.com with the browser wrapper

- signature: `workspace.browser.consuelo({ headed?: boolean; full?: boolean; dryRun?: boolean; requestId?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>`
- wraps: `workspace browser.consuelo`
- capabilities: readOnly=false, mutating=true, safeToRetry=false
- default timeout: 300000ms

example call:

```ts
await workspace.browser.consuelo({
  "dryRun": true
});
```

example success envelope:

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

example error envelope:

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

### browser.eval

execute JavaScript on the current browser page

- signature: `workspace.browser.eval({ js: string; dryRun?: boolean; requestId?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>`
- wraps: `workspace browser.eval`
- capabilities: readOnly=false, mutating=true, safeToRetry=false
- default timeout: 300000ms

example call:

```ts
await workspace.browser.eval({
  "js": "document.title",
  "dryRun": true
});
```

example success envelope:

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

example error envelope:

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

### browser.fill

fill a browser input by ref

- signature: `workspace.browser.fill({ ref: string; text: string; dryRun?: boolean; requestId?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>`
- wraps: `workspace browser.fill`
- capabilities: readOnly=false, mutating=true, safeToRetry=false
- default timeout: 300000ms

example call:

```ts
await workspace.browser.fill({
  "ref": "@e1",
  "text": "hello",
  "dryRun": true
});
```

example success envelope:

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

example error envelope:

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

### browser.login

run a saved browser auth login profile

- signature: `workspace.browser.login({ name: string; headed?: boolean; dryRun?: boolean; requestId?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>`
- wraps: `workspace browser.login`
- capabilities: readOnly=false, mutating=true, safeToRetry=false
- default timeout: 300000ms

example call:

```ts
await workspace.browser.login({
  "name": "consuelo",
  "headed": true,
  "dryRun": true
});
```

example success envelope:

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

example error envelope:

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

### browser.open

open a URL with the browser wrapper

- signature: `workspace.browser.open({ url: string; headed?: boolean; full?: boolean; dryRun?: boolean; requestId?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>`
- wraps: `workspace browser.open`
- capabilities: readOnly=false, mutating=true, safeToRetry=false
- default timeout: 300000ms

example call:

```ts
await workspace.browser.open({
  "url": "https://example.com",
  "dryRun": true
});
```

example success envelope:

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

example error envelope:

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

### browser.raw

pass raw arguments through to agent-browser

- signature: `workspace.browser.raw({ args: string[]; dryRun?: boolean; requestId?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>`
- wraps: `workspace browser.raw`
- capabilities: readOnly=false, mutating=true, safeToRetry=false
- default timeout: 300000ms

example call:

```ts
await workspace.browser.raw({
  "args": [
    "auth",
    "list"
  ],
  "dryRun": true
});
```

example success envelope:

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

example error envelope:

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

### browser.reauth

restart the browser daemon and run a saved auth login profile

- signature: `workspace.browser.reauth({ name: string; headed?: boolean; dryRun?: boolean; requestId?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>`
- wraps: `workspace browser.reauth`
- capabilities: readOnly=false, mutating=true, safeToRetry=false
- default timeout: 300000ms

example call:

```ts
await workspace.browser.reauth({
  "name": "consuelo",
  "headed": true,
  "dryRun": true
});
```

example success envelope:

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

example error envelope:

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

### browser.screenshot

capture a browser screenshot

- signature: `workspace.browser.screenshot({ name?: string; full?: boolean; dryRun?: boolean; requestId?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>`
- wraps: `workspace browser.screenshot`
- capabilities: readOnly=false, mutating=true, safeToRetry=false
- default timeout: 300000ms

example call:

```ts
await workspace.browser.screenshot({
  "name": "after-login",
  "dryRun": true
});
```

example success envelope:

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

example error envelope:

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

### browser.snap

capture an accessibility snapshot

- signature: `workspace.browser.snap({ requestId?: string; dryRun?: boolean }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>`
- wraps: `workspace browser.snap`
- capabilities: readOnly=false, mutating=true, safeToRetry=false
- default timeout: 300000ms

example call:

```ts
await workspace.browser.snap({
  "dryRun": true
});
```

example success envelope:

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

example error envelope:

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

### browser.test

open a URL, wait for load, snapshot, and screenshot

- signature: `workspace.browser.test({ url: string; headed?: boolean; full?: boolean; dryRun?: boolean; requestId?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>`
- wraps: `workspace browser.test`
- capabilities: readOnly=false, mutating=true, safeToRetry=false
- default timeout: 300000ms

example call:

```ts
await workspace.browser.test({
  "url": "https://example.com",
  "dryRun": true
});
```

example success envelope:

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

example error envelope:

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

### doctor

run workspace diagnostics

- signature: `workspace.doctor({ requestId?: string; dryRun?: boolean }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>`
- wraps: `workspace doctor`
- capabilities: readOnly=true, mutating=false, safeToRetry=true
- default timeout: 120000ms

example call:

```ts
await workspace.doctor({});
```

example success envelope:

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

example error envelope:

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

### railway.logs

read Railway deploy/runtime logs through the workspace script

- signature: `workspace.railway.logs({ service?: string; build?: boolean; errors?: boolean; network?: boolean; raw?: boolean; status?: boolean; filter?: string; lines?: number; requestId?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>`
- wraps: `workspace railway.logs`
- capabilities: readOnly=true, mutating=false, safeToRetry=true
- default timeout: 60000ms

example call:

```ts
await workspace.railway.logs({
  "service": "opensaas",
  "lines": 10
});
```

example success envelope:

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

example error envelope:

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

### railway.redeploy

trigger a Railway redeploy

- signature: `workspace.railway.redeploy({ service?: string; all?: boolean; wait?: boolean; dryRun?: boolean; requestId?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>`
- wraps: `workspace railway.redeploy`
- capabilities: readOnly=false, mutating=true, safeToRetry=false
- default timeout: 600000ms

example call:

```ts
await workspace.railway.redeploy({
  "service": "opensaas",
  "dryRun": true
});
```

example success envelope:

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

example error envelope:

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

### server

manage the workspace MCP server

- signature: `workspace.server({ action: "status" | "restart" | "stop" | "start" | "logs"; dryRun?: boolean; requestId?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>`
- wraps: `workspace server`
- capabilities: readOnly=false, mutating=true, safeToRetry=false
- default timeout: 120000ms

example call:

```ts
await workspace.server({
  "action": "status"
});
```

example success envelope:

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

example error envelope:

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

### status

show compact workspace status

- signature: `workspace.status({ requestId?: string; dryRun?: boolean }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>`
- wraps: `workspace status`
- capabilities: readOnly=true, mutating=false, safeToRetry=true
- default timeout: 120000ms

example call:

```ts
await workspace.status({});
```

example success envelope:

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

example error envelope:

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

### tmp

run the workspace temp-file helper

- signature: `workspace.tmp({ action: string; name?: string; content?: string; ext?: string; dryRun?: boolean; requestId?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>`
- wraps: `workspace tmp`
- capabilities: readOnly=false, mutating=true, safeToRetry=false
- default timeout: 60000ms

example call:

```ts
await workspace.tmp({
  "action": "write",
  "name": "example",
  "content": "hello",
  "dryRun": true
});
```

example success envelope:

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

example error envelope:

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

### wait

sleep or wait for a PR/deploy

- signature: `workspace.wait({ seconds?: number; deploy?: boolean; pr?: number; requestId?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>`
- wraps: `workspace wait`
- capabilities: readOnly=true, mutating=false, safeToRetry=true
- default timeout: 300000ms

example call:

```ts
await workspace.wait({
  "seconds": 1
});
```

example success envelope:

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

example error envelope:

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

### website.deploy

deploy the Consuelo website

- signature: `workspace.website.deploy({ preview?: boolean; buildOnly?: boolean; dryRun?: boolean; requestId?: string }) => Promise<ToolResult<{ raw?: string; [key: string]: unknown } | null>>`
- wraps: `workspace website.deploy`
- capabilities: readOnly=false, mutating=true, safeToRetry=false
- default timeout: 600000ms

example call:

```ts
await workspace.website.deploy({
  "buildOnly": true,
  "dryRun": true
});
```

example success envelope:

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

example error envelope:

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

## composed methods

`workspace.checkFiles` wraps `bun run check-files`. `workspace.editFlow` wraps `bun run edit-flow`. Both are real scripts; the facade does not duplicate their multi-step behavior.

## batch execution

Use `workspace.batch([...])` for dependent steps. Each step accepts `input`; `args` remains a compatibility alias and can be a function receiving the previous result. Read-only steps can set `parallel: true`; mutating steps are always sequential.

## branch resolution

Branch resolution order is: explicit `branch`, pinned branch from `workspace.task.pin`, `TASK_BRANCH`, validated `.task/current.json`, exactly one active task worktree, then deterministic failure.

## dry-run

Mutating tools accept `dryRun: true`. The facade validates input, resolves branch state, builds the command, returns code `DRY_RUN`, and does not execute the mutation.

## error codes

`OK`, `VALIDATION_ERROR`, `AMBIGUOUS_TASK_SELECTION`, `WORKTREE_NOT_FOUND`, `COMMAND_FAILED`, `TIMEOUT`, `PARSE_ERROR`, `NOT_FOUND`, `DRY_RUN`.

## tracing

Every result includes `traceId`, optional echoed `requestId`, `durationMs`, `exitCode`, and `apiVersion`. The executor emits one `tool.executed` JSON event to stderr.

## mac operations

`workspace.mac.*` methods wrap `bun run mac` and operate outside the repository. They never perform task branch resolution.

## decision engine walkthrough

The decision engine wrappers call the existing scripts as-is: `workspace.explore`, `workspace.decideNext`, `workspace.confidenceScore`, and `workspace.exploit`. Retrieval is treated as a prior; confidence comes from evidence written by those scripts.

## migration from lower-level scripts

Do not call lower-level workspace scripts from the workspace app during normal work.

Use the facade command instead: `workspace.sandbox_exec({ command: "workspace fs.read '{\"branch\":\"task/x\",\"path\":\"packages/workspace/package.json\"}'", timeout: 120 })`.

## final reminder

Every workspace operation above is invoked through `workspace.sandbox_exec({ command, timeout })`. There are no per-operation MCP tools beyond `get_steering` and `sandbox_exec`. The command string should use `workspace <tool.name> '<json-input>'`; omit the JSON input only when the tool accepts an empty object. The workspace app is the environment, so work inside it and fix any command that does not run there.

