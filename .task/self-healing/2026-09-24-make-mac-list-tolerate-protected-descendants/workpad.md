# 2026-09-24 make mac list tolerate protected descendants

branch: `task/self-healing/2026-09-24-make-mac-list-tolerate-protected-descendants`
stream: `stream/self-healing`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/2581/2026-09-24-make-mac-list-tolerate-protected-descendants
github pr: https://github.com/consuelohq/opensaas/pull/2581
started: 2026-09-25

## acceptance criteria

- [ ] Define explicit task acceptance criteria before coding.

## plan

1. Read the relevant code and update this plan before editing.

## current status

- Task started. Update this before publish.

## files changed

- `packages/os/tests/mac-list.test.ts`

## workspace-owned: files changed

- `packages/os/tests/mac-list.test.ts`

## workspace-owned: activity log

- 2026-09-25 01:26:56 fs.write: `.task/self-healing/2026-09-24-make-mac-list-tolerate-protected-descendants/workpad.md`
- 2026-09-25 01:27:12 fs.write: `packages/os/tests/mac-list.test.ts`
- 2026-09-25 01:29:13 fs.write: `.task/self-healing/2026-09-24-make-mac-list-tolerate-protected-descendants/workpad.md`
- 2026-09-25 01:38:42 fs.write: `.task/self-healing/2026-09-24-make-mac-list-tolerate-protected-descendants/workpad.md`

## workspace-owned: validation evidence

- 2026-09-25 01:29:28 `review.run`: passed — OK
- 2026-09-25 01:30:39 `verify`: failed — COMMAND_FAILED
- 2026-09-25 01:31:34 `verify`: failed — COMMAND_FAILED
- 2026-09-25 01:32:37 `verify`: failed — COMMAND_FAILED
- 2026-09-25 01:36:31 `review.run`: passed — OK
- 2026-09-25 01:37:36 `verify`: passed — OK
- 2026-09-25 01:38:32 `verify`: passed — OK

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
bun run task:push -- --message "type(self-healing): description" --changed
bun run task:pr
bun run task:finish
```

## Test-first contract

behavior under test: `mac.list` must list accessible descendants even when one nested macOS-protected directory throws `EPERM`/`EACCES`; the result must surface skipped descendant diagnostics, while an unreadable or nonexistent requested root still fails.
existing local pattern: `packages/os/scripts/mac.js` implements read-only `mac.list` with synchronous recursive `fs.readdirSync`; the current contract is deterministic, sessionless, safe-to-retry, and returns `RawOutput`.
new or changed tests: add focused coverage for partial traversal with an injected unreadable descendant plus preservation of root-path failure semantics.
focused red command: `bun test packages/os/tests/mac-list.test.ts`
expected red failure: current recursive traversal aborts on the synthetic descendant `EPERM`, so it cannot return the accessible sibling entries plus a skipped-path diagnostic.
no-test waiver: not applicable.

## Investigation notes

- Date: 2026-09-24 local maintenance day.
- Source baseline: current `origin/main` at `ff18014a19`; task started with `startFrom: main` because `stream/self-healing` is a review/integration lane and is stale relative to current product source.
- Installed/runtime: OS 0.1.131. Installed `monitor.errors` is stale (`Script not found "monitor:errors"`); current-main-equivalent monitor source was used read-only and this drift is not selected for repair.
- Deterministic report: 26 groups, 9 initially actionable by classifier. Most are expected engineering/test/caller failures or current maintenance activity rather than product defects.
- Independent ordinary-use evidence selected: `mac.list` failed on `/Users/kokayi` depth 2 because `.Trash` returned `EPERM`, and separately on `~/Library/Application Support` because `MobileSync` returned `EPERM`. A fresh typed `mac.list({path:"/Users/kokayi", depth:2})` reproduced the failure deterministically.
- Governing invariant: listing a readable root should not lose all useful results because one nested child is macOS-protected. Permission errors on descendants should remain visible as explicit skipped diagnostics; permission/nonexistence errors on the requested root must remain failures.
- Duplicate check: `packages/os/scripts/mac.js` is identical between current `origin/main` and authoritative `origin/stream/os`; no current open PR targets this behavior.
- Sentry: zero unresolved issues in the last 24h. No normalized hosted install/onboarding impact surface has been identified yet; no user-impact counts are invented.

- 2026-09-25 01:26:56 append: `.task/self-healing/2026-09-24-make-mac-list-tolerate-protected-descendants/workpad.md`

- 2026-09-25 01:27:12 write: `packages/os/tests/mac-list.test.ts`

- 2026-09-25 01:27:28 apply-patch: `packages/os/scripts/mac.js`
## Candidate classification and remediation

Serious candidate families investigated:
1. `mac.list` protected-descendant traversal failures — **real source defect selected**. Ordinary non-scheduled calls failed the entire listing on `.Trash` and `MobileSync`; a fresh typed call reproduced it. Root cause: recursive `fs.readdirSync` allowed any descendant `EPERM`/`EACCES` to abort the whole tool.
2. `mac.call` repeated `COMMAND_FAILED` — **caller/child-command outcomes, not selected**. Samples were explicit caller-selected timeouts on expensive `du`/`find`/iCloud hydration, `/bin/sh` syntax incompatible with caller process-substitution syntax, grep/condition exit status 1 after useful output, and an APFS/iCloud `mv` resource-deadlock error. The wrapper correctly surfaced child failure.
3. `code.call` repeated `COMMAND_FAILED` / validation errors — **engineering/test/caller behavior, not selected**. Samples were deliberate RED test runs, failed validation commands, missing caller-selected paths, and `mode=edit` correctly rejecting calls without task/work-session authority.
4. `verify` repeated failures — **healthy validation enforcement, not selected**. The sampled envelopes were `verify.summary.v1` failures with test-selection/package failures during OS/self-healing engineering tasks.
5. maintenance-harness/runtime groups (`monitor.errors`, `batch`, successful `get_steering` recurrence) — **runtime/source drift or classifier noise, not selected**. The installed monitor script is absent while current source contains it; current automation traces are explicitly excluded as product evidence. No harness edit was made.

Fix: `mac.list` now catches only descendant `EPERM`/`EACCES`, records `{path, code, message}` in a `skipped` array, and continues traversing accessible siblings. Errors at the requested root and non-permission descendant errors still propagate as failures.

## Regression and runtime evidence

- RED: `bun test packages/os/tests/mac-list.test.ts` => 1 pass / 1 fail; protected-descendant case exited 1 while root-failure control passed.
- GREEN: same focused file => 2/2 pass, 8 assertions.
- Broader focused set: `mac-list.test.ts` + `tools/mac/handler.test.ts` + `tool-manifest.test.ts` => 20/20 pass, 247 assertions.
- Realistic runtime probe from the task source: listing `/Users/kokayi` depth 2 now succeeds with 1,464 entries and explicitly reports `/Users/kokayi/.Trash` as skipped with `EPERM`.
- Safety invariant retained: the regression control proves an unreadable requested root still returns `COMMAND_FAILED`.
- External evidence: read-only Sentry query returned zero unresolved issues in the last 24h. Tool discovery exposed no normalized hosted install/onboarding impact read model beyond the local monitor; no hosted-user impact counts were inferred.
- Maintenance-harness fixes: 0.

## Integration state

- Task PR: #2581, based from current `main` as required by the no-busywork policy.
- `origin/main...origin/stream/self-healing` currently diverges 419 main-only / 59 self-healing-only commits. PR #2581 is therefore currently conflicting/huge against the stale integration lane even though its product delta against `origin/main` is only this bounded fix plus test/workpad metadata.
- Stream reconciliation is not counted as a deliverable. Because a real defect has been selected, only the minimum supported reconciliation needed for eventual task promotion may be performed; accepted self-healing history must not be discarded.

- 2026-09-25 01:29:13 append: `.task/self-healing/2026-09-24-make-mac-list-tolerate-protected-descendants/workpad.md`

## workspace-owned: files read

- `packages/os/definitely-missing.json`

## Final task validation before integration

- The first full OS package test exposed two legitimate integration gaps in the change itself: the new test used Bun-only `import.meta.dir` under Vitest, and `packages/os/scripts/mac.js` diverged from its required `packages/workspace/scripts/mac.js` mirror. Both were corrected without broadening the selected root cause.
- Mirrored implementation: the identical protected-descendant traversal contract is now present in both OS and workspace `scripts/mac.js` entry points, preserving script-parity expectations for the underlying `workspace mac.list` surface.
- Test portability: the regression resolves its script path with `fileURLToPath(new URL('.', import.meta.url))`, so it runs under both Bun's test runner and Vitest.
- Focused/parity validation after those corrections: 21/21 tests passed (20 targeted + 1 script-parity audit), including 2,243 parity assertions.
- Full `bun run --cwd packages/os test`: passed with exit 0 after the corrections.
- Strict review against `origin/main`: 3 changed source/test files across `consuelo-os` and `openworkspace`; 0 your issues, 0 pre-existing issues, 0 blockers, 0 documentation opportunities.
- Full verify against the task start point `origin/main`: `passed=true`, `publishValid=true`, review passed, DB guard passed with 0 risks / 0 findings. Stamp written to the generated task workpad directory.

- 2026-09-25 01:38:42 append: `.task/self-healing/2026-09-24-make-mac-list-tolerate-protected-descendants/workpad.md`
