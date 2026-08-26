# fix workspace contract gate for browser release

branch: `task/workspace-agents/fix-workspace-contract-gate-for-browser-release`
stream: `stream/workspace-agents`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/2207/fix-workspace-contract-gate-for-browser-release
github pr: https://github.com/consuelohq/opensaas/pull/2207
started: 2026-08-26

## acceptance criteria

- [x] `Consuelo / workspace contracts` passes for the browser release stream.
- [x] `media.transcribe` has a registered facade input schema and a valid manifest example so synthetic dry-run validates without executing media work.
- [x] `subagent` preserves `dryRun` through input validation so synthetic dry-run cannot spawn a provider process.
- [x] The fs mixed-pagination regression asserts the current canonical validation message.
- [x] No browser runtime behavior is changed by this CI-unblock task; only the stale duplicate workspace browser test was synced to the already-shipped runtime contract.

## plan

1. Reproduce the three required-check failures with the focused facade test filter.
2. Repair only the stale/missing facade contracts: media transcribe schema/example, subagent dry-run field, and fs assertion text.
3. Rerun the focused facade tests, then the exact workspace-contract command used by CI.
4. Run strict review/diff, publish to `stream/workspace-agents`, then rerun the Canary release for stream PR #2193.

## Test-first contract

- behavior under test: mutating facade tools with synthetic dry-run validate but do not execute; fs mixed pagination returns the canonical validation error; workspace-contract CI goes green.
- existing local pattern: `packages/os/tests/facade/facade.test.ts` derives generic dry-run coverage from each tool manifest's `exampleInput` and facade `schemaRegistry`.
- new or changed tests: use the existing failing generic dry-run cases for `media.transcribe` and `subagent`; update only the stale expected fs validation wording. No new production behavior is needed beyond restoring the declared facade contracts.
- focused red command: `bunx vitest run packages/os/tests/facade/facade.test.ts -t "supports synthetic dry-run for media.transcribe|supports synthetic dry-run for subagent|rejects mixed fs read pagination modes"`
- expected red failure: media returns `VALIDATION_ERROR`, subagent returns `COMMAND_FAILED`, fs assertion expects old `pagination fields` wording.
- no-test waiver: not applicable.

## current status

- Release tool for PR #2193 correctly refused Canary release because required check `Consuelo / workspace contracts` is red.
- The same three representative failures were reproduced on untouched `origin/main`, proving they predate the browser fix; this task exists only to unblock the required gate.
- Focused RED reproduced the three headline failures (`trc_81262a09c1f1`); focused GREEN now passes 3/3 (`trc_90fe7b499896`).
- Full facade coverage exposed the complete pre-existing contract gap: 21 additional `media.*` entries declared tool-specific input-schema names that do not exist in the facade registry. Each of those 21 handlers currently declares `arguments: []`, so the source-of-truth repair is to use the existing `EmptyInput` facade contract rather than invent rich schemas. Mechanical inventory/proof: `trc_8904966d9d3a`; source rewrite: `trc_b0c96d0b9c7d`.
- Canonical media manifests regenerated from source (`trc_8628b0981bf3`). Expected facade envelope snapshots were refreshed with Vitest's normal `-u` path, then rechecked under `CI=1`: 714/714 pass with zero failures (`trc_ee706b8d2bee`).
- Exact GitHub required-check command now passes end-to-end (`trc_c90425afcda5`): review pass, DB guard pass, 5/5 registry suites pass, publish-valid.
- The first exact CI retry exposed the stale duplicate workspace browser test (`trc_4ac7b4781abf`); syncing it to the OS regression contract made both browser suites pass 38/38 (`trc_40c2082d146c`).
- Final strict review against `origin/stream/workspace-agents`: 0 issues, 0 blockers (`trc_2ffa8f7fe24a`). Static checks pass (`trc_8fe0ccb94bc1`).
- Task read-log corruption from the filesystem logger was repaired to valid JSON (`trc_9f544b244cdb`).

## files changed

- `packages/os/scripts/lib/facade/schemas.ts`
- `packages/os/tools/media/schema.ts`
- `packages/os/manifests/generated/tool.manifest.json`
- `packages/os/workflows/generated/workflow-bundles.json`
- `packages/os/tests/facade/facade.test.ts`
- `packages/os/tests/facade/__snapshots__/facade.test.ts.snap`
- `packages/workspace/tests/browser-service.test.ts`
- scoped `.task/workspace-agents/fix-workspace-contract-gate-for-browser-release/**` metadata/workpad

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- none yet

## workspace-owned: validation evidence

- 2026-08-26 05:48:06 `checkFiles`: passed — OK
- 2026-08-26 05:54:02 `checkFiles`: passed — OK
- 2026-08-26 05:54:08 `review.run`: passed — OK

## key decisions

- Do not bypass the required GitHub check or admin-merge a red PR; repair the narrow contract defects instead.
- Keep browser service/test files untouched in this task.
- For media scaffolds whose handler accepts zero facade arguments, publish `EmptyInput` instead of nonexistent named schemas. Do not weaken generic facade tests and do not invent unsupported argument contracts.

## notes for ko

- none yet

## improvements noticed

- none yet

## issues and recovery

- Canonical `session.start({kind:"task"})` remains broken in the installed facade (`session:start` script not found after one schema-corrected retry). Used documented `task.start` compatibility path, creating taskSession `tsk_b20d98d89455` / PR #2207 from `stream/workspace-agents`.

---

## publish checklist

```bash
bun run task:push -- --message "type(workspace-agents): description" --changed
bun run task:pr
bun run task:finish
```

## workspace-owned: files read

- `packages/os/scripts/lib/facade/executor.ts`
- `packages/os/scripts/lib/facade/schemas.ts`
- `packages/os/scripts/media.ts`
- `packages/os/tests/browser-service.test.ts`
- `packages/os/tests/facade/facade.test.ts`
- `packages/os/tools/media/handler.ts`
- `packages/os/tools/media/schema.ts`
- `packages/os/tools/subagent/schema.ts`
- `packages/workspace/tests/browser-service.test.ts`

- 2026-08-26 05:54:42 apply-patch: `.task/workspace-agents/fix-workspace-contract-gate-for-browser-release/workpad.md`