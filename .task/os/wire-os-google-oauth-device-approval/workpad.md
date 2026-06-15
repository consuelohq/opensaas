# wire os google oauth device approval

branch: `task/os/wire-os-google-oauth-device-approval`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1047/wire-os-google-oauth-device-approval
github pr: https://github.com/consuelohq/opensaas/pull/1047
started: 2026-06-14

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

- none yet

## workspace-owned: validation evidence

- 2026-06-14 23:47:22 `checkFiles`: passed — OK
- 2026-06-14 23:51:45 `review.run`: passed — OK
- 2026-06-14 23:53:00 `checkFiles`: passed — OK
- 2026-06-14 23:53:31 `review.run`: passed — OK
- 2026-06-14 23:54:12 `verify`: passed — OK

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
bun run task:push -- --message "type(os): description" --changed
bun run task:pr
bun run task:finish
```

## workspace-owned: files read

- `package.json`
- `packages/os/cloudflare/os-device-authority/src/index.ts`
- `packages/os/cloudflare/os-device-authority/wrangler.toml`
- `packages/os/package.json`
- `packages/os/scripts/lib/workspace-device-authorization.ts`
- `packages/os/scripts/lib/workspace-device-login-client.ts`
- `packages/os/tests/os-device-authority-worker.test.ts`
- `packages/workspace/SCRIPTS.md`
- `packages/workspace/package.json`
- `packages/workspace/scripts/os-release-device-auth.ts`
- `packages/workspace/scripts/os-release.ts`

- 2026-06-14 23:52:44 apply-patch: `packages/os/cloudflare/os-device-authority/src/index.ts`

## workspace-owned: test selection

- changed files: `.task/os/wire-os-google-oauth-device-approval/current.json`, `.task/os/wire-os-google-oauth-device-approval/evidence-log.json`, `.task/os/wire-os-google-oauth-device-approval/read-log.json`, `.task/os/wire-os-google-oauth-device-approval/session.json`, `.task/os/wire-os-google-oauth-device-approval/workpad.md`, `.task/tasks/os/wire-os-google-oauth-device-approval.json`, `packages/os/cloudflare/os-device-authority/src/index.ts`, `packages/os/tests/os-device-authority-worker.test.ts`, `packages/workspace/package.json`, `packages/workspace/scripts/os-release-device-auth.ts`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: changed code selected zero suites; add a discoverable test or explicit rule when this is not intentional
