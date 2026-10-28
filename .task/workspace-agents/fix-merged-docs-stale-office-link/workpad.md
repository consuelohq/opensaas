# fix merged docs stale office link

branch: `task/workspace-agents/fix-merged-docs-stale-office-link`
stream: `stream/workspace-agents`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1864/fix-merged-docs-stale-office-link
github pr: https://github.com/consuelohq/opensaas/pull/1864
started: 2026-08-12

## acceptance criteria

- [x] Replace the only remaining user-facing `/build/tools/office/` link with the current Artifacts docs route.
- [x] Preserve the merged nine-section navigation, bundled Skills docs, Memory docs, and 154-tool Tool List parity.
- [x] Documentation validator, Build docs tests, promoted navigation/memory tests, translation test, and production docs build pass before publish.
- [x] Make `stream.sync` temporary worktrees inherit the main worktree's dependency links before verification so the stream can be reconciled with main instead of failing on missing package dependencies.

## plan

1. Reproduce the merged-main CI Docs failure and scan the docs tree for stale Office route references.
2. Replace the stale Tools landing-page link with Artifacts.
3. Run docs validator, Build/navigation tests, translation test, production build, review, and verify.
4. Publish through the task lifecycle, merge the refreshed workspace-agents stream PR to main, and confirm final main CI/docs contracts.

## current status

- The only stale `/build/tools/office/` link was in `tools/index.mdx`; it now points to `/build/tools/artifacts/`.
- Focused and production documentation validation is green. The task PR then exposed a real stream-history integration conflict: `stream/workspace-agents` had not been synced after its squash merge to main because `stream.sync` verification ran in a temporary worktree without dependency links. The sync helper is now fixed locally and covered red → green.

## files changed

- `packages/documentation/src/content/docs/tools/index.mdx`
- `packages/workspace/scripts/stream-sync.js`
- `packages/workspace/tests/stream-sync-node-modules.test.js`
- `packages/workspace/tests/stream-sync-node-modules.test.js`

## workspace-owned: files changed

- `packages/documentation/src/content/docs/tools/index.mdx`
- `packages/workspace/tests/stream-sync-node-modules.test.js`

## workspace-owned: activity log

- 2026-08-12 01:27:46 fs.write: `packages/workspace/tests/stream-sync-node-modules.test.js`

## workspace-owned: validation evidence

- Main CI red evidence: CI Docs run `31553110067` failed at validation because `tools/index.mdx` linked to removed `/build/tools/office/`.
- Green package checks: validator passes 121 selected pages; Build docs 8/8 (480 expectations); foundation + navigation/memory 21/21 (498 expectations); translation test passes. Trace `trc_8dd7def295ae`.
- Clean-copy production Astro/Starlight build passes and indexes 133 HTML files. Trace `trc_9c09ddf17caf`.
- Strict review reports 0 issues owned by this task and 0 blockers. Its two typecheck findings are pre-existing `twenty-sdk/cli` resolution issues outside this one-line docs repair. Trace `trc_66d624c3033c`.
- Stream-sync TDD red: new dependency-link contract failed because `stream-sync.js` did not use `task-node-modules`; trace `trc_86c1c5be31a1`. Green after linking root/package dependencies from the actual main worktree: 3/3 focused workspace tests pass, 14 expectations; trace `trc_f43ef47d5124`.
- Reconciled `stream/workspace-agents` with merged main using the fixed sync script: merge completed with zero conflict files, dependency links were present, the sync verification passed, and the stream was pushed. Trace `trc_50e12728ba96`.
- Post-sync strict review against `origin/main`: 0 owned issues, 0 pre-existing issues, 0 blockers; trace `trc_e8a93419d5f6`.
- Full post-sync verify passed and is `publishValid: true` for exactly the three product files in this repair (`tools/index.mdx`, `stream-sync.js`, and its regression test); trace `trc_0b890a86e216`.
- 2026-08-12 01:21:56 `review.run`: passed — OK
- 2026-08-12 01:25:37 `verify`: passed — OK
- 2026-08-12 01:30:40 `review.run`: passed — OK
- 2026-08-12 01:30:49 `verify`: passed — OK
- 2026-08-12 01:32:28 `review.run`: passed — OK
- 2026-08-12 01:32:38 `verify`: passed — OK

## key decisions

- Keep this as a one-line semantic repair. The merge itself preserved the intended IA and bundled Skills integration; only the Tools landing-page link lagged the Office → Artifacts rename.
- Do not force-push/rebase the diverged stream/task histories. Fix the existing `stream.sync` lifecycle so it can merge main into the stream with its normal verification gate, then retry the task PR against the reconciled stream.

## notes for ko

- Both large streams are already merged on main. This task repairs the one post-merge CI Docs integration failure before final handoff.

## improvements noticed

- none yet

## issues and recovery

- Full `verify` was attempted repeatedly with the correct `origin/main` base after all focused validation passed, but the workspace connector returned upstream 502/network errors before producing a stamp. The user explicitly asked to ship both streams to main and resolve the integration, so publish uses the repository's documented Ko-approved task-push path with this outage and the green focused/build evidence recorded here.
- `task.pr` for PR #1864 correctly refused to merge because the task was started from merged `main` while `stream/workspace-agents` still had its pre-squash commit history. A prior `stream.sync` had merged cleanly but refused to push because its temporary worktree could not resolve `zod`; `stream-sync.js` now links main-worktree `node_modules` before running verify so the existing safe sync path can complete.
- After the sync fix, `stream/workspace-agents` is 0 commits behind main and tree-identical to main before this task's three-file delta. No force push, reset, or history rewrite was used.

---

## publish checklist

```bash
bun run task:push -- --message "type(workspace-agents): description" --changed
bun run task:pr
bun run task:finish
```

## discovery

- CI Docs on merged main failed because `packages/documentation/src/content/docs/tools/index.mdx` still links to removed `/build/tools/office/`.
- Final main integration otherwise verified exact nine-section nav, bundled skills under Skills, Artifacts replacing Office, 154/154 Tool List manifest parity, neutral gray sidebar, and Memory docs.
- This task is a narrow post-merge docs-link repair; validate the full docs check after the edit.

## Test-first contract

- Behavior under test: no public docs page links to removed `/build/tools/office/`, and the full documentation validator/build passes on the merged main content.
- Existing local pattern: `packages/documentation/scripts/validate-documentation.mjs` fails on missing internal routes; Build docs tests also cover superseded Office redirects.
- Focused red evidence: main CI Docs run 31553110067 failed with `src/content/docs/tools/index.mdx links to missing internal route /build/tools/office/`.
- Planned edit: replace the stale Tools landing-page Office link with the current Artifacts page and scan for any remaining user-facing Office route references.
- No-test waiver: none; use validator + Build docs test + production docs build.

- 2026-08-12 01:20:33 apply-patch: `packages/documentation/src/content/docs/tools/index.mdx`

## workspace-owned: files read

- `packages/os/scripts/stream-sync.js`
- `packages/os/skills/task/SKILL.md`
- `packages/workspace/scripts/lib/task-node-modules.js`
- `packages/workspace/scripts/stream-sync.js`
