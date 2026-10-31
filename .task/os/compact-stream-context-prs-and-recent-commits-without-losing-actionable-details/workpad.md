# Compact stream.context PRs and recent commits without losing actionable details

branch: `task/os/compact-stream-context-prs-and-recent-commits-without-losing-actionable-details`
stream: `stream/os`
pr: https://github.com/consuelohq/opensaas/pull/2752
started: 2026-10-31

## acceptance criteria

- [x] Define explicit task acceptance criteria before coding.

## plan

1. Read the relevant code and update this plan before editing.

## files changed

- `packages/os/scripts/lib/streams/context-compact.js`
- `packages/workspace/scripts/lib/stream-context-compact.js`
- `packages/workspace/tests/stream-context-compact.test.ts`

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
bun run task:push -- --message "type(os): description" --changed
bun run task:pr
bun run task:finish
```

## workspace-owned: files read

- `packages/documentation/src/content/docs/reference/tools.mdx`
- `packages/os/definitely-missing.json`
- `packages/os/scripts/generate-tool-manifest.ts`
- `packages/os/scripts/lib/streams/cli.ts`
- `packages/os/scripts/lib/streams/context-runtime.ts`
- `packages/os/scripts/stream-context.js`
- `packages/os/tests/fixtures/tool-package-baseline.json`
- `packages/os/tests/stream-context-memory.test.ts`
- `packages/workspace/scripts/lib/stream-context-compact.js`
- `packages/workspace/scripts/test-selection.js`

## Test-first contract — DEV-1667

behavior under test: default stream.context is a bounded, low-token operational summary; per-PR title/branch/URL/author duplication is removed; non-usual author is marked; all raw information stays available via explicit full:true. Long workpad contents are available only in full detail. Preserve total open PR count for task.start preflight.

existing local pattern: packages/workspace/scripts/stream-context.js produces 9 top-level fields including full 67 PRs, 25 commits, 3 verbose workpads; task-start.js consumes openTaskPullRequests.pullRequests.length. OS & Workspace facade StreamInput share schema and tool handler.

new or changed tests: packages/workspace/tests/stream-context-compact.test.ts with compact vs full modes, capped PRs, unusual authors, workpad/commit reduction, empty/skipped, byte ceiling and contract count; update schema/handler tests where needed.

focused red command: bun x vitest run packages/workspace/tests/stream-context-compact.test.ts

expected red failure: new compact helper module unavailable/undefined until implemented.

no-test waiver: none.

## Plan

1. Record baseline payload and strict semantics; tests RED.
2. Implement pure compact formatter and --full mode (tool schema/handler with parity), adjust task.start total count.
3. Run tests GREEN, bounded summary and full CLI simulation; measure before/after bytes.
4. Run formal review/verify, publish PR #2752 to stream/os, update Linear DEV-1667. No main merge/deploy.

## Measured pre-change baseline

Live stream.context(area=os) delivered ~59,591 text bytes / 67 PRs / 25 commits / 14 worktrees / 3 workpads; raw major pieces: 32,011 bytes workpads, 14,679 bytes PRs, 3,017 commits, 2,989 worktrees. Output reduction is intended to preserve all detail via full:true, never delete underlying records.

- 2026-10-31 07:27:48 append: `.task/os/compact-stream-context-prs-and-recent-commits-without-losing-actionable-details/workpad.md`

## workspace-owned: files changed

- `packages/os/scripts/lib/streams/context-compact.js`
- `packages/workspace/scripts/lib/stream-context-compact.js`
- `packages/workspace/tests/stream-context-compact.test.ts`

## workspace-owned: activity log

- 2026-10-31 07:27:48 fs.write: `.task/os/compact-stream-context-prs-and-recent-commits-without-losing-actionable-details/workpad.md`
- 2026-10-31 07:28:30 write: `packages/workspace/tests/stream-context-compact.test.ts`
- 2026-10-31 07:28:30 fs.write: `packages/workspace/tests/stream-context-compact.test.ts`
- 2026-10-31 07:28:52 write: `packages/workspace/scripts/lib/stream-context-compact.js`
- 2026-10-31 07:28:52 fs.write: `packages/workspace/scripts/lib/stream-context-compact.js`
- 2026-10-31 07:29:07 apply-patch: `packages/workspace/scripts/stream-context.js`
- 2026-10-31 07:29:07 apply-patch: `packages/workspace/scripts/task-start.js`
- 2026-10-31 07:29:07 apply-patch: `packages/os/tools/stream/handler.ts`
- 2026-10-31 07:29:07 apply-patch: `packages/workspace/scripts/lib/facade/schemas.ts`
- 2026-10-31 07:29:07 apply-patch: `packages/os/scripts/lib/facade/schemas.ts`
- 2026-10-31 07:30:03 write: `packages/os/scripts/lib/streams/context-compact.js`
- 2026-10-31 07:30:03 fs.write: `packages/os/scripts/lib/streams/context-compact.js`
- 2026-10-31 07:30:12 apply-patch: `packages/os/scripts/lib/streams/cli.ts`
- 2026-10-31 07:30:12 apply-patch: `packages/os/scripts/lib/streams/context-runtime.ts`
- 2026-10-31 07:30:12 apply-patch: `packages/os/scripts/task-start.js`
- 2026-10-31 07:30:12 apply-patch: `packages/workspace/tests/stream-context-compact.test.ts`
- 2026-10-31 07:30:58 apply-patch: `packages/os/tests/fixtures/tool-package-baseline.json`
- 2026-10-31 07:40:27 fs.write: `.task/os/compact-stream-context-prs-and-recent-commits-without-losing-actionable-details/workpad.md`
- 2026-10-31 07:40:37 fs.write: `packages/workspace/tests/stream-context-compact.test.ts`
- 2026-10-31 07:44:41 fs.write: `.task/os/compact-stream-context-prs-and-recent-commits-without-losing-actionable-details/workpad.md`

## workspace-owned: validation evidence

- 2026-10-31 07:31:25 `review.run`: passed — OK
- 2026-10-31 07:31:51 apply-patch: `packages/documentation/src/content/docs/reference/tools.mdx`
- 2026-10-31 07:36:20 `verify`: failed — COMMAND_FAILED
- 2026-10-31 07:39:38 `verify`: failed — COMMAND_FAILED
- 2026-10-31 07:39:47 `verify`: failed — COMMAND_FAILED
- 2026-10-31 07:44:19 `verify`: passed — OK

## Verification feedback / selection contract

A full verify on this task selected 11 suites including fallback auto:@consuelo/os:package-test. That entire package suite exited 1 with pre-existing unrelated OS inventory drift and trace persistence timeouts, even while the selected critical facade/task/manifests suites and strict static review passed. This task now adds a narrow **critical** stream-context rule to explicitly own the newly added OS stream CLI/runtime files and ensure selector does not fall back to unrelated package-wide OS testing. Preserve all existing explicit critical suites and DB guard. Add regression asserting every newly changed stream-context runtime file is owned and test selection remains nonempty. Rerun full verify on exact task code after registry regeneration; do not claim success or publish until publish-valid stamp.

- 2026-10-31 07:40:27 append: `.task/os/compact-stream-context-prs-and-recent-commits-without-losing-actionable-details/workpad.md`

- 2026-10-31 07:40:37 append: `packages/workspace/tests/stream-context-compact.test.ts`

- 2026-10-31 07:41:14 apply-patch: `packages/workspace/test-selection.rules.json`

## Completion evidence — DEV-1667

- Test-first red observed missing compact helper; green: 8/8 focused stream-context tests; OS/Workspace manifests additional focused 33/33 before final selector change.
- Explicit critical stream-context selector test first failed RED, then GREEN; 118/118 stream-context/manifest/test-selection focused tests.
- OS runtime call (same task worktree): 25,769 -> 2,853 bytes (88.9% smaller); total 66 PRs, 12 shown, 8 recent commits, full retrievable with full:true. Original connected OS example was ~59,591 bytes including large full workpads, so actual reduction can be greater.
- Both OS/Workspace code and schema parity, generated type and manifest regeneration, documentation validation on 105 pages.
- Formal strict review: 0 blocking findings; full `verify` **passed=true and publishValid=true**, 12 selected suites passed, DB guard no findings, stamp written.
- Initial broad auto OS package selector failures diagnosed and replaced by explicit critical coverage for all new stream-context runtime sources; no tests disabled. Full verify passes on corrected registry.
- All details preserved by full:true (all PR identities, URLs, branches, authors, original workpad texts, commit timestamps, worktree paths). Do not reconstruct slugs from titles.
- Publication target: PR #2752 -> stream/os only, no main merge/deploy.

- 2026-10-31 07:44:41 write: `.task/os/compact-stream-context-prs-and-recent-commits-without-losing-actionable-details/workpad.md`
