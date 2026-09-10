# fix PR 2310 Linux durable runner marker handoff under load

branch: `task/os/fix-pr-2310-linux-durable-runner-marker-handoff-under-load`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/2332/fix-pr-2310-linux-durable-runner-marker-handoff-under-load
github pr: https://github.com/consuelohq/opensaas/pull/2332
started: 2026-08-31

## acceptance criteria

- [x] Reproduce the loaded-host exit-marker handoff race with a deterministic delayed-marker regression.
- [x] Defer the known parent fallback marker so the runner's authoritative owned marker can replace it during the bounded handoff.
- [x] Keep a truly markerless dead runner bounded well below normal 15–30 second caller budgets.
- [x] Pass the lifecycle, orchestration, executable-discovery, finish-line, syntax, typecheck, and strict-review gates.

## plan

1. Inspect lifecycle reconciliation, runner marker publication, fallback marker ownership, and affected tests.
2. Make the existing delayed-marker regression fail beyond 250 ms.
3. Extend the bounded handoff window and retain a bounded markerless assertion.
4. Run the affected provider/lifecycle suite, typecheck, strict review, and publish to the stream PR.

## current status

- Ready to publish on Ko's approved path. A fallback failure marker that is replaced 750 ms later now recovers successfully; a truly markerless dead runner settles in about 2 seconds. All related focused and strict gates pass.

## files changed

- `packages/os/scripts/lib/subagent/lifecycle.ts` — extend the fixed exit-marker handoff grace to 2 seconds and defer only the recognizable parent fallback marker until that window closes.
- `packages/os/tests/subagent-lifecycle-regressions.test.ts` — prove fallback-to-authoritative marker replacement and bounded markerless completion.

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-08-31 20:15:25 fs.write: `.task/os/fix-pr-2310-linux-durable-runner-marker-handoff-under-load/workpad.md`

## workspace-owned: validation evidence

- 2026-08-31 20:26:53 `review.run`: passed — OK
- 2026-08-31 20:29:38 `verify`: failed — COMMAND_FAILED
- 2026-08-31 20:43:19 `review.run`: passed — OK

## key decisions

- Use a fixed 2 second handoff window. It tolerates Linux event-loop and atomic-rename delay without consuming the full caller timeout.
- Treat the exact parent fallback error as provisional during that window; all other owned terminal markers remain authoritative immediately.
- Preserve owned-marker validation and do not respawn or terminate providers during ambiguous completion recovery.

## notes for ko

- none yet

## improvements noticed

- none yet

## issues and recovery

- Red proof: delayed marker remained `completion_unknown` under the old 250 ms window (`trc_1ccc7da7f768`).
- Final green proof: fallback handoff plus markerless tests passed (`trc_3ccef9b491a5`); all 59 affected provider/lifecycle tests passed (`trc_cd5e4e3fa35b`); OS syntax/typecheck passed (`trc_9bcf0040e8d7`); current strict review reported 0 blockers (`trc_6644d1a92125`).
- Canonical full verify cannot stamp because the auto-selected whole OS baseline remains independently unstable. A capped run still had 14 failures across 10 unrelated installer, lifecycle matcher, and daemon fixture files (`trc_d0b30929f47a`). Ko explicitly approved shipping this PR and passing unrelated failures for now.
- The original `os/call` route became stale after verification. A steering refresh showed the local workers remained alive, and the refreshed Codex-app OS route restored task access without changing the runtime.

---

## publish checklist

```bash
bun run task:push -- --message "type(os): description" --changed
bun run task:pr
bun run task:finish
```

## Test-first contract

behavior under test: completion_unknown detached runs whose pid has exited must wait through a load-tolerant owned-exit-marker handoff, then complete from the marker; truly markerless dead runners must still fail within a bounded recovery window.
existing local pattern: subagent lifecycle regressions use synthetic durable runs and delayed marker creation; orchestration contract exercises real detached providers.
new or changed tests: extend the delayed owned-marker regression beyond the current 250 ms grace and retain a bounded markerless-run assertion.
focused red command: `bun --cwd packages/os test tests/subagent-lifecycle-regressions.test.ts tests/subagent-orchestration-contract.test.ts` after making the delayed marker deterministic.
expected red failure: current code settles `completion_unknown` before a delayed marker appears and reports `runner process exited without writing a durable exit marker`.
no-test waiver: not applicable.
CI evidence: final-head workspace contracts and verify failed with 31 related provider/marker tests; examples include inherited secrets, completion_unknown marker wait, and Grok durable runner (`trc_23cad9f0fdd0`).

- 2026-08-31 20:15:25 append: `.task/os/fix-pr-2310-linux-durable-runner-marker-handoff-under-load/workpad.md`

- 2026-08-31 20:19:53 apply-patch: `packages/os/tests/subagent-lifecycle-regressions.test.ts`
- 2026-08-31 20:21:00 apply-patch: `packages/os/scripts/lib/subagent/lifecycle.ts`
- 2026-08-31 20:21:00 apply-patch: `packages/os/tests/subagent-lifecycle-regressions.test.ts`

- 2026-08-31 20:28:16 apply-patch: `.task/os/fix-pr-2310-linux-durable-runner-marker-handoff-under-load/workpad.md`

- 2026-08-31 20:34:28 apply-patch: `packages/os/tests/subagent-lifecycle-regressions.test.ts`
- 2026-08-31 20:35:23 apply-patch: `packages/os/scripts/lib/subagent/lifecycle.ts`

- 2026-08-31 20:44:01 apply-patch: `.task/os/fix-pr-2310-linux-durable-runner-marker-handoff-under-load/workpad.md`