# DEV-1660 focused stable release to main without unrelated stream changes

branch: `task/os/dev-1660-focused-stable-release-to-main-without-unrelated-stream-changes`
stream: `stream/os`
pr: https://github.com/consuelohq/opensaas/pull/2743
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

## DEV-1660 focused main/stable release — 2026-10-31
**Approval:** Ko said "release please" immediately after DEV-1660 was merged into stream/os. Authorizes exact DEV-1660 release to installed users, but not blanket release of unrelated stream work.
**Risk boundary:** stream review PR #2656 currently DIRTY against main, CodeRabbit pending and other open serious review findings (not DEV-1660). Do NOT merge it, force, bypass checks, or pick unrelated stream changes. Instead create an isolated main-based task and a focused main-targeting review PR; release via canonical durable OS `release` tool only after CI/review gates. Target **stable** and operator node exact-version update/verify.
**Verified origins:** Original main-based task commit `45cc349abca3ffcaa79b0be6eba471cb90eda6ca` (source branch task/os/dev-1660-improve-typed-linear-workflows-and-audit-coverage) passed full 13/13 verification, strict review 0 blockers. Stream-integrated task commit `9a948d30234dc2a3a0d637416bdc13688974ff8f` in stream merge `ee93ba55909af6fd03294647c74eaa504f6d2dad` passed full 14/14 and same regression suite.
**Desired behavior:** 6 typed Linear tools for comments with authenticated author verification, relations read/create/delete, triage; safe mult-label, defaults, project/state resolution; no permission escalation.
**Parallel safety:** create new main-based isolated task session; do not alter main, cloud, or shared worktrees directly. Main merge through release workflow once PR head verified.

## Test-first contract
behavior under test: unmodified DEV-1660 feature from verified branch ports to current main without bringing unrelated stream changes.
existing pattern: `packages/os/tests/linear-tooling-regression.test.ts`, `packages/os/tools/linear`, mirrored CLI/scripts/schemas and generated tool manifest, type declarations, snapshots, exact scoped read-only MCP classifier.
new tests: reuse original regression suite without rewrite and run red on latest main prior to implementation; no novel production behavior added.
focused red: `bunx vitest run packages/os/tests/linear-tooling-regression.test.ts --reporter=dot` on pristine current main after introducing test only.
expected red: missing Linear commands/default-label behavior, red seen in prior stream port; record actual result.
no-test waiver: no new feature test needed because exact existing focused feature test is reused; separate CI/release checks and runtime smoke required.

## Gate and release acceptance
- [ ] Check the current main code against original diff for conflicts, preserve newer main changes.
- [ ] Port only DEV-1660 product and test changes, regenerate manifests/type docs/snapshots as appropriate; audit for accidental stream-only changes.
- [ ] Focused tests and security scope green, strict review zero blockers and publish-valid verify.
- [ ] Push isolated task branch to GitHub, retarget **focused** task PR #2743 to main (explicit exceptional release path; do not invoke task.pr to merge stream), confirm only approved files.
- [ ] Exact-head CI and review pass, release via `release {pr:2743,channel:"stable"}`; tool must verify main merge, immutable signed publication, channel promotions, local update.
- [ ] Verify deployed version and Linear typed tool discovery/function with no destructive provider changes.
- [ ] Update DEV-1660 with exact SHA/version/channel and outcome. Do not mark Done before confirmed release.

- 2026-10-31 06:13:44 append: `.task/os/dev-1660-focused-stable-release-to-main-without-unrelated-stream-changes/workpad.md`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-10-31 06:13:44 fs.write: `.task/os/dev-1660-focused-stable-release-to-main-without-unrelated-stream-changes/workpad.md`
- 2026-10-31 06:14:07 append: `.task/os/dev-1660-focused-stable-release-to-main-without-unrelated-stream-changes/workpad.md`
- 2026-10-31 06:14:07 fs.write: `.task/os/dev-1660-focused-stable-release-to-main-without-unrelated-stream-changes/workpad.md`
- 2026-10-31 06:14:26 append: `.task/os/dev-1660-focused-stable-release-to-main-without-unrelated-stream-changes/workpad.md`
- 2026-10-31 06:14:26 fs.write: `.task/os/dev-1660-focused-stable-release-to-main-without-unrelated-stream-changes/workpad.md`
- 2026-10-31 06:16:49 fs.write: `.task/os/dev-1660-focused-stable-release-to-main-without-unrelated-stream-changes/workpad.md`
- Current main has three newer commits since original verified DEV-1660 base, all in compact steering files and distinct task metadata; **zero overlap** with the 15 DEV-1660 product/test files.
- Exact regression suite from original DEV-1660 SHA copied unchanged (Git blob hash cab3fc89548fc8b0fff8369adcca6eb5772a0a33 verified).
- Focused green: `bunx vitest ... linear-tooling-regression/handler/tool-package-layout/tool-manifest/script-parity` **33/33, 5 suites**.
- Focused red `bunx vitest run packages/os/tests/linear-tooling-regression.test.ts --reporter=dot`: **11 failed, 0 passed** on current main as expected (missing typed commands, overwritten labels, invalid opensaas default). Production files not changed before red.
- MCP scoped authorization `bun test packages/os/tests/mcp-central-proxy-scope.test.ts` **7/7**, including PostHog read/write separation retained.
- No mutation of provider, main, production, or cloud during tests.
- Original vs current main base had **no overlapping changes** (main only compact steering files).
- OS/workspace Linear scripts byte-identical (`cmp`); generated JS syntax check passes; `git diff --check` passes. Diff is limited to 15 product/test paths plus this new task metadata/workpad.
- Ported exactly 14 product/tool/documentation/generated files from original verified task commit `45cc349a` by explicit-path `git restore --source` (no task metadata or unrelated stream files); regression test copied from exact blob.
- Proceed to import original verified product/test file content verbatim (do not import old task metadata), then run green and regeneration drift checks.

## workspace-owned: validation evidence

- 2026-10-31 06:15:08 `review.run`: passed — OK
- 2026-10-31 06:16:41 `verify`: passed — OK

## workspace-owned: files read

- `packages/os/definitely-missing.json`

### Main-based verification gate — PASS
- Main-specific port strictly includes original 14 product/generated files plus exact regression suite (15 paths) and new release task metadata; newer main steering commit remains unchanged.
- `review.run({strict:true})`: 0 own issues, 0 pre-existing findings, 0 blocking findings.
- Full `verify`: **13/13 selected registry groups green**, including OS package suite, workspace facade/audit, OS release freshness, lifecycle, generated-tool contracts. DB guard 0 findings/risks. Publish-valid stamp `.task/os/dev-1660-focused-stable-release-to-main-without-unrelated-stream-changes/verify.json` confirmed.
- Focused 33/33, MCP scoped read-only 7/7, script byte parity and syntax pass. Red 11/11 before code port was recorded.
- Main-targeting PR release path is deliberately **exceptional** to prevent merging the much larger DIRTY stream PR #2656; retarget task PR #2743 to `main` after push, then use canonical `release` tool to merge and promote exact SHA to canary, preserving local configured canary preference.
- PR release should be aborted if review changes requested, head incomplete/failed CI, or merge state unsafe. Do not use task.pr to promote this release task to stream again; DEV-1660 is already there.

- 2026-10-31 06:16:49 append: `.task/os/dev-1660-focused-stable-release-to-main-without-unrelated-stream-changes/workpad.md`
