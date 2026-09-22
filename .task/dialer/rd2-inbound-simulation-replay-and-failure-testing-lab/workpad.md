# RD2 inbound simulation replay and failure testing lab

branch: `task/dialer/rd2-inbound-simulation-replay-and-failure-testing-lab`
stream: `stream/dialer`
pr: https://github.com/consuelohq/opensaas/pull/2453
started: 2026-09-10

## acceptance criteria

- [x] Isolated service-backed lab proves process crashes, duplicate/race handling, replay without effects, and bounded cleanup.
- [x] Simulator evidence distinguishes unknown provider outcomes and preserves connecting capacity.
- [x] Tests, builds, typechecks, review and canonical verification pass.
- [ ] Publish and verify task-to-stream integration, then clean this task safely.

## plan

1. Read the relevant code and update this plan before editing.

## files changed

- `packages/dialer-server/src/lab/inbound-simulation-scenarios.ts`
- `packages/dialer-server/src/lab/inbound-simulator.test.ts`

## key decisions

- none yet

## notes for ko

- none yet

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

RD2 only, graph rd-1. Own packages/dialer-server/src/lab/inbound-sim*, inbound-process* and inbound-lab-worker*, isolated lab script integration, associated tests/docs and receipts/RD2.md. Preserve RD3 production capacity/reservation modules and existing SDK/journal/schema contracts.
Prerequisites #2446/#2448/#2451 verified merged; source e79b01b786a1cb62b779c3a0adcf2715db4773c3. No RD2/RD3 open owner found before bootstrap. Current instruction path areas/dialer/AGENTS.md.
Behavior: seeded delivery duplicate/drop/reorder and clock/endpoint control; real process death before commit, after commit, after dispatch and after carrier acceptance; one transactional writer/claimant across processes; replay emits no effects; unknown outcome stays unresolved until explicit simulated-provider reconciliation; Redis loss does not remove durable journal state; bounded process and service cleanup.
Existing pattern: isolated local-dialer-lab creates real ephemeral Postgres/Redis with production migrations and createPostgresInboundJournal, currently tests concurrency only within one process.
New tests: pure simulator determinism/clock/lost-response semantics; service-backed lab scenarios with real child processes and provider simulator, durable evidence and teardown assertions. RED command: bun test packages/dialer-server/src/lab/inbound-simulator.test.ts (new API missing), then lab:verify failing absent RD2 evidence. GREEN commands: focused Bun tests, Nx lab:verify, package suite/typechecks/builds and canonical verify.
No no-test waiver. No deployed schemas/resources, credentials, calls or external providers. Lab worker input restricted to generated loopback resources, minimal environment and synthetic tenant IDs. Fake-provider evidence never counts as live-media proof.

- 2026-09-10 15:53:48 append: `.task/dialer/rd2-inbound-simulation-replay-and-failure-testing-lab/workpad.md`

## workspace-owned: files changed

- `packages/dialer-server/src/lab/inbound-simulation-scenarios.ts`
- `packages/dialer-server/src/lab/inbound-simulator.test.ts`

## workspace-owned: activity log

- 2026-09-10 15:53:48 fs.write: `.task/dialer/rd2-inbound-simulation-replay-and-failure-testing-lab/workpad.md`
- 2026-09-10 15:53:49 write: `packages/dialer-server/src/lab/inbound-simulator.test.ts`
- 2026-09-10 15:53:49 fs.write: `packages/dialer-server/src/lab/inbound-simulator.test.ts`
- 2026-09-10 15:59:27 write: `packages/dialer-server/src/lab/inbound-simulation-scenarios.ts`
- 2026-09-10 15:59:27 fs.write: `packages/dialer-server/src/lab/inbound-simulation-scenarios.ts`
- 2026-09-10 16:05:52 fs.write: `.task/dialer/rd2-inbound-simulation-replay-and-failure-testing-lab/workpad.md`

## Implementation and acceptance

Added deterministic simulator/endpoint clock, bounded private process protocol, real child-worker SIGKILL checkpoints, independent ready-barrier races, fixture/evidence modules and 14 service scenarios. Extended existing lab entry and its test; improved teardown to attempt both service stops and preserve directories if ports remain open. RD3 production modules and SDK/migrations unchanged.
RED/GREEN: missing simulator -> 4 pass; missing service simulation result -> full lab pass; extra boundary scenarios 12 -> 14; missing cleanup helper -> 2 pass. Protocol guard tests 2 pass. Package suites: 414 pass, 1 opt-in skip, 0 fail; 1486 expectations. Both Nx typechecks/builds passed. Final smoke seed4242 proves 14 scenarios / 23 worker processes, all exited, Postgres and Redis ports closed, temporary resources removed. Artifact: /var/folders/vl/1zvhm0bj28d1dbvbcb12b39r0000gn/T/consuelo-rd2-proof-k2cyfhgv/lab.json.

Evidence limits recorded in lab/INBOUND.md and RD2 receipt: no live media, no database crash proof (inherited lab fsync off), no Redis service failover claim; synthetic key loss only. Process race winners not deterministic; seeded delivery trace is. Protected unknown capacity remains for RD3 policy; lab worker is not RD5 executor.

- 2026-09-10 16:05:52 append: `.task/dialer/rd2-inbound-simulation-replay-and-failure-testing-lab/workpad.md`

## workspace-owned: validation evidence

- 2026-09-10 16:06:02 `verify`: failed — COMMAND_FAILED
- 2026-09-10 16:07:48 `verify`: failed — COMMAND_FAILED
- 2026-09-10 16:08:40 `verify`: passed — OK

## Final publication gate

2026-09-10 16:21 UTC: full canonical verify passed at 16:08:40, publishValid=true, changeHash f0810f4ee6385d55126b0bea9f752a4fe14b869697aca81184457fd8de77b208. Review completed with zero findings; selected suites passed (11 stream instruction tests and 183 server tests, with opt-in lab separately passed). Earlier async error-context findings were corrected; no waiver. Remote stream remains validated base e79b01b786a1cb62b779c3a0adcf2715db4773c3. RD3 #2454 remains open/owned. Foundation P1 comment3980965865 remains coordinator scope. No source edits since successful verification.
