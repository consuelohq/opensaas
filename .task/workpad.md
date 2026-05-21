# fix contact ids

branch: `task/dialer/fix-contact-ids`
stream: `stream/dialer`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/427/fix-contact-ids
github pr: https://github.com/consuelohq/opensaas/pull/427
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
