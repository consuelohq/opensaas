# ship os device approval worker

branch: `task/os/ship-os-device-approval-worker`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1001/ship-os-device-approval-worker
github pr: https://github.com/consuelohq/opensaas/pull/1001
started: 2026-06-13

## acceptance criteria

- [ ] Define explicit task acceptance criteria before coding.

## plan

1. Read the relevant code and update this plan before editing.

## current status

- Task started. Update this before publish.

## files changed

- `packages/os/cloudflare/os-device-authority/wrangler.toml`

## workspace-owned: files changed

- `packages/os/cloudflare/os-device-authority/wrangler.toml`

## workspace-owned: activity log

- 2026-06-13 12:10:19 fs.patch: `packages/os/cloudflare/os-device-authority/wrangler.toml`

## workspace-owned: validation evidence

- 2026-06-13 12:06:38 `checkFiles`: passed — OK
- 2026-06-13 12:07:52 `review.run`: passed — OK
- 2026-06-13 12:09:41 `review.run`: passed — OK
- 2026-06-13 12:09:56 `verify`: passed — OK
- 2026-06-13 12:11:50 `review.run`: passed — OK
- 2026-06-13 12:12:04 `verify`: passed — OK

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

- `AGENTS.md`
- `CODING-STANDARDS.md`
- `package.json`
- `packages/os/cloudflare/os-device-authority/src/index.ts`
- `packages/os/cloudflare/workspace-edge/src/index.ts`
- `packages/os/cloudflare/workspace-edge/wrangler.toml`
- `packages/os/package.json`
- `packages/os/scripts/lib/workspace-device-authorization.ts`
- `packages/os/scripts/lib/workspace-device-login-client.ts`
- `packages/os/tests/oauth-device-http-client.test.ts`
- `packages/os/tests/oauth-device-onboarding-contract.test.ts`
- `packages/workspace/SCRIPTS.md`
- `packages/workspace/package.json`
- `packages/workspace/scripts/os-release-install.ts`

## workspace-owned: TDD green evidence

- 2026-06-13 12:04:14 `bun --cwd packages/os test tests/os-device-authority-worker.test.ts`: failed exit 1 trace: `trc_4f22d1cb461a`
  - output: 9m })[33m,[39m [90m 78| [39m }))[33m;[39m [90m 79| [39m [34mexpect[39m(approved[33m.[39mstatus)[33m.[39m[34mtoBe[39m([34m200[39m)[33m;[39m [90m | [39m [31m^[39m [90m 80| [39m const approvedJson = await approved.json() as Record<string, strin… [90m 81| [39m [34mexpect[39m(approvedJson[33m.[39mworkspace_slug)[33m.[39m[34mtoBe[39m([32m'testing'[39m)[33m;[39m [31m[2m⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯[22m[39m error: script "test" exited with code 1 error: script "task:exec" exited with code 1
- 2026-06-13 12:04:38 `bun --cwd packages/os test tests/os-device-authority-worker.test.ts`: passed exit 0 trace: `trc_e30ae623b04d`
  - output: → tmux: opensaas-os-ship-os-device-approval-worker-9a75bab3 $ vitest run tests/os-device-authority-worker.test.ts

## workspace-owned: test selection

- changed files: `.task/os/ship-os-device-approval-worker/current.json`, `.task/os/ship-os-device-approval-worker/evidence-log.json`, `.task/os/ship-os-device-approval-worker/read-log.json`, `.task/os/ship-os-device-approval-worker/session.json`, `.task/os/ship-os-device-approval-worker/verify.json`, `.task/os/ship-os-device-approval-worker/workpad.md`, `.task/tasks/os/ship-os-device-approval-worker.json`, `packages/os/cloudflare/os-device-authority/src/index.ts`, `packages/os/cloudflare/os-device-authority/wrangler.toml`, `packages/os/scripts/lib/workspace-device-authorization.ts`, `packages/os/tests/oauth-device-onboarding-contract.test.ts`, `packages/os/tests/os-device-authority-worker.test.ts`, `packages/workspace/package.json`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: changed code selected zero suites; add a discoverable test or explicit rule when this is not intentional
