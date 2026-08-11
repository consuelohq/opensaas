---
name: branch
description: Use when Ko wants to align on a large repo project or epic, investigate hidden risks, and decompose it into a dependency-aware stack of branch-sized PRs or branched-chat workstreams. Also use when Ko says an established "Branch N approved, go" plan should be executed. Do not use for an ordinary Git branch command or a single already-scoped repo task.
---

# Branch

Turn large engineering work into an aligned plan that can be split across focused chats or agents without losing architecture, context, or other agents' work.

The workflow has two modes:

1. **Plan mode** — align, investigate, and freeze a branch graph.
2. **Execute mode** — run exactly one previously approved branch against the current integration-stream state.

Do not create implementation branches merely because the user is discussing architecture. Stay in plan mode until the user approves execution.

## Why this workflow exists

Conversation branching is a context-management tool and a separation-of-concerns tool.

A large project benefits from one parent conversation that carries the full architecture and decision history, then focused child conversations that each receive a bounded implementation contract. The repository and integration stream synchronize what actually landed between sibling chats.

The goal is not to maximize the number of branches. The goal is to make each unit of work independently understandable, testable, reviewable, and mergeable while preserving the larger design.

## Boundary with the task skill

Use `branch` to decide **what the work units are and how they depend on each other**.

Use `task` to execute **one concrete repo work unit** after that unit is approved.

Do not duplicate task lifecycle instructions inside this skill. Once execution begins, follow the task and senior-engineer workflows for repository mutation, testing, review, and publishing.

## Plan mode

### 1. Align before decomposing

Start with the user's actual goal, constraints, and concerns. Do not rush to a PR list.

During alignment:

- Explain the architecture in the simplest useful mental model first, then add technical precision.
- Let the user challenge or modify the plan. Treat those changes as design inputs, not interruptions.
- Push back when a proposal weakens an invariant, duplicates existing machinery, or creates avoidable operational risk.
- Investigate obvious repo questions instead of asking the user to remember implementation details.
- Preserve useful existing systems. Prefer extension over parallel replacements when the current architecture already owns the concern.
- Keep implementation read-only until the user approves mutation.

Maintain three mental buckets while discussing the project:

- **Locked** — decisions and invariants that are aligned.
- **Open** — questions or risks that can still change the design.
- **Deferred** — good ideas that do not need to block this project.

Do not freeze the branch stack while a material open item can invalidate branch boundaries.

### 2. Perform a transition/readiness deep dive

Before finalizing a large migration or architecture change, deliberately search for assumptions that the first-pass plan may miss.

Use repository evidence and, when needed, current upstream specifications. Relevant categories vary by project, but common hidden dependencies include:

- authentication, OAuth, authorization, scopes, signatures, and security gates;
- transport/session identity and compatibility clients;
- process-local caches, Maps, mutexes, queues, leases, locks, or counters used for correctness;
- retry and idempotency assumptions;
- deployment, restart, watchdog, health, readiness, and rollback behavior;
- Cloudflare, Caddy, proxies, tunnels, headers, and timeouts;
- tracing, logging, metrics, and existing observability surfaces;
- configuration, migrations, persisted data, and upgrade behavior;
- local-resource ownership such as worktrees, browser sessions, shells, or files;
- stale tests whose assertion encodes the old architecture rather than a real invariant;
- older or unmerged branches that already implemented part of the desired behavior.

Keep asking:

> What currently works only because an unstated assumption happens to be true?

For distributed or stateless work, examples include "the same process handles the next request," "this file has one writer," or "this handle implies the resource is on this machine."

Separate true migration blockers from adjacent improvements. Add blockers to the stack. Defer unrelated improvements instead of turning one project into an unbounded rewrite.

### 3. Define invariants and non-goals

Before defining PRs, state what must remain true across the entire stack.

Typical invariants include security boundaries, backwards compatibility, state ownership, data integrity, no loss of other agents' work, and no blind replay of unsafe mutations.

Also state non-goals. A non-goal prevents a useful adjacent idea from silently expanding the implementation contract.

### 4. Build a dependency graph, not just a numbered list

Choose branch boundaries by dependency and ownership.

A good branch:

- has one primary purpose;
- has a coherent file/subsystem ownership surface;
- can be tested and reviewed independently;
- leaves the integration stream in a valid state;
- establishes prerequisites needed by later work without prematurely implementing those later features.

Mark dependencies explicitly.

Example:

```text
Branch 1 ──> Branch 2 ──> Branch 4
                 \
                  └──────> Branch 3

Parallel lane A ─────────> Branch 4 gate
```

Use waves for very large epics:

```text
Wave 0: foundations
Wave 1: independent branches A, B, C
Wave 2: integration branches that depend on Wave 1
Wave 3: rollout / migration / cleanup
```

Do not assume unlimited local workers. Parallelism is an architecture decision constrained by file ownership, runtime resources, shared state, and integration cost.

### 5. Decide what is truly safe to run in parallel

Parallelize only when all of these are true:

- neither branch depends on the other's behavior or schema;
- file ownership is disjoint or the merge boundary is deliberately designed;
- both branches share a clearly named base/integration stream;
- one branch cannot invalidate the other's assumptions while it is in flight;
- the integration order is known.

Good parallel candidates often include independent cloud preparation, documentation/UI work against a stable schema, or a lifecycle fix that does not touch the transport implementation.

Keep security foundations, state-model migrations, protocol cutovers, and load-balancer activation serial when later steps rely on guarantees established earlier.

When multiple agents work at once, the repository is the synchronization point. Before publishing, each agent must inspect the latest integration-stream state and reconcile semantic conflicts. Never use blanket `ours`/`theirs` conflict resolution that can discard another agent's work.

## Freeze the implementation contract

When the user asks for the technical spec, PR stack, or says alignment is complete, publish a stable plan.

The plan should contain:

- objective and target architecture;
- component/state ownership;
- invariants;
- compatibility and rollout strategy;
- non-goals;
- branch dependency graph;
- parallel lanes;
- regression/security gates;
- a stable command contract for branch execution.

Define each branch with this shape:

```text
Branch N — <slug>
Trigger: "Branch N approved, go"

Purpose
Assumes
Primary files/subsystems
Changes
Acceptance / regression gates
Non-goals
Integration or rollback notes
```

After the user approves the stack, keep branch numbers stable. If new evidence requires an inserted unit, append a new branch or use an explicit suffix such as `3A`; do not renumber sibling chats and make their contracts ambiguous.

Do not start every task/worktree up front. Create a task when its branch is approved unless the user explicitly asks for a coordinated multi-agent launch.

## Execute mode

When the user says `Branch N approved, go` or an equivalent approval for an already frozen branch:

1. Treat that branch definition as the scope contract.
2. Inspect the current repository and latest intended integration stream. Do not rely on sibling-chat memory to determine what landed.
3. Verify the prerequisite branches are actually present. If equivalent work landed under a different implementation, adapt instead of duplicating it.
4. Invoke the senior-engineer and task workflows for repository execution.
5. Start one dedicated task/worktree from the current integration-stream tip unless the frozen branch explicitly belongs to an independent parallel lane.
6. Implement only the approved branch's scope.
7. Run the branch's focused tests plus the relevant regression/security gates.
8. Review and publish that branch.
9. Stop. Do not silently proceed to the next numbered branch.

If current repo truth differs materially from the frozen plan, preserve the plan's invariants and make the smallest necessary adaptation. Reopen the global architecture only when the new evidence invalidates an invariant or dependency boundary.

## Context handoff rule

Sibling branched conversations inherit planning context from the parent, but they do not share future implementation events with each other.

Therefore:

- conversation context explains **why** the branch exists;
- the frozen branch definition explains **what** it owns;
- the repository/integration stream proves **what actually landed**.

A later branch should assume earlier approved work is intended to be complete, then verify that assumption from the current stream before mutation.

## Quality bar

A strong branch plan makes a large project feel boring to execute.

By the time `Branch N approved, go` is used, the implementation agent should not need to rediscover the project architecture. It should need only to reconcile current repo state, execute the bounded contract, prove it, and publish it.
