# repair stream general metadata

## acceptance criteria

- Remove legacy root `.task/*` metadata churn from `stream/general` PR #355.
- Preserve legitimate scoped task metadata under `.task/general/**` and `.task/tasks/general/**`.
- Do not touch product code or workspace tooling.
- Validate that PR #355 no longer lists root `.task/current.json`, `.task/session.json`, `.task/workpad.md`, `.task/evidence-log.json`, or `.task/read-log.json`.

## plan

- Confirm current PR #355 root metadata file list.
- Restore legacy root `.task/*` files in this task branch to `origin/main` so they disappear from stream-vs-main diff.
- Inspect diff to ensure only metadata repair plus current scoped task metadata is present.
- Publish and promote into `stream/general`.

## notes

Ko approved repairing `stream/general` directly and stated workspace tooling works correctly when the stream starts from the current metadata shape.

- 2026-05-26 00:28:32 write: `.task/general/repair-stream-general-metadata/workpad.md`

## files changed

- none yet

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-05-26 00:28:32 fs.write: `.task/general/repair-stream-general-metadata/workpad.md`
