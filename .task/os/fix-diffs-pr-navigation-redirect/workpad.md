# fix diffs PR navigation redirect

branch: `task/os/fix-diffs-pr-navigation-redirect`
stream: `stream/os`
pr: https://github.com/consuelohq/opensaas/pull/2427
started: 2026-09-10

## acceptance criteria

- [ ] PR rows on the mounted Consuelo Diffs index navigate to `/diffs/<owner>/<repo>/pull/<number>` instead of escaping to the workspace root.
- [ ] Mouse, keyboard/card, and command-palette PR navigation all use the same mounted review route.
- [ ] Standalone/default Diff Cockpit rendering keeps its existing root-relative route behavior when no mount path is configured.
- [ ] The authenticated OS `/diffs` page has a regression contract proving mounted PR navigation, and the real browser flow no longer falls back to Home.
- [ ] Focused tests, review, verify, and task promotion to `stream/os` are green.

## plan

1. Freeze the mounted-navigation regression in the nearest Diff Cockpit render test and the OS route contract.
2. Run the focused test red against the current index client, which hard-codes `/<owner>/<repo>/pull/`.
3. Thread the existing `mountPath` render option into index client PR route generation without changing standalone behavior.
4. Run focused green tests, static/type checks, then browser-smoke the mounted `/diffs` click path.
5. Inspect the diff, run review/verify, push PR #2427, promote it into `stream/os`, and verify final branch state.

## Test-first contract

behavior under test: `renderIndexPage(..., { mountPath: '/diffs' })` must emit client-side PR navigation rooted at `/diffs/<owner>/<repo>/pull/`; row anchors, row/card activation, and command-search PR activation must all derive from that mounted prefix.
existing local pattern: `renderIndexPage` already uses `mountedPath(...)` for code navigation and `normalizedMountPath(...)` for its home link; review/code/history renderers already consume the same render options.
new or changed tests: add a focused `renderIndexPage` mounted-route assertion in `packages/diff-cockpit/tests/diff-cockpit.test.ts`, and strengthen `packages/os/tests/diffs-hono-routes.test.ts` so the authenticated `/diffs` HTML proves the mounted PR prefix is embedded.
focused red command: `bun test packages/diff-cockpit/tests/diff-cockpit.test.ts --test-name-pattern "mounted PR navigation"` (or the repository-equivalent focused Bun test invocation after preflight).
expected red failure: current `renderIndexClientScript` hard-codes the repo-root PR prefix, so mounted `/diffs` rendering lacks the `/diffs/<owner>/<repo>/pull/` client route.
no-test waiver: not applicable.

## current status

- Root cause isolated before production edits: the index page receives `mountPath: '/diffs'`, but `renderIndexClientScript` ignores render options and hard-codes a root-relative PR prefix. The workspace router therefore receives a non-Diffs path and the UI falls back to Home.

## files changed

- none yet

## key decisions

- Fix route construction at the shared Diff Cockpit render boundary rather than adding a workspace-specific click interceptor.
- Preserve standalone behavior by defaulting the mounted prefix to the existing root-relative route when `mountPath` is absent.

## notes for ko

- The screenshot behavior matches the source exactly: Code renders correctly under `/diffs`, then PR clicks escape that mount because only PR navigation was still hard-coded.

## improvements noticed

- none yet

## errors i ran into

- `context.search` was absent from the generated OS manifest; recovered with the supported `memory`/`explore` surfaces. No task mutation was lost.
- Initial workpad overwrite omitted `force`; the workspace rejected it safely and the corrected `fs.write` call replaced only this task workpad.

---

## publish checklist

```bash
bun run task:push -- --message "type(os): description" --changed
bun run task:pr
bun run task:finish
```

- 2026-09-10 00:10:24 write: `.task/os/fix-diffs-pr-navigation-redirect/workpad.md`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-09-10 00:10:24 fs.write: `.task/os/fix-diffs-pr-navigation-redirect/workpad.md`
- 2026-09-10 00:17:37 fs.write: `.task/os/fix-diffs-pr-navigation-redirect/workpad.md`

## workspace-owned: files read

- `packages/diff-cockpit/tests/diff-cockpit.test.ts`

- 2026-09-10 00:10:36 apply-patch: `packages/diff-cockpit/tests/diff-cockpit.test.ts`
- 2026-09-10 00:10:50 apply-patch: `packages/os/tests/diffs-hono-routes.test.ts`
- 2026-09-10 00:10:53 apply-patch: `packages/diff-cockpit/src/index.ts`

## workspace-owned: validation evidence

- 2026-09-10 00:13:16 `review.run`: passed — OK
- 2026-09-10 00:15:32 `verify`: failed — COMMAND_FAILED
- 2026-09-10 00:16:56 `verify`: failed — COMMAND_FAILED
- 2026-09-10 00:17:17 `review.run`: passed — OK
- 2026-09-10 00:17:27 `verify`: passed — OK

## implementation status

- [x] PR rows on the mounted Consuelo Diffs index navigate under `/diffs/<owner>/<repo>/pull/<number>`.
- [x] Row anchor, card/keyboard activation, and command-palette PR results share the mounted route prefix.
- [x] Standalone rendering still emits the original root-relative PR route when no mount is configured.
- [x] OS route regression coverage proves `/diffs` embeds the mounted PR prefix.
- [x] Browser smoke clicked PR #2427 from a task-branch preview and remained at `/diffs/consuelohq/opensaas/pull/2427` after an additional 2.2 seconds.

## validation

- RED: focused mounted-navigation test failed on the old hard-coded root prefix exactly as expected.
- GREEN: `packages/diff-cockpit/tests/diff-cockpit.test.ts` — 41/41 passed, 408 assertions.
- GREEN: `packages/os/tests/diffs-hono-routes.test.ts` — 10/10 passed.
- GREEN: `packages/os` syntax/typecheck script — `workspace script syntax checks passed`.
- GREEN: Bun build of `packages/diff-cockpit/src/index.ts` completed successfully.
- GREEN: `review.run` strict against `origin/stream/os` — 0 issues, 0 blockers.
- GREEN: full `verify` against `origin/stream/os` — `passed: true`, `publishValid: true`.
- NOTE: the package-level Diff Cockpit `tsc` command still reports its pre-existing Bun matcher typing errors for `toHaveProperty` at test lines 79-80; neither line is changed by this task. The source build and complete runtime test suite are green.
- NOTE: an earlier verify attempt used stale local `stream/os` instead of the task's actual parent `origin/stream/os`, so it incorrectly pulled unrelated stream commits into the verify scope. Re-running against the actual merge base reduced scope to the three intended files and passed.

## implementation files

- `packages/diff-cockpit/src/index.ts` — pass `DiffCockpitRenderOptions` into index client generation and derive PR routes through `mountedPath`.
- `packages/diff-cockpit/tests/diff-cockpit.test.ts` — regression contract for mounted and standalone PR prefixes.
- `packages/os/tests/diffs-hono-routes.test.ts` — authenticated `/diffs` route contract for the mounted PR prefix.

- 2026-09-10 00:17:37 append: `.task/os/fix-diffs-pr-navigation-redirect/workpad.md`
