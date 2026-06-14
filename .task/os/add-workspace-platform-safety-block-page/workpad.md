# add workspace platform safety block page

branch: `task/os/add-workspace-platform-safety-block-page`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1033/add-workspace-platform-safety-block-page
github pr: https://github.com/consuelohq/opensaas/pull/1033
started: 2026-06-14

## acceptance criteria

- [ ] Define explicit task acceptance criteria before coding.

## plan

1. Read the relevant code and update this plan before editing.

## current status

- Task started. Update this before publish.

## files changed

- `packages/os/scripts/lib/workspace-cloudflare-edge-router.ts`
- `packages/os/tests/workspace-hostname-edge-router.test.ts`

## workspace-owned: files changed

- `packages/os/scripts/lib/workspace-cloudflare-edge-router.ts`
- `packages/os/tests/workspace-hostname-edge-router.test.ts`

## workspace-owned: activity log

- 2026-06-14 04:46:52 fs.patch: `packages/os/tests/workspace-hostname-edge-router.test.ts`
- 2026-06-14 04:47:45 fs.patch: `packages/os/tests/workspace-hostname-edge-router.test.ts`
- 2026-06-14 04:48:39 fs.patch: `packages/os/tests/workspace-hostname-edge-router.test.ts`
- 2026-06-14 04:49:39 fs.patch: `packages/os/scripts/lib/workspace-cloudflare-edge-router.ts`
- 2026-06-14 04:52:25 fs.patch: `packages/os/scripts/lib/workspace-cloudflare-edge-router.ts`
- 2026-06-14 04:53:37 fs.patch: `packages/os/scripts/lib/workspace-cloudflare-edge-router.ts`

## workspace-owned: validation evidence

- 2026-06-14 04:55:17 `checkFiles`: passed — OK
- 2026-06-14 04:56:43 `review.run`: passed — OK
- 2026-06-14 04:57:00 `verify`: passed — OK

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

- `packages/os/cloudflare/workspace-edge/src/index.ts`
- `packages/os/scripts/lib/workspace-cloudflare-edge-router.ts`
- `packages/os/tests/workspace-hostname-edge-router.test.ts`

## workspace-owned: test selection

- changed files: `.task/os/add-workspace-platform-safety-block-page/current.json`, `.task/os/add-workspace-platform-safety-block-page/evidence-log.json`, `.task/os/add-workspace-platform-safety-block-page/read-log.json`, `.task/os/add-workspace-platform-safety-block-page/session.json`, `.task/os/add-workspace-platform-safety-block-page/workpad.md`, `.task/tasks/os/add-workspace-platform-safety-block-page.json`, `packages/os/scripts/lib/workspace-cloudflare-edge-router.ts`, `packages/os/tests/workspace-hostname-edge-router.test.ts`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: changed code selected zero suites; add a discoverable test or explicit rule when this is not intentional
