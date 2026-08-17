# close worker drain review gaps

branch: `task/os/close-worker-drain-review-gaps`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/2145/close-worker-drain-review-gaps
github pr: https://github.com/consuelohq/opensaas/pull/2145
started: 2026-08-16

## acceptance criteria

- [x] HEAD requests release worker request accounting even when Hono replaces/discards the wrapped body.
- [x] Supervisor hard-kill timing covers the full worker drain sequence: initial Caddy evacuation window + request drain budget + response-flush window.
- [x] A completed final worker replacement clears rolling-reload admission promptly so a closely following reload request is not discarded during a no-longer-needed final sleep.
- [x] Existing two-worker readiness, Caddy admission, force-close fallback, response-stream tracking, and lifecycle update contracts remain green.
- [ ] Ship through `stream/os` to `main`, publish the signed runtime, update the canary machine, and prove a same-version update with no new MCP EOF/502.

## plan

1. Verify the three post-merge review findings against current stream code and existing tests.
2. Add focused RED coverage for HEAD completion, full supervisor drain budget, and back-to-back rolling reload admission.
3. Implement the smallest lifecycle fixes without changing Caddy/Cloudflared availability boundaries.
4. Run the critical lifecycle selector, strict review, formal verify, then promote task → stream → main.
5. Publish/promote the exact signed runtime, update this Mac, and repeat same-version live acceptance with Caddy/Cloudflared PID and log evidence.

## current status

- Product fix is complete and revalidated after restacking onto the current `stream/os` synced from latest `main` at `6d4090117a7b49307f205cf1afbf2897531f9041`.
- Current signed channels before publishing this task: `dev=0.1.65` (`sha256:d5774b...`, source `4e5e021b...`), `canary=0.1.64` (`sha256:e8257152...`, source `0f76fef5...`), `beta=stable=0.1.20`. Local runtime is `0.1.65` on `dev`.
- Remaining work is publish task -> stream -> main, wait for the resulting signed dev runtime, promote that exact immutable release set to canary, update this Mac to canary, and run live MCP/ingress acceptance before production.

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

- 2026-08-16 07:31:05 `review.run`: passed — OK
- 2026-08-17 00:31:58 `review.run`: passed — OK
- 2026-08-17 00:32:14 `verify`: passed — OK
- 2026-08-17 00:33:15 `verify`: passed — OK
- 2026-08-17 00:35:18 `verify`: failed — COMMAND_FAILED

## key decisions

- Treat these as one worker-drain/rolling-reload correctness task because all three can turn an otherwise healthy rolling update into a timeout, discarded reload, or forced worker termination.
- Preserve the existing response-body accounting from #2143; do not replace it with longer arbitrary sleeps.

## notes for ko

- none yet

## improvements noticed

- none yet

## issues and recovery

- Canonical `session.start(kind=task)` currently rejects the wrapper-propagated timeout as task input; used the maintained `task.start` compatibility path instead. This is already separate session-start review debt and is not part of this lifecycle fix.

## Test-first contract

behavior under test: (1) non-probe HEAD requests must release `activeRequests` even though Hono discards the middleware-wrapped response body; (2) the supervisor must not SIGKILL a draining worker before both propagation windows plus the configured drain timeout have elapsed; (3) once the final replacement is ready, the rolling-reload promise must become available for the next reload without waiting an unnecessary final admission window.

existing local pattern: `createLocalOsApp` owns request accounting until response completion/cancel; `worker-pool.ts` owns rolling replacement, Caddy admission barriers, and the bounded supervisor force-kill fallback; lifecycle critical tests are selected by `os-lifecycle-update-handoff`.

new or changed tests: extend `health-readiness.test.ts` with HEAD accounting coverage; extend `worker-pool-lifecycle.test.ts` with total drain-budget and immediate second-reload acceptance coverage.

focused red command: run only those two test files after destructive-literal preflight.

expected red failure: current HEAD accounting remains active forever, current supervisor kill timer is shorter than the worker's full drain sequence, and current final admission sleep keeps `rollingReload` non-null after all replacement workers are already ready.

no-test waiver: none.

### RED evidence

- Destructive-literal preflight passed for both focused test files (`trc_639f84dceea4`).
- Focused RED ran `health-readiness.test.ts` + `worker-pool-lifecycle.test.ts` and failed only the three new contracts: HEAD left `activeRequests=1`; a two-worker roll emitted two `sleep:3000` admission delays instead of one; supervisor stop scheduled only the 100ms handler drain timeout rather than the required 150ms full drain budget (`trc_afc71eb691b5`).

### GREEN and broader validation

- Original focused GREEN: 21/21 across `health-readiness.test.ts` and `worker-pool-lifecycle.test.ts` (`trc_4ded7478e41e`).
- After newer OS work landed, `stream/os` was synced from current `main` with no conflicts (`trc_9edc4d06d679`), then merged locally into this task with the task patch restored cleanly (`trc_03c434ba8df9`).
- Restacked focused GREEN remains 21/21 (`trc_36c2d83a6b45`).
- Current exact `os-lifecycle-update-handoff` selector passed all three suites: 19 files / 211 tests green, OS syntax green, lifecycle facade snapshots 9/9 green (`trc_62d920c29b2a`). The only `sudo` occurrence in `lifecycle-restart-contract.test.ts` is now a regex assertion, not an executed host command (`trc_934ba1d3bf0d`).
- Strict review against current `origin/stream/os`: 0 task issues, 0 pre-existing issues, 0 blockers, 0 documentation gaps (`trc_cf47518ce19a`).
- Full formal verify against current `origin/stream/os` passed with `publishValid: true`, DB guard clean, and a current verify stamp (`trc_9be178b19b81`).
- `packages/os/SCRIPTS.md` states that the Caddy admission wait applies to non-final replacements rather than every slot.

---

## publish checklist

```bash
bun run task:push -- --message "type(os): description" --changed
bun run task:pr
bun run task:finish
```

## workspace-owned: files read

- `packages/documentation/src/content/docs/reference/configuration.mdx`
- `packages/documentation/src/content/docs/start/install-consuelo-os.mdx`
- `packages/os/SCRIPTS.md`
- `packages/os/scripts/lib/worker-pool.ts`
- `packages/os/scripts/server/app.ts`
- `packages/os/tests/health-readiness.test.ts`
- `packages/os/tests/worker-pool-lifecycle.test.ts`
- `packages/workspace/scripts/task-push.js`
- `packages/workspace/tests/test-selection.test.js`
