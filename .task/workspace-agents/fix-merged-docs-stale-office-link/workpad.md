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

## plan

1. Reproduce the merged-main CI Docs failure and scan the docs tree for stale Office route references.
2. Replace the stale Tools landing-page link with Artifacts.
3. Run docs validator, Build/navigation tests, translation test, production build, review, and verify.
4. Publish through the task lifecycle, merge the refreshed workspace-agents stream PR to main, and confirm final main CI/docs contracts.

## current status

- The only stale `/build/tools/office/` link was in `tools/index.mdx`; it now points to `/build/tools/artifacts/`.
- Focused and production documentation validation is green. Ready for review/verify and publish.

## files changed

- `packages/documentation/src/content/docs/tools/index.mdx`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- none yet

## workspace-owned: validation evidence

- Main CI red evidence: CI Docs run `31553110067` failed at validation because `tools/index.mdx` linked to removed `/build/tools/office/`.
- Green package checks: validator passes 121 selected pages; Build docs 8/8 (480 expectations); foundation + navigation/memory 21/21 (498 expectations); translation test passes. Trace `trc_8dd7def295ae`.
- Clean-copy production Astro/Starlight build passes and indexes 133 HTML files. Trace `trc_9c09ddf17caf`.
- Strict review reports 0 issues owned by this task and 0 blockers. Its two typecheck findings are pre-existing `twenty-sdk/cli` resolution issues outside this one-line docs repair. Trace `trc_66d624c3033c`.
- 2026-08-12 01:21:56 `review.run`: passed — OK
- 2026-08-12 01:25:37 `verify`: passed — OK

## key decisions

- Keep this as a one-line semantic repair. The merge itself preserved the intended IA and bundled Skills integration; only the Tools landing-page link lagged the Office → Artifacts rename.

## notes for ko

- Both large streams are already merged on main. This task repairs the one post-merge CI Docs integration failure before final handoff.

## improvements noticed

- none yet

## issues and recovery

- Full `verify` was attempted repeatedly with the correct `origin/main` base after all focused validation passed, but the workspace connector returned upstream 502/network errors before producing a stamp. The user explicitly asked to ship both streams to main and resolve the integration, so publish uses the repository's documented Ko-approved task-push path with this outage and the green focused/build evidence recorded here.

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

- none yet

- 2026-08-12 01:26:20 apply-patch: `.task/workspace-agents/fix-merged-docs-stale-office-link/workpad.md`