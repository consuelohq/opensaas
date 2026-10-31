# Integrate verified Linux work-session sandbox on current OS stream

branch: `task/os/integrate-verified-linux-work-session-sandbox-on-current-os-stream`
stream: `stream/os`
pr: https://github.com/consuelohq/opensaas/pull/2762
started: 2026-10-31

## acceptance criteria

- [ ] Define explicit task acceptance criteria before coding.

## plan

1. Read the relevant code and update this plan before editing.

## files changed

- `packages/os/scripts/lib/code-call/linux-containment.ts`
- `packages/os/tests/linux-work-session-containment.test.ts`

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

## Acceptance and test-first contract

Integrate verified source from PR #2753 onto current stream/os after #2760, without overwriting concurrent work. Scope is Linux-only Bubblewrap work-session code.call containment, a pure sandbox argument/environment planner, exact platform tests, and a critical Code Call selector rule that includes the Linux regression suite and avoids unrelated OS package-wide fallback. Preserve macOS sandbox and general code.call, fail closed when containment is unavailable, no main merge or deployment.

Test-first: add Linux planner/unit and process native tests to packages/os/tests/linux-work-session-containment.test.ts, adjust existing work-session-code-call.test.ts Linux-bwrap guard without discarding #2760 tests, and add selector regression to packages/workspace/tests/test-selection.test.js asserting changed Linux test/helper choose the existing os-work-session-code-call critical rule with the Linux tests and no auto package fallback. Run RED before helper/prod/rule edits. Then port exactly reviewed linux-containment.ts and process.ts delta from PR #2753, amend existing critical selector rule, regenerate test-selection.registry.json with canonical generator. Run GREEN focused and affected test suites; source safety, syntax, strict review and full publish-valid verify before task.push/task.pr to stream/os. Signed cloud OS runtime unchanged. Native cloud-1 Bubblewrap 0.8.0 probe of the exact planner already passed on isolated source copy (writes/read-only/symlink/keys/environment); this task verifies stream integration, not VM deployment.

- 2026-10-31 07:58:20 append: `.task/os/integrate-verified-linux-work-session-sandbox-on-current-os-stream/workpad.md`

## workspace-owned: files changed

- `packages/os/scripts/lib/code-call/linux-containment.ts`
- `packages/os/tests/linux-work-session-containment.test.ts`

## workspace-owned: activity log

- 2026-10-31 07:58:20 fs.write: `.task/os/integrate-verified-linux-work-session-sandbox-on-current-os-stream/workpad.md`
- 2026-10-31 07:58:30 write: `packages/os/tests/linux-work-session-containment.test.ts`
- 2026-10-31 07:58:30 fs.write: `packages/os/tests/linux-work-session-containment.test.ts`
- 2026-10-31 07:59:11 fs.write: `packages/os/scripts/lib/code-call/linux-containment.ts`
- 2026-10-31 08:00:12 fs.write: `.task/os/integrate-verified-linux-work-session-sandbox-on-current-os-stream/workpad.md`
- 2026-10-31 08:01:38 fs.write: `.task/os/integrate-verified-linux-work-session-sandbox-on-current-os-stream/workpad.md`
- 2026-10-31 08:03:04 fs.write: `.task/os/integrate-verified-linux-work-session-sandbox-on-current-os-stream/workpad.md`

## workspace-owned: files read

- `packages/os/definitely-missing.json`
- `packages/os/scripts/lib/code-call/process.ts`
- `packages/workspace/test-selection.rules.json`
- `packages/workspace/tests/test-selection.test.js`

## RED/GREEN and source continuity - 2026-10-31

- RED on stream baseline: linux-work-session-containment.test.ts cannot import missing linux-containment module; selector test failed because new Linux test path selected auto OS package test, not exclusively critical Code Call.
- Ported exact reviewed PR #2753 Linux process helper, process.ts implementation and safe test guard without overwriting the work-session and skills changes already promoted in stream/os via PR #2760.
- Extended existing critical os-work-session-code-call rule with new Linux-native test path and suite command, using --no-file-parallelism for work-session/facade environment isolation. Regenerated committed test-selection.registry.json with canonical generator, preserving other current stream rules.
- GREEN: 20/20 affected Linux/work-session tests with 3 platform skips on Mac; all 95 selector tests pass; OS syntax and test-source-safety pass. Selector preview selects only critical Code Call and syntax suites (no broad package fallback). Original source planner already tested on existing cloud-1 VM with native Bubblewrap and passed write/read/secret/symlink checks without OS runtime deployment. New Linux execution-mode test will run on actual Linux after an approved release; it is skipped on Mac by design.
- No main merge, OS deployment, new VM, or default route change.

- 2026-10-31 08:00:12 append: `.task/os/integrate-verified-linux-work-session-sandbox-on-current-os-stream/workpad.md`

## workspace-owned: validation evidence

- 2026-10-31 08:00:32 `review.run`: passed — OK
- 2026-10-31 08:01:03 `verify`: failed — COMMAND_FAILED
- 2026-10-31 08:01:31 apply-patch: `packages/os/scripts/lib/code-call/process.ts`
- 2026-10-31 08:02:08 `review.run`: passed — OK
- 2026-10-31 08:02:51 `verify`: passed — OK

## Formal verification retry and platform audit

First formal verify selected three critical suites, strict review and DB guard passed; Code Call suite failed solely at an unrelated existing code-call.test.ts case, `suppresses nested facade telemetry from verify-mode stderr`, which timed out after 5s during aggregate run. This test previously passed in isolation and was not changed. No test disabled or timeout increased; rerun full required gate.

During cross-platform audit found an unintended environment change: original Linux integration draft applied sanitized child env to Darwin, whereas prior macOS sandbox-exec preserved the complete daemon env with scratch overrides. Repaired to preserve preexisting macOS env exactly; use filtered env only for Linux Bubblewrap. This is a narrow correctness adjustment prior to publication. Re-run affected tests, strict review and formal verify after this change.

- 2026-10-31 08:01:37 append: `.task/os/integrate-verified-linux-work-session-sandbox-on-current-os-stream/workpad.md`

## Final verification evidence

Full verification passed: three critical suites, strict review with zero blocking findings, and database guard. Verification stamp is publish-valid. Focused work-session tests passed 20 with 3 platform skips. No test exclusions or widened timeouts. Publish only to stream/os and leave main and installed OS unchanged.

- 2026-10-31 08:03:04 append: `.task/os/integrate-verified-linux-work-session-sandbox-on-current-os-stream/workpad.md`
