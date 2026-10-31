# Converge verified cloud session fixes after parallel stream selector changes

branch: `task/os/converge-verified-cloud-session-fixes-after-parallel-stream-selector-changes`
stream: `stream/os`
pr: https://github.com/consuelohq/opensaas/pull/2760
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

## Scope and TDD-first contract

Converge already-reviewed Phase 2 fixes from original PR #2750 and stream-based PR #2754 onto latest stream/os, whose concurrent updates changed only packages/workspace/test-selection.rules.json and generated registry. Do not copy those files wholesale: preserve all newly-added stream rules and regenerate registry canonically.

Acceptance: a signed non-Git runtime supports standalone work sessions, damaged Git and linked worktrees remain protected, bundled skill entrypoints resolve after relocation, and skill helper changes select the existing critical bundled-skill test suite rather than unrelated package-wide tests. Preserve Mac default, no main merge or OS deployment.

Test-first contract: port prior reviewed tests for non-Git worktrees, malformed Git, signed-runtime work-session creation, relocated guidance skill resources and invalid metadata, plus selector regression that checks focused skills suite selection. Run RED with original stream code. Port the two original source fixes and add the one focused source pattern to existing os-bundled-skill-contract. Regenerate committed registry (do not overwrite unrelated rules). Run GREEN focused tests and full affected tests, strict review and verify, task.push and task.pr only to stream/os.

Prior evidence: PR #2754 strict review passed, selected 13-suite verification passed and task was pushed at 25db0eae2be8c737588a5a97f8fa262500f44922. Promotion refused new non-metadata conflicts only in concurrent test-selection.rules.json and registry; new task is stream-aligned to preserve those contributions. Do not change auth, VM, or runtime.

- 2026-10-31 07:49:49 append: `.task/os/converge-verified-cloud-session-fixes-after-parallel-stream-selector-changes/workpad.md`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-10-31 07:49:49 fs.write: `.task/os/converge-verified-cloud-session-fixes-after-parallel-stream-selector-changes/workpad.md`
- 2026-10-31 07:50:04 apply-patch: `packages/os/tests/work-session-code-call.test.ts`
- 2026-10-31 07:50:04 apply-patch: `packages/os/tests/session-start-foundation.test.ts`
- 2026-10-31 07:50:18 apply-patch: `packages/os/tests/install-state.test.ts`
- 2026-10-31 07:50:18 apply-patch: `packages/workspace/tests/test-selection.test.js`
- 2026-10-31 07:50:40 apply-patch: `packages/os/scripts/lib/work-session-protection.ts`
- 2026-10-31 07:50:40 apply-patch: `packages/os/scripts/lib/skills.ts`
- 2026-10-31 07:50:40 apply-patch: `packages/workspace/test-selection.rules.json`
- 2026-10-31 07:51:35 fs.write: `.task/os/converge-verified-cloud-session-fixes-after-parallel-stream-selector-changes/workpad.md`
- 2026-10-31 07:54:11 fs.write: `.task/os/converge-verified-cloud-session-fixes-after-parallel-stream-selector-changes/workpad.md`

## RED/GREEN and latest stream rebase evidence

The previous stream-aligned PR #2754 passed a publish-valid 13-suite gate and was pushed to 25db0eae2be8c737588a5a97f8fa262500f44922, but stream/os advanced with a concurrent stream.context compaction. Git merge-tree showed only test-selection.rules.json and generated registry conflicts, so this task started from the later stream head and retained the concurrent rules. No old stream branch or unrelated source files were cherry-picked.

RED on this current stream baseline: three expected OS tests failed (non-Git root, signed runtime work-session, relocated guidance), nested Git test passed; new selector test failed because skills.ts was not mapped to critical bundled-skill rule.

GREEN: source fixes re-applied to two OS helpers, three OS regression files; existing critical os-bundled-skill-contract source mapping extended with skills.ts; generated registry refreshed using canonical test-selection.js generator without overwriting unrelated stream rules. Focused four OS regressions passed. Four affected OS suites passed 68/68 with one platform skip. Entire workspace test-selection suite passed 94/94; explicit preview selects the critical bundled skill contract and no broad package auto fallback. Strict review and full verification are required before publication. Preserve main/deploy boundaries.

- 2026-10-31 07:51:35 append: `.task/os/converge-verified-cloud-session-fixes-after-parallel-stream-selector-changes/workpad.md`

## workspace-owned: validation evidence

- 2026-10-31 07:51:49 `review.run`: passed — OK
- 2026-10-31 07:53:54 `verify`: failed — COMMAND_FAILED
- 2026-10-31 07:56:31 `verify`: passed — OK

## workspace-owned: files read

- `packages/os/definitely-missing.json`
- `packages/workspace/test-selection.rules.json`

## Formal gate transient test timeout

The first formal verify of this stream-aligned integration reported 13 critical selected suites, strict review passed and DB guard passed, but the OS work-session Code Call suite failed due to 5-second timeouts in unrelated code-call.test.ts cases under aggregate execution. The exact failing test `suppresses nested facade telemetry from verify-mode stderr` passes in isolation in 1.42 seconds. No assertions or test selection were disabled. Rerunning the same full publish-valid gate without bypass.

- 2026-10-31 07:54:11 append: `.task/os/converge-verified-cloud-session-fixes-after-parallel-stream-selector-changes/workpad.md`
