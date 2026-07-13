# fix reader mobile nav header dark task text

branch: `task/workspace-agents/fix-reader-mobile-nav-header-dark-task-text`
stream: `stream/workspace-agents`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/937/fix-reader-mobile-nav-header-dark-task-text
github pr: https://github.com/consuelohq/opensaas/pull/937
started: 2026-06-10

## acceptance criteria

- [ ] Define explicit task acceptance criteria before coding.

## plan

1. Read the relevant code and update this plan before editing.

## current status

- Task started. Update this before publish.

## files changed

- `packages/consuelo-design/scripts/render-consuelo-reader.test.ts`
- `packages/consuelo-design/scripts/render-consuelo-reader.ts`
- `packages/consuelo-design/templates/digital-eguides/reader-shell.md`
- `packages/os/skills/consuelo-design/references/agents.md`

## workspace-owned: files changed

- `packages/consuelo-design/scripts/render-consuelo-reader.test.ts`
- `packages/consuelo-design/scripts/render-consuelo-reader.ts`
- `packages/consuelo-design/templates/digital-eguides/reader-shell.md`
- `packages/os/skills/consuelo-design/references/agents.md`

## workspace-owned: activity log

- 2026-06-10 06:45:18 fs.write: `packages/consuelo-design/scripts/render-consuelo-reader.ts`
- 2026-06-10 06:45:19 fs.write: `packages/consuelo-design/scripts/render-consuelo-reader.test.ts`
- 2026-06-10 06:45:55 fs.write: `packages/consuelo-design/scripts/render-consuelo-reader.test.ts`
- 2026-06-10 06:47:52 fs.write: `packages/consuelo-design/templates/digital-eguides/reader-shell.md`
- 2026-06-10 06:47:53 fs.write: `packages/os/skills/consuelo-design/references/agents.md`

## workspace-owned: validation evidence

- 2026-06-10 06:48:19 `checkFiles`: passed — OK
- 2026-06-10 06:49:00 `verify`: passed — OK

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
bun run task:push -- --message "type(workspace-agents): description" --changed
bun run task:pr
bun run task:finish
```

## workspace-owned: files read

- `packages/consuelo-design/scripts/render-consuelo-reader.test.ts`
- `packages/consuelo-design/scripts/render-consuelo-reader.ts`
- `packages/consuelo-design/templates/digital-eguides/reader-shell.md`
- `packages/os/skills/consuelo-design/references/agents.md`

- 2026-06-10 06:47:53 write: `packages/os/skills/consuelo-design/references/agents.md`

## workspace-owned: test selection

- changed files: `.task/tasks/workspace-agents/fix-reader-mobile-nav-header-dark-task-text.json`, `.task/workspace-agents/fix-reader-mobile-nav-header-dark-task-text/current.json`, `.task/workspace-agents/fix-reader-mobile-nav-header-dark-task-text/evidence-log.json`, `.task/workspace-agents/fix-reader-mobile-nav-header-dark-task-text/read-log.json`, `.task/workspace-agents/fix-reader-mobile-nav-header-dark-task-text/session.json`, `.task/workspace-agents/fix-reader-mobile-nav-header-dark-task-text/workpad.md`, `packages/consuelo-design/scripts/render-consuelo-reader.test.ts`, `packages/consuelo-design/scripts/render-consuelo-reader.ts`, `packages/consuelo-design/templates/digital-eguides/reader-shell.md`, `packages/os/skills/consuelo-design/references/agents.md`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: changed code selected zero suites; add a discoverable test or explicit rule when this is not intentional
