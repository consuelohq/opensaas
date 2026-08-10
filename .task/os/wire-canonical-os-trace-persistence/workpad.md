# Wire canonical OS trace persistence

branch: `task/os/wire-canonical-os-trace-persistence`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1517/wire-canonical-os-trace-persistence
github pr: https://github.com/consuelohq/opensaas/pull/1517
started: 2026-07-15

## acceptance criteria

- [x] Add one OS-owned canonical trace database resolver with `CONSUELO_TRACE_DB` override and a default sidecar beside `consuelo.db`.
- [x] Create and migrate the existing `tool_traces` schema in production code.
- [x] Persist every OS facade result, including validation/auth/command failures, without changing the returned tool result.
- [x] Preserve task session, branch, worktree, input, resolved input, result, stderr, duration, status/code, and token fields when available.
- [x] Persist parsed OS subagent child events with parent trace correlation and fail-open semantics.
- [x] Make the Hono Trace gateway read the same canonical database resolver.
- [x] Configure the daemon runtime with the canonical `CONSUELO_TRACE_DB` path.
- [x] Prove the writer and Hono reader against a real temporary SQLite database.
- [x] Keep Trace Site UI and terminal watcher migration out of this task.

## plan

1. Add red production-integration tests for canonical path resolution, facade persistence, subagent child ingestion, fail-open behavior, and Hono read parity.
2. Implement an OS-owned SQLite trace persistence module by adapting the proven `tool_traces` schema and ingestion behavior.
3. Route facade logging and subagent event ingestion through the persistence module.
4. Route Hono Trace reads and daemon environment through the same resolver.
5. Run focused tests, inspect the complete diff, then run strict review and verify.

## test-first contract

- Behavior under test: a real facade execution writes one redacted `tool_traces` row to the canonical OS sidecar; parsed subagent events write correlated child rows; the Hono read backend sees those rows; a trace database failure never changes the tool result.
- Existing local pattern: Workspace `tool_traces` schema and subagent ingestion in `packages/workspace/scripts/lib/subagent/runtime.ts`; OS real-SQLite read proof in `packages/os/tests/trace-sites-gateway-live-endpoints.test.ts`.
- New tests: `packages/os/tests/trace-persistence.test.ts`, plus focused installer/daemon assertion where needed.
- Focused red command: `bun --cwd packages/os test tests/trace-persistence.test.ts`.
- Expected red failure: canonical resolver/persistence exports do not exist and facade calls currently emit stderr JSON only.

## current status

- Ready to publish. Focused real-Bun/SQLite integration, affected regressions, strict review, and syntax validation are green.

## files changed

- `packages/os/SCRIPTS.md`
- `packages/os/scripts/lib/consuelo-home.ts`
- `packages/os/scripts/lib/facade/executor.ts`
- `packages/os/scripts/lib/facade/logger.ts`
- `packages/os/scripts/lib/redaction.ts`
- `packages/os/scripts/lib/subagent/runtime.ts`
- `packages/os/scripts/lib/trace-persistence.ts`
- `packages/os/scripts/server/services/oauth-introspection.ts`
- `packages/os/scripts/server/services/trace-gateway.ts`
- `packages/os/scripts/start-consuelo-daemon.sh`
- `packages/os/tests/fixtures/trace-persistence-runtime.ts`
- `packages/os/tests/redaction.test.ts`
- `packages/os/tests/trace-persistence.test.ts`

## workspace-owned: files changed

- `packages/os/scripts/lib/trace-persistence.ts`
- `packages/os/tests/fixtures/trace-persistence-runtime.ts`
- `packages/os/tests/trace-persistence.test.ts`

## workspace-owned: activity log

- 2026-07-15 22:49:21 fs.write: `packages/os/tests/trace-persistence.test.ts`
- 2026-07-15 22:51:07 fs.write: `packages/os/scripts/lib/trace-persistence.ts`
- 2026-07-15 22:55:03 fs.write: `packages/os/tests/fixtures/trace-persistence-runtime.ts`
- 2026-07-15 22:55:46 fs.write: `packages/os/tests/trace-persistence.test.ts`

## workspace-owned: validation evidence

- 2026-07-15 23:08:07 `review.run`: passed — OK
- 2026-07-15 23:09:19 `review.run`: passed — OK
- 2026-07-15 23:10:00 `review.run`: passed — OK
- 2026-07-15 23:10:41 `verify`: failed — COMMAND_FAILED
- 2026-07-15 23:12:59 `review.run`: passed — OK
- 2026-07-15 23:13:13 `verify`: passed — OK

## key decisions

- Keep `consuelo.db` for operational state and use `node/db/traces.db` as the high-volume observability sidecar.
- `CONSUELO_TRACE_DB` is the explicit override; `TRACE_DB` remains a compatibility fallback for readers.
- Reuse the established `tool_traces` schema and parent `mcp_trace_id` correlation instead of inventing a new model.
- Trace persistence is fail-open and must never fail the actual facade or subagent operation.
- Workspace is donor code only; no permanent Workspace parity dependency is introduced.
- Persist parent `code.call` and `batch` envelopes as well as their child rows so existing nested-operation tooling remains viable.
- Use a trace-specific redaction profile for generated trace IDs, task metadata, branch/worktree identifiers, log paths, and numeric token counters; all other credential and payload redaction remains strict.
- Run production SQLite integration in a Bun child process because the package test runner is Vitest and cannot load `bun:sqlite` directly.

## notes for ko

- This task intentionally excludes the `trace:watch` terminal move and Trace Site visual/live pass.
- Existing Vitest suites that directly import `bun:sqlite` or reference the global `Bun` object still fail before exercising their tests. The new integration suite deliberately launches the real Bun runtime and proves SQLite/Hono behavior there.

## improvements noticed

- The existing OS runtime-boundary test uses an in-memory store despite claiming canonical DB coverage; this task adds real SQLite integration proof rather than deleting that domain test.

## issues and recovery

- Two read-only discovery batches stopped on filename/directory assumptions. Retried with file filtering; no repository state was changed.
- The first integration harness attempted to load `bun:sqlite` inside Vitest. Recovered by moving production execution and SQLite inspection into a Bun fixture while retaining Vitest assertions.
- The generic redactor treated token-count keys as credentials and numeric trace suffixes/long branches as secrets. Added a narrow trace-safe profile; the generic logging redactor is unchanged.
- Broad legacy facade tests include unrelated stale media and temporary-worktree expectations. The directly affected standalone `code.call` path passes; the task integration suite covers parent `code.call` and `batch` trace persistence.

## validation

- Red proof: `bun --cwd packages/os test tests/trace-persistence.test.ts` failed because `scripts/lib/trace-persistence.ts` did not exist.
- Green proof: the same focused command passes 8/8 tests against real Bun SQLite, covering path resolution, migration, facade rows, `code.call`, `batch`, subagent children, fail-open behavior, Hono reads, OAuth denials, redaction, and daemon configuration.
- `bun --cwd packages/os test tests/redaction.test.ts`: 3/3 passed.
- `bun --cwd packages/os test tests/local-os-server-hono-architecture.test.ts`: 14/14 passed.
- `bun --cwd packages/os test tests/security-gateway.test.ts`: 23/23 passed.
- `bun --cwd packages/os test tests/bun-product-server-contract.test.ts`: 4/4 passed.
- Focused standalone `code.call` facade regression: passed.
- `bun --cwd packages/os run typecheck`: passed.
- Strict `review.run`: 0 findings.
- Non-blocking baseline test gaps: `trace-sites-gateway-live-endpoints`, `mcp-gateway`, `local-os-port-cutover`, and one local-server suite fail during Vitest module import because existing code/tests import `bun:sqlite`; `daemon-bun-path` uses global `Bun` under Vitest. No changed-path assertion fails in those suites.

---

## publish checklist

```bash
bun run task:push -- --message "type(os): description" --changed
bun run task:pr
bun run task:finish
```

## workspace-owned: files read

- `packages/os/SCRIPTS.md`
- `packages/os/package.json`
- `packages/os/scripts/lib/code-call/runtime.ts`
- `packages/os/scripts/lib/code-call/service.ts`
- `packages/os/scripts/lib/consuelo-home.ts`
- `packages/os/scripts/lib/facade/batch.ts`
- `packages/os/scripts/lib/facade/executor.ts`
- `packages/os/scripts/lib/facade/logger.ts`
- `packages/os/scripts/lib/facade/types.ts`
- `packages/os/scripts/lib/install-state.ts`
- `packages/os/scripts/lib/redaction.ts`
- `packages/os/scripts/lib/subagent/runtime.ts`
- `packages/os/scripts/lib/trace-persistence.ts`
- `packages/os/scripts/lib/trace-sites-local-read-backend.ts`
- `packages/os/scripts/server/middleware/auth.ts`
- `packages/os/scripts/server/middleware/errors.ts`
- `packages/os/scripts/server/routes/call.ts`
- `packages/os/scripts/server/routes/mcp.ts`
- `packages/os/scripts/server/services/oauth-introspection.ts`
- `packages/os/scripts/server/services/trace-gateway.ts`
- `packages/os/scripts/start-consuelo-daemon.sh`
- `packages/os/tests/facade/facade.test.ts`
- `packages/os/tests/fixtures/trace-persistence-runtime.ts`
- `packages/os/tests/install-state.test.ts`
- `packages/os/tests/redaction.test.ts`
- `packages/os/tests/trace-sites-gateway-live-endpoints.test.ts`
- `packages/workspace/scripts/lib/subagent/runtime.ts`
- `packages/workspace/senior-engineer.md`

- 2026-07-15 23:10:27 apply-patch: `.task/os/wire-canonical-os-trace-persistence/workpad.md`

## workspace-owned: test selection

- changed files: `.task/os/wire-canonical-os-trace-persistence/current.json`, `.task/os/wire-canonical-os-trace-persistence/evidence-log.json`, `.task/os/wire-canonical-os-trace-persistence/read-log.json`, `.task/os/wire-canonical-os-trace-persistence/session.json`, `.task/os/wire-canonical-os-trace-persistence/workpad.md`, `.task/tasks/os/wire-canonical-os-trace-persistence.json`, `packages/os/SCRIPTS.md`, `packages/os/scripts/lib/consuelo-home.ts`, `packages/os/scripts/lib/facade/executor.ts`, `packages/os/scripts/lib/facade/logger.ts`, `packages/os/scripts/lib/redaction.ts`, `packages/os/scripts/lib/subagent/runtime.ts`, `packages/os/scripts/lib/trace-persistence.ts`, `packages/os/scripts/server/services/oauth-introspection.ts`, `packages/os/scripts/server/services/trace-gateway.ts`, `packages/os/scripts/start-consuelo-daemon.sh`, `packages/os/tests/fixtures/trace-persistence-runtime.ts`, `packages/os/tests/redaction.test.ts`, `packages/os/tests/trace-persistence.test.ts`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: changed code selected zero suites; add a discoverable test or explicit rule when this is not intentional
