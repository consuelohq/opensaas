# preserve recovery lifecycle pin through onboarding

branch: `task/os/preserve-recovery-lifecycle-pin-through-onboarding`
stream: `stream/os`
pr: https://github.com/consuelohq/opensaas/pull/2263
started: 2026-08-29

## acceptance criteria

- [x] Fresh hosted bootstrap keeps `bin/consuelo` pinned to the exact verified staged release throughout onboarding, before `runtime/current` exists.
- [x] Both interactive and non-interactive onboarding pass the staged recovery package root into normal installer provisioning so `provisionLocalOs` cannot erase the pin.
- [x] `provisionLocalOs` accepts an internal recovery package root and forwards it only to lifecycle-command materialization; ordinary provisioning behavior remains unchanged when absent.
- [x] After verified runtime activation succeeds, bootstrap rematerializes the lifecycle command without the recovery pin so normal `runtime/current` resolution is canonical.
- [x] If onboarding or activation fails, the final unpin step is never reached, leaving the staged recovery command usable for status/uninstall/retry.
- [x] Focused recovery/lifecycle/install contracts, strict review, and full verify pass before promotion to `stream/os`.

## plan

1. Add RED coverage proving normal provisioning currently overwrites a recovery-pinned lifecycle command and bootstrap does not propagate the staged recovery root through onboarding/finalize it only after activation.
2. Thread a private `recoveryPackageRoot` option through installer parsing/options into `provisionLocalOs`, and pass it from both bootstrap onboarding paths.
3. Add a post-activation finalizer that rematerializes the command without the recovery pin only after `activate_verified_runtime` succeeds.
4. Run focused GREEN lifecycle/bootstrap/install tests, selector/syntax checks, strict review, and full verify; then promote into `stream/os` and resume final stream review.

## files changed

- `packages/os/scripts/bootstrap.sh`
- `packages/os/scripts/install.ts`
- `packages/os/scripts/lib/install-state.ts`
- `packages/os/tests/bootstrap-recovery-cli.test.ts`
- `packages/os/tests/lifecycle-command.test.ts`

## key decisions

- Preserve fail-safe ordering rather than moving runtime activation before onboarding: the staged release stays uncommitted until onboarding succeeds, while the recovery CLI remains executable if onboarding fails.
- Do not make `materializeLifecycleCommand` infer or scrape an existing pin. The verified staged root is explicit bootstrap state and is forwarded explicitly during the pre-activation provisioning window.
- Clear the recovery fallback only after canonical runtime activation. If the clearing call itself fails, the still-pinned command remains a safe recovery path.

## Test-first contract

behavior under test: hosted bootstrap's recovery lifecycle command survives the normal `provisionLocalOs` call performed during onboarding and is unpinned only after verified runtime activation.
existing local pattern: `prepare_recovery_cli` already materializes `bin/consuelo` with `--recovery-package-root`; `materializeLifecycleCommand` already supports the pin; `provisionLocalOs` currently calls it unconditionally without options, which is the overwrite identified by current Codex review.
new or changed tests: extend `lifecycle-command.test.ts` with a direct provisioning regression that begins from a recovery-pinned command and expects the recovery runtime to remain callable while `runtime/current` is absent; extend `bootstrap-recovery-cli.test.ts` to require recovery-root propagation in both onboarding paths plus a post-activation finalization step ordered before daemon installation.
focused red command: after destructive-literal preflight, run `packages/os/tests/lifecycle-command.test.ts` and `packages/os/tests/bootstrap-recovery-cli.test.ts` filtered to the new recovery-pin cases.
expected red failure: `ProvisionOptions` has no recovery root and normal provisioning rewrites `bin/consuelo` with an empty pin; bootstrap onboarding args omit the recovery root and has no post-activation finalizer.
no-test waiver: not applicable.

## notes for ko

- none yet

## improvements noticed

- none yet

## errors i ran into

- Two initial multi-file patch attempts failed atomically because a bootstrap test hunk and then an `install.ts` hunk did not match exact source context. I split them into targeted patches; no partial production change was lost.
- `checkFiles` reports `.sh` as an unknown Node syntax-check extension while all four TypeScript files passed (`trc_a517a06a4051`). The repository-owned syntax contract already passed (`trc_404dcbe6da4a`); bootstrap is also validated separately with `bash -n` before publish.

## validation evidence

- Test safety preflight `trc_7089fb086474`: both new recovery regression files contain no destructive/system-modifying command literals.
- RED `trc_a398968068a8`: both intended failures reproduced. Bootstrap had only one recovery-root use instead of the required three orchestration points, and normal `provisionLocalOs` erased the pin so `bin/consuelo status` failed before `runtime/current` existed.
- Focused GREEN `trc_7fd70dcac403`: recovery pin survives onboarding provisioning and bootstrap orchestration now carries the recovery root through onboarding/finalization ordering.
- Final selected-suite safety preflight `trc_63176ee8e0c3`: 30 selected test files checked clean before execution.
- Lifecycle handoff packet `trc_d2adf94127b4`: 22 files / 226 tests passed, including recovery CLI, real status/uninstall recovery, lifecycle activation, worker pool, ingress, and daemon contracts.
- Google/install-state packet `trc_3f3d8e967287`: 9 files / 102 tests passed. The JSON parse stack in stderr is an intentional corrupt-provenance fixture exercised by a passing fail-closed test.
- Lifecycle facade + repository syntax `trc_aa62ba7356d8`: 9 focused facade assertions passed and the canonical syntax checker passed.
- Shell syntax `trc_fb785bf4e1a2`: `bash -n packages/os/scripts/bootstrap.sh` passed.
- Strict review `trc_e3e2e65f17c7`: 0 task-owned issues, 0 pre-existing issues, 0 blockers. One nonblocking installation docs opportunity was reported; this change is internal failure-recovery ordering and does not change the public install command or user-facing configuration contract.
- Canonical verify `trc_c65c89451320`: full mode, passed, publish-valid, with 0 DB risks/findings across all five changed product/test files including `bootstrap.sh`.

---

## publish checklist

```bash
bun run task:push -- --message "type(os): description" --changed
bun run task:pr
bun run task:finish
```

## workspace-owned: files read

- `packages/os/scripts/bootstrap.sh`
- `packages/os/scripts/install.ts`
- `packages/os/scripts/lib/install-state.ts`
- `packages/os/tests/bootstrap-recovery-cli.test.ts`
- `packages/os/tests/lifecycle-command.test.ts`

- 2026-08-29 00:57:49 apply-patch: `packages/os/scripts/install.ts`
- 2026-08-29 00:57:52 apply-patch: `packages/os/scripts/bootstrap.sh`
- 2026-08-29 00:57:55 apply-patch: `packages/os/scripts/bootstrap.sh`
- 2026-08-29 00:57:59 apply-patch: `packages/os/scripts/bootstrap.sh`
- 2026-08-29 00:58:01 apply-patch: `packages/os/scripts/bootstrap.sh`

## workspace-owned: validation evidence

- 2026-08-29 00:59:31 `checkFiles`: failed — COMMAND_FAILED
- 2026-08-29 00:59:40 apply-patch: `.task/os/preserve-recovery-lifecycle-pin-through-onboarding/workpad.md`
- 2026-08-29 01:00:12 `review.run`: passed — OK
- 2026-08-29 01:01:03 `verify`: passed — OK

- 2026-08-29 01:01:41 apply-patch: `.task/os/preserve-recovery-lifecycle-pin-through-onboarding/workpad.md`