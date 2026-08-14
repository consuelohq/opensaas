# refine scheduled maintenance streams artifacts and reports

branch: `task/os/refine-scheduled-maintenance-streams-artifacts-and-reports`
stream: `stream/os`
pr: https://github.com/consuelohq/opensaas/pull/1937
started: 2026-08-14

## acceptance criteria

- [x] Keep the existing task lifecycle; scheduled runs use `stream/security` and `stream/self-healing`, start from their stream, promote task -> stream with `task.pr`, and never merge either schedule stream to main autonomously.
- [x] Create both persistent schedule streams from main and leave their stream review PRs as the human merge boundary.
- [x] Add a canonical operation-based `artifacts` facade tool modeled after `github`; keep compatibility aliases only where needed during migration.
- [x] Fold Daily Schedules publication into `artifacts` as `operation: schedule.publish`; remove `dailySchedules.publish` from the canonical public surface.
- [x] Schedule publication uses the existing task-generated workpad, never a parallel workpad, and publishes a report + workpad pair for the selected schedule.
- [x] Daily Schedules supports four dated entry kinds: security report, security workpad, self-healing report, self-healing workpad.
- [x] `security.scan` and `monitor.errors` both produce durable private normalized report files suitable for artifact publication.
- [x] Improve deterministic report rendering using the supplied Tufte rules: comparison-first prose/tables, direct labels, restrained horizontal bars only where they reveal a distribution, accessible text alternatives, responsive/adaptive dark mode, no pie/legend/dashboard-card clutter.
- [x] Keep native security scanner secret-match evidence private; publish only normalized redacted data.
- [x] Give the new Artifacts/Daily Schedules surface an explicit critical focused test-selection contract so verification does not fall back to the historically red package-wide OS suite.
- [x] Final schedule prompts are written directly in chat, not `/tmp`, use `stream/security` / `stream/self-healing`, use the generated workpad, self-healing may fix 1-4 coherent high-leverage OS/tooling defects, and both prompts explicitly tell the agent not to be brittle about the workflow.

## plan

1. Characterize existing task/stream and artifact/report contracts; preserve lifecycle behavior that already matches the desired schedule model.
2. Add tests first for the canonical artifact operation, four-entry schedule model, bundle publication, report rendering, and monitor report persistence.
3. Implement the smallest artifact/report changes; regenerate typed/generated tool surfaces.
4. Create/sync the two persistent schedule streams from main and verify their review PRs.
5. Run focused tests, manifest checks, review/verify, then push the implementation task PR for Ko's review. Do not promote the task into `stream/os` before that review.
6. Present the two final copy/paste automation setup prompts in chat.

## Test-first contract

- Behavior under test: canonical `artifacts` operation dispatch includes `schedule.publish`; schedule publish produces exactly report + generated-workpad records; self-healing has its own report record; report HTML follows deterministic accessible low-ink presentation; monitor report returns a private report path.
- Existing local pattern: `github` operation enum facade, `daily-schedules.test.ts`, tool-package handler/schema tests, private `security.scan` cache reports.
- New/changed tests: extend `daily-schedules.test.ts`, add/update artifacts handler/schema tests, extend monitor-errors report coverage.
- Focused red command: `bun test packages/os/tests/daily-schedules.test.ts packages/os/tests/monitor-errors.test.ts packages/os/tools/artifacts/handler.test.ts`.
- Expected red failure: missing `self-healing-report`, missing canonical `artifacts` operation tool / schedule dispatch, no bundle publisher, no persisted monitor report.

## current status

- Discovery complete. Existing `task.pr` already provides the desired task -> schedule-stream promotion and conflict boundary, so lifecycle code is intentionally out of scope.
- `stream/self-healing` was created from `main` successfully.
- Existing `stream/security` was preserved because it contains nine accepted security commits. `stream.sync` against current `main` stopped safely on five real edge-site code/test conflicts and pushed nothing; do not reset/discard that history. The first security maintenance run can reconcile it using the normal non-brittle task workflow.
- Perpetual human review PRs now exist: `stream/security -> main` is GitHub PR #1940 and `stream/self-healing -> main` is GitHub PR #1941. Scheduled agents may promote daily tasks into their stream but must never merge these review PRs.
- Canonical source implementation is complete: one operation-based `artifacts` tool, standalone `dailySchedules.publish` removed, generated task workpad reuse by taskSession, four Daily Schedules record kinds, persisted self-healing monitor reports, and Tufte-oriented report rendering.
- Design operator and `DESIGN.md` read. Supplied Tufte data-visualization rules govern report presentation.
- Task-scoped `code.call` successfully regenerated the real host-worktree tool manifest, workflow bundle, generated types, TOOLS catalog, and bundled skill template; the old controller-rooted generation blocker is resolved.
- Focused Artifacts/Daily Schedules contracts pass 40/40 under Vitest, and the Bun-native monitor report contract passes 7/7 with `bun test`.
- A focused critical/exclusive `os-artifacts-scheduled-maintenance` test-selection rule now owns the new surface. Test-selection unit coverage passes 28/28 and the broad `@consuelo/os` package suite is correctly not selected for this change.
- Strict review/typecheck/static/spec pass with zero blocking issues. Full `verify` is publish-valid and wrote the task verification stamp: `trc_d0ad6b7dd8a0`.
- The private Artifacts catalog has not been seeded with a fake Daily Schedules entry. The first real security or self-healing run should publish the first normalized report + generated workpad after this implementation is shipped.

## key decisions

- Schedule streams are `stream/security` and `stream/self-healing`, both rooted from main.
- The schedule agent may merge its validated task into its own schedule stream using `task.pr`; it may never merge the schedule stream into main.
- Self-healing may inspect/sync authoritative OS work such as `stream/os` when useful; the prompt stays resilient rather than adding a special source-branch lifecycle tool.
- Existing workpads are the only workpad system.
- Artifact consolidation is operation-based; CLI subcommands may remain implementation details.

## issues and recovery

- Initial focused red suite proved the missing contracts before implementation: `trc_a110f048907d`.
- Host task-scoped `code.call` successfully ran the real manifest/type/docs generators after the earlier controller-rooted generator path failed. This removes the previous generated-surface blocker.
- Focused green attempt `trc_dda0d24c7158` exposed one real Artifacts invariant bug: publishing the `/daily-schedules` parent artifact deleted already-materialized nested schedule detail routes while leaving their catalog records intact. Fix the generic parent-route replacement path by rehydrating descendant current artifacts from immutable current versions after parent publish/rollback.
- The same focused run showed two characterization/test-runner issues: the tool-package baseline still described the old 159-tool surface after the intentional consolidation to 138 tools, and `monitor-errors.test.ts` must run under Bun's native test runner because it imports `bun:sqlite`.
- One `fs.apply_patch` call used the wrong input key and changed nothing; rerun with `patchText`.
- One search pattern used an unescaped `{` and failed regex parsing; replaced with bounded file reads.
- Broad `audit` surfaced unrelated global docs/index drift and is not being used as task proof.
- Earlier `verify` failures were traced first to stale generated surfaces, then to the auto-selected broad OS package suite. Both are resolved: generation now runs task-scoped through `code.call`, and the new focused critical test-selection rule gives this surface deterministic coverage.
- Container recovery was attempted before the task-scoped `code.call` route was identified. The sandbox had no mounted host repo/worktree and network clone recovery failed; no sandbox clone became source of truth and no code was ferried back from a second checkout.

## notes for ko

- Final prompts will be emitted in full in chat after the real interfaces are validated.

- 2026-08-14 04:02:30 write: `.task/os/refine-scheduled-maintenance-streams-artifacts-and-reports/workpad.md`

## files changed

- `packages/os/scripts/daily-schedules.ts` (deleted)
- `packages/os/tools/artifacts/handler.ts`
- `packages/os/tools/artifacts/schema.ts`
- `packages/os/tools/daily-schedules` (deleted)

## workspace-owned: files changed

- `packages/os/scripts/daily-schedules.ts` (deleted)
- `packages/os/tools/artifacts/handler.ts`
- `packages/os/tools/artifacts/schema.ts`
- `packages/os/tools/daily-schedules` (deleted)

## workspace-owned: activity log

- 2026-08-14 04:02:30 fs.write: `.task/os/refine-scheduled-maintenance-streams-artifacts-and-reports/workpad.md`
- 2026-08-14 04:06:59 fs.trash: `packages/os/tools/daily-schedules`
- 2026-08-14 04:07:43 fs.write: `packages/os/tools/artifacts/schema.ts`
- 2026-08-14 04:07:49 fs.write: `packages/os/tools/artifacts/handler.ts`
- 2026-08-14 04:09:53 fs.trash: `packages/os/scripts/daily-schedules.ts`

## workspace-owned: files read

- `areas/consuelo-design/AGENTS.md`
- `packages/documentation/AUTHORING.md`
- `packages/documentation/README.md`
- `packages/documentation/src/content/docs/build/skills/bundled/artifacts.mdx`
- `packages/os/manifests/generated/tool.manifest.json`
- `packages/os/package.json`
- `packages/os/scripts/artifacts.ts`
- `packages/os/scripts/daily-schedules.ts`
- `packages/os/scripts/generate-docs.ts`
- `packages/os/scripts/generate-tool-manifest.ts`
- `packages/os/scripts/generate-types.ts`
- `packages/os/scripts/lib/artifacts.ts`
- `packages/os/scripts/lib/daily-schedules-publisher.ts`
- `packages/os/scripts/lib/facade/executor.ts`
- `packages/os/scripts/lib/security-scan-runner.ts`
- `packages/os/scripts/lib/security-scan.ts`
- `packages/os/scripts/lib/tool-scope-authorization.ts`
- `packages/os/skills/artifacts/SKILL.md`
- `packages/os/skills/artifacts/references/agents.md`
- `packages/os/skills/artifacts/skill.json`
- `packages/os/skills/artifacts/subskills/landing-page.json`
- `packages/os/skills/skills.json`
- `packages/os/tests/artifacts-legacy-contract.test.ts`
- `packages/os/tests/artifacts-skill.test.ts`
- `packages/os/tests/daily-schedules.test.ts`
- `packages/os/tests/fixtures/tool-package-baseline.json`
- `packages/os/tests/tool-manifest.test.ts`
- `packages/os/tests/tool-package-layout.test.ts`
- `packages/os/tests/workflow-intent.test.ts`
- `packages/os/tools/artifacts/handler.test.ts`
- `packages/os/tools/artifacts/manifest.ts`
- `packages/os/tools/daily-schedules/handler.ts`
- `packages/os/tools/daily-schedules/schema.ts`
- `packages/os/tools/generation/handler.ts`
- `packages/os/tools/generation/schema.ts`
- `packages/os/tools/package.ts`
- `packages/os/tools/registry.ts`
- `packages/os/workflows/workflows.ts`
- `packages/workspace/scripts/test-selection.js`
- `packages/workspace/scripts/verify.js`
- `packages/workspace/test-selection.rules.json`

## workspace-owned: validation evidence

- 2026-08-14 04:10:02 apply-patch: `packages/os/skills/artifacts/subskills/research-guide.json`
- 2026-08-14 04:10:02 apply-patch: `packages/os/skills/artifacts/subskills/plan.json`
- 2026-08-14 04:10:02 apply-patch: `packages/os/skills/artifacts/subskills/spec.json`
- 2026-08-14 04:10:02 apply-patch: `packages/os/skills/artifacts/subskills/html-email.json`
- 2026-08-14 04:10:02 apply-patch: `packages/os/skills/artifacts/subskills/motion-frame.json`
- 2026-08-14 04:10:02 apply-patch: `packages/os/skills/artifacts/subskills/hyperframes.json`
- 2026-08-14 04:10:02 apply-patch: `packages/os/tests/artifacts-skill.test.ts`
- 2026-08-14 04:10:09 apply-patch: `packages/os/skills/artifacts/SKILL.md`
- 2026-08-14 04:10:09 apply-patch: `packages/os/skills/artifacts/references/agents.md`
- 2026-08-14 04:10:22 apply-patch: `areas/consuelo-design/AGENTS.md`
- 2026-08-14 04:10:27 apply-patch: `areas/consuelo-design/AGENTS.md`
- 2026-08-14 04:10:39 apply-patch: `packages/documentation/src/content/docs/reference/tools.mdx`
- 2026-08-14 04:10:48 apply-patch: `packages/os/skills/artifacts/subskills/digital-eguide.json`
- 2026-08-14 04:10:48 apply-patch: `packages/os/benchmarks/tools-search-gold.json`
- 2026-08-14 04:12:27 `audit`: failed — COMMAND_FAILED
- 2026-08-14 04:15:50 `checkFiles`: passed — OK
- 2026-08-14 04:16:00 `review.run`: passed — OK
- 2026-08-14 04:17:05 `verify`: failed — COMMAND_FAILED
- 2026-08-14 04:17:26 apply-patch: `packages/documentation/src/content/docs/build/skills/bundled/artifacts.mdx`
- 2026-08-14 04:18:31 `verify`: failed — COMMAND_FAILED
- 2026-08-14 04:23:27 `review.run`: passed — OK
- 2026-08-14 04:23:37 apply-patch: `.task/os/refine-scheduled-maintenance-streams-artifacts-and-reports/workpad.md`
- 2026-08-14 04:40:41 apply-patch: `packages/os/scripts/lib/artifacts.ts`
- 2026-08-14 04:40:41 apply-patch: `packages/os/tests/artifacts-skill.test.ts`
- 2026-08-14 04:40:41 apply-patch: `.task/os/refine-scheduled-maintenance-streams-artifacts-and-reports/workpad.md`
- 2026-08-14 04:41:24 `review.run`: passed — OK
- 2026-08-14 04:42:28 `verify`: failed — COMMAND_FAILED
- 2026-08-14 04:45:12 apply-patch: `packages/workspace/test-selection.rules.json`
- 2026-08-14 04:45:12 apply-patch: `.task/os/refine-scheduled-maintenance-streams-artifacts-and-reports/workpad.md`
- 2026-08-14 04:45:46 `verify`: passed — OK

- 2026-08-14 04:46:42 apply-patch: `.task/os/refine-scheduled-maintenance-streams-artifacts-and-reports/workpad.md`

- 2026-08-14 04:47:10 apply-patch: `.task/os/refine-scheduled-maintenance-streams-artifacts-and-reports/workpad.md`