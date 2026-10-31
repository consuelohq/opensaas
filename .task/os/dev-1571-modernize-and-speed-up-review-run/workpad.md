# DEV-1571 modernize and speed up review.run

branch: `task/os/dev-1571-modernize-and-speed-up-review-run`
stream: `stream/os`
pr: https://github.com/consuelohq/opensaas/pull/2735
started: 2026-10-31

## acceptance criteria

- [x] `review.run` runs the same change-aware, platform-specific test selection as `verify`: Bun, Vitest, Jest, OS, Dialer, docs, and websites are covered by owned rules; never silently limit testing to legacy Jest configs.
- [x] Changed non-JS/TS files do not trigger repository-wide ESLint/typecheck; `--all` preserves full-repo review.
- [x] Incomplete/failed test selection (including zero suites for critical matches), suite failures, or invocation errors fail closed with actionable output.
- [x] Preserve full JSON and compact semantic review formats, ownership classification, documentation opportunities, no-tests verify path, and review-run replay safety.
- [x] Capture focused red/green regressions and check local performance; run strict review and full verify before promotion into `stream/os`.
- [ ] Mark Linear DEV-1571 complete only after publication/verification; do not silently merge `main` or deploy.

## plan

1. Compare review.js with verify.js and test-selection.js; inventory source/toolchain drift and inspect current Nx/ESLint behavior.
2. Write focused selection-adapter and CLI regression tests (RED), including Bun/Vitest suites, selector failure/critical-zero, no-tests, docs-only, structured failure.
3. Implement minimal shared selection adapter for `review.run`; avoid duplicating the test matrix. Remove empty-change ESLint/typecheck repository fallback. Preserve review result contracts and cache identity.
4. Run focused GREEN, review semantic summary / tool facade tests, performance checks, strict review and verify.
5. Push scoped task, promote to `stream/os`, finish task, and update DEV-1571 with verified state.

## Test-first contract

- Behavior: standalone review delegates tests to the same selector as verify and reports failures and zero-suite critical gaps, not fake green when Jest configs are absent. Changed docs must not invoke all-project lint/typechecking. Review --no-tests must retain semantic-only behavior.
- Local pattern: `packages/workspace/scripts/verify.js:runTestSelection` uses `packages/workspace/scripts/test-selection.js check --base ... --run --out`; `packages/workspace/tests/review-run-state.test.js` and `verification.test.js` use Vitest.
- New/changed tests: `packages/workspace/tests/review-modernization.test.js`; verify existing review-run-state, documentation opportunity and facade summary contract.
- Focused RED: `bun x vitest run packages/workspace/tests/review-modernization.test.js`.
- Expected RED: no isolated review selector adapter exists and old review.js hardcodes `jest.config.mjs`, runs npx per Jest package, and falls back to scanning all JS/TS when no changed code.
- No-test waiver: none; runnable deterministic contract tests are appropriate.
- Explicit limits: Do not broaden CI pipelines, alter full verify's selection policy or package-manager migration, or silently change repository-wide Nx configuration.

### RED evidence

- Ran `bun x vitest run packages/workspace/tests/review-modernization.test.js` via Bun runner in the task worktree.
- 9/9 new tests failed as expected before production edits: missing modern selection adapter, stale Jest-only routing, empty-change full-tree lint/typecheck, and structured JSON non-blocking exit behavior.
- A first `code.call(language=bun)` attempt incorrectly provided a shell command rather than JavaScript; re-ran using `Bun.spawnSync` and confirmed real contract failures. No production files edited before RED.
- Additional `--all` regression went RED (selector ignored unchanged code) then GREEN after adding full-scan selection support.
- Measured Nx discovery: `readNxProjects` took ~4,927ms for 18 projects; one `nx show projects --json` took ~271ms. Added scoped lookup test first; RED confirmed the current implementation requests metadata for an unaffected project.
- Dedicated critical review suite went RED before test-selection rule/registry regeneration, then GREEN. Future changes to review and Nx paths select its tests in CI.
- Task-worktree reviewer path integration went RED then GREEN: --mine now invokes the task-local script, not an older parent script.
- Local scoped Nx lookup measured ~1,121ms compared with ~4,927ms for broad discovery.
- Five focused suites passed 125/125 tests before the added --mine test; the targeted --mine test passed afterward.
- Standalone strict structured review selected three suites, passed all three, and found zero blocking findings in ~15.8s.
- Final focused Vitest: 127/127 passed across five suites. Full `verify` against `origin/main`: PASS, publishValid=true; review passed with 0 blocking findings, DB guardrails passed, three selector suites passed (30 + 26 + 92 = 148 tests). Stamp: `.task/os/dev-1571-modernize-and-speed-up-review-run/verify.json`.

## files changed

- `packages/workspace/scripts/lib/review-tests.js`
- `packages/workspace/tests/review-modernization.test.js`
- `packages/workspace/scripts/review.js`
- `packages/workspace/scripts/lib/nx-projects.js`
- `packages/workspace/scripts/test-selection.js`
- `packages/workspace/test-selection.rules.json`
- `packages/workspace/test-selection.registry.json`

## key decisions

- Reuse established test-selection engine, which already expresses project-specific Bun/Vitest/Jest commands and critical rules; do not add Hono as a test runner (it is a web framework).
- No new dependencies or package manager cutover. `verify` retains `--no-tests` review and independently owns selected suites.

## notes for ko

- Review's legacy test runner only looks for Jest configs; verify already runs the modern change-aware selector, so the fastest safe modernization is to share that proven behavior.
- The previously shipped --mine path resolution ran the caller's reviewer source instead of the task-local source; the isolation regression is now covered.

## improvements noticed

- Legacy review.js uses full-repo fallback for no changed TS/JS, and synchronous per-package npx and per-project Nx discovery. Measure before optimizing beyond narrow scope.
- A potential future optimization is batching per-package ESLint startup after measuring its impact, without changing lint rule coverage.

## errors i ran into

- An initial test fixture ran --mine outside a git repository; moved its caller cwd into the real task repo.
- Registry generation is a mutation: code.call verify mode rejected it; re-ran in authorized edit mode.

---

## publish checklist

```bash
bun run task:push -- --message "fix(os): modernize review run tests and avoid redundant checks" --changed
bun run task:pr
bun run task:finish
```

- 2026-10-31 05:15:11 write: `.task/os/dev-1571-modernize-and-speed-up-review-run/workpad.md`

## workspace-owned: files changed

- `packages/workspace/scripts/lib/review-tests.js`
- `packages/workspace/tests/review-modernization.test.js`

## workspace-owned: activity log

- 2026-10-31 05:15:11 fs.write: `.task/os/dev-1571-modernize-and-speed-up-review-run/workpad.md`
- 2026-10-31 05:15:47 fs.write: `packages/workspace/tests/review-modernization.test.js`
- 2026-10-31 05:16:12 fs.write: `packages/workspace/scripts/lib/review-tests.js`

## workspace-owned: files read

- `packages/workspace/scripts/test-selection.js`
- `packages/workspace/test-selection.rules.json`
- `packages/workspace/tests/review-modernization.test.js`

## workspace-owned: validation evidence

- 2026-10-31 05:20:42 `review.run`: passed — OK
- 2026-10-31 05:21:09 apply-patch: `packages/workspace/tests/review-modernization.test.js`
- 2026-10-31 05:21:22 apply-patch: `packages/workspace/tests/review-modernization.test.js`
- 2026-10-31 05:21:28 apply-patch: `packages/workspace/scripts/review.js`
- 2026-10-31 05:21:37 apply-patch: `packages/workspace/tests/review-modernization.test.js`
- 2026-10-31 05:21:45 apply-patch: `packages/workspace/tests/review-modernization.test.js`
- 2026-10-31 05:22:54 apply-patch: `.task/os/dev-1571-modernize-and-speed-up-review-run/workpad.md`
- 2026-10-31 05:23:08 apply-patch: `packages/workspace/tests/review-modernization.test.js`
- 2026-10-31 05:23:16 apply-patch: `packages/workspace/scripts/lib/review-tests.js`
- 2026-10-31 05:23:53 `verify`: passed — OK

- 2026-10-31 05:24:01 apply-patch: `.task/os/dev-1571-modernize-and-speed-up-review-run/workpad.md`