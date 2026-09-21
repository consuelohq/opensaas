# focus OS stream test selection for dialer release

branch: `task/dialer-algorithm/focus-os-stream-test-selection-for-dialer-release`
stream: `stream/dialer-algorithm`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/2099/focus-os-stream-test-selection-for-dialer-release
github pr: https://github.com/consuelohq/opensaas/pull/2099
started: 2026-08-16

## acceptance criteria

- [x] Exact failed `stream.sync` OS file set selects no broad OS package suite.
- [x] Existing focused suites cover Trace, code-call process, facade, SVG media, and script-parity behavior.
- [x] `packages/os/SCRIPTS.md` and stream `AGENTS.md` are documentation-only selection and do not trigger lifecycle runtime tests.
- [x] Generated test-selection registry is refreshed deterministically.
- [x] Selector regression and all locally runnable focused suites are green.
- [x] Strict review is clean before promotion.
- [x] Task is publish-ready for immediate post-promotion `stream.sync`, which remains the authoritative combined-tree gate before GitHub CI.

## plan

1. Reproduce the residual broad OS package selection from the failed stream sync.
2. Move the EPIPE regression out of the unsafe legacy guardrail test file into a safe focused test.
3. Add exclusive focused ownership for code-call process, Trace SQLite, facade regressions, SVG conversion, script parity, and OS instruction docs.
4. Regenerate the test-selection registry and prove the exact residual stream file set no longer selects broad OS/lifecycle runtime suites.
5. Run the safe focused suites, strict review, publish, and rerun `stream.sync` on the actual main+stream merge candidate.

## current status

- Selector implementation complete; 42/42 selector tests pass.
- Focused code-call process 1/1, Node Trace SQLite 14/14, facade regression selection 161/161, and SVG conversion 11/11 pass.
- Local script-parity audit is intentionally red because this unsynced task tree lacks three current-main scripts that the stream baseline already correctly classifies; parity must be evaluated on the merged candidate via `stream.sync`.
- Strict review and stream-sync validation remain.

## files changed

- `packages/os/tests/code-call-process-regressions.test.ts`

## workspace-owned: files changed

- `packages/os/tests/code-call-process-regressions.test.ts`

## workspace-owned: activity log

- 2026-08-16 02:15:26 fs.write: `.task/dialer-algorithm/focus-os-stream-test-selection-for-dialer-release/workpad.md`
- 2026-08-16 02:17:51 fs.write: `packages/os/tests/code-call-process-regressions.test.ts`
- 2026-08-16 02:28:21 fs.write: `.task/dialer-algorithm/focus-os-stream-test-selection-for-dialer-release/workpad.md`

## workspace-owned: validation evidence

- 2026-08-16 02:21:50 `review.run`: passed — OK

## key decisions

- none yet

## notes for ko

- none yet

## improvements noticed

- none yet

## issues and recovery

- none yet

---

## publish checklist

```bash
bun run task:push -- --message "type(dialer-algorithm): description" --changed
bun run task:pr
bun run task:finish
```

## Test-first contract

behavior under test: every remaining stream-specific OS file must be owned by a focused explicit test-selection rule so the Dialer stream does not fall through to the broad `auto:@consuelo/os:package-test`; docs-only `packages/os/SCRIPTS.md` must not select executable lifecycle tests.
existing local pattern: critical/exclusive OS rules such as `os-durable-subagent-runtime` route risky implementation families to focused contract suites and assert the broad package suite is absent.
new or changed tests: add a selector regression containing the exact remaining stream OS files from the failed `stream.sync`; assert no `auto:@consuelo/os:package-test`, assert `SCRIPTS.md` alone does not select lifecycle execution, and preserve the intended focused Trace/code-call/media/script-parity suites.
focused red command: run only the new `packages/workspace/tests/test-selection.test.js` selector case.
expected red failure: current selection includes `auto:@consuelo/os:package-test` for legacy stream OS files and selects lifecycle contracts because `SCRIPTS.md` is listed as lifecycle source.
no-test waiver: not applicable.

## Acceptance criteria
- [ ] Exact failed `stream.sync` OS file set selects no broad OS package suite.
- [ ] Existing focused suites still cover Trace, code-call, media SVG, facade/script-parity behavior where relevant.
- [ ] `packages/os/SCRIPTS.md` is documentation-only for selection and does not trigger lifecycle runtime tests by itself.
- [ ] Generated test-selection registry is refreshed deterministically.
- [ ] Focused selector tests and every newly selected safe focused suite pass.
- [ ] Strict review is clean before promotion.
- [ ] `stream.sync` succeeds against current `main` before relying on GitHub CI.

- 2026-08-16 02:15:26 append: `.task/dialer-algorithm/focus-os-stream-test-selection-for-dialer-release/workpad.md`

## workspace-owned: files read

- `packages/workspace/scripts/test-selection.js`
- `packages/workspace/test-selection.rules.json`
- `packages/workspace/tests/test-selection.test.js`

- 2026-08-16 02:17:11 apply-patch: `packages/workspace/tests/test-selection.test.js`
- 2026-08-16 02:17:51 write: `packages/os/tests/code-call-process-regressions.test.ts`

- 2026-08-16 02:18:43 apply-patch: `packages/os/tests/code-call.test.ts`
- 2026-08-16 02:18:43 apply-patch: `packages/workspace/tests/test-selection.test.js`
- 2026-08-16 02:19:03 apply-patch: `packages/workspace/test-selection.rules.json`

- 2026-08-16 02:20:45 apply-patch: `.task/dialer-algorithm/focus-os-stream-test-selection-for-dialer-release/workpad.md`

## Final validation
- Strict review: 0 issues / 0 blockers.
- Test-selection registry: 42/42 passed.
- Code-call process: 1/1 passed; Node Trace SQLite: 14/14; focused facade: 161/161; SVG: 11/11.
- Local parity is deferred to `stream.sync`: its three extra classifications correspond to current-main scripts absent from the unsynced stream task.
- Local canonical verify is intentionally not run because this task removes the prior EPIPE test from legacy `code-call.test.ts`, whose existing guardrail source contains a destructive command literal; after promotion that file matches main and disappears from the stream diff.
- Control-plane wait recovery: repeated 502s during final inspection/publish; bounded retries recovered at 2026-08-16T02:28:06Z. Next action is publish, promote, then authoritative combined-tree `stream.sync`.

- 2026-08-16 02:28:21 append: `.task/dialer-algorithm/focus-os-stream-test-selection-for-dialer-release/workpad.md`

- 2026-08-16 02:28:44 apply-patch: `.task/dialer-algorithm/focus-os-stream-test-selection-for-dialer-release/workpad.md`