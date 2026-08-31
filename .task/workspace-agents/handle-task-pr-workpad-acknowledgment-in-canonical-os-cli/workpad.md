# handle task pr workpad acknowledgment in canonical OS CLI

branch: `task/workspace-agents/handle-task-pr-workpad-acknowledgment-in-canonical-os-cli`
stream: `stream/workspace-agents`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1861/handle-task-pr-workpad-acknowledgment-in-canonical-os-cli
github pr: https://github.com/consuelohq/opensaas/pull/1861
started: 2026-08-12

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

- 2026-08-12 00:42:07 fs.write: `.task/workspace-agents/handle-task-pr-workpad-acknowledgment-in-canonical-os-cli/workpad.md`
- 2026-08-12 00:43:07 fs.write: `.task/workspace-agents/handle-task-pr-workpad-acknowledgment-in-canonical-os-cli/workpad.md`

## workspace-owned: validation evidence

- 2026-08-12 00:43:34 `review.run`: passed — OK
- 2026-08-12 00:43:46 `verify`: passed — OK

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
bun run task:push -- --message "type(workspace-agents): description" --changed
bun run task:pr
bun run task:finish
```

## Test-first contract

- Behavior under test: canonical OS `task.pr` must accept the bare `--ack-workpad-incomplete` boolean emitted by the typed facade and use it to explicitly acknowledge the workpad readiness gate before any GitHub promotion operation.
- Existing local pattern: `packages/workspace/scripts/task-pr.js` already implements the intended parser/help/workpad-gate behavior; canonical `packages/os/scripts/task-pr.js` is missing it while OS facade schema/command metadata already advertise the flag.
- New or changed tests: extend OS tool-manifest/facade parity coverage to spawn the canonical task-pr CLI with `--ack-workpad-incomplete --help` and assert success; assert canonical source imports/calls `assertWorkpadReady` with `ackIncomplete: args.ackWorkpadIncomplete`.
- Focused red command: OS `tests/tool-manifest.test.ts` only.
- Expected red failure: current canonical CLI reports `missing value for --ack-workpad-incomplete` and has no workpad acknowledgment call.
- No-test waiver: none.

- 2026-08-12 00:42:07 append: `.task/workspace-agents/handle-task-pr-workpad-acknowledgment-in-canonical-os-cli/workpad.md`

- 2026-08-12 00:42:23 apply-patch: `packages/os/tests/tool-manifest.test.ts`
- 2026-08-12 00:42:54 apply-patch: `packages/os/scripts/task-pr.js`
## Current-head Codex acknowledgment evidence

- Exact comment 3762774316 reproduced: canonical `node packages/os/scripts/task-pr.js --ack-workpad-incomplete --help` exited 1 because the facade-emitted flag was parsed as value-bearing.
- Compatibility source already contained the intended behavior; canonical OS had drifted.
- Fix: canonical OS task-pr now documents and parses the flag as boolean, sets `args.ackWorkpadIncomplete`, imports `assertWorkpadReady`, and passes `{ ackIncomplete: args.ackWorkpadIncomplete }` into the workpad gate before GitHub operations.
- Red: OS tool-manifest/facade suite 1 failure / 15 passes at the direct CLI assertion.
- Green: OS tool-manifest/facade suite 16/16, including direct bare-flag CLI success and source behavior parity.

- 2026-08-12 00:43:07 append: `.task/workspace-agents/handle-task-pr-workpad-acknowledgment-in-canonical-os-cli/workpad.md`
