# Migrate office artifacts surface

branch: `task/os/migrate-office-artifacts-surface`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/767/migrate-office-artifacts-surface
github pr: https://github.com/consuelohq/opensaas/pull/767
started: 2026-06-05

## acceptance criteria

- [ ] Read repo steering, `CODING-STANDARDS.md`, OS task skill, and senior-engineer skill before production edits.
- [ ] Import the missing OS skill updates from `main` into this task worktree so the task and senior-engineer instructions are current.
- [ ] Build a local migration map for Office/artifacts/design-wiki/design facade surfaces before implementation.
- [ ] Add or update guardrail tests/assertions before or alongside implementation.
- [ ] Add the first bounded Office surface/page generation step under the OS-owned local `pages/` direction if investigation confirms the safe edit target.
- [ ] Preserve compatibility for legacy Design Wiki/design publish naming while introducing Office naming.
- [ ] Preserve the OS/workspace boundary: OS owns local runtime/page generation; workspace owns operator tooling unless shared behavior is moved through a shared package with evidence.
- [ ] Validate with focused tests plus review/verify gates matched to the actual change.
- [ ] Publish through task workflow and report the stream PR when ready.

## Test-first contract

Behavior under test:
- OS skill registry metadata should remain valid after syncing missing skill docs/metadata from `main`.
- Office migration changes should be covered by focused assertions that fail if `/office` or page generation is missing, compatibility aliases break, or workspace/OS ownership guardrails regress.

Existing local pattern to follow:
- `packages/os/tests/skills-registry.test.ts` and `packages/os/scripts/generate-skills-registry.ts` for OS skill metadata and registry validation.
- Existing workspace facade/tooling tests for design publish compatibility if the migration touches `packages/workspace` manifest/tool names.
- Existing design wiki/static page generation templates after investigation identifies the current source.

New or changed tests:
- First red target will be selected after the migration map, but it must be one of: OS install/page generation repeatability, Office route/alias behavior, Office publish alias, or workspace/OS boundary guardrail.

Focused red command:
- Pending exact target after investigation. Expected shape: `bun --cwd packages/os test <focused-test>` or the relevant package test command through `task.exec`/`task.call` with `tddPhase: red` if available.

Expected red failure:
- Test fails because the Office surface/alias/page generation/guardrail does not exist yet, rather than because of unrelated setup.

No-test waiver:
- No waiver for the Office migration yet. The `packages/os/skills` sync from `main` is a pre-existing upstream update import; validation replacement is `bun --cwd packages/os generate-skills-registry`, `bun --cwd packages/os test tests/skills-registry.test.ts`, and `bun --cwd packages/os typecheck` after investigation confirms package state.

## plan

1. Recover current OS skill instructions from `main` into the task worktree.
2. Read mandatory standards and skills fully.
3. Use context/search/explore to inventory Office, artifacts, design wiki, design publish, OS pages, local DB, and workspace/OS script boundaries.
4. Write the migration map and implementation sequence in this workpad before production edits.
5. Add or update focused guardrail test/assertion, run it red, then implement the smallest bounded Office change.
6. Run focused green validation, inspect diff, then run review/verify gates against `origin/stream/os` because this task started from stream.
7. Push/promote through task workflow and report the stream PR.

## current status

- Task started from `stream/os` as `task/os/migrate-office-artifacts-surface` with taskSession `tsk_c796b57ce089`.
- Initial `fs.read` of `packages/os/skills/senior-engineer/SKILL.md` failed because `stream/os` lacked the skill.
- Per Ko instruction, compared `HEAD..main -- packages/os/skills` and checked out only `packages/os/skills` from `main` into this task worktree.
- Re-read `packages/os/skills/senior-engineer/SKILL.md` and the updated `packages/os/skills/task/SKILL.md` from the task worktree after the sync.
- Next: run investigation inventory and choose the first focused red test.

## migration map

Pending investigation.

## files changed

- `.task/os/migrate-office-artifacts-surface/workpad.md`
- `packages/os/skills/browser/skill.json`
- `packages/os/skills/browser/SKILL.md`
- `packages/os/skills/debugger/skill.json`
- `packages/os/skills/debugger/SKILL.md`
- `packages/os/skills/handoff/skill.json`
- `packages/os/skills/handoff/SKILL.md`
- `packages/os/skills/research-ingest/skill.json`
- `packages/os/skills/research-ingest/SKILL.md`
- `packages/os/skills/senior-engineer/skill.json`
- `packages/os/skills/senior-engineer/SKILL.md`
- `packages/os/skills/skill-creator/skill.json`
- `packages/os/skills/skill-creator/SKILL.md`
- `packages/os/skills/skills.json`
- `packages/os/skills/task/skill.json`
- `packages/os/skills/task/SKILL.md`

## workspace-owned: files changed

- `.task/os/migrate-office-artifacts-surface/workpad.md`
- `packages/os/skills/browser/skill.json`
- `packages/os/skills/browser/SKILL.md`
- `packages/os/skills/debugger/skill.json`
- `packages/os/skills/debugger/SKILL.md`
- `packages/os/skills/handoff/skill.json`
- `packages/os/skills/handoff/SKILL.md`
- `packages/os/skills/research-ingest/skill.json`
- `packages/os/skills/research-ingest/SKILL.md`
- `packages/os/skills/senior-engineer/skill.json`
- `packages/os/skills/senior-engineer/SKILL.md`
- `packages/os/skills/skill-creator/skill.json`
- `packages/os/skills/skill-creator/SKILL.md`
- `packages/os/skills/skills.json`
- `packages/os/skills/task/skill.json`
- `packages/os/skills/task/SKILL.md`

## workspace-owned: activity log

- `fs.read packages/os/skills/senior-engineer/SKILL.md` failed with file missing on `stream/os`.
- `task.exec git checkout main -- packages/os/skills` copied those updates into the task worktree.
- `task.exec git diff --name-status HEAD..main -- packages/os/skills` identified the bounded OS skill update set.
- `task.exec git show main:packages/os/skills/senior-engineer/SKILL.md` confirmed the skill exists on `main`.
- `task.start` created task branch/worktree/PR.
- 2026-06-05 03:48:33 fs.write: `.task/os/migrate-office-artifacts-surface/workpad.md`

## workspace-owned: validation evidence

- none yet

## key decisions

- Treat the missing senior-engineer skill as drift between `main` and `stream/os`, then import only `packages/os/skills` updates from `main` to satisfy the mandatory process without broad branch sync.
- Keep this task OS-led because the brief centers local OS Office pages and artifact surfaces; workspace/design tooling changes must remain compatibility shims or shared-boundary work.
- Use `origin/stream/os` as the validation/review base because the task was started from `stream/os`.

## notes for ko

- The exact senior-engineer path was absent on `stream/os` but present on `main`; it is now present in this task worktree.
- The generic `status` tool reported the root checkout instead of the task worktree for this session; scoped `task.exec git status --short -- packages/os/skills ...` verified the task changes. Treat this as a workspace facade routing gap if it recurs.

## improvements noticed

- `fs.read` currently cannot combine `taskSession` with an explicit branch, and also requires `taskSession`; branch reads needed focused `task.exec git show` as a fallback inside the workspace facade.

## issues and recovery

- Issue: initial task start used `startFrom: stream` before reading the updated task skill that says prefer `startFrom: main` unless explicit. Recovery: Ko explicitly directed getting main updates into the worktree; copied the bounded `packages/os/skills` updates from `main` rather than restarting the task.
- Issue: `fs.search` requires `pattern`, not `query`. Recovery: retried with correct schema.
- Issue: `fs.list pattern` is an `fd` regex, so `*senior*` failed. Recovery: retried with `senior`.

---

## publish checklist

```bash
bun run task:push -- --message "type(os): description" --changed
bun run task:pr
bun run task:finish
```

## workspace-owned: files read

- `CODING-STANDARDS.md`
- `packages/os/skills/task/SKILL.md`
- `packages/os/skills/senior-engineer/SKILL.md`
- `/Users/kokayi/Downloads/codex-office-artifacts-migration-execution-brief.md` (non-repo fallback read before task area was known)

- 2026-06-05 03:48:33 write: `.task/os/migrate-office-artifacts-surface/workpad.md`
