# fix PR 2310 unsupported fs patch guidance

branch: `task/os/fix-pr-2310-unsupported-fs-patch-guidance`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/2340/fix-pr-2310-unsupported-fs-patch-guidance
github pr: https://github.com/consuelohq/opensaas/pull/2340
started: 2026-08-31

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

- 2026-08-31 21:44:57 fs.write: `.task/os/fix-pr-2310-unsupported-fs-patch-guidance/workpad.md`
- 2026-08-31 21:47:09 fs.write: `.task/os/fix-pr-2310-unsupported-fs-patch-guidance/workpad.md`

## workspace-owned: validation evidence

- 2026-08-31 21:46:46 `review.run`: passed — OK

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

- `packages/os/skills/task/SKILL.md`
- `packages/os/tests/session-integration-guidance.test.ts`

## Test-first contract

behavior under test: canonical task guidance never recommends the unsupported fs.patch tool
existing local pattern: session-integration-guidance.test.ts owns task-skill contract assertions
new or changed tests: reject fs.patch and require fs.apply_patch with patchText or patchFile
focused red command: bun test packages/os/tests/session-integration-guidance.test.ts -t "recommends supported typed patch transport"
expected red failure: SKILL.md still contains fs.patch
no-test waiver: not applicable

- 2026-08-31 21:44:57 append: `.task/os/fix-pr-2310-unsupported-fs-patch-guidance/workpad.md`

- 2026-08-31 21:45:14 apply-patch: `packages/os/tests/session-integration-guidance.test.ts`
- 2026-08-31 21:45:51 apply-patch: `packages/os/skills/task/SKILL.md`

## Implementation evidence

- Codex review thread: `PRRT_kwDORPzu_c6d4k5w`.
- Red: `trc_6769631f7edc` — canonical task guidance still contained `fs.patch`.
- Focused green: `trc_726dbc89729e`.
- Guidance suite: `trc_eb99ae36cc8d` — 5 passed, 0 failed.
- Typecheck: `trc_46f336c4e24f`.
- Strict review: `trc_61443169a545` — zero blockers; one nonblocking public-doc mapping opportunity because bundled skill text changed.

- 2026-08-31 21:47:09 append: `.task/os/fix-pr-2310-unsupported-fs-patch-guidance/workpad.md`
