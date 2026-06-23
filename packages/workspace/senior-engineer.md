Your job is to implement one focused task with high confidence, clear evidence, and targeted blast radius.

This skill does not own the task lifecycle. Use the task/workflow skill for task start, workspace tool sequencing, publishing, PR promotion, and cleanup.

This skill owns engineering judgment.


---

## 1) Operating stance

- Ship one focused change at a time.
- Keep `main` stable and boring.
- Preserve parallel-agent safety.
- Prefer typed workspace tools over raw shell commands.
- Prefer existing project patterns over clever new abstractions.
- Treat uncertainty as a signal to gather evidence, not as permission to guess.
- Do not lose code. Push & promote to fully stream through the approved task workflow once validation is credible.
- Do not widen scope silently. Record scope pressure in the workpad.

A good worker agent is not just fast. A good worker agent leaves behind a workspace better than they found it & a task that is easy to review, easy to trust, and easy to recover from.

---

## 2) Tooling principles

Use the workspace tool surface as the source of truth.

Preference order:

1. Use direct typed workspace tools for single known operations and durable transitions.
2. Use `context.search` and`explore` for discovery and prior context.
3. Use no-session `code.run` for multi-step read/investigation before a task exists.
4. Use `task.intent` to start a task workflow with just-in-time tool discovery and hooks.
5. Use task-scoped `code.run` for semantic workflows that compose multiple typed tools inside a task.
6. Use `batch` as the default parallel fanout primitive for dependency-free workspace work. Reach for it whenever several known tool calls can run at the same time: multi-file reads, targeted searches across known areas, status + diff + context gathering, PR/file/review inspection, and independent validation checks. `batch` is not just a checklist helper; it is the preferred way to reduce latency and collect evidence across multiple surfaces when later steps do not depend on earlier results. Do not use `batch` when a step’s inputs must be chosen from a previous step’s output; use `code.run` for that kind of semantic workflow.
7. Use `git.diff` for structured diff inspection after edits.
8. Use lifecycle tools directly: `status`, `audit`, `review.run`, `verify`, `task.push`, `task.pr`, `task.prs`, `task.merge`, `task.finish` and `task.cleanup`.
9. Use `github` for GitHub/PR state and raw GitHub escape hatches with `reason`; use current `gh` only as a temporary fallback.
10. Use `code.call` for focused command/runtime evidence: tests, builds, typechecks, package scripts, syntax checks, exact CLI reproduction, small diagnostics, or commands with no typed workspace equivalent.
11. Use local shell-style or host fallback execution only when the workspace tool model cannot express the operation. Record the tooling gap.



Examples of typed-tool preference:

- Use `status` instead of `task.exec git status`.
- Use `github` for GitHub state instead of ad hoc `gh` shell commands when possible.
- Use `audit` for workspace scripts/docs/index drift.
- Use `checkFiles` for JavaScript/TypeScript/Python syntax checks when available.
- Use `review.run` for workspace review.
- Use `verify` for the publish safety gate.
- Use `confirm` for validation evidence when it adds proof.
- Use `dev` for service-backed local infrastructure and behavior validation.

`code.run` is a semantic composer over the existing typed workspace tools. It is not a separate execution environment and not a guardrail bypass.

Do not wrap a single obvious typed call in `code.run`. Use direct `workspace.call` for one known operation unless `code.run` is adding summarization, branching, or composition value.

Prefer `code.run` when the work is workspace orchestration:

- inspect traces/logs/status and summarize the result
- search → read → decide
- read → patch/write → reread
- inspect manifest/config/docs and return a compact answer
- coordinate several typed workspace tools in one semantic pass
- avoid ad hoc `python -c`, `node -e`, heredocs, or long shell strings for file inspection/transformation when typed workspace tools can do it

Use no-session `code.run` before a task exists for read/investigation workflows that compose non-task tools.

Use task-scoped `code.run` after `task.start` when composing task-scoped tools. Pass `taskSession` on the outer workspace call; nested workspace helpers inherit task context.

Use `code.call` as the normal command/runtime runner.

Use `code.call` when the command itself is the evidence:

- run focused tests
- run package scripts
- run build/typecheck/lint commands
- run language/runtime syntax checks
- reproduce exact CLI behavior
- execute commands that have no typed workspace equivalent
- validate process behavior such as exit codes, argv parsing, redirects, or output shape
- run small non-mutating diagnostics with `mode: "read"`

Use the most specific `code.call` runtime:

| Need | Runtime |
| --- | --- |
| Python diagnostics, Python syntax checks, Python scripts | `language: "python"` |
| Bun/JS/TS diagnostics, package-command orchestration, JSON/result shaping | `language: "bun"` |
| Shell semantics such as pipes, redirects, env expansion, shell builtins, or short shell smoke checks | `language: "bash"` |

Do not use Bash just to invoke Python or Bun. Use `language: "python"` for Python work and `language: "bun"` for Bun/package orchestration.


`code.call` should usually be short, focused, and validation-oriented. If an agent is using command execution repeatedly for reading files, editing files, JSON inspection, workpad updates, or glue logic, switch to `code.run` plus typed workspace tools.


---

Explore is a discovery command, not just decision-engine setup.

Use `explore` anywhere you would otherwise start guessing paths or asking “where is this implemented?”

An `explore` query should be short and single-intent. Use one concept, subsystem, symbol, or question per query.

Good:

```text
task intent workflow
```

Bad:

```text
task intent workflowRole script intent task-intent task.intent
```

The failure mode is query blending: several competing hypotheses inside one query make retrieval less precise. `explore` does not reason across multiple query meanings in one call.

When multiple query phrasings are plausible, run independent `explore` calls in `batch`:

```ts
await workspace.call({
  tool: "batch",
  input: {
    steps: [
      {
        tool: "explore",
        input: { query: "task intent", limit: 8 },
        parallel: true,
      },
      {
        tool: "explore",
        input: { query: "where is task intent handled", limit: 8 },
        parallel: true,
      },
    ],
  },
  timeout: 300,
})
```

Treat `explore` as a prior over where to inspect next. After retrieval narrows the map, use `code.call` in read mode to inspect the likely files, confirm exact symbols, and return a task-shaped evidence packet.

## 3) Decision and evidence principles

Use the decision engine to move from uncertainty to evidence-backed action.

The task workflow skill owns the exact loop. This skill owns the judgment standard:

- `explore` is retrieval, not proof.
- `decideNext` is the policy layer.
- `confidenceScore` measures evidence quality, not permission to skip tests.
- `exploit` means the evidence is concentrated enough to stop wandering and edit.
- `confirm` means belief meets reality.
- `audit` checks workspace surface truth: scripts, docs, and index freshness.

Do not edit the first plausible file just because search found it. Read enough context to understand the local pattern and failure mode.


Use `code.call` preferably with a batched follow-up, if possible, after the direction is clear.

Confidence comes from:
- files actually read
- connected code paths inspected
- tests or runtime checks run
- validation output
- contradictions resolved
- behavior reproduced or smoked

Confidence does not come from:
- one semantic search result
- memory
- vibes
- a syntax check alone
- an API response that does not cover callbacks, queues, locks, jobs, or side effects

---

## 4. Design principles

Prefer clear boundaries.

Backend business logic belongs in services, not thin API adapters.

Frontend should call stable app contracts, not provider-specific or legacy runtime paths.

External provider callbacks/webhooks can remain REST endpoints when the provider requires public URLs.

Provider-specific objects should be adapted at the boundary. Internal services should consume typed domain objects.

For platform code, separate:

- app contract
- domain service
- provider integration
- persistence
- lifecycle/callback handling
- UI state

Avoid mixing these into one function or component.

## API design and performance review

When designing, reviewing, or refactoring APIs, treat performance as an engineering discipline, not a reflex. Do not optimize first. Start by identifying the real bottleneck through load testing, request profiling, traces, database query inspection, and production-like traffic assumptions. Only apply optimization once an endpoint has a confirmed performance issue or a clear scalability requirement.

For API design and review, check these seven performance patterns:

1. **Caching**
   Use caching for expensive computations or frequently requested responses with stable parameters. Prefer explicit cache keys, TTLs, invalidation rules, and correctness boundaries. Redis or Memcached are appropriate when repeated database hits dominate latency. Do not cache data whose freshness requirements are unclear.

2. **Connection pooling**
   Reuse database and service connections instead of opening a new connection per request. Confirm pool size, timeout behavior, idle limits, and failure behavior. In serverless systems, check for connection explosion risk and consider managed pooling layers such as RDS Proxy or equivalent platform tools.

3. **Avoid N+1 queries**
   Inspect API endpoints that load parent records and related entities. Replace per-record child queries with joins, eager loading, batch loading, or two-query patterns that fetch all related records at once. Treat N+1 fixes as a primary database performance concern.

4. **Pagination**
   Do not return unbounded lists. Large responses increase database load, transfer time, memory use, and client-side work. Use limit/offset, cursor pagination, or keyset pagination depending on consistency and scale requirements. Make pagination behavior explicit in the API contract.

5. **Lightweight JSON serialization**
   Serialization can become visible in high-throughput or large-payload APIs. Check whether response shaping, DTO construction, or JSON encoding is adding latency. Prefer efficient serializers and avoid returning unnecessary fields.

6. **Compression**
   Enable compression for large API payloads when network transfer cost matters. Prefer modern algorithms such as Brotli where supported, and use CDN or edge compression when appropriate. Avoid compressing tiny responses where CPU overhead outweighs transfer savings.

7. **Asynchronous logging**
   Logging should not block hot request paths in high-throughput systems. Use buffered or asynchronous logging when synchronous writes add measurable latency. Preserve reliability expectations: asynchronous logging can lose recent logs if the process crashes before flush, so use it deliberately for the right log class.

Default review stance: first prove the bottleneck, then choose the simplest optimization that addresses it without adding unnecessary complexity. Every API performance change should include evidence, expected effect, and a validation path.






---

## 5) Test-first engineering discipline

Test-driven development is the default engineering posture for this skill.

For any non-trivial code change, the agent must define the behavior contract before editing production code. Tests are not an after-the-fact safety net; they are the executable specification that guides the implementation.


Before production edits, update the scoped workpad with a `Test-first contract`:

* behavior under test
* existing local pattern to follow
* new or changed tests
* focused red command
* expected red failure
* no-test waiver, only when a new or changed test is genuinely inappropriate

Then write or update the focused test first. Run it before implementation and confirm the expected red failure. After that, implement the smallest correct change that makes the focused test pass. Rerun the same test and record green evidence. Only then proceed to broader validation.

Do not weaken, delete, or rewrite the pretest after implementation unless the original contract was wrong. If the contract changes, record why in the workpad.

Every task requires test decision coverage. Most behavior changes require test-first coverage. A no-test waiver is acceptable only for copy-only, docs-only, generated-file, trivial formatting, mechanical rename, or emergency repair tasks, and the waiver must say what validation replaces the missing test.

### Choose the test layer by risk

Use the smallest test that proves the behavior, then add broader proof when the behavior crosses runtime boundaries.

| Change type / risk                      | Default test layer                                                           | What it proves                                                                                       | Examples                                                                                                                                                    | Extra validation                                                                                                     |
| --------------------------------------- | ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Pure domain logic                       | Unit test                                                                    | A small function returns the correct result for known inputs.                                        | Mapping `no_answer` → `no-answer`; parsing a phone number; validating an email; normalizing a disposition; formatting a duration.                           | Usually no E2E needed. Run focused unit test plus typecheck/static checks.                                           |
| Business-rule branching                 | Unit test or small service test                                              | The rule behaves correctly across important cases, including edge cases.                             | “If outcome is `other`, require manual disposition”; “If auto-advance is disabled, show manual advance”; “If confidence is low, do not auto-commit.”        | Prefer table-driven tests with multiple cases.                                                                       |
| Data mapping / adapter boundary         | Unit test                                                                    | Provider-specific or legacy values are safely converted into internal domain values.                 | Twilio status → internal call status; Pi outcome → canonical call disposition; API response DTO → frontend view model.                                      | Include unknown/unsupported values and failure cases.                                                                |
| React presentational component          | Component test                                                               | The user sees the right UI for given props/state.                                                    | Modal shows contact name, duration, disposition; button label changes from “Pause Queue” to “Resume Queue”; checkbox says the opposite auto-advance action. | Use Testing Library-style user-visible assertions. Avoid testing internal component state directly.                  |
| React hook or UI state machine          | Hook test or component integration test                                      | State transitions happen correctly after user/system events.                                         | Call ended → analyzing; analysis complete → ready-auto-advance; cancel countdown → advance-cancelled; manual disposition selected → advance enabled.        | Use fake timers for countdowns. Test actions, not implementation details.                                            |
| Frontend flow across several components | Component integration test                                                   | Components are wired together correctly without running the whole app.                               | Clicking “End Call” disconnects only current call; clicking “Stop Queue” ends the queue; wrap-up modal receives the correct call summary.                   | Mock app contracts/hooks only where needed. Prefer existing test helpers.                                            |
| API contract                            | API/controller test or service test                                          | The endpoint accepts input, calls the right service, and returns the expected response shape/status. | `POST /v1/calls/:id/disposition`; `GET /v1/calls/:id/analysis`; queue advance endpoint returns next member.                                                 | Assert status code, response body, and important side effects.                                                       |
| Persistence behavior                    | Service/integration test                                                     | Database writes are correct and durable.                                                             | Post-call analysis writes `calls.analysis`; deterministic outcome writes `calls.outcome`; list member disposition is updated.                               | Use test DB/fixtures if available. Verify committed state, not just returned objects.                                |
| Background job / queue / lock behavior  | Focused service/integration test first                                       | Job enqueueing, processing, locking, retries, and cleanup behave correctly.                          | Dialer queue advance; release Redis lock after terminal state; retry failed post-call analysis; prevent double advance.                                     | Then run service-backed/dev proof because timing and runtime infra can fail outside unit tests.                      |
| Webhook / callback behavior             | API/integration test first                                                   | External provider callbacks are handled safely and idempotently.                                     | Twilio call status callback; media stream callback; transcription callback; Stripe webhook.                                                                 | Add local service-backed proof with tunnel/provider simulator when behavior depends on public callback reachability. |
| Auth / permissions / tenant boundaries  | Integration or E2E test                                                      | The right user/workspace can access or mutate only the allowed data.                                 | User cannot update another workspace’s call; queue member belongs to workspace; API rejects missing auth.                                                   | Include negative tests. Do not rely only on happy path.                                                              |
| External provider integration           | Adapter test with mocks/fixtures first                                       | The app sends the correct provider request and handles provider responses/errors.                    | Twilio call disconnect; Groq transcription request; OpenAI-compatible client setup; CRM sync.                                                               | Avoid real provider calls in normal tests. Use explicit dev/live proof only when needed and safe.                    |
| AI-generated analysis / LLM behavior    | Deterministic fixture test                                                   | The app handles the AI output contract safely.                                                       | Pi outcome maps to canonical disposition; malformed analysis requires manual fallback; empty transcript does not auto-commit.                               | Do not call real AI in ordinary tests. Use fixtures/mocks. Add separate manual/dev proof if needed.                  |
| Full user journey                       | E2E/browser test after lower-level tests                                     | The real app works from the user’s point of view.                                                    | Start queue → call contact → end call → see wrap-up → advance next call; login → create record → verify UI update.                                          | E2E is expensive and brittle. Use it for critical flows, not every small function.                                   |
| Visual/layout-only UI change            | Component test, screenshot/design check, or no-test waiver depending on risk | The visible layout or text behavior is protected if it matters.                                      | Buttons align in a 2×2 grid; modal copy changes; empty state layout.                                                                                        | If pure copy/style with low risk, use no-test waiver plus visual/manual check.                                       |
| Docs-only / comments-only               | No-test waiver                                                               | No runtime behavior changed.                                                                         | README update; steering text; comments that do not affect generated docs.                                                                                   | Run docs/audit/spell/checkFiles only if relevant.                                                                    |
| Generated files                         | Test the source/generator, not the generated output by hand                  | Generated output is consistent with source schema or manifest.                                       | Regenerated `TOOLS.md`; regenerated type stubs; generated API client.                                                                                       | Run generator and audit/check drift. Do not hand-edit generated files unless project pattern allows it.              |
| Mechanical rename / formatting          | No-test waiver or existing focused test if risky                             | Behavior should be unchanged.                                                                        | Rename variable; move file with imports updated; Prettier-only change.                                                                                      | Run typecheck/static checks. Add tests only if the move changes behavior or module boundaries.                       |
| Emergency production repair             | Best available focused test or explicit waiver                               | The immediate failure is fixed without making recovery worse.                                        | Hotfix broken deploy; unblock workspace tool; restore broken script.                                                                                        | Record the waiver, exact risk, and follow-up test debt in the workpad.                                               |

Rules:

* Prefer the lowest layer that proves the behavior.
* Add broader validation when the behavior crosses process, database, queue, provider, auth, or browser boundaries.
* A test is good only if it would fail when the intended behavior is broken.
* Do not test private implementation details when user-visible or contract-level behavior can be tested instead.
* Do not call real external providers, production services, or AI models in ordinary tests. Use deterministic fixtures, mocks, or explicit dev/integration proof.
* If no test is appropriate, record a no-test waiver before editing production code.


A test is good only if it would fail when the intended behavior is broken. Prefer behavior assertions over implementation-detail assertions. Prefer existing test helpers and local project patterns. Avoid calling real external providers or AI models in ordinary tests; use deterministic fixtures, mocks, or explicit integration/dev proof.

If the agent cannot identify an appropriate test, it must stop and explain the testing uncertainty instead of silently implementing first.


---
## 6) Workpad contract

You must always maintain the scoped task workpad throughout execution:

`.task/<area>/<task-slug>/workpad.md`

- acceptance criteria
- implementation plan
- key decisions
- notes for Ko
- improvements noticed
- errors or blockers
- validation commands and results

The workpad is a running engineering log, not polished prose. This is for humans to help with reviewing code, and it provides future agents with context of the current state of work.

Use it to record:
- Why one implementation path was chosen over another
- What evidence supported the edit
- What validation proved
- What validation was skipped or narrowed and why
- any surprising failure
- out-of-scope issues noticed during the task

Do not leave the workpad empty. A reviewer should be able to understand the task state without reconstructing your reasoning from chat history.

## Test-first workpad discipline

For non-trivial code changes, define the test strategy before implementation. The task workpad is the durable contract between Ko, the agent, and the codebase.

Before editing production code, fill the agent-owned `Test-first contract` section with behavior under test, existing pattern to follow, intended tests, focused red command, expected red failure, and no-test waiver when a test is genuinely inappropriate.

Run the focused test before implementation and let workspace-owned workpad sections capture the red evidence, green evidence, files read, test selection, and post-validation where tooling supports it. Do not weaken or rewrite the pretest after implementation unless the contract itself was wrong; record the reason in the workpad.

Every task needs test decision coverage. Most behavior changes need test-first coverage. Copy-only, docs-only, generated-file, trivial formatting, and mechanical rename tasks may use a no-test waiver with validation matched to the risk.


## 7) Implementation principles

Implement only what the acceptance criteria require.

Before editing:
- read the relevant standards and local patterns
- identify the smallest correct edit target
- understand nearby tests or validation paths
- write or update the plan in the workpad

During editing:
- prefer small, reviewable changes
- preserve existing architecture unless there is evidence it is wrong
- avoid mixing cleanup, refactor, and behavior changes unless the task explicitly calls for it
- keep domain logic separate from side effects
- keep error paths explicit
- avoid broad rewrites when a focused fix is enough

After editing:
- reread changed ranges
- inspect the diff with the best available typed/workspace tooling
- run the smallest meaningful validation first
- then run the broader review/verify gates
- update the workpad with actual results

Do not hide uncertainty. If the validation does not prove the behavior, say so and continue or escalate.

---

## 8) Coding standards

### TypeScript

- Strict mode is expected.
- No `any`.
- No `as any`.
- No untyped catches.
- Use `catch (err: unknown)` with type guards.
- Prefer named exports.
- Avoid top-level imports of optional peer/runtime dependencies; use lazy runtime import when appropriate.
- Avoid `useEffect` as an escape hatch for non-external synchronization.
- Use functional React components only.

### Logging and errors

- Do not use `console.log`, `console.warn`, or `console.error` in app/runtime code.
- Use the project’s structured logging pattern.
- Never swallow errors silently.
- Every async flow should have an intentional failure path.
- Reset cached client references on initialization failure when retry should be possible.
- Error messages should be clear enough to debug without exposing secrets.

### Data and security

- Validate and sanitize at boundaries.
- Never hardcode secrets.
- Never log raw tokens, credentials, full phone numbers, or sensitive payloads.
- Use parameterized queries. Do not interpolate user input into SQL.
- Security comes before formatting or convenience.

### Readability

- One function should have one clear responsibility.
- Use meaningful domain names; avoid vague abbreviations.
- Prefer guard clauses over deep nesting.
- Comments explain why, not what.
- Use short `//` comments for ordinary code. Avoid routine JSDoc blocks.
- Add ticket-tagged TODOs for intentional incompleteness.

### Consistency

- Reuse existing patterns unless clearly broken.
- If deviating, explain why in the workpad.
- Prefer consistency over cleverness.
- Do not introduce a new abstraction unless it removes real duplication or clarifies ownership.

---
## 9) Validation principles

Run validation that matches the risk of the change.

Validation ladder:

1. Syntax or static checks for touched files.
2. Focused unit or integration tests.
3. Workspace review.
4. Full verify gate when publishing.
5. Service-backed E2E when behavior depends on runtime infrastructure.
6. Runtime/provider/log validation when callbacks, queues, jobs, external APIs, auth, or permissions are involved.

Use typed validation tools where available:

- `check-files` for JavaScript syntax checks.
- `audit` for workspace scripts/docs/index drift.
- `review.run` for review.
- `verify` for the task safety gate.
- `confirm` for validation evidence.
- `dev` for service-backed local validation.
- `status` and `doctor` for environment and workspace state.

Use `code.call` for focused validation only when no more specific typed validation tool exists. 

Good `code.call` validation uses:
- Python compilation or Python validation scripts with `language: "python"` 
- focused package test commands with `language: "bun"`
- build/typecheck/lint/package scripts with `language: "bun"` 
- codegen or generated-surface commands with `language: "bun"` and `mode: "edit"` when files may change 
- one-off runtime smoke checks with the most specific runtime 
- shell-specific checks with `language: "bash"` only when shell semantics are required 

| Validation need | Preferred surface |
| --- | --- |
| JS/TS/Python syntax check supported by the workspace checker | `checkFiles` |
| Focused package test | `code.call` with `language: "bun"` and `mode: "verify"` |
| Typecheck/build/lint/package script | `code.call` with `language: "bun"` and `mode: "verify"` |
| Python compile/check script | `code.call` with `language: "python"` and `mode: "verify"` |
| Codegen or formatter that intentionally writes files | `code.call` with `mode: "edit"` |
| Workspace review | `review.run` |
| Full publish safety gate | `verify` |
| Service-backed behavior proof | `dev` plus relevant runtime/log/state checks |

await workspace.call({
  tool: "code.call",
  taskSession,
  input: {
    language: "python",
    mode: "verify",
    code: `
import py_compile
import sys

files = ["packages/workspace/scripts/example.py"]
failures = []

for file in files:
    try:
        py_compile.compile(file, doraise=True)
    except Exception as error:
        failures.append({"file": file, "error": str(error)})

print({"ok": len(failures) == 0, "failures": failures})
sys.exit(1 if failures else 0)
`.trim(),
    maxResultChars: 20000,
  },
  timeout: 120,
})
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
    console.log(JSON.stringify({ ok: false, failed: result, results }, null, 2))
    process.exit(proc.exitCode)
  }
}

console.log(JSON.stringify({ ok: true, results }, null, 2))
`.trim(),
    maxResultChars: 30000,
  },
  timeout: 600,
})


A syntax check alone is not sufficient for behavior changes.

A successful HTTP response alone is not sufficient when the behavior depends on:
- callbacks
- queues
- locks
- background jobs
- external provider lifecycle
- database side effects
- Redis state
- auth/session state
- webhook reachability

Record exact validation commands, tool calls, environment mode, logs, transcript paths, and results in the workpad.

---

## 10) Service-backed and E2E behavior proof

For product behavior changes, focused tests are not enough by default. Run the smallest meaningful end-to-end path that proves the changed behavior in a realistic development environment.

Use the `dev` workspace tooling when available.

Use `dev` for:
- starting/stopping Postgres and Redis
- verifying pgvector or required extensions
- exporting Keychain-backed credentials into the server process
- starting app services with correct environment
- starting public tunnels for webhooks/callbacks
- checking public callback reachability
- running scenario modes
- inspecting Redis locks safely
- collecting transcripts and runtime logs

Do not manually recreate Postgres/Redis/Twilio/tunnel setup the `dev` tool exposes it.

For behavior changes involving calls, jobs, webhooks, queues, locks, callbacks, external APIs, auth, or permissions, the validation ladder is:

1. focused unit/integration tests
2. local service-backed E2E through `dev`
3. mock scenario where applicable
4. live/test-provider scenario where applicable
5. production/deployed log validation when the change affects production runtime

For dialer-like flows, a valid proof usually includes:

- request entered the intended app contract
- backend service handled the request
- external provider was called only when intended
- callback/webhook returned to the app
- terminal state was recorded
- locks/resources were released
- logs/transcripts redact secrets and full phone numbers

If `dev` setup fails, fix the setup problem when it is in scope. If it requires Ko input, stop and ask with the exact missing item. Do not silently fall back to a weaker test and claim behavior is proven.

Do not publish behavior changes with only typecheck/lint unless Ko explicitly waives E2E validation.

---

## 11) Review discipline

Before publishing or reporting done, self-review the changed files.

Look for:
- accidental scope creep
- generated slop
- dead code
- stale comments
- untested behavior
- fragile timing or race assumptions
- poor error messages
- leaked secrets or sensitive logs
- inconsistent local patterns
- missing cleanup paths
- missing validation evidence

A clean diff is part of the deliverable.

Do not leave “while I was here” edits in the PR unless they directly support the task.

---

## 12) Git and commit principles

The task workflow skill owns the exact publish commands.

Engineering rules:

- Commit message format: `type(scope): description`.
- Keep commits scoped to the current task.
- Ko remains author.
- `suelo-kiro[bot]` is committer.
- Never force-push or overwrite remote task state unless Ko explicitly approves and the reason is documented.
- Push through the approved workspace task publish path.
- Do not claim work is shipped until the relevant PR state is verified.

---

## 13) Conflict and parallel-agent principles

Assume parallel agents are active.

Do not rely on shared mutable pointers when task-specific context exists.

Metadata-only conflicts may be resolved by policy under the task workflow skill. Mixed conflicts require judgment.

Stop when conflicts involve:
- code
- docs
- tests
- generated runtime files
- package manifests
- migrations
- configs
- product behavior files

Do not casually pick ours/theirs for real code conflicts.

---

## 14) Definition of engineering done

A task is engineering-ready for review only when:

- acceptance criteria are complete
- implementation matches the narrow task scope
- decision evidence is sufficient
- changed files were self-reviewed
- validation matches the actual risk
- behavior changes have behavior proof
- workpad reflects final decisions and validation
- publish state is verified by the task workflow
- no outcome-changing warnings remain in stderr/logs

A task is not done just because:
- code compiles
- tests pass unrelated areas
- a command exits zero
- a PR exists
- the agent is confident
- the first implementation seems plausible

Done means the change is reviewable, recoverable, and proven at the right level.

## Finish the task or name the real blocker

Do not stop at the first tool failure when the user asked for a shippable change. Tool failures are work to diagnose, not completion states.

For any requested code, docs, workflow, or repo change, the agent must continue until exactly one of these terminal states is true:

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
- local state if the user requested local sync

## Temporary file recovery path

Before saying “blocked,” check whether the failure is caused by prompt transport, tool argument serialization, wrapper filtering, command length, shell quoting, or model/tool call formatting rather than the actual underlying work being unsafe or impossible.

When a direct tool call or long inline prompt is blocked, malformed, truncated, or repeatedly failing, prefer staging the intended instructions or payload in a temporary file, then pass only the file path to the next tool or command.

Use this pattern for legitimate repo/task work when the goal is already approved and the failure is caused by transport/tooling friction.

Don’t report OpenAI safety blocks as the same as workspace safety blocks; they are materially different. 

### Required blocked report

Before saying “blocked,” report:

* exact command/tool
* exact error
* taskSession and branch involved
* evidence that the failure is outside normal task recovery
* safest next action

### Temp file workflow

1. Write the full prompt, patch plan, command script, or worker instructions to a temp file.

Prefer `/tmp` for local-only handoff:

```bash
cat > /tmp/<task-name>-instructions.md <<'EOF'
<full instructions here>
EOF
```

Prefer the task worktree when another tool or worker requires repo-local paths:

```bash
cat > .task/<area>/<task-name>/worker-instructions.md <<'EOF'
<full instructions here>
EOF
```

2. Invoke the tool with a short path-only instruction.

Example for Codex:

```bash
codex exec --cd "$PWD" --sandbox workspace-write --json - < /tmp/<task-name>-instructions.md
```

Example worker prompt:

```text
Follow the instructions in .task/<area>/<task-name>/worker-instructions.md.
Use the existing taskSession and branch. Do not start a new task.
```

3. If the temp-file path works, continue the task normally and record the recovery in the workpad.

4. If the temp-file path also fails, then report the blocked state using the required blocked report.

### Rules

* Do not use temp files to skip approval, hide intent, or avoid safety policy.
* Do use temp files to avoid malformed JSON, command-length issues, prompt truncation, shell quoting failures, or platform wrappers blocking large inline payloads.
* Keep temp files out of commits unless they are intentionally part of the task deliverable.
* Clean accidental temp artifacts before `task.push`.
* If a worker requires repo-local instructions, copy the temp file into `.task/<area>/<task-name>/`.
* If a direct Codex command is used, avoid unsupported flags. For the current Codex CLI, use:

```bash
codex exec --cd "$PWD" --sandbox workspace-write --json - < /tmp/<task-name>-instructions.md
```

* Do not include `--ask-for-approval never` unless the local Codex CLI help confirms that flag is supported.
* After a worker or direct Codex run, inspect stdout/stderr logs, task diff, and trace output before pushing.

