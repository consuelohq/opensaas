# append stream agent instructions and publish dialer context

branch: `task/os-distribution/append-stream-agent-instructions-and-publish-dialer-context`
stream: `stream/os-distribution`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1767/append-stream-agent-instructions-and-publish-dialer-context
github pr: https://github.com/consuelohq/opensaas/pull/1767
started: 2026-08-04

## acceptance criteria

- [ ] `stream.context` includes the selected stream’s `AGENTS.md` in JSON and human-readable output.
- [ ] Missing stream instructions are explicit and non-fatal.
- [ ] Canonical dialer guidance reflects the current LeadConnector, Hono/Effect, Railway, Cloudflare, Marketplace, predictive queue, transcript/history, and live-call safety architecture.
- [ ] OS reconciliation publishes that guidance under visible `~/Consuelo/Steering`, never hidden `~/.consuelo`.
- [ ] `getSteering()` loads the visible dialer guidance exactly once.
- [ ] Focused tests, package validation, strict review, and full verify pass.

## plan

1. Read the current OS stream-context runtime, instruction reader, managed user content, steering loader, tests, and release packaging.
2. Add red contracts for instruction inclusion and visible dialer steering publication.
3. Implement shared instruction sourcing and visible update-clean publication without touching hidden runtime user state.
4. Validate exact CLI output, steering assembly, reconciliation, package tests/typecheck/build, review, and publish.

## current status

- Discovery in progress on the current OS distribution stream; no production edits yet.

## files changed

- none yet

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- none yet

## workspace-owned: validation evidence

- 2026-08-04 20:05:48 `review.run`: passed — OK
- 2026-08-04 20:05:49 `review.run`: passed — OK
- 2026-08-04 20:06:15 `verify`: failed — COMMAND_FAILED
- 2026-08-04 20:07:31 `review.run`: passed — OK
- 2026-08-04 20:07:58 `verify`: passed — OK

## discovery

- The first task was intentionally abandoned because `stream/workspace-agents` was 499 main commits behind and did not contain the current OS stream subsystem. PR #1766 was closed without merge; worktree and branch were removed.
- This task targets `stream/os-distribution`, which contains the current OS stream runtime and visible user-content reconciliation.
- User-visible instructions belong under `~/Consuelo/Steering`; hidden `~/.consuelo` remains runtime state.

## Test-first contract

- Behavior: `stream.context` returns/renders `AGENTS.md`, and install/update reconciliation creates `~/Consuelo/Steering/dialer-AGENTS.md` from canonical source.
- Existing pattern: stream instruction reader returns an explicit `{ exists, path, content }`; managed content separates preserve-custom and update-clean ownership.
- Tests: extend stream context runtime contracts, managed user content contracts, and steering composition coverage.
- Focused red: run only the relevant OS test files before implementation.
- Expected red: current context result/output omits instructions and reconciliation omits the dialer file.

## key decisions

- Product guidance is system-owned update-clean content; `Steering/system.md` remains user-owned preserve-custom.
- Keep one canonical dialer document and reuse its exact bytes for stream context and visible steering to prevent drift.

## notes for ko

- none yet

## improvements noticed

- none yet

## issues and recovery

- none yet

---

## publish checklist

```bash
bun run task:push -- --message "type(os-distribution): description" --changed
bun run task:pr
bun run task:finish
```

## workspace-owned: files read

- `packages/os/SCRIPTS.md`


## implementation

- Added canonical dialer instructions at `packages/os/streams/dialer/AGENTS.md` and a byte-identical Workspace mirror.
- Added Workspace stream-instruction reader and included the instruction result in JSON and human output.
- Added `reconcileVisibleDialerSteering`, which synchronizes the canonical file to visible `~/Consuelo/Steering/dialer-AGENTS.md`, rejects `.consuelo`, supports dry-run, and preserves unrelated user steering.
- Wired visible steering synchronization into normal OS managed-component install/update reconciliation.
- Added the dialer stream instructions to the required runtime bundle closure.
- Modernized durable dialer guidance around predictive GHL stage queues, reuse-first architecture, background refresh/reset semantics, Hono/Effect boundaries, three-part deployment topology, live-call safety, transcripts/history, transfers, and production lessons.
- Fixed one brittle pre-existing steering-budget test to locate its named Markdown section rather than assuming it was alphabetically last.

## validation evidence

- Clean red proof: OS tests failed on missing dialer stream files and visible synchronizer; Workspace test failed on missing stream-instruction helper.
- Focused green: 34 OS tests and 2 Workspace tests passed.
- Current OS `stream.context` already supported instructions; the missing behavior was the dialer file, Workspace parity, and visible steering publication.
- The first task/PR (#1766) was closed and cleaned without merge after discovering its source stream predated the current OS subsystem by 499 main commits.


## final validation before review

- OS and Workspace CLI proof: JSON includes `instructions.exists=true`; human output prints the heading before stream decisions; both copies contain the queue mapping.
- Expanded affected OS contracts: 90/90 passed across stream instructions, visible steering, steering assembly, runtime bundle, release publication, lifecycle activation, and retention/uninstall.
- OS syntax/typecheck: passed.
- Workspace focused stream-instruction tests: 2/2 passed.
- Workspace repository-root suite: the new test passed; 19 unrelated pre-existing failures remain in manifest/browser/wait/hook/context baselines on `stream/os-distribution`.
- Full OS suite was initially invalidated by three concurrent runs left alive after connector 502 responses. After serializing, all affected contracts passed; unrelated full-suite concurrency output is not used as task evidence.
- Diff cleanup removed whole-file formatter churn and an unrelated generated snapshot; the tracked patch is surgical.


## publish gate

- Strict review initially exposed one related pre-existing async-wrapper finding in the touched Workspace CLI; converted the entrypoint to explicit promise composition while preserving the existing terminal catch boundary.
- Strict review rerun: 0 blocking, related, or pre-existing findings.
- Full verify: passed, publish-valid, database guard clean.
- Affected contracts after final surgical diff: 90/90 OS tests, 2/2 Workspace tests, OS typecheck, both CLI proofs.
