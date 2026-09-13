# RD7A receipt — rep/operator UI and thin adapters

Status: implementation complete; isolated validation and review passed. Live browser/provider acceptance remains blocked until RD5 runtime composition is integrated.

Task branch: `task/dialer/rd7a-rep-operator-ui-and-thin-adapters`
Task PR: [#2469](https://github.com/consuelohq/opensaas/pull/2469)
Stream: `stream/dialer`

## Delivered

- Added `InboundOperatorState` projection and reducer for RD3/RD4 authoritative rep, assignment generation, endpoint, queue, and configuration snapshots.
- Added authenticated `createLeadConnectorInboundOperatorApi` adapter for snapshot, readiness, accept/decline, reconnect, wrap-up, and configuration routes.
- Wired the adapter into the existing LeadConnector controller without changing outbound or overlay call ownership.
- Added admin rep/operator UI for readiness and browser/phone endpoint selection, incoming offers, stale/denied feedback, connecting/unknown recovery, wrap-up, queue visibility, and number/team/hours/overflow configuration.
- Preserved assignment and generation fields on every offer action; the UI never grants capacity from a timer or client-side accept.
- Added focused reducer, renderer, and authenticated adapter contract coverage.

## Integration contract for RD5

RD5 should expose authenticated UI endpoints under `/v1/inbound/operator/*` that return the normalized snapshot shape in `packages/lead-connector/src/embed/inbound-operator.ts`. Accept and decline must validate `assignmentId`, `generation`, and (for accept) `endpointId` against the current server generation. A stale/expired/denied result should return a typed action result; it must not report a connection until the runtime confirms both media legs. Unknown external effects remain protected until reconciliation.

The UI consumes server snapshots and sends actions through the adapter. It does not call Postgres/Redis authority methods, supply authority clocks, run routing ticks, or compose carrier media.

## Validation

- `bun test packages/lead-connector/src`: 126 passed, 0 failed.
- `bun run --cwd packages/lead-connector typecheck`: passed.
- `bun run --cwd packages/lead-connector build`: passed.
- `review.run` against `origin/stream/dialer`: 0 findings, 0 failed suites.
- Live carrier/browser E2E: not run; intentionally waits for RD5.

## Known follow-up

After RD5 integration, run browser E2E for concurrent tabs, stale Accept, offer expiry, reconnect, failed devices, permissions, truthful connecting/connected media status, and wrap-up. Then exercise the adapter against RD5 fixtures and promote the integrated stream only after task and stream review evidence are current.
