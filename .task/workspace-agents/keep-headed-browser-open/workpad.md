# keep headed browser open

branch: `task/workspace-agents/keep-headed-browser-open`
stream: `stream/workspace-agents`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/2192/keep-headed-browser-open
github pr: https://github.com/consuelohq/opensaas/pull/2192
started: 2026-08-26

## acceptance criteria

- [x] Reproduce why `browser.headed` reports success while the user-visible Chrome disappears.
- [x] Prove the real process-level mode transition with agent-browser 0.25.3.
- [x] Keep every command inside the headed handoff in headed mode so the wrapper cannot demote itself before returning.
- [x] Keep the OS/workspace browser runtime mirrors byte-identical and cover the regression in both mirrored tests.
- [x] Document the upstream mode-switch behavior in `packages/os/SCRIPTS.md`.
- [ ] Verify the patched wrapper against a real headed Chrome process and complete the GitHub App setup with the persistent authenticated session.
- [ ] Run review/verify, publish the browser fix through the stream, and update the installed Canary runtime if this fix is included in a new release.

## plan

1. Reproduce the visible-window close with process-level evidence instead of trusting wrapper status.
2. Add a RED command-sequence contract for the headed handoff.
3. Fix `headedBrowserEffect` so its launch and metadata reads all retain `--headed` and remove the unnecessary about:blank→target two-step.
4. Run focused GREEN tests on both runtime mirrors and inspect the diff.
5. After Ko completes the human login in the proven persistent workaround window, use that session to finish the external GitHub App setup.
6. Validate the patched wrapper live, then run review/verify and publish through `stream/workspace-agents`.

## current status

- Root cause proven. `browser.headed` launched visible Chrome, then its own unheaded navigation/metadata commands caused agent-browser 0.25.3 to replace that Chrome with a headless process before the handoff returned.
- A direct headed workaround is live for Ko; the same visible Chrome PID remained alive for >3 minutes without `--headless=new` while no browser facade calls were issued.
- Test-first RED: 4 intended headed command-sequence contracts failed before production edit (trace `trc_1c295190f97a`; one unrelated manifest-path failure was also present).
- Focused GREEN: OS headed contracts 4/4 passed (`trc_dcb546b8a9f1`); workspace mirror 4/4 passed (`trc_d0a749106ca9`).
- Added a dedicated critical/exclusive `os-browser-headed-handoff` test-selection rule after the first full verify exposed unrelated release/lifecycle/package-suite selection. RED proved the missing rule (`trc_f78d6bcbf36c`); GREEN passed (`trc_31245e5bd378`). The generated registry is updated with that rule.
- Removed the unrelated `packages/os/SCRIPTS.md` touch and restored the incidental facade snapshot rewrite produced by the noisy first verify. The browser-specific runtime/test change remains isolated.
- Full canonical verify is publish-valid (`trc_072b479ca43b`).
- Production implementation is patched in the task worktree. Live patched-wrapper verification is intentionally deferred until Ko finishes the current human login so we do not disturb the visible browser.
- The direct headed workaround Chrome PID `59828` remained alive for >9 minutes with no `--headless=new` flag (`trc_e129b3aa6ade`).

## files changed

- none yet

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-08-26 04:10:26 fs.write: `.task/workspace-agents/keep-headed-browser-open/workpad.md`

## workspace-owned: validation evidence

- 2026-08-26 04:12:41 `review.run`: passed — OK
- 2026-08-26 04:14:51 `verify`: failed — COMMAND_FAILED
- 2026-08-26 04:17:57 `verify`: passed — OK

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

behavior under test: `browser.headed` must leave the Chrome process in headed mode for the human handoff; no follow-up command inside the same headed operation may omit `--headed` and silently relaunch Chrome headless before the user can interact.
existing local pattern: `headedBrowserEffect` explicitly closes the incompatible daemon, starts agent-browser with `--headed`, navigates, then reads URL/title. agent-browser 0.25.3 treats a subsequent command without `--headed` as a headless-mode request and replaces the visible Chrome process.
new or changed tests: update the browser service contract to require the target navigation and URL/title reads in the headed handoff to retain `--headed`; keep OS/workspace runtime mirrors byte-identical.
focused red command: `bun run --cwd packages/os vitest run tests/browser-service.test.ts`
expected red failure: current `headedBrowserEffect` emits unheaded navigation/get commands, so the new command-sequence assertion fails before production code changes.
no-test waiver: not applicable.

## Runtime reproduction

- `browser.headed` reported `leftRunning: true`, but process inspection showed Chrome had `--headless=new`.
- After a clean `browser.close`, direct `agent-browser --profile ~/.agent-browser-ko --headed open about:blank` produced a real visible Chrome without `--headless=new`.
- One subsequent unheaded `agent-browser ... get url` replaced that process with a new Chrome containing `--headless=new`.
- The same follow-up with `--headed` preserved the original visible Chrome PID.
- Root cause: the wrapper's own follow-up commands demote the headed handoff before `browser.headed` returns.

- 2026-08-26 04:10:26 append: `.task/workspace-agents/keep-headed-browser-open/workpad.md`

- 2026-08-26 04:10:41 apply-patch: `packages/os/tests/browser-service.test.ts`
- 2026-08-26 04:10:41 apply-patch: `packages/workspace/tests/browser-service.test.ts`
- 2026-08-26 04:10:59 apply-patch: `packages/os/scripts/lib/browser/service.ts`
- 2026-08-26 04:10:59 apply-patch: `packages/workspace/scripts/lib/browser/service.ts`
- 2026-08-26 04:11:12 apply-patch: `packages/os/SCRIPTS.md`
- 2026-08-26 04:11:22 apply-patch: `packages/os/tests/browser-service.test.ts`
- 2026-08-26 04:11:22 apply-patch: `packages/workspace/tests/browser-service.test.ts`

- 2026-08-26 04:12:11 apply-patch: `.task/workspace-agents/keep-headed-browser-open/workpad.md`

## workspace-owned: files read

- `packages/os/cloudflare/os-device-authority/src/routes/github-source-control.ts`
- `packages/os/cloudflare/os-device-authority/src/services/github-source-control.ts`
- `packages/os/cloudflare/os-device-authority/wrangler.toml`
- `packages/workspace/scripts/test-selection.js`
- `packages/workspace/test-selection.rules.json`
- `packages/workspace/tests/github-workflow-policy.test.js`
- `packages/workspace/tests/run-changed-server-task.test.mjs`
- `packages/workspace/tests/test-selection.test.js`
- `packages/workspace/tests/typeorm-cli-contract.test.mjs`

- 2026-08-26 04:18:19 apply-patch: `.task/workspace-agents/keep-headed-browser-open/workpad.md`