# fix reader shell rail drawer labels

branch: `task/workspace-agents/fix-reader-shell-rail-drawer-labels`
stream: `stream/workspace-agents`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/930/fix-reader-shell-rail-drawer-labels
github pr: https://github.com/consuelohq/opensaas/pull/930
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

- 2026-06-10 05:59:52 fs.write: `packages/consuelo-design/scripts/render-consuelo-reader.ts`
- 2026-06-10 06:00:11 fs.write: `packages/consuelo-design/scripts/render-consuelo-reader.test.ts`
- 2026-06-10 06:00:27 fs.write: `packages/consuelo-design/templates/digital-eguides/reader-shell.md`
- 2026-06-10 06:00:28 fs.write: `packages/os/skills/consuelo-design/references/agents.md`
- 2026-06-10 06:04:08 fs.write: `packages/consuelo-design/scripts/render-consuelo-reader.ts`
- 2026-06-10 06:04:08 fs.write: `packages/consuelo-design/scripts/render-consuelo-reader.test.ts`
- 2026-06-10 06:04:09 fs.write: `packages/consuelo-design/templates/digital-eguides/reader-shell.md`

## workspace-owned: validation evidence

- 2026-06-10 06:06:31 `checkFiles`: passed — OK
- 2026-06-10 06:07:22 `verify`: passed — OK

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
- `packages/consuelo-design/templates/digital-eguides/spec.md`
- `packages/os/skills/consuelo-design/references/agents.md`
- `packages/workspace/scripts/consuelo-design.ts`

- 2026-06-10 06:04:09 write: `packages/consuelo-design/templates/digital-eguides/reader-shell.md`

## workspace-owned: test selection

- changed files: `.task/tasks/workspace-agents/fix-reader-shell-rail-drawer-labels.json`, `.task/workspace-agents/fix-reader-shell-rail-drawer-labels/current.json`, `.task/workspace-agents/fix-reader-shell-rail-drawer-labels/evidence-log.json`, `.task/workspace-agents/fix-reader-shell-rail-drawer-labels/read-log.json`, `.task/workspace-agents/fix-reader-shell-rail-drawer-labels/session.json`, `.task/workspace-agents/fix-reader-shell-rail-drawer-labels/workpad.md`, `packages/consuelo-design/scripts/render-consuelo-reader.test.ts`, `packages/consuelo-design/scripts/render-consuelo-reader.ts`, `packages/consuelo-design/templates/digital-eguides/reader-shell.md`, `packages/os/skills/consuelo-design/references/agents.md`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: changed code selected zero suites; add a discoverable test or explicit rule when this is not intentional
