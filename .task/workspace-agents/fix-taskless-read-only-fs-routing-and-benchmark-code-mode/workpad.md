# fix taskless read-only fs routing and benchmark code mode

branch: `task/workspace-agents/fix-taskless-read-only-fs-routing-and-benchmark-code-mode`
stream: `stream/workspace-agents`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1540/fix-taskless-read-only-fs-routing-and-benchmark-code-mode
github pr: https://github.com/consuelohq/opensaas/pull/1540
started: 2026-07-21

## acceptance criteria

- [x] `fs.read`, `fs.search`, and `fs.list` run from the caller repo root without a task session when no branch or PR is explicitly requested, even if multiple unrelated task worktrees exist.
- [x] Explicit task session, branch, and PR routing remains branch-aware and fail-closed.
- [x] Mutating FS tools remain task-scoped.
- [x] `fs.read` exposes exact full-file reads through the facade and preserves the final newline.
- [x] Generate robust trace analytics and controlled benchmarks covering read, search, write, patch, `code.call`, `code.run`, and `batch`.
- [x] Audit `code.run`, `batch`, `code.call`, and top-level retry behavior against Cloudflare Code Mode semantics without redesigning top-level `call` in this patch.

## result

The ambiguity regression lived in facade routing, not the FS reader. Optional branch routing always invoked global task selection, so unrelated active worktrees blocked taskless reads. Optional read-only routing now falls back to the caller repository only when no explicit branch or PR target was supplied. Explicit targets still surface ambiguity.

`fs.list` is now task-session optional alongside `fs.read` and `fs.search`. Write, patch, and trash remain task-scoped mutation surfaces.

The workspace FS implementation already supported exact `--full` reads, but the facade schema and manifest dropped the flag. The OS mirror lacked the full-read implementation. Both facades now forward `full`, both mirrors preserve exact UTF-8 content including the trailing newline, and OS enforces a 1 MB full-read cap.

`code.run` and `batch` descriptions now state their real distinction: Code Mode supports dependent calls, branching, loops, filtering, and output shaping; batch runs a fixed call list sequentially or in parallel and cannot derive later inputs from earlier outputs.

## benchmark evidence

Reports:

- `/tmp/fs-code-mode-trace-analytics.json`
- `/tmp/fs-code-mode-trace-analytics.md`
- `/tmp/fs-code-mode-controlled-benchmark.md`

Trace history contained 5,584 unique rows from 2026-06-14 through 2026-07-21. Most meaningful volume begins 2026-07-13.

Key result: `fs.read` had 220 calls and an observed 80.91% success rate, but 41 failures were routing failures. Excluding task-selection failures, the reader succeeded on 99.44% of calls that reached it.

Controlled findings:

- Literal repository lookup: `fs.search` 350 ms, Python 346 ms, Bun 332 ms. `fs.search` used the fewest input tokens and returned the same nine matches.
- Same compact dependent search/read synthesis: `code.run` 732 ms with two typed child traces; Python 345 ms; Bun 327 ms. Python/Bun were faster, while Code Mode preserved child-level capability traces and one outer model call.
- Write 10,200 bytes: `fs.write` 274 ms; Python 339 ms; Bun 331 ms.
- Strict one-anchor patch: `fs.apply_patch` 258 ms; Python 338 ms; Bun 328 ms.
- Fixed write/patch/read batch: 996 ms but returned the full 10 KB nested read result.
- Code Mode write/patch/verify: 1,078 ms and returned only `{ bytes, patched, type }` while preserving all three child traces.

A telemetry weakness was observed in `code.call`: subsequent content edits to an already-dirty or untracked file can report `filesChanged: []`, because changed-file detection is based on Git path-set differences. Typed FS mutation tools still emit explicit path receipts.

## validation

Passed:

- Workspace FS and manifest suites: 27 tests.
- OS FS and manifest suites: 36 tests.
- Focused workspace facade contracts: 3 tests.
- Focused OS facade contracts: 3 tests.
- Workspace Python server-call suite: 43 tests.
- `checkFiles` on all changed source and test files: 11/11 files.

A broad workspace facade run was also attempted. It exposed six unrelated environment/snapshot integration failures involving tool search, stale patch fixtures, subagent wrapper binaries, and a context batch fixture. It generated snapshot noise, which was restored. The owned focused contracts pass.

## files changed

- `packages/os/scripts/fs.js`
- `packages/os/scripts/lib/facade/executor.ts`
- `packages/os/scripts/lib/facade/schemas.ts`
- `packages/os/scripts/lib/fs/read.ts`
- `packages/os/tests/facade/facade.test.ts`
- `packages/os/tests/fs-read.test.ts`
- `packages/os/tests/tool-manifest.test.ts`
- `packages/os/tooling/dev-tool-manifest.json`
- `packages/workspace/scripts/lib/facade/executor.ts`
- `packages/workspace/scripts/lib/facade/schemas.ts`
- `packages/workspace/tests/facade/facade.test.ts`
- `packages/workspace/tests/fs-read.test.ts`
- `packages/workspace/tests/server_call_test.py`
- `packages/workspace/tooling/tool-manifest.json`

## architectural conclusion

Do not remove typed FS based on this investigation. The evidence supports a layered model:

- `fs.search`: simple structured repository lookup.
- `fs.read`: known-file bounded or exact ingestion.
- `fs.write`, `fs.apply_patch`, `fs.trash`: explicit policy and mutation receipts.
- `code.call`: arbitrary local Python, Bun, or Bash computation and runtime evidence.
- `code.run`: one sandboxed program composing typed capabilities with control flow and compact final output.
- `batch`: fixed fan-out or predetermined sequences.

A future task can evaluate making top-level `call` accept a Code Mode program in addition to `{ tool, input }`, while keeping typed tools as the capability substrate. That redesign is intentionally not included here.

## issues and recovery

- Initial `task.start` used an invalid `startFrom` string; retried with `stream`.
- The first taskless skill read reproduced `AMBIGUOUS_TASK_SELECTION`; investigation continued with an explicit branch until the fix existed.
- The first OS mirror patch referenced a workspace-only PR variable; focused tests caught it and the OS-specific branch contract was corrected.
- The first description patch missed JSON hunk locations; exact counted replacement was used.
- A broad facade test generated snapshots and unrelated failures; snapshot changes were restored and owned suites were validated separately.
- Temporary benchmark fixtures were removed with `fs.trash`.

## workspace-owned: files changed

- `packages/os/scripts/fs.js`
- `packages/os/scripts/lib/facade/executor.ts`
- `packages/os/scripts/lib/facade/schemas.ts`
- `packages/os/scripts/lib/fs/read.ts`
- `packages/os/tests/facade/facade.test.ts`
- `packages/os/tests/fs-read.test.ts`
- `packages/os/tests/tool-manifest.test.ts`
- `packages/os/tooling/dev-tool-manifest.json`
- `packages/workspace/scripts/lib/facade/executor.ts`
- `packages/workspace/scripts/lib/facade/schemas.ts`
- `packages/workspace/tests/facade/facade.test.ts`
- `packages/workspace/tests/fs-read.test.ts`
- `packages/workspace/tests/server_call_test.py`
- `packages/workspace/tooling/tool-manifest.json`

## workspace-owned: activity log

- 2026-07-21 03:20:09 fs.write: `.task/workspace-agents/fix-taskless-read-only-fs-routing-and-benchmark-code-mode/workpad.md`
- managed by workspace hooks

## workspace-owned: validation evidence

- workspace FS/manifest: `trc_959192e5157a`
- workspace focused facade: `trc_6b5f3f4d4391`
- OS FS/manifest: `trc_16aa925501a4`
- OS focused facade: `trc_9f198a88a25c`
- server-call suite: `trc_1de20aa9894c`
- changed-file validation: `trc_9af8adb6c96e`
- 2026-07-21 03:20:39 `verify`: passed — OK

---

## publish checklist

```bash
bun run task:push -- --message "fix(workspace): allow taskless read-only fs operations" --changed
bun run task:pr
bun run task:finish
```

- 2026-07-21 03:20:09 write: `.task/workspace-agents/fix-taskless-read-only-fs-routing-and-benchmark-code-mode/workpad.md`

## workspace-owned: test selection

- changed files: `.task/tasks/workspace-agents/fix-taskless-read-only-fs-routing-and-benchmark-code-mode.json`, `.task/workspace-agents/fix-taskless-read-only-fs-routing-and-benchmark-code-mode/current.json`, `.task/workspace-agents/fix-taskless-read-only-fs-routing-and-benchmark-code-mode/evidence-log.json`, `.task/workspace-agents/fix-taskless-read-only-fs-routing-and-benchmark-code-mode/read-log.json`, `.task/workspace-agents/fix-taskless-read-only-fs-routing-and-benchmark-code-mode/session.json`, `.task/workspace-agents/fix-taskless-read-only-fs-routing-and-benchmark-code-mode/workpad.md`, `packages/os/manifests/core.manifest.json`, `packages/os/manifests/tool.manifest.json`, `packages/os/manifests/workflow-bundles.json`, `packages/os/scripts/fs.js`, `packages/os/scripts/lib/facade/executor.ts`, `packages/os/scripts/lib/facade/schemas.ts`, `packages/os/scripts/lib/fs/read.ts`, `packages/os/tests/facade/facade.test.ts`, `packages/os/tests/fs-read.test.ts`, `packages/os/tests/tool-manifest.test.ts`, `packages/os/tooling/dev-tool-manifest.json`, `packages/workspace/scripts/lib/facade/executor.ts`, `packages/workspace/scripts/lib/facade/schemas.ts`, `packages/workspace/tests/facade/facade.test.ts`, `packages/workspace/tests/fs-read.test.ts`, `packages/workspace/tests/server_call_test.py`, `packages/workspace/tooling/tool-manifest.json`
- matched rules: `workspace-facade`
- selected suites: `workspace facade input contracts`
- run results: `workspace facade input contracts` passed
- failed suites: none
