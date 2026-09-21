# sync os sentry dependency lockfile

branch: `task/os/sync-os-sentry-dependency-lockfile`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1920/sync-os-sentry-dependency-lockfile
github pr: https://github.com/consuelohq/opensaas/pull/1920
started: 2026-08-13

## acceptance criteria

- [ ] Define explicit task acceptance criteria before coding.

## plan

1. Read the relevant code and update this plan before editing.

## current status

- Task started. Update this before publish.

## files changed

- none yet

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-08-13 21:41:19 fs.write: `.task/os/sync-os-sentry-dependency-lockfile/workpad.md`
- 2026-08-13 21:42:36 fs.write: `.task/os/sync-os-sentry-dependency-lockfile/workpad.md`
- 2026-08-13 21:45:37 fs.write: `.task/os/sync-os-sentry-dependency-lockfile/workpad.md`
- 2026-08-13 21:46:21 fs.write: `.task/os/sync-os-sentry-dependency-lockfile/workpad.md`
- 2026-08-13 21:50:03 fs.write: `.task/os/sync-os-sentry-dependency-lockfile/workpad.md`
- 2026-08-13 21:51:00 fs.write: `.task/os/sync-os-sentry-dependency-lockfile/workpad.md`

## workspace-owned: validation evidence

- 2026-08-13 21:50:34 `review.run`: passed — OK
- 2026-08-13 21:50:50 `verify`: passed — OK

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

## discovery — stream CI lockfile blocker

- Scope: repair only the root Bun lockfile for the already-merged `packages/os/package.json` dependency on `@sentry/node`; no product behavior or dependency intent changes.
- External RED evidence: stream PR #1901 OS distribution jobs fail before tests at `bun install --frozen-lockfile` with `error: lockfile had changes, but lockfile is frozen`.
- Provenance to verify in this worktree: installer telemetry commit `3ad3559954` added `@sentry/node` to `packages/os/package.json`, while the root Bun lockfile did not move with that manifest change.
- Safety boundary: do not mutate shared `node_modules`, other worktrees, or unrelated caches. Prefer lockfile-only validation because this task worktree symlinks dependencies from the main worktree and local disk is constrained.

## Test-first contract

- RED: current stream manifest + lockfile must be shown inconsistent by a frozen, lockfile-only Bun install check (or, if Bun cannot perform that safely, the already-captured production-equivalent CI failure is the accepted RED evidence).
- GREEN: regenerate the canonical root `bun.lock` from current stream manifests, then the same frozen lockfile-only check must exit 0.
- Diff contract: product diff is `bun.lock` only; task metadata/workpad may also change. `packages/os/package.json` must remain unchanged.
- Verification: strict review + full `verify --base origin/stream/os`, then normal `task.push` and `task.pr`; reuse stream PR #1901.

- 2026-08-13 21:41:19 append: `.task/os/sync-os-sentry-dependency-lockfile/workpad.md`

## workspace-owned: files read

- `.github/workflows/consuelo-os-distribution-environments.yaml`
- `package.json`
- `packages/os`
- `packages/os/package.json`
- `packages/os/tests/distribution/release-channel-workflows.test.ts`
- `packages/workspace/test-selection.rules.json`
- `packages/workspace/tests/test-selection.test.js`
- `yarn.lock`

## GREEN

- Exact RED in `packages/os`: `bun install --frozen-lockfile --lockfile-only --dry-run` exited 1 because the OS Bun lock would change (trace `trc_6527b796fbe3`).
- Regenerated `packages/os/bun.lock` with Bun 1.3.14 lockfile-only mode. The lock now records `@sentry/node ^10.38.0` and its resolved dependency closure; no install scripts or shared node_modules were touched (trace `trc_6bd36fc6e123`).
- Exact GREEN in `packages/os`: the same frozen lockfile-only dry run exits 0 (trace `trc_dd8285ef3567`).
- Product diff is exactly `packages/os/bun.lock` (+59 lines). `packages/os/package.json`, `packages/os/package-lock.json`, root `yarn.lock`, and root manifests are unchanged.
- `packages/os/package-lock.json` is legacy: no active OS workflow references it and its only history is the original OS scaffold. Active release/distribution workflows explicitly install from `packages/os` with Bun frozen-lockfile semantics.

## Focused publish selection — test-first contract

- Existing selector RED: changing only `packages/os/bun.lock` selects `auto:@consuelo/os:package-test`; that broad suite is currently red on unrelated facade contracts and also rewrites an unrelated snapshot (trace `trc_7c510db34869`).
- Behavior under test: an OS Bun lockfile change must select an exact frozen-lockfile consistency contract and suppress the broad OS package suite.
- Changed test first: `packages/workspace/tests/test-selection.test.js` models `packages/os/bun.lock`, requires rule `os-bun-lockfile-consistency`, requires suite `OS Bun frozen lockfile contract`, and forbids `@consuelo/os package test` from the execution set.
- Planned implementation after RED: add one critical/exclusive selector rule for `packages/os/bun.lock`, run the exact `bun --cwd packages/os install --frozen-lockfile --lockfile-only --dry-run` command, and regenerate the canonical selector registry.
- First selected-suite execution correctly suppressed the broad OS suite but exposed command-order semantics: `bun --cwd packages/os install` is interpreted as a package script and failed with `Script not found "install"`. The validated builtin form is `bun install --cwd packages/os --frozen-lockfile --lockfile-only --dry-run` (trace `trc_9098461110f1`). The selector regression now asserts the full command array so this cannot regress silently.

- 2026-08-13 21:46:21 append: `.task/os/sync-os-sentry-dependency-lockfile/workpad.md`

- 2026-08-13 21:47:58 apply-patch: `.task/os/sync-os-sentry-dependency-lockfile/workpad.md`
- 2026-08-13 21:47:58 apply-patch: `packages/workspace/tests/test-selection.test.js`

- 2026-08-13 21:48:26 apply-patch: `packages/workspace/test-selection.rules.json`

- 2026-08-13 21:49:27 apply-patch: `packages/workspace/tests/test-selection.test.js`
- 2026-08-13 21:49:27 apply-patch: `packages/workspace/test-selection.rules.json`
- 2026-08-13 21:49:27 apply-patch: `.task/os/sync-os-sentry-dependency-lockfile/workpad.md`
### Focused publish selection GREEN

- Selector RED: 1/25 failed exactly because `os-bun-lockfile-consistency` did not exist (trace `trc_d4380456eb15`).
- Added critical/exclusive `os-bun-lockfile-consistency` for `packages/os/bun.lock` and regenerated the canonical selector registry.
- First selected execution exposed builtin-command ordering and was corrected with an exact command assertion.
- Selector regression GREEN: 25/25 (trace `trc_43cd3ec76578`).
- Actual task selected execution GREEN: all 5 selected suites passed; `OS Bun frozen lockfile contract` passed and `@consuelo/os package test` is absent (trace `trc_c3cde6c04bdb`).
- The broad OS package suite was run once before focused ownership and remains red for unrelated facade contracts; it also generated a facade snapshot. That exact validation artifact was restored only at `packages/os/tests/facade/__snapshots__/facade.test.ts.snap`. No product file other than `packages/os/bun.lock` was reverted.

- 2026-08-13 21:50:03 append: `.task/os/sync-os-sentry-dependency-lockfile/workpad.md`

## Final verification

- Strict review against `origin/stream/os`: 0 blocking findings / 0 pre-existing findings (trace `trc_cdbf39bd3ff4`).
- Full `verify --base origin/stream/os`: passed with `publishValid: true`; focused selected suites passed and DB guard reported 0 risks/findings (trace `trc_82b06f34b7db`).
- Final implementation surface: `packages/os/bun.lock` plus the focused test-selection rule/registry/regression. No runtime source, package manifest, workflow, root lockfile, or cloud state changed.
- Ready for normal guarded task push and promotion to the existing `stream/os` review PR #1901.

- 2026-08-13 21:51:00 append: `.task/os/sync-os-sentry-dependency-lockfile/workpad.md`
