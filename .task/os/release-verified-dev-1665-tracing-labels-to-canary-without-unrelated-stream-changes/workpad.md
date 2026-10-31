# Release verified DEV-1665 Tracing labels to canary without unrelated stream changes

branch: `task/os/release-verified-dev-1665-tracing-labels-to-canary-without-unrelated-stream-changes`
stream: `stream/os`
pr: https://github.com/consuelohq/opensaas/pull/2757
started: 2026-10-31

## acceptance criteria

- [ ] Define explicit task acceptance criteria before coding.

## plan

1. Read the relevant code and update this plan before editing.

## files changed

- none yet

## key decisions

- none yet

## notes for ko

- none yet

## improvements noticed

- none yet

## errors i ran into

- none yet

---

## publish checklist

```bash
bun run task:push -- --message "type(os): description" --changed
bun run task:pr
bun run task:finish
```
# DEV-1665 — isolated main release of verified Tracing labels

## Approval and boundaries
User explicitly requested "solve what you need and ship" because Tracing page still shows old input labels.
- Publish the already verified DEV-1665 five-file patch without merging unrelated stream/os history.
- Target main via a separate isolated task PR, then signed immutable canary release and local installation/update.
- Verify source artifact, installed formatter, actual Tracing HTML snapshot and runtime; if hosted snapshot remains stale, use the supported protected publication route and verify exact content.
- No deletion of other agents' work/data, no global working tree changes, no credential exposures, no unapproved broad stream merge.
- Current Mac OS 0.1.146 has old formatter (no patchText or codeFile). Local ~/.consuelo/sites/traces/index.html was generated at 03:33 from old runtime. Authenticated browser test of https://internal.consuelohq.com/tracing redirected to Google sign-in: browser session cannot currently inspect hosted page.

## Source of truth
- Original verified task: DEV-1665, stream task PR #2751 merged to stream/os SHA 2752c01fbab7a75f893a8581a16303bd3b208fa0.
- Source/task commit 56f8211832d0fa1df08b513befd1ea81b9f1a4d0.
- Stream snapshot compared with current main: exactly 5 intended file changes (238 insertions / 6 deletions), no unrelated file modifications. Main already contains baseline formatter behavior.
- This task begins directly from origin/main in a managed isolated worktree.

## Test-first contract
Behavior: typed fs.apply_patch patchText target filename summary, code.call file/shell family labeling, public Linear issue identifier & operation labels (no body), and redacted phase-specific explore failure with recovery guidance.
Existing tests: packages/os/tests/trace-site-inspector-os-owned.test.ts, packages/os/tests/explore-output-contract.test.ts, browser/gateway regression fixtures.
Changes: first port only the regression tests from stream/os and run expected focused RED against main. Then port the 3 source files from exact stream/os only if current main counterparts match the reviewed baseline and diff shows no unrelated edits. Avoid rewriting unrelated files or discarding other agents' work.
Focused RED: bunx vitest run tests/trace-site-inspector-os-owned.test.ts tests/explore-output-contract.test.ts
Expected RED: 5 trace-label failures, missing explore-failure module.
Focused GREEN: above + trace-sites-browser-client and trace-sites-gateway-live-endpoints suites; typecheck; independent trace-persistence suite; managed verify.
No-test waiver: none.

## Publish
- task.push, retarget isolated task PR #2757 from stream/os to main to avoid unrelated stream history; inspect PR diff and exact required checks; use OS signed release orchestrator canary to merge main only when safe; verify exact SHA and local install.
- Separate site snapshot update verification; do not claim success merely because source merged.

- 2026-10-31 07:35:57 append: `.task/os/release-verified-dev-1665-tracing-labels-to-canary-without-unrelated-stream-changes/workpad.md`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-10-31 07:35:57 fs.write: `.task/os/release-verified-dev-1665-tracing-labels-to-canary-without-unrelated-stream-changes/workpad.md`
- 2026-10-31 07:37:27 fs.write: `.task/os/release-verified-dev-1665-tracing-labels-to-canary-without-unrelated-stream-changes/workpad.md`
- 2026-10-31 07:40:37 fs.write: `.task/os/release-verified-dev-1665-tracing-labels-to-canary-without-unrelated-stream-changes/workpad.md`
- 2026-10-31 07:47:32 fs.write: `.task/os/release-verified-dev-1665-tracing-labels-to-canary-without-unrelated-stream-changes/workpad.md`
- 2026-10-31 07:49:36 fs.write: `.task/os/release-verified-dev-1665-tracing-labels-to-canary-without-unrelated-stream-changes/workpad.md`

## workspace-owned: files read

- `packages/os/definitely-missing.json`
- `packages/os/scripts/lib/install-edge-site-publisher.ts`
- `packages/os/scripts/lib/observability-traces-site.ts`
- `packages/os/scripts/lib/sites.ts`
- `packages/os/scripts/lib/trace-site-inspector/virtual-list-browser.ts`
- `packages/os/scripts/lifecycle.ts`
- `packages/os/tests/observability-traces-site.test.ts`
- `packages/os/tests/runtime-bundle-managed-site-assets.test.ts`
- `packages/os/tests/trace-site-inspector-batch-polish.browser.test.ts`
- `packages/os/tests/trace-site-renderer.test.ts`
- `packages/os/tests/trace-site-table-polish.browser.test.ts`
- `packages/workspace/scripts/test-selection.js`
- `packages/workspace/test-selection.rules.json`
- `packages/workspace/tests/test-selection.test.js`

## Additional root cause: generated browser asset was stale (must release too)
User's visible Tracing UI is generated by `buildObservabilityTracesSite` in `packages/os/scripts/lib/observability-traces-site.ts`, which inlines `assets/vendor/observability-traces-v38/inspector.js`. That browser asset is built from `packages/os/scripts/lib/trace-site-inspector/browser.ts` by `packages/os/package.json` script `build:observability-traces-runtime`. The user-installed local HTML snapshot `~/.consuelo/sites/traces/index.html` (created at 03:33) contains `patch files` and `inspect source`, and **zero** `patchText` or `codeFile` markers, even though TS source in stream was fixed. Merely releasing TS source would not change the visible page.
- Expand patch scope to include rebuilt `packages/os/assets/vendor/observability-traces-v38/inspector.js`, plus tests proving the asset is synchronized and installed site uses it. Keep all other vendor shell assets unchanged.
- Before production edit: test-first RED on source-vs-compiled parity or visible runtime behavior, followed by rebuild via the source-defined Bun command.
- Verify generated site HTML uses the new bundled asset after runtime update/materialization. The authenticated remote browser session redirects to Google OAuth, so hosted page may require alternative authorized runtime verification.
- Preserve exact scope; do not confuse a local installed HTML snapshot with externally published workspace-edge snapshot (may require separate republish).

- 2026-10-31 07:37:27 append: `.task/os/release-verified-dev-1665-tracing-labels-to-canary-without-unrelated-stream-changes/workpad.md`

- 2026-10-31 07:37:47 apply-patch: `packages/os/tests/observability-traces-site.test.ts`

- 2026-10-31 07:39:30 apply-patch: `packages/os/tests/trace-site-inspector-batch-polish.browser.test.ts`
- 2026-10-31 07:40:04 apply-patch: `packages/os/tests/trace-site-inspector-batch-polish.browser.test.ts`
## Test-first release validation and browser bundle fix

- Ported 2 regression suites from verified stream/os (DEV-1665). On main source, focused RED: 6 expected failures and 35 passes (missing explore helper, patchText/codeFile/Linear labels, and stale browser asset).
- Identified **additional root cause**: Tracing HTML embeds `assets/vendor/observability-traces-v38/inspector.js`; the stream task had not rebuilt this asset. New `observability-traces-site.test.ts` test asserts `patchText`, `codeFile`, and `issueId` appear in both checked-in compiled asset and generated HTML.
- Ported 3 exact runtime source files from stream/os; no unrelated stream history.
- Rebuilt browser bundle using package script `build:observability-traces-runtime` in the isolated task. The isolated worktree lacks local `@tanstack/virtual-core`; provided read-only NODE_PATH from the Mac's already installed `/Users/kokayi/Dev/opensaas/packages/os/node_modules`, with compatible dependency; no lockfiles or other worktrees changed. Bun bundle output 139,045 bytes, SHA256 `8d2eaf1fddde9515d795250839aa745137591724276f0d0285405e43f74a4620`.
- Added headless Chromium integration regression using actual `buildObservabilityTracesSite` output and synthetic traces. It checks rendered patch, code-call, and Linear Input cells for specific action/file labels. Fixed a test assertion syntax mismatch between Playwright and Vitest; browser test now passes.
- 75/75 focused source/site/asset tests passed across 6 files before adding browser regression. Then 17/17 browser/site tests passed. OS typecheck passed. `git diff --check` passed. No actual user data was used by the test fixtures.
- Next: managed full verification/review; publication via isolated main PR + signed canary, followed by materialized snapshot and hosted edge verification. Preserve all unrelated stream work.

- 2026-10-31 07:40:37 append: `.task/os/release-verified-dev-1665-tracing-labels-to-canary-without-unrelated-stream-changes/workpad.md`

## workspace-owned: validation evidence

- 2026-10-31 07:44:25 `verify`: failed — COMMAND_FAILED
- 2026-10-31 07:49:20 `verify`: passed — OK

## Full-gate test-selection investigation and resolution

- First full `verify` passed static review, eslint, typecheck, spec compliance and DB guard but failed a broader `trace-persistence.test.ts` check during parallel OS verifications; selected 10 suites including `auto:@consuelo/os:package-test`.
- The extra auto suite came from initially placing the new browser integration test in `tests/trace-site-inspector-batch-polish.browser.test.ts`, an existing file not mapped by the explicit critical selector. No production issue was implicated.
- Moved that **same passing Playwright DOM regression** (patch, code, Linear rendered cells) into the already mapped `tests/observability-traces-site.test.ts`. Original batch browser test file returned byte-for-byte to its task baseline (git diff zero). This preserves browser regression coverage and removes the broad auto suite by using existing intended critical trace-site selection; no test suppression or rule edits.
- 54/54 focused compiled asset, browser rendering, source and release fingerprint tests passed after this move. OS typecheck passed.
- `test-selection.js check` with exact seven changed product/test paths: `passed=true`, `level=pass`, nine explicitly selected critical suites (trace-site-pagination, explore, internal shell, workspace session integration), **no auto package fallback**.
- Formerly failing canonical trace-persistence + query suites rerun independently with the existing exact runner: **16/16 PASS**. Prior failure was intermittent under multiple parallel OS verifications, not a reproduced product regression. Full managed verify must still pass before publication.

- 2026-10-31 07:47:32 append: `.task/os/release-verified-dev-1665-tracing-labels-to-canary-without-unrelated-stream-changes/workpad.md`

## Final managed verification — passed
- Managed `verify` publish stamp: `publishValid=true`. Nine explicitly selected critical suites passed, zero failed suites. Static review: 0 own issues, 0 related/pre-existing issues, 0 blocking issues; documentation and DB guard clear.
- Test-first RED on base: 6 expected regressions (stale compiled browser asset, missing explore helper, and old trace labels); 35 existing tests passed.
- GREEN: 75/75 focused across six source/asset/site tests. Final 54/54 focused tests with persisted headless Chromium DOM assertion in mapped `observability-traces-site.test.ts`, plus separate 16/16 trace persistence and search contract tests. Typecheck and diff check clean.
- Rebuilt checked-in `inspector.js` from OS-owned TypeScript source; local generated site will incorporate it after accepted release. No changes to legacy vendor shell/CSS or unrelated stream/os work.
- Exact test-selection preflight selects only nine critical suites; no unmapped auto package fallback. Earlier intermittent trace-persistence failure did not reproduce alone and passes in final managed verification.
- Next: task.push, retarget PR #2757 against current main, check only intended 8 product/test files plus task metadata; invoke signed immutable canary release, local updater and local trace HTML verification.

- 2026-10-31 07:49:36 append: `.task/os/release-verified-dev-1665-tracing-labels-to-canary-without-unrelated-stream-changes/workpad.md`
