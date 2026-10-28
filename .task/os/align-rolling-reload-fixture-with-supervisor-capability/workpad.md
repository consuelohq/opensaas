# align rolling reload fixture with supervisor capability

branch: `task/os/align-rolling-reload-fixture-with-supervisor-capability`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/2247/align-rolling-reload-fixture-with-supervisor-capability
github pr: https://github.com/consuelohq/opensaas/pull/2247
started: 2026-08-28

## acceptance criteria

- [ ] Define explicit task acceptance criteria before coding.

## plan

1. Read the relevant code and update this plan before editing.

## current status

- Task started. Update this before publish.

## files changed

- none yet

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-08-28 23:02:44 fs.write: `.task/os/align-rolling-reload-fixture-with-supervisor-capability/workpad.md`
- 2026-08-28 23:03:35 fs.write: `.task/os/align-rolling-reload-fixture-with-supervisor-capability/workpad.md`

## workspace-owned: validation evidence

- 2026-08-28 23:04:12 `review.run`: passed — OK
- 2026-08-28 23:04:17 `review.run`: passed — OK

## key decisions

- none yet

## notes for ko

- none yet

## improvements noticed

- none yet

## issues and recovery

- none yet

---

## publish checklist

```bash
bun run task:push -- --message "type(os): description" --changed
bun run task:pr
bun run task:finish
```

## Test-first contract

behavior under test: a pool fixture claiming current rolling-reload behavior must declare supportsRuntimeCurrentRollingReload and expose child output on failure
existing local pattern: packages/os/tests/consuelo-reload.test.ts executes the canonical adapter in a temporary launchd/worker-pool harness
new or changed tests: correct the existing healthy rolling-pool fixture capability and improve the status assertion diagnostic
focused red command: cd packages/os && bun test tests/consuelo-reload.test.ts -t 'should roll a healthy supervised worker pool on reload without restarting launchd'
expected red failure: the fixture is treated as a legacy supervisor and fails replacement handoff because its current rolling capability is absent
no-test waiver: not applicable

- 2026-08-28 23:02:44 append: `.task/os/align-rolling-reload-fixture-with-supervisor-capability/workpad.md`

## current status

- Focused red reproduced the legacy-supervisor handoff failure.
- Corrected only the rolling-reload test fixture and failure diagnostic.
- GREEN: reload execution, ingress continuity, worker-pool, and Bun product-server suites — 26 pass, 0 fail.
- The full package registry gate on the parent task failed only in unrelated facade tests for media.transcribe dry-run, subagent dry-run, and a filesystem pagination message. Ko explicitly authorized passing unrelated failures for this release.

## files changed

- packages/os/tests/consuelo-reload.test.ts
- task metadata and this workpad

- 2026-08-28 23:03:35 append: `.task/os/align-rolling-reload-fixture-with-supervisor-capability/workpad.md`
