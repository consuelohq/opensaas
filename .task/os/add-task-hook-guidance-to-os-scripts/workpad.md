# add task hook guidance to os scripts

branch: `task/os/add-task-hook-guidance-to-os-scripts`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/951/add-task-hook-guidance-to-os-scripts
github pr: https://github.com/consuelohq/opensaas/pull/951
started: 2026-06-11

## objective

Add tasteful OS task hook plumbing that preserves the existing task-skill wording and gives agents just-in-time command guidance for task workflows, without removing tools from core yet.

## acceptance criteria

- [x] Inspect existing `packages/workspace/hooks` and the task skill wording/source used by the repo.
- [x] Add OS-side hook/script surface for task lifecycle guidance.
- [x] Preserve important task skill phrasing instead of rewriting it into lossy copy.
- [x] Keep the implementation small and reviewable; no tool-manifest shrinking in this task.
- [x] Validate with focused tests or a documented no-test waiver plus syntax/runtime checks if the surface is script-only.

## plan

1. Read existing workspace hooks, OS scripts, manifests, and task skill/package references.
2. Identify the smallest OS hook surface that can provide just-in-time lifecycle guidance.
3. Define a test-first contract before production edits.
4. Implement hook/script plumbing and any minimal package/test wiring.
5. Run focused validation and update this workpad with evidence.

## current status

- Implementation complete.
- Validation passed.
- Ready for task push and PR promotion.

## Test-first contract

Behavior under test:
- OS exposes reusable task-hook guidance that preserves exact task skill anchor wording.
- `after-task-start` guidance returns concrete `os.call` actions using the top-level `taskSession` handle.
- `before-production-edit` guidance blocks production edits until a Test-first contract and red test/no-test waiver exists.
- `unknown-task-tool` guidance uses `tools.search` as recovery when task helpers are gated out of core.

Existing local pattern followed:
- `packages/workspace/hooks/README.md` says hooks live outside `scripts` because scripts, task tooling, and future event pipelines can reuse them.
- OS tests commonly import script/helper modules directly from `packages/os/tests`.

New or changed tests:
- `packages/os/tests/task-hooks.test.ts`

Focused red command:
- `bun --cwd packages/os test tests/task-hooks.test.ts`

Expected red failure:
- Missing module `../hooks/task/guidance`.

Red result:
- Failed as expected with `Cannot find module '../hooks/task/guidance'`.

Green result:
- `bun --cwd packages/os test tests/task-hooks.test.ts` passed: 1 file, 3 tests.

## implementation

- Added `packages/os/hooks/task/guidance.js` as the reusable OS task hook surface.
- Added structured stages:
  - `before-task-start`
  - `after-task-start`
  - `before-production-edit`
  - `before-publish`
  - `unknown-task-tool`
- Preserved exact task skill anchor wording for canonical flow, top-level `taskSession`, scoped workpad, and test-first requirements.
- Added concrete `os.call` action payloads so future server/script surfaces can render or execute just-in-time guidance without making the model guess schemas.
- Added `packages/os/scripts/task-hook.js` CLI wrapper for JSON or markdown guidance output.
- Added `task:hook` package script.
- Replaced `task-start.js` hand-written non-JSON next steps with rendered `after-task-start` hook guidance.
- Added `packages/os/hooks/README.md` mirroring the workspace hook architecture note.

## files changed

- `.task/os/add-task-hook-guidance-to-os-scripts/current.json`
- `.task/os/add-task-hook-guidance-to-os-scripts/evidence-log.json`
- `.task/os/add-task-hook-guidance-to-os-scripts/read-log.json`
- `.task/os/add-task-hook-guidance-to-os-scripts/session.json`
- `.task/os/add-task-hook-guidance-to-os-scripts/verify.json`
- `.task/os/add-task-hook-guidance-to-os-scripts/workpad.md`
- `.task/tasks/os/add-task-hook-guidance-to-os-scripts.json`
- `packages/os/hooks/README.md`
- `packages/os/hooks/task/guidance.js`
- `packages/os/package.json`
- `packages/os/scripts/task-hook.js`
- `packages/os/scripts/task-start.js`
- `packages/os/tests/task-hooks.test.ts`

## validation evidence

- Red: `bun --cwd packages/os test tests/task-hooks.test.ts` failed with missing hook module.
- Green: `bun --cwd packages/os test tests/task-hooks.test.ts` passed: 3 tests.
- CLI smoke: `bun --cwd packages/os ./scripts/task-hook.js after-task-start --area os --task-session tsk_example --worktree-path /tmp/example --json` returned structured guidance with preserved anchors and top-level taskSession actions.
- Package script smoke: `bun run --cwd packages/os task:hook after-task-start --area os --task-session tsk_example --worktree-path /tmp/example --json` passed.
- Syntax: `checkFiles` passed for `guidance.js`, `task-hook.js`, `task-start.js`, and `task-hooks.test.ts`.
- Review: `review.run --base origin/main` passed with 0 issues in this change. It reported one pre-existing `ERROR_HANDLING` warning in `packages/os/scripts/task-start.js` line 267.
- Verify: `verify --base origin/main` passed and wrote a publish-valid stamp. Test selection reported zero suites, but the focused hook test was manually run red/green above.

## key decisions

- Use OS as the stream area because the requested migration target is `packages/os`.
- Do not remove tools from core in this task; only add hooks/guidance plumbing.
- Use a reusable hook module outside scripts, mirroring the workspace hook shape, rather than burying guidance only in a task-start stderr message.
- Keep guidance as a structured data contract plus renderer so the server/Bun runtime can later render, inspect, or automate the next action without copying prose again.
- Use `tools.search` as the explicit unknown-task-tool recovery path for any future core-tool diet.

## notes for ko

- This creates the first OS task hook as an executable guidance surface, not only prose.
- The hook data model is intentionally slightly overbuilt: it separates stable skill anchors, concrete actions, and notes. That lets the server decide later whether to display, validate, or run next-step suggestions.
- The next architecture pass can wire this into manifest/tool-search/core-profile behavior without losing the exact task skill wording.

## improvements noticed

- `task-start.js` still has a pre-existing review warning: async function with await but no try/catch near line 267. I did not expand scope to refactor it.
- Bun invocation shape matters: `bun --cwd packages/os run task:hook ...` printed Bun's generic run help under this executor, but `bun run --cwd packages/os task:hook ...` works.
- `status` with taskSession reported root main/diff-cockpit state instead of the task worktree; I used `git.diff`, review, verify, and task-scoped evidence as truth instead.

## issues and recovery

- Initial workpad write failed because task.start had already created the scoped workpad. Recovery: read the existing generated workpad and force-wrote this scoped workpad content.
- First code.run edit attempt failed on template escaping before any files changed. Recovery: wrote the hook and CLI with direct typed `fs.write` calls.
- First `fs.write` for `packages/os/hooks/task/guidance.js` failed because the directory did not exist. Recovery: retried with `mkdirs: true`.
- Multiline `fs.patch` was rejected as unsafe. Recovery: rewrote the small test file with `fs.write --force`.

## workspace-owned: files changed

- `.task/os/add-task-hook-guidance-to-os-scripts/current.json`
- `.task/os/add-task-hook-guidance-to-os-scripts/evidence-log.json`
- `.task/os/add-task-hook-guidance-to-os-scripts/read-log.json`
- `.task/os/add-task-hook-guidance-to-os-scripts/session.json`
- `.task/os/add-task-hook-guidance-to-os-scripts/verify.json`
- `.task/os/add-task-hook-guidance-to-os-scripts/workpad.md`
- `.task/tasks/os/add-task-hook-guidance-to-os-scripts.json`
- `packages/os/hooks/README.md`
- `packages/os/hooks/task/guidance.js`
- `packages/os/package.json`
- `packages/os/scripts/task-hook.js`
- `packages/os/scripts/task-start.js`
- `packages/os/tests/task-hooks.test.ts`

## workspace-owned: activity log

- 2026-06-11 05:15 fs.write: attempted initial workpad write; existing generated workpad required force overwrite.
- 2026-06-11 05:15 task.start: created task branch and PR.
- 2026-06-11 05:17 task.call red: focused test failed on missing hook module.
- 2026-06-11 05:20 checkFiles: syntax checks passed.
- 2026-06-11 05:20 task.call green: focused test passed.
- 2026-06-11 05:20 task.call smoke: hook CLI returned structured guidance.
- 2026-06-11 05:21 review.run: passed with 0 issues in this change.
- 2026-06-11 05:21 verify: passed publish-valid.
- 2026-06-11 05:22:48 fs.write: `.task/os/add-task-hook-guidance-to-os-scripts/workpad.md`
- 2026-06-11 05:24:52 fs.write: `packages/os/package.json`

---

## publish checklist

```bash
bun run task:push -- --message "feat(os): add task hook guidance surface" --changed
bun run task:pr
```

- 2026-06-11 05:22:48 write: `.task/os/add-task-hook-guidance-to-os-scripts/workpad.md`

## workspace-owned: files read

- `packages/os/package.json`

- 2026-06-11 05:24:52 write: `packages/os/package.json`
