# daily self healing 2026 09 01

branch: `task/self-healing/daily-self-healing-2026-09-01`
stream: `stream/self-healing`
pr: https://github.com/consuelohq/opensaas/pull/2372
started: 2026-09-02

## acceptance criteria

- [x] Reconcile accepted current `main` into `stream/self-healing` through this isolated daily task without discarding accepted stream history.
- [x] Produce the current-source deterministic 24-hour OS health report and classify serious candidates from their governing contracts.
- [x] Fix only bounded, high-confidence source defects; add RED regression coverage before any production source edit.
- [x] Run focused validation plus strict review/verify and leave the daily PR mergeable into `stream/self-healing`.
- [ ] Promote the daily PR only into `stream/self-healing`, publish the normalized report and this generated workpad to Daily Schedules, and preserve the human-only stream-to-main boundary.

## plan

1. Inspect current main, `stream/self-healing`, `stream/os`, prior daily PRs, recently merged OS PRs, and perpetual stream PR #1941.
2. Run installed `monitor.errors` first, then use the current-source equivalent when installed-runtime/source drift prevents execution.
3. Reconcile accepted `main` in this task; resolve the substantive `packages/workspace/test-selection.registry.json` conflict as the semantic union of accepted verification ownership.
4. Run the reconciled current-source monitor report and reconstruct contracts for the highest-confidence candidate groups.
5. If a real source defect is proven, capture RED first and make the smallest correct fix. Otherwise record an explicit no-source-change decision.
6. Run focused validation, strict review, and full verify; push and promote the daily task into `stream/self-healing` only.
7. Verify perpetual PR #1941, publish Daily Schedules, and finish the task after merge proof.

## files changed

- `packages/os/manifests/generated/tool.manifest.json`
- `packages/os/scripts/lib/facade/schemas.ts`
- `packages/os/scripts/lib/monitor-errors-report.ts`
- `packages/os/scripts/lib/monitor-errors.ts`
- `packages/os/tests/fixtures/tool-package-baseline.json`
- `packages/os/tests/monitor-errors-report.test.ts`
- `packages/os/tests/monitor-errors.test.ts`
- `packages/os/tests/tool-manifest.test.ts`
- `packages/os/tools/task-lifecycle/handler.ts`
- `packages/os/workflows/generated/workflow-bundles.json`
- `packages/workspace/manifests/tool-manifest.json`
- `packages/workspace/manifests/workflow-bundles.json`
- `packages/workspace/scripts/lib/facade/schemas.ts`
- `packages/workspace/src/generated/workspace.d.ts`
- `packages/workspace/tests/tool-manifest.test.ts`
- `packages/workspace/tooling/tool-manifest.json`


## key decisions

- Installed OS is `0.1.102`; task source is `@consuelohq/os` `0.1.111`. The required first `monitor.errors` call failed with `Script not found "monitor:errors"`, while current source declares that script. Treat as installed-runtime/source drift unless later evidence disproves it.
- Installed `github pr.diff` still invokes unsupported `gh pr diff --stat`; this correction already exists in current accepted source, so do not duplicate it.
- `stream.sync` reached a substantive conflict in `packages/workspace/test-selection.registry.json`. It was reconciled deliberately on this task by preserving accepted main and self-healing semantics; accepted stream history was not reset or discarded.
- Selected root cause 1 — monitor attribution: recurring `code.call/TIMEOUT` traces can be arbitrary caller-selected child commands hitting the caller's own deadline, so recurrence alone cannot prove a wrapper defect. `code.call` timeout is now unknown/non-actionable while unrelated wrapper failures remain visible.
- Selected root cause 2 — monitor attribution: `stream.sync` persists substantive merge-conflict state in structured `result_json`, but the deterministic report previously classified only top-level stderr and therefore promoted expected source reconciliation to a defect candidate. The monitor now consumes only the structured `status=conflict` signal for attribution, keeps raw result/stderr private, and leaves unrelated sync crashes actionable.
- Selected root cause 3 — `task.finish` facade contract: both OS and workspace CLIs already support `--repo`, but the typed `BranchInput`/command metadata did not expose it. Callers therefore used the ambiguous legacy `github` field with `owner/repo`, which the workspace CLI interpreted as a PR ref and rejected. Added optional `repo` end to end while retaining `github` compatibility rather than breaking existing callers.
- Final current-source 24-hour report: 52 groups — 1 expected-policy, 20 caller-input, 12 defect-candidate, 15 transient, 0 external, 4 unknown; 12 actionable groups. The substantive sync conflicts are now a distinct 2-occurrence caller-input group, and arbitrary `code.call` timeouts no longer inflate the defect bucket.
- Remaining candidates were not opportunistically patched: `verify` failures lack enough normalized failure detail to generalize safely; `mac.call` samples mix caller timeout-unit choices and child exits; release/deployment groups are concentrated in single contexts and overlap newer accepted lifecycle work; `monitor.errors`, `github --stat`, and `stream.sync --repo` are installed-runtime/source drift already fixed in current source; explore overlaps newer accepted retrieval work.

## notes for ko

- Initial stream head: `3320b7127f`. Perpetual PR #1941 is open but conflicted with accepted main.
- Prior daily PRs #2358 (Aug 31) and #2267 (Aug 28) are open, clean, zero-file maintenance records with green checks; they are not being duplicated or hijacked.
- Recent accepted OS work has landed on main. `stream/os` is not ahead of main for this run.
- Accepted main was merged into the isolated task at `06e8eb2e679bac0c5b74bae04ab25776430a9ff8`; after reconciliation the task was 0 commits behind main. `test-selection.js check` passed after regenerating the conflicted registry.
- TDD proof: the first focused RED exposed exactly four new failures (two attribution expectations plus mirrored `task.finish` repo-contract expectations) with 44 existing checks green. The representative structured-result RED then passed 24 existing monitor tests and failed only the new stream-conflict expectation. GREEN is 25/25 monitor/report tests plus 31/31 manifest/package-layout tests.
- Strict review reports 0 task issues / 0 blocking issues. Full verify against the synchronized integration base `06e8eb2e679bac0c5b74bae04ab25776430a9ff8` is publish-valid with 0 review blockers and DB guard 0 risks / 0 findings. Attempts to verify against the old unsynchronized stream correctly surfaced seven accepted-main related-pre-existing findings; they are not attributed to today's fixes and were not rewritten here.
- Read-only Sentry inspection found zero unresolved issues in the last 24 hours. No normalized hosted install/onboarding impact read model was exposed through the current typed surface, so no external-user impact was inferred.
- Immediately before push, task PR #2372 remained CLEAN with 43/43 completed checks green; `stream/self-healing` had not moved from `3320b7127f` during the run. Perpetual PR #1941 remained OPEN/DIRTY solely because the persistent stream had not yet received today's accepted-main reconciliation.

## improvements noticed

- none yet

## errors i ran into

- Installed `monitor.errors` cannot execute because the installed runtime lacks `monitor:errors`; current source contains it.
- Installed `stream.sync` rejects its typed optional `repo` argument, then the repo-less fallback reaches a real registry merge conflict against current main.
- Installed `github pr.diff` still passes unsupported `--stat`; current source already contains the correction.
- First workpad patch used an obsolete generated-workpad template and failed to anchor; no source file was changed by that failed patch.
- A Vitest invocation could not load Bun-native `bun:sqlite`; the authoritative focused monitor rule explicitly uses `bun test`, which produced the intended RED/GREEN evidence.
- The first full `verify` transport returned 502 while the underlying verification process continued. Its old-stream-base attempt later completed but was non-publishable only because accepted-main files appeared as related pre-existing findings. Re-running full verify against the already-created synchronized integration base isolated today's daily delta and passed publish-valid.

---

## publish checklist

```bash
bun run task:push -- --message "type(self-healing): description" --changed
bun run task:pr
bun run task:finish
```

## workspace-owned: files read

- `packages/os/package.json`
- `packages/os/scripts/lib/facade/schemas.ts`
- `packages/os/scripts/lib/monitor-errors-report.ts`
- `packages/os/scripts/lib/monitor-errors.ts`
- `packages/os/scripts/lib/trace-persistence.ts`
- `packages/os/scripts/mac.js`
- `packages/os/scripts/monitor-errors.ts`
- `packages/os/scripts/task-finish.js`
- `packages/os/tests/monitor-errors-report.test.ts`
- `packages/os/tests/monitor-errors.test.ts`
- `packages/os/tests/tool-manifest.test.ts`
- `packages/os/tools/mac/schema.ts`
- `packages/os/tools/task-lifecycle/handler.ts`
- `packages/os/tools/task-lifecycle/schema.ts`
- `packages/workspace/manifests/manifest.config.json`
- `packages/workspace/scripts/lib/facade/schemas.ts`
- `packages/workspace/scripts/task-finish.js`
- `packages/workspace/test-selection.registry.json`
- `packages/workspace/tests/tool-manifest.test.ts`
- `packages/workspace/tooling/tool-manifest.config.json`
- `packages/workspace/tooling/tool-manifest.json`

## workspace-owned: validation evidence

- 2026-09-02 01:54:14 `review.run`: passed — OK
- 2026-09-02 01:56:53 `verify`: failed — COMMAND_FAILED
- 2026-09-02 01:59:04 `verify`: failed — COMMAND_FAILED
- 2026-09-02 02:00:29 `verify`: passed — OK

- 2026-09-02 02:01:11 apply-patch: `.task/self-healing/daily-self-healing-2026-09-01/workpad.md`