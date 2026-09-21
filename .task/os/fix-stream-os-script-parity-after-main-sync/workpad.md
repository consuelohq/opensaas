# fix stream os script parity after main sync

branch: `task/os/fix-stream-os-script-parity-after-main-sync`
stream: `stream/os`
pr: https://github.com/consuelohq/opensaas/pull/2518
started: 2026-09-21

## acceptance criteria

- [ ] Define explicit task acceptance criteria before coding.

## plan

1. Read the relevant code and update this plan before editing.

## files changed

- none yet

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

## acceptance criteria

- [x] The OS script parity inventory matches the post-main-sync stream/os filesystem exactly.
- [x] The change preserves intentional script classifications; it does not reintroduce retired Twenty/legacy CI scripts or drop active Consuelo scripts.
- [x] Focused parity audit passes on the same merged stream state that failed GitHub CI.
- [x] Strict review and full verify pass against origin/stream/os before promotion.
- [ ] PR #2499 can complete its checks and enter the canonical canary release path.

## plan

1. Inspect the parity audit inventory/classification source and current filesystem delta.
2. Reproduce the exact parity audit failure as the focused RED.
3. Update only the authoritative inventory/classification data required by the merged filesystem.
4. Run focused GREEN, strict review, and full verify.
5. Promote the task into stream/os, wait for PR #2499 checks, then release #2499 to canary.

## progress

- RED reproduced the GitHub failure: exhaustive inventory mismatch after the main/stream merge.
- Reconciled the baseline with 534 live script paths: removed six retired legacy CI entries, added OS-owned ci-plan.ts and artifact-sharing.ts, and reclassified scripts/lib/git.js for its real content drift.
- GREEN: focused script parity audit passes 1/1.
- Strict review: 0 task issues and 0 blockers.
- Full verify: passed; publish-valid stamp recorded. Ten typecheck findings in dialer-server were classified pre-existing and unrelated.

## Test-first contract

behavior under test: the OS script parity classifier enumerates exactly the scripts that exist after merging current main into stream/os, while retaining explicit classification for active Consuelo scripts and excluding deleted legacy scripts.
existing local pattern: packages/os/tests/audit/script-parity-audit.test.ts builds a live script inventory and compares it to the baseline's sorted script keys.
new or changed tests: no new assertion is needed; the existing exhaustive inventory contract is the regression test.
focused red command: bun --cwd packages/os test tests/audit/script-parity-audit.test.ts
expected red failure: current baseline and filesystem disagree on ci-plan.ts, removed artifact-sharing.ts, and legacy CI helper/baseline files after the main/stream merge.
no-test waiver: not applicable.

- 2026-09-21 15:39:38 append: `.task/os/fix-stream-os-script-parity-after-main-sync/workpad.md`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-09-21 15:39:38 fs.write: `.task/os/fix-stream-os-script-parity-after-main-sync/workpad.md`

## workspace-owned: files read

- `packages/os/scripts/ci-plan.ts`
- `packages/os/scripts/server/services/artifact-sharing.ts`
- `packages/os/tests/audit/fixtures/script-parity-classifications.json`
- `packages/os/tests/audit/script-parity-audit.test.ts`
- `packages/workspace/scripts/ci-plan.ts`
- `packages/workspace/scripts/server/services/artifact-sharing.ts`

- 2026-09-21 15:41:35 apply-patch: `packages/os/tests/audit/fixtures/script-parity-classifications.json`

## workspace-owned: validation evidence

- 2026-09-21 15:42:57 `review.run`: passed — OK
- 2026-09-21 15:42:58 `review.run`: passed — OK
- 2026-09-21 15:43:26 `verify`: passed — OK

- 2026-09-21 15:43:39 apply-patch: `.task/os/fix-stream-os-script-parity-after-main-sync/workpad.md`