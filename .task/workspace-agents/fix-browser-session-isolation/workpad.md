# fix browser session isolation

branch: `task/workspace-agents/fix-browser-session-isolation`
stream: `stream/workspace-agents`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/2202/fix-browser-session-isolation
github pr: https://github.com/consuelohq/opensaas/pull/2202
started: 2026-08-26

## acceptance criteria

- [ ] `browser.headed` never performs a global `close --all` as part of opening a visible browser.
- [ ] A headed handoff uses one persistent named human session and subsequent typed browser commands stay attached to that session without demoting/closing it.
- [ ] Explicit raw `--session` and/or `--profile` routing is honored exactly; the wrapper must not prepend the shared default profile over caller routing.
- [ ] `browser.status` can inspect active sessions without trying to launch a second Chrome against a locked profile.
- [ ] Explicit `browser.close` remains the only global close operation.
- [ ] Workspace and OS browser runtime copies remain byte-identical.
- [ ] Focused tests, strict review, verify, and a real isolated headed-session smoke pass before publish.

## plan

1. Extend the existing browser service regression suite first to encode no-global-close, named human-session persistence, explicit routing preservation, and status safety.
2. Run the focused browser test RED against current main behavior.
3. Implement the smallest shared browser service change in both workspace and OS copies; preserve explicit caller routing and use `consuelo-human` for headed handoffs.
4. Run focused GREEN, static checks, structured diff, strict review, and canonical verify against `origin/main`.
5. Run a live browser smoke using a throwaway explicit session/profile and prove an unrelated session is unchanged across open/read/snapshot operations.
6. Push and promote through `stream/workspace-agents`; do not modify the other agent's worktrees.

## Test-first contract

- behavior under test: browser handoffs stay visible and isolated across follow-up commands; starting a headed browser does not kill unrelated sessions; explicit raw/profile/session routing is not overwritten by the default browser profile; status is read-only with respect to browser startup.
- existing local pattern: `packages/os/tests/browser-service.test.ts` records exact `agent-browser` argv from `packages/{workspace,os}/scripts/lib/browser/service.ts` and asserts workspace/OS runtime byte parity.
- new or changed tests: update headed lifecycle expectations to forbid `close --all`; add active-human-session routing coverage; add explicit `--profile`/`--session` preservation coverage; update status expectations to list sessions without a profile and route reads to the human session.
- focused red command: `bunx vitest run packages/os/tests/browser-service.test.ts`
- expected red failure: current implementation emits `close --all`, prepends the default profile even when explicit routing is present, and status/session reads use the locked default profile.
- no-test waiver: not applicable.

## current status

- Reproduced the failure before task start: isolated visible Chrome repeatedly fell back to `about:blank` after follow-up raw commands while the profile remained locked/alive.
- Current main source confirms two defects: headed startup calls `close --all`; `runBrowserCommandEffect` blindly prepends the default profile.
- The other agent's two browser worktrees were inspected read-only. Their newer branch adds `consuelo-human` routing but still keeps `close --all` and does not handle caller-supplied explicit routing. This task remains separate.
- RED complete (`trc_c3a1424803fc`): focused browser suite failed on all intended new contracts—global close, named-session persistence, explicit routing preservation, and status routing. One additional failure is unrelated generated-fixture absence (`packages/os/tooling/dev-tool-manifest.json`) in the fresh task worktree and is tracked separately from behavior.
- GREEN complete (`trc_5e883beb78c5`): 19/19 focused browser tests pass after updating the stale OS manifest test helper to the current generated manifest path/shape.
- Static checks pass for both mirrored service files and the regression test (`trc_b69060ab6fd0`).
- Live runtime smoke through the task-worktree wrapper proved the checkout failure mode is fixed (`trc_2ed15a72abcc`, repeated in `trc_969bd55984ca`): an explicit named `/tmp` headed session stayed on `https://example.com/` across read → accessibility snapshot → read, emitted no profile/Singleton warnings, and the unrelated `consuelo-human` session stayed `about:blank` before/after.
- `agent-browser` session cleanup has its own routing defect: `close --session NAME` without the matching explicit profile tries the shared default profile and fails Singleton; session+profile close succeeds. The smoke browser process was closed, though `session list` retains one stale smoke session name. No global close was used.
- Full `verify` is not publish-valid because its auto-selected `@consuelo/os` package test contains unrelated existing facade failures. The lifecycle-specific verification suite passed 214/214, syntax passed, review passed, and DB guard passed. Direct detached-base proof (`trc_a8c28c9cdbf4`) reproduced the same representative failures on untouched `origin/main` SHA `4d977ca0cb3215d95efc35255d6902508e1cefbe`: `media.transcribe` dry-run returns `VALIDATION_ERROR`, `subagent` dry-run returns `COMMAND_FAILED`, and the fs pagination assertion expects stale wording. This task does not modify those paths.
- Verify regenerates ignored OS manifest artifacts as a side effect; they were removed again before publish. The browser regression test now reads the OS utilities source manifest in memory so focused tests do not require generated files.

## files changed

- `packages/workspace/scripts/lib/browser/service.ts`
- `packages/os/scripts/lib/browser/service.ts`
- `packages/os/tests/browser-service.test.ts`
- scoped `.task/workspace-agents/fix-browser-session-isolation/**` metadata/workpad

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- none yet

## workspace-owned: validation evidence

- 2026-08-26 05:17:44 `checkFiles`: passed — OK
- 2026-08-26 05:20:03 `review.run`: passed — OK
- 2026-08-26 05:20:55 `verify`: failed — COMMAND_FAILED
- 2026-08-26 05:23:38 `checkFiles`: passed — OK
- 2026-08-26 05:24:54 `verify`: failed — COMMAND_FAILED
- 2026-08-26 05:25:50 `review.run`: passed — OK

## key decisions

- Do not edit or publish from the other agent's browser worktrees; use a fresh task from main for parallel-agent safety.
- Preserve explicit caller routing as higher priority than automatic human-session/default-profile routing.
- Keep `close --all` only behind the explicit browser close action.
- Treat caller-supplied `--session` or `--profile` as authoritative routing and bypass automatic default-profile injection.
- For ordinary typed commands without explicit routing, discover sessions without a profile; prefer the persistent `consuelo-human` session when present, otherwise use the configured profile.
- `browser.status` reads the active named session directly instead of trying to instantiate/attach Chrome by profile.

## notes for ko

- The task is scoped to browser tooling only. Stripe checkout work remains unchanged; once this ships, the checkout E2E can resume with a stable visible session.

## improvements noticed

- `agent-browser close --session NAME` still needs matching profile routing when a session was created with a custom profile; otherwise it attempts the shared profile and trips Singleton. This is adjacent CLI behavior, not required for the headed-window persistence fix.
- The browser test still referenced removed `packages/os/tooling/dev-tool-manifest.json`; updated it to `packages/os/manifests/generated/tool.manifest.json` and its nested `definition.capabilities` shape.

## issues and recovery

- Canonical `session.start({kind:"task"})` is still broken locally: outer timeout is injected into input (`trc_8520b5bfe735`), and retry without timeout fails because `session:start` is missing (`trc_dba7d58ad50a`). The documented `task.start` compatibility alias succeeded as taskSession `tsk_8b0d5c919898` / PR #2202.
- `fs.write` rejected the documented `force` option at the facade layer, then without it refused to overwrite the existing workpad. Switched to `fs.apply_patch`.
- Installed `code.call` no longer accepts the documented command-array form; it requires `code` or `codeFile`. Used a small Bun process runner for focused tests/runtime smoke.
- Task-scoped `status` ignored the outer taskSession and reported the root checkout; task-scoped `git.diff` correctly resolved the task worktree and is used as authoritative diff evidence.
- Full verify traces `trc_687e3464de90` / `trc_9357acce2e6c` are red only because of the pre-existing OS package test failures above; base reproduction is `trc_a8c28c9cdbf4`. Do not widen this browser task into media/subagent/fs facade repairs.

---

## publish checklist

```bash
bun run task:push -- --message "type(workspace-agents): description" --changed
bun run task:pr
bun run task:finish
```

## workspace-owned: files read

- `packages/os/manifests/generated/tool.manifest.json`
- `packages/os/package.json`
- `packages/os/scripts/generate-tool-manifest.ts`
- `packages/os/tests/browser-service.test.ts`
- `packages/os/tools/package.ts`
- `packages/os/tools/utilities/manifest.ts`
- `packages/workspace/scripts/lib/browser/cli.ts`
- `packages/workspace/scripts/lib/browser/config.ts`
- `packages/workspace/scripts/lib/browser/process.ts`
- `packages/workspace/scripts/lib/browser/service.ts`

- 2026-08-26 05:23:27 apply-patch: `packages/os/tests/browser-service.test.ts`

- 2026-08-26 05:25:38 apply-patch: `.task/workspace-agents/fix-browser-session-isolation/workpad.md`
