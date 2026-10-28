# resolve stream os review feedback

branch: `task/os/resolve-stream-os-review-feedback`
stream: `stream/os`
pr: https://github.com/consuelohq/opensaas/pull/2356
started: 2026-09-01

## acceptance criteria

- [ ] Define explicit task acceptance criteria before coding.

## plan

1. Read the relevant code and update this plan before editing.

## files changed

- none yet

## key decisions

- none yet

## notes for ko

- none yet

## improvements noticed

- none yet

## errors i ran into

- none yet

---

## publish checklist

```bash
bun run task:push -- --message "type(os): description" --changed
bun run task:pr
bun run task:finish
```

## Test-first contract

behavior under test: same-host private workspace navigation must preserve normal browser semantics for modified/non-primary clicks, and repository command examples must remain root-safe per workspace rule 0.
existing local pattern: the new private-route click handler intercepts every click and forces current-tab navigation; SCRIPTS.md contains package-local `cd ... && bun run ...` examples introduced by the Diffs retirement task.
new or changed tests: extend workspace chrome client assertions to require the modifier/button guard; use existing workspace docs/review validation for the root-safe command examples.
focused red command: run `packages/os/tests/workspace-chrome.test.ts` after adding the guard assertion; inspect `packages/workspace/SCRIPTS.md` exact Diffs commands.
expected red failure: current client script has no modifier/button guard; docs use `cd packages/diff-cockpit`.
no-test waiver: documentation command correction is non-runtime and covered by strict review; runtime click behavior receives a focused test.

## Review source

- CodeRabbit: preserve Cmd/Ctrl/Shift/Alt/non-primary modified-click behavior for the same-host private-route handler.
- CodeRabbit: replace package-local `cd packages/diff-cockpit && bun run ...` examples with root-safe `bun --cwd packages/diff-cockpit run ...` commands.

- 2026-09-01 01:13:08 append: `.task/os/resolve-stream-os-review-feedback/workpad.md`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-09-01 01:13:08 fs.write: `.task/os/resolve-stream-os-review-feedback/workpad.md`
- 2026-09-01 01:22:59 fs.write: `.task/os/resolve-stream-os-review-feedback/workpad.md`

## workspace-owned: files read

- `packages/os/tests/workspace-chrome.test.ts`

## workspace-owned: validation evidence

- 2026-09-01 01:14:01 `review.run`: passed — OK
- 2026-09-01 01:17:30 `verify`: failed — COMMAND_FAILED
- 2026-09-01 01:19:59 `verify`: failed — COMMAND_FAILED

## Validation evidence

- RED: modified-click guard assertion failed against the original same-host private-route handler (trace `trc_9490f9557ef8`).
- GREEN: `workspace-chrome.test.ts` passes 2/2 and both Diffs package commands are root-safe with no remaining `cd packages/diff-cockpit` examples (trace `trc_88373cd2ad67`).
- Strict review vs `origin/stream/os`: 0 issues / 0 blockers (trace `trc_953ff2b8cea4`).
- Formal verify was attempted twice but the facade returned upstream 502 before producing a verify stamp. One attempt mutated a facade snapshot as part of broad verification; that generated snapshot drift was explicitly restored to the stream baseline. The task diff is now limited to the two CodeRabbit fixes plus scoped task metadata.

- 2026-09-01 01:22:59 append: `.task/os/resolve-stream-os-review-feedback/workpad.md`
