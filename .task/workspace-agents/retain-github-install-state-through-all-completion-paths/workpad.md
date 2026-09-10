# retain GitHub install state through all completion paths

branch: `task/workspace-agents/retain-github-install-state-through-all-completion-paths`
stream: `stream/workspace-agents`
pr: https://github.com/consuelohq/opensaas/pull/2287
started: 2026-08-29

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
bun run task:push -- --message "type(workspace-agents): description" --changed
bun run task:pr
bun run task:finish
```

## Test-first contract

behavior under test: GitHub install/select callbacks must retain OAuth install state until verified connection completion and handoff persistence succeed, so transient completion failures can retry with the already-exchanged user token.
existing local pattern: the preferred existing-install path now completes first and deletes state after success; install/select callbacks still need the same ordering.
new or changed tests: extend packages/os/tests/github-source-control-authority.test.ts with transient completion failures for /install/callback and /install/select, retrying the same state and asserting a single OAuth exchange and successful second handoff.
focused red command: bun test packages/os/tests/github-source-control-authority.test.ts
expected red failure: current install/select handlers delete state before completeGitHubInstallation, so retry receives GITHUB_INSTALL_STATE_INVALID.
no-test waiver: not applicable.

## review context

Codex P2 on stream PR #2269 final SHA c3aaecad: retain state until completion succeeds for fresh install callback and explicit installation selection, matching the already-fixed preferred-install path.

- 2026-08-29 06:05:49 append: `.task/workspace-agents/retain-github-install-state-through-all-completion-paths/workpad.md`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-08-29 06:05:49 fs.write: `.task/workspace-agents/retain-github-install-state-through-all-completion-paths/workpad.md`

## workspace-owned: files read

- `packages/os/cloudflare/os-device-authority/src/routes/github-source-control.ts`
- `packages/os/tests/github-source-control-authority.test.ts`

- 2026-08-29 06:06:36 apply-patch: `packages/os/tests/github-source-control-authority.test.ts`
- 2026-08-29 06:06:53 apply-patch: `packages/os/cloudflare/os-device-authority/src/routes/github-source-control.ts`

## workspace-owned: validation evidence

- 2026-08-29 06:08:17 `review.run`: passed — OK
- 2026-08-29 06:08:29 `verify`: passed — OK
