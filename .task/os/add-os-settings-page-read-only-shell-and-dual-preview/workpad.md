# add os settings page read-only shell and dual preview

branch: `task/os/add-os-settings-page-read-only-shell-and-dual-preview`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1344/add-os-settings-page-read-only-shell-and-dual-preview
github pr: https://github.com/consuelohq/opensaas/pull/1344
started: 2026-07-02

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

- 2026-07-02 20:30:22 `review.run`: passed — OK
- 2026-07-02 20:30:32 `verify`: passed — OK

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

## workspace-owned: test selection

- changed files: `.task/os/add-os-settings-page-read-only-shell-and-dual-preview/current.json`, `.task/os/add-os-settings-page-read-only-shell-and-dual-preview/session.json`, `.task/os/add-os-settings-page-read-only-shell-and-dual-preview/workpad.md`, `.task/tasks/os/add-os-settings-page-read-only-shell-and-dual-preview.json`, `packages/os/scripts/lib/install-edge-site-publisher.ts`, `packages/os/scripts/lib/launcher-onboarding.ts`, `packages/os/scripts/lib/settings-site.ts`, `packages/os/scripts/lib/settings-snapshot.ts`, `packages/os/scripts/lib/sites.ts`, `packages/os/scripts/lib/workspace-edge-route-seed.ts`, `packages/os/tests/install-edge-site-publisher.test.ts`, `packages/os/tests/launcher-onboarding.test.ts`, `packages/os/tests/settings-site.test.ts`, `packages/os/tests/workspace-edge-route-seed-contract.test.ts`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: changed code selected zero suites; add a discoverable test or explicit rule when this is not intentional
