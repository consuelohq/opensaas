# RD7A receipt — rep/operator UI and thin adapters

Status: implementation and post-RD5 operator/browser acceptance complete. The RD7A UI is now wired to RD5's authoritative inbound runtime, including browser media admission and multi-tab fencing. Live carrier/audio proof remains intentionally deferred to RD8 because no exact live-call authorization was provided.

Original task branch: `task/dialer/rd7a-rep-operator-ui-and-thin-adapters`
Original task PR: [#2469](https://github.com/consuelohq/opensaas/pull/2469)
Post-RD5 acceptance task: `task/dialer/rd7a-operator-acceptance-against-rd5`
Post-RD5 acceptance PR: [#2475](https://github.com/consuelohq/opensaas/pull/2475)
Stream: `stream/dialer`

## Delivered

- Added `InboundOperatorState` projection and reducer for RD3/RD4 authoritative rep, assignment generation, endpoint, queue, and configuration snapshots.
- Added authenticated `createLeadConnectorInboundOperatorApi` adapter for snapshot, readiness, accept/decline, reconnect, wrap-up, and configuration routes.
- Wired the adapter into the existing LeadConnector controller without changing outbound or overlay call ownership.
- Added admin rep/operator UI for readiness and browser/phone endpoint selection, incoming offers, stale/denied feedback, connecting/unknown recovery, wrap-up, queue visibility, and number/team/hours/overflow configuration.
- Preserved assignment and generation fields on every offer action; the UI never grants capacity from a timer or client-side accept.
- Added focused reducer, renderer, authenticated adapter, browser voice, and controller contract coverage.

## Post-RD5 acceptance closure

- Browser readiness now prepares microphone permission and registers the Twilio Voice SDK device before RD5 is allowed to advertise the browser endpoint as ready. Permission/device preparation failure fails closed and does not publish readiness.
- RD5 remains authoritative for offer admission. A browser invite is accepted in the Voice SDK only after the fenced server accept succeeds; stale/expired/denied server results reject the local pending invite instead.
- Browser media acceptance never self-promotes the assignment to `connected`. The UI stays `connecting` until a later RD5 snapshot contains provider-confirmed connected evidence.
- RD5 snapshot polling preserves a pending/active browser media path while the same browser assignment is `connecting`, `connected`, or `unknown`, while truly expired/no-longer-offered work is rejected locally.
- Browser media failure enters recoverable state without rewriting the RD5 assignment, and reconnect restores only the authoritative server phase.
- Phone endpoint acceptance does not touch the browser media device.
- Concurrent same-endpoint browser tabs are now fenced by a per-UI acceptance attempt identity. Exactly one tab receives `accepted`; the loser receives a stale result. Repeating the exact winning action remains idempotently accepted.
- Wrap-up remains server-owned and returns to an idle assignment only after the server confirms completion.

## RD5 integration contract

RD5 exposes authenticated UI endpoints under `/v1/inbound/operator/*` returning the normalized snapshot shape in `packages/lead-connector/src/embed/inbound-operator.ts`. Accept and decline validate `assignmentId`, `generation`, and (for accept) `endpointId` against the current server generation. Browser accepts also carry a bounded per-action `attemptId`, which is folded into the durable rep-capacity operation identity so transport retries of one action are idempotent while a second tab is fenced. A stale/expired/denied result does not report connection; `connected` comes only from runtime provider evidence. Unknown external effects remain protected until reconciliation.

The UI consumes server snapshots and sends actions through the adapter. It does not call Postgres/Redis authority methods, supply authority clocks, run routing ticks, or compose carrier media.

## Validation

- Focused browser/controller/adapter tests after post-RD5 closure: 29 passed, 0 failed.
- Full `packages/lead-connector/src`: 136 passed, 0 failed.
- Full `packages/dialer/src`: 252 passed, 0 failed.
- Full ordinary `packages/dialer-server/src`: 188 passed, 0 failed; 39 service-backed cases skipped by the ordinary package command as designed.
- Isolated real-Postgres RD5 telephony integration: 17 passed, 0 failed. This includes two independent LeadConnector adapter clients concurrently accepting the same browser assignment/endpoint: exactly one wins, the other is stale, and replaying the winning `attemptId` remains idempotent.
- Shared real-Postgres RD3 + RD4 + RD5 regression: 34 passed, 0 failed.
- LeadConnector typecheck: passed.
- Strict `review.run` against `origin/stream/dialer`: 0 task findings / 0 task blockers. It reports the existing task-worktree `@consuelo/lead-connector/embed` Dialer Server TypeScript resolution issue as pre-existing; runtime tests and canonical review do not attribute that workspace-link issue to RD7A.
- Real rendered-browser acceptance used the production RD7A controller, inbound renderer, and Voice SDK wrapper with only the carrier/device boundary injected. Proven cases: permission denial/fail-closed readiness, successful browser registration/readiness, stale accept, offer expiry cleanup, accept-before-incoming plus intervening RD5 poll, truthful `connecting`, simulated browser-media failure/recovery, authoritative reconnect to `connected`, and wrap-up completion. No carrier call was placed.
- Browser evidence captured for truthful connecting state as `rd7a-connecting-truth` during the acceptance run.

## Remaining release boundary

RD7A has no remaining implementation dependency on RD5. RD8 still owns live provider/carrier audio proof, final stream/main reconciliation, full integrated release review, deployment evidence, and any live-call acceptance. No real Twilio call, provider spend, recording, or transcription was performed in RD7A acceptance.
