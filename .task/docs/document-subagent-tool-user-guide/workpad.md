# document subagent tool user guide

branch: `task/docs/document-subagent-tool-user-guide`
stream: `stream/docs`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1346/document-subagent-tool-user-guide
github pr: https://github.com/consuelohq/opensaas/pull/1346
started: 2026-07-02

## acceptance criteria

- [ ] Define explicit task acceptance criteria before coding.

## plan

1. Read the relevant code and update this plan before editing.

## current status

- Task started. Update this before publish.

## files changed

- `packages/documentation/src/content/docs/os/tools/subagents.mdx`

## workspace-owned: files changed

- `packages/documentation/src/content/docs/os/tools/subagents.mdx`

## workspace-owned: activity log

- 2026-07-02 20:46:54 fs.write: `packages/documentation/src/content/docs/os/tools/subagents.mdx`
- 2026-07-02 20:53:23 fs.write: `.task/docs/document-subagent-tool-user-guide/workpad.md`

## workspace-owned: validation evidence

- 2026-07-02 20:52:15 `review.run`: passed — OK
- 2026-07-02 20:53:00 `verify`: passed — OK

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
bun run task:push -- --message "type(docs): description" --changed
bun run task:pr
bun run task:finish
```

- 2026-07-02 20:46:54 write: `packages/documentation/src/content/docs/os/tools/subagents.mdx`

## workspace-owned: test selection

- changed files: `.task/docs/document-subagent-tool-user-guide/current.json`, `.task/docs/document-subagent-tool-user-guide/session.json`, `.task/docs/document-subagent-tool-user-guide/workpad.md`, `.task/tasks/docs/document-subagent-tool-user-guide.json`, `packages/documentation/astro.config.mjs`, `packages/documentation/scripts/validate-documentation.mjs`, `packages/documentation/src/content/docs/os/tools/overview.mdx`, `packages/documentation/src/content/docs/os/tools/subagents.mdx`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: changed code selected zero suites; add a discoverable test or explicit rule when this is not intentional

## implementation update

- Added `packages/documentation/src/content/docs/os/tools/subagents.mdx` as a user guide for the `subagent` tool.
- Added the page to the Starlight sidebar under Tools -> Workspace Tools.
- Added `os/tools/subagents` to the documentation validator curated slug list.
- Linked the new page from the OS tools overview.

## acceptance criteria

- [x] Document what subagents are and when to use them.
- [x] Explain providers: `codex`, `pi`, `opencode`, and `grok`.
- [x] Explain bundles: `core` by default and `media` as explicit replacement steering.
- [x] Explain policies: `read` and `edit`.
- [x] Show the tmp instruction file flow.
- [x] Show single subagent runs, media runs, edit runs, and multiple parallel read runs.
- [x] Document result reading, trace style summaries, patterns to try, common mistakes, and troubleshooting.
- [x] Wire the page into sidebar and validator.

## validation evidence

- `trc_67d3cbbc8ccf` passed `bun run --cwd packages/documentation validate`.
- `trc_50ac375906b7` passed custom docs assertions for the subagents page, sidebar slug, validator slug, overview link, and no em/en dash characters in the new page.
- `trc_6f602a42ec9a` passed `review.run --no-tests` with zero owned issues.
- `trc_0740e58fcdcc` passed full `verify` and wrote a publish-valid stamp.

## known validation note

- Direct package build in the task worktree hit the existing Starlight/Astro symlink cache issue: `No cached compile metadata found` under the symlinked `packages/documentation/node_modules` path. The docs package validator and full workspace verify passed.

- 2026-07-02 20:53:23 append: `.task/docs/document-subagent-tool-user-guide/workpad.md`
