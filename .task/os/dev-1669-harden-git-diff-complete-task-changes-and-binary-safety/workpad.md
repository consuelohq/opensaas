# DEV-1669 harden git.diff complete task changes and binary safety

branch: `task/os/dev-1669-harden-git-diff-complete-task-changes-and-binary-safety`
stream: `stream/os`
pr: https://github.com/consuelohq/opensaas/pull/2756
started: 2026-10-31

## acceptance criteria

- [x] Define explicit task acceptance criteria before coding.

## plan

1. Read the relevant code and update this plan before editing.

## files changed

- `packages/os/scripts/git-diff.js`
- `packages/os/tests/fixtures/tool-package-baseline.json`
- `packages/workspace/scripts/git-diff.js`
- `packages/workspace/test-selection.rules.json`
- `packages/workspace/tests/git-diff.test.ts`

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

## DEV-1669 — Test-first contract

Scope: improve the typed git.diff task-worktree surface without weakening the revision-only contract or modifying other agents' files.

Behavior under test:
- Default working-tree diff includes staged and unstaged modifications, and untracked files; de-duplicate paths and preserve meaningful per-origin attribution.
- An explicit task/unified comparison includes committed changes since stream plus staged, unstaged and untracked work without replacing revision-only --base behavior.
- Binary/untracked files must not be decoded as UTF-8 or emitted as fake text patches.
- Rename paths and whitespace/Unicode paths, truncated patch/hunks and bounded output must remain honest.
- Reduce repeated git invocations when possible; measure against current implementation.

Existing tests: packages/workspace/tests/git-diff.test.ts exercises working tree, untracked text, base-only exclusion, path filters, truncation. OS runtime may have a separate implementation and must be inspected/kept in parity.

New tests: extend the same suite with red staged+unstaged/untracked-binary cases and unified mode, plus fixture paths/rename/truncation as appropriate.

Focused RED command: bun x vitest run packages/workspace/tests/git-diff.test.ts
Expected RED: staged changes absent; binary treated as a text patch; unified mode unavailable.
Waiver: none.

Plan: inspect OS runtime ownership, baseline and contract -> red tests -> smallest safe code fix -> focused green and review/verify -> publish task PR #2756 into stream/os only. No main merge/deploy.

- 2026-10-31 07:35:33 append: `.task/os/dev-1669-harden-git-diff-complete-task-changes-and-binary-safety/workpad.md`

## workspace-owned: files changed

- `packages/os/scripts/git-diff.js`
- `packages/os/tests/fixtures/tool-package-baseline.json`
- `packages/workspace/scripts/git-diff.js`
- `packages/workspace/test-selection.rules.json`
- `packages/workspace/tests/git-diff.test.ts`

## workspace-owned: activity log

- 2026-10-31 07:35:33 fs.write: `.task/os/dev-1669-harden-git-diff-complete-task-changes-and-binary-safety/workpad.md`
- 2026-10-31 07:37:37 append: `packages/workspace/tests/git-diff.test.ts`
- 2026-10-31 07:37:37 fs.write: `packages/workspace/tests/git-diff.test.ts`
- 2026-10-31 07:38:37 apply-patch: `packages/workspace/scripts/git-diff.js`
- 2026-10-31 07:38:40 apply-patch: `packages/os/scripts/git-diff.js`
- 2026-10-31 07:39:24 fs.write: `packages/os/scripts/git-diff.js`
- 2026-10-31 07:39:25 fs.write: `packages/workspace/scripts/git-diff.js`
- 2026-10-31 07:42:18 fs.write: `packages/workspace/tests/git-diff.test.ts`
- 2026-10-31 07:43:19 fs.write: `packages/workspace/scripts/git-diff.js`
- 2026-10-31 07:43:21 fs.write: `packages/os/scripts/git-diff.js`
- 2026-10-31 07:44:03 fs.write: `packages/os/scripts/git-diff.js`
- 2026-10-31 07:44:03 fs.write: `packages/workspace/scripts/git-diff.js`
- 2026-10-31 07:46:36 fs.write: `packages/os/tests/fixtures/tool-package-baseline.json`
- 2026-10-31 07:47:09 fs.write: `packages/workspace/test-selection.rules.json`
- 2026-10-31 07:47:26 fs.write: `packages/workspace/tests/git-diff.test.ts`
- 2026-10-31 07:50:58 fs.write: `.task/os/dev-1669-harden-git-diff-complete-task-changes-and-binary-safety/workpad.md`

## workspace-owned: files read

- `packages/os/tests/fixtures/tool-package-baseline.json`
- `packages/workspace/scripts/git-diff.js`
- `packages/workspace/test-selection.rules.json`

- 2026-10-31 07:47:09 write: `packages/workspace/test-selection.rules.json`

- 2026-10-31 07:47:19 apply-patch: `packages/documentation/src/content/docs/reference/tools.mdx`
- 2026-10-31 07:47:26 append: `packages/workspace/tests/git-diff.test.ts`

## workspace-owned: validation evidence

- 2026-10-31 07:47:59 `review.run`: passed — OK
- 2026-10-31 07:48:20 apply-patch: `packages/workspace/tests/git-diff.test.ts`
- 2026-10-31 07:48:56 apply-patch: `packages/workspace/scripts/git-diff.js`
- 2026-10-31 07:49:05 apply-patch: `packages/os/scripts/git-diff.js`
- 2026-10-31 07:50:40 `verify`: passed — OK

## Completion evidence — DEV-1669

- RED: 5/5 new focused regressions intentionally failed against old git.diff; later additional rename-hunk and multibyte cap tests reproduced concrete failures.
- GREEN: 15/15 git.diff tests; combined with OS+Workspace manifests and selector suites: 134/134 passing.
- New default working-tree diff includes staged+unstaged tracked edits and untracked files. Explicit `--task --base <ref>` returns cumulative committed+staged+unstaged+untracked while original `--base <ref>` remains revision-only.
- Binary untracked content no longer UTF-8 decoded, symlinks not dereferenced, exact tab/space rename paths preserved in stats and hunks, truncated patch never generates fabricated complete hunks, UTF8 codepoint capping safe.
- OS and Workspace git-diff scripts kept byte-identical, typed `task?:boolean` surfaced through schemas/OS handler/manifest/generated d.ts, critical selector keeps package-level unrelated failures from hiding attributable results.
- Benchmark: 50 tracked files, 20 unstaged modifications, seven measured consecutive runs after warmup: median old 91.1 ms vs new 67.9 ms (1.34x faster). Comparable summary and file metadata identical; includes process startup, not only Git computation.
- Documentation validation successful (105 pages). Strict review zero issues. Full verify `passed=true`, `publishValid=true`, 10 critical selected suites passing, zero DB findings; stamp written.
- Publication target: PR #2756 into stream/os only; no main merge/deploy or changes to other agents' worktrees.

- 2026-10-31 07:50:58 write: `.task/os/dev-1669-harden-git-diff-complete-task-changes-and-binary-safety/workpad.md`
