# add real swamp compatibility ci

branch: `task/swamp-tools/add-real-swamp-compatibility-ci`
stream: `stream/swamp-tools`
pr: https://github.com/consuelohq/opensaas/pull/2535
started: 2026-09-22

## acceptance criteria

- [x] Run a real released Swamp binary through Consuelo discovery, authorization, validation, model execution, and workflow execution.
- [x] Keep external-provider compatibility CI out of blocking pull-request CI.
- [x] Verify the upstream release checksum and isolate/clean all temporary Swamp state.
- [x] Cover the workflow policy and repository security checks.

## plan

1. Capture a focused red workflow-policy test.
2. Build a disposable real-Swamp compatibility harness and dedicated CI workflow.
3. Exercise the harness against the current checksum-verified Swamp release.
4. Keep the harness CI-owned so it does not select unrelated whole-OS package tests.
5. Run focused tests, strict review, canonical verify, and promote into `stream/swamp-tools`.

## files changed

- `.github/scripts/consuelo-swamp-compat.ts`
- `.github/workflows/consuelo-swamp-compat.yaml`
- `packages/os/scripts/swamp-compat-smoke.ts` (deleted)
- `packages/workspace/tests/github-workflow-policy.test.js`

## key decisions

- Nightly + manual + relevant `main` pushes; deliberately no `pull_request` trigger.
- Download the released Linux x86_64 Swamp binary plus `checksums.txt` and verify SHA-256 before running it.
- The live harness owns and removes its disposable Swamp repo, Swamp home, XDG config, and Consuelo home in `finally`.
- Keep the harness under `.github/scripts` rather than the shipped OS script inventory; it still imports the real OS search/executor/security modules.

## notes for ko

- The old real-Swamp work-session contents were removed, reused only for final live verification, then removed again. Final directory listing is empty (`trc_0d5130254d9d`).
- Final live smoke from the CI-owned harness passed against Swamp `20260922.011324.0-sha.2e949db5` (`trc_11703f390987`).

## improvements noticed

- CI-only compatibility harnesses should live outside package runtime script inventories so they do not accidentally select package-wide verification suites.

## errors i ran into

- Initial red-test command used an unsupported `bun x` form; corrected immediately and captured the intended missing-workflow red failure.
- Strict review caught an untyped `catch`; fixed to `catch (error: unknown)`.
- An intermediate OS-script location caused unrelated package-wide benchmark/trace tests to time out under load; moving the harness to `.github/scripts` removed that irrelevant selection while preserving focused OS integration coverage.

---

## publish checklist

```bash
bun run task:push -- --message "type(swamp-tools): description" --changed
bun run task:pr
bun run task:finish
```

## workspace-owned: files read

- `.github/workflows/consuelo-ci.yaml`
- `.github/workflows/consuelo-os-runtime-publish.yaml`
- `.github/workflows/consuelo-swamp-compat.yaml`
- `packages/os/package.json`
- `packages/os/scripts/lib/runtime-tool-providers/swamp.ts`
- `packages/os/scripts/lib/runtime-tool-registry.ts`
- `packages/os/scripts/swamp-compat-smoke.ts`
- `packages/os/scripts/tools-search.ts`
- `packages/os/tests/audit/script-parity-audit.test.ts`
- `packages/workspace/scripts/ci/check-github-workflows.cjs`
- `packages/workspace/scripts/test-selection.js`
- `packages/workspace/tests/github-workflow-policy.test.js`

## Acceptance criteria

- Add a real-Swamp compatibility smoke that exercises Consuelo `tools.search` and `executeTool` against a disposable real Swamp repo.
- Keep the real-provider job out of blocking pull-request CI; run it nightly, manually, and after relevant changes land on `main`.
- Download the released Linux x86_64 Swamp asset and `checksums.txt`, verify SHA-256 before execution, disable Swamp telemetry, and isolate all Swamp/Consuelo state in a temp directory.
- Always clean the temp fixture in a `finally` path.
- Preserve deterministic fake-Swamp coverage in normal package tests.
- Validate the workflow with the repository GitHub workflow policy and focused smoke-script tests.

## Plan

1. Add a focused workflow-policy test describing the non-blocking compatibility lane and capture it red while the workflow is absent.
2. Add a reusable Bun smoke script under `packages/os/scripts` that receives an already-verified Swamp binary and creates/cleans its own disposable repo.
3. Add a package script and dedicated GitHub Actions workflow: schedule + workflow_dispatch + relevant `main` pushes, no `pull_request` trigger.
4. Run the smoke locally against the real current Swamp Linux release when feasible, plus deterministic focused tests and workflow security policy.
5. Run review/verify and merge the task into `stream/swamp-tools`.

## Test-first contract

behavior under test: repository CI has a dedicated real-Swamp compatibility lane that is isolated from blocking PR CI, verifies upstream release integrity, executes the same Consuelo discovery/execution path users rely on, and cleans its fixture.
existing local pattern: `.github/workflows/consuelo-ci.yaml` uses the local `consuelo-ci-setup` action; `packages/workspace/tests/github-workflow-policy.test.js` parses/asserts workflow policy and boundaries.
new or changed tests: add a workflow-policy assertion for `consuelo-swamp-compat.yaml`; add focused smoke-script coverage where useful after extracting the reusable runner.
focused red command: `bun --cwd packages/workspace x vitest run tests/github-workflow-policy.test.js`.
expected red failure: the new policy test cannot find `.github/workflows/consuelo-swamp-compat.yaml` before the workflow is added.
no-test waiver: not applicable.

- 2026-09-22 02:58:53 append: `.task/swamp-tools/add-real-swamp-compatibility-ci/workpad.md`

## workspace-owned: files changed

- `.github/scripts/consuelo-swamp-compat.ts`
- `.github/workflows/consuelo-swamp-compat.yaml`
- `packages/os/scripts/swamp-compat-smoke.ts` (deleted)
- `packages/workspace/tests/github-workflow-policy.test.js`

## workspace-owned: activity log

- 2026-09-22 02:58:53 fs.write: `.task/swamp-tools/add-real-swamp-compatibility-ci/workpad.md`
- 2026-09-22 02:59:01 apply-patch: `packages/workspace/tests/github-workflow-policy.test.js`
- 2026-09-22 02:59:21 fs.write: `.task/swamp-tools/add-real-swamp-compatibility-ci/workpad.md`
- 2026-09-22 03:00:28 fs.write: `packages/os/scripts/swamp-compat-smoke.ts`
- 2026-09-22 03:00:39 fs.write: `.github/workflows/consuelo-swamp-compat.yaml`
- 2026-09-22 03:02:54 fs.write: `.task/swamp-tools/add-real-swamp-compatibility-ci/workpad.md`
- 2026-09-22 03:12:54 fs.write: `.github/scripts/consuelo-swamp-compat.ts`
- 2026-09-22 03:13:21 fs.trash: `packages/os/scripts/swamp-compat-smoke.ts`
- 2026-09-22 03:15:14 fs.write: `.task/swamp-tools/add-real-swamp-compatibility-ci/workpad.md`

## Focused red evidence

- Corrected command: `bun --cwd packages/workspace vitest run tests/github-workflow-policy.test.js`.
- Result: 1 failed / 8 passed exactly as expected; `ENOENT` for `.github/workflows/consuelo-swamp-compat.yaml`.
- Trace: `trc_6b531a02b79a`.
- Initial `bun ... x vitest` attempt was a command-shape mistake (`Script not found "x"`) and is not test evidence.

- 2026-09-22 02:59:21 append: `.task/swamp-tools/add-real-swamp-compatibility-ci/workpad.md`

- 2026-09-22 03:00:28 write: `packages/os/scripts/swamp-compat-smoke.ts`

- 2026-09-22 03:00:39 write: `.github/workflows/consuelo-swamp-compat.yaml`

- 2026-09-22 03:00:44 apply-patch: `packages/os/package.json`

## workspace-owned: validation evidence

- 2026-09-22 03:00:56 `checkFiles`: passed — OK
- 2026-09-22 03:01:58 apply-patch: `packages/os/scripts/swamp-compat-smoke.ts`
- 2026-09-22 03:02:15 apply-patch: `.github/workflows/consuelo-swamp-compat.yaml`
- 2026-09-22 03:02:15 apply-patch: `packages/workspace/tests/github-workflow-policy.test.js`
- 2026-09-22 03:02:33 `checkFiles`: passed — OK
- 2026-09-22 03:03:18 `review.run`: passed — OK
- 2026-09-22 03:03:32 `checkFiles`: passed — OK
- 2026-09-22 03:03:47 `review.run`: passed — OK
- 2026-09-22 03:05:29 `verify`: failed — COMMAND_FAILED
- 2026-09-22 03:06:30 `verify`: failed — COMMAND_FAILED
- 2026-09-22 03:13:39 `checkFiles`: passed — OK
- 2026-09-22 03:14:52 `review.run`: passed — OK
- 2026-09-22 03:15:03 `verify`: passed — OK

## Green evidence

- Workflow policy: 9/9 passed; trace `trc_9ed99e38a1cf`.
- Swamp provider + scope authorization regressions: 10/10 passed; trace `trc_3b54c085b054`.
- Changed workflow security policy: `ok: true`, zero findings; trace `trc_714f7f3ef9ad`.
- `checkFiles` passed for the new smoke runner and workflow-policy test; trace `trc_d578ba960749`.
- Real current Swamp release smoke through the new reusable script passed on checksum-verified `swamp-darwin-aarch64` release `20260922.011324.0-sha.2e949db5`; trace `trc_5394f369330c`.
- Real smoke verified model + workflow discovery, write authorization scopes, missing required-input rejection, model execution, workflow execution, workflow job success, and workflow step success.
- The real smoke runner deletes its disposable Swamp/Consuelo fixture in `finally`; after the live test, only the externally downloaded binary/checksum remained in the work session. Those were then deleted and `fs.list` verified the work-session directory is empty; trace `trc_6d383828fd94`.

## CI behavior

- Dedicated workflow: `.github/workflows/consuelo-swamp-compat.yaml`.
- Triggers: nightly schedule, manual `workflow_dispatch` with optional release tag, and relevant `main` pushes.
- Explicitly no `pull_request` trigger, so external Swamp/GitHub availability cannot make normal PR CI flaky or blocking.
- CI downloads `swamp-linux-x86_64` plus upstream `checksums.txt`, verifies SHA-256 before execution, then runs `bun run --cwd packages/os smoke:swamp-compat`.

- 2026-09-22 03:02:54 append: `.task/swamp-tools/add-real-swamp-compatibility-ci/workpad.md`

- 2026-09-22 03:03:24 apply-patch: `packages/os/scripts/swamp-compat-smoke.ts`

- 2026-09-22 03:09:36 apply-patch: `packages/os/package.json`
- 2026-09-22 03:09:37 apply-patch: `.github/workflows/consuelo-swamp-compat.yaml`
- 2026-09-22 03:09:37 apply-patch: `packages/workspace/tests/github-workflow-policy.test.js`
- 2026-09-22 03:09:37 apply-patch: `packages/os/tests/audit/fixtures/script-parity-classifications.json`
- 2026-09-22 03:12:54 write: `.github/scripts/consuelo-swamp-compat.ts`

- 2026-09-22 03:13:15 apply-patch: `.github/scripts/consuelo-swamp-compat.ts`
- 2026-09-22 03:13:15 apply-patch: `.github/workflows/consuelo-swamp-compat.yaml`
- 2026-09-22 03:13:15 apply-patch: `packages/workspace/tests/github-workflow-policy.test.js`
- 2026-09-22 03:13:15 apply-patch: `packages/os/tests/audit/fixtures/script-parity-classifications.json`

- 2026-09-22 03:14:40 apply-patch: `.task/swamp-tools/add-real-swamp-compatibility-ci/workpad.md`

## Final verification

- Final live real-Swamp CI-owned harness: passed against `20260922.011324.0-sha.2e949db5`; trace `trc_11703f390987`.
- Final sandbox cleanup: work-session directory verified empty; trace `trc_0d5130254d9d`.
- Final workflow policy: 9/9 passed; trace `trc_1a8b697265ae`.
- Final changed-workflow security policy: zero findings; trace `trc_44031763b53c`.
- Final test selection is only the focused native/workflow CI suites; no whole-OS package fallback; trace `trc_1708b3cffd9b`.
- Strict review: 0 blockers; trace `trc_bfdc66b95927`.
- Canonical verify: `passed: true`, `publishValid: true`; trace `trc_bedc1acce665`.

- 2026-09-22 03:15:14 append: `.task/swamp-tools/add-real-swamp-compatibility-ci/workpad.md`
