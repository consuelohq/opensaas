# fix batch trace observability rendering

branch: `task/workspace-agents/fix-batch-trace-observability-rendering`
stream: `stream/workspace-agents`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/2135/fix-batch-trace-observability-rendering
github pr: https://github.com/consuelohq/opensaas/pull/2135
started: 2026-08-16

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

- 2026-08-16 06:13:32 fs.write: `.task/workspace-agents/fix-batch-trace-observability-rendering/workpad.md`
- 2026-08-16 06:16:20 fs.write: `.task/workspace-agents/fix-batch-trace-observability-rendering/workpad.md`
- 2026-08-16 06:18:54 fs.write: `.task/workspace-agents/fix-batch-trace-observability-rendering/workpad.md`
- 2026-08-16 06:23:06 fs.write: `.task/workspace-agents/fix-batch-trace-observability-rendering/workpad.md`

## workspace-owned: validation evidence

- 2026-08-16 06:18:17 `checkFiles`: passed — OK
- 2026-08-16 06:20:56 `review.run`: passed — OK
- 2026-08-16 06:22:17 `review.run`: passed — OK
- 2026-08-16 06:22:58 `verify`: passed — OK
- 2026-08-16 06:28:38 `verify`: passed — OK

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

## Test-first contract

behavior under test:
- batch child results are self-describing with the invoked tool name, so downstream observability does not need positional guessing;
- when a batch child fails validation, the batch error identifies the failing step/tool and preserves the child failure message instead of only saying the batch stopped;
- large successful child payloads remain valid batch results and are not treated as numeric/size overflow;
- trace-site batch expansion renders actual child tool traces only and never recursively treats ordinary tool business data such as `explore.data.results` search hits as nested traces;
- the public observability Astro route continues to consume the OS-owned trace client/runtime so the trace rendering fix reaches the Astro page without duplicating trace logic.
existing local pattern: batch facade tests plus OS trace-site inspector model/observability route contract tests.
new or changed tests: focused batch result/error/large-payload regressions; focused childTraceRecords regression using Explore-style `data.results`; observability route contract assertion if needed after source inspection.
focused red command: run only the new batch/trace-site regressions after destructive-literal preflight.
expected red failure: batch child result lacks canonical `tool`; batch parent error is generic; `childTraceRecords` expands Explore search records into bogus nested rows labeled `trace`.
no-test waiver: not applicable.

## Runtime evidence

- User trace `trc_671c43b08f2a` is a `batch` row in `~/.consuelo/node/db/traces.db`, duration 18.873s, result JSON 108,908 chars, status `COMMAND_FAILED`.
- Failure cause is child `tools.search` trace `trc_d5371256ac41`: input `limit: 8` violates tools.search max 5 and returned `VALIDATION_ERROR` with `limit: Too big: expected number to be <=5`.
- Three parallel Explore children succeeded with ~8.2K, ~10.4K, and ~8.4K total tokens. The displayed ~27.3K parent tokens come from the trace UI raw-result-size fallback because the parent row has no persisted token total; this is not an integer overflow.
- Each Explore child carries ordinary `data.results` search hits. Current `childTraceRecords` recursively treats generic `data.results` as nested traces; those records have no tool/name/label and therefore surface as repeated `trace` rows in the UI.

- 2026-08-16 06:13:32 append: `.task/workspace-agents/fix-batch-trace-observability-rendering/workpad.md`

## workspace-owned: files read

- `packages/os/scripts/lib/observability-traces-site.ts`
- `packages/os/skills/task/SKILL.md`
- `packages/os/tests/observability-traces-site.test.ts`
- `packages/workspace/scripts/lib/facade/batch.ts`
- `packages/workspace/scripts/lib/facade/types.ts`
- `packages/workspace/tests/facade/facade.test.ts`

## Red evidence

- Focused regression additions expose the intended failures: batch child `tool` is currently `undefined`; Explore `data.results` are expanded as 2 bogus nested traces (3 rows total instead of 1); public Astro client has no payload token fallback.
- A broad three-file Vitest run also surfaced unrelated pre-existing failures in the task base (`tools.search` ranking, fs.read message text, an existing batch facade test) and wrote four unrelated snapshots. Those snapshot writes were immediately restored and are not part of this task.
- The large-payload regression already passes with a 120,000-character child payload (>30K estimated output tokens), confirming payload/token magnitude is not the batch failure cause.

- 2026-08-16 06:16:20 append: `.task/workspace-agents/fix-batch-trace-observability-rendering/workpad.md`

- 2026-08-16 06:16:24 apply-patch: `packages/workspace/tests/facade/facade.test.ts`

- 2026-08-16 06:17:02 apply-patch: `packages/workspace/scripts/lib/facade/types.ts`
- 2026-08-16 06:17:02 apply-patch: `packages/workspace/scripts/lib/facade/batch.ts`
- 2026-08-16 06:17:02 apply-patch: `packages/os/scripts/lib/trace-site-inspector/model.ts`
- 2026-08-16 06:17:02 apply-patch: `packages/os/scripts/lib/observability-traces-site.ts`
- 2026-08-16 06:18:10 apply-patch: `packages/os/SCRIPTS.md`

## Green and runtime validation

- Rebuilt the shipped OS-owned Trace Burn browser runtime from `packages/os` with `bun run build:observability-traces-runtime`; generated `assets/vendor/observability-traces-v38/inspector.js` changed as expected.
- Focused regression set is green: 6/6 tests across batch executor, OS trace-site model, and public Astro client (`trc_d0c9a05bd7bd`).
- Full affected OS test files are green: 32/32 (`trc_ca852bc5c439`).
- Full `batch executor` describe block is green: 6/6 (`trc_c04300d4a1d4`).
- `checkFiles` passed for all changed TypeScript/test/generated-JS files (`trc_0df82d05a6b3`).
- Replayed the real persisted trace `trc_671c43b08f2a` through the updated OS trace model (`trc_616ea01e0276`): parent token estimate remains 27,318, but the expanded child list is now exactly four real tool calls (three `explore`, one failing `search`) with no anonymous nested `trace` rows.
- Updated `packages/os/SCRIPTS.md` to document self-describing batch children/actionable failure messages and the trace-shaped nested expansion/token fallback rules.

- 2026-08-16 06:18:54 append: `.task/workspace-agents/fix-batch-trace-observability-rendering/workpad.md`

## Review and promotion blocker

- Correct start base is `main`; `review.run` against `origin/main` is clean with 0 blocking issues (`trc_5a34cace2a7c`). The earlier default review against `origin/stream/workspace-agents` compared against a stale/divergent stream and produced unrelated findings; it is not the task review truth source.
- Full `verify --base origin/main --no-stamp` passed, including review and DB risk checks (`trc_0ac82adee1ff`).
- `task.ensureSynced` reported the workspace-agents stream behind and recommended `stream.sync`. The required `stream.sync` then hit mixed code/docs/test conflicts in existing stream/main drift (`trc_65eb0403efe3`), including settings-site, subagent runtime, diffs gateway, install/settings/sites tests, subagent orchestration test, and trace-persistence test.
- Per task workflow policy, those are real non-metadata conflicts outside this task. Do not auto-resolve or continue stream promotion without Ko's direction or separate evidence for those conflict resolutions.

- 2026-08-16 06:23:06 append: `.task/workspace-agents/fix-batch-trace-observability-rendering/workpad.md`
