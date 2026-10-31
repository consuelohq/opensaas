# Publish compact steering against current OS stream

branch: `task/os/publish-compact-steering-against-current-os-stream`
stream: `stream/os`
pr: https://github.com/consuelohq/opensaas/pull/2740
started: 2026-10-31

## acceptance criteria

- [x] Recover red/green steering renderer changes on stream/os without unrelated main commits.
- [x] Preserve correct node routing, selected-skill filtering, current core tool discovery.
- [x] Verify focused tests, typecheck, and git diff checks.
- [x] Complete verify safety gate: publish-valid stamp, eight critical suites passed, zero review/blocking findings.
- [ ] Publish through stream/os.
- [ ] Close old PR #2738 after successful replacement.

## plan

1. Started from stream/os, preserving parallel stream history.
2. Applied updated tests first and captured 6 expected red failures; then patched only two renderer files.
3. Repeated 25 focused tests, typecheck and whitespace checks successfully.
4. Verify passed and recorded a publish-valid stamp; publish through managed task PR (in progress).
5. Close superseded PR #2738 and record exact stream SHA.

## files changed

- `packages/os/scripts/lib/steering-snapshot-cache.ts`
- `packages/os/scripts/os.ts`
- `packages/os/tests/os-get-steering-trace.test.ts`

## key decisions

- Preserve current stream's `finishSteeringExecution` trace behavior: original main-based task had an unrelated `content` trace field not present on current stream; intentionally retain stream version.
- Only transplant the three source and test files. Do not sync stream/os with main as a workaround for unrelated branch divergence.
- Existing user-owned `system.md` and three backups remain in place and are not committed to the OS repo.

## notes for ko

- Live local steering file is updated independently from installed renderer. Product change becomes active after approved OS release/install.

## improvements noticed

- Comparing exact files against old PR caught one unrelated `os.ts` trace-field difference from diverged main; kept current stream behavior.

## errors i ran into

- PR #2738 based on main could not merge into stream/os because stream and main diverged; replaced with stream-based task PR #2740 instead of merging unrelated changes.
- Correct red test on stream showed 6 failed/12 passed as expected. After implementation: 18 passed; full focused selection 25 passed.

---

## publish checklist

```bash
bun run task:push -- --message "type(os): description" --changed
bun run task:pr
bun run task:finish
```

## Acceptance criteria

- Publish exactly the already-verified steering renderer changes from original PR #2738 against current stream/os without unrelated main history.
- Offline-node count only, installed skill title/description only, compact effective core tools with typed discovery.
- Preserve routing fail-closed semantics and current OS tests, verify, review, and publish.
- Preserve user-owned live steering and historical backups without changing them again.
- Mark original PR #2738 superseded only once the replacement stream promotion succeeds.

## Plan

1. Start a fresh managed task from current stream/os because original main-based PR conflicted with unrelated stream divergence.
2. Reproduce focused failing tests on stream baseline; preserve red/green evidence.
3. Transplant precisely the three source/test file edits, excluding unrelated commits.
4. Validate focused, selected and typecheck; verify and publish into stream/os.
5. Close only superseded task PR #2738; record final stream PR and SHA.

## Test-first contract

behavior under test: OS getSteering must omit offline records while providing offline count, advertise installed skills by title + unchanged description only, and use compact core tool-name discovery without raw manifest dump.
existing local pattern: packages/os/tests/os-get-steering-trace.test.ts uses current fixture, runOsSnippet requires cwd packages/os.
new or changed tests: preserve same tested offline-node, skill projection, fallback selection and core tool assertions from PR #2738.
focused red command: bunx vitest run tests/os-get-steering-trace.test.ts from packages/os.
expected red failure: after transplanting tests alone, old stream renderer emits offline node bodies and verbose skill and tool metadata.
no-test waiver: not applicable; exactly the previously successful red/green contract is repeated on current stream baseline.

## Recovery context

- Original task PR #2738: https://github.com/consuelohq/opensaas/pull/2738, head 56ac4b8e717c08f63b4072cb06c78e7d12a35e3d, based on main and DIRTY against stream/os.
- The three source/test paths have no stream-side edits since merge-base 537d32d8a13, confirmed by git diff.
- This new branch starts directly from current stream/os, isolating the same changes and avoiding unrelated main commits.
- Local live file + backups already saved under ~/Consuelo/Steering/ and ~/Consuelo/Backups/steering/.

- 2026-10-31 05:44:27 append: `.task/os/publish-compact-steering-against-current-os-stream/workpad.md`

## workspace-owned: files changed

- `packages/os/scripts/lib/steering-snapshot-cache.ts`
- `packages/os/scripts/os.ts`
- `packages/os/tests/os-get-steering-trace.test.ts`

## workspace-owned: activity log

- 2026-10-31 05:44:27 fs.write: `.task/os/publish-compact-steering-against-current-os-stream/workpad.md`
- 2026-10-31 05:44:36 apply-patch: `packages/os/tests/os-get-steering-trace.test.ts`
- 2026-10-31 05:44:55 apply-patch: `packages/os/scripts/os.ts`
- 2026-10-31 05:44:55 apply-patch: `packages/os/scripts/lib/steering-snapshot-cache.ts`
- 2026-10-31 05:45:50 fs.write: `.task/os/publish-compact-steering-against-current-os-stream/workpad.md`

## workspace-owned: files read

- none yet

- 2026-10-31 05:45:21 apply-patch: `.task/os/publish-compact-steering-against-current-os-stream/workpad.md`
## Validation evidence (2026-10-31)

- Stream-based red: 6 expected assertion failures, 12 passing in os-get-steering-trace.test.ts before production patch.
- Green: bunx vitest run tests/os-get-steering-trace.test.ts tests/skill-selection-cli.test.ts tests/steering-canonical-source.test.ts (cwd packages/os): 25/25 passed.
- Typecheck: bunx nx run consuelo-os:typecheck: passed.
- git diff --check: passed.
- Exact-file comparison with original task: steering-snapshot-cache.ts and steering trace test are identical to the original verified PR; os.ts differs only by the existing stream trace-persistence field, intentionally left unchanged.
- Installed active metadata comparison: 10 selected skills + 15 core tools previously consumed 47,696 characters; new lists 3,751 characters (~92% reduction; 11,924 to 938 approximate tokens at 4 chars/token). The offline inventory savings are additional.
- Managed verify gate passed (publish-valid stamp, 8 critical selected suites, review/ESLint/typecheck/spec compliance/database guard passed, zero blocking findings).

- 2026-10-31 05:45:50 append: `.task/os/publish-compact-steering-against-current-os-stream/workpad.md`

## workspace-owned: validation evidence

- 2026-10-31 05:46:20 `verify`: passed — OK

- 2026-10-31 05:46:25 apply-patch: `.task/os/publish-compact-steering-against-current-os-stream/workpad.md`