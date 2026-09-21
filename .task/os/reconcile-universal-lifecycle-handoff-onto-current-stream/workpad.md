# reconcile universal lifecycle handoff onto current stream

branch: `task/os/reconcile-universal-lifecycle-handoff-onto-current-stream`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1914/reconcile-universal-lifecycle-handoff-onto-current-stream
github pr: https://github.com/consuelohq/opensaas/pull/1914
started: 2026-08-13

## acceptance criteria

- [x] Preserve the already-reviewed #1909 universal lifecycle behavior on the current `stream/os` without creating a second updater.
- [x] Keep terminal `consuelo update` synchronous and daemon/agent update handoff durable and restart-safe.
- [x] Preserve manifest-backed `lifecycle.update` and `lifecycle.status` tool discovery.
- [x] Preserve macOS launchd, Linux systemd-user, and Windows breakaway lifecycle isolation semantics from #1909.
- [x] Semantically combine #1909 lifecycle test-selection coverage with newer stream rules, especially one-click managed-cloud coverage; never choose blanket ours/theirs.
- [x] Focused lifecycle/platform/facade/tool/selection tests pass on current stream.
- [x] Strict review and full verify against `origin/stream/os` are publish-valid before promotion.

## plan

1. Treat #1909 as the source implementation and current `stream/os` as the source of truth for surrounding code.
2. Port the lifecycle implementation/tests/docs/generated tool surface onto this current-stream task.
3. Resolve the two known shared test-selection JSON conflicts semantically and regenerate deterministic registry output.
4. Run the same lifecycle-focused contracts plus current selection tests, then strict review and full verify.
5. Push and promote this reconciliation task into `stream/os`; leave the superseded #1909 PR untouched unless Ko separately approves cleanup.

## Test-first contract

- Behavior under test: current `stream/os` must expose the #1909 lifecycle tool/update handoff contracts while retaining all newer test-selection ownership.
- Existing local pattern: #1909 already contains focused contract tests for lifecycle engine, native handoff, facade/tool surface, Windows behavior, manifest/layout, and selection routing.
- Test decision: reconciliation adds no new product behavior, so reuse those already-red/green contract tests as the executable specification rather than inventing a second specification.
- Pre-edit evidence: Git merge-tree reported only `packages/workspace/test-selection.rules.json` and `packages/workspace/test-selection.registry.json` as content conflicts; `test-selection.test.js` auto-merged.
- Reconciliation method: apply the exact #1909 product/test patch with three-way context, use current-stream rules as the base, add the lifecycle rule by ID, then regenerate the registry from the canonical generator.

## current status

- Implementation reconciled onto current stream and publish-valid.
- Ready for task push/promotion into `stream/os`.

## files changed

- `packages/workspace/test-selection.registry.json`
- `packages/workspace/test-selection.rules.json`

## validation evidence

- Lifecycle/platform/tool contracts: 9 files, 134/134 tests passed.
- Workspace selection contract: 22/22 tests passed and preserves both cloud and lifecycle ownership.
- Lifecycle facade snapshots: 9 selected tests passed (679 unrelated facade tests skipped).
- `node packages/os/scripts/check-syntax.js`: passed.
- `git diff --cached --check`: passed.
- Strict `review.run --base origin/stream/os --no-tests`: 0 issues, 0 blockers.
- Full `verify --base origin/stream/os`: passed, `publishValid: true`, DB guard 0 risks/findings.
- Test harness emits expected mocked lifecycle error/timeout logs and a non-fatal trace persistence warning when Vitest lacks `bun:sqlite`; assertions and exit status remain green.

## key decisions

- One universal lifecycle engine remains authoritative; this task does not fork updater logic.
- Newer stream selection rules are the surrounding source of truth; lifecycle-specific ownership is added alongside them.
- Generated selection registry was regenerated, not hand-merged.
- No deployment, channel promotion, node update, or Apple distribution work belongs in this reconciliation task.

## notes for ko

- Mac app work starts after this integrates into `stream/os`, so it consumes final lifecycle and Nodes contracts.
- Review surfaced nonblocking public-doc opportunities for CLI/tools; internal `SCRIPTS.md`/`TOOLS.md` are already updated. Public docs can follow with the next documentation pass rather than widening this reconciliation.
- Superseded #1909 is intentionally left untouched pending separate cleanup approval.

## improvements noticed

- The task workflow should eventually have a typed semantic restack/reconcile operation for a validated task PR whose only conflicts are shared generated/rule files.

## issues and recovery

- Direct `task.pr` on #1909 failed with GitHub 405 because current stream had non-metadata conflicts in two selection JSON files.
- Recovery used fresh current-stream task #1914; all lifecycle files applied cleanly and only those two shared JSON files conflicted.
- Conflict resolution preserved current stream's `os-managed-cloud-one-click-provisioning` and `os-vitest-runtime-regressions`, added `os-lifecycle-update-handoff`, and regenerated the registry.

---

## publish checklist

```bash
bun run task:push -- --message "feat(os): reconcile universal lifecycle handoff" --changed
bun run task:pr
bun run task:finish
```

- 2026-08-13 20:03:50 write: `.task/os/reconcile-universal-lifecycle-handoff-onto-current-stream/workpad.md`

## workspace-owned: files changed

- `packages/workspace/test-selection.registry.json`
- `packages/workspace/test-selection.rules.json`

## workspace-owned: activity log

- 2026-08-13 20:03:50 fs.write: `.task/os/reconcile-universal-lifecycle-handoff-onto-current-stream/workpad.md`
