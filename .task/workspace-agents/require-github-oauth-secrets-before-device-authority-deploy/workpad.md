# require GitHub OAuth secrets before Device Authority deploy

branch: `task/workspace-agents/require-github-oauth-secrets-before-device-authority-deploy`
stream: `stream/workspace-agents`
pr: https://github.com/consuelohq/opensaas/pull/2272
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

- `packages/os/scripts/lib/cloudflare-worker-release-readiness.ts`
- `packages/os/scripts/lib/device-authority-release-readiness.ts`
- `packages/os/tests/cloudflare-worker-release-readiness.test.ts`
- `packages/os/tests/os-device-authority-release-contract.test.ts`

## Test-first contract

behavior under test: Device Authority release readiness fails closed unless both `GITHUB_APP_CLIENT_ID` and `GITHUB_APP_CLIENT_SECRET` are configured, so the worker cannot deploy with a Connect GitHub flow that will fail at runtime.
existing local pattern: `CLOUDFLARE_WORKER_RELEASE_CONFIGS['os-device-authority'].requiredSecrets` is the canonical pre-deploy secret-name allowlist; `cloudflare-worker-release-readiness.test.ts` verifies the check runs before `wrangler deploy`.
new or changed tests: add a focused assertion that Device Authority rejects an otherwise-complete secret list missing the GitHub OAuth client secret, then update the successful deployment fixture to include both new secret names.
focused red command: `bun test packages/os/tests/cloudflare-worker-release-readiness.test.ts`
expected red failure: current required-secret list does not contain the GitHub OAuth credentials, so an otherwise complete old secret set still deploys.
no-test waiver: not applicable.

## review context

Codex P2 on final stream SHA `f9bf24d`: the new GitHub authorization flow requires client ID/secret but release readiness still validates only the older Device Authority secrets.

- 2026-08-29 02:12:29 append: `.task/workspace-agents/require-github-oauth-secrets-before-device-authority-deploy/workpad.md`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-08-29 02:12:29 fs.write: `.task/workspace-agents/require-github-oauth-secrets-before-device-authority-deploy/workpad.md`

- 2026-08-29 02:12:38 apply-patch: `packages/os/tests/cloudflare-worker-release-readiness.test.ts`
- 2026-08-29 02:13:13 apply-patch: `packages/os/scripts/lib/cloudflare-worker-release-readiness.ts`

## workspace-owned: validation evidence

- 2026-08-29 02:14:18 `review.run`: passed — OK
- 2026-08-29 02:14:43 `verify`: failed — COMMAND_FAILED
- 2026-08-29 02:16:18 apply-patch: `packages/os/tests/os-device-authority-release-contract.test.ts`
- 2026-08-29 02:17:04 `verify`: passed — OK
