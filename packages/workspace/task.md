# Ko must explicitly provide or approve the stream before task work begins.

If no stream or area was provided, stop and ask. You may suggest likely streams, but never choose one silently.

Default only when already established by Ko or steering:

```text
stream/workspace-agents
```

## Whole Task Flow

This skill owns the complete task lifecycle:

```text
start → work → publish → clean up
```

`task.pr` must promote the task into the stream and return the stream review PR unless Ko explicitly asks for task-only mode.

Canonical flow:

```text
stream.context → task.start → scoped workpad + test-first contract → decision-engine research → focused red test or no-test waiver → implementation → focused green test → validation / verify → task.push → task.pr → stream review PR → task.finish
```
For non-trivial code changes, implementation must not begin until the scoped workpad contains a Test-first contract and either:

a focused test has been written or updated and run red, or
a no-test waiver explains why no test is appropriate and what validation replaces it.

## Workspace Tool Surface

The workspace app exposes exactly two MCP tools:

```ts
workspace.get_steering()
workspace.call({ tool, input, taskSession, timeout })
```

Normal non-task calls must use the typed facade shape:

```ts
await workspace.call({
  tool: "stream.context",
  input: { area: "<area>" },
  timeout: 120,
})
```

For task-scoped work, `task.start` returns `data.taskSession`.

Treat that exact value as the task handle for the rest of the task:

```ts
const taskSession = result.data.taskSession
```

Pass `taskSession` at the top level of every task-scoped `workspace.call`:

```ts
await workspace.call({
  tool: "fs.read",
  taskSession,
  input: { path: "AGENTS.md" },
  timeout: 120,
})

await workspace.call({
  tool: "status",
  taskSession,
  input: {},
  timeout: 120,
})
```

Do not rely on:

- `task.pin`
- root `.task/current.json`
- current branch
- ambient task selection

Those are not the task source of truth.

Do not normally put `taskSession` inside `input`.

The server propagates the top-level `taskSession` into the facade. `input.taskSession` exists only for compatibility and must match the top-level value if both are present.

Branch names still matter for GitHub, PRs, logs, and debugging. Normal workspace calls should be task-session scoped instead of branch-threaded.

---

# Phase 1 — Orient in the Stream

Run stream context before starting task work:

```ts
await workspace.call({
  tool: "stream.context",
  input: { area: "<area>" },
  timeout: 120,
})
```

Use `stream.list` first only when the correct stream area is unknown:

```ts
await workspace.call({
  tool: "stream.list",
  input: {},
  timeout: 120,
})
```

Confirm these before starting:

- stream branch
- current open task PRs
- recent stream commits
- current worktrees
- stream ahead/behind state
- any obvious active work that could conflict

Stop and ask Ko when the correct stream is ambiguous.

---

# Phase 2 — Create the Task

Create one focused task branch:

```ts
await workspace.call({
  tool: "task.start",
  input: {
    area: "<area>",
    title: "<task title>",
    startFrom: "main",
  },
  timeout: 120,
})
```

Use `startFrom: "stream"` only when Ko explicitly says the task should stack on current stream work, or when the task is a direct follow-up to unshipped stream changes.

Capture these fields from the result:

- `data.taskSession`
- `data.branch` or `data.taskBranch`
- `data.worktreePath`
- `data.prUrl`

Use `taskSession` for later task-scoped calls:

```ts
await workspace.call({
  tool: "fs.read",
  taskSession,
  input: { path: "AGENTS.md" },
  timeout: 120,
})

await workspace.call({
  tool: "status",
  taskSession,
  input: {},
  timeout: 120,
})
```

Use GitHub or `task.pr` results to inspect PR state.

Use `task.prs` only if that tool is present in the current manifest.

For diffs, use the workspace/GitHub tool surface where available. Only fall back to `code.call` for `git diff` when there is not yet a typed tool that exposes the exact local diff you need.

Task Session Handling — Canonical Task Context
taskSession is the canonical handle for task-scoped work.
When task.start returns:
const taskSession = result.data.taskSession
Every task-scoped call must pass that value at the top level:
await workspace.call({
  tool: "fs.read",
  taskSession,
  input: {
    path: "packages/workspace/server.py",
    from: 1,
    to: 80,
  },
  timeout: 120,
})
Correct task-scoped command execution uses code.call, not code.call, code.call, raw shell, or host escape hatches:
await workspace.call({
  tool: "code.call",
  taskSession,
  input: {
    language: "bash",
    mode: "verify",
    code: "bun --cwd packages/workspace test",
    maxResultChars: 20000,
  },
  timeout: 360,
})
Use code.call for focused command execution in the task worktree:
package tests
package build commands
typechecks
syntax checks
codegen commands
small diagnostic commands
language-specific validation commands
Do not use code.call for normal command execution. If either appears in an old workpad, handoff, or copied example, treat it as legacy guidance and translate it to code.call.
Avoid this legacy shape:
await workspace.call({
  tool: "code.call",
  taskSession,
  input: {
    command: ["bun", "--cwd", "packages/workspace", "test"],
  },
  timeout: 360,
})
Use this instead:
await workspace.call({
  tool: "code.call",
  taskSession,
  input: {
    language: "bash",
    mode: "verify",
    code: "bun --cwd packages/workspace test",
    maxResultChars: 20000,
  },
  timeout: 360,
})
Do not normally put taskSession inside input.
The server propagates the top-level taskSession into the facade. input.taskSession exists only for compatibility and must match the top-level value if both are present.
Never pass conflicting task sessions:
await workspace.call({
  tool: "fs.read",
  taskSession: "tsk_outer",
  input: {
    taskSession: "tsk_inner",
    path: "AGENTS.md",
  },
})
That should return VALIDATION_ERROR.
If a task-scoped call returns TASK_SESSION_REQUIRED or TASK_SESSION_NOT_FOUND, first check that the exact taskSession returned by task.start was passed at the top level. Do not switch to branch-threading, root task metadata, code.call, code.call, or host shell fallback as the default recovery path.
Inside code.run and batch, pass taskSession on the outer workspace.call. Nested workspace.* calls inherit task context.


## Non-Negotiable: Scoped Workpad Writes

Every task must keep its task-local scoped workpad current enough for another agent to continue without chat history.

The workpad is the durable task record. Chat, terminal output, traces, and memory are supporting evidence; the scoped workpad is where the task’s current truth belongs.

The active task workpad lives at:

```text
.task/<area>/<task-slug>/workpad.md
```

Example:

```text
.task/workspace-agents/fix-top-level-task-session-propagation/workpad.md
```

Agents must update the workpad at these checkpoints:

1. Immediately after `task.start`
   - acceptance criteria
   - plan
   - initial assumptions
   - `Test-first contract` stub

2. Before any meaningful production code edit
   - behavior under test
   - existing local test pattern to follow
   - new or changed tests
   - focused red command
   - expected red failure
   - no-test waiver, only when genuinely appropriate

3. After the focused red run
   - red command
   - red result
   - meaningful failure signal

4. Before `task.push`, `task.pr`, or `task.finish`
   - final summary
   - files changed
   - key decisions
   - green evidence
   - broader validation evidence
   - issues encountered

Workspace-owned workpad sections may auto-populate read files, changed files, red/green TDD evidence, test selection, activity, and validation output. Agent-owned sections still must explain intent, behavior, local pattern, and any waiver.


Also update the workpad whenever the task meaningfully changes:

- a blocker appears
- the plan changes
- context reveals prior decisions
- validation fails
- metadata conflicts appear
- a tooling gap is discovered

Never delete useful prior workpad notes while updating it. The workpad is what Ko reviews first; it is a signal of task quality.

Do not publish a task unless the scoped workpad reflects the current task state.

If the task-local scoped workpad is missing, create it before continuing. If task metadata points to the wrong task, repair or explicitly select the correct task-local workpad before continuing.


## Temporary and Smoke-Test Task PRs

Temporary validation tasks must be obvious from the title, branch, and PR.

Use this naming format:

```text
tmp(<stream-area>): <purpose>
```

Examples:

```text
tmp(workspace-agents): smoke test code.run workspace namespace
tmp(os): explore codebase for OS landing page direction
```

Temporary task branches should use matching slugs:

```text
task/<area>/tmp-<purpose>
```

Temporary PRs must be closed or cleaned up after the evidence is captured unless Ko explicitly wants them preserved.

Before ending a temporary task, report:

- temporary task PR link
- whether it was closed, merged, or intentionally left open
- reason if left open
- any cleanup that remains

A temporary task PR should never be confused with the stream review PR. The final user-facing review link is still the stream PR unless Ko asks for the temporary PR.

Example rename:

```text
Final-smoke-test.run workspace-call
→ tmp(workspace-agents): final smoke test.run workspace call
```

---

# Phase 3 — Research Through the Decision Engine and Context

Use the decision engine and project context before direct symbol hunting, and return to them whenever new uncertainty appears.

Context and exploration are not one-time kickoff steps; they are tools for staying aligned throughout the task.

```ts
await workspace.call({
  tool: "context.search",
  input: { keyword: "<feature or behavior>", limit: 5 },
  timeout: 120,
})

await workspace.call({
  tool: "context.search",
  input: { keyword: "typed workspace facade", limit: 5 },
  timeout: 120,
})

await workspace.call({
  tool: "context.search",
  input: { keyword: "workspace scripts docs", limit: 5 },
  timeout: 120,
})

await workspace.call({
  tool: "explore",
  input: {
    query: "<feature or behavior> workspace facade script manifest docs tests",
    limit: 8,
  },
  timeout: 120,
})
```

Ask for the next best action:

```ts
await workspace.call({
  tool: "decideNext",
  input: {},
  timeout: 120,
})
```

Read recommended files through task-scoped file tools:

```ts
await workspace.call({
  tool: "fs.read",
  taskSession,
  input: { path: "<recommended-file>" },
  timeout: 120,
})
```

Then rerun the loop:

```ts
await workspace.call({
  tool: "decideNext",
  input: {},
  timeout: 120,
})

await workspace.call({
  tool: "confidenceScore",
  input: {},
  timeout: 120,
})
```

Repeat until the implementation path is supported by evidence.

Use `exploit` when the path is clear enough to commit to an editing target:

```ts
await workspace.call({
  tool: "exploit",
  input: {},
  timeout: 120,
})
```

Use targeted `fs.search` only after the decision engine has narrowed the direction:

```ts
await workspace.call({
  tool: "fs.search",
  taskSession,
  input: {
    pattern: "<symbol-or-string>",
    paths: ["<path>"],
    maxResults: 80,
  },
  timeout: 120,
})
```

## Confidence Guidance

| Score | Action |
| --- | --- |
| `< 0.55` | Continue evidence gathering |
| `0.55–0.75` | Read at least one more high-value implementation file or test |
| `>= 0.75` | Proceed when acceptance criteria and edit target are clear |

Confidence comes from evidence, not from the first explore result.

## Context Is a Live Memory Layer

Use `context.search` throughout the task, not only at kickoff.

The workspace context store contains prior handoffs, workpads, task notes, decisions, failures, and session memory. Treat it as project memory.

It often explains:

- why a workflow exists
- why a previous agent chose a path
- which failures already happened

Use context before and during:

- task kickoff
- planning
- implementation when a pattern seems non-obvious
- validation failures
- repeated tool failures
- merge or metadata conflicts
- surprising test behavior
- production/debugging investigations
- final handoff or workpad writing

Use it mid-task when:

- a tool fails in a surprising way
- tests fail for unclear reasons
- the code disagrees with the plan
- an old handoff gives shell commands
- a branch or PR state looks stale
- another agent’s work appears nearby
- a repeated workaround starts to look like a missing tool

Default context loop:

```ts
await workspace.call({
  tool: "context.search",
  input: {
    keyword: "<feature-or-failure-keyword>",
    limit: 5,
  },
  timeout: 120,
})
```

Then read the relevant result.

Use the returned `context.search` results directly when they contain enough detail. If the result points to a handoff, workpad, or file, read that source through the matching typed workspace tool.

Use short, strong keywords instead of long sentence searches.

Good keywords:

```text
code.run
task metadata
stream sync
Graphite PR
dialer queue
Railway deploy
workspace facade
raw shell
```

Avoid treating context retrieval as proof. Context gives prior decisions and history. Verify current truth against files, tests, logs, PR state, or runtime behavior.

If context contradicts current code, current code and runtime evidence win. Record the contradiction in the workpad when it matters.

Mental model for agents:

- `explore` finds where to look in the repo.
- `context.search` finds what the team already learned.
- `fs.read` verifies what the code says now.
- tests/logs/runtime prove what actually happens.

---

# Phase 4 — Use `code.run` for Semantic Workspace Workflows

Use `code.run` as the default tool for semantic workspace work: one task that requires several related workspace operations.

A semantic workflow is work where the next step depends on what the previous step found, or where the result needs to be summarized before deciding what to do next.

Use `code.run` for:

- investigate a failure
- search → read → decide
- read → edit → reread
- edit → validate
- inspect task/PR state and explain what remains
- run a focused validation and return only the important output
- coordinate several typed workspace tools in one pass
- avoid long shell strings, heredocs, and repeated tool-call chatter

Inside `code.run`, prefer the typed `workspace.*` helper surface.

Pass `taskSession` on the outer `workspace.call`; nested calls inherit the task context.

```ts
await workspace.call({
  tool: "code.run",
  taskSession,
  input: {
    mode: "read",
    maxOperations: 25,
    maxResultChars: 20000,
    code: `
      const status = await workspace.status({});
      const context = await workspace.context.search({
        keyword: "workspace facade",
        limit: 5
      });
      const docs = await workspace.fs.read({
        path: "packages/workspace/SCRIPTS.md",
        from: 1,
        to: 80
      });
      return {
        statusOk: status.ok,
        contextCount: Array.isArray(context.data) ? context.data.length : 0,
        docsOk: docs.ok,
        next: "Use context results and file evidence before editing."
      };
    `,
  },
  timeout: 180,
})
```

Use:

- `mode: "read"` for investigation
- `mode: "edit"` when writes may happen
- `mode: "verify"` for validation orchestration

For edits, keep the same pattern: call typed tools, reread the changed range, and return a compact summary.

```ts
await workspace.call({
  tool: "code.run",
  taskSession,
  input: {
    mode: "edit",
    maxOperations: 40,
    maxResultChars: 20000,
    code: `
      const before = await workspace.fs.read({
        path: "packages/workspace/SCRIPTS.md",
        from: 1,
        to: 40
      });
      const patch = await workspace.fs.patch({
        path: "packages/workspace/SCRIPTS.md",
        from: 12,
        to: 18,
        contentFile: "/tmp/replacement.md"
      });
      const after = await workspace.fs.read({
        path: "packages/workspace/SCRIPTS.md",
        from: 1,
        to: 40
      });
      return {
        beforeOk: before.ok,
        patchOk: patch.ok,
        afterOk: after.ok,
        changed: patch.ok
      };
    `,
  },
  timeout: 300,
})
```

`code.run` is a composer, not a policy bypass. It must use the same typed workspace tools the agent would call directly.

The underlying tools still own:

- schemas
- task scoping
- branch/worktree routing
- durable-action boundaries
- trace IDs
- review gates

Do not use `code.run` for final durable transitions such as:

- `task.push`
- `task.pr`
- stream merges
- deploys
- publishing
- destructive cleanup

Run those as direct outer `workspace.call` operations so the state transition is visible.

Phase 4a — Use code.call for Bounded Command Execution
Use code.call when the job is to run one focused Python, Bun/JavaScript/TypeScript, or Bash program with bounded output.
code.call is the normal command surface for:
package scripts
focused tests
build checks
typechecks
syntax checks
codegen commands
small one-off runtime checks
language-specific validation commands
Use the most specific language for the job. Do not default to Bash just to invoke another runtime.
Job
Preferred code.call language
Python diagnostics, Python syntax checks, Python scripts
python
JS/TS/Bun diagnostics, package-command orchestration, JSON/result shaping
bun
Shell-specific commands, pipes, redirects, env expansion, short shell passthrough
bash

Use code.run when the job is programmable orchestration over workspace tools. Use code.call when the job is command execution or runtime execution.
Authority modes
Mode
Use
Task session requirement
Mutation policy
read
non-mutating diagnostics, short scripts, environment inspection
optional
must not intentionally mutate files
verify
tests, builds, typechecks, syntax checks, validation commands
required for task-branch validation
should not intentionally edit source
edit
commands that may create, update, generate, format, or rewrite files
required
mutation allowed only inside the managed task worktree

Do not treat taskSession as required for every code.call. It is required when the command needs the task branch filesystem or mutation authority. For ordinary non-mutating diagnostics, use mode: "read" without taskSession instead of falling back to host shell tools.
Good code.call examples
Non-mutating Python diagnostic, no task worktree required:
await workspace.call({
  tool: "code.call",
  input: {
    language: "python",
    mode: "read",
    code: "import platform, sys\nprint(platform.platform())\nprint(sys.version)",
    maxResultChars: 20000,
  },
  timeout: 120,
})

Non-mutating Bun diagnostic, no task worktree required:
await workspace.call({
  tool: "code.call",
  input: {
    language: "bun",
    mode: "read",
    code: "console.log(JSON.stringify({ bun: Bun.version, cwd: process.cwd() }, null, 2))",
    maxResultChars: 20000,
  },
  timeout: 120,
})

Python syntax validation in the task worktree:
await workspace.call({
  tool: "code.call",
  taskSession,
  input: {
    language: "python",
    mode: "verify",
    code: `
import py_compile

files = ["packages/workspace/scripts/example.py"]
failures = []

for file in files:
    try:
        py_compile.compile(file, doraise=True)
    except Exception as error:
        failures.append({"file": file, "error": str(error)})

print({"ok": len(failures) == 0, "failures": failures})
raise SystemExit(1 if failures else 0)
`.trim(),
    maxResultChars: 20000,
  },
  timeout: 300,
})

Focused red or green package test in the task worktree:
await workspace.call({
  tool: "code.call",
  taskSession,
  input: {
    language: "bun",
    mode: "verify",
    code: `
const proc = Bun.spawnSync({
  cmd: ["bun", "--cwd", "packages/workspace", "test", "tests/facade/facade.test.ts"],
  stdout: "pipe",
  stderr: "pipe",
})

const stdout = new TextDecoder().decode(proc.stdout)
const stderr = new TextDecoder().decode(proc.stderr)

console.log(JSON.stringify({
  ok: proc.exitCode === 0,
  exitCode: proc.exitCode,
  stdout: stdout.slice(-12000),
  stderr: stderr.slice(-12000),
}, null, 2))

process.exit(proc.exitCode)
`.trim(),
    maxResultChars: 30000,
  },
  timeout: 600,
})

OS package validation bundle with compact output:
await workspace.call({
  tool: "code.call",
  taskSession,
  input: {
    language: "bun",
    mode: "verify",
    code: `
const commands = [
  ["bun", "--cwd", "packages/os", "test", "tests/fs-read.test.ts"],
  ["bun", "--cwd", "packages/os", "test", "tests/tool-manifest.test.ts"],
]

function run(cmd) {
  const proc = Bun.spawnSync({
    cmd,
    stdout: "pipe",
    stderr: "pipe",
  })

  const stdout = new TextDecoder().decode(proc.stdout)
  const stderr = new TextDecoder().decode(proc.stderr)

  return {
    command: cmd.join(" "),
    ok: proc.exitCode === 0,
    exitCode: proc.exitCode,
    stdout: stdout.slice(-8000),
    stderr: stderr.slice(-8000),
  }
}

const results = commands.map(run)
const failed = results.filter((result) => !result.ok)

console.log(JSON.stringify({
  ok: failed.length === 0,
  failed,
  results,
}, null, 2))

process.exit(failed.length === 0 ? 0 : 1)
`.trim(),
    maxResultChars: 40000,
  },
  timeout: 900,
})

Generated surface command that intentionally updates files:
await workspace.call({
  tool: "code.call",
  taskSession,
  input: {
    language: "bun",
    mode: "edit",
    code: `
const commands = [
  ["bun", "run", "--cwd", "packages/os", "generate-types"],
  ["bun", "run", "--cwd", "packages/os", "generate-docs"],
]

for (const cmd of commands) {
  const proc = Bun.spawnSync({
    cmd,
    stdout: "pipe",
    stderr: "pipe",
  })

  const stdout = new TextDecoder().decode(proc.stdout)
  const stderr = new TextDecoder().decode(proc.stderr)

  console.log(JSON.stringify({
    command: cmd.join(" "),
    exitCode: proc.exitCode,
    stdout: stdout.slice(-6000),
    stderr: stderr.slice(-6000),
  }, null, 2))

  if (proc.exitCode !== 0) process.exit(proc.exitCode)
}
`.trim(),
    maxResultChars: 30000,
  },
  timeout: 600,
})

Use Bash only when the task is genuinely shell-shaped:
await workspace.call({
  tool: "code.call",
  taskSession,
  input: {
    language: "bash",
    mode: "verify",
    code: "set -euo pipefail\nprintf 'node: '; node --version\nprintf 'bun: '; bun --version",
    maxResultChars: 12000,
  },
  timeout: 120,
})

Language selection rules
Prefer language: "python" when the body is Python.
Prefer language: "bun" when the body is JavaScript/TypeScript, when you need structured JSON summaries, or when you need to run package commands with argv arrays through Bun.spawnSync.
Prefer language: "bash" only when shell semantics are the point:
pipes
redirects
shell builtins
env expansion
short command passthrough
set -euo pipefail style smoke checks
Do not use language: "bash" just to call python3 or bun when the same work can be expressed as a Python or Bun program.
Keep code.call focused
Prefer:
one command intent per call
bounded output through maxResultChars
direct runtime programs instead of shell wrappers
argv arrays through Bun when running package commands
compact JSON summaries for multi-command validation
Avoid:
long shell scripts with unrelated steps
bash -lc wrappers
cd <path> && ... when package flags or cwd routing can be used
heredoc file writes
giant inline JSON, Markdown, source code, or patch payloads
destructive commands such as rm, git reset, git clean, broad kill, or pkill
raw repo reads through cat, sed, head, or tail
raw repo search through rg, grep, or find
GitHub state through gh
Linear, Railway, browser, Sentry, or production state through raw CLIs
Large source, Markdown, JSON, scripts, and patches should travel through typed file transport: fs.write, fs.patch, contentFile, explicit stdin support, or the closest typed workspace tool. Do not bury structured payloads inside shell strings.



## Phase 4b — Use `batch` Only for Fixed Independent Lists

Use `batch` when the steps are already known and do not require reasoning between results.

Good `batch` uses:

- read several known files
- run several read-only inspections
- collect status + doctor + context output
- execute a fixed mechanical checklist where later steps do not depend on earlier outputs

Use `code.run` instead when:

- later steps depend on earlier results
- output needs trimming or summarizing
- the workflow needs branching logic
- a failure should change what happens next
- edits and rereads happen together

Current `batch` shape:

```ts
await workspace.call({
  tool: "batch",
  taskSession,
  input: {
    steps: [
      {
        tool: "status",
        input: {},
        parallel: true,
      },
      {
        tool: "fs.read",
        input: { path: "AGENTS.md" },
        parallel: true,
      },
      {
        tool: "fs.read",
        input: { path: "CODING-STANDARDS.md" },
        parallel: true,
      },
      {
        tool: "context.search",
        input: {
          keyword: "workspace facade",
          limit: 5,
        },
        parallel: true,
      },
    ],
  },
  timeout: 300,
})
```

When using `batch`, pass `taskSession` on the outer `workspace.call`. Child steps inherit task context.

Do not pass raw branch state unless debugging task-session routing.

Batch must preserve guardrails. The server recursively inspects child steps before execution.

---

Phase 5 — Implement With Typed Tools First
Make changes only inside the task worktree. Prefer typed workspace tools, code.run, and code.call over raw shell commands.
Tool preference order:
context.search,  context.trace & explore for discovery and prior context.
code.run for semantic workflows that compose multiple typed tools.
fs.read, fs.search, fs.list, fs.apply_patch, fs.write, and fs.trash for exact file work.
batch for independent read-only calls or fixed mechanical checklists.
git.diff for structured diff inspection after edits.
code.call for focused package/test/build/typecheck/codegen/syntax commands and small diagnostics.
status, audit, review.run, verify, task.push, task.pr, and task.merge for known lifecycle workflows.
github for GitHub/PR state.
Host or raw-shell fallback only when no typed workspace surface can safely express the operation; record the tooling gap.
Do not use code.call for normal command execution. Translate old examples to code.call.
Keep the scoped workpad current:
acceptance criteria
implementation plan
files changed
key decisions
notes for Ko
improvements noticed
errors or blockers
validation commands and results
context searched and relevant prior handoffs/workpads found
Use the workspace as an evidence machine:
search context before guessing about prior decisions
use explore before broad file search
read relevant policy/control files fully
use decideNext when the next step is unclear
patch only after the edit target is supported by evidence
reread changed ranges after writing
run the smallest meaningful test first
run review/verify gates as appropriate
record surprising failures in the workpad
After edits, inspect the diff through git.diff.
Use summary-first diff inspection:
await workspace.call({
  tool: "git.diff",
  taskSession,
  input: {
    stat: true,
    files: true,
    hunks: true,
    maxBytes: 20000,
  },
  timeout: 120,
})
When reviewing against a base branch, include base:
await workspace.call({
  tool: "git.diff",
  taskSession,
  input: {
    base: "origin/stream/<area>",
    stat: true,
    files: true,
    hunks: true,
    maxBytes: 20000,
  },
  timeout: 120,
})
Request patch: true only when the actual changed lines are needed:
await workspace.call({
  tool: "git.diff",
  taskSession,
  input: {
    base: "origin/stream/<area>",
    patch: true,
    maxBytes: 20000,
  },
  timeout: 120,
})
Do not use raw git diff through command execution unless git.diff cannot express the needed view. Repeated fallback diff usage is a tooling gap.
For detailed diff review, prefer bounded output. Do not return giant diffs into chat.


## Dev Tooling First for Service-Backed Workflows

When a task needs local infrastructure, prefer the dev workspace tool surface instead of hand-written setup.

Use dev for:

- starting/stopping Postgres and Redis
- verifying `pgvector` or required extensions
- exporting Keychain-backed credentials into the server process
- starting app services with the correct env
- starting public tunnels for webhooks/callbacks
- checking public callback reachability
- running scenario modes
- inspecting Redis locks safely
- collecting transcripts and runtime logs

Agents should not print secrets, full phone numbers, or raw tokens. Verification output should use presence checks, counts, suffixes, or redacted values.

If dev setup fails, fix the setup problem when it is in scope. If it requires Ko input, stop and ask with the exact missing item.

Use the closest typed workspace tool before considering manual setup. Do not silently fall back to a weaker test and claim behavior is proven.

---

Phase 6 — Validate Before Publishing
Run validation that matches the change.
Prefer the most specific typed workspace validation surface first. Use code.call only when the validation is genuinely command/runtime execution.
For syntax-level JS/TS/Python changes, prefer the dedicated checker when available:
await workspace.call({
  tool: "checkFiles",
  taskSession,
  input: {
    files: ["packages/workspace/scripts/task-start.js"],
    stopOnFirstError: true,
  },
  timeout: 300,
})

Use code.call for focused language/package validation when there is no more specific typed validation tool.
Choose the runtime directly:
Validation need
Preferred code.call language
Python syntax checks or Python validation scripts
python
Bun/JS/TS package tests, package scripts, typechecks, codegen orchestration, compact JSON summaries
bun
Shell-specific validation using pipes, redirects, env expansion, or shell builtins
bash

Do not use language: "bash" just to run python3 or bun. Use the Python or Bun runtime directly unless shell semantics are the point.
Python syntax validation
Use language: "python" for Python syntax checks:
await workspace.call({
  tool: "code.call",
  taskSession,
  input: {
    language: "python",
    mode: "verify",
    code: `
import py_compile
import sys

files = ["<file.py>"]
failures = []

for file in files:
    try:
        py_compile.compile(file, doraise=True)
    except Exception as error:
        failures.append({
            "file": file,
            "error": str(error),
        })

print({
    "ok": len(failures) == 0,
    "failures": failures,
})

sys.exit(1 if failures else 0)
`.trim(),
    maxResultChars: 20000,
  },
  timeout: 120,
})

For several Python files, add them to the files array. Do not shell out to python3 -m py_compile from Bash unless language: "python" cannot express the check.
Focused red test
Use language: "bun" for package test commands. Run the command with Bun.spawnSync so arguments stay structured and output is bounded.
await workspace.call({
  tool: "code.call",
  taskSession,
  input: {
    language: "bun",
    mode: "verify",
    code: `
const proc = Bun.spawnSync({
  cmd: ["bun", "--cwd", "packages/workspace", "run", "test", "<test-file>"],
  stdout: "pipe",
  stderr: "pipe",
})

const stdout = new TextDecoder().decode(proc.stdout)
const stderr = new TextDecoder().decode(proc.stderr)

console.log(JSON.stringify({
  ok: proc.exitCode === 0,
  phase: "red",
  command: "bun --cwd packages/workspace run test <test-file>",
  exitCode: proc.exitCode,
  stdout: stdout.slice(-12000),
  stderr: stderr.slice(-12000),
}, null, 2))

process.exit(proc.exitCode)
`.trim(),
    maxResultChars: 30000,
  },
  timeout: 600,
})

The red run should fail for the expected reason. Record the trace ID, command, and meaningful failure signal in the scoped workpad before implementing.
Focused green test
After implementation, rerun the same focused command through code.call:
await workspace.call({
  tool: "code.call",
  taskSession,
  input: {
    language: "bun",
    mode: "verify",
    code: `
const proc = Bun.spawnSync({
  cmd: ["bun", "--cwd", "packages/workspace", "run", "test", "<test-file>"],
  stdout: "pipe",
  stderr: "pipe",
})

const stdout = new TextDecoder().decode(proc.stdout)
const stderr = new TextDecoder().decode(proc.stderr)

console.log(JSON.stringify({
  ok: proc.exitCode === 0,
  phase: "green",
  command: "bun --cwd packages/workspace run test <test-file>",
  exitCode: proc.exitCode,
  stdout: stdout.slice(-12000),
  stderr: stderr.slice(-12000),
}, null, 2))

process.exit(proc.exitCode)
`.trim(),
    maxResultChars: 30000,
  },
  timeout: 600,
})

If the current code.call implementation supports explicit red/green metadata fields, include them. If it does not, record the red and green command, trace ID, and result in the scoped workpad immediately after each run.
Generated files or codegen
Use mode: "edit" for commands that intentionally update files. Use language: "bun" for Bun package scripts and command orchestration:
await workspace.call({
  tool: "code.call",
  taskSession,
  input: {
    language: "bun",
    mode: "edit",
    code: `
const commands = [
  ["bun", "run", "--cwd", "packages/os", "generate-types"],
  ["bun", "run", "--cwd", "packages/os", "generate-docs"],
]

const results = []

for (const cmd of commands) {
  const proc = Bun.spawnSync({
    cmd,
    stdout: "pipe",
    stderr: "pipe",
  })

  const stdout = new TextDecoder().decode(proc.stdout)
  const stderr = new TextDecoder().decode(proc.stderr)

  const result = {
    command: cmd.join(" "),
    ok: proc.exitCode === 0,
    exitCode: proc.exitCode,
    stdout: stdout.slice(-8000),
    stderr: stderr.slice(-8000),
  }

  results.push(result)

  if (proc.exitCode !== 0) {
    console.log(JSON.stringify({
      ok: false,
      failed: result,
      results,
    }, null, 2))
    process.exit(proc.exitCode)
  }
}

console.log(JSON.stringify({
  ok: true,
  results,
}, null, 2))
`.trim(),
    maxResultChars: 30000,
  },
  timeout: 600,
})

After codegen, inspect the diff with git.diff and confirm generated files are expected.
Workspace review
Use the typed review tool directly:
await workspace.call({
  tool: "review.run",
  taskSession,
  input: {
    base: "origin/stream/<area>",
    noTests: true,
  },
  timeout: 300000,
})

Full task safety gate
Use the typed verify tool directly:
await workspace.call({
  tool: "verify",
  taskSession,
  input: {
    base: "<origin/main-or-origin/stream/area>",
    noDb: true,
  },
  timeout: 300000,
})

Use noReview, noDb, or focused validation only when the reason is explicit and recorded in the workpad.
Do not publish based on vibes. Fix failures in scope. Stop and escalate when the failure requires product, architecture, destructive, or cross-task judgment.
Validation mode choices
Use mode: "verify" for tests, typechecks, builds, syntax checks, and package validation commands.
Use mode: "edit" for commands that intentionally update files, such as code generators, doc generators, schema generators, formatters, or codemods.
Use mode: "read" for non-mutating diagnostics that do not need task-branch code.
If a validation command unexpectedly edits files in mode: "verify", stop, inspect the diff, and rerun the command in mode: "edit" only when those changes are expected and in scope.
TDD evidence requirements
For non-trivial code changes:
Write or update the focused test first.
Run the focused command through code.call and capture the red failure.
Record the command, trace ID, and meaningful failure signal in the scoped workpad.
Implement the change.
Rerun the focused command through code.call and capture green.
Record the command, trace ID, and result in the scoped workpad.
Do not use code.call, code.call, host shell tools, or ad hoc terminal commands for TDD evidence when code.call can run the command.
Common validation command examples
Workspace package test:
await workspace.call({
  tool: "code.call",
  taskSession,
  input: {
    language: "bun",
    mode: "verify",
    code: `
const proc = Bun.spawnSync({
  cmd: ["bun", "--cwd", "packages/workspace", "test", "tests/facade/facade.test.ts"],
  stdout: "pipe",
  stderr: "pipe",
})

const stdout = new TextDecoder().decode(proc.stdout)
const stderr = new TextDecoder().decode(proc.stderr)

console.log(JSON.stringify({
  ok: proc.exitCode === 0,
  command: "bun --cwd packages/workspace test tests/facade/facade.test.ts",
  exitCode: proc.exitCode,
  stdout: stdout.slice(-12000),
  stderr: stderr.slice(-12000),
}, null, 2))

process.exit(proc.exitCode)
`.trim(),
    maxResultChars: 30000,
  },
  timeout: 600,
})

OS package test:
await workspace.call({
  tool: "code.call",
  taskSession,
  input: {
    language: "bun",
    mode: "verify",
    code: `
const proc = Bun.spawnSync({
  cmd: ["bun", "--cwd", "packages/os", "test", "tests/tool-manifest.test.ts"],
  stdout: "pipe",
  stderr: "pipe",
})

const stdout = new TextDecoder().decode(proc.stdout)
const stderr = new TextDecoder().decode(proc.stderr)

console.log(JSON.stringify({
  ok: proc.exitCode === 0,
  command: "bun --cwd packages/os test tests/tool-manifest.test.ts",
  exitCode: proc.exitCode,
  stdout: stdout.slice(-12000),
  stderr: stderr.slice(-12000),
}, null, 2))

process.exit(proc.exitCode)
`.trim(),
    maxResultChars: 30000,
  },
  timeout: 600,
})

Multiple focused validation commands with compact output:
await workspace.call({
  tool: "code.call",
  taskSession,
  input: {
    language: "bun",
    mode: "verify",
    code: `
const commands = [
  ["bun", "--cwd", "packages/os", "test", "tests/fs-read.test.ts"],
  ["bun", "--cwd", "packages/os", "test", "tests/tool-manifest.test.ts"],
]

function run(cmd) {
  const proc = Bun.spawnSync({
    cmd,
    stdout: "pipe",
    stderr: "pipe",
  })

  const stdout = new TextDecoder().decode(proc.stdout)
  const stderr = new TextDecoder().decode(proc.stderr)

  return {
    command: cmd.join(" "),
    ok: proc.exitCode === 0,
    exitCode: proc.exitCode,
    stdout: stdout.slice(-8000),
    stderr: stderr.slice(-8000),
  }
}

const results = commands.map(run)
const failed = results.filter((result) => !result.ok)

console.log(JSON.stringify({
  ok: failed.length === 0,
  failed,
  results,
}, null, 2))

process.exit(failed.length === 0 ? 0 : 1)
`.trim(),
    maxResultChars: 40000,
  },
  timeout: 900,
})

Prefer one command intent per call. Combine commands only when they are a tight validation bundle and the output remains bounded.
Generated surface validation:
await workspace.call({
  tool: "code.call",
  taskSession,
  input: {
    language: "bun",
    mode: "edit",
    code: `
const commands = [
  ["bun", "run", "--cwd", "packages/os", "generate-types"],
  ["bun", "run", "--cwd", "packages/os", "generate-docs"],
]

const results = []

for (const cmd of commands) {
  const proc = Bun.spawnSync({
    cmd,
    stdout: "pipe",
    stderr: "pipe",
  })

  const stdout = new TextDecoder().decode(proc.stdout)
  const stderr = new TextDecoder().decode(proc.stderr)

  const result = {
    command: cmd.join(" "),
    ok: proc.exitCode === 0,
    exitCode: proc.exitCode,
    stdout: stdout.slice(-8000),
    stderr: stderr.slice(-8000),
  }

  results.push(result)

  if (proc.exitCode !== 0) {
    console.log(JSON.stringify({
      ok: false,
      failed: result,
      results,
    }, null, 2))
    process.exit(proc.exitCode)
  }
}

console.log(JSON.stringify({
  ok: true,
  results,
}, null, 2))
`.trim(),
    maxResultChars: 30000,
  },
  timeout: 600,
})

Static grep-like checks should usually use fs.search, not shell search. Use code.call only when the check needs real language/runtime behavior.
Use Bash only when shell semantics are required. For example, a short environment smoke check can use Bash because it is intentionally shell-shaped:
await workspace.call({
  tool: "code.call",
  input: {
    language: "bash",
    mode: "read",
    code: "set -euo pipefail\nprintf 'node: '; node --version\nprintf 'bun: '; bun --version",
    maxResultChars: 12000,
  },
  timeout: 120,
})




## Run Development E2E Validation for Behavior Changes

For product behavior changes, focused unit tests are not enough. The agent must run the smallest meaningful end-to-end path that proves the changed behavior in a realistic development environment.

Use the dev workspace tooling when available. Treat it as the standard production-like local environment for behavior validation.

Minimum dev tooling capabilities:

- Postgres
- Redis
- Twilio live/test credential loading
- safe test number allowlists
- public callback tunnel support
- server start/restart with env loaded
- callback route reachability checks
- scenario/test-number execution
- lock inspection
- transcript/log artifact capture

Use dev before ad hoc shell setup. Do not manually recreate Postgres/Redis/Twilio/tunnel setup if the dev tool exposes it.

For behavior changes involving calls, jobs, webhooks, queues, locks, callbacks, external APIs, auth, or permissions, the validation ladder is:

1. focused unit/integration tests
2. local service-backed E2E through dev
3. mock scenario where applicable
4. live/test-provider scenario where applicable
5. production/deployed log validation when the change affects production runtime

Record the exact E2E command/tool call, environment mode, transcript path, and result in the scoped workpad.

Do not publish behavior changes with only typecheck/lint unless Ko explicitly waives E2E validation.

---

# Phase 7 — Prove the Change

## Behavior Proof Standards

For behavior changes:

- run the exact script, tool, endpoint, UI flow, scenario, or E2E path
- use dev tooling for service-backed workflows when available
- inspect state/logs/callbacks after the run
- then use `confirm` when it adds evidence

Use the truth source that matches the failure mode.

For pure type/API changes:

- typecheck
- focused tests
- review/verify

For runtime behavior:

- run the actual endpoint, script, workflow, UI flow, or scenario
- inspect logs/state after the run
- verify database/Redis/job/callback side effects where relevant

For external-provider flows:

- use mock mode first
- use provider test mode where it proves request construction or deterministic provider errors
- use live mode only with explicit safe allowlists and required credentials
- verify callbacks/webhooks through reachable public URLs before placing live calls
- confirm cleanup: no orphaned jobs, calls, locks, sessions, or stale state

For dialer-like flows, a valid proof usually includes:

- request entered the intended app contract
- backend service handled the request
- external provider was called only when intended
- callback/webhook returned to the app
- terminal state was recorded
- locks/resources were released
- logs/transcripts redact secrets and full phone numbers

A successful API response alone is not sufficient when the behavior depends on callbacks, queues, locks, or external lifecycle events.

```ts
await workspace.call({
  tool: "confirm",
  taskSession,
  input: { verify: true },
  timeout: 600,
})
```

For workspace tooling/docs/index changes:

```ts
await workspace.call({
  tool: "audit",
  taskSession,
  input: { scripts: true },
  timeout: 120,
})
```

Other useful audit modes:

```ts
await workspace.call({
  tool: "audit",
  taskSession,
  input: { docs: true },
  timeout: 120,
})

await workspace.call({
  tool: "audit",
  taskSession,
  input: { index: true },
  timeout: 300,
})
```

Then run review/verify as the publish gate.

Validation base must match the task start point:

| Task start point | Review/verify base |
| --- | --- |
| `startFrom: "main"` | `origin/main` |
| `startFrom: "stream"` | `origin/stream/<area>` |

Do not mix bases inside one task unless the task was explicitly rebased or restacked.

```ts
await workspace.call({
  tool: "review.run",
  taskSession,
  input: {
    base: "<origin/main-or-origin/stream/area>",
    noTests: true,
  },
  timeout: 900,
})

await workspace.call({
  tool: "verify",
  taskSession,
  input: {
    base: "origin/main",
    noDb: true,
  },
  timeout: 700,
})
```

If `startFrom` is `main`, validate/review against `origin/main`.

If `startFrom` is `stream`, validate/review against `origin/stream/<area>`.

Use the relevant truth source. Confirmation should produce evidence. A syntax check alone is not enough for a behavior change.

---

# Phase 8 — Publish Task Branch Updates

`task.push` sends current task changes to the remote task branch through the workspace publish path.

Typical call:

```ts
await workspace.call({
  tool: "task.push",
  taskSession,
  input: {
    message: "type(scope): description",
    changed: true,
  },
  timeout: 300,
})
```

Required checks before continuing:

- `ok === true`
- `code === "OK"`
- returned branch matches the active task branch
- remote update succeeded
- changed file set matches task intent
- `stderr` has no outcome-changing warning

Expected behavior:

- uses `taskSession` / task metadata for branch context
- supports full changed set or explicit file selection
- can run multiple times before PR promotion
- rejects invalid or ambiguous task context
- preserves review metadata on GitHub

---

# Phase 9 — Promote Task to Stream and Create the Stream Review PR

Run the full PR promotion flow:

```ts
await workspace.call({
  tool: "task.pr",
  taskSession,
  input: { ready: true },
  timeout: 300,
})
```

Default expected path:

```text
task/<area>/<slug> → stream/<area> → main
```

The PR Ko reviews is the stream review PR:

```text
stream/<area> → main
```

The task PR is intermediate automation state. Reporting only the task PR is incomplete.

If `task.pr` returns only a task PR, treat that as incomplete unless `taskOnly: true` was explicitly requested. Inspect the result, run `task.prs` if that tool exists, and continue until the stream review PR exists or a real blocker is identified.

`taskOnly` is an explicit stop mode. Use it only when Ko explicitly asks to stop after creating or refreshing the task PR.

Required checks:

- task PR exists or was created
- task PR targets `stream/<area>`
- task merge into stream succeeds when applicable
- stream review PR exists, is reused, or is updated
- stream review PR targets `main`
- returned payload includes Graphite stream PR number and URL

Prefer Graphite review links in final reports.

Use this Markdown format:

```md
[stream pr #362](https://app.graphite.com/github/pr/consuelohq/opensaas/362)
```

Example fallback:

```text
https://app.graphite.com/github/pr/consuelohq/opensaas/362
```

Use the exact file path when applicable:

```text
https://app.graphite.com/github/pr/consuelohq/opensaas/362#file-packages/consuelo-docs/os/portal/tool-manifest.mdx
```

---

# Phase 10 — Handle Metadata Conflicts Safely

Task metadata belongs on GitHub because it gives review context and agent traceability.

The current durable metadata model is scoped.

Primary task metadata:

```text
.task/<area>/<task-slug>/current.json
.task/<area>/<task-slug>/session.json
.task/<area>/<task-slug>/workpad.md
.task/<area>/<task-slug>/verify.json
.task/tasks/<area>/<task-slug>.json
```

Legacy root task pointers are not task truth and should not be reintroduced:

```text
.task/current.json
.task/session.json
.task/workpad.md
.task/verify.json
```

If root task pointer files appear, treat them as legacy/stale unless the current task explicitly created them for migration testing. Do not use them for active task selection.

Scoped metadata-only conflicts may be auto-resolved. Mixed conflicts must stop.

Auto-resolvable task metadata includes:

```text
.task/<area>/<task-slug>/current.json
.task/<area>/<task-slug>/session.json
.task/<area>/<task-slug>/workpad.md
.task/<area>/<task-slug>/verify.json
.task/tasks/**
.task/evidence-log.json
.task/read-log.json
.task/handoff.md
```

Examples:

```text
.task/workspace-agents/foo/current.json
+ .task/workspace-agents/foo/workpad.md
→ metadata-only; resolver may auto-resolve
```

```text
.task/tasks/workspace-agents/foo.json
+ .task/workspace-agents/foo/verify.json
→ metadata-only; resolver may auto-resolve
```

```text
.task/workspace-agents/foo/current.json
+ packages/workspace/SCRIPTS.md
→ mixed conflict; stop
```

```text
.task/tasks/workspace-agents/foo.json
+ packages/api/src/foo.ts
→ mixed conflict; stop
```

Any conflict involving code, docs, generated runtime files, package manifests, tests, configs, migrations, or product files is a real conflict. Stop when judgment is needed.

When resolving metadata-only conflicts, preserve the code merge and choose the metadata side that matches the active task/stream operation.

Record the resolution in the scoped workpad or final report.

---

# Phase 11 — Ship the Stream to Main When Explicitly Asked

When Ko asks to ship the stream, merge the stream review PR:

```ts
await workspace.call({
  tool: "task.merge",
  input: {
    pr: <stream-pr-number>,
    squash: true,
    wait: true,
  },
  timeout: 300,
})
```

If the merge tool times out, verify actual GitHub state:

```ts
await workspace.call({
  tool: "github",
  input: {
    operation: "pr.view",
    pr: <stream-pr-number>,
    repo: "consuelohq/opensaas",
    preset: "merge",
  },
  timeout: 120,
})
```

If the stream PR has conflicts with main, run stream sync:

```ts
await workspace.call({
  tool: "stream.sync",
  input: { area: "<area>" },
  timeout: 300,
})
```

If `stream.sync` reports metadata-only conflicts, resolve by policy.

If it reports code/docs/config/test conflicts, stop and ask Ko or resolve only with clear evidence.

After the stream PR merges, tell Ko to pull and restart the server when the changed code affects the local MCP server or workspace scripts.

Use typed workspace server tooling when available:

```ts
await workspace.call({
  tool: "server",
  input: { action: "restart" },
  timeout: 120,
})
```

Then smoke the affected path through `workspace.call`.

---

# Phase 12 — Finish and Clean Up Only When Safe

Use `task.finish` only when cleanup is safe:

```ts
await workspace.call({
  tool: "task.finish",
  taskSession,
  input: {},
  timeout: 300,
})
```

Required checks:

- task branch is confirmed merged into the stream
- stream has been shipped or Ko confirms local cleanup is safe
- cleanup target matches the active task branch
- worktree cleanup succeeds
- local branch cleanup succeeds when applicable
- associated task tmux session is closed
- result confirms completion
- there are no pending cleanup warnings

When merge proof is missing, preserve the worktree and stop.

Cleanup should remove or close only the worktree/session tied to the task metadata. Do not kill arbitrary tmux sessions or clean unrelated worktrees.

---

# Final Report Contract

Before reporting done, confirm:

- `task.push` returned `ok: true`
- `task.pr` returned `ok: true`
- stream review PR URL was captured
- task PR exists when applicable
- task PR targets `stream/<area>`
- stream review PR targets `main`
- Graphite stream PR link is included for reviewable work
- temporary/smoke task PRs are closed or explicitly accounted for
- metadata-only conflicts were resolved by policy
- mixed conflicts were escalated or resolved with evidence
- workpad was updated before publish with final decisions, files changed, validation evidence, and issues encountered
- `git.diff` was used after edits or the reason it was skipped is stated
- validation commands match the actual change
- `stderr` contains no outcome-changing warnings

Final report shape:

```text
tl;dr: status/result.

evidence:
- files changed
- commands/tests run
- checks passed/failed
- task PR and stream PR states
- stream PR link if applicable

action:
- next step
- blocker
- done
```

Share the stream review PR URL only after publish state is verified.

For temporary/smoke tasks, cleanup also includes PR state:

- close unneeded temporary task PRs
- leave a comment or workpad note with the evidence captured
- do not promote temporary PRs into the stream unless Ko asked for the temp work to become durable
- do not leave temporary PRs open without naming the reason

Temporary PRs should use `tmp(<stream-area>): ...` in the title so Ko can identify them quickly.

---

# Failure Policy

When any publish step returns non-OK:

1. Stop the pipeline.
2. Record the failed command, result code, message, and trace ID in the scoped workpad.
3. Fix the root cause inside the current task scope.
4. Rerun from the failed step.
5. Continue only after the returned result is verified.

This keeps publishing stateful, reviewable, and task-safe.

---

## Stale Scoped Metadata Is Not Active Task Truth

Completed tasks may leave scoped metadata on main, such as:

```text
.task/workspace-agents/<old-task>/current.json
.task/workspace-agents/<old-task>/workpad.md
.task/tasks/workspace-agents/<old-task>.json
```

`status` may report this as `staleTask` when the metadata belongs to a different branch than the current checkout.

Do not treat `staleTask` as active context. It is historical metadata.

Continue using the explicit `taskSession` returned by `task.start`.

Only repair metadata when it affects the active task session, the active task worktree, or the current publish/merge operation.

---

# Decision Workflow Summary

Use the decision engine to move from broad uncertainty to evidence-backed action.

Normal loop:

1. `explore` to get candidate files and graph context.
2. `decideNext` to choose the next highest-value action.
3. `fs.read` the recommended file or section.
4. Mark evidence when useful with `decideNext` input such as `markRead`, `markRelevant`, or `markIrrelevant`.
5. Run `confidenceScore`.
6. Repeat until confidence is high enough to exploit.
7. Run `exploit` to commit to the implementation path.
8. After implementation, use real validation plus `confirm` when useful.

Important:

- `explore` is retrieval, not proof.
- `decideNext` is the policy layer.
- `confidenceScore` is an evidence check, not permission to skip tests.
- `exploit` means “stop wandering; edit this path.”
- `confirm` means “belief meets reality.”
- `audit` is for tool/docs/index drift, not general confirmation.

## Explore Is a Discovery Command

Use `explore` anywhere you would otherwise start guessing paths, grepping broadly, or asking “where is this implemented?”

Treat it as a workspace navigation primitive alongside `fs.read` and `fs.search`.

- `explore` finds likely files, symbols, tests, docs, and related implementation paths.
- `fs.read` verifies actual content.
- `fs.search` follows up with exact targeted symbol/string lookup after direction is narrowed.
- `decideNext` decides what evidence/action should come next.
- `confirm` proves behavior against reality.

Do not wait until a formal decision-engine loop to use `explore`.

Use it early, especially before broad `fs.search` or raw shell search.

## Hard Rules

- decision engine is the default discovery method
- `fs.search` is targeted follow-up, not the first move
- confidence comes from evidence, not retrieval score
- read files before editing
- run tests or smoke checks that match the behavior changed
- report stream PRs, not only task PRs
- context and decision engine can be used at any point
- if root `.task/current.json`, `.task/session.json`, `.task/workpad.md`, or `.task/verify.json` appears, treat it as legacy/stale unless the task explicitly concerns migration compatibility
- active task truth comes from `taskSession` and scoped `.task/<area>/<task-slug>/...` metadata

---

# Finish the Task or Name the Real Blocker

Do not stop at the first tool failure when the user asked for a shippable change. Tool failures are work to diagnose, not completion states.

For any requested code, docs, workflow, or repo change, continue until exactly one of these terminal states is true:

1. The change is merged to the requested target branch and local state is updated when requested.
2. The change is pushed to a review PR and the user explicitly asked to stop at review.
3. A real blocker remains after recovery attempts, and the blocker is named with exact evidence.

A timeout, validation error, safety-blocked call, stale metadata error, dirty worktree error, merge conflict, or failed push is not a terminal state by itself. Treat it as an incident to resolve.

Required recovery loop:

1. Read the structured error envelope.
2. Identify whether the failure is input shape, timeout budget, task-session resolution, stale metadata, merge conflict, dirty worktree, safety filtering, missing dependency, or external service state.
3. Retry once with the smallest corrected workspace call.
4. If the same class of error repeats, switch to the next workspace-supported path.
5. If fallback tooling is required, state why the workspace facade could not complete the operation and keep the fallback scoped to the task worktree.
6. Continue toward ship/review after recovery.

Before saying “done,” verify and report:

- target branch or PR
- commit SHA or merge SHA
- files changed
- validation run
- local state if the user requested lo

