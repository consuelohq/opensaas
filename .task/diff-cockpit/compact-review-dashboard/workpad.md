# compact review dashboard

branch: `task/diff-cockpit/compact-review-dashboard`
stream: `stream/diff-cockpit`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/972/compact-review-dashboard
github pr: https://github.com/consuelohq/opensaas/pull/972
started: 2026-06-11

## acceptance criteria

- [x] Main review panel renders a compact front page with status and summary open by default.
- [x] Checks, comments, commits, and the AI-agent prompt render as collapsed toggle sections by default.
- [x] Summary chips toggle the matching drawer sections without scrolling the user into a dumped list.
- [x] Drawer actions include copy buttons for all review comments, the PR link, the current/first commit link, and agent prompts.
- [x] Review markdown handles headings, lists, links, code fences, blockquotes, inline code, bold text, and safe details/summary blocks.
- [x] Existing review page keyboard shortcuts and merge/mergeability controls keep working.

## plan

1. Read the current drawer renderer, markdown renderer, tests, and style rules.
2. Add red tests for compact drawer sections, share buttons, and markdown rendering coverage.
3. Implement collapsible drawer helpers, share-link copy handlers, and safer markdown rendering.
4. Run the focused diff-cockpit test and typecheck/static gates.
5. Push the task branch and update the PR.

## current status

- Implementation complete and validated locally.
- Pending publish/update of PR.

## files changed

- `.task/diff-cockpit/compact-review-dashboard/current.json`
- `.task/diff-cockpit/compact-review-dashboard/evidence-log.json`
- `.task/diff-cockpit/compact-review-dashboard/read-log.json`
- `.task/diff-cockpit/compact-review-dashboard/session.json`
- `.task/diff-cockpit/compact-review-dashboard/workpad.md`
- `.task/tasks/diff-cockpit/compact-review-dashboard.json`
- `packages/diff-cockpit/src/index.ts`
- `packages/diff-cockpit/tests/diff-cockpit.test.ts`

## workspace-owned: files changed

- `.task/diff-cockpit/compact-review-dashboard/current.json`
- `.task/diff-cockpit/compact-review-dashboard/evidence-log.json`
- `.task/diff-cockpit/compact-review-dashboard/read-log.json`
- `.task/diff-cockpit/compact-review-dashboard/session.json`
- `.task/diff-cockpit/compact-review-dashboard/workpad.md`
- `.task/tasks/diff-cockpit/compact-review-dashboard.json`
- `packages/diff-cockpit/src/index.ts`
- `packages/diff-cockpit/tests/diff-cockpit.test.ts`

## workspace-owned: activity log

- 2026-06-11 18:47 read current workpad and review drawer sources.
- 2026-06-11 18:48 added red test expectations for compact drawer controls and share actions.
- 2026-06-11 18:57 implemented compact drawer sections, copy link actions, summary chips, prompt preview, and safer markdown block rendering.
- 2026-06-11 19:04 fixed generated client script syntax and reran focused tests.
- 2026-06-11 19:06:06 fs.write: `.task/diff-cockpit/compact-review-dashboard/workpad.md`

## workspace-owned: validation evidence

- `bun --cwd packages/diff-cockpit test tests/diff-cockpit.test.ts` => 30 pass, 0 fail, 292 expect calls.
- `cd packages/diff-cockpit && bun run typecheck` => exit 0.
- `checkFiles` on `packages/diff-cockpit/src/index.ts` and `packages/diff-cockpit/tests/diff-cockpit.test.ts` => ok.
- 2026-06-11 19:06:31 `verify`: passed — OK

## key decisions

- Keep this branch scoped to the main compact review dashboard. The dedicated AI comments sidebar remains a separate follow-up branch.
- Use local drawer section state in the client script so chips and headers act as the same toggle surface.
- Keep markdown rendering client-local and safe by escaping all text before applying supported inline formatting and safe links.

## notes for ko

- This PR intentionally does not add the second CodeRabbit/Codex comments sidebar or GitHub resolved-thread sync. Those belong in PR two.

## improvements noticed

- The workspace checkFiles tool expects `files`, not `paths`.
- `bun --cwd packages/diff-cockpit run typecheck` prints help in this Bun version; `cd packages/diff-cockpit && bun run typecheck` is the reliable form.

## issues and recovery

- First task.start call used the stream branch name in `startFrom`; retried with the supported `stream` option and created the task branch successfully.
- First fs.write attempt for the workpad lacked `force`; retried with `force: true`.
- Initial generated client script had duplicated function headers during surgical replacement; extracted the generated script, checked it with Node, fixed the duplicate, and reran tests.

---

## publish checklist

```bash
bun run task:push -- --message "type(diff-cockpit): description" --changed
bun run task:pr
bun run task:finish
```

## workspace-owned: files read

- `AGENTS.md`
- `CODING-STANDARDS.md`
- `packages/diff-cockpit/src/index.ts`
- `packages/diff-cockpit/tests/diff-cockpit.test.ts`
- `packages/diff-cockpit/package.json`

- 2026-06-11 19:06:06 write: `.task/diff-cockpit/compact-review-dashboard/workpad.md`

## workspace-owned: test selection

- changed files: `.task/diff-cockpit/compact-review-dashboard/current.json`, `.task/diff-cockpit/compact-review-dashboard/evidence-log.json`, `.task/diff-cockpit/compact-review-dashboard/read-log.json`, `.task/diff-cockpit/compact-review-dashboard/session.json`, `.task/diff-cockpit/compact-review-dashboard/workpad.md`, `.task/tasks/diff-cockpit/compact-review-dashboard.json`, `packages/diff-cockpit/src/index.ts`, `packages/diff-cockpit/tests/diff-cockpit.test.ts`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: changed code selected zero suites; add a discoverable test or explicit rule when this is not intentional
