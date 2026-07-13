# route launcher project paths to targets

branch: `task/design/route-launcher-project-paths-to-targets`
stream: `stream/design`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/932/route-launcher-project-paths-to-targets
github pr: https://github.com/consuelohq/opensaas/pull/932
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

- 2026-06-10 06:11:11 fs.patch: `packages/workspace/tests/consuelo-design-theme.test.js`

## workspace-owned: validation evidence

- 2026-06-10 06:14:04 `review.run`: passed — OK
- 2026-06-10 06:14:20 `verify`: passed — OK

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

- 2026-06-10 06:11:11 patch lines 169-169: `packages/workspace/tests/consuelo-design-theme.test.js`

## workspace-owned: test selection

- changed files: `.task/design/route-launcher-project-paths-to-targets/current.json`, `.task/design/route-launcher-project-paths-to-targets/evidence-log.json`, `.task/design/route-launcher-project-paths-to-targets/read-log.json`, `.task/design/route-launcher-project-paths-to-targets/session.json`, `.task/design/route-launcher-project-paths-to-targets/workpad.md`, `.task/tasks/design/route-launcher-project-paths-to-targets.json`, `packages/workspace/scripts/consuelo-design.ts`, `packages/workspace/tests/consuelo-design-theme.test.js`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: changed code selected zero suites; add a discoverable test or explicit rule when this is not intentional
