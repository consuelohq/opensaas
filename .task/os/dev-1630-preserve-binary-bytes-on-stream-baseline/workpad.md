# DEV-1630 preserve binary bytes on stream baseline

branch: `task/os/dev-1630-preserve-binary-bytes-on-stream-baseline`
stream: `stream/os`
pr: https://github.com/consuelohq/opensaas/pull/2695
started: 2026-10-29

## acceptance criteria

- [x] Both workspace and OS task.push publishers preserve raw binary bytes for --changed and --files.
- [x] Exact Git blob hashes for invalid UTF-8, NUL, PNG, WebP, plus ordinary text and deletions.
- [x] GitHub API mocked blob transport and real local bare-Git remote local sync round-trip.
- [x] Critical publish selectors cover both mirrored publisher scripts without unrelated OS daemon suite.
- [x] All 163 focused tests green; strict review zero issues; no runtime/app assets touched.
- [ ] Formal verify publish-valid, task PR -> stream promotion, task finish.
- [ ] Live GitHub binary fixture readback remains separate from this deterministic regression.

- [ ] Define explicit task acceptance criteria before coding.

## plan

1. Read the relevant code and update this plan before editing.

## files changed

- `packages/os/scripts/task-push.js`
- `packages/workspace/scripts/task-push.js`
- `packages/workspace/test-selection.registry.json`
- `packages/workspace/test-selection.rules.json`
- `packages/workspace/tests/task-push-binary.test.ts`
- `packages/workspace/tests/test-selection.test.js`

## key decisions

- No cherry-pick of main-based task commit into stale stream: reconstructed only DEV-1630's test and four-line bugfix against origin/stream/os.
- Required explicit critical OS publisher rule is `exclusive:true` for only `packages/os/scripts/task-push.js`, not other OS code.
- Preserve JSON text behavior and existing GitHub base64 blob serialization; use raw Buffers from disk only.

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

- `packages/workspace/test-selection.rules.json`
- `packages/workspace/tests/test-selection.test.js`

## DEV-1630 stream-baseline recovery and Test-first contract (2026-10-29)
- Upstream issue: https://linear.app/consuelo/issue/DEV-1630 ; original main-based task PR #2690 published `4649db550341d4edb144e18f7b0c5cdfc70b80ba`, verified but cannot merge into stream/os because its generated test registry conflicts with stream source. Keep original PR until this replacement stream-based branch is integrated.
- This is the same DEV-1630 fix rebased onto the correct explicit `origin/stream/os` baseline, avoiding import of unrelated main changes and the known red OS package daemon suite. Preserve all existing stream commits and collaborators' edits.
- Read both current stream publisher sources; confirmed original bug on lines 335/358 (workspace) and 294/317 (OS), both decoding binary filesystem bytes as UTF-8 before GitHub blob base64. GitHub API serializer already calls Buffer.from(content).toString('base64').
- Behavior under test: exact raw blob SHA for invalid UTF-8, NUL, PNG and WebP from both `--changed` and `--files`, mixed text/deletion semantics, unchanged JSON strings, and clean real bare Git remote sync.
- Existing pattern: both publishers use resolveChangedFiles/resolveFilesFromPaths and shared GitHub createBlob; selector tests live in `packages/workspace/tests/test-selection.test.js`.
- New tests: port previously RED/GREEN tested `packages/workspace/tests/task-push-binary.test.ts` from original `4649db5` commit into this isolated stream task. Add a selector test to protect critical OS-mirror routing.
- Focused RED command: `bun x vitest run packages/workspace/tests/task-push-binary.test.ts` before production edits. Expected 4 byte-hash failures, 2 unaffected JSON-text passes (real Git roundtrip cases may pass independently). No-test waiver: none.
- Plan: reproduce RED on stream; apply four-line Buffer fix, narrow critical exclusive selector, generated registry and selector regression, GREEN + 163 tests; strict review/verify against origin/stream/os; task.push → task.pr → task.finish. Do not merge main, deploy, or update installed runtime. Keep follow-up real GitHub binary readback explicit.

- 2026-10-29 20:35:50 append: `.task/os/dev-1630-preserve-binary-bytes-on-stream-baseline/workpad.md`

## workspace-owned: files changed

- `packages/os/scripts/task-push.js`
- `packages/workspace/scripts/task-push.js`
- `packages/workspace/test-selection.registry.json`
- `packages/workspace/test-selection.rules.json`
- `packages/workspace/tests/task-push-binary.test.ts`
- `packages/workspace/tests/test-selection.test.js`

## workspace-owned: activity log

- 2026-10-29 20:35:50 fs.write: `.task/os/dev-1630-preserve-binary-bytes-on-stream-baseline/workpad.md`
- 2026-10-29 20:37:50 apply-patch: `packages/workspace/scripts/task-push.js`
- 2026-10-29 20:37:50 apply-patch: `packages/os/scripts/task-push.js`
- 2026-10-29 20:38:11 apply-patch: `packages/workspace/tests/test-selection.test.js`
- 2026-10-29 20:38:28 apply-patch: `packages/workspace/test-selection.rules.json`
- 2026-10-29 20:39:30 fs.write: `.task/os/dev-1630-preserve-binary-bytes-on-stream-baseline/workpad.md`

## workspace-owned: validation evidence

- 2026-10-29 20:39:04 `review.run`: passed — OK
- 2026-10-29 20:39:17 apply-patch: `.task/os/dev-1630-preserve-binary-bytes-on-stream-baseline/workpad.md`
- 2026-10-29 20:40:00 `verify`: passed — OK

## TDD, regression, review and recovery evidence (2026-10-29)
- Stream-baseline RED binary tests: `bun x vitest run packages/workspace/tests/task-push-binary.test.ts`, 4 exact-byte failures (both publishers x --changed/--files) and 4 control passes; trace `trc_1ebd803be9e7`.
- Minimal production changes: removed `'utf8'` from both `fs.readFileSync` disk-file entry points in both mirrored publishers (four statements total); text metadata reads untouched.
- GREEN binary tests: 8/8 passed, trace `trc_2c8fa5477d45`. Mocked GitHub blob transport checks byte-exact base64 payload and Git object SHA; actual bare Git remote tests check binary blob hash equality and clean `git status --porcelain`.
- Selector TDD RED: `bun x vitest run packages/workspace/tests/test-selection.test.js -t 'routes OS task.push binary changes'` failed expected missing critical ownership, trace `trc_37cf0870995c`.
- Selector GREEN: added critical exclusive rule for ONLY OS publisher and augmented workspace publish-gate; regenerated selector registry using canonical `bun run test-selection:generate -- --json`, 714 files / 83 rules / 70 explicit, trace `trc_4c33a0465ad0`.
- Focused post-change validation: nine test suites, 163/163 tests pass; selector `bun run test-selection:check -- --base origin/stream/os --json` chooses exactly three critical suites (workspace-publish-gate, os-task-push-binary-publication, workspace-test-selection), not broad historically failing OS daemon test; both publishers pass `node --check`; `git diff --check` clean, trace `trc_cb3cbb670078`.
- Strict review against `origin/stream/os`: 0 your issues, 0 pre-existing, 0 blockers, 0 doc opportunities. Relevant files remain six production/test/selector files; no asset/OS runtime modification.
- Original main-based task PR #2690 and SHA `4649db550341d4edb144e18f7b0c5cdfc70b80ba` were tested/published successfully but not mergeable to the older stream. This stream-based task #2695 avoids importing unrelated main commits; after it merges, close #2690 as superseded.
- Outstanding: live provider GitHub binary fixture readback and installed runtime rollout (not part of DEV-1630 ship/no deploy constraint).

- 2026-10-29 20:39:30 append: `.task/os/dev-1630-preserve-binary-bytes-on-stream-baseline/workpad.md`
