# Add configurable workspace keyboard shortcuts and scalable trace search

branch: task/os/add-configurable-workspace-keyboard-shortcuts-and-scalable-trace-search
stream: stream/os
pr: https://github.com/consuelohq/opensaas/pull/2802
started: 2026-11-14

## acceptance criteria

- [ ] 1-9, 0 use live route-menu order (internal and custom links included), not hardcoded routes.
- [ ] Shortcuts skip text editing, IME, modified keys, current modal.
- [ ] ? opens accessible page-specific Help, closes cleanly and restores focus.
- [ ] Tracing arrows and j/k anchor hovered trace or peer, continue keyboard focus, Enter opens, Escape backs out.
- [ ] Slash search filters locally immediately, server search debounced, canceled on changes, bounded keyset paginated, no raw JSON scans.
- [ ] Build shipped browser bundle, behavior tests, review, verification, publish and release.

## plan

1. Inspect shared chrome and current Trace Burn v38 code and browser bundle; preserve working slash search and virtualizer.
2. Write focused failing tests for global keys/help, hover navigation, bounded search.
3. Implement and build browser bundle; validate interaction with deterministic browser fixtures.
4. Run tests/review/verify, promote task to stream and release via safe gates.

## test-first contract

behavior under test: DOM menu order routes numeric keys; accessible contextual '?' help; hovered row/peer drives first arrow; search uses cancellable, debounced, paginated local-backed SQL.
existing local pattern: packages/os/tests/workspace-chrome.test.ts, trace-site-inspector-interactions.test.ts, observability-traces-site.test.ts and v38 browser sources.
new or changed tests: workspace-chrome dynamic route keyboard/help tests; Trace Burn hover keyboard source assertions and request batch regression.
focused red command: bun --cwd packages/os test tests/workspace-chrome.test.ts tests/trace-site-inspector-interactions.test.ts
expected red failure: shortcut helper/rendering and hover anchor behavior absent.
no-test waiver: none.

## files changed

- none yet

## key decisions

- Preserve v38 virtual list and cursor backend, and the database-side structured/metadata search, rather than creating a second search implementation.
- Search raw JSON payloads would require a separately indexed FTS design; exclude unindexed large payload scans from this change.
- Numeric bindings are read from the rendered route menu after runtime custom-route injection, with a 10-link maximum.

## notes for ko

- Internal Users & installs shifts downstream digits dynamically. 0 means tenth visible route if present.
- Existing slash search and infinite scroll already exist; goal is to make them consistent, ergonomic, and cheaper under typing.

## improvements noticed

- Tracing already has j/k, arrows, slash search, local filtering, a 140ms DB debounce, cursor pagination and TanStack virtualization.

## errors i ran into

- Parallel explore calls contended SQLite; switched to sequential reads. Initial workpad write required force=true on existing file.

- 2026-11-14 03:21:52 write: `.task/os/add-configurable-workspace-keyboard-shortcuts-and-scalable-trace-search/workpad.md`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-11-14 03:21:52 fs.write: `.task/os/add-configurable-workspace-keyboard-shortcuts-and-scalable-trace-search/workpad.md`
- 2026-11-14 03:22:28 fs.write: `.task/os/add-configurable-workspace-keyboard-shortcuts-and-scalable-trace-search/workpad.md`
- 2026-11-14 03:28:21 fs.write: `.task/os/add-configurable-workspace-keyboard-shortcuts-and-scalable-trace-search/workpad.md`
- 2026-11-14 03:29:12 fs.write: `.task/os/add-configurable-workspace-keyboard-shortcuts-and-scalable-trace-search/workpad.md`
- 2026-11-14 03:29:47 fs.write: `.task/os/add-configurable-workspace-keyboard-shortcuts-and-scalable-trace-search/workpad.md`
- 2026-11-14 03:33:18 fs.write: `.task/os/add-configurable-workspace-keyboard-shortcuts-and-scalable-trace-search/workpad.md`
- 2026-11-14 03:33:38 fs.write: `.task/os/add-configurable-workspace-keyboard-shortcuts-and-scalable-trace-search/workpad.md`
- 2026-11-14 03:34:20 fs.write: `.task/os/add-configurable-workspace-keyboard-shortcuts-and-scalable-trace-search/workpad.md`
- 2026-11-14 03:34:58 fs.write: `.task/os/add-configurable-workspace-keyboard-shortcuts-and-scalable-trace-search/workpad.md`

## workspace-owned: files read

- `packages/os/package.json`
- `packages/os/scripts/lib/observability-traces-site.ts`
- `packages/os/scripts/lib/trace-site-inspector/browser.ts`
- `packages/os/scripts/lib/trace-site-inspector/interactions.ts`
- `packages/os/scripts/lib/trace-site-inspector/virtual-list-browser.ts`
- `packages/os/scripts/lib/workspace-chrome.ts`
- `packages/os/skills/sites/SKILL.md`
- `packages/os/skills/task/SKILL.md`
- `packages/os/tests/trace-request-budget.test.ts`
- `packages/workspace/scripts/lib/verify-run-state.js`
- `packages/workspace/scripts/verify.js`

## focused red evidence

- 2026-11-14: `bun --cwd packages/os test tests/workspace-chrome.test.ts tests/trace-site-inspector-interactions.test.ts` exited 1 with 3 expected failures and 15 passes: no shortcut help DOM, no dynamic numeric navigation, and `traceArrowAnchor` not implemented. Red-before-production-edit gate satisfied.

- 2026-11-14 03:22:28 append: `.task/os/add-configurable-workspace-keyboard-shortcuts-and-scalable-trace-search/workpad.md`

- 2026-11-14 03:23:23 apply-patch: `packages/os/scripts/lib/workspace-chrome.ts`
- 2026-11-14 03:23:35 apply-patch: `packages/os/scripts/lib/trace-site-inspector/interactions.ts`
- 2026-11-14 03:23:35 apply-patch: `packages/os/scripts/lib/trace-site-inspector/virtual-list-browser.ts`
- 2026-11-14 03:23:35 apply-patch: `packages/os/scripts/lib/trace-site-inspector/browser.ts`
- 2026-11-14 03:23:35 apply-patch: `packages/os/scripts/lib/trace-site-inspector/pagination-browser.ts`
- 2026-11-14 03:23:35 apply-patch: `packages/os/scripts/lib/observability-traces-site.ts`

- 2026-11-14 03:23:54 apply-patch: `packages/os/scripts/lib/trace-site-inspector/browser.ts`
- 2026-11-14 03:23:54 apply-patch: `packages/os/tests/workspace-chrome.test.ts`
- 2026-11-14 03:23:54 apply-patch: `packages/os/scripts/lib/workspace-chrome.ts`

- 2026-11-14 03:24:05 apply-patch: `packages/os/scripts/lib/observability-traces-site.ts`
- 2026-11-14 03:24:28 apply-patch: `packages/os/tests/workspace-chrome.test.ts`

- 2026-11-14 03:26:25 apply-patch: `packages/os/scripts/lib/trace-site-inspector/virtual-list-browser.ts`
- 2026-11-14 03:26:25 apply-patch: `packages/os/scripts/lib/trace-site-inspector/browser.ts`
- 2026-11-14 03:26:37 apply-patch: `packages/os/tests/observability-traces-site.test.ts`

- 2026-11-14 03:27:27 apply-patch: `packages/os/scripts/lib/trace-site-inspector/browser.ts`

- 2026-11-14 03:27:49 apply-patch: `packages/os/tests/observability-traces-site.test.ts`
## implementation and proof (2026-11-14)

- Universal keyboard bindings in `workspace-chrome.ts` derive from visible anchor DOM order (includes dynamically inserted custom/Internal routes) and render numeric keycaps. 1–9 and 0 operate on first 10 routes, with text-editing, IME, modifier and modal guards. '?' opens accessible, dismissible, contextual native dialog with dynamically generated route labels, live markup-provided per-page entries, focus restoration and Escape suppression.
- Tracing source has '/' search restored against the current `data-workspace-clock` chrome (previously required obsolete `data-trace-clock`, making shortcut a no-op); both clock conventions supported.
- Hovered table rows and inspector peers seed first arrow, then keyboard state handles subsequent arrows; Enter also opens hovered trace. Existing j/k, f, Esc, copy, scroll-to-top preserved.
- Immediate local search clears old server results so prefixes do not briefly filter stale result sets. Debounced remote search 240ms, minimum remote query 2 chars, 50-row initial pages and cursor pagination, abort of superseded requests. Search remains scoped to metadata by existing parameterized SQL, avoiding an unindexed scan of sensitive payload fields. Current virtualization preserved.
- Rebuilt `packages/os/assets/vendor/observability-traces-v38/inspector.js` via `bun run build:observability-traces-runtime`; linked existing main-worktree @tanstack dependency in gitignored task-only node_modules for build, did not change package manifests or ship symlinks.
- Browser E2E `workspace-chrome.test.ts`: actual internal host, dynamic custom/Internal menu order, numeric key 5 navigation, ? accessibility/contents/close, input guard: pass.
- Browser E2E `observability-traces-site.test.ts`: real generated inline JS with fixture gateway rows, hovered up/down and Enter, page-specific ? guide, / search, no remote request for single character, exactly one remote request for fs.read, limit 50 and only matching row: pass.
- Focused suite: `bun run test tests/workspace-chrome.test.ts tests/trace-site-inspector-interactions.test.ts tests/trace-search-query.test.ts tests/observability-traces-site.test.ts` from packages/os: 39/39 PASS.
- `bun run typecheck` in packages/os: PASS (`workspace script syntax checks passed`).
- `git.diff` working-tree: ten product source/test/bundle files changed plus scoped task metadata. No unrelated code edits.
- In-place UI/browser tests ran headless Playwright using isolated mocked same-origin gateway; no real provider calls, sessions, billing, credentials, or database mutations.

## issues and fixes

- First E2E test timed out because `openTraceSearch()` required `data-trace-clock` missing from shared workspace chrome; fixed by accepting `data-workspace-clock` too and reran E2E green.
- Task worktree was missing @tanstack/virtual-core in local packages/os/node_modules; reused existing installed local dependency via gitignored symlink, rebuilt browser bundle successfully, no dependency lockfile changes.
- Partial one-character searches filter only already loaded traces, by design, to avoid scanning entire history until query has two characters. Raw JSON payload search remains intentionally out of scope.

- 2026-11-14 03:28:21 append: `.task/os/add-configurable-workspace-keyboard-shortcuts-and-scalable-trace-search/workpad.md`

## workspace-owned: validation evidence

- 2026-11-14 03:28:33 `review.run`: passed — OK
- 2026-11-14 03:33:32 `review.run`: passed — OK
- 2026-11-14 03:34:52 `verify`: passed — OK

## verification wait plan

Wait reason: formal OS verify worker pid 42349 returned VERIFY_PENDING (running) after review.run completed cleanly.
Duration: 15 seconds; bounded polling with immediate verify recheck.
Resume action: os.call tool=verify taskSession=tsk_62d1debb61ca input={base:origin/main,noDb:true}.
Expected signal: status VERIFY_PASSED with publishValid true and a written stamp; fallback: collect verify worker progress and repeat a bounded poll, then stop publish if there is a real gate failure.

- 2026-11-14 03:29:12 append: `.task/os/add-configurable-workspace-keyboard-shortcuts-and-scalable-trace-search/workpad.md`

Verification wait cycle 1: OS wait 15s completed 03:29:30Z; immediate verify still VERIFY_PENDING, phase running, pid 42349 alive elapsed 1m07s. Next: bounded 25-second poll and verify. No publish while pending.

- 2026-11-14 03:29:47 append: `.task/os/add-configurable-workspace-keyboard-shortcuts-and-scalable-trace-search/workpad.md`

- 2026-11-14 03:32:27 apply-patch: `packages/os/tests/trace-request-budget.test.ts`
## Full verify regression and fix (2026-11-14)

- Initial formal verify produced publishValid=false after test-selection identified a timing-sensitive assertion in `packages/os/tests/trace-request-budget.test.ts`: the first request for `tool:fs.read` did not appear inside a fixed 600 ms timeout when tests ran concurrently, so expected 1 request but observed 0. Review and database checks otherwise passed.
- Focused reproduction of the test alone passed. Corrected the flaky fixed-time request-budget assertion to await the single expected request via `page.waitForFunction` bounded to 5 seconds, preserving the important exact-count assertion and the zero-automatic-scroll-request property.
- Reran `bun test tests/trace-request-budget.test.ts` from packages/os: 12 passed, 0 failed, 61 assertions, 13.23s. Changed only the relevant test, not application code.
- Repeat full formal verify on the new task changeset is mandatory before `task.push`; never publish from the initial failed run.

- 2026-11-14 03:33:18 append: `.task/os/add-configurable-workspace-keyboard-shortcuts-and-scalable-trace-search/workpad.md`

Verification retry wait: worker PID 51546, runKey 9780110f3ac704e7bacdcc0ba994c89e703fb6011f826e6e288933119d152af1, phase launching. Wait reason: formal full selection/review worker is active. Duration: 25s, then immediately os.call verify with same task session and base origin/main. Expected: VERIFY_PASSED with publishValid=true and written stamp, otherwise inspect isolated worker logs and fix actual failure before publish.

- 2026-11-14 03:33:38 append: `.task/os/add-configurable-workspace-keyboard-shortcuts-and-scalable-trace-search/workpad.md`

Verification retry wait cycle 1: OS wait 25 seconds completed; immediate verify returned VERIFY_PENDING running pid 51546; worker stdout and stderr still empty (likely running review or selected test suite). Next bounded 25-second wait then immediate verify read; preserve unchanged source and do not publish while pending.

- 2026-11-14 03:34:20 append: `.task/os/add-configurable-workspace-keyboard-shortcuts-and-scalable-trace-search/workpad.md`

## Formal verification passed (2026-11-14)

- After stabilizing the request-budget browser test, `review.run` against `origin/main` returned 0 blocking issues.
- `verify` on the current task changeset returned `passed:true`, `publishValid:true`, and stamp `.task/os/add-configurable-workspace-keyboard-shortcuts-and-scalable-trace-search/verify.json` written. All seven critical selected suites passed, including trace gateway/history, canonical TraceStore, persistence/search, browser request budget, internal workspace shell, syntax, and workspace session integration. DB guards passed, no risks.
- Ready to execute OS task.push, promote to stream/os and ship through approved release gates. Record exact PRs and SHA afterward.

- 2026-11-14 03:34:58 append: `.task/os/add-configurable-workspace-keyboard-shortcuts-and-scalable-trace-search/workpad.md`
