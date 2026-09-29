# repair Bun clean runner CI dependencies

branch: `task/twenty-migration/repair-bun-clean-runner-ci-dependencies`
stream: `stream/twenty-migration`
pr: https://github.com/consuelohq/opensaas/pull/2489
started: 2026-09-21

## acceptance criteria

- [ ] Define explicit task acceptance criteria before coding.

## plan

1. Read the relevant code and update this plan before editing.

## files changed

- `.github/actions/consuelo-ci-setup/action.yaml`

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
bun run task:push -- --message "type(twenty-migration): description" --changed
bun run task:pr
bun run task:finish
```

## Test-first contract

behavior under test:
- A clean GitHub Linux runner installed from the Bun-owned repository must be able to execute workspace verification without relying on transitive hoisting from the removed Yarn graph.
- The standalone @consuelo/dialer package must declare every runtime package it imports directly; specifically its Sentry instrumentation must resolve after a clean Bun install.
- Fixes must preserve the independent packages/workspace Bun dependency boundary rather than folding unrelated OS/docs/vendor package-manager ownership into the root workspace.

existing local pattern:
- packages/workspace is intentionally outside the root workspaces and owns its own package.json/bun.lock; its manifest directly declares yaml.
- Consuelo CI setup already supports independent packages/os installation in addition to root installation.
- packages/dialer directly imports @sentry/node from providers/twilio.ts and services/conference.ts but its package manifest does not declare @sentry/node.
- Local developer worktrees symlink long-lived node_modules, so both undeclared boundaries can be masked locally.

new or changed tests:
- Extend the M6 Bun cutover contract to require Consuelo CI setup to install packages/workspace from its frozen Bun lock when workspace tooling is used.
- Extend the M6 contract to require @consuelo/dialer to declare @sentry/node as a runtime dependency.
- Regenerate the root Bun lock after the dialer manifest fix.
- Re-run the exact GitHub-triggered verify/dialer contracts and a clean archive install reproduction.

focused red command / evidence:
- GitHub stream PR #1991 head fc095fb1:
  - Consuelo / verify job 106185860383 failed on a clean Linux runner with: Cannot find package 'yaml' from packages/workspace/scripts/lib/paths.js.
  - Consuelo / dialer job 106185860319 failed 2 tests with: Cannot find module '@sentry/node' from packages/dialer/src/providers/twilio.ts and packages/dialer/src/services/conference.ts.

expected red failure:
- CI setup installs root + OS dependencies but not the independent packages/workspace dependency graph, so workspace verify cannot resolve yaml.
- @consuelo/dialer imports @sentry/node without declaring it, so Bun does not guarantee that module in the package's resolution boundary.

no-test waiver: not applicable.

- 2026-09-21 01:33:12 append: `.task/twenty-migration/repair-bun-clean-runner-ci-dependencies/workpad.md`

## workspace-owned: files changed

- `.github/actions/consuelo-ci-setup/action.yaml`

## workspace-owned: activity log

- 2026-09-21 01:33:12 fs.write: `.task/twenty-migration/repair-bun-clean-runner-ci-dependencies/workpad.md`
- 2026-09-21 01:34:25 fs.write: `.github/actions/consuelo-ci-setup/action.yaml`
- 2026-09-21 01:36:26 fs.write: `.task/twenty-migration/repair-bun-clean-runner-ci-dependencies/workpad.md`

## workspace-owned: files read

- `.github/actions/consuelo-ci-setup/action.yaml`
- `.github/workflows/consuelo-ci.yaml`
- `packages/dialer/package.json`
- `packages/workspace/tests/twenty-migration-bun-cutover.test.ts`

- 2026-09-21 01:34:00 apply-patch: `packages/workspace/tests/twenty-migration-bun-cutover.test.ts`
- 2026-09-21 01:34:25 write: `.github/actions/consuelo-ci-setup/action.yaml`

- 2026-09-21 01:34:34 apply-patch: `.github/workflows/consuelo-ci.yaml`
## GREEN evidence

- M6 Bun cutover contract: 7/7 passed after adding explicit clean-runner dependency-boundary assertions.
- GitHub workflow/action policy checker: passed with zero findings.
- Clean temporary install reproduced CI boundaries without long-lived local node_modules:
  - root frozen Bun install: passed, 5,096 packages installed;
  - independent packages/workspace frozen Bun install: passed, 193 packages installed;
  - importing `yaml` from packages/workspace: resolved;
  - importing `@sentry/node` from packages/dialer: resolved.
- Full @consuelo/dialer tests after declaring Sentry directly: 224 passed / 0 failed across 26 files.
- Root bun.lock regenerated and frozen-lockfile validation passed.

Implementation:
- consuelo-ci-setup now has opt-in `install-workspace` support using packages/workspace/bun.lock.
- the main verify job enables `install-workspace: 'true'`.
- @consuelo/dialer now directly declares `@sentry/node: ^10.38.0`.
- no dialer algorithm/model behavior was changed.

Next: strict review + canonical verify, then publish PR #2489 into the migration stream and require fresh stream CI.

- 2026-09-21 01:36:26 append: `.task/twenty-migration/repair-bun-clean-runner-ci-dependencies/workpad.md`

## workspace-owned: validation evidence

- 2026-09-21 01:36:40 `review.run`: passed — OK
- 2026-09-21 01:36:51 `verify`: passed — OK
