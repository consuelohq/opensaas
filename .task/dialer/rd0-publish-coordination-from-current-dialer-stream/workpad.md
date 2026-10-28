# RD0 publish coordination from current dialer stream

branch: `task/dialer/rd0-publish-coordination-from-current-dialer-stream`
stream: `stream/dialer`
pr: https://github.com/consuelohq/opensaas/pull/2437
started: 2026-09-10

## acceptance criteria

- [x] Add canonical RD entry point without removing existing dialer guidance.
- [x] Define graph, state/science invariants, test contract and copyable handoffs.
- [x] Keep product alignment and existing foundation integration explicitly open.
- [x] Validate corrected task scope, stream discovery and links; run and record canonical verification.

## plan

1. Preserve the first draft and recover onto the current dialer stream.
2. Follow the completed canonical-path migration and transfer the RD documents.
3. Validate the documentation-only diff and publish to stream/dialer.

## files changed

- `packages/os/streams/dialer/rd/ACCEPTANCE.md`
- `packages/os/streams/dialer/rd/COORDINATION.md`
- `packages/os/streams/dialer/rd/DESIGN.md`
- `packages/os/streams/dialer/rd/GRAPH.md`
- `packages/os/streams/dialer/rd/README.md`
- `packages/os/streams/dialer/rd/receipts/RD0.md`
- `packages/os/streams/dialer/rd/receipts/TEMPLATE.md`

## key decisions

- Manual branches return copyable evidence to RD0. No recurring coordinator is required.
- Every new node starts from current stream/dialer and validates the actual base SHA.
- Canonical guidance now lives under packages/os/streams/dialer after PR #2435.

## notes for ko

- Resume RD0 alignment next; coordination publication does not make RD1 ready.
- Preserve this task for alignment and the superseded worktree for recovery.

## improvements noticed

- none yet

## errors i ran into

- PR #2434 was bootstrapped from main and included 404 unrelated commits relative to the stream. It is superseded by this explicitly stream-based task.
- Facade review/verify responses timed out. Durable output exposed broader OS failures on the wrong ancestry; these were not waived or presented as passing RD0 checks.

---

## publish checklist

```bash
bun run task:push -- --message "type(dialer): description" --changed
bun run task:pr
bun run task:finish
```

## Test-first contract

Behavior: RD coordination is discoverable from canonical stream guidance, graph dependencies are explicit, and manual branches return copyable evidence-based handoffs.
No-test waiver: Markdown-only coordination/design slice. Validate links, graph, scope and task-scoped stream.context; run canonical verify against the actual stream ancestry.
Recovery: supersedes unshipped PR #2434, whose main-based bootstrap included unrelated history. Preserve that worktree as a recovery copy; do not merge it. This task starts explicitly from stream/dialer (source 0c56ea315cfe43486ad9c0f743e8fdd0a2c00a3e).
Product status remains alignment_open. No runtime, carrier calls, deployment or automatic child launches.

- 2026-09-10 01:49:33 append: `.task/dialer/rd0-publish-coordination-from-current-dialer-stream/workpad.md`

## workspace-owned: files changed

- `packages/os/streams/dialer/rd/ACCEPTANCE.md`
- `packages/os/streams/dialer/rd/COORDINATION.md`
- `packages/os/streams/dialer/rd/DESIGN.md`
- `packages/os/streams/dialer/rd/GRAPH.md`
- `packages/os/streams/dialer/rd/README.md`
- `packages/os/streams/dialer/rd/receipts/RD0.md`
- `packages/os/streams/dialer/rd/receipts/TEMPLATE.md`

## workspace-owned: activity log

- 2026-09-10 01:49:33 fs.write: `.task/dialer/rd0-publish-coordination-from-current-dialer-stream/workpad.md`
- 2026-09-10 01:50:08 write: `packages/os/streams/dialer/rd/README.md`
- 2026-09-10 01:50:08 fs.write: `packages/os/streams/dialer/rd/README.md`
- 2026-09-10 01:50:09 write: `packages/os/streams/dialer/rd/COORDINATION.md`
- 2026-09-10 01:50:09 fs.write: `packages/os/streams/dialer/rd/COORDINATION.md`
- 2026-09-10 01:50:09 write: `packages/os/streams/dialer/rd/GRAPH.md`
- 2026-09-10 01:50:09 fs.write: `packages/os/streams/dialer/rd/GRAPH.md`
- 2026-09-10 01:50:10 write: `packages/os/streams/dialer/rd/DESIGN.md`
- 2026-09-10 01:50:10 fs.write: `packages/os/streams/dialer/rd/DESIGN.md`
- 2026-09-10 01:50:10 write: `packages/os/streams/dialer/rd/ACCEPTANCE.md`
- 2026-09-10 01:50:10 fs.write: `packages/os/streams/dialer/rd/ACCEPTANCE.md`
- 2026-09-10 01:50:11 write: `packages/os/streams/dialer/rd/receipts/TEMPLATE.md`
- 2026-09-10 01:50:11 fs.write: `packages/os/streams/dialer/rd/receipts/TEMPLATE.md`
- 2026-09-10 01:50:11 write: `packages/os/streams/dialer/rd/receipts/RD0.md`
- 2026-09-10 01:50:11 fs.write: `packages/os/streams/dialer/rd/receipts/RD0.md`
- 2026-09-10 01:50:11 apply-patch: `packages/os/streams/dialer/AGENTS.md`
- 2026-09-10 01:50:38 apply-patch: `.task/dialer/rd0-publish-coordination-from-current-dialer-stream/workpad.md`
- 2026-09-10 02:01:13 apply-patch: `packages/os/streams/dialer/rd/receipts/RD0.md`
- 2026-09-10 02:01:13 apply-patch: `.task/dialer/rd0-publish-coordination-from-current-dialer-stream/workpad.md`
- 2026-09-10 02:01:14 fs.write: `.task/dialer/rd0-publish-coordination-from-current-dialer-stream/workpad.md`
- 2026-09-10 02:03:23 fs.write: `.task/dialer/rd0-publish-coordination-from-current-dialer-stream/workpad.md`

## Verification and publication status

Eight Markdown files only, plus scoped task metadata. Source/base: 0c56ea315cfe43486ad9c0f743e8fdd0a2c00a3e; task bootstrap head: a373464334904d34421e052e273041826467f92b.
Passed: links/fences, ten graph IDs, acyclic dependencies, canonical task-scoped stream.context RD entry, OS stream instruction contracts (bun x vitest run packages/workspace/scripts/lib/stream-instructions.test.ts packages/os/tests/dialer-stream-instructions.test.ts).
Review passed: zero new issues, zero related pre-existing issues, 27 background findings. DB gate passed.
Full canonical verify failed because the automatically selected @consuelo/os package suite failed in unchanged tests (including tests/task-cleanup-durable-safety.test.ts resolving packages/os/packages/workspace and script-parity inventory). No publish-valid stamp. These failures were not waived.
Durable command output: /var/folders/vl/1zvhm0bj28d1dbvbcb12b39r0000gn/T/consuelo-rd0-stream-verify-9h1wmqq0/output.log (result.json exitCode 1).
The task.push rule requires explicit Ko approval for its --approved exception. Until the suite is repaired or that scoped exception is approved, docs remain local; PR #2437 contains only its bootstrap.
Next after publication: continue RD0 alignment, refresh foundation cleanup, and freeze node contracts before issuing RD1. Preserve both RD0 worktrees; #2434 is superseded and closed.

- 2026-09-10 02:01:14 append: `.task/dialer/rd0-publish-coordination-from-current-dialer-stream/workpad.md`

- 2026-09-10 02:03:23 apply-patch: `packages/os/streams/dialer/rd/receipts/RD0.md`
## Approved documentation exception

Ko replied "approved" to the explicit scoped publication request on 2026-09-09. This authorizes the task.push --approved exception for the eight RD Markdown files and their task metadata, then normal task-to-stream promotion. Keep all failed-suite evidence; this does not authorize runtime changes, main promotion, deployment, real calls, or launching RD1.

- 2026-09-10 02:03:23 append: `.task/dialer/rd0-publish-coordination-from-current-dialer-stream/workpad.md`
