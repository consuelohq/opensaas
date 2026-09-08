# fix stale lifecycle recovery bun runtime

branch: `task/os/fix-stale-lifecycle-recovery-bun-runtime`
stream: `stream/os`
pr: https://github.com/consuelohq/opensaas/pull/2414
started: 2026-09-08

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

## Acceptance criteria

- [ ] Stale lifecycle recovery invokes a Bun executable that the supported installer guarantees exists on every accepted node layout, including Homebrew/PATH Bun installs.
- [ ] Recovery remains compatible with the canonical managed OS runtime and does not broaden shell injection or executable trust.
- [ ] Regression exercises the outer command construction, not only the extracted inline recovery script.
- [ ] Focused tests, review, and full verify pass before promotion.

## Test-first contract

behavior under test: a stale local node whose installer discovered Bun from PATH can execute lifecycle recovery without requiring `$HOME/.bun/bin/bun` to exist.
existing local pattern: stream review P1 reports `mcp-proxy.ts` hard-codes `$HOME/.bun/bin/bun`, while bootstrap accepts a Bun from PATH and installs the managed OS executable under `$CONSUELO_HOME/bin/consuelo-os` without necessarily creating the Bun user-home path.
new or changed tests: extend the stale lifecycle recovery execution tests to inspect/run the complete command and simulate a PATH-provided Bun with no `$HOME/.bun/bin/bun`.
focused red command: run the smallest Device Authority / MCP proxy stale-lifecycle test suite after adding the complete-command regression.
expected red failure: current command tries the absent `$HOME/.bun/bin/bun` and exits before the recovery script begins.
no-test waiver: not applicable.

## Review source

- Stream PR #2411 Codex P1 comment 3959064233: invoke the installed/managed runtime or resolve a safe fallback; current tests only exercise the inline script and miss the outer hard-coded Bun executable.

- 2026-09-08 14:40:58 append: `.task/os/fix-stale-lifecycle-recovery-bun-runtime/workpad.md`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-09-08 14:40:58 fs.write: `.task/os/fix-stale-lifecycle-recovery-bun-runtime/workpad.md`
- 2026-09-08 14:45:00 fs.write: `.task/os/fix-stale-lifecycle-recovery-bun-runtime/workpad.md`

## workspace-owned: files read

- `packages/os/cloudflare/os-device-authority/src/services/mcp-proxy.ts`
- `packages/os/tests/workspace-node-registry-routing.test.ts`

## workspace-owned: validation evidence

- 2026-09-08 14:44:35 `review.run`: passed — OK
- 2026-09-08 14:44:50 `verify`: passed — OK

## Validation evidence

- RED: the whole-command regression reproduced the review bug exactly: with no `$HOME/.bun/bin/bun`, the generated stale recovery command exited 127 before the inline recovery script started (trace `trc_19597aa0420b`).
- Implementation: the recovery entrypoint now invokes the installer-guaranteed managed runtime at `$CONSUELO_HOME/bin/consuelo-os`; the inline script continues to use `process.execPath` for the verified lifecycle child, so the same trusted managed executable remains authoritative.
- GREEN: the whole-command regression passes with no user-home Bun and confirms the lifecycle child is executed by the managed runtime (trace `trc_e2f81db9321c`).
- Related suite: `workspace-node-registry-routing.test.ts` passes 66/66 after updating the existing command-contract assertions (trace `trc_c88a604a6508`).
- Strict review: 0 issues / 0 blockers (trace `trc_389c71122b8f`). The only docs opportunity is non-blocking and not applicable because this is an internal stale-node recovery implementation detail, not a user-visible MCP contract change.
- Full verify: passed with `publishValid=true` (trace `trc_ca8529ed2f5b`).

## Acceptance checklist

- [x] Stale lifecycle recovery uses an installer-guaranteed runtime for PATH/Homebrew Bun layouts.
- [x] Existing release trust, metadata validation, shell-literal safety, and lifecycle child behavior remain intact.
- [x] Regression executes the complete outer command.
- [x] Focused and related tests pass.
- [x] Review and full verify pass.

- 2026-09-08 14:45:00 append: `.task/os/fix-stale-lifecycle-recovery-bun-runtime/workpad.md`
