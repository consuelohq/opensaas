# fix remaining os package linux test portability

branch: `task/os/fix-remaining-os-package-linux-test-portability`
stream: `stream/os`
pr: https://github.com/consuelohq/opensaas/pull/2506
started: 2026-09-21

## acceptance criteria

- [x] Bootstrap dry-run tests provide a deterministic valid install telemetry correlation id instead of depending on Bun being available before dependency installation.
- [x] Daemon dry-run resolves core generated plist paths after generation, so first-run installs/dry-runs use the mutable OS security directory rather than stale in-release fallbacks.
- [x] Connector fixture tests provide an executable managed cloudflared binary when exercising reconciliation.
- [x] Lifecycle help uses a Vitest-supported prefix assertion.
- [x] Focused RED reproduces the CI failures; focused GREEN passes 25/25.
- [x] Strict review passes with 0 blocking findings.
- [ ] Stream CI passes before canary release/update.

## plan

1. Reproduce the exact remaining `@consuelo/os` package failures from stream CI.
2. Separate stale test-fixture assumptions from the real first-run daemon generation bug.
3. Fix the installer test harness for telemetry/cloudflared and re-resolve generated daemon plist paths after generation.
4. Run focused GREEN, review, promote, rerun stream CI, then release/update canary.

## files changed

- `packages/os/scripts/install-system-daemons.sh` — refresh generated plist paths after the generator writes into the mutable OS directory.
- `packages/os/tests/installer-runtime-dependencies.test.ts` — deterministic install id + executable cloudflared fixtures for bootstrap/daemon tests.
- `packages/os/tests/lifecycle-help.test.ts` — replace unsupported `toStartWith` Chai extension with native string prefix assertion.

## key decisions

- Keep production install telemetry strict. Tests that intentionally remove Bun must supply the valid correlation id that a real installer would already carry.
- Fix the daemon installer itself for the plist issue: it resolved fallback paths before generating the mutable files and never refreshed those variables, so first-run dry-run/install could lint retired paths.
- Keep managed cloudflared executable validation strict; fixture plists now model a real installed binary instead of pointing at nonexistent `/tmp/cloudflared`.

## notes for ko

- This was the last group surfaced by the current stream package gate after the prior three release-blocker fixes.
- Focused RED: 11/25 failed initially (`trc_29b104be55ae`). After isolating telemetry/plist/cloudflared causes, focused GREEN is 25/25 (`trc_554f9d22d778`).
- The daemon path refresh is a small real product fix, not just CI cleanup: on a first run with no preexisting generated plist, `resolve_generated_plist` selected the retired runtime fallback before generation and retained it afterward.
- Cross-blocker regression set is GREEN 44/44 (`trc_12ec4403d36b`); strict review is clean (`trc_46efdd761ac0`).

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

## Test-first contract

behavior under test: the remaining `@consuelo/os` package tests must be portable across Linux CI and local macOS: lifecycle help assertions use supported Vitest matchers, and installer-daemon fixtures provide the binaries/environment required by the daemon reconciliation path they exercise.
existing local pattern: `tests/lifecycle-help.test.ts` invokes the lifecycle CLI and checks exact root help; `tests/installer-runtime-dependencies.test.ts` builds isolated temp Consuelo homes and executes the daemon installer/reconciliation scripts with fixture environment.
new or changed tests: fix only the test harness/expectations that are invalid on CI; do not weaken product assertions or alter production daemon behavior unless focused evidence proves a product defect.
focused red command: `cd packages/os && bun run test -- tests/lifecycle-help.test.ts tests/installer-runtime-dependencies.test.ts`
expected red failure: lifecycle help rejects unsupported Chai matcher `toStartWith`; installer runtime cases exit non-zero when their fixture environment cannot resolve required commands/managed cloudflared.
no-test waiver: not applicable.

- 2026-09-21 04:50:02 append: `.task/os/fix-remaining-os-package-linux-test-portability/workpad.md`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-09-21 04:50:02 fs.write: `.task/os/fix-remaining-os-package-linux-test-portability/workpad.md`

## workspace-owned: files read

- `packages/os/scripts/generate-system-daemons.sh`
- `packages/os/tests/installer-runtime-dependencies.test.ts`
- `packages/os/tests/lifecycle-help.test.ts`

- 2026-09-21 04:53:08 apply-patch: `packages/os/tests/installer-runtime-dependencies.test.ts`

- 2026-09-21 04:53:33 apply-patch: `.task/os/fix-remaining-os-package-linux-test-portability/workpad.md`

## workspace-owned: validation evidence

- 2026-09-21 04:54:37 `review.run`: passed — OK

- 2026-09-21 04:54:46 apply-patch: `.task/os/fix-remaining-os-package-linux-test-portability/workpad.md`