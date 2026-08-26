---
name: branch
description: Use proactively for large phases, epics, migrations, or planning sessions that need context management across multiple focused chats or tasks. Build a dependency graph of stable short work IDs such as D0, M1, or OS2, safe parallel waves, explicit joins, and one required finalization node; then execute one approved node at a time. Also use when the user approves an established work ID. Do not use for an ordinary Git branch command or a single already-scoped repo task.
---

# Branch

Turn large engineering work into a dependency graph that focused chats or agents can execute without losing the larger architecture.

Branch Graph is also a **context management** workflow. The parent conversation holds long-horizon planning memory, each child chat gets bounded working memory for one work ID, and the repository plus stream carry durable truth between chats that no longer share future conversation state.

The simple mental model is:

- the **parent conversation** is the control room;
- a **work ID** is one bounded, independently reviewable unit and one focused working-memory budget;
- a **stream** is the integration lane for related work;
- an **arrow** means one unit depends on another;
- a **wave** is a set of units that are safe to run in parallel;
- the **finalization node** is the join point where the whole graph is reviewed, cleaned up, promoted, canaried when authorized, and synchronized.

The workflow has two modes:

1. **Plan mode** — align, investigate, and freeze a Branch Graph.
2. **Execute mode** — run exactly one previously approved work ID against current repository truth.

Do not create implementation branches merely because the user is discussing architecture. Stay read-only in plan mode until the user approves execution.

## Why this workflow exists

Large projects fail when one conversation tries to hold every implementation detail or when several agents work in parallel without an explicit dependency map.

Branch gives the project a coordination and memory layer. One parent conversation carries the architecture and decisions. Focused child conversations receive small implementation contracts. Workpads, task PRs, the repository, and integration streams prove what actually landed between sibling chats.

The goal is not to maximize branches. The goal is to make the work small enough to execute safely and parallel enough to finish quickly.

## Suggest Branch proactively

Do not wait for the user to say the word `branch` when the shape of the work clearly benefits from it.

Suggest a Branch Graph when one or more of these are true:

- the user is planning a large phase, epic, migration, or long-running program;
- the project contains roughly three or more independently reviewable units;
- multiple subsystems or ownership surfaces are involved;
- some work can safely run in parallel while other work has hard prerequisites;
- a migration needs foundations, cutover, cleanup, and rollout gates;
- multiple chats or agents would otherwise duplicate discovery or step on the same files;
- one large PR would make review, rollback, or root-cause analysis unnecessarily difficult.

Do not invoke Branch for an ordinary Git branch operation or a single task whose implementation boundary is already clear.

## Boundary with the task skill

Use `branch` to decide **what the work units are, how they depend on each other, and when they join**.

Use `task` to execute **one approved repo work unit**.

Do not duplicate task lifecycle implementation inside this skill. Once a work ID enters execute mode, follow the task and senior-engineer workflows for worktrees, mutation, tests, review, publishing, and cleanup.

## Plan mode

### 1. Align before decomposing

Start with the user's actual goal, constraints, and concerns. Do not rush to a PR list.

During alignment:

- Explain the simplest useful mental model first, then add technical precision.
- Let the user challenge or modify the design. Treat changes as design inputs, not interruptions.
- Push back when a proposal weakens an invariant, duplicates existing machinery, or creates avoidable operational risk.
- Investigate obvious repository questions instead of asking the user to remember implementation details.
- Preserve useful systems. Prefer extension over parallel replacements when the current architecture already owns the concern.
- Keep implementation read-only until the user approves mutation.

Keep three buckets while discussing the project:

- **Locked** — aligned decisions and invariants.
- **Open** — questions or risks that can still change the design.
- **Deferred** — useful ideas that should not block this graph.

Do not freeze the graph while a material open item can invalidate its dependency boundaries.

### 2. Perform a transition/readiness deep dive

Before freezing a large migration or architecture change, deliberately look for assumptions the first-pass plan may miss.

Use repository evidence and current upstream specifications when needed. Common hidden dependencies include:

- authentication, OAuth, authorization, scopes, signatures, and security gates;
- transport and session identity;
- process-local caches, Maps, mutexes, queues, leases, locks, or counters used for correctness;
- retry and idempotency assumptions;
- deployment, restart, watchdog, health, readiness, canary, and rollback behavior;
- proxies, tunnels, headers, and timeouts;
- tracing, logging, metrics, and observability;
- configuration, migrations, persisted data, and upgrade behavior;
- local-resource ownership such as worktrees, browser sessions, shells, or files;
- stale tests whose assertions encode the old architecture rather than a real invariant;
- older, parallel, or unmerged work that already implements part of the desired behavior.

Keep asking:

> What currently works only because an unstated assumption happens to be true?

Separate true blockers from adjacent improvements. Put blockers in the graph and defer unrelated improvements instead of turning one project into an unbounded rewrite.

### 3. Define invariants and non-goals

Before defining work IDs, state what must remain true across the entire graph.

Typical invariants include security boundaries, backwards compatibility, state ownership, data integrity, no loss of other agents' work, and no blind replay of unsafe mutations.

Also state non-goals. A non-goal keeps a useful adjacent idea from silently expanding the implementation contract.

### 4. Build a dependency graph, not a numbered checklist

Choose work boundaries by dependency and ownership.

A good work ID:

- has one primary purpose;
- owns a coherent file or subsystem surface;
- can be tested and reviewed independently;
- leaves its integration stream in a valid state;
- establishes prerequisites needed by later work without prematurely implementing those later features.

Use **stable short IDs** that are easy to scan and easy to use as chat names. Prefer **1–3 letters plus a number**, with an optional trailing letter when one approved unit later splits:

```text
D0   Dialer local lab
D1   Dialer model contracts
M0A  Migration CI isolation
M0B  Migration CI hardening
M1   Migration CLI auth cutover
OS2  OS release verification
```

The letters are a mnemonic lane or domain, such as `D` for Dialer, `M` for Migration, or `OS` for OS. The number is the stable sequence inside that lane. Keep the short coordination ID free of dashes so it behaves like a compact issue key. If an approved unit later needs to split, add a suffix such as `M0A` and `M0B`; do not renumber already-approved sibling chats.

These IDs are coordination identifiers. They do not need to be literal Git branch names.

### Branch into focused chats

When the client supports message branching, branch from the parent message that contains the frozen graph or work-ID contract:

1. Open the message action menu.
2. Choose **Branch in new chat**.
3. Rename the child chat to the work ID, preferably `D1 — <title>`.
4. Keep execution bounded to that node's frozen contract.
5. Verify sibling progress from the repository and integration stream rather than assuming future chat state.

Other clients may call this fork, duplicate, or new conversation from message. The invariant is bounded working memory: inherit the planning point, then let the child focus on one node.

A graph should make dependencies visible:

```text
stream/dialer
    D0 → D1 → D2 → D3 → D4...
                    │
                    └──────────┐
                               ▼
stream/twenty-migration
    M0A → M0B → M1 → M2 ─────→ M3 → M4 → M5 → M6 → M7
```

### 5. Show the master sequence as waves

The graph answers **what depends on what**. Waves answer **what can run at the same time**.

For example:

```text
Wave 0: D0 ∥ M0A
Wave 1: D1 ∥ M0B ∥ M1
Wave 2: D2 ∥ M2
Gate:   D3
Then:   M3 → M4
Then:   D4 ∥ M5
Finally: M6 → M7
```

Prefer this compact master sequence when the user is going to branch chats and rename them to their work IDs.

Do not assume unlimited parallelism. Parallel work is safe only when file ownership, schemas, runtime resources, shared state, and integration order make it safe.

### 6. Decide what is truly safe to run in parallel

Parallelize only when all of these are true:

- neither unit depends on the other's behavior or schema;
- file ownership is disjoint or the merge boundary is deliberately designed;
- both units have a clearly named base or integration stream;
- one unit cannot invalidate the other's assumptions while it is in flight;
- the integration order is known.

Keep security foundations, state-model migrations, protocol cutovers, and rollout activation serial when later units rely on guarantees established earlier.

When multiple agents work at once, the repository is the synchronization point. Before publishing, every agent must inspect the latest integration-stream state and reconcile semantic conflicts. Never use blanket `ours` or `theirs` conflict resolution that can discard another agent's work.

## Freeze the implementation contract

When alignment is complete, publish a stable Branch Graph containing:

- objective and target architecture;
- component and state ownership;
- invariants;
- compatibility, rollout, and rollback strategy;
- non-goals;
- dependency graph;
- parallel waves;
- regression and security gates;
- one terminal finalization node;
- stable approval commands for execution.

Define each normal node with this shape:

```text
D1 — <short title>
Trigger: "D1 approved, go"

Purpose
Depends on / assumes
Primary files or subsystems
Changes
Acceptance / regression gates
Non-goals
Integration or rollback notes
```

`D1 approved` and `D1 approved, go` are both valid approvals when `D1` already has a frozen contract. Preserve legacy approvals such as `Branch 1 approved, go` when an older graph uses that naming.

After the user approves the graph, keep IDs stable. Do not silently start every worktree up front; start a task when its node is approved unless the user explicitly asks for a coordinated launch.

## Every graph ends with a finalization node

The last release-blocking node is not another feature branch. It is the graph's **finalization / join node**. Give it the next stable ID in the owning lane, for example `M7`.

Its contract should depend on every release-blocking node and explicitly include the actions the user wants it authorized to perform.

A finalization node should:

1. Enumerate every relevant work ID, task PR, stream PR, fix, follow-up commit, and integration state for the graph.
2. Re-open every task PR even when it has already been promoted into the stream. Inspect human comments, unresolved threads, late automated reviews, pending checks, and failing checks so review debt cannot disappear behind promotion.
3. Inspect the stream PR and collect unresolved human review plus CodeRabbit, Codex, and other configured automated-review findings; distinguish already-resolved comments from live blockers.
4. Optionally trigger a fresh zero-context **subagent** review of the integrated graph. Give the reviewer a bounded read-only packet with the objective, dependency graph, base/head or PR identifiers, changed files, invariants, validation evidence, known risks, and a request for exact file/line findings plus an overall summary. Verify its findings before applying them.
5. Perform its own holistic review for correctness, security, regressions, duplicated implementations, missing tests, stale documentation, and semantic conflicts between sibling work.
6. Fix graph-attributed issues and rerun the appropriate focused and full verification gates.
7. Reconcile the integration stream with current `main` and resolve semantic conflicts deliberately. Never use blanket conflict choices that can discard sibling work.
8. Verify every intended commit is pushed and represented correctly on the integration stream.
9. Clean leftover task worktrees, branches, sessions, and task resources through the normal typed lifecycle instead of raw deletion.
10. Push any final cleanup back to the integration stream and prove the stream is green.
11. If the frozen finalization contract explicitly authorizes promotion, merge or promote the stream to `main` through the repository's normal workflow.
12. If the project has a canary path and the frozen contract explicitly authorizes it, release to canary and verify the canary before stopping.
13. If the graph changed Consuelo OS and the release contract requires local/canary runtime verification, run the normal **Consuelo update** against the intended canary/local canary runtime and test the shipped behavior end to end.
14. Sync local main with the resulting remote `main` state, sync the integration stream, confirm the local repository is clean except for known unrelated work, and report the final graph status.

The finalization node itself is required. The fresh subagent review inside it is optional and model-neutral; use any available reviewer that can start without the branch conversation's memory.

Approval of an earlier node does **not** imply permission to merge to `main` or release. Those mutations belong in the finalization node's frozen contract so its approval is specific and auditable.

If review discovers substantial new product work rather than cleanup, append a new graph node and update the finalization dependency instead of hiding a new feature inside finalization.

## Execute mode

When the user approves a frozen work ID such as `D1 approved`, `D1 approved, go`, or the legacy `Branch N approved, go`:

1. Treat that node definition as the scope contract.
2. Inspect the current repository and latest intended integration stream. Do not rely on sibling-chat memory to determine what landed.
3. Verify prerequisite nodes are actually present. If equivalent work landed under a different implementation, adapt instead of duplicating it.
4. Invoke the senior-engineer and task workflows for repository execution.
5. Start one dedicated task/worktree from the current integration-stream tip unless the frozen graph explicitly assigns a different safe base.
6. Implement only the approved node's scope.
7. Run its focused tests and relevant regression/security gates.
8. Review and publish that node.
9. Stop. Do not silently proceed to the next work ID.

If current repository truth differs materially from the frozen plan, preserve its invariants and make the smallest necessary adaptation. Reopen global architecture only when new evidence invalidates an invariant or dependency boundary.

## Context handoff rule

Sibling branched conversations inherit planning context from the parent, but they do not share future implementation events with each other.

Therefore:

- conversation context explains **why** a work ID exists;
- the frozen node definition explains **what** it owns;
- the repository and integration stream prove **what actually landed**.

A later node may assume earlier approved work was intended to finish, but it must verify that assumption from current repository truth before mutation.

## Quality bar

A strong Branch Graph makes a large project feel boring to execute.

By the time `D1 approved, go` is used, the implementation agent should not need to rediscover the project architecture. It should reconcile current repository state, execute the bounded contract, prove it, and publish it.

The portable takeaway is simple: **split by dependency, fan out only what is independent, keep IDs stable, and always end with one deliberate join.**
