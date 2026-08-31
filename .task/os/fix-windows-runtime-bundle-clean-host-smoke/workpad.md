# Fix Windows runtime bundle clean-host smoke

branch: `task/os/fix-windows-runtime-bundle-clean-host-smoke`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1905/fix-windows-runtime-bundle-clean-host-smoke
github pr: https://github.com/consuelohq/opensaas/pull/1905
started: 2026-08-13

## acceptance criteria

- [x] Bind the fix to the exact failed Windows distribution job and step.
- [x] Make the clean-host archive test follow real activation order by materializing frozen production dependencies before invoking runtime code.
- [x] Assert a required runtime dependency exists inside the extracted release root.
- [ ] Push directly to main through the approved hotfix path and rerun signed runtime publication.

## plan

1. Inspect the exact Windows failure and real lifecycle materializer.
2. Add dependency materialization and an extracted-root assertion to the clean-host test.
3. Run the focused archive suite locally, push/merge to main, and follow the replacement release workflow.

## current status

- Focused archive tests and package syntax checks are green; ready for the approved hotfix push.

## files changed

- `packages/os/tests/distribution/runtime-bundle.test.ts`

## workspace-owned: files changed

- Same as files changed; task metadata/workpad are workspace-owned.

## workspace-owned: activity log

- Immutable RED evidence: Actions run `31724243724`, Windows native distribution job `94528547190`, failed resolving `zod` from the extracted archive before dependencies were materialized.
- Implemented frozen production dependency materialization inside the extracted runtime root.

## workspace-owned: validation evidence

- GREEN: `runtime-bundle.test.ts` plus the workspace-closure contract passed, 22/22 tests; OS syntax checks and `git diff --check` passed.

## key decisions

- This test-only correction unblocks the already merged runtime dependency hotfix; it does not change shipped runtime behavior.
- Use PATH-resolved `bun install --frozen-lockfile --production`, matching lifecycle materialization and the test suite's existing cross-platform runtime calls.

## notes for ko

- none

## improvements noticed

- Release run `31724243724` failed before release allocation/channel mutation; a new main commit will start a fresh publication.

## issues and recovery

- First local attempt used `process.execPath`, which is Node under Vitest and tried to execute an `install` module. Corrected to PATH-resolved `bun`.

---

## publish checklist

```bash
bun run task:push -- --message "type(os): description" --changed
bun run task:pr
bun run task:finish
```

## Discovery — Windows clean-host archive smoke

- Exact failed job: release run 31724243724, Windows native distribution, `runtime-bundle.test.ts` clean-host inventory parity.
- Failure: extracted archive invoked lifecycle before dependencies existed (`ENOENT` resolving `zod`).
- Real activation order materializes production dependencies before restart/health; the test must do the same.
- Test-first contract: the live failed Windows job is RED immutable evidence; add a materialization assertion before the extracted runtime is invoked.

- 2026-08-13 17:17:31 apply-patch: `packages/os/tests/distribution/runtime-bundle.test.ts`
- 2026-08-13 17:17:31 apply-patch: `.task/os/fix-windows-runtime-bundle-clean-host-smoke/workpad.md`
- 2026-08-13 17:18:02 apply-patch: `packages/os/tests/distribution/runtime-bundle.test.ts`

- 2026-08-13 17:18:53 apply-patch: `.task/os/fix-windows-runtime-bundle-clean-host-smoke/workpad.md`