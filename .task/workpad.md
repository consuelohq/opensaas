# add fs write content file support

branch: `task/workspace-agents/add-fs-write-content-file-support`
stream: `stream/workspace-agents`
pr: https://github.com/consuelohq/opensaas/pull/395
started: 2026-05-13

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
bun run task:push -- --message "type(workspace-agents): description" --changed
bun run task:pr
bun run task:finish
```

## fs.write contentFile implementation

- [x] Reproduced multiline inline patch failure and `fs.write --content-file` gap before editing.
- [x] Added file-backed payload routing to `fs.write`.
- [x] Kept `fs.patch` multiline guard and content-file path covered by tests.
- [ ] Regenerate docs/types and run validation.
