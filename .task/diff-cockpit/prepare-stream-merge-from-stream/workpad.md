# prepare stream merge from stream

branch: `task/diff-cockpit/prepare-stream-merge-from-stream`
stream: `stream/diff-cockpit`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/838/prepare-stream-merge-from-stream
github pr: https://github.com/consuelohq/opensaas/pull/838
started: 2026-06-07

## acceptance criteria

- [ ] Define explicit task acceptance criteria before coding.

## plan

1. Read the relevant code and update this plan before editing.

## current status

- Task started. Update this before publish.

## files changed

- `packages/diff-cockpit/src/index.ts`
- `packages/workspace/hooks/diff-cockpit/cache-refresh.ts`
- `packages/workspace/scripts/diff_cockpit.ts`

## workspace-owned: files changed

- `packages/diff-cockpit/src/index.ts`
- `packages/workspace/hooks/diff-cockpit/cache-refresh.ts`
- `packages/workspace/scripts/diff_cockpit.ts`

## workspace-owned: activity log

- 2026-06-07 17:35:48 fs.patch: `packages/diff-cockpit/src/index.ts`
- 2026-06-07 17:35:57 fs.patch: `packages/diff-cockpit/src/index.ts`
- 2026-06-07 17:36:08 fs.patch: `packages/diff-cockpit/src/index.ts`
- 2026-06-07 17:37:35 fs.patch: `packages/diff-cockpit/src/index.ts`
- 2026-06-07 17:38:40 fs.patch: `packages/diff-cockpit/src/index.ts`
- 2026-06-07 17:39:03 fs.patch: `packages/diff-cockpit/src/index.ts`
- 2026-06-07 17:39:41 fs.patch: `packages/diff-cockpit/src/index.ts`
- 2026-06-07 17:40:06 fs.patch: `packages/diff-cockpit/src/index.ts`
- 2026-06-07 17:40:49 fs.patch: `packages/diff-cockpit/src/index.ts`
- 2026-06-07 17:41:12 fs.patch: `packages/diff-cockpit/src/index.ts`
- 2026-06-07 17:42:09 fs.patch: `packages/diff-cockpit/src/index.ts`
- 2026-06-07 17:42:18 fs.patch: `packages/diff-cockpit/src/index.ts`
- 2026-06-07 17:42:26 fs.patch: `packages/diff-cockpit/src/index.ts`
- 2026-06-07 17:42:42 fs.patch: `packages/diff-cockpit/src/index.ts`
- 2026-06-07 17:44:32 fs.patch: `packages/diff-cockpit/src/index.ts`
- 2026-06-07 17:46:36 fs.patch: `packages/workspace/hooks/diff-cockpit/cache-refresh.ts`
- 2026-06-07 17:47:05 fs.patch: `packages/workspace/hooks/diff-cockpit/cache-refresh.ts`
- 2026-06-07 17:48:58 fs.patch: `packages/workspace/scripts/diff_cockpit.ts`
- 2026-06-07 17:50:03 fs.patch: `packages/workspace/scripts/diff_cockpit.ts`
- 2026-06-07 17:50:45 fs.patch: `packages/workspace/scripts/diff_cockpit.ts`
- 2026-06-07 17:51:13 fs.patch: `packages/workspace/scripts/diff_cockpit.ts`
- 2026-06-07 17:51:22 fs.patch: `packages/workspace/scripts/diff_cockpit.ts`
- 2026-06-07 17:51:30 fs.patch: `packages/workspace/scripts/diff_cockpit.ts`
- 2026-06-07 17:51:42 fs.patch: `packages/workspace/scripts/diff_cockpit.ts`
- 2026-06-07 17:51:55 fs.patch: `packages/workspace/scripts/diff_cockpit.ts`
- 2026-06-07 17:52:32 fs.patch: `packages/diff-cockpit/src/index.ts`

## workspace-owned: validation evidence

- 2026-06-07 17:54:41 `verify`: passed — OK

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
bun run task:push -- --message "type(diff-cockpit): description" --changed
bun run task:pr
bun run task:finish
```

## workspace-owned: files read

- `packages/diff-cockpit/src/index.ts`
- `packages/diff-cockpit/tests/diff-cockpit.test.ts`
- `packages/workspace/hooks/diff-cockpit/cache-refresh.ts`
- `packages/workspace/scripts/diff_cockpit.ts`

- 2026-06-07 17:50:45 patch lines 131-131: `packages/workspace/scripts/diff_cockpit.ts`

- 2026-06-07 17:51:13 patch lines 139-139: `packages/workspace/scripts/diff_cockpit.ts`

- 2026-06-07 17:51:22 patch lines 147-147: `packages/workspace/scripts/diff_cockpit.ts`

- 2026-06-07 17:51:30 patch lines 155-155: `packages/workspace/scripts/diff_cockpit.ts`

- 2026-06-07 17:51:42 patch lines 163-163: `packages/workspace/scripts/diff_cockpit.ts`

- 2026-06-07 17:51:55 patch lines 188-188: `packages/workspace/scripts/diff_cockpit.ts`

- 2026-06-07 17:52:32 patch lines 2330-2330: `packages/diff-cockpit/src/index.ts`

## workspace-owned: test selection

- changed files: `.task/diff-cockpit/prepare-stream-merge-from-stream/current.json`, `.task/diff-cockpit/prepare-stream-merge-from-stream/evidence-log.json`, `.task/diff-cockpit/prepare-stream-merge-from-stream/read-log.json`, `.task/diff-cockpit/prepare-stream-merge-from-stream/session.json`, `.task/diff-cockpit/prepare-stream-merge-from-stream/workpad.md`, `.task/tasks/diff-cockpit/prepare-stream-merge-from-stream.json`, `packages/diff-cockpit/src/index.ts`, `packages/workspace/hooks/diff-cockpit/cache-refresh.ts`, `packages/workspace/scripts/diff_cockpit.ts`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: changed code selected zero suites; add a discoverable test or explicit rule when this is not intentional
