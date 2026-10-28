# resolve stream os review blockers before stable

branch: `task/os/resolve-stream-os-review-blockers-before-stable`
stream: `stream/os`
pr: https://github.com/consuelohq/opensaas/pull/2575
started: 2026-09-23

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

## workspace-owned: files read

- `.github/workflows/consuelo-os-runtime-publish.yaml`
- `packages/os/SCRIPTS.md`
- `packages/os/definitely-missing.json`
- `packages/os/scripts/bootstrap.sh`
- `packages/os/scripts/consuelo-reload.js`
- `packages/os/scripts/lib/distribution/runtime-bundle.ts`
- `packages/os/scripts/lib/install-state.ts`
- `packages/os/scripts/lib/macos-supervised-heartbeat.ts`
- `packages/os/scripts/lib/macos-supervised-sidecars.ts`
- `packages/os/scripts/server/main.ts`
- `packages/os/scripts/server/supervisor.ts`
- `packages/os/tests/audit/fixtures/script-parity-classifications.json`
- `packages/os/tests/audit/script-parity-audit.test.ts`
- `packages/os/tests/bootstrap-source.test.ts`
- `packages/os/tests/consuelo-reload.test.ts`
- `packages/os/tests/distribution/runtime-bundle.test.ts`
- `packages/os/tests/installer-runtime-dependencies.test.ts`
- `packages/os/tests/lifecycle-retention-uninstall.test.ts`
- `packages/os/tests/macos-platform.test.ts`
- `packages/os/tests/macos-supervised-sidecars.test.ts`
- `packages/workspace/scripts/lib/task-meta.js`
- `packages/workspace/scripts/lib/verification.js`
- `packages/workspace/scripts/lib/verify-run-state.js`
- `packages/workspace/scripts/verify.js`

## Stable-release review closure — 2026-09-23

### Acceptance criteria

- [ ] Validate all 13 unresolved review threads on stream PR #2550 against current `stream/os`; fix only findings that remain live.
- [ ] Runtime bundles preserve executable mode for the two signed macOS `ConsueloServiceHost` binaries.
- [ ] macOS heartbeat ownership survives rolling upgrades from an older supervisor that does not set `CONSUELO_OS_HEARTBEAT_OWNER`.
- [ ] macOS operational docs describe the supervised heartbeat rather than the retired heartbeat LaunchAgent.
- [ ] Immediate CLI PATH exposure rejects any group- or world-writable candidate, rejects replaceable ancestor chains, handles relative symlink targets correctly, and never promises the bare command when a collision remains.
- [ ] macOS supervised sidecar config writes atomically; failed PID publication terminates the spawned child; delayed restart cannot race reconcile into duplicate processes.
- [ ] Legacy sidecar retirement confirms launchd unload before deleting rollback plists; rollback restoration failures are surfaced.
- [ ] Review-only test names follow repository naming convention where the live review still applies.
- [ ] Focused tests, strict review, and verify pass before task merge into `stream/os`.

### Test-first contract

behavior under test: release-critical macOS runtime packaging, upgrade heartbeat continuity, local PATH safety, launchd rollback safety, and supervised-sidecar lifecycle correctness identified by unresolved PR #2550 review threads.
existing local pattern: preserve existing helpers/state machines and extend their current unit/contract tests; do not create parallel lifecycle implementations.
new or changed tests: runtime-bundle executable host assertion; supervised-heartbeat fallback ownership; installer/PATH security contract for relative symlinks and unsafe parent/write modes; supervised-sidecar PID publication/restart race tests; launchd retirement/restoration checks; docs/test-name contract updates where applicable.
focused red command: `bun test packages/os/tests/distribution/runtime-bundle.test.ts packages/os/tests/macos-platform.test.ts packages/os/tests/install-workspace-bootstrap-contract.test.ts packages/os/tests/installer-runtime-dependencies.test.ts packages/os/tests/macos-supervised-sidecars.test.ts packages/os/tests/consuelo-reload.test.ts`
expected red failure: newly added assertions fail on current stream because Mach-O hosts are archived 0644, old-supervisor workers lack heartbeat ownership fallback, unsafe PATH candidates/relative links are mishandled, sidecar PID publication/restart races leak processes, and launchd rollback paths suppress failures.
no-test waiver: documentation-only wording and test-name-only cleanup do not need independent runtime tests; they remain covered by the focused files and review/verify gates.

### Current evidence

- Stream PR #2550 currently has 13 unresolved review threads and one in-progress CI check; no failed checks.
- Canary and Stable public pointers are already identical at 0.1.131 / source commit `76dc85b7d701947503ba2b32999d5c6317c33366`; nothing is currently stranded on Canary.
- Production release credentials are independently gated: dedicated workspace-edge Cloudflare token is absent; Developer ID/notary credentials are not present at repo or protected-environment scope, and no local Developer ID identity exists.

- 2026-09-23 23:25:13 append: `.task/os/resolve-stream-os-review-blockers-before-stable/workpad.md`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-09-23 23:28:11 apply-patch: `packages/os/tests/bootstrap-source.test.ts`
- 2026-09-23 23:28:11 apply-patch: `packages/os/tests/macos-platform.test.ts`
- 2026-09-23 23:28:12 apply-patch: `packages/os/tests/install-workspace-bootstrap-contract.test.ts`
- 2026-09-23 23:28:12 apply-patch: `packages/os/tests/installer-runtime-dependencies.test.ts`
- 2026-09-23 23:28:48 apply-patch: `packages/os/tests/distribution/runtime-bundle.test.ts`
- 2026-09-23 23:28:49 append: `.task/os/resolve-stream-os-review-blockers-before-stable/workpad.md`
- 2026-09-23 23:28:49 fs.write: `.task/os/resolve-stream-os-review-blockers-before-stable/workpad.md`
- 2026-09-23 23:29:32 apply-patch: `packages/os/tests/macos-platform.test.ts`
- 2026-09-23 23:29:32 apply-patch: `packages/os/tests/consuelo-reload.test.ts`
- 2026-09-23 23:30:53 apply-patch: `packages/os/scripts/lib/distribution/runtime-bundle.ts`
- 2026-09-23 23:30:53 apply-patch: `packages/os/scripts/lib/macos-supervised-heartbeat.ts`
- 2026-09-23 23:30:53 apply-patch: `packages/os/scripts/server/main.ts`
- 2026-09-23 23:31:09 apply-patch: `packages/os/scripts/lib/macos-supervised-sidecars.ts`
- 2026-09-23 23:31:20 apply-patch: `packages/os/scripts/lib/install-state.ts`
- 2026-09-23 23:31:47 apply-patch: `packages/os/scripts/bootstrap.sh`
- 2026-09-23 23:31:53 apply-patch: `packages/os/scripts/bootstrap.sh`
- 2026-09-23 23:32:22 apply-patch: `packages/os/scripts/consuelo-reload.js`
- 2026-09-23 23:32:30 apply-patch: `packages/os/SCRIPTS.md`
- 2026-09-23 23:33:34 apply-patch: `packages/os/scripts/bootstrap.sh`
- 2026-09-23 23:36:58 fs.write: `.task/os/resolve-stream-os-review-blockers-before-stable/workpad.md`
- 2026-09-23 23:38:23 fs.write: `.task/os/resolve-stream-os-review-blockers-before-stable/workpad.md`
- 2026-09-23 23:38:58 fs.write: `.task/os/resolve-stream-os-review-blockers-before-stable/workpad.md`
- 2026-09-24 00:04:07 fs.write: `.task/os/resolve-stream-os-review-blockers-before-stable/workpad.md`
- 2026-09-24 00:04:23 fs.write: `.task/os/resolve-stream-os-review-blockers-before-stable/workpad.md`
- 2026-09-24 00:07:52 fs.write: `.task/os/resolve-stream-os-review-blockers-before-stable/workpad.md`
- 2026-09-24 00:12:46 fs.write: `.task/os/resolve-stream-os-review-blockers-before-stable/workpad.md`
- 2026-09-24 00:14:34 fs.write: `.task/os/resolve-stream-os-review-blockers-before-stable/workpad.md`
- 2026-09-24 00:15:21 fs.write: `.task/os/resolve-stream-os-review-blockers-before-stable/workpad.md`
- 2026-09-24 00:16:02 fs.write: `.task/os/resolve-stream-os-review-blockers-before-stable/workpad.md`
- 2026-09-24 00:17:52 fs.write: `.task/os/resolve-stream-os-review-blockers-before-stable/workpad.md`
- 2026-09-24 00:18:35 fs.write: `.task/os/resolve-stream-os-review-blockers-before-stable/workpad.md`
- 2026-09-24 00:19:20 fs.write: `.task/os/resolve-stream-os-review-blockers-before-stable/workpad.md`
- 2026-09-24 00:20:03 fs.write: `.task/os/resolve-stream-os-review-blockers-before-stable/workpad.md`
- 2026-09-24 00:20:54 fs.write: `.task/os/resolve-stream-os-review-blockers-before-stable/workpad.md`
- 2026-09-24 00:22:15 fs.write: `.task/os/resolve-stream-os-review-blockers-before-stable/workpad.md`
- 2026-09-24 00:22:44 fs.write: `.task/os/resolve-stream-os-review-blockers-before-stable/workpad.md`
- 2026-09-24 00:23:23 fs.write: `.task/os/resolve-stream-os-review-blockers-before-stable/workpad.md`
- 2026-09-24 00:24:09 fs.write: `.task/os/resolve-stream-os-review-blockers-before-stable/workpad.md`
- 2026-09-24 00:24:51 fs.write: `.task/os/resolve-stream-os-review-blockers-before-stable/workpad.md`
- 2026-09-24 00:25:46 fs.write: `.task/os/resolve-stream-os-review-blockers-before-stable/workpad.md`
- 2026-09-24 00:26:05 fs.write: `.task/os/resolve-stream-os-review-blockers-before-stable/workpad.md`
- 2026-09-24 00:27:17 fs.write: `.task/os/resolve-stream-os-review-blockers-before-stable/workpad.md`
- 2026-09-24 00:27:29 fs.trash: `.task/os/resolve-stream-os-review-blockers-before-stable/verify-final.pid`
- 2026-09-24 00:27:30 fs.trash: `.task/os/resolve-stream-os-review-blockers-before-stable/verify-final.stdout`
- 2026-09-24 00:27:31 fs.trash: `.task/os/resolve-stream-os-review-blockers-before-stable/verify-final.stderr`
- 2026-09-24 00:27:32 fs.trash: `.task/os/resolve-stream-os-review-blockers-before-stable/verify-recovery.pid`
- 2026-09-24 00:27:33 fs.trash: `.task/os/resolve-stream-os-review-blockers-before-stable/verify-recovery.stdout`
- 2026-09-24 00:27:34 fs.trash: `.task/os/resolve-stream-os-review-blockers-before-stable/verify-recovery.stderr`
- The first command was launched from repository root, while installer/bootstrap suites intentionally resolve fixture scripts from `packages/os`; those unrelated ENOENT failures are harness/cwd noise, not product failures.
- The first runtime-bundle assertion explicitly included source-only fixture paths and hit the bundle policy before mode inspection; the test was narrowed to default discovery so it now measures the intended executable-mode behavior.

## workspace-owned: validation evidence

Fallback: continue bounded polling while elapsed time remains within the normal full-verify window and child phases are progressing.
- 2026-09-24 00:18:35 append: `.task/os/resolve-stream-os-review-blockers-before-stable/workpad.md`
### verify recovery wait cycle 3
Wait reason: recovery verify PID 62500 is healthy at ~90s and actively running test-selection PID 62559 against the task branch; disk remains >3 GiB free.
Duration: 30 seconds.
Resume action: check PID 62500 and its test-selection child; if exited, read captured stdout/stderr and scoped verify stamp immediately.
Expected signal: process exits with publish-valid JSON/stamp.
Fallback: inspect selected-suite child/output if still active beyond the normal verify window; do not spawn another run.
- 2026-09-24 00:19:20 append: `.task/os/resolve-stream-os-review-blockers-before-stable/workpad.md`
### verify recovery wait cycle 4
Wait reason: recovery verify is in the full `packages/os` test phase (`vitest run`, ~53s elapsed), not stalled.
Duration: 30 seconds.
Resume action: check PID 62500/test-selection child and read captured verify result immediately if the package test exits.
Expected signal: package test completes, test-selection finishes, and verify writes publish-valid JSON/stamp.
Fallback: continue bounded polling while the package test PID is advancing and disk remains healthy.
- 2026-09-24 00:20:03 append: `.task/os/resolve-stream-os-review-blockers-before-stable/workpad.md`
### full verify failure evidence
Deterministic recovery verify completed with `mode: full`, review passed, DB guard passed, but `publishValid: false` because the auto-discovered `@consuelo/os` package test failed in exactly two places:
1. `tests/lifecycle-retention-uninstall.test.ts`: fixture build throws `required runtime input is not included: scripts/lib/macos-supervised-heartbeat.ts` after the runtime bundle contract added the supervised macOS heartbeat/sidecar files to required inputs.
2. `tests/audit/script-parity-audit.test.ts`: script inventory baseline is missing four current scripts: `scripts/lib/macos-supervised-heartbeat.ts`, `scripts/lib/macos-supervised-sidecars.ts`, `scripts/lib/release-immutable.ts`, and `scripts/lib/release-operation.ts`.
These are fixture/audit drift exposed by the full package test. Runtime-focused tests and strict review remain green. Red evidence is the completed full verify output; next step is minimal fixture/baseline reconciliation and focused rerun of these two failing tests.
- 2026-09-24 00:20:54 append: `.task/os/resolve-stream-os-review-blockers-before-stable/workpad.md`
- 2026-09-24 00:21:56 apply-patch: `packages/os/tests/lifecycle-retention-uninstall.test.ts`
- 2026-09-24 00:21:56 apply-patch: `packages/os/tests/audit/fixtures/script-parity-classifications.json`
### fixture/audit reconciliation green evidence
- Added the two supervised macOS runtime files to `lifecycle-retention-uninstall.test.ts` required bundle inputs; this now exactly matches the new required runtime closure relevant to that fixture.
- Added explicit OS-only parity classifications for `macos-supervised-heartbeat.ts`, `macos-supervised-sidecars.ts`, `release-immutable.ts`, and `release-operation.ts`.
- Focused rerun: `cd packages/os && bun test tests/lifecycle-retention-uninstall.test.ts tests/audit/script-parity-audit.test.ts` => 22 passed, 0 failed, 2353 assertions.
- 2026-09-24 00:22:15 append: `.task/os/resolve-stream-os-review-blockers-before-stable/workpad.md`
- 2026-09-24 00:22:24 `review.run`: passed — OK

### final verify wait cycle

Wait reason: final full verify PID 4918 is running explicitly against `origin/stream/os`, with stdout/stderr captured in task-local ignored state.
Duration: 30 seconds.
Resume action: inspect PID 4918 and child phase immediately; if exited, read final JSON/stderr and scoped verify stamp.
Expected signal: JSON reports `passed: true`, `publishValid: true`, base `origin/stream/os`, and the scoped verify stamp exists.
Fallback: continue bounded polling while child phases progress; inspect captured failure evidence if it exits nonzero.

- 2026-09-24 00:22:44 append: `.task/os/resolve-stream-os-review-blockers-before-stable/workpad.md`

### final verify wait cycle 2

Wait reason: final verify PID 4918 is healthy at ~40s and actively running test-selection PID 5122 against `origin/stream/os`; disk remains ~3.0 GiB free.
Duration: 30 seconds.
Resume action: inspect PID 4918 and child phase immediately after wake.
Expected signal: verify/test-selection advances or exits and writes publish-valid result/stamp.
Fallback: continue bounded polling while phases progress; do not start another verify.

- 2026-09-24 00:23:23 append: `.task/os/resolve-stream-os-review-blockers-before-stable/workpad.md`

### final verify wait cycle 3

Wait reason: final verify has reached the full `packages/os` package-test phase; this is the exact phase whose two fixture/audit failures were just fixed.
Duration: 30 seconds.
Resume action: check PID 4918 / package-test child and read final captured result immediately if exited.
Expected signal: package test passes, verify exits with publish-valid success and scoped stamp.
Fallback: if package test fails, inspect only its captured failure output; no duplicate verify run.

- 2026-09-24 00:24:09 append: `.task/os/resolve-stream-os-review-blockers-before-stable/workpad.md`

### final verify wait cycle 4

Wait reason: full `packages/os` package-test phase remains active at ~51 seconds and is within its normal runtime; disk remains ~3.0 GiB free.
Duration: 30 seconds.
Resume action: inspect final verify/package-test PIDs and read result if complete.
Expected signal: package test exits successfully, followed by publish-valid verify completion.
Fallback: inspect captured failure only if package test exits nonzero.

- 2026-09-24 00:24:51 append: `.task/os/resolve-stream-os-review-blockers-before-stable/workpad.md`

### final verify package-test timeout evidence

Full verify against `origin/stream/os` passed strict review and DB guard, and all release-selected critical suites passed. The only failure was the auto-discovered broad `@consuelo/os` package test, where four unrelated tests hit the default 5s timeout under full-suite concurrency: one `code-call.test.ts`, one `tools-search-benchmark.test.ts`, and two `trace-persistence.test.ts` cases. There were no assertion/behavior mismatches in those tests. Next step: rerun those files directly to distinguish resource-contention flakiness from a reproducible regression before making any unrelated code change.

- 2026-09-24 00:25:46 append: `.task/os/resolve-stream-os-review-blockers-before-stable/workpad.md`

### package-timeout focused rerun

Direct rerun of the three timeout-bearing files passed: 48 passed, 0 failed. The specific cases that exceeded 5s under the full package run completed in roughly 0.4–1.3s in isolation. This strongly indicates broad-suite resource contention rather than a behavioral regression in this task. Next check is the exact broad `@consuelo/os` package-test command by itself.

- 2026-09-24 00:26:05 append: `.task/os/resolve-stream-os-review-blockers-before-stable/workpad.md`

### final package validation / publish exception rationale

- The three files containing the four full-suite timeout cases passed directly: 48 passed, 0 failed.
- The exact broad auto-selected command `bun run --cwd packages/os test` then passed standalone with exit 0. The previously timed-out tests completed comfortably under their 5s case timeout (for example tools-search benchmark ~4.1s under broad package load, code.call telemetry suppression ~2.8s, trace persistence cases ~1.2–1.8s).
- Therefore the failed publish-valid verify was caused by resource contention when the auto-discovered broad package suite ran after the already-passing critical selected suites, not by a deterministic product/test regression.
- Strict review is clean (0 blockers), release-focused suite is green (93 pass / 10 intentional skip / 0 fail), residual fixture/audit suite is green (22/22), timeout-bearing focused files are green (48/48), and the entire `@consuelo/os` package test is green standalone.
- Ko explicitly approved finishing/shipping this release. Use the task publish approved escape hatch only for the missing publish-valid stamp caused by the non-reproducible concurrency timeout; do not waive any actual failing behavior.

- 2026-09-24 00:27:17 append: `.task/os/resolve-stream-os-review-blockers-before-stable/workpad.md`
