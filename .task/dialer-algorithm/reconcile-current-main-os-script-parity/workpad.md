# reconcile current main OS script parity

branch: `task/dialer-algorithm/reconcile-current-main-os-script-parity`
stream: `stream/dialer-algorithm`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/2104/reconcile-current-main-os-script-parity
github pr: https://github.com/consuelohq/opensaas/pull/2104
started: 2026-08-16

## acceptance criteria

- [ ] Define explicit task acceptance criteria before coding.

## plan

1. Read the relevant code and update this plan before editing.

## current status

- Task started. Update this before publish.

## files changed

- none yet

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-08-16 02:49:44 fs.write: `.task/dialer-algorithm/reconcile-current-main-os-script-parity/workpad.md`

## workspace-owned: validation evidence

- 2026-08-16 02:54:52 `review.run`: passed — OK
- 2026-08-16 02:55:06 `verify`: passed — OK
- 2026-08-16 02:55:27 `verify`: passed — OK

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
bun run task:push -- --message "type(dialer-algorithm): description" --changed
bun run task:pr
bun run task:finish
```

## Test-first contract

behavior under test: the Dialer stream's script-parity baseline must classify the complete OS script inventory of the actual current-main + stream merge candidate.
existing local pattern: `packages/os/tests/audit/fixtures/script-parity-classifications.json` classifies every OS/workspace script; OS-only scripts without a same-path Workspace counterpart use conservative `os-only-needs-review` entries until ownership is reviewed.
new or changed tests: no new test file; the existing script-parity audit is the executable contract. The authoritative RED is the combined-tree `stream.sync` run, which failed only because three current-main scripts were absent from the effective stream baseline.
focused red command: combined-tree `stream.sync` using the verified current stream-sync implementation.
expected red failure: parity audit reports exactly `scripts/lib/google-cloud-public-pricing-refresh.ts`, `scripts/lib/managed-cloud-public-pricing.ts`, and `scripts/lib/nodes-site.ts` as inventory entries without baseline classifications.
no-test waiver: not applicable; existing parity audit is the test.

## Acceptance criteria
- [x] Confirm the three current-main scripts are already classified in the stream baseline with no invented Workspace counterpart.
- [x] Prove an isolated main+stream Git merge contains both the three script files and the stream's 499-entry parity fixture.
- [x] Prevent `TASK_WORKTREE` / `TASK_BRANCH` from redirecting merge-candidate registry generation or verification back into the invoking task worktree.
- [x] Preserve generated-registry conflict recovery and all existing stream-sync semantics.
- [x] Focused stream-sync integration, strict review, and canonical verify are green.
- [x] Task is publish-ready for immediate post-promotion authoritative current-main + stream sync.

## Root cause
The parity classification data was already correct. `code.call` injects `TASK_WORKTREE` and `TASK_BRANCH`; `stream-sync` changed child `cwd` to the temporary merged worktree but inherited those routing variables. `packages/workspace/scripts/verify.js` explicitly honors `TASK_WORKTREE`, so the sync checks were silently redirected back to the unsynced task worktree. The stream baseline therefore appeared to have three stale classifications for scripts that were actually present in the merged candidate.

## Final validation
- Branch evidence: current `origin/main` contains all three pricing/nodes scripts; current stream fixture contains all three classifications.
- Fixture ancestry: `origin/main` parity fixture blob is byte-identical to merge-base, so the stream's 499-entry fixture is the merge result.
- Isolated temporary Git merge: all three script files exist and all three classifications exist before tests run.
- RED: generated-registry sync integration fails when fake verify/generator reject inherited task-routing env.
- GREEN: stream-sync integration 4/4 after merge-candidate child env removes `TASK_WORKTREE` / `TASK_BRANCH` and sets `PWD` to the candidate worktree.
- strict review: 0 issues / 0 blockers.
- canonical verify: `publishValid: true`, 0 DB risks/findings.

- 2026-08-16 02:49:44 append: `.task/dialer-algorithm/reconcile-current-main-os-script-parity/workpad.md`

## workspace-owned: files read

- `packages/os/tests/audit/script-parity-audit.test.ts`
- `packages/workspace/scripts/lib/git.js`
- `packages/workspace/scripts/stream-sync.js`
- `packages/workspace/tests/stream-sync-generated-registry-conflict.test.js`

- 2026-08-16 02:53:53 apply-patch: `packages/workspace/tests/stream-sync-generated-registry-conflict.test.js`
- 2026-08-16 02:54:11 apply-patch: `packages/workspace/scripts/stream-sync.js`

- 2026-08-16 02:55:20 apply-patch: `.task/dialer-algorithm/reconcile-current-main-os-script-parity/workpad.md`
