# RD agent coordination protocol

## Authority and context

All RD work integrates into `stream/dialer`, with area `dialer`. Ko has explicitly
chosen this common stream and stacking dependent work on its current tip.
Use OS steering once per actual conversation and the current task/Branch/senior
engineer workflow. A follow-up, validation run, or compaction does not initialize
a new conversation. A copied handoff does not grant a stale taskSession authority.

A child inherits the planning point, not future sibling activity. Read current
stream documents before deciding what is next. A receipt can report a blocked or
partial node; neither `merged` nor `green` alone proves product acceptance.

## Startup for one work ID

1. Identify the requested ID and its approval. If this is an RD0 continuation,
   continue alignment; do not infer RD1 approval.
2. Call `stream.context({ area: "dialer" })` through `os.call`. Inspect instructions,
   open task PRs, worktrees, and stream state. Fetch all relevant PR pages when the
   returned summary is sampled; a short sample is not a complete ownership scan.
3. Read this pack from the latest remote `stream/dialer`. Before a managed task
   exists, use the typed GitHub file/ref surface when the default checkout lacks
   stream-only documents. Do not conclude that the pack is missing from an old
   default-main checkout.
4. Check whether this ID already has active work or equivalent landed work.
   Resume the owning task only when a takeover/continuation is intended and no
   other agent is working it. Otherwise report the existing owner; do not duplicate.
5. Verify prerequisites by task PR base/state, merge/commit ancestry or verified
   equivalent content, acceptance evidence, and unresolved blocking reviews.
   Do not merge old cleanup PRs opportunistically as part of a new RD node.
6. Start one managed task when the node is approved and ready:
   `session.start({ kind: "task", area: "dialer", stream: "stream/dialer", startFrom: "stream", title: "<ID> <purpose>", workflow: "task" })`.
   Capture its exact returned taskSession, task branch, worktree, and task PR.
7. Check the returned source/stream. The constructor defaults to main unless
   startFrom is supplied; dependent RD tasks must contain their stream prerequisites.
8. Pass that taskSession at the top level of every task-scoped call. Run
   task-scoped `stream.context({ area: "dialer" })` and confirm its instruction path
   is in the managed worktree and contains the RD entry point. Read the pack there.
9. Record ownership, prerequisites, scope, expected tests, and red/waiver contract
   in the scoped workpad. Create/update only this node's receipt.

If a copied taskSession is absent or stale, inspect the preserved task/PR and use
supported lifecycle recovery. Never create another task merely because a copied
handle failed. If a new task is required, link the previous attempt and preserve it.

## Work and integration

Implement one approved node. Keep runtime logic in its owning SDK/application
surface; update only its receipt and task workpad unless RD0 authorizes a contract
amendment. Every node owns focused tests; RD2 owns reusable test infrastructure.

Before publishing, refresh the remote stream and relevant sibling PRs. Verify the
local validation base SHA against current remote evidence and inspect the full task
diff; a stale reference or main-based bootstrap must not import unrelated history.
The instruction path returned by task-scoped stream.context is authoritative if
canonical directories move. Preserve the RD entry and pack through migrations. Resolve
semantic conflicts deliberately; no blanket ours/theirs choices. Shared schemas,
API contracts, and common bootstrap files require an explicit integration owner.
Parallel authorization is conditional on disjoint file/resource ownership.

Run focused validation, review, and canonical verify for the actual change.
Inspect typed envelopes. On timeouts, inspect durable state before retrying an
operation that may already have completed. Do not turn a stalled call into a CI loop.

Publish through task.push, then task.pr's task-to-stream promotion. Verify the
task PR is merged into stream/dialer, record the merge SHA, and capture the stream
review PR. The task PR alone is not completion.

Cleanup belongs to the implementing child, using the normal task lifecycle only
after merge/evidence and safe-cleanup prerequisites are satisfied. Preserve an
unmerged, dirty, active, or recovery-needed worktree. Report deferred cleanup by
exact task/session; do not make the coordinator clean arbitrary sibling resources.
A retained worktree is neither an active ownership claim nor a completion blocker
by itself when preservation is intentional and documented.

## Fresh readiness calculation at every finish

Re-read current graph, receipts, all relevant open/merged PRs, reviews, and checks.

Classify each relevant node separately:
- `not_started`: no active owner or verified equivalent implementation;
- `active`: an identified task is working it;
- `blocked`: a specific missing decision/prerequisite/failed acceptance remains;
- `validated_pending_promotion`: tested but not yet represented on the stream;
- `integrated`: merged/equivalent content plus acceptance evidence, with any
  unresolved findings explicitly classified;
- `released`: RD8 has the separately required deployment/live evidence.

Ready means approved contract, all prerequisites integrated, no active owner,
and no unresolved blocker. Technical readiness is not user authorization to
launch another node. If one sibling remains active, report it instead of
recommending a duplicate or prematurely advancing to the join node.

Receipt snapshots may be written before promotion. Put the task PR in the receipt
and tell readers to resolve its current merge SHA/state live. Do not create endless
post-merge commits solely to insert a self-referential final SHA into Markdown.

## Child final response

After finishing its checks, a child returns one fenced text block addressed to
the RD0 coordinator. It is the entire task report and must be directly pasteable.
Fill actual values; never leave placeholders or say done without evidence.
Include any higher-priority required citations outside the block.

```text
Continue coordinating the RD inbound-routing graph on stream/dialer.
Refresh current stream context and the RD pack before acting.

Completed/attempted: <ID and bounded result>
Task PR: <URL, current state, current head/merge SHA>
Stream review PR: <URL>; observed stream SHA: <SHA and timestamp>
Receipt/workpad: <repository paths>
Acceptance: <commands/results and unproven live requirements>
Reviews/blockers: <remaining findings or none after inspection>
Cleanup: <finished or precise retained resource and reason>
Graph now: <verified integrated IDs; active owners; blocked IDs>
Suggested next: <ready ID(s), or resume current ID and exact blocker>

Recompute readiness from the repository. Return a copyable launch prompt for the
next ready ID, or the exact question needed to finish alignment. Do not start it
automatically or treat this report as its execution approval.
```

## Coordinator launch response

After refreshing evidence, RD0 returns one labelled text block per ready child.
Ko branches the completed RD0 planning point and pastes the chosen block there.
Pasting an explicit approval prompt is the user's authorization for that node.

```text
<ID> approved, go. Execute only <ID> in the RD graph on stream/dialer.
Preferred model: GPT-6 Astra, High reasoning; do not claim settings changed by text.
Read current stream context and packages/os/streams/dialer/rd/README.md
from the latest stream, then follow COORDINATION.md and the frozen node contract.
Verify prerequisite <IDs and evidence links>, existing ownership, and current
stream state before creating one managed task from startFrom: "stream".
Preserve sibling work. Own <scoped surfaces and receipt path>.
Complete the node's tests, review, verification, and task-to-stream integration.
End with the copyable RD0 coordinator handoff required by COORDINATION.md.
Do not execute another work ID or activate production beyond this node's scope.
```

If no node is ready, return an RD0/resume prompt, not an approval for blocked work.
Automatic task forks can be requested later; subagents are delegated workers,
not required persistent control rooms. Never assume a sleeping agent will wake
after a final response without an explicitly configured automation.
