# stabilize worker pool process contract for linux ci

branch: `task/workspace-agents/stabilize-worker-pool-process-contract-for-linux-ci`
stream: `stream/workspace-agents`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/2238/stabilize-worker-pool-process-contract-for-linux-ci
github pr: https://github.com/consuelohq/opensaas/pull/2238
started: 2026-08-27

## acceptance criteria

- [x] Reproduce the Ubuntu-style timeout without weakening worker-pool behavior.
- [x] Keep the real-process worker replacement and rolling-reload assertions intact.
- [x] Give real process convergence enough time for supported slower hosts and production admission delays.
- [x] Pass the exact selector-owned lifecycle suite, including both worker-pool process tests.
- [x] Pass strict review and canonical verify; task PR #2238 is ready to promote into `stream/workspace-agents`.

## plan

1. Read the real-process worker test and production worker-pool replacement budgets.
2. Reproduce the 10s convergence timeout under slower-but-valid timing.
3. Increase only the test observation budget; preserve all behavior assertions.
4. Run the exact selector-owned lifecycle suite, strict review, and canonical verify.
5. Promote into the stream, rerun PR #2193 CI, then resume release only on green required checks.

## current status

- Deterministic RED/green and the exact lifecycle selector are green. Ready for strict review and canonical verify.

## files changed

- none yet

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-08-27 01:17:55 fs.write: `.task/workspace-agents/stabilize-worker-pool-process-contract-for-linux-ci/workpad.md`

## workspace-owned: validation evidence

- 2026-08-27 01:21:15 `review.run`: passed — OK
- 2026-08-27 01:21:45 `verify`: passed — OK

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
bun run task:push -- --message "type(workspace-agents): description" --changed
bun run task:pr
bun run task:finish
```

## Test-first contract

behavior under test: the focused worker-pool process integration used by lifecycle verification must reliably observe two workers, replace only a crashed slot, and shut down cleanly on supported CI hosts instead of depending on workstation timing.
existing local pattern: `packages/os/tests/worker-pool-process.test.ts` uses bounded `waitFor` polling around real child processes; the same test passed locally but timed out in GitHub Ubuntu 24.04 inside both `Consuelo / workspace contracts` and `Consuelo / verify` on PR #2193.
new or changed tests: harden the existing real-process integration itself; preserve the worker-count/replacement assertions and add no product behavior exemption.
focused red command: run `packages/os/tests/worker-pool-process.test.ts` repeatedly under constrained/CI-like timing to reproduce the current bound before implementation.
expected red failure: `starts two real workers and replaces only the crashed slot` times out at `waitFor` on slower process startup/replacement even though the worker-pool contract is otherwise healthy.
no-test waiver: not applicable.

## CI evidence

- PR #2193 head `48e8bb699677d85007d51f2d7417ef18e073f753` completed with exactly two failed checks: `Consuelo / workspace contracts` and `Consuelo / verify`.
- Both failed for the same test: `packages/os/tests/worker-pool-process.test.ts > OS worker pool process integration > starts two real workers and replaces only the crashed slot`, `Error: worker pool condition timed out` at `waitFor` line 65 / assertion flow around line 161.
- Review and DB gates passed in both jobs; no other focused suite failed.

## validation evidence

- RED `trc_5f2fa7cd18f0`: with a slower-but-valid 6s Caddy admission delay, the unchanged real-process contract reproduced the same 10s `waitFor` timeout deterministically.
- GREEN `trc_06a1a701b600`: the same slowed contract passed in about 21s after raising only the test convergence budget; all worker identity, stable-sibling, rolling replacement, and `/ready` assertions remained unchanged.
- GREEN `trc_0fe722266fbe`: the exact `os-lifecycle-update-handoff` selector passed all three suites; lifecycle contracts passed 218/218 including both real worker-pool process tests, syntax passed, and lifecycle facade snapshots passed.
- Strict review `trc_118448720eac`: 0 blocking issues and 0 documentation opportunities.
- FINAL VERIFY `trc_e3ce98dad3d2`: full canonical task gate passed with a publish-valid stamp against `origin/stream/workspace-agents`.

## files changed

- `packages/os/tests/worker-pool-process.test.ts` — raise real-process convergence polling from 10s to 30s and the enclosing first-test budget from 60s to 120s; improve timeout diagnostics. No production runtime code changed.

## key decisions

- Do not remove or skip `worker-pool-process.test.ts`; it is valuable real-process coverage and now belongs to the authoritative focused lifecycle selector.
- Treat the Ubuntu failure as an invalid test timing assumption, not a product defect: production rolling replacement itself allows substantially more than 10s for readiness and intentionally includes Caddy admission delay between sequential workers.
- Preserve every behavioral assertion; only the observation budget changes.

- 2026-08-27 01:17:55 append: `.task/workspace-agents/stabilize-worker-pool-process-contract-for-linux-ci/workpad.md`

## workspace-owned: files read

- `packages/os/scripts/lib/worker-pool.ts`
- `packages/os/tests/worker-pool-process.test.ts`

- 2026-08-27 01:18:55 apply-patch: `packages/os/tests/worker-pool-process.test.ts`

- 2026-08-27 01:20:40 apply-patch: `.task/workspace-agents/stabilize-worker-pool-process-contract-for-linux-ci/workpad.md`

- 2026-08-27 01:20:51 apply-patch: `.task/workspace-agents/stabilize-worker-pool-process-contract-for-linux-ci/workpad.md`

- 2026-08-27 01:21:54 apply-patch: `.task/workspace-agents/stabilize-worker-pool-process-contract-for-linux-ci/workpad.md`