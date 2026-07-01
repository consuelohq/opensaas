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
- A provisioned local OS install materializes `pages/office/index.html`, `pages/office/data/artifacts.json`, and `pages/office/assets/`.
- The Office artifact data is generated from the existing local SQLite `artifacts` table and contains durable artifact metadata rather than mock rows.
- Re-provisioning updates the Office page data without deleting local OS configuration or installed skills.

Existing local pattern to follow:
- `packages/os/tests/install-state.test.ts` exercises the approved local OS home shape and repeatable provisioning with temp `CONSUELO_HOME`.
- `packages/os/tests/artifacts.test.ts` and `packages/os/scripts/lib/artifacts.ts` define the current local artifact table and descriptors.
- Existing workspace facade/tooling tests remain relevant only if this task touches `packages/workspace` compatibility shims.

New or changed tests:
- Add an install-state assertion that creates a real local artifact, re-runs `provisionLocalOs`, and expects the Office page/data files to include that artifact.

Focused red command:
- `bun --cwd packages/os test tests/install-state.test.ts`

Expected red failure:
- Test fails because `pages/office/index.html` and `pages/office/data/artifacts.json` do not exist yet.

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
- Per Ko instruction, first copied the bounded `packages/os/skills` updates from `main`, then Ko requested the worktree be fully current with `main`.
- Stashed the temporary OS skill copy, merged `origin/main` into the task branch, resolved stream/main conflicts by taking the `origin/main` side for conflicted files, and committed merge `074e55f667`.
- Verified `origin/main` is an ancestor of `HEAD` with `git merge-base --is-ancestor origin/main HEAD`.
- Dropped the temporary `pre-main-sync-os-skills` stash after the merge.
- Re-read `packages/os/skills/senior-engineer/SKILL.md` and the updated `packages/os/skills/task/SKILL.md` from the task worktree after the sync.
- `code.run` is currently blocked after the main sync by `Cannot find module './lib/codemode/tools/index'` in `packages/workspace/scripts/code-run.ts`; using `fs.search`, `fs.read`, and focused `task.exec` instead.
- Investigation found the current local artifact DB in `packages/os/scripts/lib/artifacts.ts`, the install/provision boundary in `packages/os/scripts/lib/install-state.ts`, and no existing `pages/office` implementation.
- Next: add the focused red install-state test, run it red, then implement local Office page generation.

## migration map

- `Office` product surface: first local OS surface is `<CONSUELO_HOME>/pages/office/index.html` plus `pages/office/data/artifacts.json` and `pages/office/assets/`.
- `artifacts`: source of truth for the first page is the existing local SQLite `artifacts` table created by `createWorkspaceArtifact()` in `packages/os/scripts/lib/artifacts.ts`.
- `design-wiki` / `/design-wiki`: no existing OS local page route was found; preserve existing workspace/design behavior for now and do not remove legacy names in this slice.
- `design.publish` / `consueloDesign.*`: workspace-owned operator tooling remains untouched in this slice; later compatibility aliases can be added through workspace facade tests if needed.
- boundary decision: OS owns local install-time Office page materialization; workspace scripts stay in `packages/workspace`.

## files changed

- `.task/os/migrate-office-artifacts-surface/workpad.md`
- `packages/os/scripts/lib/install-state.ts`
- `packages/os/scripts/lib/office-pages.ts`
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
- `packages/os/tests/install-state.test.ts`

## workspace-owned: files changed

- `.task/os/migrate-office-artifacts-surface/workpad.md`
- `packages/os/scripts/lib/install-state.ts`
- `packages/os/scripts/lib/office-pages.ts`
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
- `packages/os/tests/install-state.test.ts`

## workspace-owned: activity log

- `fs.read packages/os/skills/senior-engineer/SKILL.md` failed with file missing on `stream/os`.
- `task.exec git checkout main -- packages/os/skills` copied those updates into the task worktree.
- `task.exec git diff --name-status HEAD..main -- packages/os/skills` identified the bounded OS skill update set.
- `task.exec git show main:packages/os/skills/senior-engineer/SKILL.md` confirmed the skill exists on `main`.
- `task.start` created task branch/worktree/PR.
- 2026-06-05 03:48:33 fs.write: `.task/os/migrate-office-artifacts-surface/workpad.md`
- 2026-06-05 03:50:28 fs.patch: `.task/os/migrate-office-artifacts-surface/workpad.md`
- 2026-06-05 03:53:59 fs.patch: `.task/os/migrate-office-artifacts-surface/workpad.md`
- 2026-06-05 03:54:16 fs.patch: `.task/os/migrate-office-artifacts-surface/workpad.md`
- 2026-06-05 03:54:28 fs.patch: `.task/os/migrate-office-artifacts-surface/workpad.md`
- 2026-06-05 03:54:42 fs.patch: `.task/os/migrate-office-artifacts-surface/workpad.md`
- 2026-06-05 03:54:54 fs.patch: `.task/os/migrate-office-artifacts-surface/workpad.md`
- 2026-06-05 03:55:27 fs.patch: `packages/os/tests/install-state.test.ts`
- 2026-06-05 03:56:43 fs.write: `packages/os/scripts/lib/office-pages.ts`
- 2026-06-05 03:56:57 fs.patch: `packages/os/scripts/lib/install-state.ts`
- 2026-06-05 03:57:10 fs.patch: `packages/os/scripts/lib/install-state.ts`
- 2026-06-05 03:57:24 fs.patch: `packages/os/scripts/lib/install-state.ts`
- 2026-06-05 03:57:44 fs.patch: `packages/os/scripts/lib/install-state.ts`
- 2026-06-05 03:58:37 fs.patch: `packages/os/tests/install-state.test.ts`
- 2026-06-05 03:59:26 fs.patch: `.task/os/migrate-office-artifacts-surface/workpad.md`
- 2026-06-05 03:59:40 fs.patch: `.task/os/migrate-office-artifacts-surface/workpad.md`
- 2026-06-05 04:01:09 fs.patch: `packages/os/scripts/lib/office-pages.ts`
- 2026-06-05 04:01:22 fs.patch: `packages/os/scripts/lib/office-pages.ts`
- 2026-06-05 04:04:25 fs.patch: `.task/os/migrate-office-artifacts-surface/workpad.md`

## workspace-owned: validation evidence

- `bun --cwd packages/os test tests/install-state.test.ts` red: failed at `existsSync(officeIndexPath)` because `pages/office/index.html` did not exist.
- `bun --cwd packages/os test tests/install-state.test.ts` green: 1 file, 8 tests passed.
- `bun --cwd packages/os test tests/artifacts.test.ts tests/os-call-artifacts.test.ts tests/install-state.test.ts`: 3 files, 10 tests passed.
- `bun --cwd packages/os typecheck`: workspace script syntax checks passed.
- `bun --cwd packages/os test tests/skills-registry.test.ts tests/tool-manifest.test.ts`: 2 files, 13 tests passed.
- `bun --cwd packages/os generate-skills-registry`: wrote 11 skills and left no registry diff.
- `bun --cwd packages/os test`: failed on existing full-suite runner incompatibilities (`bun:test` / `bun:sqlite` imports under Vitest); 18 files and 606 tests passed before the command exited non-zero.
- `review.run --base origin/stream/os --no-tests` before SQL fix: found the Office SQL guardrail plus two main-sync findings outside the Office files.
- `review.run --base origin/stream/os --no-tests` after SQL fix: Office finding cleared; remaining findings are main-sync files `packages/consuelo-core/src/registry/index.ts` and `packages/diff-cockpit/src/index.ts` when compared to `origin/stream/os`.
- `review.run --base HEAD --no-tests`: 3 Office files, 0 issues.
- `verify --base origin/stream/os --no-review`: failed because the requested main sync makes the affected set include broad Twenty/twenty-shared suites with pre-existing snapshot/coverage failures.
- `verify --base HEAD`: publish-valid for the Office delta and wrote `.task/os/migrate-office-artifacts-surface/verify.json`.

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

- `/Users/kokayi/Downloads/codex-office-artifacts-migration-execution-brief.md`
- `CODING-STANDARDS.md`
- `packages/os/package.json`
- `packages/os/scripts/design/consuelo-design-landing-page.ts`
- `packages/os/scripts/design/consuelo-design.ts`
- `packages/os/scripts/lib/artifacts.ts`
- `packages/os/scripts/lib/install-state.ts`
- `packages/os/scripts/lib/office-pages.ts`
- `packages/os/scripts/lib/runtime-state.ts`
- `packages/os/skills/senior-engineer/SKILL.md`
- `packages/os/skills/task/SKILL.md`
- `packages/os/tests/artifacts.test.ts`
- `packages/os/tests/install-state.test.ts`
- `packages/os/tests/os-call-artifacts.test.ts`

## workspace-owned: test selection

- changed files: `.task/os/migrate-office-artifacts-surface/evidence-log.json`, `.task/os/migrate-office-artifacts-surface/read-log.json`, `.task/os/migrate-office-artifacts-surface/workpad.md`, `packages/os/scripts/lib/install-state.ts`, `packages/os/scripts/lib/office-pages.ts`, `packages/os/tests/install-state.test.ts`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: changed code selected zero suites; add a discoverable test or explicit rule when this is not intentional

- 2026-06-05 04:04:25 patch lines 153-157: `.task/os/migrate-office-artifacts-surface/workpad.md`
