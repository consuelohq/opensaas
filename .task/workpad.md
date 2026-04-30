# address csv import naming review findings

branch: `task/dialer/address-csv-import-naming-review-findings`
stream: `stream/dialer`
pr: https://github.com/consuelohq/opensaas/pull/243
started: 2026-04-30

## acceptance criteria

- [x] Verify the active opportunity lookup finding against current `HomePage.tsx`.
- [x] Remove eager active-opportunity lookup when needed and replace it with lazy fetch on CSV import open.
- [x] Keep default list numbering behavior and active duplicate-name validation intact.
- [x] Verify the TextInput accessibility finding against current `HomePage.tsx`.
- [x] Add an accessible label to the import list name input without changing footer/modal primitives.
- [x] Run focused formatting/static checks and publish through task workflow.

## plan

1. Read current HomePage and supporting lazy find-many hook/input component.
2. Replace eager active list query with `useLazyFindManyRecords` and local state.
3. Trigger active list lookup from the CSV import open handler only.
4. Add the TextInput label prop.
5. Format, validate focused checks, self-review diff, then publish.

## files changed

- `packages/twenty-front/src/pages/home/HomePage.tsx`

## key decisions

- Current code does eagerly call `useFindManyRecords` for up to 1000 opportunities on render; the review finding is valid.
- Current import list `TextInput` has no label/aria-label; the accessibility finding is valid.
- Used existing `useLazyFindManyRecords` rather than hand-rolling Apollo query wiring, because it reuses the same find-many GraphQL query, object permission handling, cache client, pagination state, and error handling path.
- Kept the historical count query as-is because the finding targeted the up-to-1000 active-name lookup; the historical query is a minimal `limit: 1` count source required for deleted-list numbering.
- Cleared `importListName` on close/create so the duplicate-name query stays skipped while the modal is not in use.
- Did not alter `Modal.Footer`, shared modal primitives, or the existing footer modal styling.

## validation

- passed: `yarn prettier --check packages/twenty-front/src/pages/home/HomePage.tsx`.
- passed: `git diff --check -- packages/twenty-front/src/pages/home/HomePage.tsx`.
- passed for changed file: `yarn tsc -p packages/twenty-front/tsconfig.json --noEmit --pretty false` produced no `HomePage.tsx` errors. Full command still exits with pre-existing unrelated frontend/shared errors.
- blocked/tooling: `workspace review.run '{"base":"stream/dialer","noTests":true}'` timed out twice in this conversation/task context.
- blocked/tooling: `workspace confirm '{"verify":false}'` resolved against `main` / `origin/stream/workspace-agents`, not this task branch, so its findings are unrelated to this task.

## notes for ko

- Review findings were verified against current stream/dialer code before fixing.
- CSV import active-list names are now fetched only from the Import CSV click path; no effect-triggered eager fetch was added.

## improvements noticed

- `TextInput` declares `InputHTMLAttributes` but does not forward arbitrary rest props, so an `aria-label` prop would be swallowed. I used the supported `label` prop instead.

## errors i ran into

- `workspace review.run` timed out; focused checks were used for this one-file review fix.
- `workspace confirm` used the wrong base/branch and surfaced unrelated workspace-agents findings.

---

## publish checklist

```bash
bun run task:push -- --message "fix(dialer): address csv import naming review" --changed
bun run task:pr
bun run task:finish
```
