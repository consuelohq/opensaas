# rename connect create your own docs to bring your own

branch: `task/documentation/rename-connect-create-your-own-docs-to-bring-your-own`
stream: `stream/documentation`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/2032/rename-connect-create-your-own-docs-to-bring-your-own
github pr: https://github.com/consuelohq/opensaas/pull/2032
started: 2026-08-15

## acceptance criteria

- [ ] Define explicit task acceptance criteria before coding.

## plan

1. Read the relevant code and update this plan before editing.

## current status

- Task started. Update this before publish.

## files changed

- none yet

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-08-15 06:10:17 fs.write: `.task/documentation/rename-connect-create-your-own-docs-to-bring-your-own/workpad.md`
- 2026-08-15 06:12:33 fs.write: `.task/documentation/rename-connect-create-your-own-docs-to-bring-your-own/workpad.md`

## workspace-owned: validation evidence

- 2026-08-15 06:12:18 `review.run`: passed — OK
- 2026-08-15 06:12:25 `verify`: passed — OK

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
bun run task:push -- --message "type(documentation): description" --changed
bun run task:pr
bun run task:finish
```

## Acceptance criteria

- [ ] Under Connect > Agents, the doc currently labeled `Create your own` is labeled `Bring your own`.
- [ ] Under Connect > Applications, the doc currently labeled `Create your own` is labeled `Bring your own`.
- [ ] Preserve routes/content unless the label is sourced from page frontmatter that requires a title-only edit.
- [ ] Validate documentation navigation/content and ship through the documentation stream.

## Plan

1. Read documentation package guidance and locate every Connect navigation/title source for `Create your own`.
2. Change only the two user-facing doc names to `Bring your own`.
3. Run focused docs validation, inspect the diff, then review/verify and promote through `stream/documentation`.

## Test-first contract

behavior under test: Connect > Agents and Connect > Applications expose `Bring your own` as the user-facing doc name instead of `Create your own`.
existing local pattern: documentation page frontmatter/navigation registry is the source of user-facing labels; preserve routes when only copy changes.
new or changed tests: none; this is a copy-only documentation rename.
focused red command: not applicable for copy-only docs.
expected red failure: not applicable.
no-test waiver: copy-only docs change. Replacement validation is source search plus `bun run validate`, build/navigation checks if selected, review, and full verify.

- 2026-08-15 06:10:17 append: `.task/documentation/rename-connect-create-your-own-docs-to-bring-your-own/workpad.md`

## workspace-owned: files read

- `packages/documentation/README.md`
- `packages/documentation/scripts/test-connect-browser.mjs`
- `packages/documentation/src/content/docs/connect/agents/create-your-own.mdx`
- `packages/documentation/src/content/docs/connect/apps-and-services/create-your-own.mdx`
- `packages/documentation/src/content/docs/connect/apps-and-services/index.mdx`
- `packages/documentation/src/lib/docs-navigation.ts`
- `packages/documentation/tests/connect.test.ts`

- 2026-08-15 06:11:25 apply-patch: `packages/documentation/src/content/docs/connect/agents/create-your-own.mdx`
- 2026-08-15 06:11:25 apply-patch: `packages/documentation/src/content/docs/connect/apps-and-services/create-your-own.mdx`
- 2026-08-15 06:11:25 apply-patch: `packages/documentation/src/content/docs/connect/apps-and-services/index.mdx`
- 2026-08-15 06:11:25 apply-patch: `packages/documentation/src/lib/docs-navigation.ts`
- 2026-08-15 06:11:25 apply-patch: `packages/documentation/tests/connect.test.ts`
- 2026-08-15 06:11:25 apply-patch: `packages/documentation/scripts/test-connect-browser.mjs`

## Final status

- [x] Connect > Agents now displays `Bring your own` while keeping `/connect/agents/create-your-own/` stable.
- [x] Connect > Applications now displays `Bring your own` while keeping `/connect/apps-and-services/create-your-own/` stable.
- [x] The Applications overview card and Connect browser/static contracts use the new label.
- [x] Exact package search finds no remaining user-facing `Create your own` string.

## Files changed

- `packages/documentation/src/content/docs/connect/agents/create-your-own.mdx`
- `packages/documentation/src/content/docs/connect/apps-and-services/create-your-own.mdx`
- `packages/documentation/src/content/docs/connect/apps-and-services/index.mdx`
- `packages/documentation/src/lib/docs-navigation.ts`
- `packages/documentation/tests/connect.test.ts`
- `packages/documentation/scripts/test-connect-browser.mjs`

## Validation evidence

- Destructive-literal preflight for the focused Connect test and documentation validator: clean. Trace `trc_e4413c410323`.
- `bun test tests/connect.test.ts`: 8 passed, 0 failed, 520 assertions. Trace `trc_a10cfa590d62`.
- `bun run validate`: passed for 105 selected pages. Trace `trc_614814a67ac1`.
- Exact package search: no remaining `Create your own` occurrences. Trace `trc_d55521db50ba`.
- `review.run --base origin/main --no-tests`: zero task issues; only the existing no-typecheck-target warning. Trace `trc_c6682e29446e`.
- Full `verify --base origin/main`: passed, `publishValid: true`. Trace `trc_db7d35aa84be`.

## Key decision

- Rename only the visible titles/labels; retain the existing `create-your-own` routes to avoid breaking public URLs and inbound links.

- 2026-08-15 06:12:33 append: `.task/documentation/rename-connect-create-your-own-docs-to-bring-your-own/workpad.md`
