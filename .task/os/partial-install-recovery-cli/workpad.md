# Partial install recovery CLI

branch: `task/os/partial-install-recovery-cli`
stream: `stream/os`
pr: https://github.com/consuelohq/opensaas/pull/2250
started: 2026-08-28

## acceptance criteria

- [x] A hosted curl install exposes an executable `~/.consuelo/bin/consuelo` before device authorization/onboarding starts.
- [x] The recovery command can run from the exact cryptographically verified staged runtime even when `runtime/current` is not yet activated.
- [x] `~/.consuelo/bin` is reconciled into the supported shell profile before onboarding, idempotently and with the existing collision warning.
- [x] Failed onboarding leaves a supported command surface for `consuelo status` and `consuelo uninstall`, plus a clear installer retry path; no duplicate bootstrap-only lifecycle logic is introduced.
- [x] Successful provisioning rewrites/reconciles the wrapper to normal `runtime/current` semantics so it does not pin a stale release path.
- [x] Existing successful install, release activation, lifecycle, and uninstall behavior remains green in focused/critical suites.
- [x] Scope stays limited to local partial-install recovery; D1 connector/tunnel deprovision reconciliation remains separate.
- [ ] Register the two new regression files in the existing explicit critical lifecycle test-selection rule so canonical verify runs them without falling back to the historically noisy full OS package suite.
- [ ] Earn a publish-valid full verify stamp, then push only this task PR. Do not merge/release.

## plan

1. Reuse/export the lifecycle command materializer already owned by `install-state.ts`, adding an optional exact verified recovery-runtime fallback.
2. Add a private `install.ts` materialization mode that bootstrap invokes after signed runtime verification/dependencies but before onboarding.
3. Reorder bootstrap so recovery command + PATH reconciliation happen before `run_onboarding`, while canonical `runtime/current` activation remains after successful onboarding.
4. Let normal `provisionLocalOs` call the same materializer without a recovery fallback so successful provisioning removes the temporary release pin.
5. Add process-level tests for exact recovery execution/reconciliation, real pre-onboarding `status`/`uninstall --dry-run`, and bootstrap ordering/failure guidance.
6. Register those regression files in the focused critical lifecycle test-selection rule and prove the broad auto package suite is suppressed for this exact change set.
7. Re-run review + canonical verify. Push PR #2250 only with a real publish-valid stamp; do not merge or release.

## Test-first contract

behavior under test: A verified hosted runtime becomes a usable recovery CLI before device auth; the wrapper can execute lifecycle commands without `runtime/current`, then reconciles to canonical runtime semantics after successful provisioning.
existing local pattern: `materializeLifecycleCommand` in `scripts/lib/install-state.ts`, executable-wrapper assertions in `tests/install-state.test.ts`, bootstrap ordering around runtime verification/onboarding/activation, and lifecycle `no-install`/partial handling.
new or changed tests: `tests/lifecycle-command.test.ts` and `tests/bootstrap-recovery-cli.test.ts`; add a focused test-selection regression for their canonical rule ownership before modifying rule data.
focused red command: `bun test packages/os/tests/lifecycle-command.test.ts packages/os/tests/bootstrap-recovery-cli.test.ts` originally failed before production edits because the pre-onboarding recovery path did not exist. For verifier ownership, run the targeted workspace test-selection assertion before updating rule data; it must fail by selecting `@consuelo/os package test`.
expected red failure: recovery materialization/ordering initially absent; verifier-ownership regression initially sees the broad auto package suite because the two new test files are not yet owned by an explicit critical rule.
no-test waiver: not applicable.

## current implementation

- `packages/os/scripts/lib/install-state.ts`
  - exports `materializeLifecycleCommand`
  - accepts optional `recoveryPackageRoot`
  - embeds a shell-safe exact recovery root fallback after `CONSUELO_OS_PACKAGE_ROOT` and `runtime/current`
  - normal provisioning calls without fallback, removing any stale release pin
- `packages/os/scripts/install.ts`
  - private `--materialize-lifecycle-command` mode, accepted only as argv[0]
  - accepts `--home` and `--recovery-package-root`
  - exits before onboarding/telemetry prompts after materialization
- `packages/os/scripts/bootstrap.sh`
  - `prepare_recovery_cli()` runs after verified runtime + dependencies, before onboarding
  - `ensure_command_on_path` now runs before onboarding and remains idempotent/collision-aware
  - canonical `activate_verified_runtime` remains after onboarding
  - onboarding failures print recovery commands: `consuelo status`, `consuelo uninstall --dry-run --json`, and installer retry
  - dry-run PATH behavior remains non-mutating
- `packages/os/tests/lifecycle-command.test.ts`
  - exact verified fallback, quoting, private installer bridge, real lifecycle status/uninstall, stale fallback removal
- `packages/os/tests/bootstrap-recovery-cli.test.ts`
  - ordering, post-onboarding activation invariant, PATH idempotence/collision warning, failure guidance

## validation evidence

- Initial focused tests were written before production edits and failed for the missing recovery module/order as expected.
- `bash -n packages/os/scripts/bootstrap.sh`: pass.
- `bun run typecheck` from `packages/os`: pass.
- focused recovery tests: 6 passed / 0 failed.
- broader relevant installer/lifecycle suite: 146 passed / 0 failed / 800 expectations.
- `review.run` strict before verifier-rule wiring: zero blocking issues and zero findings.
- canonical critical `OS lifecycle update handoff contracts`: 20 files / 218 tests passed.
- canonical lifecycle syntax contracts: passed.
- canonical lifecycle facade snapshots: 9 focused tests passed.
- canonical critical `OS Google Workspace contracts`: 9 files / 102 tests passed.
- full verify did not stamp because test selection additionally chose the noncritical broad `@consuelo/os package test`, which has unrelated pre-existing cwd/subagent/media failures. Do not weaken verifier semantics; instead register new regression files under existing critical focused coverage.

## verifier / infrastructure recovery

- Long MCP verify calls returned 502 while child verifier processes kept running; three duplicate verifier process groups from this task were terminated, leaving the canonical run intact.
- Duplicate verifiers exhausted temp storage and produced ENOSPC. Removed only stale Consuelo test fixtures and stale package-manager fixtures with exact test markers; reclaimed ~5.5 GB total, leaving ~8.5 GiB free. No repo/user data removed.
- Final verify then ran normally. All critical task-relevant suites passed; only broad auto OS package test failed with unrelated package-wide baseline failures.
- Existing `test-selection` contract intentionally suppresses broad auto package suites when explicit critical coverage owns all changed files. Our two new test files are the only missing ownership, so rule registration is the correct scope-safe fix.
- Task-scoped OS calls later returned `TASK_WORKSPACE_MISMATCH`. Re-running supported `task.start` against existing PR #2250 reused the same branch/worktree/PR and refreshed task bookkeeping; this workpad was restored immediately afterward.

## key decisions

- Do not activate `runtime/current` before onboarding. Lifecycle inspection treats a valid current runtime as an installed/valid state, which would misrepresent failed onboarding. Recovery wrapper points to the exact verified release instead.
- Do not duplicate uninstall/status logic in bootstrap; expose the existing signed lifecycle authority earlier.
- Do not advertise `repair` before onboarding because real lifecycle repair requires an installed identity. `status`, uninstall dry-run, and installer retry are truthful recovery paths.
- Do not change test-selection pass/fail semantics to accommodate noisy noncritical suites; use existing explicit critical rule ownership instead.

## improvements noticed

- Separate future task: node/route revocation does not fully reconcile legacy `workspace_connectors`, and there is no explicit coordinated Cloudflare Tunnel deprovision path.
- Separate workflow issue: long MCP verify calls can return 502 without cancelling child verifier processes, creating duplicate resource pressure.

## issues and recovery

- `session.start` schema drift required `workflow: task`, title, and area.
- Initial attempt to extract a new executable-wrapper module hit workspace safety gate. Narrowed design to export/reuse existing materializer via a private installer mode.
- First production patch edit had quoting failure and changed nothing; retried with simpler deterministic edit.
- First broader test command used repo-root cwd for tests designed around `packages/os`; rerun from correct cwd.
- Canonical package-wide test remains noisy for unrelated reasons; focused critical suites are green. Rule registration below must make canonical selection use the intended focused suite for this task.

---

## publish checklist

- [ ] new regression files owned by explicit critical test-selection rule
- [ ] targeted test-selection regression red -> green
- [ ] strict review clean after registry change
- [ ] canonical full verify stamp: pass + publishValid
- [ ] task push to PR #2250
- [ ] stop; no stream merge, canary, stable, or target-Mac install yet

- 2026-08-29 00:03:32 write: `.task/os/partial-install-recovery-cli/workpad.md`

## files changed

- none yet

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-08-29 00:03:32 fs.write: `.task/os/partial-install-recovery-cli/workpad.md`
- 2026-08-29 00:04:16 append: `.task/os/partial-install-recovery-cli/workpad.md`
- 2026-08-29 00:04:16 fs.write: `.task/os/partial-install-recovery-cli/workpad.md`
- 2026-08-29 00:11:38 fs.write: `.task/os/partial-install-recovery-cli/workpad.md`
- 2026-08-29 00:14:20 fs.write: `.task/os/partial-install-recovery-cli/workpad.md`
- Added the targeted test-selection regression before changing rule data.
- Green evidence: the targeted test now passes. Exact five-file selection chooses lifecycle handoff + lifecycle syntax + lifecycle facade + Google Workspace focused suites; the broad `@consuelo/os package test` suite is suppressed.
- Red evidence: `bun x vitest run packages/workspace/tests/test-selection.test.js -t "partial-install recovery CLI"` failed because selected suites still included `@consuelo/os package test`.
- Regenerated `packages/workspace/test-selection.registry.json` with canonical `bun run test-selection:generate` (2673 tests, 2588 mapped, 85 unmapped, 72 rules).
- Updated only the existing explicit critical `os-lifecycle-update-handoff` rule to own `packages/os/tests/bootstrap-recovery-cli.test.ts` and `packages/os/tests/lifecycle-command.test.ts`, and added those files to its focused Vitest command.

## workspace-owned: validation evidence

- Initial focused tests were written before production edits and failed for the missing recovery module/order as expected.
- `bash -n packages/os/scripts/bootstrap.sh`: pass.
- `bun run typecheck` from `packages/os`: pass.
- focused recovery tests: 6 passed / 0 failed.
- broader relevant installer/lifecycle suite: 146 passed / 0 failed / 800 expectations.
- `review.run` strict before verifier-rule wiring: zero blocking issues and zero findings.
- canonical critical `OS lifecycle update handoff contracts`: 20 files / 218 tests passed.
- canonical lifecycle syntax contracts: passed.
- canonical lifecycle facade snapshots: 9 focused tests passed.
- canonical critical `OS Google Workspace contracts`: 9 files / 102 tests passed.
- full verify did not stamp because test selection additionally chose the noncritical broad `@consuelo/os package test`, which has unrelated pre-existing cwd/subagent/media failures. Do not weaken verifier semantics; instead register new regression files under existing critical focused coverage.
- 2026-08-29 00:07:06 `review.run`: passed — OK
- 2026-08-29 00:08:22 `verify`: failed — COMMAND_FAILED
### canonical runner compatibility
- Canonical selection exposed a test-only defect in the new `lifecycle-command.test.ts`: it used `process.execPath`, which is Bun under `bun test` but Node under the repository's `bun x vitest` lifecycle suite. Production behavior was unaffected; Node then failed to resolve Bun-oriented TypeScript imports.
- Updated the test to resolve the actual Bun executable from PATH and use that both for the private `install.ts` bridge and generated recovery wrapper `.env`.
- Focused canonical-runner evidence: `bun x vitest run packages/os/tests/lifecycle-command.test.ts packages/os/tests/bootstrap-recovery-cli.test.ts` => 2 files, 6 tests passed.
- An earlier broad local run had one existing 5s `install-state` timeout at 5.13s; isolated rerun passed in 1.33s and canonical Google Workspace contracts subsequently passed 102/102, so no timeout policy/product code was changed.
- 2026-08-29 00:11:38 append: `.task/os/partial-install-recovery-cli/workpad.md`
- 2026-08-29 00:12:57 `review.run`: passed — OK
- 2026-08-29 00:14:13 `verify`: passed — OK

### final gate

- Exact canonical selected matrix after Bun-runner repair: pass. Lifecycle handoff suite 22 files / 224 tests passed; Google Workspace suite 9 files / 102 tests passed; workspace test-selection 53/53; syntax/facade and CI selector contracts passed.
- Final strict review: 0 blocking issues, 0 findings; one nonblocking documentation opportunity for installer docs.
- Final full verify: `base=HEAD`, `headSha=2d6003550062733775febca3d39d4afa1265ea40`, `passed=true`, `publishValid=true`; stamp at `.task/os/partial-install-recovery-cli/verify.json`.
- Publish boundary: push existing PR #2250 only. Do not merge stream/os or release canary/stable in this task.

- 2026-08-29 00:14:20 append: `.task/os/partial-install-recovery-cli/workpad.md`
