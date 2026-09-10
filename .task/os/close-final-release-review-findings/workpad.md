# close final release review findings

branch: `task/os/close-final-release-review-findings`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/2227/close-final-release-review-findings
github pr: https://github.com/consuelohq/opensaas/pull/2227
started: 2026-08-26

## acceptance criteria

- [x] After a newer exact-SHA publication is observed cancelled, older failed attempts for that same SHA do not short-circuit the replacement polling window.
- [x] A newer replacement exact-SHA failure remains terminal, and a genuine failure remains terminal when no cancellation recovery is in progress.
- [x] Promotion dispatch uses one repository-wide atomic lock, so operators on different machines or with different `CONSUELO_HOME` values cannot both dispatch before the first run becomes visible.
- [x] Repository lock cleanup is compare-and-swap safe: an old owner cannot delete a newer owner's lock; stale lock recovery is allowed only when the lock is old and no protected promotion is active.
- [x] The lock uses existing authenticated GitHub transport without reading or printing token secrets and does not modify the protected promotion workflow, approval/signing environments, or exact bundle/source-commit checks.
- [x] Focused release regressions pass, strict review is clean, and full verify is publish-valid before merging into `stream/os`.

## plan

1. Add RED regressions for superseded publication failures and a shared repository-lock coordinator that simulates independent operator machines.
2. Limit terminal publication failures during cancellation recovery to attempts newer than the newest excluded cancelled run.
3. Replace the node-local promotion lock with a repository lock backed by an atomically-created lock file on a dedicated coordination branch; use an owner marker with acquisition time plus blob-SHA compare-and-swap deletion for safe cleanup/recovery.
4. Wire the repository lock adapter into `release.ts` using authenticated `gh api` without exposing tokens.
5. Run focused release/security tests, strict review, full verify, then publish to `stream/os` and re-check PR #2219.

## current status

- Implementation and validation are complete. Cancellation recovery now ignores older terminal failures until a newer replacement attempt appears. Promotion dispatch now coordinates through a repository-wide lock file on a dedicated coordination branch using GitHub's atomic Contents API create semantics and blob-SHA compare-and-swap deletion. No protected release workflow or signing boundary changed.

## files changed

- `packages/os/scripts/lib/release-orchestrator.ts` — superseded older failures no longer terminate cancellation recovery.
- `packages/os/scripts/lib/release-promotion-dispatch-lock.ts` — repository-wide lock coordinator with stale recovery and owner-safe cleanup.
- `packages/os/scripts/release.ts` — authenticated GitHub Contents API lock adapter and promotion dispatch wiring.
- `packages/os/tests/release-orchestrator.test.ts` — older failure + newer replacement failure regressions.
- `packages/os/tests/release-promotion-dispatch-lock.test.ts` — cross-operator serialization, stale recovery, active-promotion protection, and ownership-change cleanup regressions.

## workspace-owned: files changed

- `packages/os/scripts/lib/release-promotion-dispatch-lock.ts`
- `packages/os/tests/release-promotion-dispatch-lock.test.ts`

## workspace-owned: activity log

- 2026-08-26 18:25:07 fs.write: `packages/os/tests/release-promotion-dispatch-lock.test.ts`
- 2026-08-26 18:25:37 fs.write: `packages/os/scripts/lib/release-promotion-dispatch-lock.ts`
- 2026-08-26 18:26:54 fs.write: `packages/os/scripts/lib/release-promotion-dispatch-lock.ts`

## workspace-owned: validation evidence

- 2026-08-26 18:29:13 `review.run`: passed — OK
- 2026-08-26 18:29:29 `verify`: failed — COMMAND_FAILED
- 2026-08-26 18:30:05 `review.run`: passed — OK
- 2026-08-26 18:30:19 `verify`: passed — OK

## key decisions

- Publication recovery remains exact-SHA only. Once cancellation recovery starts, only attempts newer than the newest observed cancelled run may become terminal failure evidence.
- The repository lock uses a dedicated `consuelo-release-locks` coordination branch and one `.consuelo-locks/os-runtime-promotion.json` file. Acquisition creates that absent file through GitHub's Contents API; cleanup supplies the exact current blob SHA, so an old owner cannot delete a newer marker after ownership changes.
- A stale repository lock may be reclaimed only after its marker age exceeds the short dispatch critical-section budget and GitHub reports no active protected promotion. Normal GitHub workflow concurrency remains the server-side safety backstop.
- The coordination branch is separate from `main`; the repo's push workflows are branch-filtered to their intended branches, so this lock state is not part of product/release history.

## notes for ko

- This closes both fresh Codex P2 findings without requiring another GitHub login, reading a GitHub token, or adding OAuth scopes. The distributed mutex is repository state rather than local machine state.

## improvements noticed

- none yet

## issues and recovery

- The immediately prior same-node lock fix was useful as a local race guard, but Codex correctly identified that it cannot coordinate separate operator machines; this task replaces that authority rather than layering another local lock on top.
- First full verify surfaced the repo's mechanical async error-handling rule on the new lock coordinator. The coordinator now wraps its async boundary explicitly; final review/verify are clean.

## validation evidence

- RED: older failed run was incorrectly selected after excluding a newer cancellation, and the previous lock module lacked the repository-wide API (`trc_297709f2a5d6`).
- GREEN: 31/31 focused release/orchestrator/promotion/security/tool-surface tests passed with 64 assertions (`trc_56048eb54bbf`).
- Strict review: 0 issues, 0 blockers, 0 documentation opportunities (`trc_97839104603e`).
- Full verify: passed, publish-valid, DB gate clean (`trc_d8fae7a0c994`).

## Test-first contract

behavior under test: cancellation recovery ignores older failed attempts until a newer replacement becomes visible; repository promotion lock acquisition is globally serialized across independent adapters sharing remote state, stale locks are recoverable only with no active promotion, and compare-and-swap cleanup preserves a newer owner.
existing local pattern: `release-orchestrator.test.ts` covers exact-SHA publication candidate selection; `release-promotion-dispatch-lock.test.ts` covers the dispatch lock; `release.ts` owns GitHub CLI/transport orchestration and `release-script-security.test.ts` guards credential handling.
new or changed tests: add an older-failure-after-newer-cancellation candidate regression plus replacement-failure guard; replace the local-home lock tests with repository-lock concurrency/stale/CAS tests using an in-memory remote adapter.
focused red command: `bun test packages/os/tests/release-orchestrator.test.ts packages/os/tests/release-promotion-dispatch-lock.test.ts`
expected red failure: the candidate selector still returns the older failure after excluding the newer cancellation, and the current dispatch-lock module has no repository-wide adapter/ref coordination API.
no-test waiver: not applicable.

---

## publish checklist

```bash
bun run task:push -- --message "type(os): description" --changed
bun run task:pr
bun run task:finish
```

## workspace-owned: files read

- `packages/os/scripts/lib/github-cli.ts`
- `packages/os/scripts/lib/release-orchestrator.ts`
- `packages/os/scripts/lib/release-promotion-correlation.ts`
- `packages/os/scripts/lib/release-promotion-dispatch-lock.ts`
- `packages/os/scripts/release.ts`
- `packages/os/tests/release-orchestrator.test.ts`
- `packages/os/tests/release-promotion-dispatch-lock.test.ts`
- `packages/os/tests/release-script-security.test.ts`

- 2026-08-26 18:30:56 apply-patch: `.task/os/close-final-release-review-findings/workpad.md`