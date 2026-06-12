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
- 2026-06-11 05:27:10 fs.write: `.task/os/add-task-hook-guidance-to-os-scripts/workpad.md`

## conflict resolution after first task.pr attempt

- First `task.pr` failed because PR #951 had non-metadata merge conflicts against `stream/os`.
- Fetched and merged `origin/stream/os` into the task branch.
- Conflict was in `packages/os/package.json`; resolved by keeping stream's `operator` and `doctor:watch` scripts plus this task's new `task:hook` script.
- Merge commit: `88a8922fbf merge stream/os into task hook guidance`.
- Re-ran focused test after merge: `bun --cwd packages/os test tests/task-hooks.test.ts` passed, 3 tests.
- Re-ran package script smoke after merge: `bun run --cwd packages/os task:hook after-task-start --area os --task-session tsk_example --worktree-path /tmp/example --json` passed.
- Re-ran syntax checks after merge: JS/TS files passed; `package.json` was validated separately with `JSON.parse` because `node --check` is not valid for JSON files.
- Re-ran review against `origin/stream/os`: passed with 0 issues in this change and 3 pre-existing ERROR_HANDLING warnings.
- Re-ran verify against `origin/stream/os`: publish-valid.

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

## workspace-owned: validation evidence

- Red: `bun --cwd packages/os test tests/task-hooks.test.ts` failed with missing hook module.
- Green: `bun --cwd packages/os test tests/task-hooks.test.ts` passed: 3 tests.
- CLI smoke: `bun --cwd packages/os ./scripts/task-hook.js after-task-start --area os --task-session tsk_example --worktree-path /tmp/example --json` returned structured guidance with preserved anchors and top-level taskSession actions.
- Package script smoke: `bun run --cwd packages/os task:hook after-task-start --area os --task-session tsk_example --worktree-path /tmp/example --json` passed.
- Syntax: `checkFiles` passed for `guidance.js`, `task-hook.js`, `task-start.js`, and `task-hooks.test.ts`.
- Review: `review.run --base origin/main` passed with 0 issues in this change. It reported one pre-existing `ERROR_HANDLING` warning in `packages/os/scripts/task-start.js` line 267.
- Verify: `verify --base origin/main` passed and wrote a publish-valid stamp. Test selection reported zero suites, but the focused hook test was manually run red/green above.
- 2026-06-11 05:26:13 `checkFiles`: failed — COMMAND_FAILED
- 2026-06-11 05:26:26 `checkFiles`: passed — OK
- 2026-06-11 05:26:42 `review.run`: passed — OK
- 2026-06-11 05:26:53 `verify`: passed — OK

## workspace-owned: test selection

- changed files: `.task/design/followup/current.json`, `.task/design/followup/session.json`, `.task/design/followup/verify.json`, `.task/design/followup/workpad.md`, `.task/design/loops/current.json`, `.task/design/loops/evidence-log.json`, `.task/design/loops/read-log.json`, `.task/design/loops/session.json`, `.task/design/loops/verify.json`, `.task/design/loops/workpad.md`, `.task/design/match-sites-launcher-copy-and-theme/current.json`, `.task/design/match-sites-launcher-copy-and-theme/evidence-log.json`, `.task/design/match-sites-launcher-copy-and-theme/read-log.json`, `.task/design/match-sites-launcher-copy-and-theme/session.json`, `.task/design/match-sites-launcher-copy-and-theme/verify.json`, `.task/design/match-sites-launcher-copy-and-theme/workpad.md`, `.task/design/mobile/current.json`, `.task/design/mobile/evidence-log.json`, `.task/design/mobile/read-log.json`, `.task/design/mobile/session.json`, `.task/design/mobile/verify.json`, `.task/design/mobile/workpad.md`, `.task/design/polish-sites-launcher-typography-and-route-urls/current.json`, `.task/design/polish-sites-launcher-typography-and-route-urls/evidence-log.json`, `.task/design/polish-sites-launcher-typography-and-route-urls/read-log.json`, `.task/design/polish-sites-launcher-typography-and-route-urls/session.json`, `.task/design/polish-sites-launcher-typography-and-route-urls/verify.json`, `.task/design/polish-sites-launcher-typography-and-route-urls/workpad.md`, `.task/design/repair-sites-routes/current.json`, `.task/design/repair-sites-routes/evidence-log.json`, `.task/design/repair-sites-routes/read-log.json`, `.task/design/repair-sites-routes/session.json`, `.task/design/repair-sites-routes/verify.json`, `.task/design/repair-sites-routes/workpad.md`, `.task/design/route-launcher-project-paths-to-targets/current.json`, `.task/design/route-launcher-project-paths-to-targets/evidence-log.json`, `.task/design/route-launcher-project-paths-to-targets/read-log.json`, `.task/design/route-launcher-project-paths-to-targets/session.json`, `.task/design/route-launcher-project-paths-to-targets/verify.json`, `.task/design/route-launcher-project-paths-to-targets/workpad.md`, `.task/design/route-project-path-through-local-server/current.json`, `.task/design/route-project-path-through-local-server/session.json`, `.task/design/route-project-path-through-local-server/verify.json`, `.task/design/route-project-path-through-local-server/workpad.md`, `.task/design/serve-launcher-local-project-routes/current.json`, `.task/design/serve-launcher-local-project-routes/evidence-log.json`, `.task/design/serve-launcher-local-project-routes/read-log.json`, `.task/design/serve-launcher-local-project-routes/session.json`, `.task/design/serve-launcher-local-project-routes/verify.json`, `.task/design/serve-launcher-local-project-routes/workpad.md`, `.task/diff-cockpit/fix-mobile-table-rows/current.json`, `.task/diff-cockpit/fix-mobile-table-rows/session.json`, `.task/diff-cockpit/fix-mobile-table-rows/verify.json`, `.task/diff-cockpit/fix-mobile-table-rows/workpad.md`, `.task/diff-cockpit/fix-review-page-commit-popovers-and-hunk-chrome/verify.json`, `.task/diff-cockpit/mobile-inbox-backlog/current.json`, `.task/diff-cockpit/mobile-inbox-backlog/session.json`, `.task/diff-cockpit/mobile-inbox-backlog/verify.json`, `.task/diff-cockpit/mobile-inbox-backlog/workpad.md`, `.task/diff-cockpit/mobile-table-inbox/current.json`, `.task/diff-cockpit/mobile-table-inbox/session.json`, `.task/diff-cockpit/mobile-table-inbox/verify.json`, `.task/diff-cockpit/mobile-table-inbox/workpad.md`, `.task/diff-cockpit/polish-review-page-controls/verify.json`, `.task/os/add-task-hook-guidance-to-os-scripts/current.json`, `.task/os/add-task-hook-guidance-to-os-scripts/evidence-log.json`, `.task/os/add-task-hook-guidance-to-os-scripts/read-log.json`, `.task/os/add-task-hook-guidance-to-os-scripts/session.json`, `.task/os/add-task-hook-guidance-to-os-scripts/verify.json`, `.task/os/add-task-hook-guidance-to-os-scripts/workpad.md`, `.task/security/fix-atomic-auth-store-writes/current.json`, `.task/security/fix-atomic-auth-store-writes/evidence-log.json`, `.task/security/fix-atomic-auth-store-writes/read-log.json`, `.task/security/fix-atomic-auth-store-writes/session.json`, `.task/security/fix-atomic-auth-store-writes/verify.json`, `.task/security/fix-atomic-auth-store-writes/workpad.md`, `.task/security/fix-gateway-review-final-follow-up/current.json`, `.task/security/fix-gateway-review-final-follow-up/evidence-log.json`, `.task/security/fix-gateway-review-final-follow-up/read-log.json`, `.task/security/fix-gateway-review-final-follow-up/session.json`, `.task/security/fix-gateway-review-final-follow-up/status.txt`, `.task/security/fix-gateway-review-final-follow-up/verify.json`, `.task/security/fix-gateway-review-final-follow-up/workpad.md`, `.task/security/fix-gateway-review-follow-up/current.json`, `.task/security/fix-gateway-review-follow-up/evidence-log.json`, `.task/security/fix-gateway-review-follow-up/read-log.json`, `.task/security/fix-gateway-review-follow-up/session.json`, `.task/security/fix-gateway-review-follow-up/verify.json`, `.task/security/fix-gateway-review-follow-up/workpad.md`, `.task/security/fix-public-gateway-security-review-comments/current.json`, `.task/security/fix-public-gateway-security-review-comments/evidence-log.json`, `.task/security/fix-public-gateway-security-review-comments/read-log.json`, `.task/security/fix-public-gateway-security-review-comments/session.json`, `.task/security/fix-public-gateway-security-review-comments/verify.json`, `.task/security/fix-public-gateway-security-review-comments/workpad.md`, `.task/security/implement-public-gateway-security/current.json`, `.task/security/implement-public-gateway-security/evidence-log.json`, `.task/security/implement-public-gateway-security/read-log.json`, `.task/security/implement-public-gateway-security/session.json`, `.task/security/implement-public-gateway-security/verify.json`, `.task/security/implement-public-gateway-security/workpad.md`, `.task/security/make-cloudflare-workspace-gateway-contracts-green/current.json`, `.task/security/make-cloudflare-workspace-gateway-contracts-green/evidence-log.json`, `.task/security/make-cloudflare-workspace-gateway-contracts-green/read-log.json`, `.task/security/make-cloudflare-workspace-gateway-contracts-green/session.json`, `.task/security/make-cloudflare-workspace-gateway-contracts-green/workpad.md`, `.task/security/move-workspace-gateway-ownership-to-os/current.json`, `.task/security/move-workspace-gateway-ownership-to-os/evidence-log.json`, `.task/security/move-workspace-gateway-ownership-to-os/read-log.json`, `.task/security/move-workspace-gateway-ownership-to-os/session.json`, `.task/security/move-workspace-gateway-ownership-to-os/workpad.md`, `.task/security/write-cloudflare-workspace-gateway-contract-tests/current.json`, `.task/security/write-cloudflare-workspace-gateway-contract-tests/evidence-log.json`, `.task/security/write-cloudflare-workspace-gateway-contract-tests/read-log.json`, `.task/security/write-cloudflare-workspace-gateway-contract-tests/session.json`, `.task/security/write-cloudflare-workspace-gateway-contract-tests/workpad.md`, `.task/tasks/design/followup.json`, `.task/tasks/design/loops.json`, `.task/tasks/design/match-sites-launcher-copy-and-theme.json`, `.task/tasks/design/mobile.json`, `.task/tasks/design/polish-sites-launcher-typography-and-route-urls.json`, `.task/tasks/design/repair-sites-routes.json`, `.task/tasks/design/route-launcher-project-paths-to-targets.json`, `.task/tasks/design/route-project-path-through-local-server.json`, `.task/tasks/design/serve-launcher-local-project-routes.json`, `.task/tasks/diff-cockpit/fix-mobile-table-rows.json`, `.task/tasks/diff-cockpit/mobile-inbox-backlog.json`, `.task/tasks/diff-cockpit/mobile-table-inbox.json`, `.task/tasks/os/add-task-hook-guidance-to-os-scripts.json`, `.task/tasks/security/fix-atomic-auth-store-writes.json`, `.task/tasks/security/fix-gateway-review-final-follow-up.json`, `.task/tasks/security/fix-gateway-review-follow-up.json`, `.task/tasks/security/fix-public-gateway-security-review-comments.json`, `.task/tasks/security/implement-public-gateway-security.json`, `.task/tasks/security/make-cloudflare-workspace-gateway-contracts-green.json`, `.task/tasks/security/move-workspace-gateway-ownership-to-os.json`, `.task/tasks/security/write-cloudflare-workspace-gateway-contract-tests.json`, `packages/diff-cockpit/src/index.ts`, `packages/diff-cockpit/tests/diff-cockpit.test.ts`, `packages/os/hooks/README.md`, `packages/os/hooks/task/guidance.js`, `packages/os/package.json`, `packages/os/scripts/lib/install-state.ts`, `packages/os/scripts/lib/security-gateway.ts`, `packages/os/scripts/lib/workspace-cloudflare-gateway.ts`, `packages/os/scripts/server.ts`, `packages/os/scripts/task-hook.js`, `packages/os/scripts/task-start.js`, `packages/os/tests/os-raw-steering.test.ts`, `packages/os/tests/security-gateway.test.ts`, `packages/os/tests/task-hooks.test.ts`, `packages/os/tests/workspace-cloudflare-gateway-contract.test.ts`, `packages/os/tests/workspace-gateway-contract.test.ts`, `packages/workspace/scripts/consuelo-design.ts`, `packages/workspace/tests/consuelo-design-theme.test.js`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: changed code selected zero suites; add a discoverable test or explicit rule when this is not intentional


- 2026-06-11 05:27:10 write: `.task/os/add-task-hook-guidance-to-os-scripts/workpad.md`
