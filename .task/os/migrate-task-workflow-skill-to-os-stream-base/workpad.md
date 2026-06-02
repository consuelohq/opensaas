# migrate task workflow skill to os

branch: `task/os/migrate-task-workflow-skill-to-os-stream-base-stream-base`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/617/migrate-task-workflow-skill-to-os-stream-base
github pr: https://github.com/consuelohq/opensaas/pull/617
started: 2026-05-28

## acceptance criteria

- [x] Use `stream.context` for area `os`.
- [x] Carry taskSession `tsk_d2841c421ad0` for task-scoped work.
- [x] Add top-level OS skill `task` without creating subskills or deterministic scripts.
- [x] Preserve the full authored `SKILL.md` content.
- [x] Keep canonical tools as `workspace.get_steering` and `workspace.call`.
- [x] Keep `permission: "guidance"` and make OS metadata validation accept guidance skills.
- [x] Validate JSON metadata, YAML frontmatter, full content preservation, focused OS tests, review, and verify recovery path.

## plan

1. Inspect existing OS skills and current validation assumptions.
2. Copy Ko-authored task skill files into the stream task worktree.
3. Keep `SKILL.md` byte-for-byte unchanged from Ko's root copy.
4. Update only metadata validation needed for instruction-only guidance skills.
5. Validate and publish into `stream/os`.

## current status

- Ready to publish from clean stream-based replacement task. Earlier PR #616 was abandoned after task.start bootstrapped it from main and normal non-force sync would have pulled unrelated conflicts. This task started correctly with sourceBranch `stream/os` and startFrom `stream`.

## final OS skill name

- `task`

## files included

- `packages/os/skills/task/SKILL.md`
- `packages/os/skills/task/skill.json`
- `packages/os/scripts/lib/skills.ts`
- `packages/os/scripts/lib/types.ts`

## edits made

- Copied `packages/os/skills/task/SKILL.md` from Ko's root worktree into the task worktree unchanged.
- Copied `packages/os/skills/task/skill.json` from Ko's root worktree.
- Added `guidance` to `PermissionLevel` so instruction-only skills can use `permission: "guidance"`.
- Updated `validateBundledSkills()` so executable skills still validate against `tool-manifest.json`, while guidance skills validate their resource entrypoint, YAML frontmatter, and canonical workspace tools.
- Did not add scripts, subskills, or a generated registry.

## command-name adaptations

- No changes to Ko's canonical tool names.
- `skill.json` tools remain `workspace.get_steering` and `workspace.call`.
- `SKILL.md` content was preserved unchanged, including its task lifecycle command examples.

## validation evidence

- `stream.context` for area `os`: passed, stream `stream/os`.
- `task.start`: created task branch/PR, then recovered base by rebasing onto `origin/stream/os` because the task envelope reported `sourceBranch: main`.
- Metadata/content check: passed. `skill.json` parsed, skill name `task`, permission `guidance`, `SKILL.md` starts with YAML frontmatter, and task worktree `SKILL.md` matches Ko's root copy byte-for-byte.
- `bun --cwd packages/os -e "validateBundledSkills()"`: passed with `issues: 0`.
- `bun --cwd packages/os test tests/install-state.test.ts`: passed, 4 tests.
- `bun --cwd packages/os typecheck`: passed, `workspace script syntax checks passed`.
- `review.run` against `origin/stream/os`: passed, 0 blocking issues.
- `bun packages/workspace/scripts/verify.js --base origin/stream/os --no-review --json --quiet`: passed DB/file-risk guard after direct `review.run` succeeded.

## blocked/recovery details

- `task.start` accepted the task but reported `sourceBranch: main` / `startFrom: main`. Recovered before product edits by fetching and rebasing the task branch onto `origin/stream/os`, then corrected scoped task metadata.
- Initial `verify` failed because it invokes `review.js --summary-json`, and this checkout reports `unknown flag: --summary-json`. This matches the known stale verify path. Recovery: ran `review.run` directly against `origin/stream/os`, then ran `verify.js --no-review` so the remaining guardrails could pass.
- `checkFiles` failed when pointed at `skill.json` because that helper uses `node --check`, which is JavaScript syntax validation rather than JSON validation. JSON validity was proven separately by parsing `skill.json` in the metadata/content check.
- `status` reported the root worktree even with `taskSession`; task-local truth was checked through task-scoped `task.exec git status --short`.

## notes for Ko

- `skills.json` generator was not implemented.
- Public Stream OS spec was not updated because no existing repo convention required spec changes for adding this top-level OS skill.

## publish checklist

```bash
bun run task:push -- --message "feat(os): add task workflow skill" --changed
bun run task:pr
```

- 2026-05-28 19:44:44 write: `.task/os/migrate-task-workflow-skill-to-os-stream-base/workpad.md`

## files changed

- none yet

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-05-28 19:44:44 fs.write: `.task/os/migrate-task-workflow-skill-to-os-stream-base/workpad.md`

## workspace-owned: validation evidence

- `stream.context` for area `os`: passed, stream `stream/os`.
- `task.start`: created task branch/PR, then recovered base by rebasing onto `origin/stream/os` because the task envelope reported `sourceBranch: main`.
- Metadata/content check: passed. `skill.json` parsed, skill name `task`, permission `guidance`, `SKILL.md` starts with YAML frontmatter, and task worktree `SKILL.md` matches Ko's root copy byte-for-byte.
- `bun --cwd packages/os -e "validateBundledSkills()"`: passed with `issues: 0`.
- `bun --cwd packages/os test tests/install-state.test.ts`: passed, 4 tests.
- `bun --cwd packages/os typecheck`: passed, `workspace script syntax checks passed`.
- `review.run` against `origin/stream/os`: passed, 0 blocking issues.
- `bun packages/workspace/scripts/verify.js --base origin/stream/os --no-review --json --quiet`: passed DB/file-risk guard after direct `review.run` succeeded.
- 2026-05-28 19:45:37 `review.run`: passed — OK
- 2026-05-28 19:45:44 `verify`: failed — COMMAND_FAILED
