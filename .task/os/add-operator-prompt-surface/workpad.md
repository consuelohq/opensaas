# Add operator prompt surface

branch: `task/os/add-operator-prompt-surface`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/897/add-operator-prompt-surface
github pr: https://github.com/consuelohq/opensaas/pull/897
started: 2026-06-09

## acceptance criteria

- [ ] Define explicit task acceptance criteria before coding.

## plan

1. Read the relevant code and update this plan before editing.

## current status

- Task started. Update this before publish.

## files changed

- `packages/os/scripts/lib/install-state.ts`
- `packages/os/tests/install-state.test.ts`

## workspace-owned: files changed

- `packages/os/scripts/lib/install-state.ts`
- `packages/os/tests/install-state.test.ts`

## workspace-owned: activity log

- 2026-06-09 23:23:58 fs.patch: `packages/os/scripts/lib/install-state.ts`
- 2026-06-09 23:29:54 fs.patch: `packages/os/scripts/lib/install-state.ts`
- 2026-06-09 23:31:05 fs.patch: `packages/os/tests/install-state.test.ts`

## workspace-owned: validation evidence

- 2026-06-09 23:36:17 `review.run`: passed — OK
- 2026-06-09 23:36:30 `verify`: passed — OK

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

## workspace-owned: files read

- `packages/os/scripts/install.ts`
- `packages/os/scripts/lib/install-state.ts`
- `packages/os/tests/install-state.test.ts`

- 2026-06-09 23:31:05 patch lines 160-160: `packages/os/tests/install-state.test.ts`

## workspace-owned: test selection

- changed files: `.task/os/add-operator-prompt-surface/current.json`, `.task/os/add-operator-prompt-surface/evidence-log.json`, `.task/os/add-operator-prompt-surface/read-log.json`, `.task/os/add-operator-prompt-surface/session.json`, `.task/os/add-operator-prompt-surface/workpad.md`, `.task/tasks/os/add-operator-prompt-surface.json`, `operator/README.md`, `operator/operator.ts`, `operator/prompts/review.md`, `package.json`, `packages/os/package.json`, `packages/os/scripts/lib/install-state.ts`, `packages/os/scripts/operator.ts`, `packages/os/tests/install-state.test.ts`, `tests/operator.test.ts`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: changed code selected zero suites; add a discoverable test or explicit rule when this is not intentional
