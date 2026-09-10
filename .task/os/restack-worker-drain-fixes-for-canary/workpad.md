# restack worker drain fixes for canary

branch: `task/os/restack-worker-drain-fixes-for-canary`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/2151/restack-worker-drain-fixes-for-canary
github pr: https://github.com/consuelohq/opensaas/pull/2151
started: 2026-08-17

## acceptance criteria

- [x] HEAD requests release worker request accounting even when Hono discards the wrapped response body.
- [x] Supervisor hard-kill timing covers the full drain sequence: Caddy evacuation + request drain timeout + response flush.
- [x] Rolling replacement waits for Caddy admission only between worker slots, not after the final replacement.
- [x] Current-stream lifecycle selector, strict review, and formal verify remain green.
- [ ] Publish through `stream/os` to `main`, wait for the resulting signed dev runtime, promote that exact immutable release set to canary, install canary locally, and prove local/public ingress health without promoting beta/stable.

## plan

1. Mechanically restack the exact five-file worker-drain patch already proven on #2145 onto current `stream/os` (`6d409011...`).
2. Re-run focused response/drain tests and the exact `os-lifecycle-update-handoff` selector on the current stream baseline.
3. Run strict review and formal verify against `origin/stream/os`, then publish task -> stream -> main.
4. Wait for the automatic signed dev publication from the resulting main merge; verify its version, source commit, release-set bundle, and three-platform inventory.
5. Promote only that exact dev release set `dev -> canary`, verify signed canary consensus, update this Mac to canary, and run local/public MCP/worker/Caddy acceptance. Leave beta/stable untouched for the soak period.

## current status

- Fresh restack task created from current `stream/os` after #2145 became history-conflicted. Exact five-file product patch is now reapplied and verified on the current stream baseline.
- Baseline channels before this restack: dev `0.1.65`, canary `0.1.64`, beta/stable `0.1.20`; local runtime is `0.1.65` on dev.
- Remaining: publish/merge to main, wait for signed dev publication, promote exact release set to canary, install locally, and run live acceptance.

## files changed

- `packages/os/SCRIPTS.md`
- `packages/os/scripts/lib/worker-pool.ts`
- `packages/os/scripts/server/app.ts`
- `packages/os/tests/health-readiness.test.ts`
- `packages/os/tests/worker-pool-lifecycle.test.ts`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- none yet

## workspace-owned: validation evidence

- 2026-08-17 00:39:53 `review.run`: passed — OK
- 2026-08-17 00:40:10 `verify`: passed — OK

## key decisions

- Supersede #2145 with this current-stream restack rather than force-merge stale task history.
- Reuse the already-proven implementation verbatim; do not redesign worker drain semantics during the restack.
- Canary promotion must reuse the exact immutable dev release set; promotion must not rebuild or relabel archives.
- Production/stable is explicitly out of scope for this turn.

## notes for ko

- Production/stable remains untouched. Canary is the soak target for 20–30 minutes before any later production decision.

## improvements noticed

- none yet

## issues and recovery

- Repository helper PATH currently shadows GitHub CLI with `~/.consuelo/bin/gh`. Real authenticated GitHub CLI is `/opt/homebrew/bin/gh`; publish fallbacks may prepend `/opt/homebrew/bin` after canonical task operations fail.
- `session.start(kind=task)` still receives an invalid wrapper-injected timeout; used the maintained `task.start` compatibility alias.

## Test-first contract

behavior under test: (1) non-probe HEAD requests release `activeRequests` when Hono discards the middleware-wrapped body; (2) supervisor force-close budget includes both propagation windows plus the configured drain timeout; (3) a completed final replacement does not retain a needless Caddy-admission sleep that can absorb a closely following reload.

existing local pattern: `createLocalOsApp` owns response-lifecycle accounting; `worker-pool.ts` owns rolling replacement, Caddy admission barriers, and bounded supervisor force-close; `os-lifecycle-update-handoff` owns the critical regression gate.

new or changed tests: mechanically restack the existing HEAD accounting test and the two worker-pool timing assertions from #2145.

focused red command: inherited from #2145, where the exact three contracts failed before implementation (`trc_afc71eb691b5`).

expected red failure: inherited RED proved HEAD leaked one active request, a two-worker roll performed two 3s admission sleeps, and a 100ms drain plus two 25ms propagation windows received only a 100ms supervisor budget.

no-test waiver: no new RED run in this restack because it intentionally reapplies the exact previously-red/green patch onto a newer baseline rather than introducing new semantics. The restack must re-run focused GREEN plus the full current lifecycle selector before publish.

## Validation evidence

- Mechanical restack product diff is exactly the intended five files (`trc_5a8b53252b7a`).
- Focused GREEN: 21/21 (`trc_fcb548e08bc3`).
- Exact current `os-lifecycle-update-handoff` gate: 19 files / 211 tests passed; syntax passed; lifecycle facade snapshots 9/9 passed (`trc_67f7bfbf5643`).
- Strict review: 0 task issues, 0 pre-existing issues, 0 blockers, 0 documentation gaps (`trc_fc97de4ca244`).
- Formal verify: full mode, DB guard clean, `publishValid: true` (`trc_81e49680dd01`).

---

## publish checklist

```bash
bun run task:push -- --message "type(os): description" --changed
bun run task:pr
bun run task:finish
```

## workspace-owned: files read

- `packages/os/SCRIPTS.md`
- `packages/os/scripts/lib/worker-pool.ts`
- `packages/os/scripts/server/app.ts`
- `packages/os/tests/health-readiness.test.ts`
- `packages/os/tests/worker-pool-lifecycle.test.ts`

- 2026-08-17 00:38:14 apply-patch: `.task/os/restack-worker-drain-fixes-for-canary/workpad.md`
- 2026-08-17 00:38:49 apply-patch: `packages/os/scripts/server/app.ts`
- 2026-08-17 00:38:49 apply-patch: `packages/os/scripts/lib/worker-pool.ts`
- 2026-08-17 00:38:49 apply-patch: `packages/os/tests/health-readiness.test.ts`
- 2026-08-17 00:38:49 apply-patch: `packages/os/tests/worker-pool-lifecycle.test.ts`

- 2026-08-17 00:40:25 apply-patch: `.task/os/restack-worker-drain-fixes-for-canary/workpad.md`