# update design wiki to recently updated pagination

branch: `task/workspace-agents/update-design-wiki-to-recently-updated-pagination`
stream: `stream/workspace-agents`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/479/update-design-wiki-to-recently-updated-pagination
github pr: https://github.com/consuelohq/opensaas/pull/479
started: 2026-05-23

## acceptance criteria

- [ ] Define explicit task acceptance criteria before coding.

## plan

1. Read the relevant code and update this plan before editing.

## files changed

- none yet

## key decisions

- none yet

## notes for ko

- none yet

## improvements noticed

- none yet

## errors i ran into

- none yet

---

## publish checklist

```bash
bun run task:push -- --message "type(workspace-agents): description" --changed
bun run task:pr
bun run task:finish
```

- 2026-05-23 04:15:16 write: `packages/workspace/scripts/consuelo-design.ts`
- 2026-05-23 04:15:40 patch lines 1110-1134: `packages/workspace/scripts/consuelo-design.ts`
- 2026-05-23 04:15:52 write: `packages/workspace/scripts/consuelo-design.ts`
- 2026-05-23 04:16:11 patch lines 116-116: `packages/consuelo-design/README.md`
- 2026-05-23 04:16:25 patch lines 1426-1426: `packages/workspace/SCRIPTS.md`
- 2026-05-23 04:16:48 write: `packages/workspace/scripts/consuelo-design.ts`
## implementation checkpoint — design wiki recently updated

Acceptance criteria:

- Replace separate Featured and Recent sections with one Recently Updated section.
- Sort visible wiki entries by `updatedAt`, with `publishedAt` as legacy fallback.
- Paginate the Recently Updated section at 10 entries per page.
- Add a top-level Website filter for entries under `/website/...`.
- Update the owning docs for design wiki archive behavior.

Exploration:

- Searched context for `design wiki` and confirmed `design.publish` owns archive updates and `/design-wiki` generation.
- Read `packages/workspace/scripts/consuelo-design.ts` archive rendering and update flow.
- Read `packages/consuelo-design/README.md` and `packages/workspace/SCRIPTS.md` archive documentation.

Implementation:

- Updated `renderArchiveIndex` to render one `Recently Updated` section sorted by `updatedAt`.
- Added client-side pagination with `pageSize = 10` and previous/next controls.
- Added website filter routing by first path segment.
- Updated README and script docs to document Website filtering and updated-at ordering.

Validation:

- `bun --check packages/workspace/scripts/consuelo-design.ts` passed.
- `consueloDesign.check` passed for design package boundary and Railway exclusion checks.

- 2026-05-23 04:17:29 append: `.task/workspace-agents/update-design-wiki-to-recently-updated-pagination/workpad.md`