# retain GitHub OAuth state until connection succeeds

branch: `task/workspace-agents/retain-github-oauth-state-until-connection-succeeds`
stream: `stream/workspace-agents`
pr: https://github.com/consuelohq/opensaas/pull/2276
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

behavior under test: when a verified preferred existing GitHub installation fails transiently during installation/repository/connection completion, the OAuth state and already-exchanged user token remain retryable until completion succeeds; state is removed only after a successful handoff is created.
existing local pattern: OAuth callback persists the GitHub user token before `/user/installations`; preferred installations are completed by `completeGitHubInstallation`, while install state is TTL/alarm bounded.
new or changed tests: add a focused authority test where `/app/installations/:id` fails once after the preferred install is selected, then succeeds on a retry of the same callback; assert one OAuth exchange and successful second handoff.
focused red command: `bun test packages/os/tests/github-source-control-authority.test.ts`
expected red failure: current preferred branch deletes install state before `completeGitHubInstallation`, so the retry receives `GITHUB_INSTALL_STATE_INVALID` instead of succeeding.
no-test waiver: not applicable.

## review context

Codex P2 on stream PR #2269 final review: delete preferred-install state only after completion succeeds so the retryability added for transient GitHub failures is preserved through the entire completion path.

- 2026-08-29 02:31:47 append: `.task/workspace-agents/retain-github-oauth-state-until-connection-succeeds/workpad.md`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-08-29 02:31:47 fs.write: `.task/workspace-agents/retain-github-oauth-state-until-connection-succeeds/workpad.md`

## workspace-owned: files read

- `packages/os/tests/github-source-control-authority.test.ts`

- 2026-08-29 02:32:07 apply-patch: `packages/os/tests/github-source-control-authority.test.ts`
- 2026-08-29 02:32:28 apply-patch: `packages/os/cloudflare/os-device-authority/src/routes/github-source-control.ts`

## workspace-owned: validation evidence

- 2026-08-29 02:33:48 `review.run`: passed — OK
- 2026-08-29 02:34:07 `verify`: passed — OK
