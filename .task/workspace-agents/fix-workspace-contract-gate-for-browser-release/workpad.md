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
- [x] `Consuelo / OS contracts` passes with canonical generated fixtures and deterministic worker-pool test environment.

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
- Release orchestration then correctly refused GitHub's failed `Consuelo / OS contracts` check. Local reproduction of the exact job command isolated two stale contracts (`trc_6faac7854848`): the characterized tool-package baseline was not regenerated after intentional media schema changes, and the Caddy test inherited `CONSUELO_OS_WORKER_BASE_PORT` from ambient runtime state while expecting `8999-9001`.
- Caddy test now explicitly sets `CONSUELO_OS_WORKER_BASE_PORT=8999`, matching the architecture where worker-pool base is authoritative. Repro before the fix showed ambient `46321-46323` contaminating the test (`trc_f3f949cbfe7b`).
- `tool-package-baseline.json` is regenerated from `buildToolManifest({ write: false })` so its ordering and definitions exactly match the canonical generator (`trc_924602fe2f01`).
- Exact OS-contract command now passes: 47 passed, 5 skipped, 0 failed (`trc_5b0eb31da826`).
- Full committed-head verify correctly rejected the temporary `EmptyInput` media scaffold because media taxonomy requires every `media.*` input contract to retain a named `Media…Input` identity (`trc_1883fded3453`). The 21 scaffold tools are now restored to their original named schema IDs, each backed by a minimal request/dry-run schema until real arguments are implemented (`trc_cf8d54d3f798`).
- The script-parity characterization was also materially stale: current inventory has 516 scripts versus 395 classified, with 123 missing and 2 removed generated plists. It was refreshed conservatively—new OS-only paths stay `os-only-needs-review`, workspace-only stay `workspace-only-needs-port`, changed shared paths stay `changed-needs-review`, and only byte-identical paths are `same` (`trc_49325811ccfb`, `trc_cfdb8fafaac6`, `trc_d1a3899c63c8`).
- After restoring named media schemas, regenerating canonical manifests/baseline, and normalizing the parity inventory, all affected deterministic suites pass together: media taxonomy 5/5, parity audit 1/1, facade 714/714, exact OS contracts 47 passed / 5 skipped (`trc_d8453cdeac56`).
- Full publish verification then exposed two remaining required-package regressions (`trc_f46c7f2d6c4a`): `workflow-intent.test.ts` still asserted the pre-`session.start` task.start description, and signed workspace-gateway trace reads crashed under Node because trace persistence/read code directly loaded `bun:sqlite`.
- The workflow assertion now matches the already-canonical compatibility contract for `task.start`. Trace database access now follows the existing runtime-state portability pattern: Bun uses `bun:sqlite`; Node uses `node:sqlite`, with a shared query/get/all adapter. The signed edge → local OS trace E2E now passes 1/1 under Node (`trc_3d63d785d65f`).
- Full verification then exposed remaining direct `bun:sqlite` imports inside the trace gateway test fixture plus two worker-pool process timeouts (`trc_96ab82895353`). The trace fixture now uses the shared portable trace DB adapter throughout; its full suite passes 14/14 (`trc_976224cd17f9` after the final fixture replacements).
- Worker-pool timeout root cause was test setup, not supervisor behavior: a fresh temporary `CONSUELO_HOME` had no required `runtime/current`, so the supervisor exited before spawning workers. Debug proof: `trc_a4c8bafef1df`. The fixture now creates `runtime/current` pointing to the checked-out runtime and explicitly pins `CONSUELO_OS_WORKER_BASE_PORT` to its random test port. Real process integration passes 2/2, including crash replacement and orphan reclamation (`trc_66b15d14c945`).
- GitHub's clean `Consuelo / verify` log narrowed the remaining CI-only package failures to three `media.svg.convert` cases whose fixture shell-called system ffmpeg (`trc_895246c52ea0`). The fixture now writes a deterministic embedded 8×8 PNG instead; SVG conversion behavior is unchanged and the complete SVG suite passes 11/11 (`trc_8f00c6d3ce4f`).

## files changed

- `packages/os/scripts/lib/facade/schemas.ts`
- `packages/os/tools/media/schema.ts`
- `packages/os/manifests/generated/tool.manifest.json`
- `packages/os/workflows/generated/workflow-bundles.json`
- `packages/os/tests/facade/facade.test.ts`
- `packages/os/tests/facade/__snapshots__/facade.test.ts.snap`
- `packages/workspace/tests/browser-service.test.ts`
- `packages/os/tests/security-gateway.test.ts`
- `packages/os/tests/fixtures/tool-package-baseline.json`
- scoped `.task/workspace-agents/fix-workspace-contract-gate-for-browser-release/**` metadata/workpad

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- none yet

## workspace-owned: validation evidence

- 2026-08-26 05:48:06 `checkFiles`: passed — OK
- 2026-08-26 05:54:02 `checkFiles`: passed — OK
- 2026-08-26 05:54:08 `review.run`: passed — OK
- 2026-08-26 06:06:34 `checkFiles`: failed — COMMAND_FAILED
- 2026-08-26 06:06:43 `review.run`: passed — OK
- 2026-08-26 06:12:23 `checkFiles`: passed — OK
- 2026-08-26 06:12:30 `review.run`: passed — OK
- 2026-08-26 06:16:03 `checkFiles`: passed — OK
- 2026-08-26 06:16:10 `review.run`: passed — OK
- 2026-08-26 06:23:30 `checkFiles`: passed — OK
- 2026-08-26 06:23:38 `review.run`: passed — OK
- 2026-08-26 06:24:10 `review.run`: passed — OK

## key decisions

- Do not bypass the required GitHub check or admin-merge a red PR; repair the narrow contract defects instead.
- Keep browser service/test files untouched in this task.
- Correction after full package validation: media taxonomy explicitly requires named `Media…Input` contracts. The final design therefore keeps each original named schema and implements it as a minimal request/dry-run scaffold; `EmptyInput` was only an intermediate diagnostic and is not the final contract.
- Script-parity refresh is deliberately conservative: no newly discovered OS-only script is labeled intentional without evidence.

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

- `.github/workflows/consuelo-ci.yaml`
- `packages/os/manifests/generated/tool.manifest.json`
- `packages/os/scripts/lib/facade/executor.ts`
- `packages/os/scripts/lib/facade/schemas.ts`
- `packages/os/scripts/lib/github-cli.ts`
- `packages/os/scripts/lib/install-state.ts`
- `packages/os/scripts/lib/release-orchestrator.ts`
- `packages/os/scripts/lib/runtime-state.ts`
- `packages/os/scripts/lib/trace-database-schema.ts`
- `packages/os/scripts/lib/trace-sites-gateway-live-endpoints.ts`
- `packages/os/scripts/lib/trace-sites-local-read-backend.ts`
- `packages/os/scripts/lib/worker-pool.ts`
- `packages/os/scripts/media.ts`
- `packages/os/scripts/release.ts`
- `packages/os/scripts/server/routes/traces.ts`
- `packages/os/scripts/server/supervisor.ts`
- `packages/os/tests/audit/script-parity-audit.test.ts`
- `packages/os/tests/browser-service.test.ts`
- `packages/os/tests/facade/facade.test.ts`
- `packages/os/tests/fixtures/tool-package-baseline.json`
- `packages/os/tests/media/31-svg-convert.test.ts`
- `packages/os/tests/security-gateway.test.ts`
- `packages/os/tests/tool-manifest.test.ts`
- `packages/os/tests/tool-package-layout.test.ts`
- `packages/os/tests/trace-sites-gateway-live-endpoints.test.ts`
- `packages/os/tests/worker-pool-process.test.ts`
- `packages/os/tests/workflow-intent.test.ts`
- `packages/os/tests/workspace-gateway-node-end-to-end.test.ts`
- `packages/os/tools/media/handler.ts`
- `packages/os/tools/media/schema.ts`
- `packages/os/tools/release/handler.ts`
- `packages/os/tools/subagent/schema.ts`
- `packages/workspace/tests/browser-service.test.ts`

- 2026-08-26 06:28:41 apply-patch: `packages/os/tests/media/31-svg-convert.test.ts`

- 2026-08-26 06:28:57 apply-patch: `.task/workspace-agents/fix-workspace-contract-gate-for-browser-release/workpad.md`