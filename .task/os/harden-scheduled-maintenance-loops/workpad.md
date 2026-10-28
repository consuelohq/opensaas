# harden scheduled maintenance loops

branch: `task/os/harden-scheduled-maintenance-loops`
stream: `stream/os`
pr: https://github.com/consuelohq/opensaas/pull/2498
started: 2026-09-21

## acceptance criteria

- [ ] Define explicit task acceptance criteria before coding.

## plan

1. Read the relevant code and update this plan before editing.

## files changed

- `packages/workspace/bun.lock`
- `packages/workspace/package-lock.json`
- `packages/workspace/package.json`


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

## workspace-owned: files read

- `package.json`
- `packages/workspace/bun.lock`
- `packages/workspace/package.json`

## Acceptance criteria update

- [ ] Salvage the still-applicable workspace tar remediation from the stale security stream onto current main without importing stale stream history.
- [ ] Prove current main resolves tar 7.5.13 before editing and patched tar 7.5.22 after editing in both committed workspace locks.
- [ ] Preserve self-healing source fixes already present on current main; do not merge metadata-only self-healing history.
- [ ] Clean stale schedule PR state without deleting accepted history.
- [ ] Update both ChatGPT schedule prompts so triage happens before task creation, clean days create no PR/branch churn, maintenance-harness self-edits require independent evidence, and completion requires durable publication/promotion proof.
- [ ] Re-enable security and self-healing only after repo cleanup and prompt updates.

## Test-first contract

behavior under test: `packages/workspace` must not resolve tar 7.5.13; its compatible transitive tar dependency must resolve 7.5.22 in both Bun and npm committed locks.
existing local pattern: prior validated security task #2364 used a narrow workspace-level `overrides.tar = 7.5.22`.
new or changed tests: no permanent runtime test; validate exact pre/post manifest + lock assertions, frozen-lock install, focused package validation, review, and verify.
focused red command: task-scoped Bun assertion reading `packages/workspace/package.json`, `packages/workspace/bun.lock`, and `packages/workspace/package-lock.json`.
expected red failure: workspace has no tar override and both committed locks resolve tar 7.5.13.
no-test waiver: permanent runtime coverage is not appropriate for generated transitive lock resolution; exact RED/GREEN lock assertions plus frozen-lock validation are the executable contract.

## Evidence update

- RED: workspace override absent; Bun lock tar 7.5.13; npm lock tar 7.5.13 (trace `trc_07b4694f3ede`).
- Installed `security.scan` still expects missing root `security:scan`; do not treat failed scanner transport as a clean result.
- Do not merge stale `stream/security` or `stream/self-healing` wholesale.

- 2026-09-21 03:43:05 append: `.task/os/harden-scheduled-maintenance-loops/workpad.md`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-09-21 03:43:05 fs.write: `.task/os/harden-scheduled-maintenance-loops/workpad.md`
- 2026-09-21 03:43:46 apply-patch: `packages/workspace/package.json`
- 2026-09-21 03:43:46 apply-patch: `packages/workspace/bun.lock`
- 2026-09-21 03:43:46 apply-patch: `packages/workspace/package-lock.json`
- 2026-09-21 03:51:49 fs.write: `.task/os/harden-scheduled-maintenance-loops/workpad.md`

## workspace-owned: validation evidence

- 2026-09-21 03:51:43 `review.run`: passed — OK
- 2026-09-21 03:51:55 `review.run`: passed — OK

## Validation update

- GREEN exact resolution assertion passed: override/bun/npm all resolve tar 7.5.22 (trace `trc_b6b24fc092d7`).
- `bun install --frozen-lockfile --lockfile-only --ignore-scripts` passed with no further repo changes (trace `trc_9ea58f3286c0`).
- `bun audit` no longer reports the tar advisory cluster; it still reports 13 unrelated vulnerabilities (8 high, 5 moderate) in nanoid/postcss/vite/vitest/ws. Those are outside this narrow salvage change and remain visible for future security triage (trace `trc_2db1f5970bcf`).
- Broad workspace tests are not a valid scoped gate on current main: 49 files / 805 tests passed but 21 files / 93 tests failed across unrelated workspace baseline/tooling areas; the run also rewrote a facade snapshot, which was restored immediately (test trace `trc_bd937dcab61c`, restore trace `trc_6cc091df3489`).
- Working-tree diff is now limited to the intended three package/lock files plus task metadata (trace `trc_2c1d70f2baa8`).
- `review.run` and `verify` were each attempted through the typed task facade and timed out without a result. They are recorded as tooling failures, not passes.

- 2026-09-21 03:51:49 append: `.task/os/harden-scheduled-maintenance-loops/workpad.md`
