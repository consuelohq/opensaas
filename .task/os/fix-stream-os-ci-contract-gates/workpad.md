# fix stream os ci contract gates

branch: `task/os/fix-stream-os-ci-contract-gates`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/2458/fix-stream-os-ci-contract-gates
github pr: https://github.com/consuelohq/opensaas/pull/2458
started: 2026-09-11

## acceptance criteria

- [ ] Define explicit task acceptance criteria before coding.

## plan

1. Read the relevant code and update this plan before editing.

## current status

- Task started. Update this before publish.

## files changed

- `.github/workflows/consuelo-ci.yaml`
- `packages/os/tests/local-os-server-review-findings.test.ts`
- `packages/os/tests/subagent-executable-discovery.test.ts`

## workspace-owned: files changed

- `.github/workflows/consuelo-ci.yaml`
- `packages/os/tests/local-os-server-review-findings.test.ts`
- `packages/os/tests/subagent-executable-discovery.test.ts`

## workspace-owned: activity log

- 2026-09-11 05:09:26 fs.write: `.task/os/fix-stream-os-ci-contract-gates/workpad.md`
- 2026-09-11 05:17:45 fs.write: `.task/os/fix-stream-os-ci-contract-gates/workpad.md`
- 2026-09-11 05:19:34 fs.write: `.task/os/fix-stream-os-ci-contract-gates/workpad.md`
- 2026-09-11 05:21:50 fs.write: `.task/os/fix-stream-os-ci-contract-gates/workpad.md`

## workspace-owned: validation evidence

- 2026-09-11 05:19:02 `review.run`: passed — OK
- 2026-09-11 05:19:30 `verify`: passed — OK
- 2026-09-11 05:22:09 `review.run`: passed — OK

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
bun run task:push -- --message "type(os): description" --changed
bun run task:pr
bun run task:finish
```

## 2026-09-11 — stream release gate failures

### Test-first contract
- Behavior under test: the stream's generated/focused test-selection contracts must execute successfully on GitHub's Linux CI environment, with package-local binaries resolvable and subagent executable-discovery fixtures runnable even when tests intentionally clear PATH.
- Existing local pattern: `packages/workspace/tests/test-selection.test.js` owns focused registry selection; `packages/os/tests/subagent-executable-discovery.test.ts` directly proves Grok executable lookup behavior.
- Reproduction already captured from required PR #2432 CI: `Consuelo / workspace contracts` and `Consuelo / verify` failed. Registry failures include `Consuelo website Astro check` (`astro: command not found`) and three `subagent-executable-discovery` cases with `result.ok === false` on Linux when PATH is empty.
- New/changed tests: first reproduce the exact generated registry command and Linux-empty-PATH executable fixture locally/with bounded diagnostics; add the smallest regression coverage needed before production changes.
- Focused red command: run the failing generated suite commands exactly as declared by `test-selection.rules.json`, plus `packages/os/tests/subagent-executable-discovery.test.ts` under a Linux-compatible environment contract where possible.
- Expected red: website rule cannot resolve Astro from the declared command/cwd; subagent fixture scripts fail because their `/usr/bin/env bun` shebang depends on PATH that the test deliberately clears.
- No-test waiver: none.

### Release evidence
- PR #2432 required CI completed with 53 checks, 2 failures, 0 pending.
- Failed gates: `Consuelo / workspace contracts` and `Consuelo / verify` in run 34564075862.
- The cache-save warning is non-fatal and unrelated.

- 2026-09-11 05:09:26 append: `.task/os/fix-stream-os-ci-contract-gates/workpad.md`

## workspace-owned: files read

- `.github/workflows/consuelo-ci.yaml`
- `package.json`
- `packages/consuelo-website/package.json`
- `packages/os/scripts/lib/subagent/lifecycle.ts`
- `packages/os/scripts/lib/subagent/runner.ts`
- `packages/os/scripts/lib/subagent/runtime.ts`
- `packages/os/tests/local-os-server-review-findings.test.ts`
- `packages/os/tests/subagent-executable-discovery.test.ts`
- `packages/os/tools/subagent/schema.ts`
- `packages/workspace/scripts/test-selection.js`
- `packages/workspace/tests/test-selection.test.js`
- `review.run --base origin/stream/os`
- `verify --base origin/stream/os`

- 2026-09-11 05:21:10 apply-patch: `packages/workspace/tests/test-selection.test.js`
- 2026-09-11 05:21:32 apply-patch: `packages/workspace/tests/test-selection.test.js`
- 2026-09-11 05:21:32 apply-patch: `packages/workspace/scripts/test-selection.js`
### Publishing-path correction
- Direct workflow publication is unavailable with the current GitHub OAuth token because it lacks `workflow` scope; both the task API push and a native Git push were correctly rejected by GitHub.
- Removed the `.github/workflows/consuelo-ci.yaml` strategy rather than asking for broader credentials. The cleaner fix is inside the test-selection runtime itself: selected suites that reference `packages/consuelo-website` now receive the same clean-checkout package-dependency preflight already used for `packages/os`.
- New TDD RED: `packages/workspace/tests/test-selection.test.js` -> 79 passed / 1 failed because the clean website Astro suite ran from repo root before any package-local install.
- New GREEN: 80/80 test-selection tests passed after adding website dependency detection/readiness/preflight. This makes the generated suite self-contained on CI without changing GitHub workflow permissions.
- The durable-subagent `BUN_BIN` fixture isolation fix remains unchanged and continues to pass under both Bun and an explicit Node-hosted Vitest invocation.

- 2026-09-11 05:21:50 append: `.task/os/fix-stream-os-ci-contract-gates/workpad.md`
