# serve launcher local project routes

branch: `task/design/serve-launcher-local-project-routes`
stream: `stream/design`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/931/serve-launcher-local-project-routes
github pr: https://github.com/consuelohq/opensaas/pull/931
started: 2026-06-10

## acceptance criteria

- [ ] Define explicit task acceptance criteria before coding.

## plan

1. Read the relevant code and update this plan before editing.

## current status

- Task started. Update this before publish.

## files changed

- `packages/workspace/tests/consuelo-design-theme.test.js`

## workspace-owned: files changed

- `packages/workspace/tests/consuelo-design-theme.test.js`

## workspace-owned: activity log

- 2026-06-10 06:05:41 fs.patch: `packages/workspace/tests/consuelo-design-theme.test.js`
- 2026-06-10 06:05:59 fs.patch: `packages/workspace/tests/consuelo-design-theme.test.js`

## workspace-owned: validation evidence

- 2026-06-10 06:07:45 `review.run`: passed — OK
- 2026-06-10 06:07:59 `verify`: passed — OK

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
bun run task:push -- --message "type(design): description" --changed
bun run task:pr
bun run task:finish
```

## workspace-owned: files read

- `packages/workspace/scripts/consuelo-design.ts`
- `packages/workspace/tests/consuelo-design-theme.test.js`

- 2026-06-10 06:05:41 patch lines 170-170: `packages/workspace/tests/consuelo-design-theme.test.js`

- 2026-06-10 06:05:59 patch lines 170-170: `packages/workspace/tests/consuelo-design-theme.test.js`

## workspace-owned: test selection

- changed files: `.task/design/serve-launcher-local-project-routes/current.json`, `.task/design/serve-launcher-local-project-routes/evidence-log.json`, `.task/design/serve-launcher-local-project-routes/read-log.json`, `.task/design/serve-launcher-local-project-routes/session.json`, `.task/design/serve-launcher-local-project-routes/workpad.md`, `.task/tasks/design/serve-launcher-local-project-routes.json`, `packages/workspace/scripts/consuelo-design.ts`, `packages/workspace/tests/consuelo-design-theme.test.js`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: changed code selected zero suites; add a discoverable test or explicit rule when this is not intentional
