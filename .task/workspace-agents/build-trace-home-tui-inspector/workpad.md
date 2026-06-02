# build trace home tui inspector

branch: `task/workspace-agents/build-trace-home-tui-inspector`
stream: `stream/workspace-agents`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/682/build-trace-home-tui-inspector
github pr: https://github.com/consuelohq/opensaas/pull/682
started: 2026-06-02

## objective

Build `trace:home`, an interactive terminal trace homebase that preserves the live `trace:watch` feel while adding inspectable sections matching Ko's mockup: live trace rows, summary/sidebar, top tools, raw shell quality, selected trace inspector, tree view, and raw JSON/detail panes.

## acceptance criteria

- [ ] Add a pre-test-driven trace home model test that proves all required UI sections are populated from fixture trace rows before implementation.
- [ ] Add `bun run trace:home` script entrypoint.
- [ ] Preserve `trace:watch` as the lightweight live stream.
- [ ] Render a mockup-aligned dashboard with header, live table, summary, top tools, raw shell classification, selected inspector, trace tree, raw JSON, and key-hint footer.
- [ ] Support fixture/test mode for deterministic snapshot-style verification.
- [ ] Classify `task.call` command quality as `good`, `suspect`, or `bad` with reason and replacement when applicable.
- [ ] Reconstruct nested `batch` and `code.run` children.
- [ ] Keep branch color assignment deterministic.
- [ ] Document the new script in `packages/workspace/SCRIPTS.md`.
- [ ] Run focused tests, script build/check, diff inspection, review, and verify before publish.

## Test-first contract

Behavior under test:

- The trace home model fills every section from representative fixture traces: live rows, nested children, summary, top tools by tokens, raw shell totals, selected inspector, tree, and JSON/detail payloads.
- The renderer exposes every named UI panel from Ko's mockup in deterministic non-interactive output.
- Command-quality classification distinguishes intended runtime commands from repository inspection through shell and dangerous shell shapes.

Existing pattern to follow:

- `scripts/operator/trace-watch.ts` owns the current live trace stream, nested `batch` / `code.run` rendering, branch color hashing, compact detail extraction, and SQLite query pattern.
- `packages/workspace/tests/context-trace.test.js` shows fixture SQLite testing for trace tooling.
- `trace-analytics.ts` shows trace summary aggregation patterns.

Intended tests:

- `packages/workspace/tests/trace-home.test.ts` with pure fixture rows and renderer assertions.
- Focused red command: `bun --cwd packages/workspace run test packages/workspace/tests/trace-home.test.ts`.
- Expected red failure: module/script missing, because `scripts/operator/trace-home.ts` and exported helpers do not exist yet.

No-test waiver:

- None. This is explicitly pre-test-driven.

## exploration evidence

- Read `AGENTS.md`, `CODING-STANDARDS.md`, `packages/workspace/SCRIPTS.md`, `packages/workspace/package.json`, root `package.json`, `scripts/operator/trace-watch.ts`, `scripts/operator/trace-analytics.ts`, and `packages/workspace/tests/context-trace.test.js`.
- Project memory shows related trace-watch tasks: nested operations, batch child names, verify because rendering, and worker events into trace DB.
- `@opentui` is not currently installed. First implementation will build a deterministic terminal homebase without adding a new native dependency; OpenTUI can replace the terminal runtime later if the model contract stays stable.

## plan

1. Write failing model/renderer tests for all mockup sections.
2. Extract or duplicate the minimal shared trace normalization logic into `scripts/operator/trace-home.ts` with testable exports.
3. Add deterministic fixture render mode and live SQLite mode.
4. Add root `trace:home` package script.
5. Document usage in `packages/workspace/SCRIPTS.md`.
6. Validate with focused tests, build/smoke commands, review, verify, then push/promote.

## current status

- Task started. Stream sync hit an unrelated conflict in `packages/workspace/scripts/tools-search.ts`; task branch was created from `main` and work continues with the conflict recorded.

## files changed

- `packages/workspace/tests/trace-home.test.ts`
- `scripts/operator/trace-home.ts`


## workspace-owned: files changed

- `package.json`
- `packages/workspace/SCRIPTS.md`
- `packages/workspace/tests/trace-home.test.ts`
- `scripts/operator/trace-home.ts`

## workspace-owned: activity log

- 2026-06-02 00:28:01 fs.write: `.task/workspace-agents/build-trace-home-tui-inspector/workpad.md`
- 2026-06-02 00:29:32 fs.write: `packages/workspace/tests/trace-home.test.ts`
- 2026-06-02 00:31:58 fs.write: `scripts/operator/trace-home.ts`
- 2026-06-02 00:32:53 fs.patch: `package.json`
- 2026-06-02 00:33:24 fs.patch: `package.json`
- 2026-06-02 00:33:54 fs.patch: `package.json`
- 2026-06-02 00:34:22 fs.patch: `packages/workspace/tests/trace-home.test.ts`
- 2026-06-02 00:35:31 fs.patch: `packages/workspace/tests/trace-home.test.ts`
- 2026-06-02 00:36:16 fs.patch: `scripts/operator/trace-home.ts`
- 2026-06-02 00:36:36 fs.patch: `scripts/operator/trace-home.ts`
- 2026-06-02 00:37:59 fs.patch: `scripts/operator/trace-home.ts`
- 2026-06-02 00:38:31 fs.patch: `scripts/operator/trace-home.ts`
- 2026-06-02 00:39:39 fs.write: `packages/workspace/SCRIPTS.md`
- 2026-06-02 00:41:43 fs.patch: `scripts/operator/trace-home.ts`
- 2026-06-02 00:43:14 fs.patch: `scripts/operator/trace-home.ts`
- 2026-06-02 00:45:05 fs.patch: `scripts/operator/trace-home.ts`
- 2026-06-02 00:46:11 fs.patch: `scripts/operator/trace-home.ts`
- 2026-06-02 00:47:26 fs.patch: `scripts/operator/trace-home.ts`
- 2026-06-02 00:47:33 fs.patch: `scripts/operator/trace-home.ts`
- 2026-06-02 00:48:36 fs.trash: `.task/workspace-agents/build-trace-home-tui-inspector/build-check/trace-home.js`
- 2026-06-02 00:49:29 fs.patch: `scripts/operator/trace-home.ts`
- 2026-06-02 00:50:05 fs.trash: `.task/workspace-agents/build-trace-home-tui-inspector/build-check/trace-home.js`
- 2026-06-02 performed context/memory/code exploration.
- 2026-06-02 started task branch and PR.
- 2026-06-02 wrote test-first contract before implementation.

## workspace-owned: validation evidence

- 2026-06-02 00:51:37 `checkFiles`: passed — OK
- 2026-06-02 00:51:47 `audit`: passed — OK
- 2026-06-02 00:53:19 `review.run`: passed — OK
- 2026-06-02 00:53:36 `verify`: passed — OK

## key decisions

- Keep `trace:watch` intact and add `trace:home` as the interactive/homebase command.
- Keep the first implementation dependency-free and model-driven; the visual contract is the durable part.

## notes for ko

- The mockup is being treated as the acceptance contract: all visible sections should have deterministic test coverage.

## improvements noticed

- Stream sync currently conflicts with `packages/workspace/scripts/tools-search.ts`; this is outside the trace home task but will matter before promotion.

## issues and recovery

- `stream.sync` failed with a content conflict in `packages/workspace/scripts/tools-search.ts`. Task branch creation succeeded from `main`; this task will continue and surface the stream conflict again if promotion requires it.

---

## publish checklist

```bash
bun run task:push -- --message "feat(workspace): add trace home inspector" --changed
bun run task:pr
bun run task:finish
```

- 2026-06-02 00:28:01 write: `.task/workspace-agents/build-trace-home-tui-inspector/workpad.md`

- 2026-06-02 00:29:32 write: `packages/workspace/tests/trace-home.test.ts`

- 2026-06-02 00:31:58 write: `scripts/operator/trace-home.ts`

- 2026-06-02 00:32:53 patch lines 44-46: `package.json`

## workspace-owned: files read

- `package.json`
- `packages/workspace/SCRIPTS.md`
- `scripts/operator/trace-home.ts`

## workspace-owned: test selection

- changed files: `.task/tasks/workspace-agents/address-stream-review-feedback.json`, `.task/tasks/workspace-agents/build-trace-home-tui-inspector.json`, `.task/tasks/workspace-agents/remove-worker-trace-temp-helper-files.json`, `.task/tasks/workspace-agents/unify-worker-events-into-trace-db.json`, `.task/tasks/workspace/fix-tools-search-review-comments.json`, `.task/tasks/workspace/upgrade-tools-search-discovery.json`, `.task/workspace-agents/address-stream-review-feedback/current.json`, `.task/workspace-agents/address-stream-review-feedback/evidence-log.json`, `.task/workspace-agents/address-stream-review-feedback/read-log.json`, `.task/workspace-agents/address-stream-review-feedback/session.json`, `.task/workspace-agents/address-stream-review-feedback/verify.json`, `.task/workspace-agents/address-stream-review-feedback/workpad.md`, `.task/workspace-agents/build-trace-home-tui-inspector/current.json`, `.task/workspace-agents/build-trace-home-tui-inspector/evidence-log.json`, `.task/workspace-agents/build-trace-home-tui-inspector/read-log.json`, `.task/workspace-agents/build-trace-home-tui-inspector/session.json`, `.task/workspace-agents/build-trace-home-tui-inspector/workpad.md`, `.task/workspace-agents/remove-worker-trace-temp-helper-files/current.json`, `.task/workspace-agents/remove-worker-trace-temp-helper-files/session.json`, `.task/workspace-agents/remove-worker-trace-temp-helper-files/workpad.md`, `.task/workspace-agents/unify-worker-events-into-trace-db/current.json`, `.task/workspace-agents/unify-worker-events-into-trace-db/evidence-log.json`, `.task/workspace-agents/unify-worker-events-into-trace-db/read-log.json`, `.task/workspace-agents/unify-worker-events-into-trace-db/session.json`, `.task/workspace-agents/unify-worker-events-into-trace-db/verify.json`, `.task/workspace-agents/unify-worker-events-into-trace-db/workpad.md`, `.task/workspace/fix-tools-search-review-comments/current.json`, `.task/workspace/fix-tools-search-review-comments/evidence-log.json`, `.task/workspace/fix-tools-search-review-comments/read-log.json`, `.task/workspace/fix-tools-search-review-comments/session.json`, `.task/workspace/fix-tools-search-review-comments/verify.json`, `.task/workspace/fix-tools-search-review-comments/workpad.md`, `.task/workspace/upgrade-tools-search-discovery/current.json`, `.task/workspace/upgrade-tools-search-discovery/evidence-log.json`, `.task/workspace/upgrade-tools-search-discovery/read-log.json`, `.task/workspace/upgrade-tools-search-discovery/session.json`, `.task/workspace/upgrade-tools-search-discovery/verify.json`, `.task/workspace/upgrade-tools-search-discovery/workpad.md`, `package.json`, `packages/workspace/SCRIPTS.md`, `packages/workspace/TOOLS.md`, `packages/workspace/scripts/generate-docs.ts`, `packages/workspace/scripts/lib/facade/schemas.ts`, `packages/workspace/scripts/lib/worker/runtime.ts`, `packages/workspace/scripts/tools-search.ts`, `packages/workspace/src/generated/workspace.d.ts`, `packages/workspace/tests/facade/facade.test.ts`, `packages/workspace/tests/tools-search-v2.test.ts`, `packages/workspace/tests/trace-home.test.ts`, `packages/workspace/tooling/tool-manifest.json`, `scripts/operator/trace-home.ts`, `scripts/operator/trace-watch.ts`
- matched rules: `workspace-facade`, `trace-watch`, `workspace-audit-docs`
- selected suites: `workspace facade input contracts`, `trace watch build`, `workspace audit tests`
- run results: `workspace facade input contracts` passed, `trace watch build` passed, `workspace audit tests` passed
- failed suites: none
