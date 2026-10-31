# DEV-1660 stream-aligned Linear integration conflict recovery

branch: `task/os/dev-1660-stream-aligned-linear-integration-conflict-recovery`
stream: `stream/os`
pr: https://github.com/consuelohq/opensaas/pull/2742
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

## DEV-1660 stream-aligned integration: exact-head conflict recovery

**User approval:** DEV-1660 in stream/os; isolated task workflow; no main merge, no deploy.

**Why a new task:** Original main-based task PR #2739 was push-successful and fully verified, but task.pr refused actual non-metadata conflicts into current stream/os. Git diff shows the Linear executable scripts and typed tool source were **byte-identical** between main and stream before DEV-1660; stream-specific edits mainly touch generated manifests/docs and central security scope. Recover by porting only DEV-1660 implementation into this isolated worktree **based directly on stream/os** and regenerating, not merging main or overwriting stream-specific content.

**Source evidence:** Original commit `45cc349abca3ffcaa79b0be6eba471cb90eda6ca`; task PR #2739. Original full verify passed all 13 selected groups, strict review 0 blockers, DB guard zero risks; initial 6 red tests, then 33 focused tests green plus 7 central scope, 12 trace, 30 code-call, 13 health readiness independently green.

## Test-first contract

behavior under test: stream-os has the same typed Linear comment / author verification / relation / triage contracts and safe multi-label/defaults as original DEV-1660, without dropping stream-only features; central MCP read-only scopes remain exact.

existing local pattern: `packages/os/scripts/linear.js` mirrored by `packages/workspace/scripts/linear.js`; `packages/os/tools/linear/{schema.ts,handler.ts}` plus mirrored facade schemas; regenerate OS tooling; test manifest, snapshots, and parity. Preserve stream-specific `SCRIPTS.md` sections and central tool authorization.

new or changed tests: port `packages/os/tests/linear-tooling-regression.test.ts` from verified original PR, run it red on stream baseline before production implementation; then green with security/manifest/parity and full verify.

focused red command: `bunx vitest run packages/os/tests/linear-tooling-regression.test.ts --reporter=dot`

expected red failure: missing six typed Linear commands and incorrect old label/default behavior.

no-test waiver: none; test first.

## Acceptance

- [ ] Complete six typed Linear tool registrations and mirrored CLI/GraphQL behavior without losing current stream features.
- [ ] Preserve `stream/os` security read-only classifier and dynamically generate manifest/types/docs/fixtures/snapshots.
- [ ] Regression red/green, centralized scope, mirror parity, strict review and full publish-valid verify.
- [ ] Publish new task to `stream/os` review PR #2656, report exact SHAs; close/annotate superseded PR #2739 without deleting code.
- [ ] Update DEV-1660 with result and evidence; remain `in review` until required main integration; never merge main/deploy.

- 2026-10-31 06:00:08 append: `.task/os/dev-1660-stream-aligned-linear-integration-conflict-recovery/workpad.md`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-10-31 06:00:08 fs.write: `.task/os/dev-1660-stream-aligned-linear-integration-conflict-recovery/workpad.md`
- 2026-10-31 06:00:32 apply-patch: `packages/os/scripts/lib/tool-scope-authorization.ts`
- 2026-10-31 06:01:32 apply-patch: `packages/os/tests/audit/fixtures/script-parity-classifications.json`
- 2026-10-31 06:02:02 apply-patch: `packages/os/tests/audit/fixtures/script-parity-classifications.json`
- 2026-10-31 06:02:53 fs.write: `.task/os/dev-1660-stream-aligned-linear-integration-conflict-recovery/workpad.md`
- 2026-10-31 06:06:27 fs.write: `.task/os/dev-1660-stream-aligned-linear-integration-conflict-recovery/workpad.md`

## workspace-owned: files read

- `packages/os/definitely-missing.json`
- `packages/os/scripts/lib/tool-scope-authorization.ts`
- `packages/os/tests/mcp-central-proxy-scope.test.ts`
- `packages/os/tests/workspace-fluid-layout.test.ts`

## Stream recovery implementation evidence — 2026-10-31

- **Red**: Installed only the original DEV-1660 regression test into the pristine stream-based worktree and ran `bunx vitest run packages/os/tests/linear-tooling-regression.test.ts`; 11/11 failed on absent typed functionality, label losses and invalid default label, confirming stream baseline lacked this implementation.
- Confirmed OS and workspace Linear CLI scripts, typed schema/handler, and mirrored facade schemas were byte-identical on `origin/main` and `origin/stream/os` before this task. Ported exactly those six reviewed source files from original full-verified commit `45cc349abca3ffcaa79b0be6eba471cb90eda6ca`, without resetting stream or overwriting stream-specific code.
- Reapplied two new Linear read-only scoped tool names into the stream's central MCP scope array. The stream itself had omitted three existing readonly PostHog tools (`posthog.config`, `posthog.projects`, `posthog.query`) from this exact array; added them after confirming manifest `readOnly:true` and `mutating:false` flags for all three, retaining fail-closed handling of writes.
- Preserved stream-specific `SCRIPTS.md` sections by replacing only the Linear subsection in both documentation mirrors. Regenerated 172-tool manifest, type stubs, TOOLS.md, deterministic baseline fixture and the 12 additional facade command snapshots; entire facade test run 767/767 green.
- Stream review modernization had two script-parity classification drifts unrelated to Linear: new workspace-only `scripts/lib/review-tests.js` missing from fixture and changed workspace `scripts/lib/nx-projects.js` misclassified `same`. Added explicit parity tracking (workspace-only-needs-port, changed-needs-review) without touching their implementations.
- **Green**: focused five suites **33/33** tests; central MCP proxy read-only security **6/6**; `node packages/os/scripts/check-syntax.js` passes; `git diff --check` clean; OS/workspace Linear scripts byte-identical.
- **Next**: strict review, full publish-valid verify; then task.push -> task.pr into stream/os review PR #2656. No main merge/deploy. Original main-based PR #2739 remains open temporarily until new stream-based PR #2742 is published and promoted; then mark superseded/close without deletion.

- 2026-10-31 06:02:53 append: `.task/os/dev-1660-stream-aligned-linear-integration-conflict-recovery/workpad.md`

## workspace-owned: validation evidence

- 2026-10-31 06:03:08 `review.run`: passed — OK
- 2026-10-31 06:04:35 `verify`: failed — COMMAND_FAILED
- 2026-10-31 06:06:39 `review.run`: passed — OK
- 2026-10-31 06:08:15 `verify`: passed — OK

## Full verify safety findings and data repair — 2026-10-31

- Initial stream-aligned full verify: strict review passes with 0 blocking findings; selected package-wide OS suite failed **one unrelated existing Artifacts layout test** because both `packages/os/assets/consuelo-mark.png` and `consuelo-mark-white.png` in stream were stored with UTF-8 replacement bytes (`ef bf bd` in place of raw PNG bytes), including the required PNG signature. Both historical file blobs in main/stream are corrupted, and each contained thousands of replacement sequences; there is no lossless one-byte patch.
- Found intact canonical brand black/white PNG art already tracked in `packages/consuelo-website/public/logo-black.png` and `ghl-app-logo-white-512x512.png`. Verified each is 512×512 RGBA and pixel alpha silhouettes match. Copied their **existing bytes unchanged** to the two corrupted OS assets; no new image creation, no UI redesign, no change to website assets. Verified PNG signatures, PIL decoding and byte-identity to source. This fixes the pre-existing stream artifact without relaxing validation.
- Re-ran failing `workspace-fluid-layout` plus Linear and parity tests: **15/15 green**; central MCP security **6/6 green**. Full Linear/manifest/parity previously 33/33 green. Expected binary publication bytes to be preserved by stream's DEV-1630 task.push repair; verify after push.
- Pre-existing stream-only audit fixture drift reconciled: `review-tests.js` newly workspace-only and `nx-projects.js` modified between workspace and OS. Classified explicitly as pending review; no script logic modified.
- All changes remain on task/os/dev-1660-stream-aligned-linear-integration-conflict-recovery; next strict review and full verify. No main merge/deployment.

- 2026-10-31 06:06:27 append: `.task/os/dev-1660-stream-aligned-linear-integration-conflict-recovery/workpad.md`
