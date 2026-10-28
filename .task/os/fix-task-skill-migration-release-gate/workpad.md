# fix task skill migration release gate

branch: `task/os/fix-task-skill-migration-release-gate`
stream: `stream/os`
pr: https://github.com/consuelohq/opensaas/pull/2503
started: 2026-09-21

## acceptance criteria

- [x] The workspace task skill source and migration fixture describe `fs.apply_patch` using its supported `patchText`/`patchFile` transport.
- [x] The OS task skill remains identical to the migrated workspace fixture after approved replacements.
- [x] `packages/os/tests/skill-migration.test.ts` goes RED before the fix and GREEN 8/8 after it.
- [ ] Promote into `stream/os`, require the stream CI gate to pass, then resume the canary release/update.

## plan

1. Reproduce the exact skill-migration CI failure.
2. Locate the canonical workspace task source, migration fixture, and OS generated skill.
3. Update only the stale workspace/fixture wording to the supported typed patch tool.
4. Run focused GREEN, promote to the stream, and let stream CI exercise the full package gate before release.

## files changed

- `packages/workspace/task.md` — replace stale `fs.patch` guidance with `fs.apply_patch` + supported payload forms.
- `packages/os/tests/fixtures/skills/task-workspace.SKILL.md` — refresh the canonical migration fixture to match the workspace task source.

## key decisions

- Keep `packages/os/skills/task/SKILL.md` unchanged: it already reflects the actual OS tool surface and was the correct side of the migration mismatch.
- Update the workspace canonical source and fixture together so future migrations do not reintroduce the stale `fs.patch` name.

## notes for ko

- The previous CI rerun confirmed the script-parity blocker is fixed. The remaining deterministic package failure was the task-skill migration guardrail; `local-os-port-cutover.test.ts` passed 10/10 when rerun directly and appears to have been an incidental full-suite failure.
- Focused migration test: RED 1/8 before the edit, GREEN 8/8 after it.

## improvements noticed

- none yet

## errors i ran into

- none yet

---

## publish checklist

```bash
bun run task:push -- --message "type(os): description" --changed
bun run task:pr
bun run task:finish
```

## Test-first contract

behavior under test: the OS task skill remains byte-equivalent to the workspace canonical task skill after only the explicitly approved OS-specific replacements; both skill copies must describe the actually supported typed patch tool.
existing local pattern: `packages/os/tests/skill-migration.test.ts` derives the expected OS skill from the workspace source and compares it byte-for-byte.
new or changed tests: no new test file; use the existing migration guardrail as the regression contract.
focused red command: `cd packages/os && bun run test -- tests/skill-migration.test.ts`
expected red failure: the task-skill assertion shows workspace `fs.patch` versus OS `fs.apply_patch with patchText or patchFile`.
no-test waiver: not applicable.

- 2026-09-21 04:26:20 append: `.task/os/fix-task-skill-migration-release-gate/workpad.md`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-09-21 04:26:20 fs.write: `.task/os/fix-task-skill-migration-release-gate/workpad.md`

## workspace-owned: files read

- `packages/os/tests/skill-migration.test.ts`

- 2026-09-21 04:26:45 apply-patch: `packages/workspace/task.md`
- 2026-09-21 04:26:45 apply-patch: `packages/os/tests/fixtures/skills/task-workspace.SKILL.md`

- 2026-09-21 04:27:07 apply-patch: `.task/os/fix-task-skill-migration-release-gate/workpad.md`