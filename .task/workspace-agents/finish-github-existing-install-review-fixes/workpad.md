# finish GitHub existing install review fixes

branch: `task/workspace-agents/finish-github-existing-install-review-fixes`
stream: `stream/workspace-agents`
pr: https://github.com/consuelohq/opensaas/pull/2274
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

## workspace-owned: files read

- `packages/os/cloudflare/os-device-authority/src/routes/github-source-control.ts`
- `packages/os/cloudflare/os-device-authority/src/types.ts`
- `packages/os/scripts/lib/github-source-control-client.ts`
- `packages/os/scripts/lib/settings-site.ts`
- `packages/os/scripts/server/routes/settings.ts`
- `packages/os/tests/github-source-control-authority.test.ts`
- `packages/os/tests/settings-hono-routes.test.ts`

## Test-first contract

behavior under test: normal Connect reuses a matching existing GitHub installation without the Configure loop; Manage GitHub access intentionally sends the authorized user through GitHub's installation/update UI; and a consumed OAuth authorization code remains retryable after a transient `/user/installations` failure because the user token is persisted before that API call.
existing local pattern: source-control state is one-time/TTL-bound in Device Authority; settings gateway sends workspace repository owner hints; GitHub install URL carries opaque state and setup-on-update returns to Device Authority.
new or changed tests: `github-source-control-authority.test.ts` for manage-mode redirect and OAuth-token retry; `settings-hono-routes.test.ts` for `mode=manage` propagation; `settings-site.test.ts` if needed to prove the Manage label also changes its href.
focused red command: `bun test packages/os/tests/github-source-control-authority.test.ts packages/os/tests/settings-hono-routes.test.ts packages/os/tests/settings-site.test.ts`
expected red failure: current OAuth callback immediately completes a matching install even for Manage, and returns `GITHUB_USER_AUTHORIZATION_REPLAYED` if a prior token exists instead of retrying installation enumeration.
no-test waiver: not applicable.

## review context

Codex final-SHA P2s on stream PR #2269: (1) Manage GitHub access must remain a real permission-management path; (2) persist the OAuth token before installation enumeration so a transient GitHub API error does not burn the one-time authorization code.

- 2026-08-29 02:22:06 append: `.task/workspace-agents/finish-github-existing-install-review-fixes/workpad.md`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-08-29 02:22:06 fs.write: `.task/workspace-agents/finish-github-existing-install-review-fixes/workpad.md`

- 2026-08-29 02:22:38 apply-patch: `packages/os/tests/github-source-control-authority.test.ts`
- 2026-08-29 02:22:38 apply-patch: `packages/os/tests/settings-hono-routes.test.ts`
- 2026-08-29 02:22:38 apply-patch: `packages/os/tests/settings-site.test.ts`

- 2026-08-29 02:23:43 apply-patch: `packages/os/cloudflare/os-device-authority/src/types.ts`
- 2026-08-29 02:23:43 apply-patch: `packages/os/cloudflare/os-device-authority/src/routes/github-source-control.ts`
- 2026-08-29 02:23:43 apply-patch: `packages/os/scripts/lib/github-source-control-client.ts`
- 2026-08-29 02:23:44 apply-patch: `packages/os/scripts/server/routes/settings.ts`
- 2026-08-29 02:23:44 apply-patch: `packages/os/scripts/lib/settings-site.ts`

## workspace-owned: validation evidence

- 2026-08-29 02:24:36 `review.run`: passed — OK
- 2026-08-29 02:25:39 `verify`: passed — OK
