# publish dialer stream instructions

branch: `task/os-steering/publish-dialer-stream-instructions`
stream: `stream/os-steering`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1771/publish-dialer-stream-instructions
github pr: https://github.com/consuelohq/opensaas/pull/1771
started: 2026-08-04

## acceptance criteria

- [ ] `stream.context` includes durable dialer `AGENTS.md` instructions in OS and Workspace JSON/human output.
- [ ] Missing stream instructions remain an explicit optional empty state.
- [ ] Runtime install/update publishes the canonical dialer context to visible `~/Consuelo/Steering/dialer-AGENTS.md`, never hidden `.consuelo`.
- [ ] The runtime bundle requires the dialer stream file and steering loads it exactly once.
- [ ] Dialer guidance records current GHL queue mapping, reuse-first architecture, deployment topology, live-call safety, transcripts/history, and transfers.
- [ ] Focused release/lifecycle tests, typecheck, strict review, and full verify pass.

## plan

1. Confirm current-main stream-context, managed install, runtime bundle, and steering ownership.
2. Reproduce missing dialer instructions and visible steering with focused red contracts.
3. Apply only the previously validated minimal implementation; do not import historical os-distribution divergence.
4. Re-run affected release/lifecycle contracts, CLI proof, strict review, and publish verification.

## current status

- Fresh `stream/os-steering` was created from current main after the historical `stream/os-distribution` review proved too broad and conflicted. No production edits yet.

## files changed

- none yet

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- none yet

## workspace-owned: validation evidence

- 2026-08-04 20:21:37 `review.run`: passed — OK
- 2026-08-04 20:21:38 `review.run`: passed — OK
- 2026-08-04 20:22:00 `verify`: passed — OK

## discovery

- Previous implementation passed 90 affected OS tests, 2 Workspace tests, typecheck, strict review, and full verify on PR #1767.
- Promotion PR #1770 was closed without merge because it contained 53 historical commits, 209 files, and 14 unrelated conflicts.
- This task exists solely to promote the validated minimal change from current main.

## Test-first contract

- Reuse the prior clean red contracts: missing dialer stream files, Workspace instruction reader, and visible steering synchronizer.
- Re-run those tests on current main before implementation to ensure the gap still exists.
- Preserve current-main file structure and only add surgical integration lines.

## key decisions

- Canonical system-owned product context lives in source control and is mirrored to visible user steering; user-authored steering remains untouched.

## notes for ko

- none yet

## improvements noticed

- none yet

## issues and recovery

- none yet

---

## publish checklist

```bash
bun run task:push -- --message "type(os-steering): description" --changed
bun run task:pr
bun run task:finish
```


## implementation

- Added one canonical 11,655-byte dialer operating guide under OS streams and a byte-identical Workspace mirror.
- Workspace stream context now returns `instructions` in JSON and prints the stream document before decisions in human output.
- Added a focused visible steering synchronizer that writes `dialer-AGENTS.md` under the configured visible user root, rejects any path containing a hidden `.consuelo` segment, supports dry run, and atomically updates stale system-owned content.
- Normal managed-component install/update reconciliation now invokes the synchronizer and emits a `seed_steering` action.
- Runtime bundles now require the dialer stream file; release and lifecycle fixtures include it.
- Current steering loading was not changed: it already loads supported Markdown from `~/Consuelo/Steering`; the new integration test proves the dialer marker appears exactly once.
- The dialer document captures GHL stage queues, predictive/local-presence reuse, refresh/reset semantics, LeadConnector/Hono/Effect ownership, three-part deployment topology, live-call safety, production fixes, Groq transcript/history direction, and transfer status.

## validation

- Clean red proof: missing OS/Workspace dialer stream files, missing Workspace reader, missing visible synchronizer, and missing installer output.
- Green affected contracts: 109 OS tests plus 2 Workspace tests passed.
- OS syntax/typecheck passed; Workspace CLI/helper syntax passed.
- Exact CLI proof: OS and Workspace JSON report `instructions.exists=true`; both human outputs place instructions before decisions.
- End-to-end install proof: visible target created, no hidden copy created, `seed_steering` action emitted, and `getSteering()` included the heading exactly once.
- Additional hidden-parent test verifies nested `.consuelo/Consuelo` roots are rejected.
- Historical PR #1770 was closed without merge; this current-main task contains only the minimal requested change.


## publish gate

- Strict review: 0 blocking, related, or pre-existing findings across Consuelo OS and Workspace.
- Full verify: passed, publish-valid, database guard clean.
- Final current-main evidence: 109 OS tests, 2 Workspace tests, OS typecheck/syntax, exact dual-CLI output, visible-only installation, hidden-root rejection, and one steering inclusion.
