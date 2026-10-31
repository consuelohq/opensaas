# DEV-1669 stream-aligned git.diff integration preserving context changes

branch: `task/os/dev-1669-stream-aligned-git-diff-integration-preserving-context-changes`
stream: `stream/os`
pr: https://github.com/consuelohq/opensaas/pull/2761
started: 2026-10-31

## acceptance criteria

- [x] Define explicit task acceptance criteria before coding.

## plan

1. Read the relevant code and update this plan before editing.

## files changed

- `packages/os/scripts/git-diff.js`
- `packages/os/tests/fixtures/tool-package-baseline.json`
- `packages/workspace/scripts/git-diff.js`
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

## DEV-1669 — Stream-aligned conflict recovery

Prior implementation: taskSession `tsk_10e591a21fbd`, PR #2756, SHA `aea947b81f6a094311a9c82e0bdea28f28453898`. It passed all 15 git.diff tests, 134 focused tests, full verify publish-valid, but GitHub reported non-metadata conflicts with current stream/os (the DEV-1667 stream.context compact release). Never overwrite newly shipped stream.context changes or force the PR.

## Test-first contract

behavior under test: identical git.diff fixes from verified source task, but rebased semantically onto newest stream/os without losing stream.context full:true, its type definitions, registry, generated manifests, docs, or workpad.

existing local pattern: packages/workspace/tests/git-diff.test.ts (5 older tests on new stream), packages/os/scripts/git-diff.js and workspace scripts are identical before integration.

new or changed tests: port 15 verified git.diff regression tests to this branch, run RED before porting production code; after changes, run both stream-context and git.diff focused/manifest/selector suites to prove coexistence.

focused red command: bun x vitest run packages/workspace/tests/git-diff.test.ts

expected red failure: missing --task, incomplete staged changes, unsafe binary, quoted rename/hunk, truncated partial output.

no-test waiver: none.

Plan: copy tests RED, copy only isolated git.diff scripts + handler, patch existing stream schemas/fixtures/docs/rules in place without dropping DEV-1667, regenerate manifests/types/registry, focused GREEN, full review+verify, push PR #2761 to stream/os. After successful stream promotion close superseded #2756. No main merge or deploy.

## Measured source-task evidence

7-run 50-file fixture benchmark: original 91.1ms vs updated 67.9ms median (34% faster), with identical comparable file/summary outputs. Original test suite 15/15 and full verify 10 selected suites pass.

- 2026-10-31 07:52:19 append: `.task/os/dev-1669-stream-aligned-git-diff-integration-preserving-context-changes/workpad.md`

## workspace-owned: files changed

- `packages/os/scripts/git-diff.js`
- `packages/os/tests/fixtures/tool-package-baseline.json`
- `packages/workspace/scripts/git-diff.js`
- `packages/workspace/tests/git-diff.test.ts`

## workspace-owned: activity log

- 2026-10-31 07:52:19 fs.write: `.task/os/dev-1669-stream-aligned-git-diff-integration-preserving-context-changes/workpad.md`
- 2026-10-31 07:52:28 write: `packages/workspace/tests/git-diff.test.ts`
- 2026-10-31 07:52:28 fs.write: `packages/workspace/tests/git-diff.test.ts`
- 2026-10-31 07:52:59 write: `packages/os/scripts/git-diff.js`
- 2026-10-31 07:52:59 fs.write: `packages/os/scripts/git-diff.js`
- 2026-10-31 07:53:04 write: `packages/os/tools/git/handler.ts`
- 2026-10-31 07:53:04 write: `packages/workspace/scripts/g
- 2026-10-31 07:53:04 fs.write: `packages/workspace/scripts/git-diff.js`
- 2026-10-31 07:53:23 apply-patch: `packages/workspace/scripts/lib/facade/schemas.ts`
- 2026-10-31 07:53:31 apply-patch: `packages/os/scripts/lib/facade/schemas.ts`
- 2026-10-31 07:53:47 write: `packages/workspace/test-selection.rules.json`
- 2026-10-31 07:53:47 write: `packages/os/tests/fixtures/tool-package-baseline.json`
- 2026-10-31 07:53:47 fs.write: `packages/os/tests/fixtures/tool-package-baseline.json`
- 2026-10-31 07:53:52 apply-patch: `packages/documentation/src/content/docs/reference/tools.mdx`
- 2026-10-31 07:56:27 fs.write: `.task/os/dev-1669-stream-aligned-git-diff-integration-preserving-context-changes/workpad.md`

## workspace-owned: validation evidence

- 2026-10-31 07:54:16 `review.run`: passed — OK
- 2026-10-31 07:55:22 `verify`: failed — COMMAND_FAILED
- 2026-10-31 07:57:10 `verify`: passed — OK

## Formal verification retry evidence

First full verify selected 10 suites and found one failure in the existing OS lifecycle update handoff suite (1/236 failed); attributable git.diff, manifest and selector focused tests plus static review passed. Isolated the exact same 22-file OS lifecycle command from the current test-selection registry and reran it unchanged: **236/236 passed** in 18.4s, without code modifications. Failure was transient/test timing in independent lifecycle testing, not a git.diff functional regression. Retry the whole verify gate on this same source; do not waive or suppress any critical suite. stream.context full:true and git.diff task:true both present in generated manifest and critical selector registry, and combined 142 focused tests passed.

- 2026-10-31 07:56:27 append: `.task/os/dev-1669-stream-aligned-git-diff-integration-preserving-context-changes/workpad.md`

## workspace-owned: files read

- none yet

## Final integration evidence
Ported verified git.diff scripts, OS handler and 15 regression tests from source PR #2756 onto current stream/os, preserving DEV-1667 stream.context full mode, schemas, manifests, registry, docs and workpad.
Test-first RED: 10/15 failed on initial source from current stream, then GREEN: 15/15. Five combined focus suites (git.diff, stream.context, selector, OS/Workspace manifests): 142/142 passed.
Strict review: 0 blocking issues. Documentation validated 105 pages. Full verification initially encountered one intermittent lifecycle failure; isolated exact 22-file suite passed 236/236 unchanged; complete verification rerun passed all 10 selected suites, publishValid=true, DB guard 0 findings.
The original 50-file benchmark measured median 91.1ms before versus 67.9ms after over seven runs (1.34x faster), matching comparable file and summary output.
Untracked binary files never decoded as text, symlinks not dereferenced, staged and unstaged changes included, cumulative task mode task:true with base, revision-only base remains available, exact renamed and UTF-8 paths safe, incomplete hunk previews omitted.
Workpad contained 12 NUL bytes after automated write/log activity; detected with bounded byte inspection and stripped only those NUL bytes from this task-owned Markdown file. No other files modified by this recovery.
Target: PR #2761 -> stream/os only, never main or deploy; supersedes conflicting PR #2756 after safe promotion.
