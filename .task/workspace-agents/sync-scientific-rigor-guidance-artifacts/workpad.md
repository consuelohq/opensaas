# sync-scientific-rigor-guidance-artifacts

branch: `task/workspace-agents/sync-scientific-rigor-guidance-artifacts`
stream: `stream/workspace-agents`
pr: https://github.com/consuelohq/opensaas/pull/2429
started: 2026-09-10

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

## Test-first contract

behavior under test: the authoritative Workspace senior-engineer guidance, the bundled OS senior-engineer skill, and its synchronized fixture must contain the same scientific/mathematical rigor guidance; task read-log metadata must remain valid JSON.
existing local pattern: `packages/os/tests/senior-engineer-skill.test.ts` enforces source/bundle/fixture synchronization.
new or changed tests: prefer the existing synchronization contract; add only a focused read-log parse assertion if no existing task-state contract covers malformed logs.
focused red command: `bun test packages/os/tests/senior-engineer-skill.test.ts` before production edits.
expected red failure: synchronization assertion identifies the Workspace-only scientific-rigor section missing from the bundle/fixture.
no-test waiver: none.

- 2026-09-10 00:40:43 append: `.task/workspace-agents/sync-scientific-rigor-guidance-artifacts/workpad.md`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-09-10 00:40:43 fs.write: `.task/workspace-agents/sync-scientific-rigor-guidance-artifacts/workpad.md`
- 2026-09-10 00:41:43 fs.write: `.task/workspace-agents/sync-scientific-rigor-guidance-artifacts/workpad.md`

## workspace-owned: files read

- `packages/os/tests/senior-engineer-skill.test.ts`

## implementation + validation evidence

- RED: `bun test packages/os/tests/senior-engineer-skill.test.ts` failed because the Workspace source's rigor section was absent from the synchronized fixture.
- First repair exposed an intentional contract difference: the installed OS skill carries OS-specific `memory` operation wording, so it must not be wholesale-replaced by the Workspace source.
- Final repair: exact Workspace source mirrored into the fixture; only the missing rigor section inserted into the existing OS skill; original task read-log rebuilt as valid JSON with its observed workpad/source paths.
- GREEN: senior-engineer skill contract 3/3; repaired read-log parses and contains no NUL bytes.
- Product/runtime behavior unchanged; this is guidance + task-metadata repair only.

- 2026-09-10 00:41:43 append: `.task/workspace-agents/sync-scientific-rigor-guidance-artifacts/workpad.md`

## workspace-owned: validation evidence

- 2026-09-10 00:47:37 `review.run`: passed — OK
- 2026-09-10 00:47:37 `review.run`: passed — OK
- 2026-09-10 00:47:38 `review.run`: passed — OK
- 2026-09-10 00:50:42 `verify`: passed — OK
