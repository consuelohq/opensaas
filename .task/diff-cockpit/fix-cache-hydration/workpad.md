# fix cache hydration

branch: `task/diff-cockpit/fix-cache-hydration`
stream: `stream/diff-cockpit`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/890/fix-cache-hydration
github pr: https://github.com/consuelohq/opensaas/pull/890
started: 2026-06-09

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

- 2026-06-09 21:58:56 `checkFiles`: passed — OK
- 2026-06-09 22:01:48 `verify`: failed — COMMAND_FAILED

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
bun run task:push -- --message "type(diff-cockpit): description" --changed
bun run task:pr
bun run task:finish
```

## workspace-owned: files read

- `packages/diff-cockpit/src/index.ts`

## workspace-owned: test selection

- changed files: `.task/diff-cockpit/diagnose-cron-cache-refresh/current.json`, `.task/diff-cockpit/diagnose-cron-cache-refresh/evidence-log.json`, `.task/diff-cockpit/diagnose-cron-cache-refresh/read-log.json`, `.task/diff-cockpit/diagnose-cron-cache-refresh/session.json`, `.task/diff-cockpit/diagnose-cron-cache-refresh/verify.json`, `.task/diff-cockpit/diagnose-cron-cache-refresh/workpad.md`, `.task/diff-cockpit/fix-cache-hydration/current.json`, `.task/diff-cockpit/fix-cache-hydration/evidence-log.json`, `.task/diff-cockpit/fix-cache-hydration/read-log.json`, `.task/diff-cockpit/fix-cache-hydration/session.json`, `.task/diff-cockpit/fix-cache-hydration/workpad.md`, `.task/diff-cockpit/fix-edge-cache-writes/current.json`, `.task/diff-cockpit/fix-edge-cache-writes/evidence-log.json`, `.task/diff-cockpit/fix-edge-cache-writes/read-log.json`, `.task/diff-cockpit/fix-edge-cache-writes/session.json`, `.task/diff-cockpit/fix-edge-cache-writes/verify.json`, `.task/diff-cockpit/fix-edge-cache-writes/workpad.md`, `.task/diff-cockpit/hydrate-pr-pages-from-shared-cache/current.json`, `.task/diff-cockpit/hydrate-pr-pages-from-shared-cache/evidence-log.json`, `.task/diff-cockpit/hydrate-pr-pages-from-shared-cache/read-log.json`, `.task/diff-cockpit/hydrate-pr-pages-from-shared-cache/session.json`, `.task/diff-cockpit/hydrate-pr-pages-from-shared-cache/verify.json`, `.task/diff-cockpit/hydrate-pr-pages-from-shared-cache/workpad.md`, `.task/evidence-log.json`, `.task/explore-state.json`, `.task/os/add-public-gateway-security-tests/current.json`, `.task/os/add-public-gateway-security-tests/evidence-log.json`, `.task/os/add-public-gateway-security-tests/read-log.json`, `.task/os/add-public-gateway-security-tests/session.json`, `.task/os/add-public-gateway-security-tests/workpad.md`, `.task/os/fix-sites-archive-server-slash-handling/current.json`, `.task/os/fix-sites-archive-server-slash-handling/evidence-log.json`, `.task/os/fix-sites-archive-server-slash-handling/read-log.json`, `.task/os/fix-sites-archive-server-slash-handling/session.json`, `.task/os/fix-sites-archive-server-slash-handling/verify.json`, `.task/os/fix-sites-archive-server-slash-handling/workpad.md`, `.task/os/ship-sites-archive-shell-to-main/current.json`, `.task/os/ship-sites-archive-shell-to-main/session.json`, `.task/os/ship-sites-archive-shell-to-main/verify.json`, `.task/os/ship-sites-archive-shell-to-main/workpad.md`, `.task/tasks/diff-cockpit/diagnose-cron-cache-refresh.json`, `.task/tasks/diff-cockpit/fix-cache-hydration.json`, `.task/tasks/diff-cockpit/fix-edge-cache-writes.json`, `.task/tasks/diff-cockpit/hydrate-pr-pages-from-shared-cache.json`, `.task/tasks/os/add-public-gateway-security-tests.json`, `.task/tasks/os/fix-sites-archive-server-slash-handling.json`, `.task/tasks/os/ship-sites-archive-shell-to-main.json`, `cron_jobs/README.md`, `cron_jobs/diff_cockpit/cron.json`, `cron_jobs/index.ts`, `cron_jobs/tests/cron_jobs.test.ts`, `packages/diff-cockpit/src/index.ts`, `packages/diff-cockpit/tests/diff-cockpit.test.ts`, `packages/os/tests/security-gateway.test.ts`, `packages/workspace/TOOLS.md`, `packages/workspace/scripts/consuelo-design.ts`, `packages/workspace/scripts/lib/codemode/tools/index.ts`, `packages/workspace/scripts/lib/codemode/types.ts`, `packages/workspace/src/generated/workspace.d.ts`, `packages/workspace/tests/consuelo-design-theme.test.js`, `packages/workspace/tooling/tool-manifest.json`, `scripts/operator/trace-tools.ts`
- matched rules: `workspace-facade`, `workspace-audit-docs`
- selected suites: `workspace facade input contracts`, `workspace audit tests`
- run results: `workspace facade input contracts` passed, `workspace audit tests` passed
- failed suites: none
