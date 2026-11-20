# Round 2 independent computer use quality audit and hardening

branch: `task/os-computer-use/round-2-independent-computer-use-quality-audit-and-hardening`
stream: `stream/os-computer-use`
pr: https://github.com/consuelohq/opensaas/pull/2825
started: 2026-11-19

## acceptance criteria

- [x] Define explicit task acceptance criteria before coding and isolate changes in task PR #2825.
- [x] Independently review PR #2813 and verify high-severity new findings.
- [x] Demonstrate test-first failure and fix substantive defects with regression coverage.
- [x] Pass focused tests, strict review and full safety verification before stream publication.
- [ ] Publish into stream PR #2813 without merging main or updating OS.

## plan

1. Read the relevant code and update this plan before editing.

## files changed

- `packages/os/scripts/lib/computer-use.ts` — missing provider error classification; Dia viewport continuation; strict saved decision validation.
- `packages/os/scripts/lib/subagent/computer-use-log.ts` — multiline document redaction before persistence.
- `packages/os/tests/computer-use.test.ts` and `computer-use-log.test.ts` — red-green regression tests.
- Scoped task workpad and verification evidence.

## key decisions

- Keep Agent Browser/Agent Desktop pinned and Effect-based provider subprocess boundary; do not undertake an unrelated full-effect refactor.
- Preserve browser policy enforcement and one-time confirmation semantics when resuming a parked Dia navigation.
- Do not merge or update installed OS pending Ko's release approval.

## notes for ko

- Focused 55/55 tests, strict review (0 issues), and full verify (3 selected suites including the complete OS package test; passed, publishValid=true) passed.
- Live provider smoke was previously recorded in the original stream; this isolated worktree lacked the optional native providers. No new live browser smoke is claimed for this pass.

## improvements noticed

- Newly reviewed upstream approval continuation and Grok multiline log privacy defects were substantive and reproduced with failing tests before repair.
- Missing optional-provider diagnostics now return explicit CLI_MISSING on Bun and Node instead of ambiguous COMMAND_FAILED.

## errors i ran into

- Bun throws a non-Error ResolveMessage for missing optional native provider modules, requiring explicit error classification.
- Earlier workpad full verify was pending while the broad package suite ran; it ultimately passed all three selected suites.

---

## publish checklist

```bash
bun run task:push -- --message "type(os-computer-use): description" --changed
bun run task:pr
bun run task:finish
```

## workspace-owned: files read

- `packages/os/TOOLS.md`
- `packages/os/definitely-missing.json`
- `packages/os/package.json`
- `packages/os/scripts/dia-launcher.sh`
- `packages/os/scripts/lib/computer-use.ts`
- `packages/os/scripts/lib/facade/batch.ts`
- `packages/os/scripts/lib/facade/executor.ts`
- `packages/os/scripts/lib/facade/logger.ts`
- `packages/os/scripts/lib/facade/schemas.ts`
- `packages/os/scripts/lib/node-resource-lock.ts`
- `packages/os/scripts/lib/redaction.ts`
- `packages/os/scripts/lib/subagent/computer-use-log.ts`
- `packages/os/scripts/lib/subagent/runtime.ts`
- `packages/os/tests/computer-use-log.test.ts`
- `packages/os/tests/computer-use-trace.test.ts`
- `packages/os/tests/computer-use.test.ts`
- `packages/os/tools/deployment-provider/process.ts`
- `packages/os/tools/utilities/computer-use.ts`
- `packages/workspace/senior-engineer.md`

## Round-two audit scope (2026-11-19)

### Acceptance criteria
- Review current PR #2813 head, including computer.use contracts, CLI process isolation, session ownership, approvals, privacy and logs, platform compatibility and failure recovery.
- Fix confirmed correctness or security problems with regression tests; do not change unrelated code.
- Validate affected unit/integration tests, relevant package checks, independent review, and publish any changes to stream/os-computer-use for Ko's review.
- Do not merge to main, deploy, or run `consuelo update` without Ko's final approval.

### Plan
1. Read runtime, schema, provider and tests; inspect current PR findings and compare against latest stream head.
2. Establish test-first contracts for any confirmed bugs; run focused tests red before production edits.
3. Implement minimal durable fixes and verify privacy/approval invariants.
4. Run validation/review, promote to PR #2813, and report objective code quality, caveats and approval action.

### Test-first contract
- Behavior under test: to be selected from independently verified defect(s); audit initially read-only.
- Existing local pattern: examine current computer-use test fixtures and sandbox/session tests.
- New or changed tests / red command / expected red: record before any production edit.
- No-test waiver: not requested.

### Initial evidence
- Current PR #2813 targets stream/os-computer-use to main; head 96dd1fc7. Multiple earlier fixes and reviews exist; do not assume latest head is correct without independent verification.

- 2026-11-19 05:31:00 append: `.task/os-computer-use/round-2-independent-computer-use-quality-audit-and-hardening/workpad.md`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-11-19 05:31:00 fs.write: `.task/os-computer-use/round-2-independent-computer-use-quality-audit-and-hardening/workpad.md`
- 2026-11-19 05:34:56 fs.write: `.task/os-computer-use/round-2-independent-computer-use-quality-audit-and-hardening/workpad.md`
- 2026-11-19 05:38:17 fs.write: `.task/os-computer-use/round-2-independent-computer-use-quality-audit-and-hardening/workpad.md`
- 2026-11-19 05:39:24 fs.write: `.task/os-computer-use/round-2-independent-computer-use-quality-audit-and-hardening/workpad.md`
- 2026-11-19 05:40:07 fs.write: `.task/os-computer-use/round-2-independent-computer-use-quality-audit-and-hardening/workpad.md`
- 2026-11-19 05:40:44 fs.write: `.task/os-computer-use/round-2-independent-computer-use-quality-audit-and-hardening/workpad.md`

## Test-first contract: optional native provider availability

Behavior under test: absent optional agent-browser/agent-desktop packages or native binaries must return `CLI_MISSING` with an actionable reinstall instruction, not an opaque `COMMAND_FAILED`; unrelated thrown failures retain their existing class. Bun can throw a non-Error `ResolveMessage` for module resolution, unlike Node's `MODULE_NOT_FOUND` Error.
Existing local pattern: `readResult` handles provider `runtimeMissing`, while `runComputerUse` maps `NodeResourceLockError` and `BrowserUnavailableError` in its catch branches.
New/changed tests: focused classification cases for Bun ResolveMessage, Node MODULE_NOT_FOUND, unrelated exceptions and native binary error. Verify running `runComputerUse` with absent optional deps produces CLI_MISSING in the isolated worktree.
Focused red command: `bun x vitest run tests/computer-use.test.ts -t "classifies unavailable native computer providers"` (from packages/os).
Expected red failure: the shared failure-classifier symbol is not yet exported; in current code missing Bun provider returns COMMAND_FAILED.
No-test waiver: not applicable.

- 2026-11-19 05:34:56 append: `.task/os-computer-use/round-2-independent-computer-use-quality-audit-and-hardening/workpad.md`

- 2026-11-19 05:34:56 apply-patch: `packages/os/tests/computer-use.test.ts`
- 2026-11-19 05:35:12 apply-patch: `packages/os/scripts/lib/computer-use.ts`

## workspace-owned: validation evidence

- 2026-11-19 05:35:45 `review.run`: passed — OK
- 2026-11-19 05:39:33 `review.run`: passed — OK
- 2026-11-19 05:40:27 `review.run`: passed — OK
- 2026-11-19 05:41:53 `verify`: passed — OK

## Additional round-two TDD contracts (CodeRabbit latest findings, independently verified)

1. **Grok multiline privacy**. Behavior: `redactProviderLog` must sanitize complete pretty-printed JSON documents before persistence; ordinary pretty output remains intact. Existing pattern: `createProviderLogWriter` supports `multiline:true`, but wrapper uses single-line. New test adds wrapper assertions for private Grok document and ordinary output. Focused red: `bun x vitest run tests/computer-use-log.test.ts -t "filters OpenCode tool parts"`; expected red: private synthetic marker survives `redactProviderLog(grok)`. Security severity: major, not cosmetic.
2. **Dia viewport approval continuation**. Behavior: if viewport setup parks for approval, the original `open` must remain unexecuted until confirmed; confirming successful viewport resumes original navigation exactly once under same browser session lock and checks navigation policy normally. A second navigation approval must be surfaced as its own new pending decision. Existing pattern: `executeComputerSteps` performs idempotent viewport setup before navigation; `withBrowserDecision` manages one-time per-profile approval IDs and calls `dispatch`. New focused mocked tests for stage tagging, pending/resume, and reprompt. Focused red: `bun x vitest run tests/computer-use.test.ts -t "resumes Dia navigation|marks a pending Dia"`; expected red: no continuation marker and no navigation dispatch after confirm.
3. **Linux ARM64 error instructions**. Behavior: a missing distribution Chromium must preserve actionable Linux ARM64 instructions, not recommend reinstalling OS optional dependencies. New test for catch mapping `BrowserUnavailableError` from `buildComputerCommand`. Focused red: `bun x vitest run tests/computer-use.test.ts -t "preserves Linux ARM64 recovery"`; expected red: helper overwrites specific error message.
Do not modify production code before observing these red tests. No-test waivers: none.

- 2026-11-19 05:38:17 append: `.task/os-computer-use/round-2-independent-computer-use-quality-audit-and-hardening/workpad.md`

- 2026-11-19 05:38:17 apply-patch: `packages/os/tests/computer-use.test.ts`
- 2026-11-19 05:38:17 apply-patch: `packages/os/tests/computer-use-log.test.ts`
- 2026-11-19 05:38:27 apply-patch: `packages/os/scripts/lib/computer-use.ts`
- 2026-11-19 05:38:27 apply-patch: `packages/os/scripts/lib/subagent/computer-use-log.ts`
- 2026-11-19 05:38:46 apply-patch: `packages/os/scripts/lib/computer-use.ts`
## Round-two implementation / validation evidence

- Confirmed all 4 newly added red assertions failed before implementation: provider-specific Linux ARM64 remediation lost; pending viewport lacked a continuation marker; confirming viewport did not run requested `open`; `redactProviderLog` leaked synthetic UI marker inside pretty-printed Grok JSON.
- Corrected `computerUseFailure` to preserve actionable platform error details while reporting Bun/Node optional-provider missing modules as CLI_MISSING. Reproduced CLI_MISSING for both desktop and Dia from source worktree with optional runtime deps absent.
- `executeComputerSteps` tags provider approval parked during Dia viewport setup. `withBrowserDecision` persists validated original URL/headed continuation in one-time profile-scoped decision and resumes navigation only on successful viewport confirm; any separate navigation confirmation is returned as a new approval ID without bypassing browser policy. Failed confirmations do not navigate.
- `redactProviderLog` now buffers and sanitizes complete multiline JSON documents in the persistence path, not just direct-stream writer path.
- Focused suite `bun x vitest run tests/computer-use.test.ts tests/computer-use-log.test.ts tests/computer-use-trace.test.ts`: 53/53 green after fixes (33 computer use, 8 logs, 12 trace); existing Node experimental SQLite warning only. `bun run typecheck` (workspace syntax checks) passed. Strict review and full verify pending on latest changes.
- No main merge, deployment, installed OS update, real external website interactions, or live user-profile browser actions performed. Original PR documented earlier live Dia smoke; this isolated task has optional provider packages missing.

- 2026-11-19 05:39:24 append: `.task/os-computer-use/round-2-independent-computer-use-quality-audit-and-hardening/workpad.md`

## Supplemental fail-closed contract

- Validate persisted browser continuation shape strictly before replay, including explicit `headed` boolean. A malformed continuation is not allowed to change browser mode silently. Ensure failed viewport confirmation never dispatches navigation. Tests in `computer-use.test.ts` alongside named-session decision tests. Focused red: `bun x vitest run tests/computer-use.test.ts -t "rejects a corrupted saved Dia continuation"`; expected red: stored continuation missing headed is accepted because schema marks headed optional.

- 2026-11-19 05:40:07 append: `.task/os-computer-use/round-2-independent-computer-use-quality-audit-and-hardening/workpad.md`

- 2026-11-19 05:40:07 apply-patch: `packages/os/tests/computer-use.test.ts`
- 2026-11-19 05:40:14 apply-patch: `packages/os/scripts/lib/computer-use.ts`

## Final focused validation (round two)

- New persisted continuation negative tests: corrupted or incomplete saved state fails closed before provider dispatch; failed viewport confirmation does not resume navigation. Red case reproduced a stored `resume` without `headed` reaching dispatch; green after explicit boolean requirement.
- Three focused test files passed **55/55** (35 computer use, 8 log redaction, 12 trace) after final code changes. Existing experimental SQLite warning only.
- Strict `review.run({strict:true})` after latest changes: 0 newly introduced issues, 0 pre-existing issues, 0 blocking issues, 0 documentation opportunities.
- Changed production files: `packages/os/scripts/lib/computer-use.ts`, `packages/os/scripts/lib/subagent/computer-use-log.ts`; changed tests: `packages/os/tests/computer-use.test.ts`, `packages/os/tests/computer-use-log.test.ts`. Scoped workpad documents TDD and review evidence.
- Full `verify` gate launched; pending completion before publish. If publish succeeds, code promotes only to stream review PR #2813; main merge, deployment and OS update await explicit Ko approval.

- 2026-11-19 05:40:44 append: `.task/os-computer-use/round-2-independent-computer-use-quality-audit-and-hardening/workpad.md`

- 2026-11-19 05:42:09 apply-patch: `.task/os-computer-use/round-2-independent-computer-use-quality-audit-and-hardening/workpad.md`