# RD5 receipt — inbound telephony runtime bridge and recovery

Status: implementation complete; isolated validation and strict review passed. Canonical verification and task-to-stream promotion are the remaining publication gates at this checkpoint.

Task branch: `task/dialer/rd5-inbound-telephony-runtime-bridge-and-recovery`
Task PR: [#2468](https://github.com/consuelohq/opensaas/pull/2468)
Stream: `stream/dialer`
Stream review: [#2436](https://github.com/consuelohq/opensaas/pull/2436)
Observed: 2026-09-13 UTC. Live GitHub ancestry is canonical merge proof after task promotion.

## Delivered

- Added signed inbound Twilio admission that resolves the configured carrier account and DID to the owned workspace/number before creating or mutating inbound state. Duplicate incoming delivery is idempotent and never redials the already-live caller.
- Preserved the inbound caller carrier leg while RD4 routing selects an eligible rep, and composed browser/phone endpoint admission with the shared fenced RD3 rep-capacity authority. Acceptance is bound to the current `assignmentId`, generation and endpoint; phone ringing/answering alone cannot win authority.
- Added durable telephony sessions/effects/facts plus additive migration 009. Offer, bridge, redirect, termination and voicemail operations are recorded before/around provider effects so retries and restart recovery do not invent success or blindly duplicate commands.
- Added reconciliation that keeps escaped/unknown provider effects protected, retains the capacity owner while outcome is uncertain, and reports `connected` only after carrier evidence shows both caller and rep conference participants present and neither muted nor held.
- Added restart discovery/recovery, bounded wait/DTMF/fallback behavior, caller-abandonment cleanup, explicit voicemail selection/retention deletion, and guarded migration rollback that refuses while live/uncertain telephony state exists.
- Composed outbound parallel dialing with the same shared rep-capacity authority. Partial provider creation is observed incrementally; already-created legs and predictive decisions remain durable when a later provider call fails, and ambiguous creation retains capacity until reconciled.
- Exposed the authenticated `/v1/inbound/operator/*` runtime contract consumed by RD7A without moving authority into the browser. Transfer seams remain fail-closed where inbound participant-capacity behavior is not yet implemented.
- Kept ordinary inbound conversation recording/transcription off. Voicemail recording exists only on the explicit voicemail path and is subject to configured disclosure/retention behavior.

## Validation at this checkpoint

- `bun test packages/dialer/src`: **252 passed, 0 failed** (582 assertions).
- `bun test packages/dialer-server/src`: **188 passed, 0 failed, 39 opt-in service tests skipped** in the ordinary package run (1,037 assertions).
- Isolated real-Postgres RD3/RD4/RD5 run with `CONSUELO_RD3_PG_PORT`, `CONSUELO_RD4_PG_PORT`, and `CONSUELO_RD5_PG_PORT`: **34 passed, 0 failed** (174 assertions), including 17 RD5 telephony integration cases.
- `bun run --cwd packages/dialer-server lab:verify`: **1 passed, 0 failed** (35 assertions) against isolated local Postgres and Redis.
- `bun packages/dialer-server/scripts/local-dialer-lab.ts --scale smoke --seed 4242`: passed with migration 009, 30 inbound assertions, one concurrent winner, 14 crash/delivery/replay scenarios, deterministic replay, Redis-loss state preservation, real worker-process boundaries, and complete Postgres/Redis/temp-directory cleanup.
- `bun run --cwd packages/dialer typecheck`, `bun run --cwd packages/dialer-server typecheck`, and both package builds passed, including the compiled SDK Node smoke test.
- Strict workspace `review.run` against `origin/stream/dialer`: **0 findings, 0 pre-existing findings, 0 blockers**.
- The recovered branch is based on the current `origin/stream/dialer` RD7A head with zero stream commits missing at validation time.

## Safety and truthfulness boundaries

This checkpoint uses simulated carrier behavior with real local Postgres/Redis and real worker processes. It did **not** make a live carrier call, purchase a number, use production carrier credentials, start production recording/transcription, incur provider spend, deploy production, or promote the stream to `main`.

A provider operation whose external outcome remains permanently unknowable is intentionally conservative: the associated capacity stays protected instead of being silently reused. Operational/provider evidence or an authorized reconciliation path is required to resolve that state.

Inbound transfer participant-capacity behavior is not claimed by RD5. Unsupported transfer combinations remain fail-closed until the later graph boundary owns them.

## Remaining graph boundary

RD7A now has the server runtime contract it was waiting on. The integrated browser/provider acceptance pass should exercise concurrent tabs, stale Accept, offer expiry, reconnect, failed devices/permissions, truthful connecting-versus-connected media state, wrap-up, and the actual carrier audio path.

RD8 owns the final stream join, live carrier/browser release evidence, production activation and promotion to `main`. No live-carrier/audio certification is implied by this RD5 receipt.
