# ship explicit runtime queue id

branch: `task/dialer/ship-explicit-runtime-queue-id`
stream: `stream/dialer`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/417/ship-explicit-runtime-queue-id
github pr: https://github.com/consuelohq/opensaas/pull/417
started: 2026-05-21

## acceptance criteria

- [ ] Define explicit task acceptance criteria before coding.

## plan

1. Read the relevant code and update this plan before editing.

## files changed

- none yet

## key decisions

- none yet

## notes for ko

- none yet

## improvements noticed

- none yet

## errors i ran into

- none yet

---

## publish checklist

```bash
bun run task:push -- --message "type(dialer): description" --changed
bun run task:pr
bun run task:finish
```
