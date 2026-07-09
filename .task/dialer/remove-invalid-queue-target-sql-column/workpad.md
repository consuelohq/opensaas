# remove invalid queue target sql column

branch: `task/dialer/remove-invalid-queue-target-sql-column`
stream: `stream/dialer`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/561/remove-invalid-queue-target-sql-column
github pr: https://github.com/consuelohq/opensaas/pull/561
started: 2026-05-24

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
bun run task:push -- --message "type(dialer): description" --changed
bun run task:pr
bun run task:finish
```
