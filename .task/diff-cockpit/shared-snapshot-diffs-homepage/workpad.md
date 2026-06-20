# shared snapshot diffs homepage

branch: `task/diff-cockpit/shared-snapshot-diffs-homepage`
stream: `stream/diff-cockpit`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1162/shared-snapshot-diffs-homepage
github pr: https://github.com/consuelohq/opensaas/pull/1162
started: 2026-06-20

## acceptance criteria

- [ ] Define explicit task acceptance criteria before coding.

## plan

1. Read the relevant code and update this plan before editing.

## current status

- Task started. Update this before publish.

## files changed

- none yet

## Server Automatically populates this section: files changed

- none yet

## Server Automatically populates this section: activity log

- 2026-06-20 16:12:06 fs.read: `packages/diff-cockpit/src/index.ts`
- 2026-06-20 16:12:22 fs.read: `packages/diff-cockpit/src/index.ts`
- 2026-06-20 16:12:22 fs.read: `packages/diff-cockpit/tests/diff-cockpit.test.ts`
- 2026-06-20 16:12:49 fs.read: `packages/diff-cockpit/src/index.ts`
- 2026-06-20 16:13:00 fs.read: `packages/diff-cockpit/src/index.ts`
- 2026-06-20 16:13:00 fs.read: `packages/diff-cockpit/tests/diff-cockpit.test.ts`
- 2026-06-20 16:13:11 fs.read: `packages/diff-cockpit/src/index.ts`
- 2026-06-20 16:14:01 fs.read: `packages/diff-cockpit/src/index.ts`
- 2026-06-20 16:17:38 fs.read: `packages/diff-cockpit/src/index.ts`
- 2026-06-20 16:21:51 fs.read: `packages/diff-cockpit/src/index.ts`
- 2026-06-20 16:23:21 fs.read: `packages/diff-cockpit/src/index.ts`
- 2026-06-20 16:24:53 fs.read: `packages/diff-cockpit/tests/diff-cockpit.test.ts`
- 2026-06-20 16:26:41 fs.read: `packages/workspace/tooling/tool-manifest.json`

## Server Automatically populates this section: validation evidence

- 2026-06-20 16:25:42 `verify`: passed — OK
- 2026-06-20 16:29:34 `verify`: passed — OK

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

## Server Automatically populates this section: files read

- `packages/diff-cockpit/src/index.ts`
- `packages/diff-cockpit/tests/diff-cockpit.test.ts`
- `packages/workspace/tooling/tool-manifest.json`

## Server Automatically populates this section: test selection

- changed files: `.task/diff-cockpit/shared-snapshot-diffs-homepage/current.json`, `.task/diff-cockpit/shared-snapshot-diffs-homepage/evidence-log.json`, `.task/diff-cockpit/shared-snapshot-diffs-homepage/read-log.json`, `.task/diff-cockpit/shared-snapshot-diffs-homepage/session.json`, `.task/diff-cockpit/shared-snapshot-diffs-homepage/verify.json`, `.task/diff-cockpit/shared-snapshot-diffs-homepage/workpad.md`, `.task/tasks/diff-cockpit/shared-snapshot-diffs-homepage.json`, `packages/diff-cockpit/src/index.ts`, `packages/diff-cockpit/tests/diff-cockpit.test.ts`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: changed code selected zero suites; add a discoverable test or explicit rule when this is not intentional
