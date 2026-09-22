# Inbound failure lab (RD2)

Run from the repository root:

```sh
NX_DAEMON=false yarn nx run @consuelo/dialer:build
NX_DAEMON=false yarn nx run @consuelo/dialer-server:lab:verify
bun packages/dialer-server/scripts/local-dialer-lab.ts --scale smoke --seed 4242
```

The SDK build includes the Node import smoke check. The lab needs local
PostgreSQL binaries (`pg_config`) and Redis. It creates its own temporary
clusters on loopback ports, applies the production migrations, exercises the
same SDK reducer and PostgreSQL journal/outbox factory, then removes its services
and data. It does not read deployment database URLs or carrier credentials.
Keep the complete JSON output as a scenario artifact; it contains synthetic
identifiers, normalized events, materialized states, command outcome history,
worker checkpoints and simulated carrier effect counts.

## Components and extension points

- `inbound-simulator.ts`: monotonic virtual clock, seeded delivery schedule,
  explicit copy counts (zero means dropped), browser/phone reachability and replies,
  and a simulated carrier that records every execution. A duplicate dispatch
  causes an extra effect deliberately; no mock idempotency hides a bug.
- `inbound-process-runner.ts`: independent Bun workers with a ready barrier,
  bounded message size and process deadlines. It kills a worker with SIGKILL only
  after receiving the requested checkpoint, then waits for its actual exit.
  The carrier lives in the controller process and survives worker death.
- `inbound-lab-worker.ts`: lab-only journal/outbox driver. Commands and local
  database configuration arrive over private stdin. Its environment contains no
  inherited provider credentials. This is not the future RD5 executor.
- `inbound-simulation-fixtures.ts`: legal version-1 lifecycle fixtures for requests,
  participants, assignments, bridge attempts and capacity. Fixture creation is not
  a production authorization decision.
- `inbound-simulation-evidence.ts`: ordered durable evidence and replay comparison.
- `inbound-simulation-scenarios.ts`: the service-backed scenario catalog.
  Add node-owned cases here or call these helpers from a new scenario module.
  Keep resource creation/cleanup with the outer lab, not an individual scenario.

The worker accepts only synthetic rd2 tenants and the loopback temporary database
shape. That check is an accident guard, not proof that any arbitrary local port is
safe: always obtain resources from the isolated lab, never pass a customer pool.
The production runtime entry does not import any of these lab modules.

## Current proof

Fourteen scenarios cover pre-commit, post-commit, post-claim, post-provider-effect
and post-outcome worker death; carrier rejection and lost response with temporarily
unavailable reconciliation; duplicate-fact, optimistic-version and dispatch races
across distinct processes; delayed endpoint acceptance after offer expiry; caller
hangup with an unknown bridge; and two identical seeded delivery replays.

The driver records pending/dispatched/unknown/succeeded/failed independently of
bridge or participant state. An execution record alone never turns a request into
connected. A lost response remains unknown until the simulated provider supplies
evidence. The simulator's absent response is authoritative by construction; real
provider absence may be inconclusive and RD5 must not copy that assumption blindly.

Presence-index loss deletes only a synthetic key in the isolated Redis instance,
then verifies complete journal evidence is unchanged. This does not prove Redis
server failover or RD3 eligibility policy. Postgres remains running while application
workers die; the existing performance lab disables fsync/synchronous commit, so
this is not database crash, power-loss or storage-durability proof.

Seed controls delivery order and timing. Identical seeded schedules have identical
observed outcomes. OS process race winners are intentionally nondeterministic;
the trace records the committed result, and assertions require exactly one winner.
A stable seed is not a claim of deterministic operating-system scheduling.

## Boundaries for later nodes

RD3 owns shared capacity generations, endpoint winners and safe release; these
fixtures deliberately leave connecting/unknown capacity protected. RD4 adds policy
and scheduling assertions. RD5 adds authenticated ingress, actual worker recovery,
carrier-specific idempotency/reconciliation, media continuity and bridge evidence.
RD6 adds callback obligation scenarios. No mocked acceptance proves two-way audio.

All fake effects are controller messages, not Twilio/HTTP requests. No carrier
calls, spend, recording, deployment, or customer data is involved. Existing outbound
scientific scenarios and migration rollback checks still run in the same lab.
Each child process is awaited; service stops are attempted independently. Data is
not removed while service ports remain open, and cleanup failure fails the run.
