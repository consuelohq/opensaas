# rename-agent-tdd-page-title

branch: `task/os/rename-agent-tdd-page-title`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/862/rename-agent-tdd-page-title
github pr: https://github.com/consuelohq/opensaas/pull/862
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

- 2026-06-09 04:55:38 fs.write: `.task/os/rename-agent-tdd-page-title/workpad.md`

## workspace-owned: validation evidence

- none yet

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

## final change

- Renamed the Mintlify page display title from `Test-driven agent work` to `Test Driven Development`.
- Updated the H1 in the English OS page and all localized fallback MDX pages.
- Updated `validate-os-docs.ts` to assert the new title.

## validation

- `bun packages/consuelo-docs/scripts/validate-os-docs.ts` passed.
- `git diff --check` passed.

- 2026-06-09 04:55:38 append: `.task/os/rename-agent-tdd-page-title/workpad.md`
