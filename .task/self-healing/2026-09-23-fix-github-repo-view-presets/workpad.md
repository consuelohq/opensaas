# 2026-09-23 fix github repo view presets

branch: `task/self-healing/2026-09-23-fix-github-repo-view-presets`
stream: `stream/self-healing`
pr: https://github.com/consuelohq/opensaas/pull/2577
started: 2026-09-24

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
bun run task:push -- --message "type(self-healing): description" --changed
bun run task:pr
bun run task:finish
```

## workspace-owned: files read

- `packages/os/definitely-missing.json`

## acceptance criteria — defined

- [ ] `github({ operation: "repo.view", preset: "full" })` uses only fields supported by `gh repo view` and succeeds for a valid repository.
- [ ] PR presets retain their existing PR-specific field sets; repository metadata gets an operation-specific preset contract rather than weakening PR data.
- [ ] Explicit `fields` remain honored for `repo.view`.
- [ ] Mirrored OS/controller GitHub facade scripts and regression coverage remain behaviorally aligned where the current runtime still routes through the workspace controller.
- [ ] Focused tests, realistic dry-run/live repo validation, strict review, and verify pass before promotion.
- [ ] Only the validated daily task is promoted into `stream/self-healing`; never merge the stream to `main`.

## Test-first contract

behavior under test: `repo.view` currently reuses PR-oriented `PRESET_FIELDS`; `--preset full` therefore asks `gh repo view` for invalid PR-only fields such as `number`, producing `Unknown JSON field: "number"`. Repository presets must resolve to repository-supported fields without changing PR presets.

existing local pattern: `packages/os/tests/github.test.ts` and `packages/workspace/tests/github.test.ts` execute the facade in `--dry-run` mode and assert the exact generated `gh` command. Both script trees currently mirror the same preset-selection logic except OS-specific CLI resolution.

new or changed tests: add a regression in both GitHub facade test files asserting `repo.view --preset full --dry-run` emits a repository-safe full field set and excludes PR-only fields (`number`, `headRefName`, `mergeStateStatus`). Keep the existing `pr.view --preset review` assertion as a negative control.

focused red command: `bunx vitest run packages/os/tests/github.test.ts packages/workspace/tests/github.test.ts`

expected red failure: the new repository-preset assertions fail because the generated command currently contains the PR-only `full` field list.

no-test waiver: not applicable.

## evidence before source work

- Installed `monitor.errors` is stale (`Script not found "monitor:errors"`); current-source equivalent produced 40 groups: 0 expected-policy, 7 caller-input, 15 initial defect-candidates, 16 transient, 0 external, 2 unknown.
- Independent ordinary-use trace `trc_a382fcca3c18` (2026-09-23T02:34:27Z) called `github repo.view --preset full` and failed deterministically with `Unknown JSON field: "number"`.
- Read-only reproduction through the typed facade produced the same failure (`trc_cad2a8d67816`).
- The defect is present in current `main`, current `stream/os`, and `stream/self-healing`; no inspected open OS PR targets repository preset field selection.
- A separate `github pr.diff --stat` failure is already fixed in accepted self-healing commit `2cdb196925` and is intentionally not duplicated here.
- `explore` failures overlap open self-healing PR #2563; release publication failure overlaps open OS PR #2574; sampled task/verify/patch/search failures were caller/state/validation behavior rather than selected source defects.
- Sentry showed four unresolved local engineering/test issues in the last 24h, all userCount 0; three are ENOSPC during local task/smoke work and one temp install-report ENOENT. No hosted-user impact was inferred.

## key decisions — selected root cause

- One real source defect selected: operation-incompatible GitHub `repo.view` preset fields.
- No maintenance-harness fix is authorized or needed for this run.
- Task starts from current `main`; accepted self-healing history must be preserved during task-to-stream promotion.

- 2026-09-24 02:01:46 append: `.task/self-healing/2026-09-23-fix-github-repo-view-presets/workpad.md`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-09-24 02:01:46 fs.write: `.task/self-healing/2026-09-23-fix-github-repo-view-presets/workpad.md`
- 2026-09-24 02:02:06 apply-patch: `packages/os/tests/github.test.ts`
- 2026-09-24 02:02:06 apply-patch: `packages/workspace/tests/github.test.ts`
- 2026-09-24 02:02:23 apply-patch: `packages/os/scripts/github.js`
- 2026-09-24 02:02:23 apply-patch: `packages/workspace/scripts/github.js`
- 2026-09-24 02:03:12 fs.write: `.task/self-healing/2026-09-23-fix-github-repo-view-presets/workpad.md`
- 2026-09-24 02:06:55 fs.write: `.task/self-healing/2026-09-23-fix-github-repo-view-presets/workpad.md`

## implementation + validation progress

- RED: `bunx vitest run packages/os/tests/github.test.ts packages/workspace/tests/github.test.ts` failed exactly the two new `repo.view full` assertions; the existing 8 tests stayed green (`trc_ddb8899cc63c`).
- Root fix: added repository-specific `summary`/`full` field presets and `repoFieldsFor`, preserving the existing PR preset table. Unsupported PR-oriented presets now fail locally for `repo.view` instead of being forwarded as invalid `gh repo view` fields; explicit `--field` values remain authoritative.
- Mirrored the bounded fix in `packages/os/scripts/github.js` and the still-active controller script `packages/workspace/scripts/github.js`, matching the current runtime boundary and prior accepted GitHub facade maintenance pattern.
- GREEN: focused pair passed 10/10 (`trc_075ebcbd6430`). Broader GitHub facade/review set passed 12/12 across 4 files (`trc_69cfa1f4b221`).
- Realistic runtime validation: both the OS script and workspace controller script successfully executed live `repo.view --preset full` against `consuelohq/opensaas`; no invalid-field error and bounded packets returned (`trc_31c3db901758`).

## files changed — agent intent

- `packages/os/scripts/github.js` — repository-specific preset resolution.
- `packages/os/tests/github.test.ts` — regression for repository-safe `full` preset.
- `packages/workspace/scripts/github.js` — mirror the same fix at the current controller runtime boundary.
- `packages/workspace/tests/github.test.ts` — mirrored regression coverage.
- generated task/workpad metadata under `.task/` is workspace-owned lifecycle evidence.

- 2026-09-24 02:03:12 append: `.task/self-healing/2026-09-23-fix-github-repo-view-presets/workpad.md`

## workspace-owned: validation evidence

- 2026-09-24 02:03:44 `review.run`: passed — OK
- 2026-09-24 02:04:51 `verify`: failed — COMMAND_FAILED
- 2026-09-24 02:05:46 `verify`: passed — OK

## review / verify evidence

- Strict review against `origin/main` passed with 0 task issues, 0 pre-existing issues, 0 blocking issues, and 0 documentation opportunities (`trc_538b5c797be2`).
- The first verify request outlived the gateway request and one execution returned non-publish-valid while review/DB checks were green; the supported retry completed successfully. Final verify `trc_c14ed883e8a6` is `passed=true`, `publishValid=true`, with review green and DB guard 0 risks / 0 findings. Verify stamp: `.task/self-healing/2026-09-23-fix-github-repo-view-presets/verify.json`.
- Pre-push PR #2577 currently reports `mergeStateStatus=DIRTY` because this task intentionally started from current `main` while `stream/self-healing` is old/diverged. This is integration-state reconciliation, not the product fix. Accepted stream history must be preserved; do not reset or discard it.

- 2026-09-24 02:06:55 append: `.task/self-healing/2026-09-23-fix-github-repo-view-presets/workpad.md`
