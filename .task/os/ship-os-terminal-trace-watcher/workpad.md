# Ship OS terminal trace watcher

branch: `task/os/ship-os-terminal-trace-watcher`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1518/ship-os-terminal-trace-watcher
github pr: https://github.com/consuelohq/opensaas/pull/1518
started: 2026-07-15

## acceptance criteria

- [x] Move the proven lightweight `trace:watch` implementation under `packages/os` with no runtime dependency on Workspace or OpenTUI.
- [x] Make both repository-root and `packages/os` `bun run trace:watch` commands invoke the OS-owned watcher.
- [x] Default to the canonical OS trace sidecar resolver (`CONSUELO_TRACE_DB`, then `TRACE_DB`, then `$CONSUELO_HOME/node/db/traces.db`) while retaining `--db` as the highest-priority CLI override.
- [x] Preserve live polling, one-shot history, filters, JSON/raw JSON, nested operations, token enrichment, test-failure classification, branch coloring, terminal alignment, lock tolerance, and code.call quality summaries.
- [x] Port the valuable terminal-watcher behavior tests into `packages/os` and add a real CLI/canonical-sidecar smoke test.
- [x] Remove the donor root implementation and Workspace watcher test after OS ownership is proven.
- [x] Do not port or modify the OpenTUI trace home; the Hono Trace Site remains a separate pass.
- [x] Focused tests, typecheck, strict review, and verify pass before promotion to `stream/os`.

## plan

1. Port the existing watcher behavior tests to OS and add CLI/default-sidecar assertions before production edits.
2. Run the focused OS suite red against the missing OS-owned watcher.
3. Move the watcher implementation under `packages/os`, replace the OpenWorkspace hard-coded path with the canonical OS resolver, and update usage text.
4. Point root and package scripts at the OS watcher; document the command; remove the donor implementation/test.
5. Run focused unit and real SQLite CLI tests, inspect the complete diff, then run typecheck, strict review, verify, push, and promote.

## test-first contract

- Behavior under test: the OS-owned watcher preserves the established terminal rendering and nested-operation semantics, resolves the canonical OS sidecar by default, honors `--db`, and can print a real `tool_traces` row through `bun run trace:watch --once`.
- Existing local pattern: `scripts/operator/trace-watch.ts` and `packages/workspace/tests/trace-watch.test.ts`; canonical path resolver in `packages/os/scripts/lib/trace-persistence.ts`.
- New tests: `packages/os/tests/trace-watch.test.ts` with the twelve donor behavior cases plus path precedence, package-script ownership, and real SQLite CLI output.
- Focused red command: `bun --cwd packages/os test tests/trace-watch.test.ts`.
- Expected red failure: `packages/os/scripts/trace-watch.ts` does not exist and `packages/os/package.json` has no `trace:watch` script.
- No-test waiver: none; this is a CLI/runtime ownership migration.

## current status

- Implementation complete and ready for review.
- The lightweight line-oriented watcher is now OS-owned and reads the canonical OS trace sidecar.
- Root and package commands both resolve to the OS implementation.
- The donor Workspace implementation/test are removed; OpenTUI and the separate Hono Trace Site are untouched.
- Focused behavior, real SQLite CLI, persistence, typecheck, and test-selection checks are green.

## files changed

- `packages/workspace/tests/trace-watch.test.ts` (deleted)
- `scripts/operator/trace-watch.ts` (deleted)

## workspace-owned: files changed

- `packages/workspace/tests/trace-watch.test.ts` (deleted)
- `scripts/operator/trace-watch.ts` (deleted)

## workspace-owned: activity log

- 2026-07-15 23:29:19 fs.write: `.task/os/ship-os-terminal-trace-watcher/workpad.md`
- 2026-07-15 23:30:18 fs.trash: `scripts/operator/trace-watch.ts`
- 2026-07-15 23:30:18 fs.trash: `packages/workspace/tests/trace-watch.test.ts`

## workspace-owned: validation evidence

- Red: `bun --cwd packages/os test tests/trace-watch.test.ts` failed because `packages/os/scripts/trace-watch.ts` did not exist.
- Green: OS watcher behavior and real canonical-sidecar CLI suite — 16/16 passed.
- Green: canonical trace persistence regression — 8/8 passed.
- Green: `bun --cwd packages/os run typecheck`.
- Green: root `bun run trace:watch -- --help` resolves to the OS watcher.
- Green: `bun run test-selection:check`; future watcher edits select the OS behavior suite.
- Green: strict `review.run` — 0 findings after replacing donor `console.*` usage with explicit stdout/stderr writers and typing caught errors.
- Green: `verify` — publish-valid; registry selected and passed Workspace test-selection (6 tests), OS trace watcher behavior (16 tests), and the OS package contract.
- Ownership scan: no active stale donor references, OpenTUI imports, OpenWorkspace paths, hard-coded legacy DB path, or untyped `any` remain in the OS watcher.
- 2026-07-15 23:34:48 `review.run`: passed — OK
- 2026-07-15 23:36:00 `review.run`: passed — OK
- 2026-07-15 23:36:13 `verify`: passed — OK

## key decisions

- Workspace is donor code only; no permanent Workspace parity test or runtime dependency will remain.
- Preserve the lightweight line-oriented terminal feed shown by Ko, including branch colors and formatting.
- Do not port OpenTUI or mix the separate Hono Trace Site pass into this task.
- Keep `--db` above environment/default resolution for explicit operator inspection.

## notes for ko

- The root command will remain `bun run trace:watch`, but ownership moves to `packages/os/scripts/trace-watch.ts`.

## improvements noticed

- The donor watcher used one untyped `any` in JSON parsing; the OS port now returns `unknown` and narrows values before use.
- The old test-selection rule only compiled the donor file; it now runs the full OS behavior/SQLite CLI suite.

## issues and recovery

- The first skill read was ambiguous because other task worktrees were active. Opened the approved task and reread the engineering guide with the returned task session.
- Initial workpad overwrite omitted the required `force` flag; retried without touching production code.
- Initial structured diff used an unavailable local `stream/os` ref; recovered with the correct working-tree diff mode.
- The first branch-color assertion used an invalid regular expression and failed during Vitest transform; simplified it to deterministic ANSI-presence and stable-output assertions, then passed 16/16.
- First strict review reported 17 OS logging-policy findings and one catch-typing finding inherited from the donor. Replaced `console.*` with line-oriented stdout/stderr helpers and typed both error paths; strict review then passed with 0 findings.
- A broad stale-reference scan found historical task/audit records plus two active test-selection entries. Historical evidence remains immutable; the active rules/registry were migrated to OS.

---

## publish checklist

```bash
bun run task:push -- --message "feat(os): ship terminal trace watcher" --changed
bun run task:pr
bun run task:finish
```

## workspace-owned: files read

- `packages/workspace/senior-engineer.md`
- `scripts/operator/trace-watch.ts`
- `packages/workspace/tests/trace-watch.test.ts`
- `packages/os/scripts/lib/trace-persistence.ts`
- `packages/os/tests/trace-persistence.test.ts`
- `packages/os/package.json`
- `package.json`
- `packages/os/SCRIPTS.md`

- 2026-07-15 23:29:19 write: `.task/os/ship-os-terminal-trace-watcher/workpad.md`

## validation

- `bun --cwd packages/os test tests/trace-watch.test.ts`: 16 passed.
- `bun --cwd packages/os test tests/trace-persistence.test.ts`: 8 passed.
- `bun --cwd packages/os run typecheck`: passed.
- `bun run test-selection:check`: passed; 6 selected suites and the trace-watch rule is active.
- Root and package scripts point to `packages/os/scripts/trace-watch.ts`.
- Real SQLite smoke reads `$CONSUELO_HOME/node/db/traces.db` without `--db` and renders tool, tokens, branch, and result detail.
- Strict review: 0 findings.
- Verify: publish-valid.

## workspace-owned: test selection

- changed files: `.task/os/ship-os-terminal-trace-watcher/current.json`, `.task/os/ship-os-terminal-trace-watcher/evidence-log.json`, `.task/os/ship-os-terminal-trace-watcher/read-log.json`, `.task/os/ship-os-terminal-trace-watcher/session.json`, `.task/os/ship-os-terminal-trace-watcher/workpad.md`, `.task/tasks/os/ship-os-terminal-trace-watcher.json`, `package.json`, `packages/os/SCRIPTS.md`, `packages/os/package.json`, `packages/os/scripts/trace-watch.ts`, `packages/os/tests/trace-watch.test.ts`, `packages/workspace/test-selection.registry.json`, `packages/workspace/test-selection.rules.json`, `packages/workspace/tests/trace-watch.test.ts`, `scripts/operator/trace-watch.ts`
- matched rules: `workspace-test-selection`, `trace-watch`, `auto:@consuelo/os:package-test`
- selected suites: `workspace test selection tests`, `OS trace watcher behavior`, `@consuelo/os package test`
- run results: `workspace test selection tests` passed, `OS trace watcher behavior` passed, `@consuelo/os package test` passed
- failed suites: none
