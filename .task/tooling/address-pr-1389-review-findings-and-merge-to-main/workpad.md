# address PR 1389 review findings and merge to main

branch: `task/tooling/address-pr-1389-review-findings-and-merge-to-main`
stream: `stream/tooling`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1429/address-pr-1389-review-findings-and-merge-to-main
github pr: https://github.com/consuelohq/opensaas/pull/1429
started: 2026-07-12

## acceptance criteria

- [x] Re-verify the three supplied review findings against the current `stream/tooling` implementation.
- [x] Fix only findings that remain behaviorally valid, preserving workspace/OS parity and generated contracts.
- [x] Add or retain focused regression coverage for every valid behavior finding.
- [ ] Inspect the seven failing PR checks and distinguish current defects from stale or superseded runs.
- [x] Pass focused validation, workspace review, and the publish verification gate.
- [ ] Promote the task into `stream/tooling`, merge PR #1389 into `main`, and verify the final GitHub state.
- [ ] Provide Ko a precise shipping summary with merge SHA and validation evidence.

## plan

1. Inspect the exact schema helper, CLI branches, focused tests, current diff, PR review comments, and failed check details.
2. Classify each supplied finding as already fixed, stale, or still valid.
3. For any valid finding, establish a failing focused regression test before changing production code; otherwise record a no-change verification waiver.
4. Apply the narrow mirrored workspace/OS fix and regenerate owned surfaces only if required.
5. Run focused tests, parity checks, `review.run`, and `verify`; then push and promote the task.
6. Re-check PR #1389, merge it to `main`, and confirm the merged SHA and checks.

## test-first contract

- Behavior under test: `stream.cleanup.keep` remains optional; browser network requests preserve consumed `--json`; screenshot success output is emitted only after a successful capture.
- Existing pattern: focused browser review contracts plus mirrored workspace/OS runtime parity checks.
- New or changed tests: only if the current tests do not already fail when one of these behaviors regresses.
- Focused red command: run the narrow browser review and stream lifecycle contracts after inspecting them; temporarily prove failure only if production behavior is still incorrect.
- Expected red failure: missing JSON forwarding or false screenshot success should produce an assertion failure; required `keep` should reject omission.
- No-change waiver: if current code and focused tests already prove all three contracts, no production/test mutation is appropriate; validation and merge-state repair replace a redundant edit.

## current status

- Two browser findings were reproduced and fixed: JSON mode was dropped for `network requests`, and failed screenshots still printed a success path.
- The `StreamCleanupInput.keep` finding is stale: `stringArray` is already defined with `.optional()`, and both workspace and OS schemas parse `{}` successfully.
- Focused red evidence showed exactly the two browser regressions; the same suite is now green.
- Broader focused validation is green: 33 tests across browser review contracts, browser services/parity, and stream lifecycle.
- `review.run --strict --no-tests` is clean: static rules, ESLint, typecheck, and spec compliance all passed with zero findings.
- `verify` is publish-valid; its registry selected zero automatic suites, so the explicit 33-test packet is the behavioral test evidence for this change.
- PR #1389 currently reports four failures on the old `df86ccc3` tip: `api-breaking-changes`, `Consuelo / workspace contracts`, `Consuelo / verify`, and Cloudflare `Workers Builds: opensaas`. These must be re-evaluated after promotion.

## files changed

- `packages/workspace/scripts/lib/browser/cli.ts`
- `packages/os/scripts/lib/browser/cli.ts`
- `packages/workspace/tests/browser-review-contract.test.ts`
- `.task/tooling/address-pr-1389-review-findings-and-merge-to-main/workpad.md`

## workspace-owned: files changed

- `.task/tooling/address-pr-1389-review-findings-and-merge-to-main/workpad.md`

## workspace-owned: activity log

- 2026-07-12 23:38:25 fs.write: `.task/tooling/address-pr-1389-review-findings-and-merge-to-main/workpad.md`

## workspace-owned: validation evidence

- 2026-07-12 23:45:06 `review.run`: passed — OK
- 2026-07-12 23:45:20 `verify`: passed — OK

## key decisions

- Start from the stream tip because PR #1389 is the requested merge target and contains the reviewed implementation.
- Leave `StreamCleanupInput.keep` unchanged because `stringArray` is itself optional; adding another `.optional()` would be redundant and would not fix a real defect.
- In JSON mode, forward `--json` to `agent-browser` and bypass the human-readable static-asset filter so callers receive the upstream structured payload unchanged.
- Emit screenshot results normally, but print the evidence path only when the underlying capture exits successfully.
- Mirror runtime edits byte-for-byte in workspace and OS packages.

## notes for ko

- The schema review comment requires no code change; omission of `keep` is already accepted in both public facades.
- Local review and publish verification pass. The task is ready to push and promote; merge remains contingent on the refreshed stream PR state.

## improvements noticed

- none yet

## issues and recovery

- Initial `fs.read` was ambiguous because multiple task worktrees were active; resolved by creating a dedicated task session from `stream/tooling`.
- The provisional task-intent session is advisory and was not accepted by `task.start`; starting the task without that provisional session returned the real task session `tsk_4ffd48607294`.
- The first network fixture encoded a literal escaped newline, obscuring the intended assertion. Replaced it with a deterministic single JSON write; the red failure then isolated the missing `--json` argument.
- The typed GitHub check packet compacted the failed-item list. Used the audited `github raw` fallback with an explicit reason to retrieve the four exact failing checks.

---

## publish checklist

```bash
bun run task:push -- --message "fix(tooling): finalize PR 1389 review findings" --changed
bun run task:pr
bun run task:finish
```

## workspace-owned: files read

- `packages/workspace/senior-engineer.md`
- `packages/workspace/tests/browser-review-contract.test.ts`

- 2026-07-12 23:43:38 apply-patch: `packages/workspace/tests/browser-review-contract.test.ts`

- 2026-07-12 23:44:25 apply-patch: `.task/tooling/address-pr-1389-review-findings-and-merge-to-main/workpad.md`

## workspace-owned: test selection

- changed files: `.task/tasks/tooling/address-pr-1389-review-findings-and-merge-to-main.json`, `.task/tooling/address-pr-1389-review-findings-and-merge-to-main/current.json`, `.task/tooling/address-pr-1389-review-findings-and-merge-to-main/evidence-log.json`, `.task/tooling/address-pr-1389-review-findings-and-merge-to-main/read-log.json`, `.task/tooling/address-pr-1389-review-findings-and-merge-to-main/session.json`, `.task/tooling/address-pr-1389-review-findings-and-merge-to-main/workpad.md`, `packages/os/scripts/lib/browser/cli.ts`, `packages/workspace/scripts/lib/browser/cli.ts`, `packages/workspace/tests/browser-review-contract.test.ts`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: changed code selected zero suites; add a discoverable test or explicit rule when this is not intentional

- 2026-07-12 23:45:29 apply-patch: `.task/tooling/address-pr-1389-review-findings-and-merge-to-main/workpad.md`