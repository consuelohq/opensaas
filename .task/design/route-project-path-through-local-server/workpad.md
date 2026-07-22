# route project path through local server

branch: `task/design/route-project-path-through-local-server`
stream: `stream/design`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/933/route-project-path-through-local-server
github pr: https://github.com/consuelohq/opensaas/pull/933
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

- 2026-06-10 06:18:19 fs.patch: `packages/workspace/tests/consuelo-design-theme.test.js`

## workspace-owned: validation evidence

- 2026-06-10 06:19:43 `review.run`: passed — OK
- 2026-06-10 06:20:02 `verify`: passed — OK

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

- 2026-06-10 06:18:19 patch lines 168-168: `packages/workspace/tests/consuelo-design-theme.test.js`

## workspace-owned: test selection

- changed files: `.task/design/route-project-path-through-local-server/current.json`, `.task/design/route-project-path-through-local-server/session.json`, `.task/design/route-project-path-through-local-server/workpad.md`, `.task/tasks/design/route-project-path-through-local-server.json`, `packages/workspace/scripts/consuelo-design.ts`, `packages/workspace/tests/consuelo-design-theme.test.js`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: changed code selected zero suites; add a discoverable test or explicit rule when this is not intentional
