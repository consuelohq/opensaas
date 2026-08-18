# Repair runtime retention and watchdog recovery

branch: `task/os/repair-runtime-retention-and-watchdog-recovery`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/2150/repair-runtime-retention-and-watchdog-recovery
github pr: https://github.com/consuelohq/opensaas/pull/2150
started: 2026-08-16

## acceptance criteria

- [x] Remove corrupt, obsolete runtime releases without weakening verification for current, previous, pinned, or content-base releases.
- [x] Exclude worktrees and vendor trees from both semantic index implementations while retaining existing generated-output exclusions.
- [x] Install an integrity-checked `consuelo-os` Bun clone before persisting daemon runtime paths.
- [x] Smoke-test one isolated worker without contending with the already-running supervisor.
- [x] Let the watchdog fall back to bounded launchd recovery only when canonical rolling recovery rejects an unhealthy pool.
- [x] Complete the focused suite and typecheck/verification gates.
- [ ] Publish the task.

## plan

1. Reproduce each retention, index, installer, and watchdog regression with a focused red test.
2. Implement the smallest bounded fixes and validate a live named-executable cutover.
3. Run the focused and package-level gates, inspect the final diff, and publish to `stream/os`.

## current status

- Implementation and verification are complete. Publish remains.

## files changed

- `packages/os/scripts/bootstrap.sh`
- `packages/os/scripts/install-system-daemons.sh`
- `packages/os/scripts/lib/index/indexer.js`
- `packages/os/scripts/lib/lifecycle/retention.ts`
- `packages/os/scripts/start-consuelo-daemon.sh`
- `packages/os/scripts/workspace-watchdog.sh`
- `packages/os/tests/index-path-exclusions.test.ts`
- `packages/os/tests/installer-runtime-dependencies.test.ts`
- `packages/os/tests/lifecycle-retention-uninstall.test.ts`
- `packages/os/tests/system-daemon-reliability.test.ts`
- `packages/workspace/scripts/lib/index/indexer.js`
- `packages/workspace/tests/index-path-exclusions.test.js`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-08-16 22:47:14 fs.write: `.task/os/repair-runtime-retention-and-watchdog-recovery/workpad.md`
- 2026-08-16 23:09:59 fs.write: `.task/os/repair-runtime-retention-and-watchdog-recovery/workpad.md`
- 2026-08-16 23:11:47 fs.write: `.task/os/repair-runtime-retention-and-watchdog-recovery/workpad.md`

## workspace-owned: validation evidence

- Retention regression: red on corrupt obsolete bundle digest; green after classifying only unprotected obsolete releases for deletion.
- Index path regressions: red on `vendor` and nested worktree paths; green for both mirrored indexers.
- Named executable regression: red on missing `ensure_named_bun_runtime`; green after APFS clone/copy, byte comparison, and atomic replacement.
- Installer stage regression: red on missing single-worker mode; green plus live smoke worker `/ready` on port 10851 while the production supervisor remained active.
- Watchdog fallback regression: red with no launchd recovery after canonical CLI failure; green with a bounded `kickstart` fallback.
- Live node: ports 46321 and 46322 run as `consuelo-os`; Caddy 46320, both worker readiness endpoints, and pooled health are green.
- Live watchdog: `StartInterval=30`, last exit code 0, and idle `not running` state between successful probes.
- Full lifecycle retention/uninstall suite: 21/21 passing after bringing its signed-bundle fixture up to the current recovery-capability contract.
- Full daemon reliability and index slices: 16/16 passing; installer named-runtime and isolated-stage regressions passing.
- `yarn nx run consuelo-os:typecheck`: passing.
- `git diff --check` and `bash -n` for every changed shell entrypoint: passing.
- `yarn nx run consuelo-os:test` cannot enter the package because Yarn does not recognize `packages/os` in this temporary worktree. Direct Vitest execution is used for the affected suites.
- The installer suite's 10 unrelated dry-run fixture failures reproduce unchanged from `HEAD` in an isolated archive; this repair adds two passing tests and does not add installer failures.

## key decisions

- Retention continues to fail closed for every protected release; only canonical, unprotected obsolete release directories can bypass strict verification on their way to deletion.
- The installer stages `server/main.ts` as one supervised smoke worker so it does not open the singleton lifecycle endpoint or reuse the production pool snapshot.
- Normal CLI restart remains rolling and non-destructive. Only the already-thresholded watchdog recovery path may use launchd kickstart after rolling recovery returns non-zero.
- The process-name change reuses Bun's existing embedded signature through an APFS clone/copy; no application bundle or paid Apple signing membership is required.

## notes for ko

- The historical watchdog failures followed SQLite `unable to open database file` errors under critical disk pressure. The pool was already non-ready, so rolling replacement correctly refused it; the watchdog lacked the final launchd recovery step.

## improvements noticed

- none yet

## issues and recovery

- The canonical daemon installer smoke test initially failed because it started a second supervisor against the live worker-pool snapshot. The new single-worker stage mode removes that conflict.
- Codex could boot out but not bootstrap the GUI LaunchAgent from its app sandbox. Ko reloaded the validated plist once from Terminal; the connector and both named workers recovered.

---

## publish checklist

```bash
bun run task:push -- --message "type(os): description" --changed
bun run task:pr
bun run task:finish
```

## Test-first contract

behavior under test: runtime retention accepts a verified installed release whose directory name uses the canonical sha256-<digest> form, then removes all releases except current and previous; watchdog restart paths converge without a permanent lock or stopped LaunchAgent.
existing local pattern: inspect lifecycle engine retention validation and adjacent focused tests before editing.
new or changed tests: add a focused regression reproducing the installed-directory digest mismatch and the expected two-release keep set; add watchdog coverage only if the bug is in repository logic rather than current launchd state.
focused red command: to be selected from the nearest lifecycle test target after inspection.
expected red failure: retention rejects the canonical installed release or preserves obsolete releases because identity comparison uses incompatible digest forms.
no-test waiver: not applicable.

- 2026-08-16 22:47:14 append: `.task/os/repair-runtime-retention-and-watchdog-recovery/workpad.md`

- 2026-08-16 22:49:59 apply-patch: `packages/os/tests/lifecycle-retention-uninstall.test.ts`
- 2026-08-16 22:51:31 apply-patch: `packages/os/tests/lifecycle-retention-uninstall.test.ts`
- 2026-08-16 22:52:10 apply-patch: `packages/os/scripts/lib/lifecycle/retention.ts`
- 2026-08-16 22:52:19 apply-patch: `packages/os/tests/lifecycle-retention-uninstall.test.ts`
## Semantic index path policy contract

behavior under test: the mirrored workspace and OS semantic indexers reject vendor trees and nested worktree roots, while continuing to index ordinary source files; existing exclusions already cover node_modules, dist/build/out, caches, generated output, coverage, and task metadata.
existing local pattern: both indexers export isIndexablePath and keep a mirrored EXCLUDE_DIRS set.
new or changed tests: add focused path-policy tests for both package copies.
focused red command: yarn vitest run packages/workspace/tests/index-path-exclusions.test.js packages/os/tests/index-path-exclusions.test.ts
expected red failure: vendor and worktrees paths are currently accepted.
no-test waiver: not applicable.

- 2026-08-16 23:09:59 append: `.task/os/repair-runtime-retention-and-watchdog-recovery/workpad.md`

- 2026-08-16 23:10:18 apply-patch: `packages/workspace/tests/index-path-exclusions.test.js`
- 2026-08-16 23:10:18 apply-patch: `packages/os/tests/index-path-exclusions.test.ts`
- 2026-08-16 23:10:34 apply-patch: `packages/workspace/scripts/lib/index/indexer.js`
- 2026-08-16 23:10:34 apply-patch: `packages/os/scripts/lib/index/indexer.js`
## Named service executable contract

behavior under test: macOS bootstrap atomically materializes an integrity-checked Bun clone at $CONSUELO_HOME/bin/consuelo-os and persists it as BUN_BIN before daemon generation, so supervisor and worker process names are Consuelo-owned without requiring app signing.
existing local pattern: Windows already copies Bun into the Consuelo bin directory and verifies source/destination SHA-256 before service registration.
new or changed tests: extend installer runtime dependency contract with named executable, APFS clone fallback, byte comparison, atomic replacement, and ordering assertions.
focused red command: yarn vitest run packages/os/tests/installer-runtime-dependencies.test.ts -t 'named Consuelo service executable'
expected red failure: bootstrap does not yet contain ensure_named_bun_runtime or the consuelo-os target.
no-test waiver: not applicable.

- 2026-08-16 23:11:47 append: `.task/os/repair-runtime-retention-and-watchdog-recovery/workpad.md`

- 2026-08-16 23:14:04 apply-patch: `packages/os/tests/installer-runtime-dependencies.test.ts`
- 2026-08-16 23:15:06 apply-patch: `packages/os/scripts/bootstrap.sh`
- 2026-08-16 23:28:22 apply-patch: `packages/os/tests/installer-runtime-dependencies.test.ts`
- 2026-08-16 23:28:42 apply-patch: `packages/os/scripts/start-consuelo-daemon.sh`
- 2026-08-16 23:28:42 apply-patch: `packages/os/scripts/install-system-daemons.sh`
- 2026-08-16 23:31:55 apply-patch: `packages/os/tests/system-daemon-reliability.test.ts`
- 2026-08-16 23:32:15 apply-patch: `packages/os/scripts/workspace-watchdog.sh`

- 2026-08-16 23:33:04 apply-patch: `.task/os/repair-runtime-retention-and-watchdog-recovery/workpad.md`
- 2026-08-16 23:36:21 apply-patch: `packages/os/tests/lifecycle-retention-uninstall.test.ts`
- 2026-08-16 23:36:55 apply-patch: `packages/os/tests/lifecycle-retention-uninstall.test.ts`
- 2026-08-16 23:38:29 apply-patch: `packages/os/tests/facade/__snapshots__/facade.test.ts.snap`

- 2026-08-16 23:38:48 apply-patch: `.task/os/repair-runtime-retention-and-watchdog-recovery/workpad.md`