# harden Consuelo CI Bun readiness

branch: `task/twenty-migration/harden-consuelo-ci-bun-readiness`
stream: `stream/twenty-migration`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1998/harden-consuelo-ci-bun-readiness
github pr: https://github.com/consuelohq/opensaas/pull/1998
started: 2026-08-15

## acceptance criteria

- [x] Move Consuelo CI change routing out of inline Bash into a Bun-native, unit-tested repo script.
- [x] Keep `Consuelo / verify` authoritative and remove the duplicate `Consuelo / workspace contracts` full-verify job.
- [x] Add one Consuelo-owned CI setup action that pins the Bun toolchain and hides the temporary root Yarn install behind a package-manager-neutral interface.
- [x] Make OS-only Consuelo CI lanes install only the `packages/os` Bun lockfile instead of the root Yarn workspace.
- [x] Treat future Bun root-control files (`bun.lock`, `bunfig.toml`, `.bun-version`) as cross-cutting CI changes without committing a root Bun lockfile yet.
- [x] Preserve dialer, workflow-security, OS, Sites Gateway, merge-group, and manual verification behavior.
- [x] Do not change product runtime, deployment behavior, the root `packageManager`, `yarn.lock`, or Twenty deletion state.

## plan

1. Capture CI-routing/setup contracts in focused tests and prove the current inline workflow fails them.
2. Implement a Bun-native Consuelo CI planner with deterministic changed-file classification and GitHub-output support.
3. Add a reusable Consuelo CI setup composite action; keep Yarn as its current root-install implementation detail.
4. Rewrite `consuelo-ci.yaml` to consume those seams, remove the duplicate workspace gate, and make OS-only lanes Bun-only.
5. Run focused tests, workflow parser/security checks, strict review, and canonical verify before publishing to the migration stream.

## current status

- Implementation and focused validation complete. The first canonical verify exposed an overly broad OS auto-test selection; that selector boundary has been corrected and the unrelated generated snapshot was restored. Ready for final review/verify.

## files changed

- `.github/actions/consuelo-ci-setup/action.yaml`
- `.github/workflows/consuelo-ci.yaml`
- `packages/os/scripts/ci-plan.ts`
- `packages/os/tests/ci-plan.test.ts`
- `packages/os/tests/local-os-server-review-findings.test.ts`
- `packages/workspace/scripts/ci/check-github-workflows.cjs`
- `packages/workspace/test-selection.rules.json`
- `packages/workspace/test-selection.registry.json`
- `packages/workspace/tests/github-workflow-policy.test.js`
- `packages/workspace/tests/test-selection.test.js`

## workspace-owned: files changed

- `.github/actions/consuelo-ci-setup/action.yaml`
- `.github/workflows/consuelo-ci.yaml`
- `packages/os/scripts/ci-plan.ts`
- `packages/os/tests/ci-plan.test.ts`

## workspace-owned: activity log

- 2026-08-15 02:58:06 fs.write: `packages/os/tests/ci-plan.test.ts`
- 2026-08-15 03:00:03 fs.write: `packages/os/scripts/ci-plan.ts`
- 2026-08-15 03:00:11 fs.write: `.github/actions/consuelo-ci-setup/action.yaml`
- 2026-08-15 03:00:40 fs.write: `.github/workflows/consuelo-ci.yaml`

## workspace-owned: validation evidence

- 2026-08-15 03:05:41 `review.run`: passed — OK
- 2026-08-15 03:06:49 `verify`: failed — COMMAND_FAILED
- 2026-08-15 03:12:42 `review.run`: passed — OK
- 2026-08-15 03:12:50 `review.run`: passed — OK
- 2026-08-15 03:13:05 `verify`: passed — OK

## key decisions

- M0B prepares for Bun but does not create a competing root lockfile. M6 remains the authoritative root Yarn-to-Bun dependency-resolution cutover.
- `verify` already owns registry-backed test selection; the current workspace-contracts job reruns the same full verify command and adds no independent contract coverage.
- New Consuelo CI orchestration belongs in OS-owned Bun tooling rather than adding more routing logic to workflow YAML.
- Node 24 remains explicit for OS-only CI lanes; the old root Yarn action previously supplied it implicitly.
- Local composite actions are now part of workflow-security policy because M0B introduces a reusable CI action outside `.github/workflows`.
- CI-planner changes use an explicit critical/exclusive selector rule so control-plane edits do not schedule the entire OS package suite.

## Test-first contract

behavior under test: Consuelo CI routing is deterministic outside workflow YAML; all Consuelo-owned changes reach verify; Twenty-only changes remain isolated; future Bun root-control files are cross-cutting; OS-only lanes do not require the root Yarn install; the workspace duplicate verify lane is gone.
existing local pattern: `packages/workspace/tests/github-workflow-policy.test.js` protects workflow topology and `packages/workspace/scripts/test-selection.js` keeps test selection in repo-owned code instead of YAML.
new or changed tests: add focused `packages/os/tests/ci-plan.test.ts` classification tests and extend `packages/workspace/tests/github-workflow-policy.test.js` for planner/setup-action/workflow composition contracts.
focused red command: `bun x vitest run packages/os/tests/ci-plan.test.ts packages/workspace/tests/github-workflow-policy.test.js`.
expected red failure: no OS CI planner or Consuelo setup action exists; `consuelo-ci.yaml` still contains the inline classifier, duplicate workspace-contracts job, direct setup-bun/yarn-install pairs, and root Yarn installs in OS-only lanes.
no-test waiver: not applicable.

## notes for ko

- Root dependency ownership is still Yarn 4. M0B makes that an implementation detail of `consuelo-ci-setup`; M6 can replace that single root-install seam with Bun after dependency resolution is audited.
- `Consuelo / workspace contracts` was removed because it reran the same full `verify` gate. Workspace/test-selection changes remain covered by `Consuelo / verify` and its registry-backed focused suites.
- OS-only CI paths were proven locally with only `packages/os`'s Bun lockfile: no root Yarn install was required.

## improvements noticed

- A future setup-action-only change should continue to be covered by `Consuelo / verify`; if the setup action grows OS-specific behavior beyond the current Bun install seam, consider routing that path explicitly to `os-contracts` as well.

## issues and recovery

- First canonical `verify` failed because the new `packages/os/scripts/ci-plan.ts` had no focused selector ownership, so auto-selection scheduled the full OS package suite. That broad suite created unrelated missing facade snapshots. Added the `consuelo-ci-planner` critical/exclusive selector rule, regenerated the registry, restored the generated snapshot from the task base, and confirmed the selector no longer schedules the broad OS package suite.
- The existing `local-os-server-review-findings.test.ts` asserted the old inline Bash classifier/install steps. Established a focused RED failure (3/3 relevant tests), rewrote those contracts around the new planner/setup seams, then passed the full file 20/20.
- One early OS syntax invocation used incorrect Bun argument ordering and printed Bun help with exit 0. That result was discarded; the exact `bun run --cwd packages/os typecheck` command subsequently passed.

## focused validation

- CI planner + workflow policy: 30/30 passed.
- CI planner + workflow policy + test-selection contracts: 64/64 passed.
- Local OS server/CI review contracts: 20/20 passed.
- OS contract lane using only `packages/os` Bun install: 47 passed, 5 environment-gated skips.
- Sites Gateway/Cloudflare lane using only `packages/os` Bun install: 17 passed, 5 environment-gated skips.
- `packages/os` frozen Bun install: passed (28 packages installed from package-local lockfile).
- Planner CLI and `GITHUB_OUTPUT` contract: passed; immutable base/head outputs resolve to commit SHAs.
- Consuelo workflow and composite action YAML parse: passed.
- Changed-workflow/local-action security checker: 0 findings.
- `bun run --cwd packages/os typecheck`: passed (164 JS files checked).
- `git diff --check`: clean.
- GitHub protection check: main has no required status-check list; main ruleset is deletion/non-fast-forward only and stream ruleset is deletion only, so removing the duplicate workspace status cannot strand a required check.

---

## publish checklist

```bash
bun run task:push -- --message "type(twenty-migration): description" --changed
bun run task:pr
bun run task:finish
```

## workspace-owned: files read

- `.github/actions/yarn-install/action.yaml`
- `.github/actions/yarn-install/action.yml`
- `.github/workflows/consuelo-ci.yaml`
- `.github/workflows/consuelo-production-release.yaml`
- `package.json`
- `packages/os/SCRIPTS.md`
- `packages/os/package.json`
- `packages/os/scripts/check-syntax.js`
- `packages/os/tests/cloudflare-worker-deployment-contract.test.ts`
- `packages/os/tests/consuelo-sites-gateway-policy.test.ts`
- `packages/os/tests/consuelo-sites-gateway.test.ts`
- `packages/os/tests/local-os-server-review-findings.test.ts`
- `packages/os/tests/security-gateway.test.ts`
- `packages/os/tests/tool-manifest.test.ts`
- `packages/os/tests/windows-bootstrap-source.test.ts`
- `packages/os/tests/windows-platform.test.ts`
- `packages/os/tests/workspace-gateway-contract.test.ts`
- `packages/workspace/scripts/ci/check-github-workflows.cjs`
- `packages/workspace/scripts/review.js`
- `packages/workspace/scripts/test-selection.js`
- `packages/workspace/scripts/verify.js`
- `packages/workspace/test-selection.rules.json`
- `packages/workspace/tests/github-workflow-policy.test.js`
- `packages/workspace/tests/run-changed-server-task.test.mjs`
- `packages/workspace/tests/test-selection.test.js`
- `packages/workspace/tests/typeorm-cli-contract.test.mjs`

- 2026-08-15 03:12:28 apply-patch: `.task/twenty-migration/harden-consuelo-ci-bun-readiness/workpad.md`
