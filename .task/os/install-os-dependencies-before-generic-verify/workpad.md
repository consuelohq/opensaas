# install os dependencies before generic verify

branch: `task/os/install-os-dependencies-before-generic-verify`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1967/install-os-dependencies-before-generic-verify
github pr: https://github.com/consuelohq/opensaas/pull/1967
started: 2026-08-14

## acceptance criteria

- [x] Generic `Consuelo / verify` installs `packages/os` dependencies whenever OS contracts are selected, before registry-selected OS suites run.
- [x] Non-OS verify runs do not pay for the package-local OS install.
- [x] Existing dedicated `Consuelo / OS contracts` dependency setup remains unchanged.
- [x] The lifecycle handoff selector passes after the CI dependency-parity repair.
- [x] Workflow policy tests, strict review, and full verify pass before stream promotion; release scope remains canary only.

## plan

1. Add a focused workflow contract asserting the generic verify job installs OS package dependencies conditionally before `Run workspace verify`.
2. Record RED against the current stream workflow.
3. Add the smallest conditional install step to the generic verify job; do not change product/runtime or release semantics.
4. Run the focused workflow contract plus lifecycle selector, then review/verify and merge to `stream/os`.
5. Once stream CI is green, integrate the stream to main without triggering production release, then promote the already-signed runtime to canary only.

## current status

- Root cause isolated from GitHub Actions attempt 2: generic `Consuelo / verify` fails the `os-lifecycle-update-handoff` registry suite, while the dedicated `Consuelo / OS contracts` job is green on the same synthetic merge SHA.
- The dedicated OS job explicitly runs `bun install --frozen-lockfile` in `packages/os`; generic verify only runs the root Yarn install before executing package-local OS tests selected by the registry.
- The exact synthetic PR merge tree (`164aa9b8...`) passes all 136 lifecycle handoff tests locally, including under CI/GitHub env flags. The CI-only difference is dependency setup, not source tree content.
- Added the same conditional package-local install to generic verify that the dedicated OS-contract job already uses. It runs only when both generic verify and OS contracts are selected.

## files changed

- `.github/workflows/consuelo-ci.yaml`
- `packages/os/tests/local-os-server-review-findings.test.ts`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- none yet

## workspace-owned: validation evidence

- 2026-08-14 20:35:26 `review.run`: passed — OK
- 2026-08-14 20:35:40 `verify`: passed — OK

## key decisions

- Fix CI environment parity rather than weakening or bypassing the critical lifecycle selector.
- Keep the install conditional on `os_contracts == 'true'` so non-OS verify jobs remain unchanged.
- Do not alter the dedicated OS-contract job or updater implementation in this task.

## Test-first contract

- Behavior under test: when `consuelo-changes` classifies OS changes, the generic verify job prepares `packages/os/node_modules` before running registry-selected tests.
- Existing evidence: two GitHub `Consuelo / verify` attempts fail the lifecycle selector; the same merge SHA's dedicated OS-contract job succeeds after its package-local install.
- Focused test location: `packages/os/tests/local-os-server-review-findings.test.ts`, which already owns CI workflow dependency-order contracts.
- Expected RED: current generic verify block has root `Install dependencies` followed immediately by `Run workspace verify`, with no conditional package-local OS install.

## notes for ko

- none yet

## improvements noticed

- none yet

## issues and recovery

- PR #1965 generic verify failed twice on the synthetic merge SHA while the OS-specific CI job passed. The failure summary hid child-suite output, so source equality and job setup were compared directly rather than weakening the selector.
- Synthetic merge product files are byte-identical to the verified task commit. Exact lifecycle handoff tests pass against the synthetic merge tree. The meaningful job difference is that OS contracts install `packages/os` dependencies and generic verify previously did not.

### RED evidence

- Added only the generic-verify dependency-order contract and ran it focused.
- Result: 1 failed / 19 skipped. The current verify block contained root dependency install followed immediately by `Run workspace verify`; the expected conditional OS install was absent.

### GREEN evidence

- Added `Install OS dependencies for verify` before `Run workspace verify`, conditional on `verify == 'true' && os_contracts == 'true'`, with `working-directory: packages/os` and `bun install --frozen-lockfile`.
- Focused workflow contract passes.
- Full `local-os-server-review-findings.test.ts`: 20/20 passed.
- Lifecycle handoff selector command: 9 files / 136 tests passed.
- Workflow security check passed with no findings.
- Strict review against `origin/stream/os`: 0 issues / 0 blockers.
- Full verify against `origin/stream/os`: passed, `publishValid: true`, DB guard clean.

---

## publish checklist

```bash
bun run task:push -- --message "type(os): description" --changed
bun run task:pr
bun run task:finish
```

## workspace-owned: files read

- `.github/workflows/consuelo-ci.yaml`
- `packages/os/tests/local-os-server-review-findings.test.ts`

- 2026-08-14 20:33:49 apply-patch: `.task/os/install-os-dependencies-before-generic-verify/workpad.md`
- 2026-08-14 20:34:03 apply-patch: `packages/os/tests/local-os-server-review-findings.test.ts`
- 2026-08-14 20:34:22 apply-patch: `.github/workflows/consuelo-ci.yaml`

- 2026-08-14 20:34:57 apply-patch: `.task/os/install-os-dependencies-before-generic-verify/workpad.md`

- 2026-08-14 20:35:47 apply-patch: `.task/os/install-os-dependencies-before-generic-verify/workpad.md`