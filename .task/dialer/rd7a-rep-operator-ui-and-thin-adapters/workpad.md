# RD7A rep operator UI and thin adapters

branch: `task/dialer/rd7a-rep-operator-ui-and-thin-adapters`
stream: `stream/dialer`
pr: https://github.com/consuelohq/opensaas/pull/2469
started: 2026-09-13

## acceptance criteria

- [x] Define explicit task acceptance criteria before coding.
- [x] Project RD4/RD3 authoritative rep, assignment, queue, and configuration state in the admin surface.
- [x] Send readiness, accept/decline, reconnect, wrap-up, and configuration mutations through authenticated thin adapters.
- [x] Preserve assignment generation on every offer action and keep stale acceptance actionable.
- [x] Keep existing outbound launcher, overlay, and call operations intact.
- [x] Add focused reducer, renderer, and adapter contract tests.
- [ ] Browser E2E and live carrier acceptance (blocked until RD5 runtime composition).

## plan

1. Read the relevant code and update this plan before editing.
2. Add red operator projection/adapter contracts.
3. Implement reducer, authenticated adapter, admin rendering, and delegated actions.
4. Run focused/full LeadConnector tests, typecheck, and embed build.

## files changed

- `/Users/kokayi/.consuelo/node/tasks/worktrees/task-dialer-rd7a-rep-operator-ui-and-thin-adapters/packages/lead-connector/src/embed/inbound-operator-view.ts`
- `/Users/kokayi/.consuelo/node/tasks/worktrees/task-dialer-rd7a-rep-operator-ui-and-thin-adapters/packages/lead-connector/src/embed/inbound-operator.test.ts`
- `/Users/kokayi/.consuelo/node/tasks/worktrees/task-dialer-rd7a-rep-operator-ui-and-thin-adapters/packages/lead-connector/src/embed/inbound-operator.ts`
- `/Users/kokayi/.consuelo/node/tasks/worktrees/task-dialer-rd7a-rep-operator-ui-and-thin-adapters/areas/dialer/rd/receipts/RD7A.md`
- `/Users/kokayi/.consuelo/node/tasks/worktrees/task-dialer-rd7a-rep-operator-ui-and-thin-adapters/packages/lead-connector/src/embed/controller.ts`
- `/Users/kokayi/.consuelo/node/tasks/worktrees/task-dialer-rd7a-rep-operator-ui-and-thin-adapters/packages/lead-connector/src/embed/index.ts`
- `/Users/kokayi/.consuelo/node/tasks/worktrees/task-dialer-rd7a-rep-operator-ui-and-thin-adapters/packages/lead-connector/src/embed/main.ts`
- `/Users/kokayi/.consuelo/node/tasks/worktrees/task-dialer-rd7a-rep-operator-ui-and-thin-adapters/packages/lead-connector/src/embed/state-machine.ts`
- `/Users/kokayi/.consuelo/node/tasks/worktrees/task-dialer-rd7a-rep-operator-ui-and-thin-adapters/packages/lead-connector/src/embed/styles.css`
- `/Users/kokayi/.consuelo/node/tasks/worktrees/task-dialer-rd7a-rep-operator-ui-and-thin-adapters/packages/lead-connector/src/embed/view.ts`
- `areas/dialer/rd/receipts/RD7A.md`

## key decisions

- Rep UI is a projection of server state; no client timer or local action grants capacity.
- Adapter routes are `/v1/inbound/operator/*`; RD5 supplies the authenticated runtime endpoints.
- Stale/expired/denied actions remain server-reasoned and visible instead of being treated as successful connects.

## notes for ko

- Live browser E2E, provider media, and carrier acceptance remain RD5 integration gates.

## validation evidence

- 2026-09-13: red contract `bun test packages/lead-connector/src/embed/inbound-operator.test.ts` failed before implementation with missing `./inbound-operator.js`.
- 2026-09-13: focused inbound contract passed (4 tests, 20 assertions).
- 2026-09-13: full LeadConnector source suite passed (126 tests, 0 failures).
- 2026-09-13: package typecheck and embed build passed.
- 2026-09-13: scoped review against `origin/stream/dialer` passed with 0 findings and 0 failed suites.

## integration handoff

- RD5 must provide authenticated `/v1/inbound/operator/*` routes matching `inbound-operator.ts` and preserve assignment generation/fenced endpoint actions.
- Live browser/provider E2E is intentionally deferred until RD5 runtime composition is available.

## improvements noticed

- none yet

## errors i ran into

- none yet

---

## publish checklist

```bash
bun run task:push -- --message "type(dialer): description" --changed
bun run task:pr
bun run task:finish
```

## Test-first contract

Behavior under test: rep/operator UI reflects authoritative inbound routing state, exposes readiness and endpoint selection, accepts or declines offers through thin adapters, presents reconnect/recovery and wrap-up controls, and lets operators inspect queue/number/hours/overflow configuration without owning routing decisions locally.

Existing local pattern: packages/lead-connector/src/embed/* owns the isolated iframe application; packages/dialer-server/src/inbound/* owns provider-neutral routing/capacity stores; packages/dialer-server/src/routes/* owns authenticated transport. Existing outbound LeadConnector launcher and dialer UI must remain intact.

New or changed tests: focused LeadConnector UI/adapter contract tests for authoritative state projection, endpoint/readiness actions, stale or denied actions, reconnect recovery, wrap-up, and operator configuration rendering. Add only the smallest server adapter contract tests if this task adds a transport mapping.

Focused red command: run the nearest LeadConnector Vitest/Jest suites discovered from package configuration before implementation; if no existing test target covers the new boundary, add a focused failing contract test first.

Red result: `bun test packages/lead-connector/src/embed/inbound-operator.test.ts` failed as expected before implementation because `./inbound-operator.js` did not exist.

Expected red failure: the new UI contract or adapter export is absent, or the initial state/action behavior is not yet implemented.

Scope guard: RD7A only. Do not implement carrier/media composition, provider webhooks, scheduling, customer callbacks, calendar integration, learned routing, or live acceptance. RD5 owns telephony/runtime composition; live acceptance waits for RD5.

- 2026-09-13 16:25:19 append: `.task/dialer/rd7a-rep-operator-ui-and-thin-adapters/workpad.md`

## workspace-owned: files changed

- `/Users/kokayi/.consuelo/node/tasks/worktrees/task-dialer-rd7a-rep-operator-ui-and-thin-adapters/packages/lead-connector/src/embed/inbound-operator-view.ts`
- `/Users/kokayi/.consuelo/node/tasks/worktrees/task-dialer-rd7a-rep-operator-ui-and-thin-adapters/packages/lead-connector/src/embed/inbound-operator.test.ts`
- `/Users/kokayi/.consuelo/node/tasks/worktrees/task-dialer-rd7a-rep-operator-ui-and-thin-adapters/packages/lead-connector/src/embed/inbound-operator.ts`
- `areas/dialer/rd/receipts/RD7A.md`

## workspace-owned: activity log

- 2026-09-13 16:25:19 fs.write: `.task/dialer/rd7a-rep-operator-ui-and-thin-adapters/workpad.md`
- 2026-09-13 16:30:13 fs.write: `/Users/kokayi/.consuelo/node/tasks/worktrees/task-dialer-rd7a-rep-operator-ui-and-thin-adapters/packages/lead-connector/src/embed/inbound-operator.test.ts`
- 2026-09-13 16:32:27 fs.write: `/Users/kokayi/.consuelo/node/tasks/worktrees/task-dialer-rd7a-rep-operator-ui-and-thin-adapters/packages/lead-connector/src/embed/inbound-operator.ts`
- 2026-09-13 16:33:14 fs.write: `/Users/kokayi/.consuelo/node/tasks/worktrees/task-dialer-rd7a-rep-operator-ui-and-thin-adapters/packages/lead-connector/src/embed/inbound-operator-view.ts`
- 2026-09-13 16:40:57 fs.write: `areas/dialer/rd/receipts/RD7A.md`

## workspace-owned: files read

- `/Users/kokayi/.consuelo/node/tasks/worktrees/task-dialer-rd7a-rep-operator-ui-and-thin-adapters/.consuelo/workpad.md`
- `areas/dialer/rd/GRAPH.md`
- `areas/dialer/rd/receipts/RD4.md`
- `packages/dialer-server/src/inbound/README.md`
- `packages/dialer-server/src/inbound/REP-CAPACITY.md`
- `packages/dialer-server/src/inbound/ROUTING.md`
- `packages/dialer-server/src/inbound/rep-capacity-commands.ts`
- `packages/dialer-server/src/inbound/rep-capacity-projection.ts`
- `packages/dialer-server/src/inbound/rep-capacity.ts`
- `packages/dialer-server/src/inbound/routing-store.ts`
- `packages/dialer-server/src/inbound/routing.ts`
- `packages/dialer/src/inbound/index.ts`
- `packages/dialer/src/inbound/rep-capacity-contracts.ts`
- `packages/dialer/src/inbound/rep-capacity-ports.ts`
- `packages/dialer/src/inbound/routing-contracts.ts`
- `packages/dialer/src/inbound/routing-ports.ts`
- `packages/lead-connector/src/embed/api-client.ts`
- `packages/lead-connector/src/embed/controller.test.ts`
- `packages/lead-connector/src/embed/controller.ts`
- `packages/lead-connector/src/embed/index.ts`
- `packages/lead-connector/src/embed/main.ts`
- `packages/lead-connector/src/embed/state-machine.test.ts`
- `packages/lead-connector/src/embed/state-machine.ts`
- `packages/lead-connector/src/embed/surface.ts`
- `packages/lead-connector/src/embed/view.test.ts`
- `packages/lead-connector/src/embed/view.ts`

- 2026-09-13 16:38:04 apply-patch: `.task/dialer/rd7a-rep-operator-ui-and-thin-adapters/workpad.md`

- 2026-09-13 16:38:14 apply-patch: `.task/dialer/rd7a-rep-operator-ui-and-thin-adapters/workpad.md`
- 2026-09-13 16:38:19 apply-patch: `packages/lead-connector/src/embed/inbound-operator.test.ts`

## workspace-owned: validation evidence

- 2026-09-13 16:39:33 `review.run`: passed — OK
- 2026-09-13 16:40:23 apply-patch: `packages/lead-connector/src/embed/controller.ts`
- 2026-09-13 16:40:39 `review.run`: passed — OK

- 2026-09-13 16:40:57 write: `areas/dialer/rd/receipts/RD7A.md`

- 2026-09-13 16:41:11 apply-patch: `.task/dialer/rd7a-rep-operator-ui-and-thin-adapters/workpad.md`