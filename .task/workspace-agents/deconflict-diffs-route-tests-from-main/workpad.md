# deconflict Diffs route tests from main

branch: `task/workspace-agents/deconflict-diffs-route-tests-from-main`
stream: `stream/workspace-agents`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1883/deconflict-diffs-route-tests-from-main
github pr: https://github.com/consuelohq/opensaas/pull/1883
started: 2026-08-12

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

- 2026-08-12 04:41:23 fs.write: `.task/workspace-agents/deconflict-diffs-route-tests-from-main/workpad.md`
- 2026-08-12 04:44:15 fs.write: `.task/workspace-agents/deconflict-diffs-route-tests-from-main/workpad.md`
- 2026-08-12 04:47:19 fs.write: `.task/workspace-agents/deconflict-diffs-route-tests-from-main/workpad.md`

## workspace-owned: validation evidence

- 2026-08-12 04:44:46 `review.run`: passed — OK
- 2026-08-12 04:48:32 `review.run`: passed — OK
- 2026-08-12 04:48:44 `verify`: passed — OK

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
bun run task:push -- --message "type(workspace-agents): description" --changed
bun run task:pr
bun run task:finish
```

## discovery

- Goal: remove remaining stream/main textual conflicts without changing production behavior.
- Production merge is already clean; only two shared test files conflict.
- Strategy: restore those shared tests to current `main` and preserve Diffs-specific coverage in a dedicated non-conflicting contract test.
- Installed Consuelo OS remains untouched; no update/restart/deploy in this task.

- 2026-08-12 04:41:23 append: `.task/workspace-agents/deconflict-diffs-route-tests-from-main/workpad.md`

## merge reconciliation

- `main` was merged into this clean task worktree with `--no-commit --no-ff`; only two test files conflicted. Production files auto-merged cleanly.
- Resolved both test conflicts as current-main coverage plus the Diffs-specific gateway assertions: `/diffs` is authenticated gateway-backed, not a static snapshot; private Site assertions from main remain intact.
- No installed-runtime mutation: no `consuelo update`, restart, release-channel change, or deployment was run.

## validation evidence

- Focused merge-resolution packet: install-edge publisher + route seed + Sites/Gateway integration + Diffs Hono + source-control config + Diffs adapter -> 46 pass / 0 fail / 281 assertions.
- This task is an ancestry-preserving main-to-stream sync; the only manual conflict resolutions are test contracts.

- 2026-08-12 04:44:15 append: `.task/workspace-agents/deconflict-diffs-route-tests-from-main/workpad.md`

## workspace-owned: files read

- `packages/os/scripts/lib/settings-site.ts`
- `packages/os/scripts/server/routes/diffs.ts`
- `packages/os/scripts/server/services/diffs-gateway.ts`
- `packages/os/tests/diffs-hono-routes.test.ts`
- `packages/os/tests/settings-site.test.ts`

## Test-first contract — Diffs error boundaries

- Behavior under test: Diffs keeps the same authenticated read/write behavior and safe client error states while every new async boundary either handles provider/auth failures locally or returns an explicit promise chain with a typed rejection boundary.
- Existing local pattern: Hono routes convert typed `DiffsGatewayError` instances to safe responses; configuration shell tests compile the emitted client script; Diffs Hono tests cover auth, repository scoping, setup state, and write-scope separation.
- RED evidence: strict `review.run --base origin/main` reports 15 must-fix findings: 14 `ERROR_HANDLING` and 1 `CATCH_TYPING`, confined to `settings-site.ts`, `routes/diffs.ts`, and `services/diffs-gateway.ts`.
- No new behavior test is required for the structural promise/error-boundary refactor; existing focused runtime tests are the regression contract. The emitted browser script syntax test must remain green.
- GREEN target: strict review has 0 blocking findings and focused settings/Diffs/edge tests remain green.

- 2026-08-12 04:47:19 append: `.task/workspace-agents/deconflict-diffs-route-tests-from-main/workpad.md`
