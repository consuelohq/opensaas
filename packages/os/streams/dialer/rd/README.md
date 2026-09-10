# RD inbound routing program

Status: RD0 coordination is being established; product alignment is not yet frozen.
Integration lane: `stream/dialer`. Area: `dialer`.
Coordinator: the parent RD0 conversation. Preferred execution model: GPT-6 Astra, High reasoning.

## Start here

1. Read [COORDINATION.md](COORDINATION.md) for startup, publish, recovery, and copyable final responses.
2. Read [GRAPH.md](GRAPH.md) for the requested work ID and its prerequisites.
3. Read [DESIGN.md](DESIGN.md) for locked invariants and open product decisions.
4. Read [ACCEPTANCE.md](ACCEPTANCE.md) for the scientific and failure-testing contract.
5. Inspect the requested node's receipt under `receipts/`, its scoped task workpad, and live GitHub state.

These documents explain intent. Current remote stream contents, task PRs, checks,
and validation evidence prove what landed. A status in Markdown is a dated
observation, never permission to skip live prerequisite verification.

## How Ko uses this graph

Keep the parent RD0 conversation as the control room. After RD0 alignment is
complete, manually branch each approved work ID from the same completed RD0
message. Name the child with its ID, such as `RD3 — Rep capacity and fencing`.
Paste the exact launch prompt supplied by the coordinator.

Each child implements one approved ID, validates it, publishes to the same stream,
checks graph readiness, and ends with a copyable coordinator handoff. Paste that
handoff back into RD0. RD0 refreshes repository truth and returns a copyable launch
prompt for the next ready ID. At a parallel wave, it returns one clearly labelled
prompt per independent ID.

There are ten work IDs: RD0, RD1, RD2, RD3, RD4, RD5, RD6, RD7A, RD7B, RD8.
RD3 is the fourth ID when counted from RD0; IDs are stable names, not a requirement
that every task run sequentially. Do not renumber existing IDs as tasks finish.

Manual branching is the initial workflow. A sleeping coordinator, scheduled
automation, or automatic spawning is not required or enabled by this document.
Ko can later explicitly request automation or delegated agents. The repository
and handoff protocol remain the synchronization mechanism in either case.
A model preference written in a prompt does not change the app's model setting;
select Astra / High in the child or use supported explicit model controls.

## Current bootstrap and release gates

- RD0 was authorized on 2026-09-09 America/New_York. Coordination task:
  [PR #2437](https://github.com/consuelohq/opensaas/pull/2437).
- RD0 housekeeping can land before the product contract is frozen. Keep its
  architecture status `alignment_open` until the decisions in DESIGN.md are resolved.
- RD1 requires the frozen RD0 contract and verified integration of the relevant
  existing Dialer/scientific foundation into the chosen stream.
- Earlier discovery identified #2014 and #2404, siblings #2091/#2111/#2116/#2146,
  and guidance #2420 as cleanup surfaces. This is a historical inventory, not a
  current status claim. Refresh it; preserve D1-D4, including #2029 and #2037.
- Do not switch new RD tasks to `stream/dialer-algorithm`. Consume the reconciled
  work through `stream/dialer` once its ancestry and behavior have been verified.
- Each node integrates to `stream/dialer`. Stream-to-main promotion and runtime
  release belong to RD8's explicit release scope, not an earlier node's completion.
- No real calls, number purchases, provider charges, recording, transcription,
  destructive recovery, or production activation follow merely from graph approval.

The original main-based bootstrap PR #2434 is superseded by #2437. Its preserved
worktree is a recovery copy, not another active RD0 owner. Canonical stream guidance
now lives under packages/os/streams/dialer following the #2435 migration.

## Receipt ownership

Each implementation child owns only `receipts/<its-ID>.md` and its task workpad.
RD0 owns this index, graph amendments, and global product decisions. Sibling agents
must not rewrite another node's receipt or a shared global progress table.
Use [the receipt template](receipts/TEMPLATE.md); do not pre-create claimed/complete
receipts for work that has not started.

Open task PRs are the shared in-progress discovery surface. Search them before
starting and again after bootstrap. They are not an atomic distributed lock:
if duplicate ownership appears, coordinate with RD0 and preserve both worktrees.
