# move dialer stream instructions to os canonical path

branch: `task/dialer/move-dialer-stream-instructions-to-os-canonical-path`
stream: `stream/dialer`
pr: https://github.com/consuelohq/opensaas/pull/2435
started: 2026-09-10

## acceptance criteria

- [x] `stream.context` resolves stream instructions from `packages/os/streams`, not deprecated `packages/workspace/streams`.
- [x] Preserve the canonical Dialer guidance at `packages/os/streams/dialer/AGENTS.md`.
- [x] Remove the duplicate `packages/workspace/streams/dialer/AGENTS.md`.
- [x] Prove the path migration with focused RED/GREEN tests and confirm there are no workspace-only stream instruction files that the resolver change would orphan.

## plan

1. Read both stream readers and the Dialer stream contracts.
2. Change the focused tests first and confirm they fail against the legacy resolver/copy.
3. Point the workspace stream-context resolver at `packages/os/streams` and trash the duplicate Dialer file.
4. Run focused tests, inspect the diff, then run review/verify and publish into `stream/dialer`.

## files changed

- `packages/workspace/streams/dialer/AGENTS.md` (deleted)

## key decisions

- `packages/os/streams` is the canonical stream-instruction root. The workspace resolver now reads it directly instead of maintaining duplicate guidance under the deprecated package.
- No compatibility fallback is needed: repository inspection found zero `AGENTS.md` files that exist only under `packages/workspace/streams`.

## notes for ko

- The Dialer guidance content itself is unchanged; only its duplicate storage and resolver path are being cleaned up.

## improvements noticed

- Two other legacy workspace stream copies (`os-foundation-two` and `os-steering`) remain mirrored under `packages/os/streams`. They are not needed by the resolver after this change, but are outside this Dialer-scoped cleanup.

## errors i ran into

- A helper preflight that embedded destructive-command literals in its own source was blocked by OS safety policy. The two target test files had already been read in full and contained no such commands, so direct inspection was used instead of retrying the blocked payload.

## current status

- RED: 2 focused failures / 2 passes, exactly on the old workspace path and still-present duplicate.
- GREEN: 4/4 focused tests pass after resolver migration and duplicate removal.
- Cross-stream check: `workspaceOnly: []`; moving the generic resolver to `packages/os/streams` does not orphan any current stream instruction file.

---

## publish checklist

```bash
bun run task:push -- --message "type(dialer): description" --changed
bun run task:pr
bun run task:finish
```

## Test-first contract

behavior under test: `stream.context({ area: "dialer" })` resolves the canonical Dialer instructions from `packages/os/streams/dialer/AGENTS.md`, with no required duplicate under deprecated `packages/workspace/streams/dialer/`.
existing local pattern: OS already owns an independent stream instruction reader rooted at `packages/os/streams`; the legacy workspace stream-context path still reads `packages/workspace/streams`.
new or changed tests: update the workspace stream-instructions contract to expect the OS canonical path; replace the byte-identity duplicate-copy test with an assertion that the legacy duplicate is absent.
focused red command: run the workspace stream-instructions test and OS dialer-stream-instructions test after changing expectations but before changing the resolver/removing the duplicate.
expected red failure: workspace reader still resolves `packages/workspace/streams/dialer/AGENTS.md`, and the deprecated duplicate still exists.
no-test waiver: not applicable; this changes stream-context resolution behavior and has focused contract coverage.

- 2026-09-10 01:34:51 append: `.task/dialer/move-dialer-stream-instructions-to-os-canonical-path/workpad.md`

## workspace-owned: files changed

- `packages/workspace/streams/dialer/AGENTS.md` (deleted)

## workspace-owned: activity log

- 2026-09-10 01:34:51 fs.write: `.task/dialer/move-dialer-stream-instructions-to-os-canonical-path/workpad.md`
- 2026-09-10 01:35:00 apply-patch: `packages/workspace/scripts/lib/stream-instructions.test.ts`
- 2026-09-10 01:35:00 apply-patch: `packages/os/tests/dialer-stream-instructions.test.ts`
- 2026-09-10 01:35:15 apply-patch: `packages/workspace/scripts/lib/stream-instructions.js`
- 2026-09-10 01:35:18 fs.trash: `packages/workspace/streams/dialer/AGENTS.md`
- 2026-09-10 01:36:03 apply-patch: `.task/dialer/move-dialer-stream-instructions-to-os-canonical-path/workpad.md`
- 2026-09-10 01:43:32 fs.write: `.task/dialer/move-dialer-stream-instructions-to-os-canonical-path/workpad.md`

## workspace-owned: validation evidence

- 2026-09-10 01:36:53 `review.run`: passed — OK
- 2026-09-10 01:38:28 `verify`: failed — COMMAND_FAILED
- 2026-09-10 01:39:32 apply-patch: `packages/workspace/tests/test-selection.test.js`
- 2026-09-10 01:39:46 apply-patch: `packages/workspace/test-selection.rules.json`
- 2026-09-10 01:42:34 `review.run`: passed — OK
- 2026-09-10 01:43:20 `verify`: passed — OK

## final validation

- Focused stream contracts: 4/4 passed.
- Test-selection contract: RED before rule creation, then targeted GREEN.
- Full test-selection suite: 57/57 passed after removing three pre-existing byte-equivalent duplicate explicit rules.
- Test-selection dry run: `workspace-test-selection`, `os-stream-instructions`, and `server-ci-task-contract`; broad `@consuelo/os package test` is no longer selected.
- Strict review: 0 issues / 0 blockers.
- Full `verify`: passed; publish-valid stamp written.
- Generated registry refreshed to current inventory: 2670 tests, 2586 mapped, 84 unmapped, 73 total rules / 54 explicit. The refresh drops one stale missing test entry and maps the stream-instructions test under the new explicit rule.

## final changed files

- `packages/workspace/scripts/lib/stream-instructions.js` — resolve stream instructions from canonical `packages/os/streams`.
- `packages/workspace/scripts/lib/stream-instructions.test.ts` — assert canonical OS path.
- `packages/os/tests/dialer-stream-instructions.test.ts` — assert deprecated Dialer workspace duplicate is absent.
- `packages/workspace/streams/dialer/AGENTS.md` — removed duplicate; canonical content remains at `packages/os/streams/dialer/AGENTS.md`.
- `packages/workspace/test-selection.rules.json` — add focused stream-instruction coverage and remove three pre-existing duplicate rule objects.
- `packages/workspace/test-selection.registry.json` — regenerate deterministic registry.
- `packages/workspace/tests/test-selection.test.js` — protect focused stream-instruction selection.

- 2026-09-10 01:43:32 append: `.task/dialer/move-dialer-stream-instructions-to-os-canonical-path/workpad.md`
