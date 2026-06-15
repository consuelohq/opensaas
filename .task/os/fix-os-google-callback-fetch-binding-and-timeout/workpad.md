# fix os google callback fetch binding and timeout

branch: `task/os/fix-os-google-callback-fetch-binding-and-timeout`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1056/fix-os-google-callback-fetch-binding-and-timeout
github pr: https://github.com/consuelohq/opensaas/pull/1056
started: 2026-06-15

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

- 2026-06-15 01:28:40 `checkFiles`: passed — OK
- 2026-06-15 01:29:21 `review.run`: passed — OK
- 2026-06-15 01:29:37 `verify`: passed — OK

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

- `packages/os/cloudflare/os-device-authority/src/index.ts`
- `packages/os/scripts/install.ts`
- `packages/os/tests/os-device-authority-worker.test.ts`

- 2026-06-15 01:27:41 apply-patch: `packages/os/tests/os-device-authority-worker.test.ts`
- 2026-06-15 01:28:02 apply-patch: `packages/os/tests/os-device-authority-worker.test.ts`
- 2026-06-15 01:28:15 apply-patch: `packages/os/tests/os-device-authority-worker.test.ts`

## workspace-owned: test selection

- changed files: `.task/os/fix-os-google-callback-fetch-binding-and-timeout/current.json`, `.task/os/fix-os-google-callback-fetch-binding-and-timeout/evidence-log.json`, `.task/os/fix-os-google-callback-fetch-binding-and-timeout/read-log.json`, `.task/os/fix-os-google-callback-fetch-binding-and-timeout/session.json`, `.task/os/fix-os-google-callback-fetch-binding-and-timeout/workpad.md`, `.task/tasks/os/fix-os-google-callback-fetch-binding-and-timeout.json`, `packages/os/cloudflare/os-device-authority/src/index.ts`, `packages/os/scripts/install.ts`, `packages/os/tests/os-device-authority-worker.test.ts`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: changed code selected zero suites; add a discoverable test or explicit rule when this is not intentional
