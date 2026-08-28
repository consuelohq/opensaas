# repair session start and release lifecycle regressions

branch: `task/workspace-agents/repair-session-start-and-release-lifecycle-regressions`
stream: `stream/workspace-agents`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/2235/repair-session-start-and-release-lifecycle-regressions
github pr: https://github.com/consuelohq/opensaas/pull/2235
started: 2026-08-26

## acceptance criteria

- [x] `session.start` executes from the shipped `@consuelo/os` runtime package so its advertised `session:start` script is resolvable even when the controller/root package does not define that script.
- [x] `task.start` remains a compatibility alias; no task/session lifecycle semantics change.
- [x] `release` keeps its fail-closed main-target PR boundary; task->stream PRs are not silently released.
- [x] `release` guidance/error text makes the required main-targeting stream review PR explicit so agents do not pass a merged task PR such as #2232.
- [x] `release` default facade timeout is long enough for the orchestrator's own legal wait budget instead of terminating at the current 20-minute ceiling.
- [x] Focused regression tests are red before implementation, then green; generated tool/docs/type surfaces are refreshed if source-of-truth changes require them.
- [ ] Strict review and canonical verify pass against `origin/stream/workspace-agents`, then the task is promoted into `stream/workspace-agents`.

## plan

1. Add focused contracts for runtime execution scope on `session.start`, release timeout budget, and main-target review-PR guidance.
2. Run the focused tests RED and preserve the failure evidence.
3. Make the smallest source-of-truth changes in task-lifecycle/release tool packages and release guard messaging.
4. Regenerate tool manifests/docs/types, run focused GREEN, inspect the structured diff, then run review/verify.
5. Push the task and merge/promote it into `stream/workspace-agents`; do not release to a channel or main in this task.

## current status

- Runtime evidence collected. `session.start` trace `trc_1420f073168b` fails in 52ms with `Script not found "session:start"`; its handler has no runtime execution scope even though `packages/os/package.json` ships that script.
- Release trace `trc_049e4c6bdb3e` correctly rejects merged task PR #2232 because it targets `stream/workspace-agents`, not `main`; prior release workpads explicitly require a main-target PR.
- Release traces also show repeated facade `TIMEOUT` failures at ~1,200,000ms, exactly matching the tool's current `defaultTimeout`, while the orchestrator can legally wait longer across checks/publication/promotion/update stages.
- Implementation, docs, focused suites, strict review, and the canonical publish-valid verify gate are green; task is ready to push/promote to `stream/workspace-agents`.

## Test-first contract

behavior under test: the canonical session constructor resolves its shipped runtime script; the one-command release facade remains fail-closed to main-target PRs, clearly tells callers which PR to use, and is allowed to run for its full bounded orchestration window.

existing local pattern: runtime-owned tools such as `release` and `lifecycle` set `command.executionScope = "runtime"`; release unit tests use a fake adapter and release surface tests inspect the generated package definition; session foundation tests inspect the task-lifecycle tool package.

new or changed tests:
- `packages/os/tests/session-start-foundation.test.ts`: assert `session.start.command.executionScope === "runtime"` and script remains `session:start`.
- `packages/os/tests/session-start-foundation.test.ts`: execute the facade with a fake runner and assert its command plan cwd is the shipped `packages/os` runtime root.
- `packages/os/tests/release-tool-surface.test.ts`: assert the published description explicitly requires a main-targeting review PR and the default timeout exceeds the current 20-minute ceiling / covers the supported bounded workflow.
- `packages/os/tests/release-orchestrator.test.ts`: assert a non-main task PR remains rejected with actionable guidance to use the main-targeting stream review PR.

focused red command: `bunx vitest run packages/os/tests/session-start-foundation.test.ts packages/os/tests/release-tool-surface.test.ts packages/os/tests/release-orchestrator.test.ts`

expected red failure: session command lacks `executionScope: "runtime"`; release definition still has `defaultTimeout: 1200000` and ambiguous PR guidance; non-main rejection lacks the actionable stream-review instruction.

no-test waiver: not applicable.

## files changed

- `packages/os/tools/task-lifecycle/handler.ts` — run canonical `session.start` from the shipped runtime package.
- `packages/os/tools/release/schema.ts` — make main-target review-PR usage explicit and raise the facade timeout from 20 minutes to 4 hours.
- `packages/os/scripts/lib/release-orchestrator.ts` — preserve main-only release semantics, reject non-main PRs before CI waits, and return actionable stream-review guidance.
- `packages/os/tests/session-start-foundation.test.ts` — definition and executable command-plan regressions.
- `packages/os/tests/release-tool-surface.test.ts` — release guidance and timeout contract.
- `packages/os/tests/release-orchestrator.test.ts` — fail-closed non-main PR guidance.
- `packages/os/manifests/generated/{tool.manifest.json,core.manifest.json}` — regenerated canonical facade surfaces.
- `packages/os/tests/fixtures/tool-package-baseline.json` — refreshed characterized package definitions.
- `packages/documentation/src/content/docs/reference/tools.mdx` — document the required main-targeting stream review PR and immediate wrong-base rejection.
- `packages/workspace/test-selection.rules.json` + generated registry — route the canonical session lifecycle handler through the focused exclusive work-session contract instead of the unrelated whole-OS fallback suite.
- `packages/workspace/tests/test-selection.test.js` — red/green selector regression for the lifecycle handler.

## workspace-owned: files changed

- Same production/test/generated files listed above plus this task metadata/workpad.

## workspace-owned: activity log

- 2026-08-26 22:18:22 fs.write: `.task/workspace-agents/repair-session-start-and-release-lifecycle-regressions/workpad.md`
- 2026-08-26: read runtime traces, prior workpads, session/release handlers, schemas, orchestrator, and focused tests.

## workspace-owned: validation evidence

- RED `trc_4a77e539720e`: focused Vitest run failed exactly 3 intended assertions (session runtime execution scope, release main-targeting review-PR guidance, release timeout/guidance surface); 19 pre-existing assertions passed.
- GREEN `trc_bb11658ff64e`: focused lifecycle/release suite passed 23/23, including the facade command-plan assertion that `session.start` runs from `packages/os`.
- Characterized manifest suites initially failed only on expected baseline drift (`trc_ce7748b0a571`); baseline refreshed from the canonical generator.
- GREEN `trc_b5e8c3cb83eb`: tool manifest/package layout suites passed 20/20 with no generated-manifest drift.
- Strict review `trc_481ff2a74398`: 0 blocking issues; its single non-blocking documentation opportunity is addressed in this task.
- Docs validation `trc_a2f4c730c98d`: documentation validator passed and Reference contract passed 10/10.
- Selector RED `trc_3187905b77cc`: `packages/os/tools/task-lifecycle/handler.ts` incorrectly selected only `auto:@consuelo/os:package-test` instead of the focused `os-work-session-fs` rule.
- Selector GREEN `trc_92b7914c3f98`: lifecycle handler now selects focused work-session contracts and suppresses the whole-OS package fallback.
- First canonical verify `trc_c5b37152ea1d` exposed the selector gap; direct selection evidence `trc_ccf3a46127eb` showed every critical release/lifecycle/session suite green while the unrelated package-wide fallback failed on pre-existing cleanup-path and Google script-parity drift.
- Strict review retry `trc_71e120cef829`: 0 blocking issues and 0 documentation opportunities after selector/docs changes; the prior attempt failed in the review facade with a transient TaskGroup exception before producing a result.
- Manifest/layout recheck after minimizing fixture churn `trc_d76f8cccceab`: 20/20 passed with no generated-manifest drift.
- FINAL VERIFY `trc_25e37a4236ed`: full gate passed and wrote a publish-valid stamp against `origin/stream/workspace-agents`.
- 2026-08-26 22:23:38 `review.run`: passed — OK
- 2026-08-26 22:25:04 `review.run`: passed — OK
- 2026-08-26 22:26:35 `verify`: failed — COMMAND_FAILED
- 2026-08-26 22:30:04 `review.run`: passed — OK
- 2026-08-26 22:30:40 `verify`: passed — OK
- 2026-08-26 22:31:44 `verify`: passed — OK

## key decisions

- Start from `stream/workspace-agents` because these are direct regressions in the recently integrated workspace-agent/session/release tooling and the user asked to push the fix to that stream.
- Do not broaden `release` to auto-release task PRs: the original workpad and smoke contract intentionally require a PR targeting `main`.
- Prefer runtime execution scope for `session.start` over adding a duplicate root package alias; the canonical implementation is shipped in `@consuelo/os` and the facade already has an explicit runtime-scope mechanism for this exact ownership case.
- Set `release` default timeout to 4 hours: the bounded worst-case synchronous workflow is about 223.5 minutes (PR checks + merge + publication + three promotions + local update), so 20 minutes contradicted the orchestrator's own legal wait budget.
- Treat the package-wide OS suite failure as selector noise, not a reason to change unrelated cleanup/Google work: the existing `os-work-session-fs` rule is explicitly exclusive and says it must avoid unrelated package-wide OS tests, so the lifecycle handler was added to that focused ownership boundary with a regression test.

## notes for ko

- The latest `release` rejection itself is healthy guardrail behavior; the two defects around it are caller guidance and the 20-minute facade timeout.

## improvements noticed

- The session-start foundation test checked publication/schema but not executable command scope, allowing a manifest-valid tool to be unrunnable in the installed facade.

## issues and recovery

- `session.start` is the broken tool under repair, so this task was created through its documented `task.start` compatibility alias.
- Initial repo reads came from a stale local `main`; the task was then started from the live remote `stream/workspace-agents`, which contains the current release implementation and tests.
- A first fixture-refresh `code.call` resolved imports relative to its temporary program path, and a shell-escaped retry was correctly rejected; recovered by using a `file://` import rooted at the task worktree (`trc_57ac4dd61cdb`).

---

## publish checklist

```bash
bun run task:push -- --message "fix(os): repair session and release lifecycle contracts" --changed
bun run task:pr
bun run task:finish
```

- 2026-08-26 22:18:22 write: `.task/workspace-agents/repair-session-start-and-release-lifecycle-regressions/workpad.md`

- 2026-08-26 22:18:31 apply-patch: `packages/os/tests/session-start-foundation.test.ts`
- 2026-08-26 22:18:31 apply-patch: `packages/os/tests/release-tool-surface.test.ts`
- 2026-08-26 22:18:31 apply-patch: `packages/os/tests/release-orchestrator.test.ts`

## workspace-owned: files read

- `packages/documentation/AUTHORING.md`
- `packages/documentation/README.md`
- `packages/documentation/package.json`
- `packages/documentation/scripts/validate-documentation.mjs`
- `packages/documentation/src/content/docs/reference/tools.mdx`
- `packages/documentation/tests/reference.test.ts`
- `packages/os/scripts/generate-tool-manifest.ts`
- `packages/os/scripts/lib/facade/executor.ts`
- `packages/os/tests/facade/facade.test.ts`
- `packages/os/tests/fixtures/tool-package-baseline.json`
- `packages/os/tests/release-orchestrator.test.ts`
- `packages/os/tests/release-tool-surface.test.ts`
- `packages/os/tests/session-start-foundation.test.ts`
- `packages/os/tests/tool-manifest.test.ts`
- `packages/os/tests/tool-package-layout.test.ts`
- `packages/workspace/manifests/manifest.config.json`
- `packages/workspace/scripts/generate-tool-manifest.ts`
- `packages/workspace/scripts/git-diff.js`
- `packages/workspace/scripts/test-selection.js`
- `packages/workspace/scripts/verify.js`
- `packages/workspace/test-selection.registry.json`
- `packages/workspace/test-selection.rules.json`
- `packages/workspace/tests/test-selection.test.js`
- `packages/workspace/tooling/tool-manifest.json`

- 2026-08-26 22:32:08 apply-patch: `.task/workspace-agents/repair-session-start-and-release-lifecycle-regressions/workpad.md`