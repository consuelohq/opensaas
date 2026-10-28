# RD4 — Deterministic inbound queue routing and decision evidence

Status: implementation, isolated validation, strict review and canonical
verification passed; task-to-stream integration pending at this checkpoint.
Task PR: https://github.com/consuelohq/opensaas/pull/2464
Branch: `task/dialer/rd4-deterministic-inbound-queue-routing-and-decision-evidence`
Base stream: `4aa170ad8e950b9b0375bc6ec935658557e1d7bc`
Stream review: https://github.com/consuelohq/opensaas/pull/2436
Observed: 2026-09-13 UTC. Final head/merge SHA and cleanup are in the coordinator
handoff; verify live GitHub ancestry rather than treating this checkpoint as merge proof.

## Delivered

- SDK FIFO serviceable-caller/available-owner-first/longest-idle baseline, hard
  eligibility, stable ties, original age, business hours and DST, finite wait/
  attempts, rep cooldown/repeat exclusion, due callback window and fallback proposal.
- Atomic Postgres policy/configuration, immutable decision frame and actual fenced
  reservation outcome, using the existing RD3 authority in the same transaction.
  Duplicate decision IDs return the prior result; competing workers cannot own
  one capacity twice. Unknown external effects remain protected.
- Additive migration 008 and guarded down/up; earlier schema and RD2 lab preserved.
  Immutable snapshots retain policy/config/metadata versions, candidate formation,
  exclusions, attempts and shared capacity state without phone/CRM payloads.
- Integration guide: `packages/dialer-server/src/inbound/ROUTING.md`.
  Workpad: `.task/dialer/rd4-deterministic-inbound-queue-routing-and-decision-evidence/workpad.md`.

## Validation at the implementation checkpoint

- Strict review: zero findings. Canonical verification: passed, publish-valid.
- 452 tests passed, zero failed, 1,692 assertions across 70 files:
  both packages, actual isolated Postgres RD3/RD4 tests (including independent
  routing processes), and the existing real Postgres/Redis RD2 failure lab.
- Nx typecheck and build passed for both packages, including SDK compiled-export
  smoke proof. Tested locale-sensitive hours include repeated/skipped DST hours.
- Failed routing-evidence insertion rolls back reservation/commands; safe offer
  expiry cannot free unknown dispatch; bounded fallback survives recreation;
  future request state cannot influence a reservation; unsafe rollback refuses.
- Initial red policy import proved missing implementation. Broader validation
  caught and fixed test typing, the lab executable header and migration count.
- This is simulated application/database proof. No live carrier calls, customer
  browser entry, recording, production deployment or main promotion occurred.

## Prerequisites and unresolved findings

RD0, foundation, RD1 (#2448), RD2 (#2453) and RD3 (#2454) were already merged into
the observed stream. RD4 was the only active RD task PR at initial refresh.
The following pre-existing issues were classified, not waived or fixed:

1. #2436 discussion_r3980965865: outbound partial-provider-creation can omit
   predictive decision finalization after some carrier legs exist. Foundation/
   RD5/RD8 release blocker; RD4 never executes that path and persists its own
   reservation/evidence transactionally before dispatch.
2. #2436 discussion_r3981314996: existing commercial-target-authorization test
   phone-shaped fixture policy finding. Retain in foundation/join review.
3. RD3 head CI: Consuelo / verify succeeded; Consuelo / dialer failed its Docker
   build because Bun executed the SDK node:test smoke test outside Node's runner.
   Local Node smoke and builds pass; container validation is still unresolved.
   Evidence: https://github.com/consuelohq/opensaas/actions/runs/34503314749/job/102959456986
   No Nx Cloud configuration exists for this stream. A skipped CodeRabbit review
   on #2436 (file limit) is not a clean review.

## Next graph boundary

After RD4 integration and fresh CI/review assessment, RD5 and RD7A may proceed in
parallel with distinct runtime/transport and UI ownership. RD5 must supply a fair
queue worker cadence, authenticated request/endpoint admission, guarded command
delivery, caller waiting/DTMF/fallback handling, unknown-effect reconciliation and
shared inbound/outbound occupancy composition. RD7A consumes these authoritative
contracts; it does not infer connection or assignment from client timers.

RD6 owns callback obligations, actual scheduling/cancellation/no-answer and
calendar integration. RD8 owns the full release join. Candidate bounds are explicit
(1,000 capacity records/queue requests, 100,000 attempt events); no throughput or
causal-policy certification is claimed. Activation and carrier proof remain gated
by the frozen RD0 contract and separately approved scope.
