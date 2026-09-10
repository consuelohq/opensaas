# ship artifacts hotfix to main

branch: `task/os/ship-artifacts-hotfix-to-main`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/2187/ship-artifacts-hotfix-to-main
github pr: https://github.com/consuelohq/opensaas/pull/2187
started: 2026-08-26

## acceptance criteria

- [x] Publishing parent `/daily-schedules` preserves dated child current artifacts.
- [x] `artifacts refresh` deterministically rebuilds the derived current tree from immutable versions.
- [x] Main `/artifacts` shows only the Daily Schedules collection, not `/daily-schedules/*` children.
- [x] Dated Daily Schedules detail routes serve their current HTML.
- [x] No #1941/#2167 schedule implementation is included.

## plan

1. Reproduce the defect against clean `main` with focused route/model tests.
2. Port only the narrow Artifacts current-materialization/index fix.
3. Run focused and adjacent tests, strict review, and full verify.
4. Integrate the clean hotfix to `main`, then publish/promote a new immutable runtime from merged main.

## current status

- Implementation and focused validation are complete on the clean main-based branch. Strict review is clean; final verify is being completed before publication.

## files changed

- `packages/os/scripts/artifacts.ts`
- `packages/os/scripts/lib/artifacts.ts`
- `packages/os/tests/artifacts-hono-routes.test.ts`
- `packages/os/tests/artifacts.test.ts`
- `packages/os/tests/daily-schedules.test.ts`

## workspace-owned: files changed

- `packages/os/scripts/artifacts.ts`
- `packages/os/scripts/lib/artifacts.ts`
- `packages/os/tests/artifacts-hono-routes.test.ts`
- `packages/os/tests/artifacts.test.ts`
- `packages/os/tests/daily-schedules.test.ts`

## workspace-owned: activity log

- 2026-08-26 02:52:23 fs.write: `.task/os/ship-artifacts-hotfix-to-main/workpad.md`
- 2026-08-26 02:54:04 fs.write: `.task/os/ship-artifacts-hotfix-to-main/workpad.md`
- 2026-08-26 02:58:14 fs.write: `.task/os/ship-artifacts-hotfix-to-main/workpad.md`

## workspace-owned: validation evidence

- 2026-08-26 02:54:31 `review.run`: passed — OK
- 2026-08-26 02:55:24 `verify`: failed — COMMAND_FAILED
- 2026-08-26 02:56:46 `verify`: failed — COMMAND_FAILED

## key decisions

- Keep immutable artifact versions/catalog authoritative; repair only the derived `artifacts/current` materialization.
- Filter Daily Schedules children on the main index by path, not category, because historical children used mixed category values.
- Use a clean `main`-based integration instead of merging the history on #2182 or either schedule stream PR.

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

## Main integration scope

This is a narrow Artifacts hotfix sourced from `main`. It exists because the verified 0.1.70 dev runtime could not be promoted to canary: the release gate correctly rejected source commit `6831d8f531` as not integrated to main. This task must not merge or absorb PR #1941 or PR #2167, and must not pull the unrelated history present on PR #2182.

## Acceptance criteria

- Publishing the parent `/daily-schedules` artifact never deletes the current materializations of dated child artifacts.
- `artifacts refresh` can rebuild the complete derived `artifacts/current` tree from immutable catalog versions.
- The main `/artifacts` index shows the `/daily-schedules` collection once and omits every `/daily-schedules/*` child, including legacy children whose category is also `daily-schedules`.
- The dated `/artifacts/daily-schedules/...` detail route continues to serve the current artifact HTML.
- No security/self-healing schedule implementation from #1941/#2167 is merged here.

## Test-first contract

behavior under test: Parent Daily Schedules publication preserves nested current detail artifacts, and the main Artifacts index delegates all dated Daily Schedules children to the collection page.
existing local pattern: `packages/os/tests/artifacts-hono-routes.test.ts`, `packages/os/tests/artifacts.test.ts`, and `packages/os/tests/daily-schedules.test.ts` exercise the canonical Artifacts model and route serving against isolated homes.
new or changed tests: port only the focused regressions already proven RED/GREEN on PR #2182: nested parent/child route persistence, deterministic current-tree repair, and path-based main-index hiding including a legacy-category child.
focused red command: `bun x vitest run tests/artifacts.test.ts tests/artifacts-hono-routes.test.ts tests/daily-schedules.test.ts`
expected red failure: the nested route returns 404 / child current file is missing after parent publication, and a legacy `/daily-schedules/*` child still appears on the main index.
no-test waiver: not applicable.

- 2026-08-26 02:52:23 append: `.task/os/ship-artifacts-hotfix-to-main/workpad.md`

- 2026-08-26 02:52:29 apply-patch: `packages/os/tests/artifacts-hono-routes.test.ts`
- 2026-08-26 02:52:36 apply-patch: `packages/os/tests/artifacts.test.ts`
- 2026-08-26 02:52:41 apply-patch: `packages/os/tests/daily-schedules.test.ts`
- 2026-08-26 02:53:46 apply-patch: `packages/os/scripts/lib/artifacts.ts`
- 2026-08-26 02:53:49 apply-patch: `packages/os/scripts/artifacts.ts`
## RED / GREEN evidence

- RED on clean `main` reproduced the production defect before implementation: nested detail route returned 404, Daily Schedules current detail was ENOENT after parent publication, the current-tree repair API did not exist, and a legacy `/daily-schedules/*` child still rendered on the main Artifacts index. 4 failed / 11 passed. Trace `trc_2840891b90f7`.
- Implemented only the narrow Artifacts current-materialization/index fix from the validated #2182 follow-up. No #1941/#2167 schedule changes and no unrelated #2182 history were ported.
- GREEN: 15/15 focused Artifacts/Daily Schedules tests, then 13/13 adjacent Artifacts edge + Sites CLI tests, plus OS type/syntax checks all pass. Trace `trc_c8ce03d74c3f`.
- Release context: branch-built dev runtime 0.1.70 was fully validated and published, but canary promotion correctly failed with `source commit is not integrated to main`. The clean main integration exists specifically to satisfy that release invariant before publishing a new immutable runtime from merged main.

- 2026-08-26 02:54:04 append: `.task/os/ship-artifacts-hotfix-to-main/workpad.md`

## workspace-owned: files read

- `packages/workspace/scripts/verify.js`

## Full verify note

- Strict review against `origin/main` is clean: 0 blocking issues / 0 source findings; one non-blocking documentation opportunity. Trace `trc_b0678f5fd011`.
- Full `verify` is locally blocked by the auto-selected entire `@consuelo/os` package suite, not by this hotfix. The failing assertions are existing facade/tool-manifest dry-run/schema mismatches (media tools, subagent, fs pagination) in `tests/facade/facade.test.ts`; none of the facade/tooling paths differ from `origin/main`. Test-selection evidence `trc_aebfa5445e6e`; no facade/tooling source diff evidence `trc_53870cc7f1a2`.
- The hotfix-owned and adjacent suites remain green (28/28) with type/syntax checks: `trc_c8ce03d74c3f`. CI on the clean main PR remains the authoritative integration gate for unrelated package-wide drift.

- 2026-08-26 02:58:14 append: `.task/os/ship-artifacts-hotfix-to-main/workpad.md`
