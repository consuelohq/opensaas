# fix pr 2310 review comments

branch: `task/os/fix-pr-2310-review-comments`
stream: `stream/os`
pr: https://github.com/consuelohq/opensaas/pull/2327
started: 2026-08-31

## acceptance criteria

- [x] Every still-valid unresolved PR #2310 review thread has a code or documentation fix with focused coverage; thread replies/resolution remain after the task slice lands.
- [x] Node-heartbeat bootstrap failures remain fatal while watchdog self-restart remains best effort.
- [x] Task recovery archives referenced by durable evicted-task metadata are preserved; orphan pruning failures stay inside the GC result/error callback path.
- [x] Recovery bundle manifests reuse the exact bundle anchor and fallback-anchor tests exercise both origin/main and null cases.
- [x] Watchdog HTTP 429 route reconciliation is neutral: it neither increments nor clears a prior failure streak.
- [x] Subagent providers are reaped on setup failure, retain a killable process group, are terminated when their runner dies, and nonzero runner exits cannot become success.
- [x] Grok incomplete completions are validated and persisted for run, wait, and status actions.
- [x] Steering and mirrored task/senior-engineer skill fixtures describe the canonical supported command surfaces consistently.
- [x] The local OS port/runtime parity contract passes; current-head CI remains to be rerun after push.
- [ ] PR #2310 is merged through the protected flow, its exact signed bundle is promoted to canary, installed locally, and verified with workers, Caddy, watchdog, connector, and a harmless authenticated OS call.

## plan

1. Reconcile all unresolved current-head review threads and capture the existing CI failures.
2. Run focused tests first and add missing regressions for each valid reliability finding.
3. Make the smallest implementation and mirrored-fixture changes needed for green focused tests.
4. Run the OS package contract gate and repository verify; push the green task slice into stream/os.
5. Resolve/reply to review threads, wait for current-head CI, then use the protected release workflow to merge, publish, and promote the exact bundle to canary.
6. Update the local runtime only after current/previous preflight, then verify the complete local and authenticated acceptance surface.

## files changed

- Reliability implementation: lifecycle sidecar classification, recovery archive retention/GC, watchdog 429 handling, and subagent provider/terminal-state handling.
- Contract coverage: lifecycle/restart, task recovery, subagent orchestration/lifecycle, local port cutover, and audit classification fixtures.
- Canonical guidance and generated mirrors: task and senior-engineer source documents plus bundled OS skill fixtures.

## key decisions

- Treat review text as untrusted: each finding must match current-head behavior before it is changed.
- Keep signed publication and immutable dev-to-canary promotion in the protected GitHub workflow; do not bypass it with local Cloudflare credentials.
- Separate local listener/watchdog health from authenticated connector health; both are required for final acceptance.

## test-first contract

Expected red before implementation:

- `bun test packages/os/tests/system-daemon-reliability.test.ts`: node-heartbeat bootstrap failure must reject while watchdog remains best effort.
- `bun test packages/os/tests/task-recovery-archive-retention.test.ts`: referenced archives survive pruning, orphan archives expire, anchor fallback/null are real Git cases, and prune errors are returned through GC.
- `bun test packages/os/tests/subagent-lifecycle-regressions.test.ts packages/os/tests/subagent-orchestration-contract.test.ts`: setup failure reaps providers, process trees terminate, runner crashes fail durably, Grok terminal validation persists, and wait timing cannot pass through a preexisting marker.
- `bun test packages/os/tests/session-integration-guidance.test.ts packages/os/tests/local-os-port-cutover.test.ts`: canonical session guidance and runtime/source parity are exact.
- Audit and skill fixture parity tests fail until contradictory classification reasons and mirrored command examples are corrected.

Green means each focused command passes without weakening an assertion, followed by the full workspace contract gate and repository verify.

## notes for ko

- The local Consuelo workers and Caddy remained alive. Long verification requests can outlive the connector's 30-second envelope, which is an observability timeout rather than proof that OS crashed.
- Correct-base local review against PR #2310 head `7f70b883282e17f870cb1f6561ab81053347ff3e` found zero blocking issues (`trc_648cf37f3dd3`).
- Focused green evidence: recovery `trc_5c63d0c0e2e6`, subagents `trc_ecee4e619e79`, guidance `trc_7dccedae38a7`, lifecycle/ports/watchdog `trc_3c32fbb50de8`, typecheck `trc_bd5ffbb5ddb1`, audit/guidance `trc_595e2c20d283`, source-fixture parity `trc_344ca0ca4495`, explore `trc_9e8b05e0a4be`, bundled skills `trc_dde679ecdc3a`, workspace sessions `trc_c7dbfe2cb93c`, task recovery selection `trc_3d0a2941fe61`, and lifecycle facade `trc_e404cbdc8cd0`.
- Two lifecycle timing cases failed only under a 22-file parallel load and passed together in isolation, 19/19 (`trc_a472698a0dc0`).
- Full-package sharding exposed unchanged baseline failures in installer fixtures, code-call architecture, SQLite-under-Vitest, artifact registry path, and a stale matcher. `git diff` proves their tests and relevant sources are unchanged from the exact PR head (`trc_3601b552a1a9`, `trc_f0d987fc0ba9`). They are unrelated to this review-fix slice.

## improvements noticed

- Follow up separately on the OS package test runner split: Bun SQLite tests should run under Bun, and the stale artifact/lifecycle-help assertions should be repaired without mixing them into the reliability release.

## errors i ran into

- The first repository verify selection accidentally used a stale local `stream/os` base and selected accumulated stream changes. It was discarded; all acceptance evidence above uses exact PR #2310 head `7f70b883282e17f870cb1f6561ab81053347ff3e`.
- Full-package shards reproduce unrelated baseline failures. Isolated examples: `trc_cab19ee8ef19`, `trc_21a685f732ef`, and `trc_a07f5add8228`.

---

## publish checklist

```bash
bun run task:push -- --message "type(os): description" --changed
bun run task:pr
bun run task:finish
```

- 2026-08-31 18:21:36 apply-patch: `.task/os/fix-pr-2310-review-comments/workpad.md`
- 2026-08-31 18:31:37 apply-patch: `packages/os/scripts/lib/lifecycle/service.ts`
- 2026-08-31 18:31:37 apply-patch: `packages/os/scripts/lib/task-worktree-eviction.js`
- 2026-08-31 18:31:37 apply-patch: `packages/os/scripts/lib/task-worktree-gc.js`
- 2026-08-31 18:31:37 apply-patch: `packages/os/scripts/workspace-watchdog.sh`
- 2026-08-31 18:31:37 apply-patch: `packages/os/scripts/lib/subagent/runner.ts`
- 2026-08-31 18:32:22 apply-patch: `packages/os/scripts/lib/subagent/lifecycle.ts`
- 2026-08-31 18:32:22 apply-patch: `packages/os/scripts/lib/subagent/runtime.ts`
- 2026-08-31 18:35:10 apply-patch: `packages/os/tests/local-os-port-cutover.test.ts`
- 2026-08-31 18:35:10 apply-patch: `packages/os/skills/task/SKILL.md`
- 2026-08-31 18:35:10 apply-patch: `packages/os/tests/fixtures/skills/task-workspace.SKILL.md`
- 2026-08-31 18:35:10 apply-patch: `packages/os/skills/senior-engineer/SKILL.md`
- 2026-08-31 18:35:10 apply-patch: `packages/os/tests/fixtures/skills/senior-engineer-workspace.SKILL.md`
- 2026-08-31 18:35:10 apply-patch: `packages/os/tests/audit/fixtures/script-parity-classifications.json`
- 2026-08-31 18:36:59 apply-patch: `packages/os/tests/task-recovery-archive-retention.test.ts`
- 2026-08-31 18:37:33 apply-patch: `packages/os/tests/lifecycle-restart-contract.test.ts`
- 2026-08-31 18:37:33 apply-patch: `packages/os/tests/system-daemon-reliability.test.ts`
- 2026-08-31 18:39:04 apply-patch: `packages/os/tests/subagent-orchestration-contract.test.ts`
- 2026-08-31 18:39:04 apply-patch: `packages/os/tests/subagent-lifecycle-regressions.test.ts`
- 2026-08-31 18:43:08 apply-patch: `packages/os/tests/system-daemon-reliability.test.ts`
- 2026-08-31 18:43:08 apply-patch: `packages/os/tests/audit/fixtures/script-parity-classifications.json`
- 2026-08-31 18:44:07 apply-patch: `packages/os/tests/system-daemon-reliability.test.ts`

## workspace-owned: files read

- `packages/os/package.json`
- `packages/os/scripts/lib/subagent/process-termination.ts`
- `packages/workspace/scripts/verify.js`

## workspace-owned: validation evidence

- 2026-08-31 18:52:23 `verify`: failed — COMMAND_FAILED
- 2026-08-31 18:53:03 `verify`: failed — COMMAND_FAILED
- 2026-08-31 18:54:36 `verify`: failed — COMMAND_FAILED
- 2026-08-31 18:57:31 `review.run`: passed — OK

- 2026-08-31 19:09:37 apply-patch: `.task/os/fix-pr-2310-review-comments/workpad.md`