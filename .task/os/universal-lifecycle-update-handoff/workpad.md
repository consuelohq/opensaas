# universal lifecycle update handoff

branch: `task/os/universal-lifecycle-update-handoff`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1909/universal-lifecycle-update-handoff
github pr: https://github.com/consuelohq/opensaas/pull/1909
started: 2026-08-13

## acceptance criteria

- [x] Keep `consuelo update` as the single updater implementation; do not create an agent-only updater.
- [x] Preserve synchronous terminal behavior while daemon/agent invocation hands the exact signed target to a durable lifecycle operation before restart.
- [x] Make the durable operation the cross-restart identity and expose target/channel/result metadata through lifecycle status.
- [x] Use platform-appropriate detached execution: launchd on macOS, transient systemd user execution on Linux, and a constrained Windows breakaway helper.
- [x] Expose manifest-backed Bun tools `lifecycle.update` and `lifecycle.status` that are discoverable through `tools.search` and delegate to the existing lifecycle engine.
- [x] Preserve existing lifecycle signature verification, staging, activation, health acceptance, rollback, retention, and security behavior.
- [x] Validate focused lifecycle/platform/facade/tool contracts, repository selection rules, strict review, and the publish gate before promotion.

## plan

1. Reuse the existing lifecycle engine and durable native lifecycle operation instead of introducing a second updater.
2. Extend operation state and platform handoff boundaries so the operation survives runtime replacement on macOS, Linux/systemd, and Windows.
3. Route daemon-context `consuelo update` through the detached operation while keeping normal terminal execution synchronous.
4. Add the manifest-backed lifecycle tool package and regenerate typed/generated tool surfaces.
5. Prove the behavior with focused tests, selector coverage, review/verify, then promote the task to `stream/os`.

## current status

- Implementation is complete and validated. The task now has an explicit merge parent from current `stream/os` (`984b62d5...`) so GitHub can promote it without replaying the resolved selector conflict. The merged tree preserves the stream's newer Caddy/lifecycle restart change as well as the managed-cloud/Vitest selectors, and layers the lifecycle handoff on top. It is ready for the final task-branch push and `task.pr` promotion.

## files changed

- `packages/workspace/test-selection.registry.json`
- `packages/workspace/test-selection.rules.json`
- `packages/workspace/tests/test-selection.test.js`


## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- none yet

## workspace-owned: validation evidence

- 2026-08-13 19:56:23 `verify`: passed — OK
- 2026-08-13 19:58:45 `verify`: passed — OK
- 2026-08-13 20:02:55 `verify`: passed — OK

## key decisions

- There is one updater authority: `consuelo update` and the lifecycle tools both delegate into the existing lifecycle engine.
- Terminal callers keep truthful synchronous exit semantics. Managed-daemon callers receive a durable `operationId` after a restart-safe helper accepts the exact resolved target.
- Correctness follows the durable operation, not a worker PID. PIDs remain implementation metadata only.
- Platform isolation is explicit because a normal detached child is not restart-safe under every service manager.
- The stream's newer test-selection state is authoritative; conflict resolution adds the lifecycle selector without replacing the managed-cloud or verifier selectors.

## notes for ko

- No release was published, no node was updated, and no production deployment was performed by this task.
- Windows service-host behavior is source/contract tested here; native Windows compile acceptance still belongs to the normal Windows CI environment because this Mac has no C#/.NET compiler installed.

## improvements noticed

- The task/stream workflow still lacks a first-class `stream.mergeIntoTask` conflict-reconciliation tool. The conflict itself was limited to generated/test-selection state, but recovery required more manual evidence than the typed lifecycle should ideally need.

## issues and recovery

- Initial task implementation passed focused lifecycle/platform/facade/tool coverage and a publish-valid verify, then PR #1909 became DIRTY because `stream/os` advanced.
- Read-only merge analysis proved only `packages/workspace/test-selection.rules.json`, `packages/workspace/test-selection.registry.json`, and `packages/workspace/tests/test-selection.test.js` conflicted; no production lifecycle code conflicted.
- Conflict resolution preserved the current stream's `os-managed-cloud-one-click-provisioning` and `os-vitest-runtime-regressions` rules and added `os-lifecycle-update-handoff` plus its two new lifecycle test files.
- Post-resolution selector validation passed 22/22. Structural registry checks proved unique rule IDs, expected rule ordering, preservation of all stream rules/tests, exactly +1 explicit lifecycle rule and +2 lifecycle test files, stable unmapped-test count, and consistent registry summary counts.
- Post-resolution `verify` passed with `publishValid: true`, zero blocking review findings, and zero DB risks/findings.
- The OS facade then returned HTTP 502 before the resolved tree could be pushed. After recovery, the original task session `tsk_670b789e26df` and worktree were recovered directly; no new task or branch was created.
- `task.push` then correctly rejected a stale local ref (`1e159762` vs remote `1805a0be`). Recovery followed the repository's own API-push synchronization model: fetch the remote task branch and use a mixed reset so the working tree is preserved while the local ref catches up.
- While recovering, `stream/os` advanced again to `984b62d5` via a main sync. Read-only merge analysis showed the new lifecycle change was auto-mergeable; the only actual unresolved files were the selector registry/rules. The task branch now contains merge commit `24b29d2760` with parents `1805a0be...` and `984b62d5...`.
- Post-merge focused proof: workspace selector suite 22/22 passed; lifecycle/platform/facade/tool/restart suite 141/141 passed across 10 files; full `verify --base origin/stream/os` is publish-valid with zero blocking review findings and zero DB risks/findings.
- Because `task.pr` cannot create a merge commit when non-metadata conflicts require semantic resolution, the verified merge commit was pushed with a normal fast-forward `git push` to the existing task branch (no force); task metadata updates continue through `task.push` before retrying `task.pr`.

---

## publish checklist

```bash
bun run task:push -- --message "type(os): description" --changed
bun run task:pr
bun run task:finish
```

## workspace-owned: files read

- `packages/workspace/scripts/lib/git.js`
- `packages/workspace/scripts/task-push.js`

- 2026-08-13 20:03:18 apply-patch: `.task/os/universal-lifecycle-update-handoff/workpad.md`

- 2026-08-13 20:03:46 apply-patch: `.task/os/universal-lifecycle-update-handoff/workpad.md`