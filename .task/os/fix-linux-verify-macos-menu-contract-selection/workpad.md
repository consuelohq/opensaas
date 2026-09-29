# fix linux verify macos menu contract selection

branch: `task/os/fix-linux-verify-macos-menu-contract-selection`
stream: `stream/os`
pr: https://github.com/consuelohq/opensaas/pull/2582
started: 2026-09-25

## acceptance criteria

- [x] Linux aggregate `Consuelo / verify` must not attempt to compile the macOS menu Swift contract suite.
- [x] The macOS menu Swift contract remains covered on an appropriate macOS/native path; do not delete or weaken that coverage.
- [x] Add a focused regression that fails on the current stream behavior and passes after the smallest selection/runner fix.
- [ ] PR #2550 can rerun with the full verify gate terminal and green before Stable release resumes.

## plan

1. Inspect PR #2580 and the exact test-selection/registry entry that still launches `macOS menu Swift contracts` on Linux.
2. Identify the existing platform-gating pattern and add the narrow regression first.
3. Run the focused test RED and record the exact failure.
4. Make the smallest selector/runner change; rerun the same test GREEN.
5. Run targeted selection/contract validation, review, and verify against `origin/stream/os`.
6. Push, promote into `stream/os`, then resume PR #2550 -> main -> Stable.

## Test-first contract

behavior under test: On Linux aggregate verify, the registry must skip the macOS menu Swift build contract while preserving that contract on macOS/native validation.
existing local pattern: `packages/workspace/scripts/test-selection.js` selects every suite attached to a matched rule, and `packages/workspace/tests/test-selection.test.js` already owns the `os-macos-menu-app` routing contract. The rule data is authored in `test-selection.rules.json` and materialized into `test-selection.registry.json`.
new or changed tests: update the existing native macOS menu routing test to explicitly simulate Darwin, then add a Linux selection regression asserting that only the cross-platform Vitest + shell syntax suites remain and `macOS menu Swift contracts` is excluded.
focused red command: `bun x vitest run packages/workspace/tests/test-selection.test.js -t "routes native macOS menu changes"`
expected red failure: the new Linux simulation still selects `macOS menu Swift contracts` because the selector currently ignores platform metadata/arguments.
no-test waiver: none.

### RED evidence

- `bun x vitest run packages/workspace/tests/test-selection.test.js -t "does not run macOS Swift menu contracts on Linux verify"` failed 1/1 as intended.
- Received Linux suites: `macOS menu Swift contracts`, `macOS menu platform contracts`, `macOS alpha package syntax`.
- Expected Linux suites: only `macOS menu platform contracts` and `macOS alpha package syntax`.

## files changed

- `packages/workspace/scripts/test-selection.js`
- `packages/workspace/test-selection.rules.json`
- `packages/workspace/test-selection.registry.json`
- `packages/workspace/tests/test-selection.test.js`

## key decisions

- This is a release-gate repair only. No product/runtime behavior changes.
- Do not bypass or disable the full verify gate; move platform-specific coverage to the correct execution context.
- Add generic per-suite `platforms` filtering to the selector and scope only `macOS menu Swift contracts` to `darwin`. Keep the portable macOS Vitest and shell syntax suites selected on Linux.

### GREEN evidence

- Focused Darwin + Linux routing tests passed 2/2.
- Full `packages/workspace/tests/test-selection.test.js` passed 81/81.
- Explicit Linux selector dry run passes and selects exactly `macOS menu platform contracts` + `macOS alpha package syntax`, with no Swift suite.
- `git diff --check` passed.
- Strict `review.run --base origin/stream/os --no-tests` passed with 0 blockers/issues.
- Full `verify --base origin/stream/os` passed with `publishValid: true`; DB guard reports 0 risks/findings.

## notes for ko

- Approved narrowly to repair this single Linux -> macOS Swift verify boundary and resume Stable.

## improvements noticed

- Regenerating `test-selection.registry.json` exposed unrelated pre-existing inventory drift for `packages/os/tests/macos-supervised-heartbeat.test.ts`. That drift was intentionally excluded from this narrow release fix.

## errors i ran into

- The typed GitHub `pr.diff` helper currently invokes unsupported `gh pr diff --stat`; use another read-only GitHub path for PR #2580 evidence instead of changing that helper in this task.

---

## publish checklist

```bash
bun run task:push -- --message "fix(os): gate macos menu contracts by platform" --changed
bun run task:pr
bun run task:finish
```

- 2026-09-25 15:52:03 write: `.task/os/fix-linux-verify-macos-menu-contract-selection/workpad.md`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-09-25 15:52:03 fs.write: `.task/os/fix-linux-verify-macos-menu-contract-selection/workpad.md`

## workspace-owned: files read

- `packages/workspace/scripts/test-selection.js`
- `packages/workspace/test-selection.registry.json`
- `packages/workspace/test-selection.rules.json`
- `packages/workspace/tests/test-selection.test.js`

- 2026-09-25 15:53:23 apply-patch: `.task/os/fix-linux-verify-macos-menu-contract-selection/workpad.md`
- 2026-09-25 15:53:31 apply-patch: `packages/workspace/tests/test-selection.test.js`

- 2026-09-25 15:53:55 apply-patch: `.task/os/fix-linux-verify-macos-menu-contract-selection/workpad.md`
- 2026-09-25 15:54:07 apply-patch: `packages/workspace/scripts/test-selection.js`
- 2026-09-25 15:54:08 apply-patch: `packages/workspace/test-selection.rules.json`
- 2026-09-25 15:55:07 apply-patch: `packages/workspace/test-selection.registry.json`

- 2026-09-25 15:55:16 apply-patch: `.task/os/fix-linux-verify-macos-menu-contract-selection/workpad.md`

## workspace-owned: validation evidence

- 2026-09-25 15:55:45 `review.run`: passed — OK
- 2026-09-25 15:55:56 `verify`: passed — OK

- 2026-09-25 15:56:07 apply-patch: `.task/os/fix-linux-verify-macos-menu-contract-selection/workpad.md`