# fix installer copy and launcher links

branch: `task/release/fix-installer-copy-and-launcher-links`
stream: `stream/release`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1286/fix-installer-copy-and-launcher-links
github pr: https://github.com/consuelohq/opensaas/pull/1286
started: 2026-06-30

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

- 2026-06-30 15:30:52 `review.run`: passed — OK
- 2026-06-30 15:31:43 `verify`: passed — OK

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
bun run task:push -- --message "type(release): description" --changed
bun run task:pr
bun run task:finish
```

## workspace-owned: test selection

- changed files: `.task/release/fix-installer-copy-and-launcher-links/current.json`, `.task/release/fix-installer-copy-and-launcher-links/session.json`, `.task/release/fix-installer-copy-and-launcher-links/workpad.md`, `.task/tasks/release/fix-installer-copy-and-launcher-links.json`, `packages/os/scripts/bootstrap.sh`, `packages/os/scripts/install.ts`, `packages/os/scripts/lib/sites.ts`, `packages/os/scripts/onboarding-flow.test.ts`, `packages/os/tests/sites-cli.test.ts`, `packages/workspace/scripts/office.ts`, `packages/workspace/tests/office-theme.test.js`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: changed code selected zero suites; add a discoverable test or explicit rule when this is not intentional
