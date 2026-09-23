# make release facade durable and exact sha resumable

branch: `task/os/make-release-facade-durable-and-exact-sha-resumable`
stream: `stream/os`
pr: https://github.com/consuelohq/opensaas/pull/2565
started: 2026-09-23

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

## workspace-owned: files read

- none yet

## resumed release-final state — 2026-09-23

### acceptance criteria

- [x] `release` start returns quickly with a durable operation id.
- [x] Equivalent repeated starts are idempotent and do not duplicate release work.
- [x] `status`, `logs`, `attach`, and `resume` work without the initiating MCP session.
- [x] Terminal state is durable, bounded, redacted, and does not persist GitHub/Cloudflare secrets.
- [x] Non-required review checks cannot hold a merge-ready release indefinitely.
- [x] Exact merged SHA resolves from immutable publication evidence even if `dev` advances.
- [x] Promotion correlation/locking and explicit channel transitions remain intact.
- [x] Generated release tool schema/manifest/docs and focused test-selection ownership match implementation.
- [x] Focused publish selector, strict review, and full verify were green before handoff.
- [ ] Push current local implementation, promote PR #2565 into `stream/os`, and complete the task lifecycle.

### plan

1. Preserve the already-validated local implementation; do not reimplement release durability.
2. Reconcile only current `stream/os` overlap. The stream advanced by six commits after this task head.
3. Verify the two overlapping fixture files against current `origin/stream/os`; preserve the newer stream truth.
4. Push the task branch, promote PR #2565 into `stream/os`, and finish the task.
5. Resume the existing `repair-cloudflare-workspace-edge-release-binding` task rather than creating a duplicate.
6. After release-path prerequisites are complete, promote current Canary to Stable using the durable release facade and verify exact-SHA/channel state.

### Test-first contract

- behavior under test: durable/retry-safe release operations plus immutable exact-SHA release resolution while preserving promotion security/correlation semantics.
- existing local pattern: the existing release orchestrator remains the state machine; new durability wraps it rather than duplicating orchestration.
- new or changed tests: `release-operation.test.ts`, `release-immutable.test.ts`, `release-orchestrator.test.ts`, `release-tool-surface.test.ts`, generated-tool contract coverage, focused test-selection coverage, plus lifecycle/publication fixtures.
- focused red command: inherited from the completed implementation cycle; the new durability/exact-SHA tests were introduced before implementation and exercised during the prior agent run.
- expected red failure: synchronous release surface lacked durable operation state/actions and historical exact-SHA resolution relied too heavily on mutable channel state.
- no-test waiver: none.

### inherited validation evidence

The release-final handoff records the following green evidence from this exact worktree before publication:

- Release-specific regression: 97/97 passed.
- Generated tool contract tests: 20/20 passed.
- `lifecycle-engine.test.ts`: 66/66 passed after carrying forward the installer-runtime fixture correction.
- Exact publish selector: passed end-to-end, including 231/231 lifecycle-handoff tests and release/security/tool-generation/workspace checks.
- Strict review: passed with zero blocking findings.
- Full `verify`: passed at 2026-09-23 22:43:56 local task time.

This evidence is inherited from the handoff and will be rerun only as needed if reconciliation changes task code.

### reconciliation evidence

- Task HEAD: `a4e0343878147cde1f13c2f8a69e8879fe4e3752`.
- Current `origin/stream/os`: `74d42089dc8e8a3981eb93705ef9f7e6a3f4f97a`.
- Relationship before publish: task is 1 commit ahead and 6 commits behind stream, with 25 working-tree files / 1,949 insertions / 48 deletions.
- Stream-only overlap is limited to `packages/os/tests/distribution/release-publication-preparer.test.ts` and `packages/os/tests/lifecycle-engine.test.ts`.
- The current working copies of both overlapping files hash exactly to the current `origin/stream/os` blobs, so the already-merged installer fixture truth is preserved.

### current status

Implementation is complete and locally present. No production code was modified during this resume pass; only task metadata/workpad recovery was performed. Next durable transition is `task.push`.

- 2026-09-23 23:17:23 append: `.task/os/make-release-facade-durable-and-exact-sha-resumable/workpad.md`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-09-23 23:17:23 fs.write: `.task/os/make-release-facade-durable-and-exact-sha-resumable/workpad.md`
